<?php
$glpi_root = '/home/felix/FENTECH PROJECTS/GLPI/glpi';
$public_dir = $glpi_root . '/public';

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Serve static files directly
if (preg_match('/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/', $uri)) {
    return false;
}

// For PHP scripts, include them directly via index.php routing
require $public_dir . '/index.php';
