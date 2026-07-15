<?php
// Router script for PHP built-in server
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$baseDir = '/home/felix/FENTECH PROJECTS/GLPI/glpi/public';

// Serve existing files directly
if ($uri !== '/' && file_exists($baseDir . $uri)) {
    return false;
}

// Default to index.php
require $baseDir . '/index.php';
