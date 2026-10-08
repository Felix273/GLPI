// Main entry point for the GLPI Asset Dashboard frontend
//
// This file imports all JavaScript modules in dependency order.
// During development (vite dev server), use: npm run dev
// For production: npm run build

import './assets/js/api.js';
import './assets/js/core/application.js';
import './assets/js/core/dom.js';
import './assets/js/core/searchable-select.js';
import './assets/js/core/navigation.js';
import './assets/js/core/helpers.js';
import './assets/js/features/charts.js';
import './assets/js/features/notifications.js';
import './assets/js/features/inventory.js';
import './assets/js/features/reports.js';
import './assets/js/features/users.js';
import './assets/js/features/import.js';
import './assets/js/features/assets.js';
import './assets/js/features/operations.js';
import './assets/js/features/sla-licences.js';
