<?php
// Local configuration to disable CSRF for development
if (!defined('GLPI_USE_CSRF_CHECK')) {
    define('GLPI_USE_CSRF_CHECK', false);
}
