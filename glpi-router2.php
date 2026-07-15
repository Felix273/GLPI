<?php
$glpi_root = '/home/felix/FENTECH PROJECTS/GLPI/glpi';
$public_dir = $glpi_root . '/public';

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = $uri;

// Route to the correct PHP file
if ($uri === '/' || $uri === '') {
    require $public_dir . '/index.php';
} elseif (file_exists($public_dir . $uri)) {
    // Serve static files directly
    return false;
} else {
    // Try to find a front/ajax script
    $script_path = $public_dir . $uri;
    if (file_exists($script_path)) {
        require $script_path;
    } else {
        // Fall back to index.php for GLPI routing
        require $public_dir . '/index.php';
    }
}
