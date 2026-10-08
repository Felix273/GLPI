<?php
/**
 * Standalone utility functions for the GLPI Asset Dashboard server.
 *
 * These functions are extracted from server.php so they can be unit-tested
 * independently without executing the full request lifecycle.
 */

define('RATE_LIMIT_DIR', sys_get_temp_dir() . '/glpi-ratelimit');
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW = 60;
const GLPI_CONFIG_UPDATE_RIGHT = 2;

function sessionHasAdministrativeProfile(mixed $value): bool
{
    if (!is_array($value)) {
        return false;
    }

    foreach ($value as $key => $item) {
        if (strtolower((string)$key) === 'config' && is_numeric($item)) {
            if (((int)$item & GLPI_CONFIG_UPDATE_RIGHT) !== 0) {
                return true;
            }
        }

        if (is_array($item) && sessionHasAdministrativeProfile($item)) {
            return true;
        }
    }

    return false;
}

/**
 * Simple file-based rate limiter per client key (typically IP:endpoint).
 */
function rateLimit(string $key, int $max = RATE_LIMIT_MAX, int $window = RATE_LIMIT_WINDOW): bool
{
    $file = RATE_LIMIT_DIR . '/' . md5($key) . '.json';
    @mkdir(RATE_LIMIT_DIR, 0777, true);

    $now = time();
    $data = ['timestamp' => $now, 'count' => 1];

    if (is_file($file)) {
        $stored = json_decode((string) file_get_contents($file), true);
        if (is_array($stored) && isset($stored['timestamp']) && ($now - $stored['timestamp']) < $window) {
            $data = ['timestamp' => $stored['timestamp'], 'count' => $stored['count'] + 1];
        }
    }

    file_put_contents($file, json_encode($data));

    return $data['count'] <= $max;
}

function configuredRateLimit(string $key): bool
{
    $configuredMax = filter_var(getenv('RATE_LIMIT_MAX'), FILTER_VALIDATE_INT);
    $configuredWindow = filter_var(getenv('RATE_LIMIT_WINDOW'), FILTER_VALIDATE_INT);

    return rateLimit(
        $key,
        $configuredMax !== false && $configuredMax > 0 ? $configuredMax : RATE_LIMIT_MAX,
        $configuredWindow !== false && $configuredWindow > 0 ? $configuredWindow : RATE_LIMIT_WINDOW
    );
}

/**
 * Sanitise an SVG string, stripping dangerous elements, attributes and
 * script URLs.  Returns false on malformed XML.
 */
function sanitizeSvg(string $svg): string|false
{
    $dom = new DOMDocument();
    libxml_use_internal_errors(true);
    if (!@$dom->loadXML($svg, LIBXML_NOERROR | LIBXML_NOWARNING | LIBXML_NONET)) {
        libxml_clear_errors();
        return false;
    }

    $xpath = new DOMXPath($dom);
    $xpath->registerNamespace('svg', 'http://www.w3.org/2000/svg');

    $dangerousAttrs = [
        'onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur',
        'onchange', 'onsubmit', 'onkeydown', 'onkeyup', 'onkeypress',
        'onpointerdown', 'onpointermove', 'onpointerup', 'onabort',
        'oncanplay', 'oncanplaythrough', 'oncuechange', 'ondurationchange',
        'onemptied', 'onended', 'onloadeddata', 'onloadedmetadata',
        'onloadstart', 'onpause', 'onplay', 'onplaying', 'onprogress',
        'onratechange', 'onseeked', 'onseeking', 'onstalled', 'onsuspend',
        'ontimeupdate', 'onvolumechange', 'onwaiting', 'onreset', 'oninput',
        'oninvalid', 'oncontextmenu', 'oncopy', 'oncut', 'onpaste', 'onwheel',
        'ontouchstart', 'ontouchmove', 'ontouchend'
    ];
    $dangerousElements = ['script', 'foreignObject', 'handler', 'iframe', 'object', 'embed'];

    foreach ($dangerousElements as $el) {
        $nodes = $xpath->query("//svg:" . $el . " | //" . $el);
        foreach ($nodes as $node) {
            if ($node instanceof DOMNode) {
                $node->parentNode?->removeChild($node);
            }
        }
    }

    foreach ($dangerousAttrs as $attr) {
        $nodes = $xpath->query("//@*[starts-with(translate(local-name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{$attr}')]");
        foreach ($nodes as $node) {
            if ($node instanceof DOMAttr) {
                $node->ownerElement?->removeAttributeNode($node);
            }
        }
    }

    $links = $xpath->query('//svg:a | //a');
    foreach ($links as $link) {
        if ($link instanceof DOMElement) {
            foreach (['href', 'xlink:href', 'src'] as $attr) {
                $val = $link->getAttribute($attr);
                if ($val && preg_match('/javascript:/i', $val)) {
                    $link->removeAttribute($attr);
                }
            }
        }
    }

    libxml_clear_errors();
    $result = $dom->saveXML($dom->documentElement);
    return $result === false ? false : $result;
}

/**
 * Default system settings used when no persisted settings exist.
 */
function defaultSettings(): array
{
    return [
        'organization' => [
            'name' => 'GLPI Asset Hub',
            'subtitle' => 'IT operations',
            'workspaceName' => 'Primary workspace',
            'logoUrl' => '',
        ],
        'general' => [
            'currency' => 'KES',
            'timezone' => 'Africa/Nairobi',
            'warrantyWarningDays' => 30,
            'itemsPerPage' => 10,
            'lowStockAlertsEnabled' => true,
        ],
        'sidebar' => [
            'showGroupTitles' => true,
            'items' => defaultSidebarItems(),
        ],
        'directory' => [
            'enabled' => false,
            'name' => 'Microsoft Active Directory',
            'host' => '',
            'port' => 389,
            'useTls' => false,
            'useLdaps' => false,
            'baseDn' => '',
            'bindDn' => '',
            'bindPasswordEncrypted' => '',
            'userFilter' => '(&(objectClass=user)(objectCategory=person)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))',
            'loginField' => 'samaccountname',
            'syncField' => 'objectguid',
            'emailField' => 'mail',
            'firstNameField' => 'givenname',
            'surnameField' => 'sn',
            'phoneField' => 'telephonenumber',
            'mobileField' => 'mobile',
            'titleField' => 'title',
            'departmentField' => 'department',
            'pageSize' => 1000,
            'deletedUserStrategy' => 3,
            'authLdapId' => 0,
            'lastTestAt' => '',
            'lastTestStatus' => '',
            'lastSyncAt' => '',
            'lastSyncStatus' => '',
            'lastSyncSummary' => [],
        ],
        'audit' => [
            'updatedAt' => '',
            'updatedBy' => '',
        ],
    ];
}

/**
 * Default sidebar navigation items.
 *
 * Returns an array of sidebar entries. Each entry is either:
 * - a top-level link: { type: "link", view, label, icon, visible }
 * - a group:         { type: "group", title, visible, items: [...] }
 *
 * The Settings footer item is always rendered and excluded from the editable list.
 */
function defaultSidebarItems(): array
{
    return [
        ['type' => 'link', 'view' => 'dashboard', 'label' => 'Dashboard', 'icon' => 'fas fa-th-large', 'visible' => true],
        ['type' => 'link', 'view' => 'reports', 'label' => 'Reports', 'icon' => 'fas fa-chart-column', 'visible' => true],
        ['type' => 'link', 'view' => 'alerts', 'label' => 'Alerts', 'icon' => 'fas fa-bell', 'visible' => true],
        ['type' => 'group', 'title' => 'Computing', 'visible' => true, 'items' => [
            ['type' => 'link', 'view' => 'computers', 'label' => 'CPU', 'icon' => 'fas fa-desktop', 'visible' => true],
            ['type' => 'link', 'view' => 'laptops', 'label' => 'Laptops', 'icon' => 'fas fa-laptop', 'visible' => true],
            ['type' => 'link', 'view' => 'monitors', 'label' => 'Monitors', 'icon' => 'fas fa-desktop', 'visible' => true],
            ['type' => 'link', 'view' => 'peripherals', 'label' => 'Peripherals', 'icon' => 'fas fa-keyboard', 'visible' => true],
            ['type' => 'link', 'view' => 'ups', 'label' => 'UPS', 'icon' => 'fas fa-car-battery', 'visible' => true],
            ['type' => 'link', 'view' => 'phones', 'label' => 'Phones', 'icon' => 'fas fa-phone', 'visible' => true],
        ]],
        ['type' => 'group', 'title' => 'Office', 'visible' => true, 'items' => [
            ['type' => 'link', 'view' => 'printers', 'label' => 'Printers', 'icon' => 'fas fa-print', 'visible' => true],
            ['type' => 'link', 'view' => 'cartridges', 'label' => 'Cartridges', 'icon' => 'fas fa-cart-shopping', 'visible' => true],
            ['type' => 'link', 'view' => 'consumables', 'label' => 'Consumables', 'icon' => 'fas fa-box-open', 'visible' => true],
        ]],
        ['type' => 'group', 'title' => 'Infrastructure', 'visible' => true, 'items' => [
            ['type' => 'link', 'view' => 'network', 'label' => 'Network', 'icon' => 'fas fa-network-wired', 'visible' => true],
            ['type' => 'link', 'view' => 'racks', 'label' => 'Racks', 'icon' => 'fas fa-server', 'visible' => true],
            ['type' => 'link', 'view' => 'datacenters', 'label' => 'Datacenters', 'icon' => 'fas fa-building', 'visible' => true],
        ]],
        ['type' => 'group', 'title' => 'Software & Licenses', 'visible' => true, 'items' => [
            ['type' => 'link', 'view' => 'software', 'label' => 'Software', 'icon' => 'fas fa-code', 'visible' => true],
            ['type' => 'link', 'view' => 'licenses', 'label' => 'SLA & Licenses', 'icon' => 'fas fa-file-contract', 'visible' => true],
            ['type' => 'link', 'view' => 'certificates', 'label' => 'Certificates', 'icon' => 'fas fa-certificate', 'visible' => true],
        ]],
        ['type' => 'group', 'title' => 'Management', 'visible' => true, 'items' => [
            ['type' => 'link', 'view' => 'contracts', 'label' => 'Contracts', 'icon' => 'fas fa-file-contract', 'visible' => true],
            ['type' => 'link', 'view' => 'suppliers', 'label' => 'Suppliers', 'icon' => 'fas fa-truck', 'visible' => true],
            ['type' => 'link', 'view' => 'contacts', 'label' => 'Contacts', 'icon' => 'fas fa-address-book', 'visible' => true],
            ['type' => 'link', 'view' => 'documents', 'label' => 'Documents', 'icon' => 'fas fa-folder', 'visible' => true],
        ]],
        ['type' => 'group', 'title' => 'Organization', 'visible' => true, 'items' => [
            ['type' => 'link', 'view' => 'locations', 'label' => 'Locations', 'icon' => 'fas fa-map-marker-alt', 'visible' => true],
            ['type' => 'link', 'view' => 'domains', 'label' => 'Domains', 'icon' => 'fas fa-globe', 'visible' => true],
            ['type' => 'link', 'view' => 'users', 'label' => 'Users', 'icon' => 'fas fa-users', 'visible' => true],
        ]],
        ['type' => 'group', 'title' => 'Tools', 'visible' => true, 'items' => [
            ['type' => 'link', 'view' => 'inventoryHealth', 'label' => 'Inventory Health', 'icon' => 'fas fa-heart-pulse', 'visible' => true],
            ['type' => 'link', 'view' => 'softwareMatrix', 'label' => 'Software Matrix', 'icon' => 'fas fa-layer-group', 'visible' => true],
            ['type' => 'link', 'view' => 'import', 'label' => 'Import', 'icon' => 'fas fa-upload', 'visible' => true],
        ]],
    ];
}

/**
 * Normalise a user-supplied sidebar configuration so it always matches
 * the shape produced by defaultSidebarItems().
 * Unknown entries are discarded, missing fields default to "visible".
 */
function normalizeSidebar(array $items): array
{
    $normalised = [];

    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }

        $type = (string)($item['type'] ?? '');
        $view = (string)($item['view'] ?? '');
        $label = (string)($item['label'] ?? '');
        $icon = (string)($item['icon'] ?? 'fas fa-circle');
        $visible = !empty($item['visible']);

        if ($type === 'link') {
            if ($view === '' || $label === '') {
                continue;
            }
            $normalised[] = [
                'type' => 'link',
                'view' => $view,
                'label' => $label,
                'icon' => $icon,
                'visible' => $visible,
            ];
        } elseif ($type === 'group') {
            $normalised[] = [
                'type' => 'group',
                'title' => (string)($item['title'] ?? ''),
                'visible' => $visible,
                'items' => normalizeSidebar(is_array($item['items'] ?? null) ? $item['items'] : []),
            ];
        }
    }

    return $normalised;
}

/**
 * Deep-merge two settings arrays.
 */
function mergeSettings(array $base, array $patch): array
{
    foreach ($patch as $key => $value) {
        if (is_array($value) && isset($base[$key]) && is_array($base[$key])) {
            $base[$key] = mergeSettings($base[$key], $value);
        } else {
            $base[$key] = $value;
        }
    }
    return $base;
}
