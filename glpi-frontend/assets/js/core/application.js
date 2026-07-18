/**
 * Asset Management Dashboard - Full Feature Set
 * With Notifications, Alerts, History, Import
 */


/**
 * Core HTML-safety helper.
 *
 * Kept in the bootstrap file so older cached template versions that do not
 * load core/dom.js still have access to escapeHtml().
 */
if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]);
    };
}

// State
const state = {
    isLoggedIn: false, currentView: 'dashboard', currentAssetType: null, user: null,
    assets: [], users: [], editAssetId: null, selectedAssets: new Set(),
    currentPage: 1, itemsPerPage: 10, charts: {}, importData: [], importHeaders: [], importErrors: [], importUserMappings: [], importUsersResolving: false, importUserResolutionError: '', importDuplicateErrors: [], importDuplicatesChecking: false, importDuplicateCheckError: '',
    notifications: [], alerts: [], viewedAsset: null, softwareMatrix: null,
    dashboardStatusCounts: [0, 0, 0, 0],
    dashboardMetrics: { total: 0, available: 0, assigned: 0, maintenance: 0, expiring: 0 },
    dashboardTypeCounts: {},
    dashboardAssets: [],
    reportRows: [],
    filteredReportRows: [],
    systemSettings: null,
    settingsLoaded: false,
    directoryPreviewUsers: []
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

const DASHBOARD_KPIS = [
    {
        id: 'totalAssetCount',
        key: 'total',
        label: 'Total assets',
        note: 'Across all tracked categories',
        icon: 'fa-boxes-stacked',
        color: '#2563eb',
        tint: 'rgba(37, 99, 235, .12)',
        action: "navigateTo('inventoryHealth')"
    },
    {
        id: 'availableAssetCount',
        key: 'available',
        label: 'Available assets',
        note: 'Ready for allocation',
        icon: 'fa-circle-check',
        color: '#059669',
        tint: 'rgba(5, 150, 105, .12)',
        action: "navigateTo('computers')"
    },
    {
        id: 'assignedAssetCount',
        key: 'assigned',
        label: 'Assigned assets',
        note: 'Currently in use',
        icon: 'fa-user-check',
        color: '#7c3aed',
        tint: 'rgba(124, 58, 237, .12)',
        action: "navigateTo('users')"
    },
    {
        id: 'maintenanceAssetCount',
        key: 'maintenance',
        label: 'Under maintenance',
        note: 'Broken or requiring attention',
        icon: 'fa-screwdriver-wrench',
        color: '#d97706',
        tint: 'rgba(217, 119, 6, .12)',
        action: "navigateTo('alerts')"
    },
    {
        id: 'expiringWarrantyCount',
        key: 'expiring',
        label: 'Expiring warranties',
        note: 'Due within 30 days',
        icon: 'fa-shield-halved',
        color: '#dc2626',
        tint: 'rgba(220, 38, 38, .12)',
        action: "navigateTo('alerts')"
    }
];

const STATUS_MAP = { 0: { label: 'New', class: 'pending' }, 1: { label: 'Used', class: 'active' }, 2: { label: 'Old', class: 'inactive' }, 3: { label: 'Broken', class: 'inactive' } };
const CHART_COLORS = { primary: '#2563eb', success: '#059669', warning: '#d97706', danger: '#dc2626', cyan: '#0891b2', purple: '#7c3aed', slate: '#64748b', sky: '#0284c7', rose: '#e11d48', lime: '#65a30d' };

const DASHBOARD_UI = {
    computers: { icon: 'fa-laptop', color: '#2563eb', tint: 'rgba(37, 99, 235, .12)' },
    monitors: { icon: 'fa-display', color: '#0891b2', tint: 'rgba(8, 145, 178, .12)' },
    printers: { icon: 'fa-print', color: '#7c3aed', tint: 'rgba(124, 58, 237, .12)' },
    network: { icon: 'fa-network-wired', color: '#059669', tint: 'rgba(5, 150, 105, .12)' },
    phones: { icon: 'fa-mobile-screen-button', color: '#ea580c', tint: 'rgba(234, 88, 12, .12)' },
    software: { icon: 'fa-code', color: '#4f46e5', tint: 'rgba(79, 70, 229, .12)' },
    licenses: { icon: 'fa-key', color: '#ca8a04', tint: 'rgba(202, 138, 4, .12)' },
    racks: { icon: 'fa-server', color: '#475569', tint: 'rgba(71, 85, 105, .12)' },
    cartridges: { icon: 'fa-droplet', color: '#db2777', tint: 'rgba(219, 39, 119, .12)' },
    consumables: { icon: 'fa-box-open', color: '#65a30d', tint: 'rgba(101, 163, 13, .12)' }
};
const META_KEY = 'glpi_asset_metadata';
const DOCUMENT_LIMIT_BYTES = 2 * 1024 * 1024;

// Init
document.addEventListener('DOMContentLoaded', async () => {
    loadTheme();
    setupEventListeners();
    loadStoredNotifications();
    await glpi.detectBackend();
    await loadPublicSettings();
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
    document.getElementById('globalSearch')?.addEventListener('input', e => handleGlobalSearch(e.target.value));
    document.getElementById('organizationLogoInput')?.addEventListener('change', event => {
        const file = event.target.files?.[0];
        const label = document.getElementById('selectedLogoName');
        if (label) label.textContent = file ? file.name : 'No file selected';

        if (file) {
            const preview = document.getElementById('organizationLogoPreview');
            if (preview) {
                const reader = new FileReader();
                reader.onload = () => {
                    preview.innerHTML = `<img src="${escapeAttribute(reader.result)}" alt="Selected organization logo">`;
                };
                reader.readAsDataURL(file);
            }
        }
    });
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

function handleKeyboardShortcuts(event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.getElementById('globalSearch')?.focus();
    }
}

function handleGlobalSearch(term) {
    const value = term.trim();
    if (state.currentView !== 'dashboard' && state.currentAssetType) {
        const localFilter = document.getElementById('searchFilter');
        if (localFilter) {
            localFilter.value = value;
            filterAssets();
        }
    }
}

// Theme
function loadTheme() {
    const theme = localStorage.getItem('theme') || 'light';
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
    if (!config) {
        showLogin();
        return;
    }

    try {
        const { url, token, appToken } = JSON.parse(config);
        if (glpi.isLiveServerUrl(url)) {
            localStorage.removeItem('glpi_config');
            showLogin('Run the frontend through server.php before connecting to GLPI.');
            return;
        }
        glpi.init(url, token, appToken || '');
        loginWithSaved(url, token, appToken || '');
    } catch {
        localStorage.removeItem('glpi_config');
        showLogin();
    }
}

function showLogin(message = '') {
    const modal = document.getElementById('loginModal');
    const error = document.getElementById('loginError');
    modal.classList.add('show');
    modal.style.display = '';
    document.getElementById('app').classList.remove('logged-in');
    if (message) {
        error.textContent = message;
        error.classList.add('show');
    } else {
        error.textContent = '';
        error.classList.remove('show');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const url = document.getElementById('glpiUrl').value;
    const token = document.getElementById('userToken').value;
    const appToken = document.getElementById('appToken').value;
    const errorDiv = document.getElementById('loginError');
    const submit = document.getElementById('loginSubmit');
    errorDiv.classList.remove('show');
    submit.disabled = true;
    submit.innerHTML = '<span>Connecting...</span><i class="fas fa-circle-notch fa-spin"></i>';

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
    } finally {
        submit.disabled = false;
        submit.innerHTML = '<span>Connect securely</span><i class="fas fa-arrow-right"></i>';
    }
}

async function loginWithSaved(url, token, appToken) {
    try {
        glpi.init(url, token, appToken);
        await glpi.initSession();
        const session = await glpi.getMyInfo();
        state.user = session.session;
        showApp();
    } catch {
        localStorage.removeItem('glpi_config');
        showLogin('Your saved session expired. Connect again to continue.');
    }
}

async function handleLogout() {
    clearTimeout(sessionIdleTimer);
    try { await glpi.killSession(); } catch {}
    localStorage.removeItem('glpi_config');
    state.isLoggedIn = false;
    showLogin();
}

function showApp() {
    state.isLoggedIn = true;
    sessionExpiryHandled = false;
    touchSessionActivity();
    const loginModal = document.getElementById('loginModal');
    loginModal.classList.remove('show');
    loginModal.style.display = 'none';
    document.getElementById('app').classList.add('logged-in');

    const displayName = state.user?.name || state.user?.glpiID || 'Asset Manager';
    document.getElementById('userDisplay').textContent = displayName;
    const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'AM';
    const avatar = document.getElementById('userAvatar');
    if (avatar) avatar.textContent = initials;

    updatePageContext('dashboard');
    loadDashboard();
    checkAlerts();
}
