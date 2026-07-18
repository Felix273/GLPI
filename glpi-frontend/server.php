<?php
/**
 * GLPI Asset Dashboard server
 *
 * Serves the static frontend and provides a small backend for:
 * - GLPI API session proxying, so tokens are not sent on every browser request
 * - shared custom metadata and lightweight document persistence
 * - inventory/software health helper responses assembled from GLPI API calls
 */

declare(strict_types=1);

session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
    'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
]);
session_start();

const DATA_DIR = __DIR__ . '/data';
const META_DIR = DATA_DIR . '/metadata';
const DOC_DIR = DATA_DIR . '/documents';
const DEFAULT_SETTINGS_FILE = DATA_DIR . '/settings.json';
const DEFAULT_LOGO_DIR = DATA_DIR . '/branding';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Session-Token, App-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$path = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '', '/');
$method = $_SERVER['REQUEST_METHOD'];

if (str_starts_with($path, 'backend/')) {
    handleBackend(substr($path, 8), $method);
    exit;
}

serveStatic($path);

function handleBackend(string $route, string $method): void
{
    try {
        if ($route === 'health' && $method === 'GET') {
            jsonResponse(['ok' => true, 'service' => 'glpi-frontend', 'time' => date(DATE_ATOM)]);
        } elseif ($route === 'session' && $method === 'POST') {
            handleSessionStart();
        } elseif ($route === 'logout' && $method === 'POST') {
            handleLogout();
        } elseif ($route === 'session' && $method === 'GET') {
            jsonResponse(['authenticated' => isset($_SESSION['glpi'])]);
        } elseif (str_starts_with($route, 'glpi/')) {
            proxyGlpi(substr($route, 5), $method);
        } elseif ($route === 'settings/public' && $method === 'GET') {
            handlePublicSettings();
        } elseif ($route === 'settings' && in_array($method, ['GET', 'PUT'], true)) {
            handleSettings($method);
        } elseif ($route === 'settings/logo' && $method === 'POST') {
            handleSettingsLogo();
        } elseif ($route === 'settings/directory/test' && $method === 'POST') {
            handleDirectoryTest();
        } elseif ($route === 'settings/directory/preview' && $method === 'POST') {
            handleDirectoryPreview();
        } elseif ($route === 'settings/directory/sync' && $method === 'POST') {
            handleDirectorySync();
        } elseif ($route === 'metadata' && $method === 'GET') {
            handleMetadataCollection();
        } elseif (str_starts_with($route, 'metadata/')) {
            handleMetadata(substr($route, 9), $method);
        } elseif (str_starts_with($route, 'documents/')) {
            handleDocuments(substr($route, 10), $method);
        } elseif ($route === 'inventory/summary' && $method === 'GET') {
            handleInventorySummary();
        } elseif (str_starts_with($route, 'inventory/computer/') && $method === 'GET') {
            handleComputerInventory(substr($route, 19));
        } elseif ($route === 'software/installations' && $method === 'GET') {
            handleSoftwareInstallations();
        } elseif (str_starts_with($route, 'import') && $method === 'POST') {
            handleImport();
        } else {
            jsonResponse(['error' => 'Unknown backend route'], 404);
        }
    } catch (Throwable $error) {
        jsonResponse(['error' => $error->getMessage()], 500);
    }
}

function handleSessionStart(): void
{
    $body = jsonBody();
    $requestedUrl = rtrim((string)($body['url'] ?? ''), '/');
    $url = rtrim((string)(getenv('GLPI_BACKEND_URL') ?: $requestedUrl), '/');
    $token = (string)($body['token'] ?? '');
    $appToken = (string)($body['appToken'] ?? '');

    if ($url === '' || $token === '') {
        jsonResponse(['error' => 'GLPI URL and user token are required'], 422);
    }

    $session = glpiHttp($url, '/initSession', 'GET', null, $token, null, $appToken);
    $sessionToken = $session['session_token'] ?? null;
    if (!$sessionToken) {
        jsonResponse(['error' => 'GLPI did not return a session token'], 502);
    }

    $_SESSION['glpi'] = [
        'url' => $url,
        'user_token' => $token,
        'app_token' => $appToken,
        'session_token' => $sessionToken,
    ];

    $info = glpiHttp($url, '/getFullSession', 'GET', null, $token, $sessionToken, $appToken);
    jsonResponse(['session_token' => $sessionToken, 'session' => $info]);
}

function handleLogout(): void
{
    if (isset($_SESSION['glpi'])) {
        $glpi = $_SESSION['glpi'];
        try {
            glpiHttp($glpi['url'], '/killSession', 'GET', null, $glpi['user_token'], $glpi['session_token'], $glpi['app_token']);
        } catch (Throwable) {
            // Local logout should still clear the browser session if GLPI is unavailable.
        }
    }
    unset($_SESSION['glpi']);
    jsonResponse(['ok' => true]);
}

function proxyGlpi(string $endpoint, string $method): void
{
    $glpi = requireGlpiSession();
    $query = $_SERVER['QUERY_STRING'] ?? '';
    $path = '/' . ltrim($endpoint, '/');
    if ($query !== '') {
        $path .= '?' . $query;
    }
    $body = in_array($method, ['POST', 'PUT'], true) ? file_get_contents('php://input') : null;
    $payload = $body ? json_decode($body, true) : null;
    $response = glpiHttp($glpi['url'], $path, $method, $payload, $glpi['user_token'], $glpi['session_token'], $glpi['app_token']);
    jsonResponse($response);
}



function settingsFile(): string
{
    return (string)(getenv('SETTINGS_FILE') ?: DEFAULT_SETTINGS_FILE);
}

function logoDirectory(): string
{
    return (string)(getenv('SETTINGS_LOGO_DIR') ?: DEFAULT_LOGO_DIR);
}

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

function loadSettings(): array
{
    return mergeSettings(defaultSettings(), readJsonFile(settingsFile(), []));
}

function saveSettings(array $settings): void
{
    writeJsonFile(settingsFile(), $settings);
}

function publicSettingsPayload(array $settings): array
{
    return [
        'organization' => $settings['organization'],
        'general' => $settings['general'],
    ];
}

function adminSettingsPayload(array $settings): array
{
    $payload = $settings;
    $encrypted = (string)($payload['directory']['bindPasswordEncrypted'] ?? '');
    unset($payload['directory']['bindPasswordEncrypted']);
    $payload['directory']['hasBindPassword'] = $encrypted !== '';
    return $payload;
}

function handlePublicSettings(): void
{
    jsonResponse(publicSettingsPayload(loadSettings()));
}

function handleSettings(string $method): void
{
    $glpi = requireAdminGlpiSession();

    if ($method === 'GET') {
        jsonResponse(adminSettingsPayload(loadSettings()));
    }

    $body = jsonBody();
    $settings = loadSettings();

    $organization = is_array($body['organization'] ?? null) ? $body['organization'] : [];
    $general = is_array($body['general'] ?? null) ? $body['general'] : [];
    $directory = is_array($body['directory'] ?? null) ? $body['directory'] : [];

    $settings['organization']['name'] = trim((string)($organization['name'] ?? $settings['organization']['name']));
    $settings['organization']['subtitle'] = trim((string)($organization['subtitle'] ?? $settings['organization']['subtitle']));
    $settings['organization']['workspaceName'] = trim((string)($organization['workspaceName'] ?? $settings['organization']['workspaceName']));

    $currency = strtoupper(trim((string)($general['currency'] ?? $settings['general']['currency'])));
    $settings['general']['currency'] = preg_match('/^[A-Z]{3}$/', $currency) ? $currency : 'KES';
    $settings['general']['timezone'] = trim((string)($general['timezone'] ?? $settings['general']['timezone']));
    $settings['general']['warrantyWarningDays'] = max(1, min(365, (int)($general['warrantyWarningDays'] ?? 30)));
    $settings['general']['itemsPerPage'] = max(5, min(100, (int)($general['itemsPerPage'] ?? 10)));

    $allowedDirectoryFields = [
        'enabled', 'name', 'host', 'port', 'useTls', 'useLdaps', 'baseDn', 'bindDn',
        'userFilter', 'loginField', 'syncField', 'emailField', 'firstNameField',
        'surnameField', 'phoneField', 'mobileField', 'titleField', 'departmentField',
        'pageSize', 'deletedUserStrategy', 'authLdapId',
    ];

    foreach ($allowedDirectoryFields as $field) {
        if (array_key_exists($field, $directory)) {
            $settings['directory'][$field] = $directory[$field];
        }
    }

    $settings['directory']['enabled'] = !empty($settings['directory']['enabled']);
    $settings['directory']['useTls'] = !empty($settings['directory']['useTls']);
    $settings['directory']['useLdaps'] = !empty($settings['directory']['useLdaps']);
    $settings['directory']['port'] = max(1, min(65535, (int)$settings['directory']['port']));
    $settings['directory']['pageSize'] = max(1, min(5000, (int)$settings['directory']['pageSize']));
    $settings['directory']['deletedUserStrategy'] = max(0, min(5, (int)$settings['directory']['deletedUserStrategy']));
    $settings['directory']['authLdapId'] = max(0, (int)$settings['directory']['authLdapId']);

    $newPassword = (string)($directory['bindPassword'] ?? '');
    if ($newPassword !== '') {
        $settings['directory']['bindPasswordEncrypted'] = encryptSetting($newPassword);
    }

    $settings['audit']['updatedAt'] = date(DATE_ATOM);
    $settings['audit']['updatedBy'] = currentGlpiUserLabel($glpi);
    saveSettings($settings);

    jsonResponse(adminSettingsPayload($settings));
}

function handleSettingsLogo(): void
{
    $glpi = requireAdminGlpiSession();

    if (!isset($_FILES['logo']) || $_FILES['logo']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(['error' => 'A logo image is required'], 422);
    }

    if ((int)$_FILES['logo']['size'] > 2 * 1024 * 1024) {
        jsonResponse(['error' => 'The logo must be smaller than 2 MB'], 422);
    }

    $tmp = (string)$_FILES['logo']['tmp_name'];
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($tmp);
    $extensions = [
        'image/png' => 'png',
        'image/jpeg' => 'jpg',
        'image/webp' => 'webp',
        'image/svg+xml' => 'svg',
    ];

    if (!isset($extensions[$mime])) {
        jsonResponse(['error' => 'Use a PNG, JPG, WebP or SVG logo'], 422);
    }

    if ($mime === 'image/svg+xml') {
        $svg = (string)file_get_contents($tmp);
        if (preg_match('/<script|javascript:|onload\s*=|onerror\s*=/i', $svg)) {
            jsonResponse(['error' => 'The SVG contains unsafe content'], 422);
        }
    }

    $directory = logoDirectory();
    if (!is_dir($directory)) {
        mkdir($directory, 0775, true);
    }

    foreach (glob($directory . '/organization-logo.*') ?: [] as $existing) {
        @unlink($existing);
    }

    $filename = 'organization-logo.' . $extensions[$mime];
    $target = $directory . '/' . $filename;

    if (!move_uploaded_file($tmp, $target)) {
        jsonResponse(['error' => 'Unable to store the logo'], 500);
    }

    $settings = loadSettings();
    $settings['organization']['logoUrl'] = '/data/branding/' . $filename . '?v=' . time();
    $settings['audit']['updatedAt'] = date(DATE_ATOM);
    $settings['audit']['updatedBy'] = currentGlpiUserLabel($glpi);
    saveSettings($settings);

    jsonResponse([
        'ok' => true,
        'logoUrl' => $settings['organization']['logoUrl'],
        'settings' => adminSettingsPayload($settings),
    ]);
}

function handleDirectoryTest(): void
{
    $glpi = requireAdminGlpiSession();
    $configuration = directoryConfigurationFromRequest(jsonBody());
    $connection = openDirectoryConnection($configuration);
    ldap_unbind($connection);

    $settings = loadSettings();
    $settings['directory']['lastTestAt'] = date(DATE_ATOM);
    $settings['directory']['lastTestStatus'] = 'success';
    $settings['audit']['updatedAt'] = date(DATE_ATOM);
    $settings['audit']['updatedBy'] = currentGlpiUserLabel($glpi);
    saveSettings($settings);

    jsonResponse([
        'ok' => true,
        'message' => 'Active Directory connection succeeded.',
        'testedAt' => $settings['directory']['lastTestAt'],
    ]);
}

function handleDirectoryPreview(): void
{
    requireAdminGlpiSession();
    $body = jsonBody();
    $configuration = directoryConfigurationFromRequest($body);
    $limit = max(1, min(100, (int)($body['limit'] ?? 20)));
    $users = directoryUsers($configuration, $limit);

    jsonResponse([
        'count' => count($users),
        'users' => $users,
    ]);
}


function handleDirectorySync(): void
{
    $glpi = requireAdminGlpiSession();
    $body = jsonBody();
    $mode = strtolower(trim((string)($body['mode'] ?? 'all')));

    if (!in_array($mode, ['all', 'create', 'update'], true)) {
        jsonResponse(['error' => 'Unsupported synchronization mode'], 422);
    }

    $settings = loadSettings();
    $configuration = directoryConfigurationFromRequest($body);

    if (empty($configuration['enabled'])) {
        jsonResponse(['error' => 'Enable Active Directory before synchronizing users'], 422);
    }

    $authLdapId = ensureGlpiAuthLdap($glpi, $configuration);
    $limit = max(1, min(5000, (int)($configuration['pageSize'] ?? 1000)));
    $directoryUsers = directoryUsers($configuration, $limit);

    $glpiUsers = glpiHttp(
        $glpi['url'],
        '/User?range=0-9999',
        'GET',
        null,
        $glpi['user_token'],
        $glpi['session_token'],
        $glpi['app_token']
    );

    $byLogin = [];
    $bySync = [];

    foreach ($glpiUsers as $user) {
        if (!is_array($user) || !isset($user['id'])) {
            continue;
        }

        $login = strtolower(trim((string)($user['name'] ?? '')));
        $syncValue = strtoupper(trim((string)($user['sync_field'] ?? '')));

        if ($login !== '') {
            $byLogin[$login] = $user;
        }
        if ($syncValue !== '') {
            $bySync[$syncValue] = $user;
        }
    }

    $created = 0;
    $updated = 0;
    $skipped = 0;
    $errors = [];

    foreach ($directoryUsers as $directoryUser) {
        $login = trim((string)($directoryUser['login'] ?? ''));
        $syncValue = strtoupper(trim((string)($directoryUser['syncValue'] ?? '')));

        if ($login === '') {
            $skipped++;
            continue;
        }

        $existing = null;
        if ($syncValue !== '' && isset($bySync[$syncValue])) {
            $existing = $bySync[$syncValue];
        } elseif (isset($byLogin[strtolower($login)])) {
            $existing = $byLogin[strtolower($login)];
        }

        if ($mode === 'create' && $existing) {
            $skipped++;
            continue;
        }

        if ($mode === 'update' && !$existing) {
            $skipped++;
            continue;
        }

        $fields = [
            'name' => $login,
            'firstname' => trim((string)($directoryUser['firstName'] ?? '')),
            'realname' => trim((string)($directoryUser['surname'] ?? '')),
            'phone' => trim((string)($directoryUser['phone'] ?? '')),
            'mobile' => trim((string)($directoryUser['mobile'] ?? '')),
            'comment' => directoryUserComment($directoryUser),
            'authtype' => 3,
            'auths_id' => $authLdapId,
            'sync_field' => $syncValue,
            'user_dn' => trim((string)($directoryUser['dn'] ?? '')),
            'is_active' => 1,
        ];

        try {
            if ($existing) {
                glpiHttp(
                    $glpi['url'],
                    '/User/' . (int)$existing['id'],
                    'PUT',
                    ['input' => $fields],
                    $glpi['user_token'],
                    $glpi['session_token'],
                    $glpi['app_token']
                );
                $updated++;
            } else {
                $userId = glpiCreate($glpi, 'User', $fields);
                if (!$userId) {
                    throw new RuntimeException('GLPI did not return a new user ID');
                }
                $created++;
            }
        } catch (Throwable $error) {
            $errors[] = [
                'login' => $login,
                'message' => $error->getMessage(),
            ];
        }
    }

    $status = count($errors) ? 'completed_with_errors' : 'success';
    $summary = [
        'mode' => $mode,
        'directoryUsers' => count($directoryUsers),
        'created' => $created,
        'updated' => $updated,
        'skipped' => $skipped,
        'errors' => count($errors),
    ];

    $settings['directory']['authLdapId'] = $authLdapId;
    $settings['directory']['lastSyncAt'] = date(DATE_ATOM);
    $settings['directory']['lastSyncStatus'] = $status;
    $settings['directory']['lastSyncSummary'] = $summary;
    $settings['audit']['updatedAt'] = date(DATE_ATOM);
    $settings['audit']['updatedBy'] = currentGlpiUserLabel($glpi);
    saveSettings($settings);

    jsonResponse([
        'ok' => count($errors) === 0,
        'status' => $status,
        'summary' => $summary,
        'errors' => array_slice($errors, 0, 50),
        'authLdapId' => $authLdapId,
        'syncedAt' => $settings['directory']['lastSyncAt'],
        'settings' => adminSettingsPayload($settings),
    ]);
}

function ensureGlpiAuthLdap(array $glpi, array $configuration): int
{
    $settings = loadSettings();
    $configuredId = max(
        0,
        (int)($configuration['authLdapId'] ?? 0),
        (int)($settings['directory']['authLdapId'] ?? 0)
    );

    $records = glpiHttp(
        $glpi['url'],
        '/AuthLDAP?range=0-1000',
        'GET',
        null,
        $glpi['user_token'],
        $glpi['session_token'],
        $glpi['app_token']
    );

    $existing = null;
    $connectionName = trim((string)($configuration['name'] ?? 'Microsoft Active Directory'));

    foreach ($records as $record) {
        if (!is_array($record) || !isset($record['id'])) {
            continue;
        }

        if (
            ($configuredId > 0 && (int)$record['id'] === $configuredId)
            || strcasecmp(trim((string)($record['name'] ?? '')), $connectionName) === 0
        ) {
            $existing = $record;
            break;
        }
    }

    $fields = [
        'name' => $connectionName,
        'host' => trim((string)$configuration['host']),
        'port' => (int)$configuration['port'],
        'basedn' => trim((string)$configuration['baseDn']),
        'rootdn' => trim((string)($configuration['bindDn'] ?? '')),
        'condition' => trim((string)$configuration['userFilter']),
        'login_field' => trim((string)$configuration['loginField']),
        'sync_field' => trim((string)$configuration['syncField']),
        'email1_field' => trim((string)$configuration['emailField']),
        'firstname_field' => trim((string)$configuration['firstNameField']),
        'realname_field' => trim((string)$configuration['surnameField']),
        'phone_field' => trim((string)$configuration['phoneField']),
        'mobile_field' => trim((string)$configuration['mobileField']),
        'title_field' => trim((string)$configuration['titleField']),
        'use_tls' => !empty($configuration['useTls']) ? 1 : 0,
        'use_dn' => 1,
        'use_bind' => 1,
        'is_active' => !empty($configuration['enabled']) ? 1 : 0,
        'can_support_pagesize' => 1,
        'pagesize' => (int)$configuration['pageSize'],
        'group_field' => 'memberof',
        'group_condition' => trim((string)$configuration['userFilter']),
    ];

    if ((string)($configuration['bindPassword'] ?? '') !== '') {
        $fields['rootdn_passwd'] = (string)$configuration['bindPassword'];
    }

    if ($existing) {
        $id = (int)$existing['id'];

        glpiHttp(
            $glpi['url'],
            '/AuthLDAP/' . $id,
            'PUT',
            ['input' => $fields],
            $glpi['user_token'],
            $glpi['session_token'],
            $glpi['app_token']
        );

        return $id;
    }

    $id = glpiCreate($glpi, 'AuthLDAP', $fields);
    if (!$id) {
        throw new RuntimeException('Unable to create the GLPI LDAP configuration');
    }

    return $id;
}

function directoryUserComment(array $user): string
{
    $parts = [];

    $title = trim((string)($user['title'] ?? ''));
    $department = trim((string)($user['department'] ?? ''));
    $email = trim((string)($user['email'] ?? ''));

    if ($title !== '') {
        $parts[] = 'Title: ' . $title;
    }
    if ($department !== '') {
        $parts[] = 'Department: ' . $department;
    }
    if ($email !== '') {
        $parts[] = 'Email: ' . $email;
    }

    return implode(' | ', $parts);
}

function directoryConfigurationFromRequest(array $body): array
{
    $settings = loadSettings();
    $stored = $settings['directory'];
    $incoming = is_array($body['directory'] ?? null) ? $body['directory'] : $body;
    $configuration = mergeSettings($stored, $incoming);

    $password = (string)($incoming['bindPassword'] ?? '');
    if ($password === '' && !empty($stored['bindPasswordEncrypted'])) {
        $password = decryptSetting((string)$stored['bindPasswordEncrypted']);
    }
    $configuration['bindPassword'] = $password;

    foreach (['host', 'baseDn'] as $required) {
        if (trim((string)($configuration[$required] ?? '')) === '') {
            jsonResponse(['error' => ucfirst($required) . ' is required'], 422);
        }
    }

    $configuration['port'] = max(1, min(65535, (int)($configuration['port'] ?? 389)));
    $configuration['pageSize'] = max(1, min(5000, (int)($configuration['pageSize'] ?? 1000)));
    return $configuration;
}

function openDirectoryConnection(array $configuration): LDAP\Connection
{
    if (!extension_loaded('ldap')) {
        throw new RuntimeException('PHP LDAP support is not installed');
    }

    $host = trim((string)$configuration['host']);
    $scheme = !empty($configuration['useLdaps']) ? 'ldaps' : 'ldap';
    $uri = $scheme . '://' . $host . ':' . (int)$configuration['port'];
    $connection = ldap_connect($uri);

    if (!$connection) {
        throw new RuntimeException('Unable to initialise the directory connection');
    }

    ldap_set_option($connection, LDAP_OPT_PROTOCOL_VERSION, 3);
    ldap_set_option($connection, LDAP_OPT_REFERRALS, 0);
    ldap_set_option($connection, LDAP_OPT_NETWORK_TIMEOUT, 8);

    if (!empty($configuration['useTls']) && empty($configuration['useLdaps'])) {
        if (!ldap_start_tls($connection)) {
            throw new RuntimeException('Unable to start LDAP TLS');
        }
    }

    $bindDn = trim((string)($configuration['bindDn'] ?? ''));
    $password = (string)($configuration['bindPassword'] ?? '');
    $bound = $bindDn !== ''
        ? @ldap_bind($connection, $bindDn, $password)
        : @ldap_bind($connection);

    if (!$bound) {
        $message = ldap_error($connection);
        ldap_unbind($connection);
        throw new RuntimeException('Active Directory bind failed: ' . $message);
    }

    return $connection;
}

function directoryUsers(array $configuration, int $limit): array
{
    $connection = openDirectoryConnection($configuration);
    $attributes = array_values(array_unique(array_filter([
        (string)$configuration['loginField'],
        (string)$configuration['syncField'],
        (string)$configuration['emailField'],
        (string)$configuration['firstNameField'],
        (string)$configuration['surnameField'],
        (string)$configuration['phoneField'],
        (string)$configuration['mobileField'],
        (string)$configuration['titleField'],
        (string)$configuration['departmentField'],
        'distinguishedname',
    ])));

    $search = @ldap_search(
        $connection,
        (string)$configuration['baseDn'],
        (string)$configuration['userFilter'],
        $attributes,
        0,
        $limit,
        10
    );

    if (!$search) {
        $message = ldap_error($connection);
        ldap_unbind($connection);
        throw new RuntimeException('Directory search failed: ' . $message);
    }

    $entries = ldap_get_entries($connection, $search);
    $users = [];

    for ($index = 0; $index < (int)($entries['count'] ?? 0); $index++) {
        $entry = $entries[$index];
        $login = directoryAttribute($entry, (string)$configuration['loginField']);
        if ($login === '') {
            continue;
        }

        $syncValue = directoryAttribute($entry, (string)$configuration['syncField'], true);

        $users[] = [
            'login' => $login,
            'syncValue' => $syncValue,
            'email' => directoryAttribute($entry, (string)$configuration['emailField']),
            'firstName' => directoryAttribute($entry, (string)$configuration['firstNameField']),
            'surname' => directoryAttribute($entry, (string)$configuration['surnameField']),
            'phone' => directoryAttribute($entry, (string)$configuration['phoneField']),
            'mobile' => directoryAttribute($entry, (string)$configuration['mobileField']),
            'title' => directoryAttribute($entry, (string)$configuration['titleField']),
            'department' => directoryAttribute($entry, (string)$configuration['departmentField']),
            'dn' => (string)($entry['dn'] ?? directoryAttribute($entry, 'distinguishedname')),
        ];
    }

    ldap_unbind($connection);
    return $users;
}

function directoryAttribute(array $entry, string $field, bool $binarySafe = false): string
{
    $key = strtolower(trim($field));
    if ($key === '' || !isset($entry[$key][0])) {
        return '';
    }

    $value = (string)$entry[$key][0];

    if ($binarySafe && preg_match('/[^\x20-\x7E]/', $value)) {
        return strtoupper(bin2hex($value));
    }

    return trim($value);
}

function encryptSetting(string $value): string
{
    $secret = (string)getenv('SETTINGS_SECRET_KEY');
    if ($secret === '') {
        throw new RuntimeException('SETTINGS_SECRET_KEY is not configured');
    }

    $key = hash('sha256', $secret, true);
    $iv = random_bytes(12);
    $tag = '';
    $cipher = openssl_encrypt($value, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);

    if ($cipher === false) {
        throw new RuntimeException('Unable to encrypt the directory password');
    }

    return base64_encode($iv . $tag . $cipher);
}

function decryptSetting(string $payload): string
{
    if ($payload === '') {
        return '';
    }

    $secret = (string)getenv('SETTINGS_SECRET_KEY');
    $decoded = base64_decode($payload, true);

    if ($secret === '' || $decoded === false || strlen($decoded) < 29) {
        throw new RuntimeException('Unable to decrypt the stored directory password');
    }

    $key = hash('sha256', $secret, true);
    $iv = substr($decoded, 0, 12);
    $tag = substr($decoded, 12, 16);
    $cipher = substr($decoded, 28);
    $plain = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);

    if ($plain === false) {
        throw new RuntimeException('Unable to decrypt the stored directory password');
    }

    return $plain;
}

function requireAdminGlpiSession(): array
{
    $glpi = requireGlpiSession();
    $info = glpiHttp(
        $glpi['url'],
        '/getFullSession',
        'GET',
        null,
        $glpi['user_token'],
        $glpi['session_token'],
        $glpi['app_token']
    );

    if (!sessionHasAdministrativeProfile($info)) {
        jsonResponse(['error' => 'Administrator access is required'], 403);
    }

    $glpi['session_info'] = $info;
    return $glpi;
}

function sessionHasAdministrativeProfile(mixed $value): bool
{
    if (is_string($value)) {
        return (bool)preg_match('/super[- ]?admin|administrator|\badmin\b/i', $value);
    }

    if (!is_array($value)) {
        return false;
    }

    foreach ($value as $key => $item) {
        $normalized = strtolower((string)$key);

        if ($normalized === 'config' && is_numeric($item) && (int)$item > 0) {
            return true;
        }

        if (
            in_array($normalized, ['glpiactiveprofile', 'active_profile', 'profile', 'profiles_name'], true)
            && sessionHasAdministrativeProfile($item)
        ) {
            return true;
        }

        if (is_array($item) && sessionHasAdministrativeProfile($item)) {
            return true;
        }
    }

    return false;
}

function currentGlpiUserLabel(array $glpi): string
{
    $info = $glpi['session_info'] ?? [];
    $candidates = [];

    $walk = function (mixed $value, string $key = '') use (&$walk, &$candidates): void {
        if (is_array($value)) {
            foreach ($value as $childKey => $child) {
                $walk($child, (string)$childKey);
            }
            return;
        }

        if (
            is_string($value)
            && in_array(strtolower($key), ['glpiname', 'name', 'username', 'login'], true)
            && trim($value) !== ''
        ) {
            $candidates[] = trim($value);
        }
    };

    $walk($info);
    return $candidates[0] ?? 'GLPI administrator';
}

function handleMetadataCollection(): void
{
    requireGlpiSession();
    $items = [];
    foreach (glob(META_DIR . '/*.json') ?: [] as $file) {
        $name = pathinfo($file, PATHINFO_FILENAME);
        $position = strrpos($name, '-');
        if ($position === false) {
            continue;
        }
        $itemtype = substr($name, 0, $position);
        $id = substr($name, $position + 1);
        $metadata = readJsonFile($file, []);
        if (isset($metadata['documents']) && is_array($metadata['documents'])) {
            $metadata['documents'] = array_map(function (array $document): array {
                unset($document['dataUrl']);
                return $document;
            }, $metadata['documents']);
        }
        $items[$itemtype . ':' . $id] = $metadata;
    }
    jsonResponse($items);
}

function handleMetadata(string $target, string $method): void
{
    [$itemtype, $id] = parseTarget($target);
    $file = metadataFile($itemtype, $id);

    if ($method === 'GET') {
        jsonResponse(readJsonFile($file, ['financial' => new stdClass(), 'stock' => new stdClass(), 'documents' => []]));
    }

    if ($method === 'PUT' || $method === 'POST') {
        $existing = readJsonFile($file, []);
        $next = array_replace_recursive($existing, jsonBody());
        writeJsonFile($file, $next);
        jsonResponse($next);
    }

    jsonResponse(['error' => 'Unsupported metadata method'], 405);
}

function handleDocuments(string $target, string $method): void
{
    [$itemtype, $id] = parseTarget($target);
    $metaFile = metadataFile($itemtype, $id);
    $meta = readJsonFile($metaFile, ['documents' => []]);

    if ($method === 'GET') {
        jsonResponse($meta['documents'] ?? []);
    }

    if ($method === 'POST') {
        $body = jsonBody();
        $dataUrl = (string)($body['dataUrl'] ?? '');
        if ($dataUrl === '' || !str_contains($dataUrl, ',')) {
            jsonResponse(['error' => 'Document dataUrl is required'], 422);
        }

        [$prefix, $encoded] = explode(',', $dataUrl, 2);
        $binary = base64_decode($encoded, true);
        if ($binary === false) {
            jsonResponse(['error' => 'Invalid document data'], 422);
        }

        $docId = (string)round(microtime(true) * 1000) . '-' . bin2hex(random_bytes(4));
        $docFile = DOC_DIR . '/' . safeName($itemtype . '-' . $id . '-' . $docId) . '.bin';
        file_put_contents($docFile, $binary);

        $document = [
            'id' => $docId,
            'name' => basename((string)($body['name'] ?? 'document')),
            'size' => strlen($binary),
            'type' => (string)($body['type'] ?? 'application/octet-stream'),
            'uploadedAt' => date(DATE_ATOM),
            'path' => basename($docFile),
            'dataUrl' => $prefix . ',' . $encoded,
        ];

        $meta['documents'] = array_values(array_merge([$document], $meta['documents'] ?? []));
        writeJsonFile($metaFile, $meta);
        jsonResponse($document, 201);
    }

    if ($method === 'DELETE') {
        $docId = $_GET['id'] ?? '';
        foreach ($meta['documents'] ?? [] as $document) {
            if ((string)($document['id'] ?? '') === (string)$docId && !empty($document['path'])) {
                $storedFile = DOC_DIR . '/' . basename((string)$document['path']);
                if (is_file($storedFile)) {
                    @unlink($storedFile);
                }
            }
        }
        $meta['documents'] = array_values(array_filter($meta['documents'] ?? [], fn ($doc) => (string)$doc['id'] !== (string)$docId));
        writeJsonFile($metaFile, $meta);
        jsonResponse(['ok' => true]);
    }

    jsonResponse(['error' => 'Unsupported documents method'], 405);
}

function handleInventorySummary(): void
{
    $computers = array_values(array_filter(
        tryGlpiListAll('Computer'),
        static fn(array $computer): bool =>
            (int)($computer['is_deleted'] ?? 0) === 0
            && (int)($computer['is_template'] ?? 0) === 0
    ));

    $agents = tryGlpiListAll('Agent');
    $agentsByComputer = [];

    usort(
        $agents,
        static fn(array $left, array $right): int =>
            strcmp(
                (string)($right['last_contact'] ?? ''),
                (string)($left['last_contact'] ?? '')
            )
    );

    foreach ($agents as $agent) {
        if (
            ($agent['itemtype'] ?? '') !== 'Computer'
            || empty($agent['items_id'])
        ) {
            continue;
        }

        $computerId = (int)$agent['items_id'];

        if (!isset($agentsByComputer[$computerId])) {
            $agentsByComputer[$computerId] = $agent;
        }
    }

    $now = time();
    $summary = [
        'total' => count($computers),
        'agentsTotal' => count($agents),
        'reporting24Hours' => 0,
        'reporting7Days' => 0,
        'stale14Days' => 0,
        'neverReported' => 0,
        'items' => [],
    ];

    foreach ($computers as $computer) {
        $computerId = (int)($computer['id'] ?? 0);
        $agent = $agentsByComputer[$computerId] ?? null;
        $lastInventory = firstValue(
            $computer,
            ['last_inventory_update']
        );
        $lastContact = is_array($agent)
            ? firstValue($agent, ['last_contact'])
            : null;
        $effectiveLast = $lastContact ?: $lastInventory;
        $timestamp = $effectiveLast
            ? strtotime((string)$effectiveLast)
            : false;

        if (!$timestamp) {
            $summary['neverReported']++;
        } else {
            $age = max(0, $now - $timestamp);

            if ($age <= 86400) {
                $summary['reporting24Hours']++;
            }

            if ($age <= 7 * 86400) {
                $summary['reporting7Days']++;
            }

            if ($age >= 14 * 86400) {
                $summary['stale14Days']++;
            }
        }

        $summary['items'][] = [
            'id' => $computerId,
            'name' => $computer['name'] ?? 'Unnamed',
            'serial' => $computer['serial'] ?? '',
            'lastInventory' => $lastInventory,
            'lastContact' => $lastContact,
            'lastBoot' => $computer['last_boot'] ?? null,
            'status' => inventoryStatus($effectiveLast),
            'isAgentManaged' => $agent !== null,
            'agentId' => $agent['id'] ?? null,
            'agentName' => $agent['name'] ?? null,
            'agentVersion' => $agent['version'] ?? null,
            'agentTag' => $agent['tag'] ?? null,
            'remoteAddress' => $agent['remote_addr'] ?? null,
            'isDynamic' => (bool)($computer['is_dynamic'] ?? false),
        ];
    }

    usort(
        $summary['items'],
        static function (array $left, array $right): int {
            $leftTime = strtotime(
                (string)($left['lastContact'] ?: $left['lastInventory'] ?: '')
            ) ?: 0;
            $rightTime = strtotime(
                (string)($right['lastContact'] ?: $right['lastInventory'] ?: '')
            ) ?: 0;

            return $rightTime <=> $leftTime;
        }
    );

    jsonResponse($summary);
}



function handleComputerInventory(string $id): void
{
    if (!ctype_digit($id) || (int)$id < 1) {
        jsonResponse(['error' => 'Invalid computer ID'], 422);
    }

    $computerId = (int)$id;
    $computer = glpiGet('Computer', $id);

    if (
        empty($computer)
        || (int)($computer['is_deleted'] ?? 0) === 1
    ) {
        jsonResponse(['error' => 'Computer not found'], 404);
    }

    $agents = glpiFilterRows(
        tryGlpiListAll('Agent'),
        ['itemtype' => 'Computer', 'items_id' => $computerId]
    );

    usort(
        $agents,
        static fn(array $left, array $right): int =>
            strcmp(
                (string)($right['last_contact'] ?? ''),
                (string)($left['last_contact'] ?? '')
            )
    );

    $agent = $agents[0] ?? null;

    $operatingSystemRows = glpiFilterRows(
        tryGlpiListAll('Item_OperatingSystem'),
        ['itemtype' => 'Computer', 'items_id' => $computerId]
    );

    $diskRows = glpiFilterRows(
        tryGlpiListAll('Item_Disk'),
        ['itemtype' => 'Computer', 'items_id' => $computerId]
    );

    $antivirusRows = glpiFilterRows(
        tryGlpiListAll('ComputerAntivirus'),
        ['computers_id' => $computerId]
    );

    $installationRows = glpiFilterRows(
        tryGlpiListAll('Item_SoftwareVersion'),
        ['itemtype' => 'Computer', 'items_id' => $computerId]
    );

    $softwareVersionMap = glpiIndexById(
        tryGlpiListAll('SoftwareVersion')
    );
    $softwareMap = glpiIndexById(
        tryGlpiListAll('Software')
    );
    $manufacturerMap = glpiIndexById(
        tryGlpiListAll('Manufacturer')
    );

    $osMap = glpiIndexById(
        tryGlpiListAll('OperatingSystem')
    );
    $osVersionMap = glpiIndexById(
        tryGlpiListAll('OperatingSystemVersion')
    );
    $osArchitectureMap = glpiIndexById(
        tryGlpiListAll('OperatingSystemArchitecture')
    );
    $osKernelMap = glpiIndexById(
        tryGlpiListAll('OperatingSystemKernelVersion')
    );
    $osEditionMap = glpiIndexById(
        tryGlpiListAll('OperatingSystemEdition')
    );

    $operatingSystems = [];

    foreach ($operatingSystemRows as $row) {
        if ((int)($row['is_deleted'] ?? 0) === 1) {
            continue;
        }

        $operatingSystems[] = [
            'id' => $row['id'] ?? null,
            'name' => glpiLookupName(
                $osMap,
                $row['operatingsystems_id'] ?? 0
            ),
            'version' => glpiLookupName(
                $osVersionMap,
                $row['operatingsystemversions_id'] ?? 0
            ),
            'architecture' => glpiLookupName(
                $osArchitectureMap,
                $row['operatingsystemarchitectures_id'] ?? 0
            ),
            'kernel' => glpiLookupName(
                $osKernelMap,
                $row['operatingsystemkernelversions_id'] ?? 0
            ),
            'edition' => glpiLookupName(
                $osEditionMap,
                $row['operatingsystemeditions_id'] ?? 0
            ),
            'hostId' => $row['hostid'] ?? null,
            'installDate' => $row['install_date'] ?? null,
            'isDynamic' => (bool)($row['is_dynamic'] ?? false),
        ];
    }

    $disks = [];
    $diskOverall = 'unknown';

    foreach ($diskRows as $row) {
        if ((int)($row['is_deleted'] ?? 0) === 1) {
            continue;
        }

        $total = (float)($row['totalsize'] ?? 0);
        $free = (float)($row['freesize'] ?? 0);
        $usedPercent = $total > 0
            ? round((($total - $free) / $total) * 100, 1)
            : null;

        $status = 'unknown';

        if ($usedPercent !== null) {
            $status = $usedPercent >= 90
                ? 'critical'
                : ($usedPercent >= 80 ? 'warning' : 'healthy');
        }

        if ($status === 'critical') {
            $diskOverall = 'critical';
        } elseif (
            $status === 'warning'
            && $diskOverall !== 'critical'
        ) {
            $diskOverall = 'warning';
        } elseif (
            $status === 'healthy'
            && $diskOverall === 'unknown'
        ) {
            $diskOverall = 'healthy';
        }

        $disks[] = [
            'id' => $row['id'] ?? null,
            'name' => $row['name'] ?? '',
            'device' => $row['device'] ?? '',
            'mountpoint' => $row['mountpoint'] ?? '',
            'totalSizeMb' => $total,
            'freeSizeMb' => $free,
            'usedPercent' => $usedPercent,
            'status' => $status,
            'encryptionStatus' => $row['encryption_status'] ?? null,
            'encryptionTool' => $row['encryption_tool'] ?? null,
            'isDynamic' => (bool)($row['is_dynamic'] ?? false),
        ];
    }

    $antivirus = [];

    foreach ($antivirusRows as $row) {
        if ((int)($row['is_deleted'] ?? 0) === 1) {
            continue;
        }

        $antivirus[] = [
            'id' => $row['id'] ?? null,
            'name' => $row['name'] ?? 'Unknown antivirus',
            'version' => $row['antivirus_version'] ?? null,
            'signatureVersion' => $row['signature_version'] ?? null,
            'active' => (bool)($row['is_active'] ?? false),
            'upToDate' => (bool)($row['is_uptodate'] ?? false),
            'expirationDate' => $row['date_expiration'] ?? null,
        ];
    }

    $software = [];

    foreach ($installationRows as $installation) {
        if (
            (int)($installation['is_deleted'] ?? 0) === 1
            || (int)($installation['is_deleted_item'] ?? 0) === 1
        ) {
            continue;
        }

        $versionId = (int)(
            $installation['softwareversions_id'] ?? 0
        );
        $version = $softwareVersionMap[$versionId] ?? [];
        $softwareId = (int)($version['softwares_id'] ?? 0);
        $softwareRecord = $softwareMap[$softwareId] ?? [];
        $manufacturerId = (int)(
            $softwareRecord['manufacturers_id'] ?? 0
        );

        $software[] = [
            'installationId' => $installation['id'] ?? null,
            'softwareId' => $softwareId ?: null,
            'versionId' => $versionId ?: null,
            'name' => $softwareRecord['name'] ?? 'Unknown software',
            'version' => $version['name'] ?? '',
            'architecture' => $version['arch'] ?? '',
            'publisher' => glpiLookupName(
                $manufacturerMap,
                $manufacturerId
            ),
            'installDate' => $installation['date_install'] ?? null,
            'isDynamic' => (bool)(
                $installation['is_dynamic'] ?? false
            ),
        ];
    }

    usort(
        $software,
        static fn(array $left, array $right): int =>
            strcasecmp(
                (string)$left['name'],
                (string)$right['name']
            )
            ?: strcasecmp(
                (string)$left['version'],
                (string)$right['version']
            )
    );

    $lastInventory = firstValue(
        $computer,
        ['last_inventory_update']
    );
    $lastContact = is_array($agent)
        ? firstValue($agent, ['last_contact'])
        : null;

    $antivirusStatus = 'not-reported';

    if (!empty($antivirus)) {
        $antivirusStatus = 'healthy';

        foreach ($antivirus as $product) {
            if (!$product['active'] || !$product['upToDate']) {
                $antivirusStatus = 'warning';
                break;
            }
        }
    }

    jsonResponse([
        'computer' => $computer,
        'agent' => $agent,
        'operatingSystems' => $operatingSystems,
        'disks' => $disks,
        'antivirus' => $antivirus,
        'software' => $software,
        'health' => [
            'inventoryStatus' => inventoryStatus(
                $lastContact ?: $lastInventory
            ),
            'lastInventory' => $lastInventory,
            'lastContact' => $lastContact,
            'lastBoot' => $computer['last_boot'] ?? null,
            'agentConnected' => $agent !== null,
            'diskStatus' => $diskOverall,
            'antivirusStatus' => $antivirusStatus,
            'softwareCount' => count($software),
        ],
        'relations' => [
            'softwareVersions' => $installationRows,
            'operatingSystems' => $operatingSystemRows,
            'disks' => $diskRows,
            'antivirus' => $antivirusRows,
        ],
    ]);
}



function handleSoftwareInstallations(): void
{
    $software = array_values(array_filter(
        tryGlpiListAll('Software'),
        static fn(array $row): bool =>
            (int)($row['is_deleted'] ?? 0) === 0
            && (int)($row['is_template'] ?? 0) === 0
    ));

    $versions = tryGlpiListAll('SoftwareVersion');
    $installations = array_values(array_filter(
        tryGlpiListAll('Item_SoftwareVersion'),
        static fn(array $row): bool =>
            ($row['itemtype'] ?? '') === 'Computer'
            && (int)($row['is_deleted'] ?? 0) === 0
            && (int)($row['is_deleted_item'] ?? 0) === 0
    ));

    $computers = array_values(array_filter(
        tryGlpiListAll('Computer'),
        static fn(array $row): bool =>
            (int)($row['is_deleted'] ?? 0) === 0
            && (int)($row['is_template'] ?? 0) === 0
    ));

    $manufacturers = tryGlpiListAll('Manufacturer');

    $softwareMap = glpiIndexById($software);
    $versionMap = glpiIndexById($versions);
    $computerMap = glpiIndexById($computers);
    $manufacturerMap = glpiIndexById($manufacturers);
    $matrix = [];

    foreach ($installations as $installation) {
        $versionId = (int)(
            $installation['softwareversions_id'] ?? 0
        );
        $version = $versionMap[$versionId] ?? [];
        $softwareId = (int)($version['softwares_id'] ?? 0);

        if (!$softwareId || !isset($softwareMap[$softwareId])) {
            continue;
        }

        $softwareRecord = $softwareMap[$softwareId];
        $computerId = (int)($installation['items_id'] ?? 0);

        if (!isset($matrix[$softwareId])) {
            $matrix[$softwareId] = [
                'id' => $softwareId,
                'name' => $softwareRecord['name'] ?? 'Unnamed',
                'publisher' => glpiLookupName(
                    $manufacturerMap,
                    $softwareRecord['manufacturers_id'] ?? 0
                ),
                'versionCount' => 0,
                'installCount' => 0,
                'computerCount' => 0,
                'versions' => [],
                'computers' => [],
            ];
        }

        $versionName = trim((string)($version['name'] ?? ''));

        if ($versionName !== '') {
            $matrix[$softwareId]['versions'][$versionName] = true;
        }

        $matrix[$softwareId]['installCount']++;

        if ($computerId && isset($computerMap[$computerId])) {
            $matrix[$softwareId]['computers'][$computerId] =
                $computerMap[$computerId]['name']
                ?? ('Computer ' . $computerId);
        }
    }

    $matrixRows = [];

    foreach ($matrix as $row) {
        $row['versions'] = array_keys($row['versions']);
        natcasesort($row['versions']);
        $row['versions'] = array_values($row['versions']);
        $row['computers'] = array_values($row['computers']);
        natcasesort($row['computers']);
        $row['computers'] = array_values($row['computers']);
        $row['versionCount'] = count($row['versions']);
        $row['computerCount'] = count($row['computers']);
        $matrixRows[] = $row;
    }

    usort(
        $matrixRows,
        static fn(array $left, array $right): int =>
            $right['installCount'] <=> $left['installCount']
            ?: strcasecmp(
                (string)$left['name'],
                (string)$right['name']
            )
    );

    jsonResponse([
        'totals' => [
            'software' => count($software),
            'versions' => count($versions),
            'installations' => count($installations),
            'computers' => count($computers),
        ],
        'matrix' => $matrixRows,
        // Retained for compatibility with older cached frontend code.
        'software' => $software,
        'versions' => $versions,
        'installations' => $installations,
    ]);
}



function glpiListAll(
    string $itemtype,
    array $params = [],
    int $pageSize = 1000,
    int $maximumItems = 50000
): array {
    $items = [];
    $offset = 0;

    while ($offset < $maximumItems) {
        $end = min(
            $offset + $pageSize - 1,
            $maximumItems - 1
        );

        $query = array_merge(
            $params,
            ['range' => $offset . '-' . $end]
        );

        $result = glpiRequest(
            '/' . $itemtype . '?' . http_build_query($query)
        );

        if (!is_array($result)) {
            break;
        }

        $batch = array_values(array_filter(
            $result,
            'is_array'
        ));

        if (empty($batch)) {
            break;
        }

        array_push($items, ...$batch);

        if (count($batch) < $pageSize) {
            break;
        }

        $offset += $pageSize;
    }

    return $items;
}

function tryGlpiListAll(
    string $itemtype,
    array $params = [],
    int $pageSize = 1000,
    int $maximumItems = 50000
): array {
    try {
        return glpiListAll(
            $itemtype,
            $params,
            $pageSize,
            $maximumItems
        );
    } catch (Throwable) {
        return [];
    }
}

function glpiFilterRows(
    array $rows,
    array $criteria
): array {
    return array_values(array_filter(
        $rows,
        static function (array $row) use ($criteria): bool {
            foreach ($criteria as $field => $expected) {
                if (
                    !array_key_exists($field, $row)
                    || (string)$row[$field] !== (string)$expected
                ) {
                    return false;
                }
            }

            return true;
        }
    ));
}

function glpiIndexById(array $rows): array
{
    $indexed = [];

    foreach ($rows as $row) {
        $id = (int)($row['id'] ?? 0);

        if ($id > 0) {
            $indexed[$id] = $row;
        }
    }

    return $indexed;
}

function glpiLookupName(array $map, mixed $id): string
{
    $numericId = (int)$id;

    if ($numericId < 1 || !isset($map[$numericId])) {
        return '';
    }

    return trim((string)($map[$numericId]['name'] ?? ''));
}

function glpiList(string $itemtype, array $params = []): array
{
    return tryGlpiList($itemtype, $params);
}

function tryGlpiList(string $itemtype, array $params = []): array
{
    try {
        $query = array_merge(['range' => '0-1000'], $params);
        $result = glpiRequest('/' . $itemtype . '?' . http_build_query($query));
        return is_array($result) ? $result : [];
    } catch (Throwable) {
        return [];
    }
}

function glpiGet(string $itemtype, string $id): array
{
    $result = glpiRequest('/' . $itemtype . '/' . rawurlencode($id));
    return is_array($result) ? $result : [];
}

function glpiRequest(string $path): array
{
    $glpi = requireGlpiSession();
    return glpiHttp($glpi['url'], $path, 'GET', null, $glpi['user_token'], $glpi['session_token'], $glpi['app_token']);
}

function glpiHttp(string $baseUrl, string $path, string $method, ?array $payload, string $userToken, ?string $sessionToken, string $appToken): array
{
    $url = rtrim($baseUrl, '/') . '/apirest.php' . $path;

    $headers = ['Content-Type: application/json', 'Authorization: user_token ' . $userToken];
    if ($appToken !== '') {
        $headers[] = 'App-Token: ' . $appToken;
    }
    if ($sessionToken) {
        $headers[] = 'Session-Token: ' . $sessionToken;
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 30,
    ]);
    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    }

    $raw = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($raw === false || $error !== '') {
        throw new RuntimeException($error ?: 'GLPI request failed');
    }

    $decoded = json_decode($raw, true);
    if ($status >= 400) {
        $message = is_array($decoded) ? ($decoded[1] ?? $decoded['error'] ?? $raw) : $raw;
        jsonResponse(['error' => $message, 'status' => $status], $status);
    }

    return is_array($decoded) ? $decoded : ['raw' => $raw];
}

function handleImport(): void
{
    $glpi = requireGlpiSession();

    if (!isset($_FILES['csv']) || $_FILES['csv']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(['error' => 'CSV file upload is required'], 422);
    }
    $itemtype = trim((string)($_POST['itemtype'] ?? ''));
    if ($itemtype === '') {
        jsonResponse(['error' => 'Asset type is required'], 422);
    }
    $delimiter = ($_POST['delimiter'] ?? ';') === ',' ? ',' : ';';

    $rows = [];
    if (($fh = fopen($_FILES['csv']['tmp_name'], 'r')) !== false) {
        while (($data = fgetcsv($fh, 0, $delimiter)) !== false) {
            $rows[] = $data;
        }
        fclose($fh);
    }
    if (count($rows) < 2) {
        jsonResponse(['error' => 'CSV has no data rows'], 422);
    }

    $header = array_map('trim', array_shift($rows));
    $cache = [];
    $resolve = function (string $col, string $value) use (&$cache, $glpi): ?int {
        $base = preg_replace('/_id$/', '', $col);
        $base = rtrim($base, 's');
        $drop = ucfirst($base);
        $key = $drop . '|' . strtolower($value);
        if (array_key_exists($key, $cache)) {
            return $cache[$key];
        }
        $id = glpiFind($glpi, $drop, $value);
        if ($id === null) {
            $id = glpiCreate($glpi, $drop, ['name' => $value]);
        }
        $cache[$key] = $id;
        return $id;
    };

    $inputs = [];
    $errors = [];
    foreach ($rows as $i => $row) {
        if (count($row) !== count($header)) {
            $errors[] = 'Row ' . ($i + 1) . ': column count mismatch';
            continue;
        }
        $input = [];
        foreach ($header as $idx => $col) {
            $col = trim($col);
            $val = trim((string)($row[$idx] ?? ''));
            if ($val === '') {
                continue;
            }
            if (str_ends_with($col, '_id')) {
                $id = $resolve($col, $val);
                if ($id === null) {
                    $errors[] = 'Row ' . ($i + 1) . ': could not resolve ' . $col . '=' . $val;
                    continue;
                }
                $input[$col] = $id;
            } else {
                $input[$col] = $val;
            }
        }
        if (!empty($input)) {
            $inputs[] = $input;
        }
    }

    $imported = 0;
    if (!empty($inputs)) {
        $result = glpiCreate($glpi, $itemtype, $inputs);
        if (is_array($result)) {
            $imported = count($result);
        } elseif ($result !== null) {
            $imported = 1;
        }
    }

    jsonResponse(['imported' => $imported, 'total' => count($inputs), 'errors' => $errors, 'itemtype' => $itemtype]);
}

function glpiFind(array $glpi, string $itemtype, string $name): ?int
{
    $res = glpiHttp(
        $glpi['url'],
        '/' . $itemtype . '?name=' . rawurlencode($name),
        'GET',
        null,
        $glpi['user_token'],
        $glpi['session_token'],
        $glpi['app_token']
    );
    if (is_array($res)) {
        foreach ($res as $r) {
            if (isset($r['name']) && strcasecmp((string)$r['name'], $name) === 0) {
                return (int)$r['id'];
            }
        }
        if (isset($res[0]['id'])) {
            return (int)$res[0]['id'];
        }
    }
    return null;
}

function glpiCreate(array $glpi, string $itemtype, $fields): ?int
{
    $payload = ['input' => $fields];
    $res = glpiHttp(
        $glpi['url'],
        '/' . $itemtype,
        'POST',
        $payload,
        $glpi['user_token'],
        $glpi['session_token'],
        $glpi['app_token']
    );
    if (is_array($res)) {
        $first = $res[0] ?? $res;
        return isset($first['id']) ? (int)$first['id'] : null;
    }
    return null;
}

function requireGlpiSession(): array
{
    if (!isset($_SESSION['glpi'])) {
        jsonResponse(['error' => 'Not authenticated with GLPI'], 401);
    }
    return $_SESSION['glpi'];
}

function parseTarget(string $target): array
{
    $parts = explode('/', trim($target, '/'));
    if (count($parts) < 2) {
        jsonResponse(['error' => 'Item type and id are required'], 422);
    }
    return [safeName($parts[0]), safeName($parts[1])];
}

function metadataFile(string $itemtype, string $id): string
{
    return META_DIR . '/' . safeName($itemtype . '-' . $id) . '.json';
}

function safeName(string $value): string
{
    return preg_replace('/[^A-Za-z0-9_.-]/', '_', $value) ?: 'item';
}

function readJsonFile(string $file, mixed $default): mixed
{
    if (!file_exists($file)) {
        return $default;
    }
    $decoded = json_decode((string)file_get_contents($file), true);
    return $decoded ?? $default;
}

function writeJsonFile(string $file, mixed $data): void
{
    if (!is_dir(dirname($file))) {
        mkdir(dirname($file), 0775, true);
    }
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
}

function jsonBody(): array
{
    $raw = file_get_contents('php://input');
    $body = json_decode($raw ?: '{}', true);
    if (!is_array($body)) {
        jsonResponse(['error' => 'Invalid JSON body'], 400);
    }
    return $body;
}

function jsonResponse(mixed $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function firstValue(array $row, array $keys): mixed
{
    foreach ($keys as $key) {
        if (!empty($row[$key])) {
            return $row[$key];
        }
    }
    return null;
}

function inventoryStatus(mixed $lastInventory): string
{
    $timestamp = $lastInventory ? strtotime((string)$lastInventory) : false;
    if (!$timestamp) {
        return 'never';
    }
    $days = (time() - $timestamp) / 86400;
    if ($days <= 7) {
        return 'healthy';
    }
    if ($days <= 14) {
        return 'aging';
    }
    return 'stale';
}

function serveStatic(string $path): void
{
    if ($path === '' || $path === 'index.html' || $path === 'index.php') {
        renderApplication();
    }

    $file = realpath(__DIR__ . '/' . $path);
    $publicRoots = array_filter([
        realpath(__DIR__ . '/assets'),
        realpath(__DIR__ . '/data/branding'),
    ]);

    $isPublicFile = false;

    if ($file !== false && is_file($file)) {
        foreach ($publicRoots as $publicRoot) {
            if (
                $file === $publicRoot ||
                str_starts_with($file, $publicRoot . DIRECTORY_SEPARATOR)
            ) {
                $isPublicFile = true;
                break;
            }
        }
    }

    if (!$isPublicFile) {
        http_response_code(404);
        header('Cache-Control: no-store');
        header('Content-Type: text/plain; charset=UTF-8');
        echo 'Not found';
        exit;
    }

    $mimeTypes = [
        'html' => 'text/html; charset=UTF-8',
        'css' => 'text/css; charset=UTF-8',
        'js' => 'application/javascript; charset=UTF-8',
        'json' => 'application/json; charset=UTF-8',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
    ];

    $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));

    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
    header(
        'Content-Type: ' .
        ($mimeTypes[$extension] ?? 'application/octet-stream')
    );

    readfile($file);
    exit;
}

function renderApplication(): void
{
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
    header('Content-Type: text/html; charset=UTF-8');

    require __DIR__ . '/templates/index.php';
    exit;
}
