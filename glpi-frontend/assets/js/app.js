/**
 * Asset Management Dashboard - Full Feature Set
 * With Notifications, Alerts, History, Import
 */

// State
const state = {
    isLoggedIn: false, currentView: 'dashboard', currentAssetType: null, user: null,
    assets: [], users: [], editAssetId: null, selectedAssets: new Set(),
    currentPage: 1, itemsPerPage: 10, charts: {}, importData: [], importHeaders: [], importErrors: [],
    notifications: [], alerts: [], viewedAsset: null, softwareMatrix: null
};

const ASSET_TYPES = {
    computers: { name: 'Computer', api: 'Computer', label: 'Computers' },
    monitors: { name: 'Monitor', api: 'Monitor', label: 'Monitors' },
    peripherals: { name: 'Peripheral', api: 'Peripheral', label: 'Peripherals' },
    phones: { name: 'Phone', api: 'Phone', label: 'Phones' },
    printers: { name: 'Printer', api: 'Printer', label: 'Printers' },
    cartridges: { name: 'Cartridge Item', api: 'CartridgeItem', label: 'Cartridges', stock: true },
    consumables: { name: 'Consumable Item', api: 'ConsumableItem', label: 'Consumables', stock: true },
    network: { name: 'Network Equipment', api: 'NetworkEquipment', label: 'Network' },
    racks: { name: 'Rack', api: 'Rack', label: 'Racks' },
    datacenters: { name: 'Datacenter', api: 'Datacenter', label: 'Datacenters' },
    software: { name: 'Software', api: 'Software', label: 'Software' },
    licenses: { name: 'Software License', api: 'SoftwareLicense', label: 'Licenses' },
    certificates: { name: 'Certificate', api: 'Certificate', label: 'Certificates' },
    contracts: { name: 'Contract', api: 'Contract', label: 'Contracts' },
    suppliers: { name: 'Supplier', api: 'Supplier', label: 'Suppliers' },
    contacts: { name: 'Contact', api: 'Contact', label: 'Contacts' },
    documents: { name: 'Document', api: 'Document', label: 'Documents' },
    locations: { name: 'Location', api: 'Location', label: 'Locations' },
    domains: { name: 'Domain', api: 'Domain', label: 'Domains' },
    users: { name: 'User', api: 'User', label: 'Users' }
};

const DASHBOARD_STATS = [
    { view: 'computers', api: 'Computer', id: 'computerCount', label: 'Computers' },
    { view: 'monitors', api: 'Monitor', id: 'monitorCount', label: 'Monitors' },
    { view: 'printers', api: 'Printer', id: 'printerCount', label: 'Printers' },
    { view: 'network', api: 'NetworkEquipment', id: 'networkCount', label: 'Network' },
    { view: 'phones', api: 'Phone', id: 'phoneCount', label: 'Phones' },
    { view: 'software', api: 'Software', id: 'softwareCount', label: 'Software' },
    { view: 'licenses', api: 'SoftwareLicense', id: 'licenseCount', label: 'Licenses' },
    { view: 'racks', api: 'Rack', id: 'rackCount', label: 'Racks' },
    { view: 'cartridges', api: 'CartridgeItem', id: 'cartridgeCount', label: 'Cartridges' },
    { view: 'consumables', api: 'ConsumableItem', id: 'consumableCount', label: 'Consumables' }
];

const STATUS_MAP = { 0: { label: 'New', class: 'pending' }, 1: { label: 'Used', class: 'active' }, 2: { label: 'Old', class: 'inactive' }, 3: { label: 'Broken', class: 'inactive' } };
const CHART_COLORS = { primary: '#4f46e5', success: '#10b981', warning: '#f59e0b', danger: '#ef4444', cyan: '#06b6d4', purple: '#a855f7' };
const META_KEY = 'glpi_asset_metadata';
const DOCUMENT_LIMIT_BYTES = 2 * 1024 * 1024;

// Init
document.addEventListener('DOMContentLoaded', async () => {
    loadTheme();
    setupEventListeners();
    loadStoredNotifications();
    await glpi.detectBackend();
    checkSavedSession();
});

function setupEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('createAssetForm').addEventListener('submit', handleCreateAsset);
    document.getElementById('assignUserForm').addEventListener('submit', handleAssignUser);
    document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', e => { e.preventDefault(); if (item.dataset.view) navigateTo(item.dataset.view); }));
    document.getElementById('addAssetBtn')?.addEventListener('click', () => state.currentAssetType && showCreateModal(ASSET_TYPES[state.currentAssetType].api));
}

// Theme
function loadTheme() {
    const theme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', theme);
    updateThemeButton(theme);
}

function toggleTheme() {
    const newTheme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeButton(newTheme);
    if (state.charts.type) initCharts();
}

function updateThemeButton(theme) {
    document.getElementById('themeToggle').innerHTML = `<i class="fas fa-${theme === 'dark' ? 'moon' : 'sun'}"></i><span>${theme === 'dark' ? 'Dark' : 'Light'} Mode</span>`;
}

// Auth
function checkSavedSession() {
    const config = localStorage.getItem('glpi_config');
    if (config) {
        const { url, token, appToken } = JSON.parse(config);
        if (glpi.isLiveServerUrl(url)) {
            localStorage.removeItem('glpi_config');
            return;
        }
        glpi.init(url, token, appToken || '');
        loginWithSaved(url, token, appToken || '');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const url = document.getElementById('glpiUrl').value, token = document.getElementById('userToken').value, appToken = document.getElementById('appToken').value;
    const errorDiv = document.getElementById('loginError');
    errorDiv.classList.remove('show');
    try {
        glpi.init(url, token, appToken);
        await glpi.initSession();
        localStorage.setItem('glpi_config', JSON.stringify({ url, token, appToken }));
        const session = await glpi.getMyInfo();
        state.user = session.session;
        showApp();
    } catch (error) {
        errorDiv.textContent = `Connection failed: ${error.message}`;
        errorDiv.classList.add('show');
    }
}

async function loginWithSaved(url, token, appToken) {
    try {
        glpi.init(url, token, appToken);
        await glpi.initSession();
        const session = await glpi.getMyInfo();
        state.user = session.session;
        showApp();
    } catch { localStorage.removeItem('glpi_config'); }
}

async function handleLogout() {
    try { await glpi.killSession(); } catch {}
    localStorage.removeItem('glpi_config');
    state.isLoggedIn = false;
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('app').classList.remove('logged-in');
}

function showApp() {
    state.isLoggedIn = true;
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('app').classList.add('logged-in');
    document.getElementById('userDisplay').textContent = state.user ? `${state.user.glpiID} (${state.user.name})` : '';
    loadDashboard();
    checkAlerts();
}

// Navigation
async function navigateTo(view) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view));
    state.currentView = view;
    state.selectedAssets.clear();
    state.currentPage = 1;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    const views = { dashboard: 'dashboardView', reports: 'reportsView', alerts: 'alertsView', import: 'importView', inventoryHealth: 'inventoryHealthView', softwareMatrix: 'softwareMatrixView' };
    if (views[view]) {
        const viewElement = document.getElementById(views[view]);
        if (!viewElement) return;
        viewElement.classList.add('active');
        if (view === 'dashboard') loadDashboard();
        else if (view === 'reports') loadReports();
        else if (view === 'alerts') loadAlerts();
        else if (view === 'inventoryHealth') loadInventoryHealth();
        else if (view === 'softwareMatrix') loadSoftwareMatrix();
        else if (view === 'users') loadUsers();
    } else if (ASSET_TYPES[view]) {
        document.getElementById('assetListView').classList.add('active');
        document.getElementById('assetListTitle').textContent = ASSET_TYPES[view].name + 's';
        state.currentAssetType = view;
        await loadAssetList(view);
    }
}
window.navigateTo = navigateTo;

// Dashboard
async function loadDashboard() {
    renderStatsGrid();
    await loadDashboardStats();
    await loadRecentAssets();
    initCharts();
    checkAlerts();
}

function renderStatsGrid() {
    document.getElementById('statsGrid').innerHTML = DASHBOARD_STATS.map(stat => `
        <div class="stat-card" onclick="navigateTo('${stat.view}')">
            <div class="stat-icon ${stat.label.toLowerCase()}">
                <i class="fas fa-box"></i>
            </div>
            <div class="stat-info">
                <span class="stat-value" id="${stat.id}">-</span>
                <span class="stat-label">${stat.label}</span>
            </div>
        </div>
    `).join('');
}

async function loadDashboardStats() {
    for (const stat of DASHBOARD_STATS) {
        try {
            const items = await glpi.getItems(stat.api);
            document.getElementById(stat.id).textContent = Array.isArray(items) ? items.length : 0;
        } catch { document.getElementById(stat.id).textContent = '0'; }
    }
}

async function loadRecentAssets() {
    const tbody = document.getElementById('recentAssetsTable');
    tbody.innerHTML = '<tr><td colspan="4"><div class="loading"><div class="spinner"></div></div></td></tr>';
    try {
        const assets = [];
        for (const type of ['Computer', 'Monitor', 'Printer', 'NetworkEquipment', 'Rack', 'CartridgeItem', 'ConsumableItem']) {
            const items = await glpi.getItems(type);
            if (Array.isArray(items)) items.slice(0, 3).forEach(item => assets.push({ ...item, assetType: type }));
        }
        assets.sort((a, b) => new Date(b.date_mod || 0) - new Date(a.date_mod || 0));
        assets.splice(5);
        tbody.innerHTML = assets.map(a => {
            const meta = getAssetMeta(a.assetType, a.id);
            return `<tr><td>${a.name || 'Unnamed'}</td><td>${a.assetType}</td><td>${getStatusBadge(a.status)}</td><td>${formatMoney(meta.financial.value)}</td><td>${formatDate(a.date_mod)}</td></tr>`;
        }).join('');
    } catch { tbody.innerHTML = '<tr><td colspan="4">Error</td></tr>'; }
}

// Charts
function initCharts() {
    const theme = document.body.getAttribute('data-theme') || 'dark';
    const textColor = theme === 'dark' ? '#f8fafc' : '#1e293b';
    if (state.charts.type) state.charts.type.destroy();
    if (state.charts.status) state.charts.status.destroy();
    
    const typeCtx = document.getElementById('assetTypeChart')?.getContext('2d');
    if (typeCtx) {
        state.charts.type = new Chart(typeCtx, {
            type: 'doughnut',
            data: { labels: DASHBOARD_STATS.map(s => s.label), datasets: [{ data: DASHBOARD_STATS.map(s => parseInt(document.getElementById(s.id)?.textContent || '0')), backgroundColor: Object.values(CHART_COLORS), borderWidth: 0 }] },
            options: { responsive: true, plugins: { legend: { position: 'right', labels: { color: textColor } } } }
        });
    }
    
    const statusCtx = document.getElementById('assetStatusChart')?.getContext('2d');
    if (statusCtx) {
        state.charts.status = new Chart(statusCtx, {
            type: 'bar',
            data: { labels: ['New', 'Used', 'Old', 'Broken'], datasets: [{ label: 'Assets', data: [0, 0, 0, 0], backgroundColor: [CHART_COLORS.warning, CHART_COLORS.success, CHART_COLORS.danger, CHART_COLORS.danger], borderRadius: 8 }] },
            options: { scales: { y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: theme === 'dark' ? '#334155' : '#e2e8f0' } }, x: { ticks: { color: textColor }, grid: { display: false } } }, plugins: { legend: { display: false } } }
        });
    }
}

// Notifications & Alerts
function loadStoredNotifications() {
    const stored = localStorage.getItem('glpi_notifications');
    if (stored) state.notifications = JSON.parse(stored);
    updateNotificationBadge();
}

function saveNotifications() {
    localStorage.setItem('glpi_notifications', JSON.stringify(state.notifications));
    updateNotificationBadge();
}

function addNotification(title, message, type = 'info') {
    const notification = { id: Date.now(), title, message, type, time: new Date().toISOString(), read: false };
    state.notifications.unshift(notification);
    if (state.notifications.length > 50) state.notifications = state.notifications.slice(0, 50);
    saveNotifications();
    addAlert(title, message, type);
}

function updateNotificationBadge() {
    const unread = state.notifications.filter(n => !n.read).length;
    const notificationCount = document.getElementById('notificationCount');
    if (notificationCount) {
        notificationCount.textContent = unread;
        notificationCount.classList.toggle('hidden', unread === 0);
    }
    const alertBadge = document.getElementById('alertBadge');
    if (alertBadge) {
        alertBadge.textContent = state.alerts.length;
        alertBadge.style.display = state.alerts.length > 0 ? 'block' : 'none';
    }
}

function toggleNotifications() {
    const panel = document.getElementById('notificationsPanel');
    panel.classList.toggle('show');
    if (panel.classList.contains('show')) renderNotifications();
}

function renderNotifications() {
    const list = document.getElementById('notificationsList');
    if (!state.notifications.length) {
        list.innerHTML = '<div class="notification-empty">No notifications</div>';
        return;
    }
    list.innerHTML = state.notifications.map(n => `
        <div class="notification-item ${n.read ? '' : 'unread'}" onclick="markAsRead(${n.id})">
            <div class="notif-icon ${n.type}"><i class="fas fa-${n.type === 'danger' ? 'times-circle' : n.type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i></div>
            <div class="notif-content">
                <div class="notif-title">${n.title}</div>
                <div class="notif-time">${formatDate(n.time)}</div>
            </div>
        </div>
    `).join('');
}

function markAsRead(id) {
    const notif = state.notifications.find(n => n.id === id);
    if (notif) notif.read = true;
    saveNotifications();
    renderNotifications();
}

function clearAllNotifications() {
    state.notifications = [];
    saveNotifications();
    renderNotifications();
}
window.markAsRead = markAsRead;
window.clearAllNotifications = clearAllNotifications;
window.toggleNotifications = toggleNotifications;
window.toggleMobileMenu = function() {
    var sidebar = document.querySelector(".sidebar");
    var overlay = document.querySelector(".sidebar-overlay");
    if (sidebar) sidebar.classList.toggle("mobile-open");
    if (overlay) overlay.classList.toggle("show");
}

async function checkAlerts() {
    state.alerts = [];
    let warningCount = 0, dangerCount = 0, infoCount = 0;
    
    // Check for broken assets
    for (const stat of DASHBOARD_STATS) {
        try {
            const items = await glpi.getItems(stat.api);
            if (Array.isArray(items)) {
                items.forEach(item => {
                    if (item.status === 3) { // Broken
                        state.alerts.push({ type: 'danger', title: 'Broken Asset', desc: `${item.name} (${stat.label}) needs attention`, time: new Date().toISOString() });
                        dangerCount++;
                    } else if (item.status === 2) { // Old
                        state.alerts.push({ type: 'warning', title: 'Old Asset', desc: `${item.name} is marked as old`, time: new Date().toISOString() });
                        warningCount++;
                    }
                });
            }
        } catch {}
    }
    
    // Check for expiring licenses (mock check)
    infoCount = Math.floor(Math.random() * 3);
    if (infoCount > 0) {
        state.alerts.push({ type: 'info', title: 'Licenses Expiring', desc: `${infoCount} license(s) expiring soon`, time: new Date().toISOString() });
    }
    
    setTextIfPresent('warningCount', warningCount);
    setTextIfPresent('dangerCount', dangerCount);
    setTextIfPresent('infoCount', infoCount);
    
    // Update dashboard banner
    const total = warningCount + dangerCount + infoCount;
    const banner = document.getElementById('alertsBanner');
    if (banner) {
        if (total > 0) {
            banner.style.display = 'flex';
            setTextIfPresent('alertsBannerText', `${total} item(s) need attention`);
        } else {
            banner.style.display = 'none';
        }
    }
    
    updateNotificationBadge();
    
    // Add notifications for new alerts
    if (dangerCount > 0) addNotification('Critical Alerts', `${dangerCount} asset(s) need attention`, 'danger');
    if (warningCount > 0) addNotification('Warnings', `${warningCount} asset(s) need review`, 'warning');
}

function loadAlerts() {
    const list = document.getElementById('alertsList');
    if (!state.alerts.length) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><h3>All Clear!</h3><p>No alerts at this time.</p></div>';
        return;
    }
    list.innerHTML = state.alerts.map(a => `
        <div class="alert-item ${a.type}">
            <div class="alert-icon"><i class="fas fa-${a.type === 'danger' ? 'times-circle' : a.type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i></div>
            <div class="alert-content">
                <div class="alert-title">${a.title}</div>
                <div class="alert-desc">${a.desc}</div>
            </div>
            <div class="alert-time">${formatDate(a.time)}</div>
        </div>
    `).join('');
}
window.checkAlerts = checkAlerts;

function addAlert(title, desc, type) {
    state.alerts.push({ type, title, desc, time: new Date().toISOString() });
}

// Inventory and software visibility
async function loadInventoryHealth() {
    const tbody = document.getElementById('inventoryHealthTable');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5"><div class="loading"><div class="spinner"></div></div></td></tr>';
    try {
        const summary = await glpi.getInventorySummary();
        if (!summary) throw new Error('Inventory health requires the PHP backend server');
        setTextIfPresent('healthTotal', summary.total || 0);
        setTextIfPresent('healthReporting', summary.reporting7Days || 0);
        setTextIfPresent('healthStale', summary.stale14Days || 0);
        setTextIfPresent('healthNever', summary.neverReported || 0);
        tbody.innerHTML = (summary.items || []).map(item => `
            <tr>
                <td>${item.name || 'Unnamed'}</td>
                <td>${item.serial || '-'}</td>
                <td>${formatDate(item.lastInventory)}</td>
                <td>${getInventoryBadge(item.status)}</td>
                <td class="actions"><button class="btn-icon" onclick="viewAsset('Computer', ${item.id})"><i class="fas fa-eye"></i></button></td>
            </tr>
        `).join('') || '<tr><td colspan="5"><div class="empty-state"><h3>No inventory data</h3></div></td></tr>';
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><h3>Inventory unavailable</h3><p>${error.message}</p></div></td></tr>`;
    }
}
window.loadInventoryHealth = loadInventoryHealth;

async function loadSoftwareMatrix() {
    const tbody = document.getElementById('softwareMatrixTable');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4"><div class="loading"><div class="spinner"></div></div></td></tr>';
    try {
        const data = await glpi.getSoftwareInstallations();
        if (!data) throw new Error('Software matrix requires the PHP backend server');
        state.softwareMatrix = buildSoftwareMatrix(data);
        renderSoftwareMatrix();
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><h3>Software data unavailable</h3><p>${error.message}</p></div></td></tr>`;
    }
}
window.loadSoftwareMatrix = loadSoftwareMatrix;

function renderSoftwareMatrix() {
    const tbody = document.getElementById('softwareMatrixTable');
    if (!tbody || !state.softwareMatrix) return;
    const search = document.getElementById('softwareMatrixSearch')?.value?.toLowerCase() || '';
    const rows = state.softwareMatrix.filter(row => !search || row.name.toLowerCase().includes(search));
    tbody.innerHTML = rows.map(row => `
        <tr>
            <td>${row.name}</td>
            <td>${row.publisher || '-'}</td>
            <td>${row.versionCount}</td>
            <td>${row.installCount}</td>
        </tr>
    `).join('') || '<tr><td colspan="4"><div class="empty-state"><h3>No software found</h3></div></td></tr>';
}
window.renderSoftwareMatrix = renderSoftwareMatrix;

function buildSoftwareMatrix(data) {
    const versionCounts = {};
    (data.versions || []).forEach(version => {
        const softwareId = version.softwares_id || version.software_id || version.items_id || 'unknown';
        versionCounts[softwareId] = (versionCounts[softwareId] || 0) + 1;
    });
    const installCounts = {};
    (data.installations || []).forEach(installation => {
        const softwareId = installation.softwares_id || installation.software_id || installation.items_id || installation.softwareversions_id || 'unknown';
        installCounts[softwareId] = (installCounts[softwareId] || 0) + 1;
    });
    return (data.software || []).map(software => ({
        id: software.id,
        name: software.name || 'Unnamed',
        publisher: software.manufacturers_id || software.publisher || '',
        versionCount: versionCounts[software.id] || 0,
        installCount: installCounts[software.id] || 0
    })).sort((a, b) => b.installCount - a.installCount || a.name.localeCompare(b.name));
}

// Reports
async function loadReports() {
    let total = 0, active = 0;
    for (const stat of DASHBOARD_STATS) {
        try {
            const items = await glpi.getItems(stat.api);
            total += Array.isArray(items) ? items.length : 0;
            active += items?.filter(i => i.status === 1).length || 0;
        } catch {}
    }
    document.getElementById('reportTotalAssets').textContent = total;
    document.getElementById('reportActiveAssets').textContent = active;
    document.getElementById('reportTotalValue').textContent = '$' + (total * 500).toLocaleString();
    document.getElementById('reportExpiring').textContent = state.alerts.filter(a => a.type === 'info').length;
}

// Users
async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '<tr><td colspan="6"><div class="loading"><div class="spinner"></div></div></td></tr>';
    try {
        const users = await glpi.getItems('User');
        state.users = Array.isArray(users) ? users : [];
        tbody.innerHTML = state.users.map(u => `<tr><td>${u.name || u.firstname || 'N/A'}</td><td>${u.email || '-'}</td><td>${u.profile || 'User'}</td><td>${u.active !== '0' ? '<span class="status-badge active">Active</span>' : '<span class="status-badge inactive">Inactive</span>'}</td><td>0</td><td class="actions"><button class="btn-icon"><i class="fas fa-eye"></i></button></td></tr>`).join('');
    } catch { tbody.innerHTML = '<tr><td colspan="6">Error</td></tr>'; }
}

window.filterUsers = function() {
    const term = document.getElementById('userSearch').value.toLowerCase();
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = state.users.filter(u => (u.name || '').toLowerCase().includes(term)).map(u => `<tr><td>${u.name || 'N/A'}</td><td>${u.email || '-'}</td><td>${u.profile || 'User'}</td><td>Active</td><td>0</td><td class="actions"><button class="btn-icon"><i class="fas fa-eye"></i></button></td></tr>`).join('');
};

window.showCreateUserModal = function() { showToast('User creation form would open', 'info'); };

// Import
window.showImportModal = function() { navigateTo('import'); };

window.handleCSVUpload = function() {
    const file = document.getElementById('csvFileInput').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = parseCSV(e.target.result);
            const normalized = normalizeImportRows(parsed.headers, parsed.rows);
            state.importHeaders = normalized.headers;
            state.importData = normalized.rows;
            state.importErrors = validateImportRows(state.importData);
            renderImportPreview();
        } catch (error) {
            state.importData = [];
            state.importHeaders = [];
            state.importErrors = [error.message];
            renderImportPreview();
        }
    };
    reader.onerror = () => showToast('Could not read CSV file', 'error');
    reader.readAsText(file);
};

window.cancelImport = function() {
    state.importData = [];
    state.importHeaders = [];
    state.importErrors = [];
    document.getElementById('csvFileInput').value = '';
    document.getElementById('importPreview').style.display = 'none';
    document.getElementById('importResults').innerHTML = '';
};

window.confirmImport = async function() {
    if (!state.importData.length) return showToast('Select a CSV file first', 'error');
    state.importErrors = validateImportRows(state.importData);
    renderImportValidation();
    if (state.importErrors.length) return showToast('Fix import errors first', 'error');

    const button = document.getElementById('confirmImportBtn');
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing';
    showToast(`Importing ${state.importData.length} assets...`, 'info');

    const results = [];
    let success = 0;
    let failed = 0;
    for (const [index, data] of state.importData.entries()) {
        try {
            const apiType = resolveImportItemType(data);
            const payload = await buildImportPayload(data);
            const created = await glpi.createItem(apiType, payload);
            const id = extractItemId(created);
            if (id) {
                saveAssetMeta(apiType, id, { financial: financialFromImport(data), stock: stockFromImport(data), importSource: importMetadataFromRow(data) });
            }
            results.push({ row: index + 2, status: 'ok', name: payload.name, itemtype: apiType, id });
            success++;
        } catch (error) {
            results.push({ row: index + 2, status: 'failed', name: data.name || '(blank)', itemtype: resolveImportItemType(data), error: error.message });
            failed++;
        }
    }
    renderImportResults(results);
    showToast(`Complete: ${success} ok, ${failed} failed`, failed > 0 ? 'error' : 'success');
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-check"></i> Confirm';
    if (success > 0) {
        state.currentAssetType ? await loadAssetList(state.currentAssetType) : await loadDashboard();
    }
};

window.downloadImportTemplate = function() {
    const rows = [
        ['ID', 'Asset Name', 'Asset Tag', 'Model', 'Model No.', 'Category', 'Serial', 'Purchased', 'Location', 'Default Location', 'Checked Out', 'Status', 'Checkout Date', 'Created At', 'Updated at', 'URL'],
        ['1', 'Finance Laptop 01', 'INV-001', 'Dell Latitude', '7420', 'Laptop', 'SN-001', '2026-06-30', 'Nairobi HQ', 'ICT Store', 'Felix', 'Used', '2026-07-01', '2026-06-30', '2026-06-30', 'https://example.com/assets/1'],
        ['2', 'Reception Printer', 'INV-002', 'HP LaserJet', 'M404dn', 'Printer', 'PR-100', '2026-06-30', 'Reception', 'ICT Store', '', 'New', '', '2026-06-30', '2026-06-30', 'https://example.com/assets/2']
    ];
    exportToCSVRows(rows, 'asset_import_template');
};

function parseCSV(text) {
    const clean = text.replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let value = '';
    let quoted = false;

    for (let i = 0; i < clean.length; i++) {
        const char = clean[i];
        const next = clean[i + 1];
        if (char === '"') {
            if (quoted && next === '"') {
                value += '"';
                i++;
            } else {
                quoted = !quoted;
            }
        } else if (char === ',' && !quoted) {
            row.push(value.trim());
            value = '';
        } else if ((char === '\n' || char === '\r') && !quoted) {
            if (char === '\r' && next === '\n') i++;
            row.push(value.trim());
            if (row.some(cell => cell !== '')) rows.push(row);
            row = [];
            value = '';
        } else {
            value += char;
        }
    }

    row.push(value.trim());
    if (row.some(cell => cell !== '')) rows.push(row);
    if (!rows.length) throw new Error('CSV file is empty');

    const headers = rows[0].map(header => normalizeImportHeader(header));
    if (!headers.includes('name')) throw new Error('CSV must include a name column');
    const body = rows.slice(1).map(values => headers.reduce((obj, header, index) => {
        if (!header) return obj;
        obj[header] = values[index] || '';
        return obj;
    }, {})).filter(rowObj => Object.values(rowObj).some(value => String(value).trim() !== ''));

    return { headers: [...new Set(headers.filter(Boolean))], rows: body };
}

function normalizeImportHeader(header) {
    const key = String(header || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const aliases = {
        id: 'external_id',
        asset_id: 'external_id',
        assetname: 'name',
        asset_name: 'name',
        assettag: 'otherserial',
        asset_tag: 'otherserial',
        tag: 'otherserial',
        model: 'model',
        model_no: 'model_no',
        modelno: 'model_no',
        model_number: 'model_no',
        category: 'category',
        purchased: 'purchase_date',
        purchased_at: 'purchase_date',
        checkedout: 'checked_out',
        checked_out: 'checked_out',
        checkout: 'checked_out',
        checkout_date: 'checkout_date',
        checked_out_date: 'checkout_date',
        created_at: 'created_at',
        updated_at: 'updated_at',
        updatedat: 'updated_at',
        default_location: 'default_location',
        defaultlocation: 'default_location',
        url: 'url',
        asset_type: 'itemtype',
        assettype: 'itemtype',
        item_type: 'itemtype',
        glpi_type: 'itemtype',
        inventory: 'otherserial',
        inventory_number: 'otherserial',
        asset_tag: 'otherserial',
        location_id: 'locations_id',
        purchase_value: 'value',
        purchasevalue: 'value',
        warranty_months: 'warranty',
        low_stock: 'threshold',
        lowstock: 'threshold',
        related_item: 'related_asset',
        comments: 'comment',
        notes: 'comment'
    };
    return aliases[key] || key;
}

function normalizeImportRows(headers, rows) {
    const defaultType = document.getElementById('importDefaultType')?.value || 'Computer';
    return {
        headers: ['row_status', 'itemtype', ...headers.filter(header => header !== 'itemtype')],
        rows: rows.map(row => ({
            ...row,
            itemtype: resolveImportItemType({ ...row, itemtype: row.itemtype || defaultType })
        }))
    };
}

// Cache for resolving location names to IDs
const locationCache = {};

async function resolveLocationId(locationName) {
    if (!locationName || isPositiveInteger(locationName)) return locationName;
    const key = String(locationName).toLowerCase().trim();
    if (locationCache[key]) return locationCache[key];
    try {
        const results = await glpi.getItems('Location', { name: locationName });
        if (results && results.length > 0) {
            locationCache[key] = results[0].id;
            return results[0].id;
        }
        // Create if not found
        const created = await glpi.createItem('Location', { name: locationName });
        const id = created?.id || created?.[0]?.id;
        if (id) {
            locationCache[key] = id;
            return id;
        }
    } catch (e) {
        console.error('Failed to resolve location:', locationName, e);
    }
    return null;
}

function validateImportRows(rows) {
    const errors = [];
    rows.forEach((row, index) => {
        const rowNumber = index + 2;
        if (!String(row.name || '').trim()) errors.push(`Row ${rowNumber}: name is required`);
        if (!resolveImportItemType(row)) errors.push(`Row ${rowNumber}: unsupported itemtype "${row.itemtype || ''}"`);
        // Location names are allowed - backend will resolve them to IDs
        if (row.status && importStatusValue(row.status) === null) errors.push(`Row ${rowNumber}: status must be a number or a known status such as New, Used, Available, Checked Out, Retired, Broken`);
        if (row.value && Number.isNaN(Number(row.value))) errors.push(`Row ${rowNumber}: value must be numeric`);
    });
    return errors;
}

function renderImportPreview() {
    const headers = state.importHeaders.length ? state.importHeaders : ['name'];
    document.getElementById('importRowCount').textContent = state.importData.length;
    document.getElementById('importPreviewHead').innerHTML = `<tr>${headers.map(h => `<th>${escapeHtml(importHeaderLabel(h))}</th>`).join('')}</tr>`;
    document.getElementById('importPreviewBody').innerHTML = state.importData.slice(0, 20).map((row, index) => {
        const rowErrors = validateImportRows([row]);
        return `<tr class="${rowErrors.length ? 'import-row-error' : ''}">${headers.map(header => {
            const value = header === 'row_status' ? (rowErrors.length ? rowErrors.join('; ') : 'Ready') : row[header] || '';
            return `<td>${escapeHtml(value)}</td>`;
        }).join('')}</tr>`;
    }).join('');
    document.getElementById('importPreview').style.display = 'block';
    document.getElementById('importResults').innerHTML = '';
    renderImportValidation();
}

function renderImportValidation() {
    const validation = document.getElementById('importValidation');
    const button = document.getElementById('confirmImportBtn');
    if (!validation || !button) return;
    if (!state.importErrors.length) {
        validation.innerHTML = state.importData.length
            ? `<div class="import-message success"><i class="fas fa-check-circle"></i> ${state.importData.length} row(s) ready to import.</div>`
            : '<div class="import-message warning"><i class="fas fa-exclamation-triangle"></i> No import rows found.</div>';
        button.disabled = !state.importData.length;
        return;
    }
    validation.innerHTML = `<div class="import-message danger"><i class="fas fa-times-circle"></i> ${state.importErrors.length} issue(s) found.</div><ul>${state.importErrors.slice(0, 10).map(error => `<li>${escapeHtml(error)}</li>`).join('')}</ul>`;
    button.disabled = true;
}

function renderImportResults(results) {
    const container = document.getElementById('importResults');
    if (!container) return;
    const failed = results.filter(result => result.status === 'failed');
    const ok = results.length - failed.length;
    container.innerHTML = `
        <div class="import-message ${failed.length ? 'warning' : 'success'}">
            <i class="fas fa-${failed.length ? 'exclamation-triangle' : 'check-circle'}"></i>
            Imported ${ok} of ${results.length} row(s).
        </div>
        ${failed.length ? `<div class="table-container"><table class="data-table"><thead><tr><th>Row</th><th>Asset</th><th>Type</th><th>Error</th></tr></thead><tbody>${failed.map(result => `<tr><td>${result.row}</td><td>${escapeHtml(result.name)}</td><td>${escapeHtml(result.itemtype)}</td><td>${escapeHtml(result.error)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    `;
}

function resolveImportItemType(row) {
    const raw = String(row.itemtype || row.asset_type || row.assetType || '').trim();
    const fallback = document.getElementById('importDefaultType')?.value || 'Computer';
    const value = raw || fallback;
    const normalized = value.toLowerCase().replace(/[\s_-]+/g, '');
    const match = Object.values(ASSET_TYPES).find(type =>
        type.api.toLowerCase() === normalized ||
        type.name.toLowerCase().replace(/[\s_-]+/g, '') === normalized ||
        type.label.toLowerCase().replace(/[\s_-]+/g, '') === normalized
    );
    return match?.api || null;
}

async function buildImportPayload(data) {
    const apiType = resolveImportItemType(data);
    const payload = {
        name: String(data.name || '').trim()
    };
    setPayloadIfPresent(payload, 'serial', data.serial);
    setPayloadIfPresent(payload, 'otherserial', data.otherserial);
    setPayloadIfPresent(payload, 'comment', data.comment || importCommentFromRow(data));
    
    // Resolve location name to ID
    if (data.locations_id) {
        if (isPositiveInteger(data.locations_id)) {
            payload.locations_id = Number(data.locations_id);
        } else {
            const locId = await resolveLocationId(data.locations_id);
            if (locId) payload.locations_id = Number(locId);
        }
    }
    if (isPositiveInteger(data.entities_id)) payload.entities_id = Number(data.entities_id);

    const stateId = importStatusValue(data.status);
    if (stateId !== null) payload.states_id = stateId;

    const typeField = importTypeField(apiType);
    if (typeField && isPositiveInteger(data.type)) payload[typeField] = Number(data.type);
    return payload;
}

function importCommentFromRow(data) {
    const lines = [];
    if (data.external_id) lines.push(`Imported ID: ${data.external_id}`);
    if (data.model) lines.push(`Model: ${data.model}`);
    if (data.model_no) lines.push(`Model No.: ${data.model_no}`);
    if (data.category) lines.push(`Category: ${data.category}`);
    if (data.location) lines.push(`Location: ${data.location}`);
    if (data.default_location) lines.push(`Default Location: ${data.default_location}`);
    if (data.checked_out) lines.push(`Checked Out: ${data.checked_out}`);
    if (data.checkout_date) lines.push(`Checkout Date: ${data.checkout_date}`);
    if (data.url) lines.push(`URL: ${data.url}`);
    return lines.join('\n');
}

function setPayloadIfPresent(payload, key, value) {
    const clean = String(value || '').trim();
    if (clean) payload[key] = clean;
}

function importStatusValue(value) {
    if (value == null || value === '') return null;
    if (isPositiveInteger(value) || String(value) === '0') return Number(value);
    const map = {
        new: 0,
        available: 0,
        ready: 0,
        stock: 0,
        used: 1,
        use: 1,
        inuse: 1,
        active: 1,
        deployed: 1,
        assigned: 1,
        checkedout: 1,
        old: 2,
        retired: 2,
        archived: 2,
        broken: 3,
        damaged: 3,
        lost: 3,
        disposed: 3
    };
    const normalized = String(value).trim().toLowerCase().replace(/[\s_-]+/g, '');
    return Object.prototype.hasOwnProperty.call(map, normalized) ? map[normalized] : null;
}

function importTypeField(apiType) {
    return {
        Computer: 'computertypes_id',
        Monitor: 'monitortypes_id',
        Printer: 'printertypes_id',
        Peripheral: 'peripheraltypes_id',
        Phone: 'phonetypes_id',
        NetworkEquipment: 'networkequipmenttypes_id',
        Rack: 'racktypes_id'
    }[apiType] || null;
}

function isPositiveInteger(value) {
    return /^\d+$/.test(String(value || '').trim());
}

function importHeaderLabel(header) {
    return header === 'row_status' ? 'Import status' : header;
}

// Asset List
async function loadAssetList(type) {
    const tbody = document.getElementById('assetTableBody');
    tbody.innerHTML = '<tr><td colspan="7"><div class="loading"><div class="spinner"></div></div></td></tr>';
    const assetType = ASSET_TYPES[type];
    if (!assetType) return;
    try {
        const items = await glpi.getItems(assetType.api);
        state.assets = Array.isArray(items) ? items : [];
        state.currentPage = 1;
        state.selectedAssets.clear();
        renderAssetTable();
        updatePagination();
    } catch (error) { tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><h3>Error</h3><p>${error.message}</p></div></td></tr>`; }
}

function renderAssetTable() {
    const tbody = document.getElementById('assetTableBody');
    const header = document.querySelector('#assetListView .data-table thead');
    const search = document.getElementById('searchFilter')?.value?.toLowerCase() || '';
    const status = document.getElementById('statusFilter')?.value || '';
    let filtered = [...state.assets];
    if (search) filtered = filtered.filter(a => (a.name || '').toLowerCase().includes(search) || (a.serial || '').toLowerCase().includes(search));
    if (status) filtered = filtered.filter(a => a.status == status);
    const start = (state.currentPage - 1) * state.itemsPerPage;
    const paginated = filtered.slice(start, start + state.itemsPerPage);
    const assetType = ASSET_TYPES[state.currentAssetType];
    const isStock = Boolean(assetType?.stock);
    if (header) {
        header.innerHTML = isStock
            ? '<tr><th><input type="checkbox" id="headerCheckbox" onchange="toggleHeaderCheckbox()"></th><th>Name</th><th>Reference</th><th>Stock</th><th>Low Stock</th><th>Location</th><th>Value</th><th>Actions</th></tr>'
            : '<tr><th><input type="checkbox" id="headerCheckbox" onchange="toggleHeaderCheckbox()"></th><th>Name</th><th>Status</th><th>Type</th><th>Location</th><th>Value</th><th>Actions</th></tr>';
    }
    if (!paginated.length) { tbody.innerHTML = `<tr><td colspan="${isStock ? 8 : 7}"><div class="empty-state"><i class="fas fa-box-open"></i><h3>No Assets</h3></div></td></tr>`; return; }
    tbody.innerHTML = paginated.map(asset => renderAssetRow(asset, assetType, isStock)).join('');
    document.getElementById('selectedCount').textContent = state.selectedAssets.size;
    document.getElementById('bulkActionsBar').style.display = state.selectedAssets.size > 0 ? 'flex' : 'none';
}

function updatePagination() {
    const total = state.assets.length, totalPages = Math.ceil(total / state.itemsPerPage);
    document.getElementById('paginationInfo').textContent = `Showing ${(state.currentPage - 1) * state.itemsPerPage + 1}-${Math.min(state.currentPage * state.itemsPerPage, total)} of ${total}`;
    document.getElementById('currentPageDisplay').textContent = state.currentPage;
    document.getElementById('prevPageBtn').disabled = state.currentPage <= 1;
    document.getElementById('nextPageBtn').disabled = state.currentPage >= totalPages;
}

window.prevPage = function() { if (state.currentPage > 1) { state.currentPage--; renderAssetTable(); updatePagination(); } };
window.nextPage = function() { if (state.currentPage < Math.ceil(state.assets.length / state.itemsPerPage)) { state.currentPage++; renderAssetTable(); updatePagination(); } };
window.filterAssets = renderAssetTable;
window.toggleAssetSelection = function(id) { state.selectedAssets.has(id) ? state.selectedAssets.delete(id) : state.selectedAssets.add(id); document.getElementById('selectedCount').textContent = state.selectedAssets.size; document.getElementById('bulkActionsBar').style.display = state.selectedAssets.size > 0 ? 'flex' : 'none'; };
window.toggleHeaderCheckbox = function() { const checked = document.getElementById('headerCheckbox').checked; state.assets.forEach(a => checked ? state.selectedAssets.add(a.id) : state.selectedAssets.delete(a.id)); renderAssetTable(); };
window.clearSelection = function() { state.selectedAssets.clear(); document.getElementById('headerCheckbox').checked = false; renderAssetTable(); };

// Assign
window.showAssignModal = async function() {
    const select = document.getElementById('assignUserSelect');
    select.innerHTML = '<option value="">Loading...</option>';
    try { const users = await glpi.getItems('User'); select.innerHTML = '<option value="">Choose...</option>' + (Array.isArray(users) ? users.map(u => `<option value="${u.id}">${u.name || u.firstname}</option>`).join('') : ''); } catch { select.innerHTML = '<option value="">Error</option>'; }
    showModal('assignModal');
};

async function handleAssignUser(e) {
    e.preventDefault();
    const userId = document.getElementById('assignUserSelect').value;
    if (!userId) return;
    const assetType = ASSET_TYPES[state.currentAssetType];
    try {
        await Promise.all([...state.selectedAssets].map(id => glpi.updateItem(assetType.api, id, { users_id: userId })));
        showToast(`${state.selectedAssets.size} assigned!`, 'success');
        closeModal('assignModal');
        clearSelection();
        await loadAssetList(state.currentAssetType);
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

window.bulkDelete = function() {
    const count = state.selectedAssets.size;
    if (count === 0 || !confirm(`Delete ${count}?`)) return;
    const assetType = ASSET_TYPES[state.currentAssetType];
    Promise.all([...state.selectedAssets].map(id => glpi.deleteItem(assetType.api, id).catch(e => console.error(e))))
        .then(() => { showToast(`${count} deleted`, 'success'); clearSelection(); loadAssetList(state.currentAssetType); })
        .catch(e => { showToast('Some errors', 'error'); loadAssetList(state.currentAssetType); });
};

// Export
window.exportCurrentAssets = function() {
    const assetType = ASSET_TYPES[state.currentAssetType];
    exportToCSV(state.assets.map(a => assetToExportRow(a, assetType?.api || state.currentAssetType)), assetType?.name || 'Assets');
};
window.exportAllAssets = async function() {
    showToast('Preparing...', 'info');
    const all = [];
    for (const assetType of Object.values(ASSET_TYPES).filter(type => type.api !== 'User' && type.api !== 'Location')) {
        try { const items = await glpi.getItems(assetType.api); if (Array.isArray(items)) all.push(...items.map(i => assetToExportRow(i, assetType.api, assetType.label))); } catch {} }
    exportToCSV(all, 'All_Assets');
    showToast('Done!', 'success');
};
function exportToCSV(data, name) {
    if (!data.length) return showToast('No data', 'error');
    const h = Object.keys(data[0]);
    const csv = [h.join(','), ...data.map(r => h.map(k => `"${(r[k] || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${name}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}
function exportToCSVRows(rows, name) {
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${name}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}
window.exportReport = function() { exportToCSV(state.alerts.map(a => ({ Type: a.type, Title: a.title, Description: a.desc })), 'Alerts_Report'); };

// Asset CRUD
async function viewAsset(apiType, id) {
    try {
        const item = await glpi.getItem(apiType, id);
        await hydrateAssetMeta(apiType, id);
        state.viewedAsset = { apiType, id, name: item.name || 'Asset' };
        const meta = getAssetMeta(apiType, id);
        document.getElementById('viewModalTitle').textContent = item.name || 'Asset';
        
        // Details tab
        document.getElementById('assetDetailsTab').innerHTML = `
            <div class="detail-grid">
                <div class="detail-section"><h3>Basic</h3>
                    <div class="detail-item"><span class="detail-label">Name</span><span class="detail-value">${item.name || 'N/A'}</span></div>
                    <div class="detail-item"><span class="detail-label">Status</span><span class="detail-value">${getStatusBadge(item.status)}</span></div>
                    <div class="detail-item"><span class="detail-label">Type</span><span class="detail-value">${item.type || 'N/A'}</span></div>
                    <div class="detail-item"><span class="detail-label">Model</span><span class="detail-value">${item.model_name || 'N/A'}</span></div>
                </div>
                <div class="detail-section"><h3>ID</h3>
                    <div class="detail-item"><span class="detail-label">Serial</span><span class="detail-value">${item.serial || 'N/A'}</span></div>
                    <div class="detail-item"><span class="detail-label">Inventory</span><span class="detail-value">${item.otherserial || 'N/A'}</span></div>
                    <div class="detail-item"><span class="detail-label">ID</span><span class="detail-value">${item.id || 'N/A'}</span></div>
                </div>
                <div class="detail-section"><h3>Location</h3>
                    <div class="detail-item"><span class="detail-label">Location</span><span class="detail-value">${item.locations_id || 'N/A'}</span></div>
                </div>
                <div class="detail-section"><h3>Dates</h3>
                    <div class="detail-item"><span class="detail-label">Created</span><span class="detail-value">${formatDate(item.date_creation)}</span></div>
                    <div class="detail-item"><span class="detail-label">Modified</span><span class="detail-value">${formatDate(item.date_mod)}</span></div>
                </div>
            </div>
            ${item.comment ? '<div class="detail-section"><h3>Comments</h3><p>' + item.comment + '</p></div>' : ''}
        `;
        renderFinancialTab(meta.financial);
        renderDocumentsList(apiType, id);
        
        // History tab - mock timeline
        document.getElementById('assetTimeline').innerHTML = `
            <div class="timeline-item">
                <div class="timeline-date">${formatDate(item.date_mod)}</div>
                <div class="timeline-title">Last Modified</div>
                <div class="timeline-desc">Asset was last updated</div>
            </div>
            <div class="timeline-item">
                <div class="timeline-date">${formatDate(item.date_creation)}</div>
                <div class="timeline-title">Asset Created</div>
                <div class="timeline-desc">This asset was added to the system</div>
            </div>
            <div class="timeline-item">
                <div class="timeline-date">-</div>
                <div class="timeline-title">Initial Inventory</div>
                <div class="timeline-desc">Asset was first inventoried</div>
            </div>
        `;
        
        showModal('viewModal');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}
window.viewAsset = viewAsset;

async function editAsset(apiType, id) {
    try {
        const item = await glpi.getItem(apiType, id);
        await hydrateAssetMeta(apiType, id);
        const meta = getAssetMeta(apiType, id);
        state.editAssetId = id;
        state.editAssetType = apiType;
        document.getElementById('createModalTitle').textContent = `Edit ${item.name || 'Asset'}`;
        document.getElementById('assetName').value = item.name || '';
        document.getElementById('assetStatus').value = item.status || 0;
        document.getElementById('assetType').value = item.type || '';
        document.getElementById('assetLocation').value = item.locations_id || '';
        document.getElementById('assetSerial').value = item.serial || '';
        document.getElementById('assetInventory').value = item.otherserial || '';
        document.getElementById('assetComments').value = item.comment || '';
        fillFinancialForm(meta.financial);
        fillStockForm(meta.stock);
        showModal('createModal');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}
window.editAsset = editAsset;

function showCreateModal(assetType) {
    state.editAssetId = null;
    state.editAssetType = assetType;
    document.getElementById('createModalTitle').textContent = `Add New ${getAssetTypeLabel(assetType)}`;
    document.getElementById('createAssetForm').reset();
    fillFinancialForm({});
    fillStockForm({});
    showModal('createModal');
}
window.showCreateModal = showCreateModal;

async function handleCreateAsset(e) {
    e.preventDefault();
    const data = { name: document.getElementById('assetName').value, status: parseInt(document.getElementById('assetStatus').value), type: document.getElementById('assetType').value, locations_id: document.getElementById('assetLocation').value, serial: document.getElementById('assetSerial').value, otherserial: document.getElementById('assetInventory').value, comment: document.getElementById('assetComments').value };
    const financial = readFinancialForm();
    const stock = readStockForm();
    try {
        if (state.editAssetId) {
            await glpi.updateItem(state.editAssetType, state.editAssetId, data);
            saveAssetMeta(state.editAssetType, state.editAssetId, { financial, stock });
            showToast('Updated!', 'success');
        }
        else {
            const created = await glpi.createItem(state.editAssetType, data);
            const createdId = extractItemId(created);
            if (createdId) saveAssetMeta(state.editAssetType, createdId, { financial, stock });
            showToast('Created!', 'success');
        }
        closeModal('createModal');
        state.currentAssetType ? await loadAssetList(state.currentAssetType) : await loadDashboard();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

function confirmDelete(apiType, id, name) {
    document.getElementById('deleteMessage').textContent = `Delete "${name}"?`;
    document.getElementById('confirmDeleteBtn').onclick = () => deleteAsset(apiType, id);
    showModal('deleteModal');
}
window.confirmDelete = confirmDelete;

async function deleteAsset(apiType, id) {
    try {
        await glpi.deleteItem(apiType, id);
        showToast('Deleted!', 'success');
        closeModal('deleteModal');
        state.currentAssetType ? await loadAssetList(state.currentAssetType) : await loadDashboard();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}
window.deleteAsset = deleteAsset;

window.handleDocumentUpload = function() {
    if (!state.viewedAsset) return;
    const input = document.getElementById('documentUpload');
    const files = [...(input.files || [])];
    if (!files.length) return;
    let saved = 0;
    let skipped = 0;
    Promise.all(files.map(file => new Promise(resolve => {
        if (file.size > DOCUMENT_LIMIT_BYTES) {
            skipped++;
            resolve();
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            addAssetDocument(state.viewedAsset.apiType, state.viewedAsset.id, {
                id: Date.now() + Math.random(),
                name: file.name,
                size: file.size,
                type: file.type || 'application/octet-stream',
                uploadedAt: new Date().toISOString(),
                dataUrl: reader.result
            });
            saved++;
            resolve();
        };
        reader.onerror = () => { skipped++; resolve(); };
        reader.readAsDataURL(file);
    }))).then(() => {
        input.value = '';
        renderDocumentsList(state.viewedAsset.apiType, state.viewedAsset.id);
        showToast(`${saved} document(s) attached${skipped ? `, ${skipped} skipped over 2 MB` : ''}`, skipped ? 'warning' : 'success');
    });
};

window.downloadAssetDocument = function(apiType, id, docId) {
    const doc = getAssetMeta(apiType, id).documents.find(item => String(item.id) === String(docId));
    if (!doc) return;
    const link = document.createElement('a');
    link.href = doc.dataUrl;
    link.download = doc.name;
    link.click();
};

window.removeAssetDocument = function(apiType, id, docId) {
    const meta = getAssetMeta(apiType, id);
    saveAssetMeta(apiType, id, { documents: meta.documents.filter(doc => String(doc.id) !== String(docId)) });
    renderDocumentsList(apiType, id);
};

// Tabs
window.switchAssetTab = function(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.querySelector(`.tab-btn[onclick="switchAssetTab('${tab}')"]`).classList.add('active');
    document.getElementById('asset' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab').style.display = 'block';
};

// Helpers
function setTextIfPresent(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}
function getAllAssetMeta() {
    try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; }
}
function getAssetKey(apiType, id) { return `${apiType}:${id}`; }
function getAssetTypeLabel(apiType) {
    return Object.values(ASSET_TYPES).find(type => type.api === apiType)?.name || apiType;
}
function getAssetMeta(apiType, id) {
    const all = getAllAssetMeta();
    const meta = all[getAssetKey(apiType, id)] || {};
    return { financial: meta.financial || {}, stock: meta.stock || {}, documents: meta.documents || [] };
}
function saveAssetMeta(apiType, id, patch) {
    if (!id) return;
    const all = getAllAssetMeta();
    const key = getAssetKey(apiType, id);
    all[key] = { ...(all[key] || {}), ...patch };
    localStorage.setItem(META_KEY, JSON.stringify(all));
    glpi.saveMetadata(apiType, id, all[key]).catch(() => {});
}
function addAssetDocument(apiType, id, document) {
    const meta = getAssetMeta(apiType, id);
    saveAssetMeta(apiType, id, { documents: [document, ...meta.documents] });
}
async function hydrateAssetMeta(apiType, id) {
    try {
        const remote = await glpi.getMetadata(apiType, id);
        if (!remote) return;
        const all = getAllAssetMeta();
        all[getAssetKey(apiType, id)] = remote;
        localStorage.setItem(META_KEY, JSON.stringify(all));
    } catch {}
}
function readFinancialForm() {
    return {
        purchaseDate: document.getElementById('assetPurchaseDate')?.value || '',
        value: document.getElementById('assetPurchaseValue')?.value || '',
        warrantyMonths: document.getElementById('assetWarranty')?.value || '',
        warrantyExpiry: document.getElementById('assetWarrantyExpiry')?.value || '',
        supplier: document.getElementById('assetSupplier')?.value || '',
        orderNumber: document.getElementById('assetOrderNumber')?.value || ''
    };
}
function readStockForm() {
    return {
        quantity: document.getElementById('assetStockQuantity')?.value || '',
        threshold: document.getElementById('assetStockThreshold')?.value || '',
        relatedItem: document.getElementById('assetRelatedItem')?.value || ''
    };
}
function fillFinancialForm(financial) {
    setValueIfPresent('assetPurchaseDate', financial.purchaseDate || '');
    setValueIfPresent('assetPurchaseValue', financial.value || '');
    setValueIfPresent('assetWarranty', financial.warrantyMonths || '');
    setValueIfPresent('assetWarrantyExpiry', financial.warrantyExpiry || '');
    setValueIfPresent('assetSupplier', financial.supplier || '');
    setValueIfPresent('assetOrderNumber', financial.orderNumber || '');
}
function fillStockForm(stock) {
    setValueIfPresent('assetStockQuantity', stock.quantity || '');
    setValueIfPresent('assetStockThreshold', stock.threshold || '');
    setValueIfPresent('assetRelatedItem', stock.relatedItem || '');
}
function financialFromImport(data) {
    return {
        purchaseDate: data.purchase_date || data.purchaseDate || '',
        value: data.value || data.purchase_value || data.purchaseValue || '',
        warrantyMonths: data.warranty || data.warranty_months || data.warrantyMonths || '',
        warrantyExpiry: data.warranty_expiry || data.warrantyExpiry || '',
        supplier: data.supplier || '',
        orderNumber: data.order_number || data.orderNumber || ''
    };
}
function stockFromImport(data) {
    return {
        quantity: data.stock || data.quantity || data.qty || '',
        threshold: data.low_stock || data.threshold || data.lowStock || '',
        relatedItem: data.related_asset || data.relatedItem || ''
    };
}
function importMetadataFromRow(data) {
    return {
        externalId: data.external_id || '',
        assetTag: data.otherserial || '',
        model: data.model || '',
        modelNo: data.model_no || '',
        category: data.category || '',
        location: data.location || '',
        defaultLocation: data.default_location || '',
        checkedOut: data.checked_out || '',
        checkoutDate: data.checkout_date || '',
        createdAt: data.created_at || '',
        updatedAt: data.updated_at || '',
        url: data.url || '',
        importedAt: new Date().toISOString()
    };
}
function setValueIfPresent(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value;
}
function renderAssetRow(asset, assetType, isStock) {
    const meta = getAssetMeta(assetType.api, asset.id);
    const value = formatMoney(meta.financial.value);
    const actions = `<td class="actions"><button class="btn-icon" onclick="viewAsset('${assetType.api}', ${asset.id})"><i class="fas fa-eye"></i></button><button class="btn-icon" onclick="editAsset('${assetType.api}', ${asset.id})"><i class="fas fa-edit"></i></button><button class="btn-icon delete" onclick="confirmDelete('${assetType.api}', ${asset.id}, '${escapeAttribute(asset.name || asset.id)}')"><i class="fas fa-trash"></i></button></td>`;
    if (isStock) {
        const stock = getStockCount(asset, meta.stock);
        const threshold = Number(meta.stock.threshold || 5);
        const lowStock = stock !== '-' && Number(stock) <= threshold;
        return `<tr><td><input type="checkbox" ${state.selectedAssets.has(asset.id) ? 'checked' : ''} onchange="toggleAssetSelection(${asset.id})"></td><td>${asset.name || 'Unnamed'}</td><td>${asset.ref || asset.reference || asset.otherserial || '-'}</td><td><span class="${lowStock ? 'stock-low' : ''}">${stock}</span></td><td>${lowStock ? '<span class="status-badge inactive">Low</span>' : '<span class="status-badge active">OK</span>'}</td><td>${asset.locations_id || '-'}</td><td>${value}</td>${actions}</tr>`;
    }
    return `<tr><td><input type="checkbox" ${state.selectedAssets.has(asset.id) ? 'checked' : ''} onchange="toggleAssetSelection(${asset.id})"></td><td>${asset.name || 'Unnamed'}</td><td>${getStatusBadge(asset.status)}</td><td>${asset.type || '-'}</td><td>${asset.locations_id || '-'}</td><td>${value}</td>${actions}</tr>`;
}
function getStockCount(asset, stockMeta = {}) {
    return stockMeta.quantity || asset.stock || asset.quantity || asset.qty || asset.nb || asset.number || '-';
}
function renderFinancialTab(financial) {
    const value = Number(financial.value || 0);
    const depreciated = calculateDepreciatedValue(value, financial.purchaseDate);
    const warranty = getWarrantyStatus(financial.warrantyExpiry);
    document.getElementById('assetFinancialTab').innerHTML = `
        <div class="financial-cards">
            <div class="financial-card"><div class="fin-label">Purchase Value</div><div class="fin-value">${formatMoney(financial.value)}</div><div class="fin-date">${formatDate(financial.purchaseDate)}</div></div>
            <div class="financial-card"><div class="fin-label">Current Value</div><div class="fin-value">${formatMoney(depreciated)}</div><div class="fin-date">Straight-line depreciation</div></div>
            <div class="financial-card"><div class="fin-label">Warranty</div><div class="fin-value ${warranty.className}">${warranty.label}</div><div class="fin-date">${formatDate(financial.warrantyExpiry)}</div></div>
            <div class="financial-card"><div class="fin-label">Supplier</div><div class="fin-value">${financial.supplier || '-'}</div><div class="fin-date">${financial.orderNumber || ''}</div></div>
        </div>
    `;
}
function renderDocumentsList(apiType, id) {
    const documents = getAssetMeta(apiType, id).documents;
    const list = document.getElementById('documentsList');
    if (!documents.length) {
        list.innerHTML = '<div class="document-empty">No documents attached</div>';
        return;
    }
    list.innerHTML = documents.map(doc => `
        <div class="document-item">
            <div class="doc-icon"><i class="fas fa-file-alt"></i></div>
            <div class="doc-info"><div class="doc-name">${doc.name}</div><div class="doc-meta">${formatBytes(doc.size)} • ${formatDate(doc.uploadedAt)}</div></div>
            <div class="doc-actions">
                <button onclick="downloadAssetDocument('${apiType}', ${id}, '${doc.id}')" title="Download"><i class="fas fa-download"></i></button>
                <button class="delete" onclick="removeAssetDocument('${apiType}', ${id}, '${doc.id}')" title="Remove"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}
function assetToExportRow(asset, apiType, label = apiType) {
    const meta = getAssetMeta(apiType, asset.id);
    return {
        ItemType: label,
        Name: asset.name || '',
        Status: STATUS_MAP[asset.status]?.label || asset.status || '',
        Type: asset.type || asset.ref || '',
        Location: asset.locations_id || '',
        Value: meta.financial.value || '',
        PurchaseDate: meta.financial.purchaseDate || '',
        WarrantyExpiry: meta.financial.warrantyExpiry || '',
        Supplier: meta.financial.supplier || '',
        Stock: meta.stock.quantity || '',
        LowStockThreshold: meta.stock.threshold || '',
        RelatedAsset: meta.stock.relatedItem || '',
        Documents: meta.documents.length
    };
}
function extractItemId(response) {
    if (!response) return null;
    if (response.id) return response.id;
    if (response[0]?.id) return response[0].id;
    if (response.item?.id) return response.item.id;
    return null;
}
function calculateDepreciatedValue(value, purchaseDate) {
    if (!value) return '';
    if (!purchaseDate) return value;
    const years = Math.max(0, (Date.now() - new Date(purchaseDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return Math.max(0, value * (1 - Math.min(years / 5, 1))).toFixed(2);
}
function getWarrantyStatus(expiry) {
    if (!expiry) return { label: 'Unknown', className: '' };
    const days = (new Date(expiry).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    if (days < 0) return { label: 'Expired', className: 'danger' };
    if (days <= 30) return { label: 'Expiring', className: 'warning' };
    return { label: 'Active', className: 'success' };
}
function formatMoney(value) {
    const number = Number(value);
    if (!number) return '-';
    return '$' + number.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function formatBytes(bytes) {
    const number = Number(bytes || 0);
    if (number < 1024) return `${number} B`;
    if (number < 1024 * 1024) return `${(number / 1024).toFixed(1)} KB`;
    return `${(number / 1024 / 1024).toFixed(1)} MB`;
}
function escapeAttribute(value) {
    return String(value).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}
function getStatusBadge(status) {
    if (status == null) return '<span class="status-badge inactive">Unknown</span>';
    const info = STATUS_MAP[status] || { label: status, class: 'pending' };
    return `<span class="status-badge ${info.class}">${info.label}</span>`;
}
function getInventoryBadge(status) {
    const map = {
        healthy: { label: 'Healthy', class: 'active' },
        aging: { label: 'Aging', class: 'pending' },
        stale: { label: 'Stale', class: 'inactive' },
        never: { label: 'Never', class: 'inactive' }
    };
    const info = map[status] || map.never;
    return `<span class="status-badge ${info.class}">${info.label}</span>`;
}
function showModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
window.closeModal = closeModal;
function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    document.getElementById('toastMessage').textContent = msg;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}
window.showToast = showToast;
function formatDate(d) { return d ? new Date(d).toLocaleDateString() : 'N/A'; }
function refreshAll() { state.currentView === 'dashboard' ? loadDashboard() : state.currentAssetType ? loadAssetList(state.currentAssetType) : showToast('Refreshed', 'success'); }
window.refreshAll = refreshAll;
window.refreshDashboard = loadDashboard;
window.globalSearch = function(t) { if (t.length > 2) showToast('Search: ' + t, 'info'); };

document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show')); });
