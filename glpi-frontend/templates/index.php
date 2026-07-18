<?php
declare(strict_types=1);

/**
 * GLPI frontend document template.
 *
 * Partial order is intentional and preserves the original document structure.
 */
$partials = [
    'partials/head.html',
    'partials/login.html',
    'partials/app-shell.html',
    'views/dashboard.html',
    'views/reports.html',
    'views/assets.html',
    'views/import.html',
    'views/inventory-health.html',
    'views/software-matrix.html',
    'views/users.html',
    'views/settings.html',
    'modals/view-asset.html',
    'modals/create-edit-asset.html',
    'modals/assign-asset.html',
    'modals/delete-confirmation.html',
    'partials/footer.html',
];

foreach ($partials as $partial) {
    require __DIR__ . '/' . $partial;
}
