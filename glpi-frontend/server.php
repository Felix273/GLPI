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

session_start();

const DATA_DIR = __DIR__ . '/data';
const META_DIR = DATA_DIR . '/metadata';
const DOC_DIR = DATA_DIR . '/documents';

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
        if ($route === 'session' && $method === 'POST') {
            handleSessionStart();
        } elseif ($route === 'logout' && $method === 'POST') {
            handleLogout();
        } elseif ($route === 'session' && $method === 'GET') {
            jsonResponse(['authenticated' => isset($_SESSION['glpi'])]);
        } elseif (str_starts_with($route, 'glpi/')) {
            proxyGlpi(substr($route, 5), $method);
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
    $url = rtrim((string)($body['url'] ?? ''), '/');
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
        $meta['documents'] = array_values(array_filter($meta['documents'] ?? [], fn ($doc) => (string)$doc['id'] !== (string)$docId));
        writeJsonFile($metaFile, $meta);
        jsonResponse(['ok' => true]);
    }

    jsonResponse(['error' => 'Unsupported documents method'], 405);
}

function handleInventorySummary(): void
{
    $computers = glpiList('Computer');
    $now = time();
    $summary = ['total' => count($computers), 'reporting7Days' => 0, 'stale14Days' => 0, 'neverReported' => 0, 'items' => []];

    foreach ($computers as $computer) {
        $last = firstValue($computer, ['last_inventory_update', 'date_mod', 'date_creation']);
        $timestamp = $last ? strtotime((string)$last) : false;
        if (!$timestamp) {
            $summary['neverReported']++;
        } elseif (($now - $timestamp) <= 7 * 86400) {
            $summary['reporting7Days']++;
        } elseif (($now - $timestamp) >= 14 * 86400) {
            $summary['stale14Days']++;
        }
        $summary['items'][] = [
            'id' => $computer['id'] ?? null,
            'name' => $computer['name'] ?? 'Unnamed',
            'serial' => $computer['serial'] ?? '',
            'lastInventory' => $last,
            'status' => inventoryStatus($last),
        ];
    }

    jsonResponse($summary);
}

function handleComputerInventory(string $id): void
{
    $computer = glpiGet('Computer', $id);
    $relations = [
        'softwareVersions' => tryGlpiList('Computer_SoftwareVersion', ['items_id' => $id]),
        'operatingSystems' => tryGlpiList('Item_OperatingSystem', ['items_id' => $id, 'itemtype' => 'Computer']),
        'disks' => tryGlpiList('Item_Disk', ['items_id' => $id, 'itemtype' => 'Computer']),
        'antivirus' => tryGlpiList('ComputerAntivirus', ['computers_id' => $id]),
    ];
    jsonResponse(['computer' => $computer, 'relations' => $relations, 'health' => ['inventoryStatus' => inventoryStatus(firstValue($computer, ['last_inventory_update', 'date_mod']))]]);
}

function handleSoftwareInstallations(): void
{
    $software = glpiList('Software');
    $versions = tryGlpiList('SoftwareVersion');
    $installations = tryGlpiList('Computer_SoftwareVersion');
    jsonResponse(['software' => $software, 'versions' => $versions, 'installations' => $installations]);
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
    $file = __DIR__ . '/' . ($path === '' ? 'index.html' : $path);
    if (!file_exists($file) || is_dir($file)) {
        $file = __DIR__ . '/index.html';
    }

    $mimeTypes = [
        'html' => 'text/html',
        'css' => 'text/css',
        'js' => 'application/javascript',
        'json' => 'application/json',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
    ];
    $ext = pathinfo($file, PATHINFO_EXTENSION);
    header('Content-Type: ' . ($mimeTypes[$ext] ?? 'text/plain'));
    readfile($file);
}
