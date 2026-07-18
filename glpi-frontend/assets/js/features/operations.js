/* ==========================================================================
   Enhanced operations layer
   Dashboard, advanced asset management, lifecycle history and reliability
   ========================================================================== */

const OPERATIONAL_ASSET_APIS = new Set(['Computer', 'Monitor', 'Peripheral', 'Phone', 'Printer', 'NetworkEquipment', 'Rack']);
const ENHANCED_DOCUMENT_LIMIT_BYTES = 5 * 1024 * 1024;
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
let sessionIdleTimer = null;
let sessionExpiryHandled = false;

Object.assign(STATUS_MAP, {
    0: { label: 'Available', class: 'available' },
    1: { label: 'Assigned', class: 'assigned' },
    2: { label: 'Retired', class: 'retired' },
    3: { label: 'Maintenance', class: 'maintenance' }
});

DASHBOARD_KPIS.forEach(kpi => {
    kpi.action = `showDashboardAssetBrowser('${kpi.key}')`;
});

Object.assign(state, {
    filteredAssets: [],
    assignMode: 'bulk',
    assignTarget: null,
    dashboardMetadataLoaded: false
});

window.addEventListener('glpi:session-expired', () => expireFrontendSession('Your GLPI session expired. Sign in again to continue.'));

document.addEventListener('DOMContentLoaded', () => {
    setupEnhancedReliability();
    setupDocumentDropZone();
    setupWarrantyCalculator();
});

function setupEnhancedReliability() {
    ['click', 'keydown', 'pointerdown', 'touchstart'].forEach(eventName => {
        document.addEventListener(eventName, touchSessionActivity, { passive: true });
    });
    touchSessionActivity();
}

function touchSessionActivity() {
    if (!state.isLoggedIn) return;
    clearTimeout(sessionIdleTimer);
    sessionIdleTimer = setTimeout(() => expireFrontendSession('Your session was closed after 30 minutes of inactivity.'), SESSION_IDLE_TIMEOUT_MS);
}

async function expireFrontendSession(message) {
    if (sessionExpiryHandled) return;
    sessionExpiryHandled = true;
    clearTimeout(sessionIdleTimer);
    state.isLoggedIn = false;
    glpi.sessionToken = null;
    glpi.backendAuthenticated = false;
    localStorage.removeItem('glpi_config');
    showLogin(message);
    setTimeout(() => { sessionExpiryHandled = false; }, 1000);
}

function formatApiError(error, fallback = 'The request could not be completed.') {
    const message = String(error?.message || error || '').trim();
    if (!message) return fallback;
    if (/not authenticated|session|401/i.test(message)) return 'Your GLPI session expired. Sign in again to continue.';
    if (/timed out/i.test(message)) return 'GLPI took too long to respond. Check the service and try again.';
    if (/failed to fetch|unable to reach|network/i.test(message)) return 'The GLPI service is unreachable. Check Docker and the backend URL.';
    return message;
}

function normalizeAssetStatus(assetOrStatus) {
    if (assetOrStatus && typeof assetOrStatus === 'object') {
        const raw = assetOrStatus.status ?? assetOrStatus.states_id ?? assetOrStatus.state ?? 0;
        const value = Number(raw);
        if (Number.isFinite(value)) return value;
        return importStatusValue(raw) ?? 0;
    }
    const value = Number(assetOrStatus);
    return Number.isFinite(value) ? value : (importStatusValue(assetOrStatus) ?? 0);
}

function getAssetUserId(asset) {
    return Number(asset?.users_id || asset?.users_id_tech || 0);
}

function getUserDisplayName(userId) {
    if (!Number(userId)) return 'Unassigned';
    const user = state.users.find(item => Number(item.id) === Number(userId));
    if (!user) return `User #${userId}`;
    const fullName = [user.firstname, user.realname].filter(Boolean).join(' ').trim();
    return fullName || user.name || user.email || `User #${userId}`;
}

function getAssetLocationLabel(asset, meta = null) {
    const metadata = meta || getAssetMeta(asset.assetType || state.editAssetType || state.currentAssetType, asset.id);
    return metadata?.importSource?.location || metadata?.importSource?.defaultLocation || asset.location_name || asset.locations_name || asset.locations_id || 'Not set';
}

function getWarrantyCategory(expiry) {
    if (!expiry) return 'unknown';
    const time = new Date(expiry).getTime();
    if (Number.isNaN(time)) return 'unknown';
    const days = (time - Date.now()) / 86400000;
    const warningDays = Number(state.systemSettings?.general?.warrantyWarningDays || 30);
    if (days < 0) return 'expired';
    if (days <= warningDays) return 'expiring';
    return 'active';
}

function getStatusBadge(statusOrAsset) {
    const status = normalizeAssetStatus(statusOrAsset);
    const info = STATUS_MAP[status] || { label: `State ${status}`, class: 'pending' };
    return `<span class="status-badge ${info.class}"><span class="status-dot"></span>${escapeHtml(info.label)}</span>`;
}

async function hydrateAllAssetMeta() {
    if (!glpi.backendMode) return getAllAssetMeta();
    try {
        const remote = await glpi.getAllMetadata();
        if (remote && typeof remote === 'object') {
            const local = getAllAssetMeta();
            Object.entries(remote).forEach(([key, remoteMeta]) => {
                const localMeta = local[key] || {};
                const localDocuments = Array.isArray(localMeta.documents) ? localMeta.documents : [];
                const remoteDocuments = Array.isArray(remoteMeta.documents) ? remoteMeta.documents : [];
                const documents = remoteDocuments.map(document => ({
                    ...(localDocuments.find(localDocument => String(localDocument.id) === String(document.id)) || {}),
                    ...document
                }));
                local[key] = { ...localMeta, ...remoteMeta, documents };
            });
            localStorage.setItem(META_KEY, JSON.stringify(local));
            state.dashboardMetadataLoaded = true;
        }
    } catch (error) {
        console.warn('Metadata collection unavailable:', error);
    }
    return getAllAssetMeta();
}

function getAssetMeta(apiType, id) {
    const all = getAllAssetMeta();
    const meta = all[getAssetKey(apiType, id)] || {};
    return {
        financial: meta.financial || {},
        stock: meta.stock || {},
        documents: Array.isArray(meta.documents) ? meta.documents : [],
        assignments: Array.isArray(meta.assignments) ? meta.assignments : [],
        maintenance: Array.isArray(meta.maintenance) ? meta.maintenance : [],
        activities: Array.isArray(meta.activities) ? meta.activities : [],
        importSource: meta.importSource || {}
    };
}

function saveAssetMeta(apiType, id, patch) {
    if (!id) return Promise.resolve(null);
    const all = getAllAssetMeta();
    const key = getAssetKey(apiType, id);
    all[key] = { ...(all[key] || {}), ...patch };
    localStorage.setItem(META_KEY, JSON.stringify(all));
    return glpi.saveMetadata(apiType, id, all[key]).catch(error => {
        console.warn('Metadata sync failed:', error);
        return null;
    });
}

function appendAssetActivity(apiType, id, activity) {
    const meta = getAssetMeta(apiType, id);
    const entry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: activity.type || 'updated',
        title: activity.title || 'Asset updated',
        description: activity.description || '',
        actor: state.user?.name || state.user?.glpiID || 'Asset manager',
        createdAt: activity.createdAt || new Date().toISOString()
    };
    return saveAssetMeta(apiType, id, { activities: [entry, ...meta.activities].slice(0, 100) });
}

function dashboardSkeletonRows(count = 5) {
    return Array.from({ length: count }, () => `
        <tr class="skeleton-row"><td><span class="skeleton skeleton-line wide"></span></td><td><span class="skeleton skeleton-line"></span></td><td><span class="skeleton skeleton-line"></span></td><td><span class="skeleton skeleton-pill"></span></td><td><span class="skeleton skeleton-line"></span></td></tr>
    `).join('');
}

async function loadDashboard() {
    renderStatsGrid();
    const recentTable = document.getElementById('recentAssetsTable');
    if (recentTable) recentTable.innerHTML = dashboardSkeletonRows(5);
    try {
        await hydrateAllAssetMeta();
        await Promise.all([loadDashboardStats(), ensureUsersLoaded()]);
        await loadRecentAssets();
        initCharts();
        checkAlerts();
    } catch (error) {
        const message = formatApiError(error);
        if (recentTable) recentTable.innerHTML = `<tr><td colspan="5">${renderInlineError(message, 'loadDashboard()')}</td></tr>`;
        showToast(message, 'error');
    }
}

function renderStatsGrid() {
    const container = document.getElementById('statsGrid');
    if (!container) return;
    container.innerHTML = DASHBOARD_KPIS.map(stat => `
        <button class="stat-card operational-kpi" onclick="${stat.action}" style="--stat-color:${stat.color};--stat-tint:${stat.tint}" aria-label="${stat.label}">
            <span class="stat-icon"><i class="fas ${stat.icon}"></i></span>
            <span class="stat-info">
                <span class="stat-value" id="${stat.id}"><span class="skeleton skeleton-number"></span></span>
                <span class="stat-label">${stat.label}</span>
                <span class="stat-note">${stat.note}</span>
            </span>
            <span class="stat-link">View details <i class="fas fa-arrow-right"></i></span>
        </button>
    `).join('');
}

async function loadDashboardStats() {
    const metrics = { total: 0, available: 0, assigned: 0, maintenance: 0, expiring: 0 };
    state.dashboardTypeCounts = {};
    state.dashboardAssets = [];

    const results = await Promise.all(DASHBOARD_STATS.map(async stat => {
        try {
            const items = await glpi.getItems(stat.api);
            return { stat, list: Array.isArray(items) ? items : [] };
        } catch (error) {
            console.error(`Unable to load ${stat.label}:`, error);
            return { stat, list: [], error };
        }
    }));

    results.forEach(({ stat, list }) => {
        state.dashboardTypeCounts[stat.api] = list.length;
        metrics.total += list.length;
        list.forEach(item => {
            const asset = { ...item, assetType: stat.api };
            state.dashboardAssets.push(asset);
            const status = normalizeAssetStatus(asset);
            const assigned = getAssetUserId(asset) > 0 || status === 1;
            if (OPERATIONAL_ASSET_APIS.has(stat.api)) {
                if (status === 3) metrics.maintenance += 1;
                else if (assigned) metrics.assigned += 1;
                else if (status === 0) metrics.available += 1;
            }
            const expiry = getAssetMeta(stat.api, item.id).financial.warrantyExpiry;
            if (getWarrantyCategory(expiry) === 'expiring') metrics.expiring += 1;
        });
    });

    state.dashboardMetrics = metrics;
    const operationalTotal = state.dashboardAssets.filter(asset => OPERATIONAL_ASSET_APIS.has(asset.assetType)).length;
    const other = Math.max(0, operationalTotal - metrics.available - metrics.assigned - metrics.maintenance);
    state.dashboardStatusCounts = [metrics.available, metrics.assigned, metrics.maintenance, other];
    DASHBOARD_KPIS.forEach(stat => {
        const element = document.getElementById(stat.id);
        if (element) element.textContent = metrics[stat.key] ?? 0;
    });
}

function activityIcon(type) {
    return ({ created: 'fa-plus', updated: 'fa-pen', assigned: 'fa-user-check', unassigned: 'fa-user-minus', maintenance: 'fa-screwdriver-wrench', document: 'fa-paperclip', status: 'fa-arrows-rotate' })[type] || 'fa-clock-rotate-left';
}

async function loadRecentAssets() {
    const tbody = document.getElementById('recentAssetsTable');
    if (!tbody) return;
    const activity = [];
    state.dashboardAssets.forEach(asset => {
        const meta = getAssetMeta(asset.assetType, asset.id);
        meta.activities.forEach(item => activity.push({ ...item, asset }));
        if (!meta.activities.length) {
            activity.push({
                id: `modified-${asset.assetType}-${asset.id}`,
                type: 'updated',
                title: 'Asset record updated',
                description: '',
                createdAt: asset.date_mod || asset.date_creation,
                asset
            });
        }
    });
    const latest = activity.filter(item => item.createdAt).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
    if (!latest.length) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state compact"><i class="fas fa-clock-rotate-left"></i><h3>No recent activity</h3><p>Assignments, maintenance, uploads and updates will appear here.</p></div></td></tr>`;
        return;
    }
    tbody.innerHTML = latest.map(item => `
        <tr class="clickable-row" onclick="viewAsset('${item.asset.assetType}', ${item.asset.id})">
            <td data-label="Activity"><div class="activity-cell"><span class="activity-icon"><i class="fas ${activityIcon(item.type)}"></i></span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description || item.actor || '')}</small></span></div></td>
            <td data-label="Asset">${escapeHtml(item.asset.name || 'Unnamed')}</td>
            <td data-label="Type">${escapeHtml(getAssetTypeLabel(item.asset.assetType))}</td>
            <td data-label="Status">${getStatusBadge(item.asset)}</td>
            <td data-label="When">${formatRelativeDate(item.createdAt)}</td>
        </tr>
    `).join('');
}

function formatRelativeDate(value) {
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return 'Unknown';
    const seconds = Math.round((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return formatDate(value);
}

function showDashboardAssetBrowser(mode = 'total') {
    let assets = [...state.dashboardAssets];
    if (mode === 'available') assets = assets.filter(asset => OPERATIONAL_ASSET_APIS.has(asset.assetType) && normalizeAssetStatus(asset) === 0 && !getAssetUserId(asset));
    if (mode === 'assigned') assets = assets.filter(asset => OPERATIONAL_ASSET_APIS.has(asset.assetType) && (normalizeAssetStatus(asset) === 1 || getAssetUserId(asset)));
    if (mode === 'maintenance') assets = assets.filter(asset => OPERATIONAL_ASSET_APIS.has(asset.assetType) && normalizeAssetStatus(asset) === 3);
    if (mode === 'expiring') assets = assets.filter(asset => getWarrantyCategory(getAssetMeta(asset.assetType, asset.id).financial.warrantyExpiry) === 'expiring');

    let modal = document.getElementById('dashboardAssetsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'dashboardAssetsModal';
        modal.className = 'modal';
        modal.innerHTML = `<div class="modal-content modal-large"><div class="modal-header"><div><span class="eyebrow">Dashboard drill-down</span><h2 id="dashboardAssetsTitle">Assets</h2></div><button class="modal-close" onclick="closeModal('dashboardAssetsModal')"><i class="fas fa-times"></i></button></div><div class="modal-body" id="dashboardAssetsBody"></div></div>`;
        document.body.appendChild(modal);
    }
    const labels = { total: 'All tracked assets', available: 'Available assets', assigned: 'Assigned assets', maintenance: 'Assets under maintenance', expiring: 'Warranties expiring within 30 days' };
    document.getElementById('dashboardAssetsTitle').textContent = labels[mode] || 'Assets';
    document.getElementById('dashboardAssetsBody').innerHTML = assets.length ? `
        <div class="table-container"><table class="data-table"><thead><tr><th>Asset</th><th>Type</th><th>Status</th><th>Location</th><th>Warranty</th><th></th></tr></thead><tbody>${assets.slice(0, 100).map(asset => {
            const meta = getAssetMeta(asset.assetType, asset.id);
            return `<tr><td>${escapeHtml(asset.name || 'Unnamed')}</td><td>${escapeHtml(getAssetTypeLabel(asset.assetType))}</td><td>${getStatusBadge(asset)}</td><td>${escapeHtml(String(getAssetLocationLabel(asset, meta)))}</td><td>${renderWarrantyBadge(meta.financial.warrantyExpiry)}</td><td><button class="btn-icon" onclick="closeModal('dashboardAssetsModal');viewAsset('${asset.assetType}',${asset.id})"><i class="fas fa-arrow-right"></i></button></td></tr>`;
        }).join('')}</tbody></table></div>
    ` : `<div class="empty-state"><i class="fas fa-box-open"></i><h3>No matching assets</h3><p>This category currently has no records.</p></div>`;
    showModal('dashboardAssetsModal');
}
window.showDashboardAssetBrowser = showDashboardAssetBrowser;

function renderInlineError(message, retryExpression = '') {
    return `<div class="empty-state compact error-state"><i class="fas fa-triangle-exclamation"></i><h3>Unable to load data</h3><p>${escapeHtml(message)}</p>${retryExpression ? `<button class="btn-secondary btn-sm" onclick="${retryExpression}"><i class="fas fa-rotate"></i> Try again</button>` : ''}</div>`;
}

async function ensureUsersLoaded(force = false) {
    if (state.users.length && !force) return state.users;
    try {
        const users = await glpi.getItems('User');
        state.users = Array.isArray(users) ? users : [];
    } catch (error) {
        console.warn('Unable to load users:', error);
        state.users = [];
    }
    return state.users;
}

async function loadAssetList(type) {
    const tbody = document.getElementById('assetTableBody');
    if (!tbody) return;
    tbody.innerHTML = dashboardSkeletonRows(7);
    const assetType = ASSET_TYPES[type];
    if (!assetType) return;
    try {
        await Promise.all([hydrateAllAssetMeta(), ensureUsersLoaded()]);
        const items = await glpi.getItems(assetType.api);
        state.assets = (Array.isArray(items) ? items : []).map(item => ({ ...item, assetType: assetType.api }));
        state.currentPage = 1;
        state.selectedAssets.clear();
        populateLocationFilter();
        renderAssetTable();
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="9">${renderInlineError(formatApiError(error), `loadAssetList('${type}')`)}</td></tr>`;
    }
}

function populateLocationFilter() {
    const select = document.getElementById('locationFilter');
    if (!select) return;
    const current = select.value;
    const locations = [...new Set(state.assets.map(asset => String(getAssetLocationLabel(asset))).filter(value => value && value !== 'Not set'))].sort((a, b) => a.localeCompare(b));
    select.innerHTML = '<option value="">All locations</option>' + locations.map(value => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`).join('');
    if (locations.includes(current)) select.value = current;
}

function getFilteredAssets() {
    const search = (document.getElementById('searchFilter')?.value || '').trim().toLowerCase();
    const status = document.getElementById('statusFilter')?.value || '';
    const assignment = document.getElementById('assignmentFilter')?.value || '';
    const location = document.getElementById('locationFilter')?.value || '';
    const warranty = document.getElementById('warrantyFilter')?.value || '';
    const sort = document.getElementById('sortFilter')?.value || 'modified_desc';

    const filtered = state.assets.filter(asset => {
        const meta = getAssetMeta(asset.assetType, asset.id);
        const haystack = [asset.name, asset.serial, asset.otherserial, asset.comment, getAssetLocationLabel(asset, meta), getUserDisplayName(getAssetUserId(asset))].join(' ').toLowerCase();
        if (search && !haystack.includes(search)) return false;
        if (status !== '' && String(normalizeAssetStatus(asset)) !== status) return false;
        const assigned = getAssetUserId(asset) > 0 || normalizeAssetStatus(asset) === 1;
        if (assignment === 'assigned' && !assigned) return false;
        if (assignment === 'unassigned' && assigned) return false;
        if (location && String(getAssetLocationLabel(asset, meta)) !== location) return false;
        if (warranty && getWarrantyCategory(meta.financial.warrantyExpiry) !== warranty) return false;
        return true;
    });

    filtered.sort((a, b) => {
        if (sort === 'name_asc') return String(a.name || '').localeCompare(String(b.name || ''));
        if (sort === 'name_desc') return String(b.name || '').localeCompare(String(a.name || ''));
        if (sort === 'status_asc') return normalizeAssetStatus(a) - normalizeAssetStatus(b);
        if (sort === 'value_desc') return Number(getAssetMeta(b.assetType, b.id).financial.value || 0) - Number(getAssetMeta(a.assetType, a.id).financial.value || 0);
        return new Date(b.date_mod || b.date_creation || 0) - new Date(a.date_mod || a.date_creation || 0);
    });
    return filtered;
}

function renderAssetTable() {
    const tbody = document.getElementById('assetTableBody');
    const header = document.querySelector('#assetListView .data-table thead');
    if (!tbody || !header) return;
    const assetType = ASSET_TYPES[state.currentAssetType];
    const isStock = Boolean(assetType?.stock);
    state.filteredAssets = getFilteredAssets();
    const totalPages = Math.max(1, Math.ceil(state.filteredAssets.length / state.itemsPerPage));
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    const start = (state.currentPage - 1) * state.itemsPerPage;
    const paginated = state.filteredAssets.slice(start, start + state.itemsPerPage);

    header.innerHTML = isStock
        ? '<tr><th><input type="checkbox" id="headerCheckbox" onchange="toggleHeaderCheckbox()" aria-label="Select page"></th><th>Name</th><th>Reference</th><th>Stock</th><th>Stock health</th><th>Location</th><th>Value</th><th>Modified</th><th>Actions</th></tr>'
        : '<tr><th><input type="checkbox" id="headerCheckbox" onchange="toggleHeaderCheckbox()" aria-label="Select page"></th><th>Asset</th><th>Status</th><th>Assigned to</th><th>Location</th><th>Warranty</th><th>Value</th><th>Modified</th><th>Actions</th></tr>';

    if (!paginated.length) {
        tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-box-open"></i><h3>No matching assets</h3><p>Adjust the filters or add a new ${escapeHtml(assetType?.name || 'asset')}.</p><button class="btn-primary btn-sm" onclick="showCreateModal('${assetType.api}')"><i class="fas fa-plus"></i> Add asset</button></div></td></tr>`;
    } else {
        tbody.innerHTML = paginated.map(asset => renderAssetRow(asset, assetType, isStock)).join('');
    }
    updateSelectionBar();
    updatePagination(state.filteredAssets.length);
}

function renderAssetRow(asset, assetType, isStock) {
    const meta = getAssetMeta(assetType.api, asset.id);
    const value = formatMoney(meta.financial.value);
    const checked = state.selectedAssets.has(Number(asset.id));
    const actions = `<td class="actions" data-label="Actions"><button class="btn-icon" title="View details" onclick="viewAsset('${assetType.api}', ${asset.id})"><i class="fas fa-eye"></i></button><button class="btn-icon" title="Edit asset" onclick="editAsset('${assetType.api}', ${asset.id})"><i class="fas fa-pen"></i></button><button class="btn-icon delete" title="Delete asset" onclick="confirmDelete('${assetType.api}', ${asset.id})"><i class="fas fa-trash"></i></button></td>`;
    if (isStock) {
        const stock = getStockCount(asset, meta.stock);
        const threshold = Number(meta.stock.threshold || 5);
        const lowStock = stock !== '-' && Number(stock) <= threshold;
        return `<tr><td><input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleAssetSelection(${asset.id})"></td><td data-label="Name"><div class="asset-name-cell"><strong>${escapeHtml(asset.name || 'Unnamed')}</strong><small>${escapeHtml(asset.otherserial || asset.serial || '')}</small></div></td><td data-label="Reference">${escapeHtml(asset.ref || asset.reference || asset.otherserial || '-')}</td><td data-label="Stock"><span class="${lowStock ? 'stock-low' : ''}">${stock}</span></td><td data-label="Stock health">${lowStock ? '<span class="status-badge maintenance"><span class="status-dot"></span>Low</span>' : '<span class="status-badge available"><span class="status-dot"></span>Healthy</span>'}</td><td data-label="Location">${escapeHtml(String(getAssetLocationLabel(asset, meta)))}</td><td data-label="Value">${value}</td><td data-label="Modified">${formatRelativeDate(asset.date_mod || asset.date_creation)}</td>${actions}</tr>`;
    }
    const assigned = getAssetUserId(asset);
    return `<tr><td><input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleAssetSelection(${asset.id})"></td><td data-label="Asset"><div class="asset-name-cell"><strong>${escapeHtml(asset.name || 'Unnamed')}</strong><small>${escapeHtml(asset.serial || asset.otherserial || `GLPI #${asset.id}`)}</small></div></td><td data-label="Status">${getStatusBadge(asset)}</td><td data-label="Assigned to"><span class="assignee-cell"><i class="fas fa-user"></i>${escapeHtml(getUserDisplayName(assigned))}</span></td><td data-label="Location">${escapeHtml(String(getAssetLocationLabel(asset, meta)))}</td><td data-label="Warranty">${renderWarrantyBadge(meta.financial.warrantyExpiry)}</td><td data-label="Value">${value}</td><td data-label="Modified">${formatRelativeDate(asset.date_mod || asset.date_creation)}</td>${actions}</tr>`;
}

function renderWarrantyBadge(expiry) {
    const category = getWarrantyCategory(expiry);
    const labels = { active: 'Active', expiring: 'Expiring', expired: 'Expired', unknown: 'Not recorded' };
    return `<span class="warranty-badge ${category}" title="${expiry ? escapeAttribute(formatDate(expiry)) : 'No warranty date'}"><i class="fas fa-shield-halved"></i>${labels[category]}</span>`;
}

function updatePagination(total = state.filteredAssets.length) {
    const totalPages = Math.max(1, Math.ceil(total / state.itemsPerPage));
    const start = total ? (state.currentPage - 1) * state.itemsPerPage + 1 : 0;
    const end = Math.min(state.currentPage * state.itemsPerPage, total);
    document.getElementById('paginationInfo').textContent = `Showing ${start}–${end} of ${total}`;
    document.getElementById('currentPageDisplay').textContent = `${state.currentPage} / ${totalPages}`;
    document.getElementById('prevPageBtn').disabled = state.currentPage <= 1;
    document.getElementById('nextPageBtn').disabled = state.currentPage >= totalPages;
}

function updateSelectionBar() {
    const count = state.selectedAssets.size;
    const selectedCount = document.getElementById('selectedCount');
    const bar = document.getElementById('bulkActionsBar');
    if (selectedCount) selectedCount.textContent = count;
    if (bar) bar.style.display = count ? 'flex' : 'none';
}

window.prevPage = function() { if (state.currentPage > 1) { state.currentPage--; renderAssetTable(); } };
window.nextPage = function() { if (state.currentPage < Math.ceil(state.filteredAssets.length / state.itemsPerPage)) { state.currentPage++; renderAssetTable(); } };
window.filterAssets = function() { state.currentPage = 1; renderAssetTable(); };
window.changePageSize = function() { state.itemsPerPage = Number(document.getElementById('pageSizeFilter')?.value || 10); state.currentPage = 1; renderAssetTable(); };
window.resetAssetFilters = function() {
    ['searchFilter', 'statusFilter', 'assignmentFilter', 'locationFilter', 'warrantyFilter'].forEach(id => { const element = document.getElementById(id); if (element) element.value = ''; });
    const sort = document.getElementById('sortFilter'); if (sort) sort.value = 'modified_desc';
    state.currentPage = 1; renderAssetTable();
};
window.toggleAssetSelection = function(id) { const numeric = Number(id); state.selectedAssets.has(numeric) ? state.selectedAssets.delete(numeric) : state.selectedAssets.add(numeric); updateSelectionBar(); };
window.toggleHeaderCheckbox = function() { const checked = document.getElementById('headerCheckbox')?.checked; const start = (state.currentPage - 1) * state.itemsPerPage; state.filteredAssets.slice(start, start + state.itemsPerPage).forEach(asset => checked ? state.selectedAssets.add(Number(asset.id)) : state.selectedAssets.delete(Number(asset.id))); renderAssetTable(); };
window.clearSelection = function() { state.selectedAssets.clear(); renderAssetTable(); };

async function populateAssignUsers() {
    const select = document.getElementById('assignUserSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Loading users...</option>';
    await ensureUsersLoaded(true);
    select.innerHTML = '<option value="">Choose a user...</option>' + state.users.map(user => `<option value="${user.id}">${escapeHtml(getUserDisplayName(user.id))}</option>`).join('');
}

async function showAssignModal() {
    state.assignMode = 'bulk';
    state.assignTarget = null;
    if (!state.selectedAssets.size) return showToast('Select at least one asset first.', 'warning');
    document.getElementById('assignAssetGroup').style.display = 'none';
    document.getElementById('assignDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('assignDueDate').value = '';
    document.getElementById('assignNotes').value = '';
    await populateAssignUsers();
    showModal('assignModal');
}
window.showAssignModal = showAssignModal;

async function showQuickAssignModal() {
    state.assignMode = 'quick';
    state.assignTarget = null;
    if (!state.dashboardAssets.length) {
        await hydrateAllAssetMeta();
        await loadDashboardStats();
    }
    const available = state.dashboardAssets.filter(asset => OPERATIONAL_ASSET_APIS.has(asset.assetType) && normalizeAssetStatus(asset) === 0 && !getAssetUserId(asset));
    const group = document.getElementById('assignAssetGroup');
    const select = document.getElementById('assignAssetSelect');
    group.style.display = '';
    select.innerHTML = '<option value="">Choose available equipment...</option>' + available.map(asset => `<option value="${asset.assetType}:${asset.id}">${escapeHtml(asset.name || 'Unnamed')} · ${escapeHtml(getAssetTypeLabel(asset.assetType))}</option>`).join('');
    document.getElementById('assignDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('assignDueDate').value = '';
    document.getElementById('assignNotes').value = '';
    await populateAssignUsers();
    showModal('assignModal');
}
window.showQuickAssignModal = showQuickAssignModal;

async function showAssignViewedAsset() {
    if (!state.viewedAsset) return;
    state.assignMode = 'single';
    state.assignTarget = { apiType: state.viewedAsset.apiType, id: state.viewedAsset.id };
    document.getElementById('assignAssetGroup').style.display = 'none';
    document.getElementById('assignDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('assignDueDate').value = '';
    document.getElementById('assignNotes').value = '';
    await populateAssignUsers();
    showModal('assignModal');
}
window.showAssignViewedAsset = showAssignViewedAsset;

async function handleAssignUser(event) {
    event.preventDefault();
    const userId = Number(document.getElementById('assignUserSelect').value || 0);
    if (!userId) return showToast('Choose a user.', 'warning');
    const userName = getUserDisplayName(userId);
    const assignedAt = document.getElementById('assignDate').value || new Date().toISOString().slice(0, 10);
    const dueDate = document.getElementById('assignDueDate').value || '';
    const notes = document.getElementById('assignNotes').value.trim();
    let targets = [];
    if (state.assignMode === 'quick') {
        const value = document.getElementById('assignAssetSelect').value;
        if (!value) return showToast('Choose equipment to assign.', 'warning');
        const [apiType, id] = value.split(':');
        targets = [{ apiType, id: Number(id) }];
    } else if (state.assignMode === 'single' && state.assignTarget) {
        targets = [state.assignTarget];
    } else {
        const assetType = ASSET_TYPES[state.currentAssetType];
        targets = [...state.selectedAssets].map(id => ({ apiType: assetType.api, id: Number(id) }));
    }
    if (!targets.length) return showToast('No assets selected.', 'warning');

    const submit = event.submitter;
    if (submit) submit.disabled = true;
    try {
        await Promise.all(targets.map(async target => {
            await glpi.updateItem(target.apiType, target.id, { users_id: userId, states_id: 1 });
            const meta = getAssetMeta(target.apiType, target.id);
            const assignments = meta.assignments.map(record => ({ ...record, active: false, returnedAt: record.returnedAt || assignedAt }));
            assignments.unshift({ id: `${Date.now()}-${target.id}`, userId, userName, assignedAt, dueDate, notes, active: true });
            await saveAssetMeta(target.apiType, target.id, { assignments });
            await appendAssetActivity(target.apiType, target.id, { type: 'assigned', title: `Assigned to ${userName}`, description: notes || (dueDate ? `Expected return ${formatDate(dueDate)}` : '') });
        }));
        showToast(`${targets.length} asset${targets.length === 1 ? '' : 's'} assigned to ${userName}.`, 'success');
        closeModal('assignModal');
        state.selectedAssets.clear();
        if (state.currentView === 'dashboard') await loadDashboard();
        else if (state.currentAssetType) await loadAssetList(state.currentAssetType);
        if (state.viewedAsset && targets.some(target => target.apiType === state.viewedAsset.apiType && Number(target.id) === Number(state.viewedAsset.id))) await viewAsset(state.viewedAsset.apiType, state.viewedAsset.id);
    } catch (error) {
        showToast(formatApiError(error, 'Assignment failed.'), 'error');
    } finally {
        if (submit) submit.disabled = false;
    }
}

async function unassignViewedAsset() {
    if (!state.viewedAsset) return;
    openConfirmation({
        title: 'Return asset to inventory',
        message: `Remove the current assignment from “${state.viewedAsset.name}” and mark it available?`,
        confirmLabel: 'Return asset',
        danger: false,
        onConfirm: async () => {
            const { apiType, id } = state.viewedAsset;
            await glpi.updateItem(apiType, id, { users_id: 0, states_id: 0 });
            const meta = getAssetMeta(apiType, id);
            const returnedAt = new Date().toISOString();
            const assignments = meta.assignments.map((record, index) => index === 0 && record.active ? { ...record, active: false, returnedAt } : record);
            await saveAssetMeta(apiType, id, { assignments });
            await appendAssetActivity(apiType, id, { type: 'unassigned', title: 'Returned to available inventory', description: 'The user assignment was removed.' });
            showToast('Asset returned to inventory.', 'success');
            await viewAsset(apiType, id);
        }
    });
}
window.unassignViewedAsset = unassignViewedAsset;

async function bulkSetStatus(status) {
    if (!state.selectedAssets.size) return;
    const assetType = ASSET_TYPES[state.currentAssetType];
    const label = STATUS_MAP[status]?.label || `State ${status}`;
    try {
        await Promise.all([...state.selectedAssets].map(async id => {
            await glpi.updateItem(assetType.api, id, { states_id: Number(status), ...(Number(status) === 0 ? { users_id: 0 } : {}) });
            await appendAssetActivity(assetType.api, id, { type: Number(status) === 3 ? 'maintenance' : 'status', title: `Status changed to ${label}`, description: 'Updated through a bulk action.' });
        }));
        showToast(`${state.selectedAssets.size} asset(s) marked ${label.toLowerCase()}.`, 'success');
        state.selectedAssets.clear();
        await loadAssetList(state.currentAssetType);
    } catch (error) {
        showToast(formatApiError(error), 'error');
    }
}
window.bulkSetStatus = bulkSetStatus;

window.exportSelectedAssets = function() {
    const assetType = ASSET_TYPES[state.currentAssetType];
    const rows = state.assets.filter(asset => state.selectedAssets.has(Number(asset.id))).map(asset => assetToExportRow(asset, assetType.api, assetType.label));
    exportToCSV(rows, `${assetType.name}_Selected`);
};

function bulkDelete() {
    const count = state.selectedAssets.size;
    if (!count) return;
    openConfirmation({
        title: `Delete ${count} asset${count === 1 ? '' : 's'}?`,
        message: 'This removes the selected GLPI records. This action cannot be undone.',
        confirmLabel: `Delete ${count}`,
        danger: true,
        onConfirm: async () => {
            const assetType = ASSET_TYPES[state.currentAssetType];
            const results = await Promise.allSettled([...state.selectedAssets].map(id => glpi.deleteItem(assetType.api, id)));
            const failed = results.filter(result => result.status === 'rejected').length;
            state.selectedAssets.clear();
            await loadAssetList(state.currentAssetType);
            if (failed) showToast(`${count - failed} deleted; ${failed} could not be deleted.`, 'warning');
            else showToast(`${count} asset${count === 1 ? '' : 's'} deleted.`, 'success');
        }
    });
}
window.bulkDelete = bulkDelete;

function openConfirmation({ title, message, confirmLabel = 'Confirm', danger = true, onConfirm }) {
    document.getElementById('deleteModalTitle').textContent = title;
    document.getElementById('deleteMessage').textContent = message;
    const button = document.getElementById('confirmDeleteBtn');
    button.textContent = confirmLabel;
    button.className = danger ? 'btn-danger' : 'btn-primary';
    button.onclick = async () => {
        button.disabled = true;
        try {
            await onConfirm();
            closeModal('deleteModal');
        } catch (error) {
            showToast(formatApiError(error), 'error');
        } finally {
            button.disabled = false;
        }
    };
    showModal('deleteModal');
}

function confirmDelete(apiType, id, name = '') {
    const assetName = name || state.assets.find(asset => Number(asset.id) === Number(id))?.name || state.viewedAsset?.name || `Asset #${id}`;
    openConfirmation({
        title: 'Delete asset?',
        message: `Delete “${assetName}”? This action cannot be undone.`,
        confirmLabel: 'Delete asset',
        danger: true,
        onConfirm: async () => {
            await glpi.deleteItem(apiType, id);
            showToast('Asset deleted.', 'success');
            if (state.currentView === 'dashboard') await loadDashboard();
            else if (state.currentAssetType) await loadAssetList(state.currentAssetType);
        }
    });
}
window.confirmDelete = confirmDelete;

async function viewAsset(apiType, id) {
    try {
        const item = await glpi.getItem(apiType, id);
        item.assetType = apiType;
        await Promise.all([hydrateAssetMeta(apiType, id), ensureUsersLoaded()]);
        state.viewedAsset = { apiType, id: Number(id), name: item.name || 'Asset', item };
        const meta = getAssetMeta(apiType, id);
        const assignedUserId = getAssetUserId(item);
        document.getElementById('viewModalTitle').textContent = item.name || 'Asset details';
        document.getElementById('assetDetailHero').innerHTML = `
            <div class="asset-hero-icon"><i class="fas ${assetIconForType(apiType)}"></i></div>
            <div class="asset-hero-copy"><span class="eyebrow">${escapeHtml(getAssetTypeLabel(apiType))}</span><h3>${escapeHtml(item.name || 'Unnamed asset')}</h3><div class="asset-hero-meta">${getStatusBadge(item)}<span><i class="fas fa-barcode"></i>${escapeHtml(item.serial || item.otherserial || `GLPI #${item.id}`)}</span><span><i class="fas fa-location-dot"></i>${escapeHtml(String(getAssetLocationLabel(item, meta)))}</span></div></div>
            <div class="asset-hero-actions"><button class="btn-secondary btn-sm" onclick="showAssignViewedAsset()"><i class="fas fa-user-plus"></i> Assign</button><button class="btn-primary btn-sm" onclick="closeModal('viewModal');editAsset('${apiType}',${id})"><i class="fas fa-pen"></i> Edit</button></div>
        `;
        document.getElementById('assetDetailsTab').innerHTML = `
            <div class="detail-grid">
                <div class="detail-section"><h3>Identification</h3>${detailRow('Asset name', item.name || 'N/A')}${detailRow('Serial number', item.serial || 'N/A')}${detailRow('Inventory number', item.otherserial || 'N/A')}${detailRow('GLPI ID', item.id)}</div>
                <div class="detail-section"><h3>Ownership</h3>${detailRow('Assigned to', getUserDisplayName(assignedUserId))}${detailRow('Location', getAssetLocationLabel(item, meta))}${detailRow('Status', STATUS_MAP[normalizeAssetStatus(item)]?.label || normalizeAssetStatus(item))}</div>
                <div class="detail-section"><h3>Lifecycle</h3>${detailRow('Created', formatDate(item.date_creation))}${detailRow('Last modified', formatDate(item.date_mod))}${detailRow('Warranty', getWarrantyStatus(meta.financial.warrantyExpiry).label)}</div>
                <div class="detail-section"><h3>Classification</h3>${detailRow('Type', item.type || item.computertypes_id || 'N/A')}${detailRow('Model', item.model_name || item.computermodels_id || 'N/A')}${detailRow('Supplier', meta.financial.supplier || 'N/A')}</div>
            </div>
            ${item.comment ? `<div class="detail-section detail-comments"><h3>Comments</h3><p>${escapeHtml(item.comment)}</p></div>` : ''}
        `;
        renderFinancialTab(meta.financial);
        renderAssignmentTab(item, meta);
        renderMaintenanceTab(item, meta);

        const inventoryTabButton = document.getElementById('assetInventoryTabButton');
        const inventoryTab = document.getElementById('assetInventoryTab');

        if (apiType === 'Computer') {
            if (inventoryTabButton) inventoryTabButton.style.display = '';
            if (inventoryTab) {
                inventoryTab.innerHTML = `
                    <div class="inventory-tab-loading">
                        <div class="spinner"></div>
                        <p>Loading computer inventory...</p>
                    </div>
                `;
            }
            loadViewedComputerInventory(id);
        } else {
            if (inventoryTabButton) inventoryTabButton.style.display = 'none';
            if (inventoryTab) inventoryTab.innerHTML = '';
            state.viewedComputerInventory = null;
        }

        renderDocumentsList(apiType, id);
        renderActivityTimeline(item, meta);
        switchAssetTab('details');
        showModal('viewModal');
    } catch (error) {
        showToast(formatApiError(error, 'Unable to open the asset.'), 'error');
    }
}
window.viewAsset = viewAsset;


async function loadViewedComputerInventory(id) {
    const container = document.getElementById('assetInventoryTab');
    if (!container) return;

    try {
        const inventory = await glpi.getComputerInventory(id);

        if (
            !state.viewedAsset
            || state.viewedAsset.apiType !== 'Computer'
            || Number(state.viewedAsset.id) !== Number(id)
        ) {
            return;
        }

        state.viewedComputerInventory = inventory;
        renderViewedComputerInventory(inventory);
    } catch (error) {
        container.innerHTML = `
            <div class="empty-state compact error-state">
                <i class="fas fa-triangle-exclamation"></i>
                <h3>Inventory unavailable</h3>
                <p>${escapeHtml(formatApiError(
                    error,
                    'Unable to load GLPI Agent inventory.'
                ))}</p>
                <button class="btn-secondary btn-sm"
                    onclick="loadViewedComputerInventory(${Number(id)})">
                    <i class="fas fa-rotate"></i> Retry
                </button>
            </div>
        `;
    }
}
window.loadViewedComputerInventory = loadViewedComputerInventory;

function renderViewedComputerInventory(inventory) {
    const container = document.getElementById('assetInventoryTab');
    if (!container) return;

    const computer = inventory.computer || {};
    const agent = inventory.agent || null;
    const health = inventory.health || {};
    const operatingSystems = inventory.operatingSystems || [];
    const disks = inventory.disks || [];
    const antivirus = inventory.antivirus || [];
    const software = inventory.software || [];

    const primaryOs = operatingSystems[0] || {};
    const inventoryDate = health.lastContact || health.lastInventory;
    const diskWarningCount = disks.filter(
        disk => disk.status === 'warning' || disk.status === 'critical'
    ).length;

    container.innerHTML = `
        <div class="inventory-summary-grid">
            ${inventoryMetricCard(
                'Agent',
                agent ? 'Connected' : 'Not connected',
                agent ? 'fa-circle-check' : 'fa-circle-xmark',
                agent ? 'healthy' : 'critical'
            )}
            ${inventoryMetricCard(
                'Inventory status',
                inventoryHealthLabel(health.inventoryStatus),
                'fa-satellite-dish',
                health.inventoryStatus
            )}
            ${inventoryMetricCard(
                'Disk health',
                inventoryHealthLabel(health.diskStatus),
                'fa-hard-drive',
                health.diskStatus
            )}
            ${inventoryMetricCard(
                'Installed software',
                String(health.softwareCount ?? software.length),
                'fa-layer-group',
                'neutral'
            )}
        </div>

        <div class="inventory-section-grid">
            <section class="inventory-panel">
                <div class="inventory-panel-heading">
                    <div>
                        <span class="eyebrow">GLPI Agent</span>
                        <h3>Reporting information</h3>
                    </div>
                    ${inventoryHealthChip(
                        agent ? health.inventoryStatus : 'not-reported'
                    )}
                </div>
                <div class="detail-grid inventory-detail-grid">
                    <div class="detail-section">
                        ${detailRow('Agent name', agent?.name || 'Not registered')}
                        ${detailRow('Agent version', agent?.version || 'N/A')}
                        ${detailRow('Agent tag', agent?.tag || 'N/A')}
                        ${detailRow('Remote address', agent?.remote_addr || 'N/A')}
                    </div>
                    <div class="detail-section">
                        ${detailRow('Last contact', formatDate(inventoryDate))}
                        ${detailRow('Last inventory', formatDate(health.lastInventory))}
                        ${detailRow('Last boot', formatDate(health.lastBoot))}
                        ${detailRow(
                            'Dynamic inventory',
                            computer.is_dynamic ? 'Yes' : 'No'
                        )}
                    </div>
                </div>
            </section>

            <section class="inventory-panel">
                <div class="inventory-panel-heading">
                    <div>
                        <span class="eyebrow">Operating system</span>
                        <h3>${escapeHtml(primaryOs.name || 'Not reported')}</h3>
                    </div>
                    <i class="fas fa-desktop inventory-panel-icon"></i>
                </div>
                ${
                    operatingSystems.length
                        ? operatingSystems.map(os => `
                            <div class="inventory-os-card">
                                ${detailRow('Version', os.version || 'N/A')}
                                ${detailRow('Architecture', os.architecture || 'N/A')}
                                ${detailRow('Kernel', os.kernel || 'N/A')}
                                ${detailRow('Edition', os.edition || 'N/A')}
                                ${detailRow('Installed', formatDate(os.installDate))}
                            </div>
                        `).join('')
                        : `
                            <div class="empty-state compact">
                                <p>No operating-system inventory was reported.</p>
                            </div>
                        `
                }
            </section>
        </div>

        <section class="inventory-panel">
            <div class="inventory-panel-heading">
                <div>
                    <span class="eyebrow">Storage health</span>
                    <h3>Disks and volumes</h3>
                </div>
                <span class="inventory-panel-summary">
                    ${diskWarningCount
                        ? `${diskWarningCount} need attention`
                        : `${disks.length} reported`}
                </span>
            </div>
            <div class="table-container inventory-table-container">
                <table class="data-table inventory-data-table">
                    <thead>
                        <tr>
                            <th>Volume</th>
                            <th>Device</th>
                            <th>Total</th>
                            <th>Free</th>
                            <th>Used</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            disks.length
                                ? disks.map(disk => `
                                    <tr>
                                        <td>${escapeHtml(
                                            disk.mountpoint || disk.name || '-'
                                        )}</td>
                                        <td>${escapeHtml(disk.device || '-')}</td>
                                        <td>${formatInventoryMegabytes(
                                            disk.totalSizeMb
                                        )}</td>
                                        <td>${formatInventoryMegabytes(
                                            disk.freeSizeMb
                                        )}</td>
                                        <td>${
                                            disk.usedPercent === null
                                            || disk.usedPercent === undefined
                                                ? '-'
                                                : `${escapeHtml(
                                                    String(disk.usedPercent)
                                                )}%`
                                        }</td>
                                        <td>${inventoryHealthChip(disk.status)}</td>
                                    </tr>
                                `).join('')
                                : `
                                    <tr>
                                        <td colspan="6">
                                            <div class="empty-state compact">
                                                <p>No disk inventory was reported.</p>
                                            </div>
                                        </td>
                                    </tr>
                                `
                        }
                    </tbody>
                </table>
            </div>
        </section>

        <section class="inventory-panel">
            <div class="inventory-panel-heading">
                <div>
                    <span class="eyebrow">Endpoint protection</span>
                    <h3>Antivirus status</h3>
                </div>
                ${inventoryHealthChip(health.antivirusStatus)}
            </div>
            ${
                antivirus.length
                    ? `
                        <div class="inventory-antivirus-grid">
                            ${antivirus.map(product => `
                                <article class="inventory-antivirus-card">
                                    <div>
                                        <strong>${escapeHtml(product.name)}</strong>
                                        <small>${escapeHtml(
                                            product.version || 'Version unavailable'
                                        )}</small>
                                    </div>
                                    ${inventoryHealthChip(
                                        product.active && product.upToDate
                                            ? 'healthy'
                                            : 'warning'
                                    )}
                                    <p>
                                        Signatures:
                                        ${escapeHtml(
                                            product.signatureVersion || 'Not reported'
                                        )}
                                    </p>
                                </article>
                            `).join('')}
                        </div>
                    `
                    : `
                        <div class="inventory-empty-note">
                            <i class="fas fa-shield-halved"></i>
                            <div>
                                <strong>No antivirus data reported</strong>
                                <p>
                                    This can be normal for Linux machines. Windows
                                    endpoints should report registered antivirus
                                    products through GLPI Agent.
                                </p>
                            </div>
                        </div>
                    `
            }
        </section>

        <section class="inventory-panel">
            <div class="inventory-panel-heading software-heading">
                <div>
                    <span class="eyebrow">Software inventory</span>
                    <h3>Installed applications</h3>
                </div>
                <div class="inventory-software-tools">
                    <span id="viewedComputerSoftwareCount">
                        ${software.length} applications
                    </span>
                    <input
                        id="viewedComputerSoftwareSearch"
                        type="search"
                        placeholder="Search software, version or publisher..."
                        oninput="renderViewedComputerSoftware()"
                    >
                </div>
            </div>
            <div class="table-container inventory-software-table">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Software</th>
                            <th>Version</th>
                            <th>Architecture</th>
                            <th>Publisher</th>
                            <th>Source</th>
                        </tr>
                    </thead>
                    <tbody id="viewedComputerSoftwareTable"></tbody>
                </table>
            </div>
            <p class="inventory-result-note" id="viewedComputerSoftwareNote"></p>
        </section>
    `;

    renderViewedComputerSoftware();
}

function renderViewedComputerSoftware() {
    const tbody = document.getElementById('viewedComputerSoftwareTable');
    if (!tbody) return;

    const software = state.viewedComputerInventory?.software || [];
    const search = (
        document.getElementById('viewedComputerSoftwareSearch')?.value || ''
    ).trim().toLowerCase();

    const filtered = software.filter(item => {
        if (!search) return true;

        return [
            item.name,
            item.version,
            item.architecture,
            item.publisher
        ].some(value => String(value || '').toLowerCase().includes(search));
    });

    const maximumVisible = 200;
    const visible = filtered.slice(0, maximumVisible);
    const count = document.getElementById('viewedComputerSoftwareCount');
    const note = document.getElementById('viewedComputerSoftwareNote');

    if (count) {
        count.textContent = search
            ? `${filtered.length} matching applications`
            : `${software.length} applications`;
    }

    tbody.innerHTML = visible.length
        ? visible.map(item => `
            <tr>
                <td>
                    <strong>${escapeHtml(item.name || 'Unknown software')}</strong>
                </td>
                <td>${escapeHtml(item.version || '-')}</td>
                <td>${escapeHtml(item.architecture || '-')}</td>
                <td>${escapeHtml(item.publisher || '-')}</td>
                <td>
                    ${item.isDynamic
                        ? '<span class="record-chip complete">Agent</span>'
                        : '<span class="record-chip">Manual</span>'}
                </td>
            </tr>
        `).join('')
        : `
            <tr>
                <td colspan="5">
                    <div class="empty-state compact">
                        <i class="fas fa-magnifying-glass"></i>
                        <h3>No matching software</h3>
                        <p>Try a different application name or version.</p>
                    </div>
                </td>
            </tr>
        `;

    if (note) {
        note.textContent = filtered.length > maximumVisible
            ? `Showing the first ${maximumVisible} of ${filtered.length} results. Refine the search to narrow the list.`
            : `${filtered.length} result${filtered.length === 1 ? '' : 's'} shown.`;
    }
}
window.renderViewedComputerSoftware = renderViewedComputerSoftware;

function inventoryMetricCard(label, value, icon, status = 'neutral') {
    const normalized = normalizeInventoryHealth(status);

    return `
        <article class="inventory-metric-card ${escapeAttribute(normalized)}">
            <div class="inventory-metric-icon">
                <i class="fas ${escapeAttribute(icon)}"></i>
            </div>
            <div>
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
            </div>
        </article>
    `;
}

function inventoryHealthChip(status) {
    const normalized = normalizeInventoryHealth(status);

    return `
        <span class="inventory-health-chip ${escapeAttribute(normalized)}">
            ${escapeHtml(inventoryHealthLabel(status))}
        </span>
    `;
}

function normalizeInventoryHealth(status) {
    const normalized = String(status || 'unknown')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    return normalized || 'unknown';
}

function inventoryHealthLabel(status) {
    const normalized = normalizeInventoryHealth(status);
    const labels = {
        healthy: 'Healthy',
        warning: 'Warning',
        critical: 'Critical',
        stale: 'Stale',
        never: 'Never reported',
        'never-reported': 'Never reported',
        'not-reported': 'Not reported',
        unknown: 'Unknown',
        neutral: 'Available'
    };

    return labels[normalized]
        || normalized
            .split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
}

function formatInventoryMegabytes(value) {
    const megabytes = Number(value);

    if (!Number.isFinite(megabytes) || megabytes <= 0) {
        return '-';
    }

    if (megabytes >= 1024) {
        const gigabytes = megabytes / 1024;
        return `${gigabytes >= 100
            ? gigabytes.toFixed(0)
            : gigabytes.toFixed(1)} GB`;
    }

    return `${megabytes.toFixed(0)} MB`;
}

function detailRow(label, value) {
    return `<div class="detail-item"><span class="detail-label">${escapeHtml(label)}</span><span class="detail-value">${escapeHtml(String(value ?? 'N/A'))}</span></div>`;
}

function assetIconForType(apiType) {
    const view = Object.entries(ASSET_TYPES).find(([, config]) => config.api === apiType)?.[0];
    return DASHBOARD_UI[view]?.icon || 'fa-box';
}

function renderAssignmentTab(item, meta) {
    const active = meta.assignments.find(record => record.active) || null;
    const history = meta.assignments;
    document.getElementById('assetAssignmentTab').innerHTML = `
        <div class="tab-toolbar"><div><span class="eyebrow">Custody</span><h3>Assignment history</h3></div><div>${active || getAssetUserId(item) ? '<button class="btn-secondary btn-sm" onclick="unassignViewedAsset()"><i class="fas fa-rotate-left"></i> Return asset</button>' : ''}<button class="btn-primary btn-sm" onclick="showAssignViewedAsset()"><i class="fas fa-user-plus"></i> Assign</button></div></div>
        ${history.length ? `<div class="history-list">${history.map(record => `<article class="history-card ${record.active ? 'active-record' : ''}"><div class="history-icon"><i class="fas fa-user"></i></div><div><div class="history-heading"><strong>${escapeHtml(record.userName || `User #${record.userId}`)}</strong>${record.active ? '<span class="record-chip">Current</span>' : ''}</div><p>${escapeHtml(record.notes || 'No handover notes')}</p><small>Assigned ${formatDate(record.assignedAt)}${record.dueDate ? ` · Due ${formatDate(record.dueDate)}` : ''}${record.returnedAt ? ` · Returned ${formatDate(record.returnedAt)}` : ''}</small></div></article>`).join('')}</div>` : '<div class="empty-state compact"><i class="fas fa-user-clock"></i><h3>No assignment history</h3><p>Assignments made from this dashboard will be recorded here.</p></div>'}
    `;
}

function renderMaintenanceTab(item, meta) {
    document.getElementById('assetMaintenanceTab').innerHTML = `
        <div class="tab-toolbar"><div><span class="eyebrow">Service lifecycle</span><h3>Maintenance history</h3></div></div>
        <form class="maintenance-form" onsubmit="addMaintenanceRecord(event)">
            <div class="form-row"><div class="form-group"><label for="maintenanceDate">Service date</label><input type="date" id="maintenanceDate" value="${new Date().toISOString().slice(0,10)}" required></div><div class="form-group"><label for="maintenanceType">Service type</label><select id="maintenanceType"><option>Repair</option><option>Preventive maintenance</option><option>Inspection</option><option>Upgrade</option><option>Cleaning</option></select></div></div>
            <div class="form-row"><div class="form-group"><label for="maintenanceVendor">Vendor / technician</label><input type="text" id="maintenanceVendor"></div><div class="form-group"><label for="maintenanceCost">Cost</label><input type="number" id="maintenanceCost" min="0" step="0.01"></div></div>
            <div class="form-row"><div class="form-group"><label for="maintenanceNextDue">Next service due</label><input type="date" id="maintenanceNextDue"></div><div class="form-group checkbox-group"><label><input type="checkbox" id="maintenanceMarkStatus" checked> Mark asset under maintenance</label></div></div>
            <div class="form-group"><label for="maintenanceNotes">Work performed / issue</label><textarea id="maintenanceNotes" rows="3" required></textarea></div>
            <div class="form-actions"><button class="btn-primary btn-sm" type="submit"><i class="fas fa-plus"></i> Add maintenance record</button></div>
        </form>
        ${meta.maintenance.length ? `<div class="history-list maintenance-history">${meta.maintenance.map(record => `<article class="history-card ${record.completedAt ? '' : 'active-record'}"><div class="history-icon"><i class="fas fa-screwdriver-wrench"></i></div><div><div class="history-heading"><strong>${escapeHtml(record.type || 'Maintenance')}</strong>${record.completedAt ? '<span class="record-chip complete">Completed</span>' : '<span class="record-chip">Open</span>'}</div><p>${escapeHtml(record.notes || 'No notes')}</p><small>${formatDate(record.date)}${record.vendor ? ` · ${escapeHtml(record.vendor)}` : ''}${record.cost ? ` · ${formatMoney(record.cost)}` : ''}${record.nextDue ? ` · Next due ${formatDate(record.nextDue)}` : ''}</small>${!record.completedAt ? `<button class="text-button maintenance-complete" onclick="completeMaintenanceRecord('${escapeAttribute(record.id)}')"><i class="fas fa-check"></i> Mark complete</button>` : ''}</div></article>`).join('')}</div>` : '<div class="empty-state compact"><i class="fas fa-screwdriver-wrench"></i><h3>No maintenance records</h3><p>Add repairs, inspections and preventive servicing above.</p></div>'}
    `;
}

async function addMaintenanceRecord(event) {
    event.preventDefault();
    if (!state.viewedAsset) return;
    const record = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        date: document.getElementById('maintenanceDate').value,
        type: document.getElementById('maintenanceType').value,
        vendor: document.getElementById('maintenanceVendor').value.trim(),
        cost: document.getElementById('maintenanceCost').value,
        nextDue: document.getElementById('maintenanceNextDue').value,
        notes: document.getElementById('maintenanceNotes').value.trim(),
        createdAt: new Date().toISOString(),
        completedAt: ''
    };
    const { apiType, id } = state.viewedAsset;
    try {
        const meta = getAssetMeta(apiType, id);
        await saveAssetMeta(apiType, id, { maintenance: [record, ...meta.maintenance] });
        if (document.getElementById('maintenanceMarkStatus').checked) await glpi.updateItem(apiType, id, { states_id: 3 });
        await appendAssetActivity(apiType, id, { type: 'maintenance', title: `${record.type} recorded`, description: record.notes });
        showToast('Maintenance record added.', 'success');
        await viewAsset(apiType, id);
        switchAssetTab('maintenance');
    } catch (error) {
        showToast(formatApiError(error), 'error');
    }
}
window.addMaintenanceRecord = addMaintenanceRecord;

async function completeMaintenanceRecord(recordId) {
    if (!state.viewedAsset) return;
    const { apiType, id } = state.viewedAsset;
    try {
        const meta = getAssetMeta(apiType, id);
        const maintenance = meta.maintenance.map(record => String(record.id) === String(recordId) ? { ...record, completedAt: new Date().toISOString() } : record);
        await saveAssetMeta(apiType, id, { maintenance });
        await glpi.updateItem(apiType, id, { states_id: 0 });
        await appendAssetActivity(apiType, id, { type: 'maintenance', title: 'Maintenance completed', description: 'Asset returned to available inventory.' });
        showToast('Maintenance marked complete.', 'success');
        await viewAsset(apiType, id);
        switchAssetTab('maintenance');
    } catch (error) {
        showToast(formatApiError(error), 'error');
    }
}
window.completeMaintenanceRecord = completeMaintenanceRecord;

function renderActivityTimeline(item, meta) {
    const entries = [...meta.activities];
    if (item.date_mod) entries.push({ id: 'modified', type: 'updated', title: 'Last GLPI modification', description: 'The GLPI asset record was updated.', createdAt: item.date_mod });
    if (item.date_creation) entries.push({ id: 'created', type: 'created', title: 'Asset created', description: 'The asset was added to GLPI.', createdAt: item.date_creation });
    entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    document.getElementById('assetTimeline').innerHTML = entries.length ? entries.map(entry => `<div class="timeline-item"><div class="timeline-marker"><i class="fas ${activityIcon(entry.type)}"></i></div><div class="timeline-date">${formatRelativeDate(entry.createdAt)}</div><div class="timeline-title">${escapeHtml(entry.title)}</div><div class="timeline-desc">${escapeHtml(entry.description || entry.actor || '')}</div></div>`).join('') : '<div class="empty-state compact"><h3>No activity recorded</h3></div>';
}

async function editAsset(apiType, id) {
    try {
        const item = await glpi.getItem(apiType, id);
        await hydrateAssetMeta(apiType, id);
        const meta = getAssetMeta(apiType, id);
        state.editAssetId = Number(id);
        state.editAssetType = apiType;
        document.getElementById('createModalTitle').textContent = `Edit ${item.name || 'Asset'}`;
        document.getElementById('assetName').value = item.name || '';
        document.getElementById('assetStatus').value = normalizeAssetStatus(item);
        document.getElementById('assetType').value = item.type || '';
        document.getElementById('assetLocation').value = item.locations_id || meta.importSource.location || '';
        document.getElementById('assetSerial').value = item.serial || '';
        document.getElementById('assetInventory').value = item.otherserial || '';
        document.getElementById('assetComments').value = item.comment || '';
        fillFinancialForm(meta.financial);
        fillStockForm(meta.stock);
        showModal('createModal');
    } catch (error) {
        showToast(formatApiError(error), 'error');
    }
}
window.editAsset = editAsset;

async function handleCreateAsset(event) {
    event.preventDefault();
    const submit = event.submitter;
    if (submit) { submit.disabled = true; submit.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving'; }
    const data = {
        name: document.getElementById('assetName').value.trim(),
        states_id: Number(document.getElementById('assetStatus').value || 0),
        type: document.getElementById('assetType').value.trim(),
        serial: document.getElementById('assetSerial').value.trim(),
        otherserial: document.getElementById('assetInventory').value.trim(),
        comment: document.getElementById('assetComments').value.trim()
    };
    const locationValue = document.getElementById('assetLocation').value.trim();
    try {
        if (locationValue) {
            const locationId = isPositiveInteger(locationValue) ? Number(locationValue) : await resolveLocationId(locationValue);
            if (!locationId) throw new Error(`Unable to resolve location “${locationValue}”.`);
            data.locations_id = locationId;
        }
        const financial = readFinancialForm();
        const stock = readStockForm();
        if (state.editAssetId) {
            await glpi.updateItem(state.editAssetType, state.editAssetId, data);
            await saveAssetMeta(state.editAssetType, state.editAssetId, { financial, stock });
            await appendAssetActivity(state.editAssetType, state.editAssetId, { type: 'updated', title: 'Asset details updated', description: 'Core, financial or stock information changed.' });
            showToast('Asset updated successfully.', 'success');
        } else {
            const created = await glpi.createItem(state.editAssetType, data);
            const createdId = extractItemId(created);
            if (!createdId) throw new Error('GLPI created the item but did not return its ID.');
            await saveAssetMeta(state.editAssetType, createdId, { financial, stock });
            await appendAssetActivity(state.editAssetType, createdId, { type: 'created', title: 'Asset created', description: `${data.name} was registered in GLPI.` });
            showToast('Asset created successfully.', 'success');
        }
        closeModal('createModal');
        if (state.currentView === 'dashboard') await loadDashboard();
        else if (state.currentAssetType) await loadAssetList(state.currentAssetType);
    } catch (error) {
        showToast(formatApiError(error, 'The asset could not be saved.'), 'error');
    } finally {
        if (submit) { submit.disabled = false; submit.innerHTML = 'Save Asset'; }
    }
}

function setupWarrantyCalculator() {
    const purchase = document.getElementById('assetPurchaseDate');
    const months = document.getElementById('assetWarranty');
    const expiry = document.getElementById('assetWarrantyExpiry');
    const calculate = () => {
        if (!purchase?.value || !months?.value || expiry?.value) return;
        const date = new Date(`${purchase.value}T00:00:00`);
        date.setMonth(date.getMonth() + Number(months.value));
        if (!Number.isNaN(date.getTime())) expiry.value = date.toISOString().slice(0, 10);
    };
    purchase?.addEventListener('change', calculate);
    months?.addEventListener('change', calculate);
}

function setupDocumentDropZone() {
    const zone = document.querySelector('.document-upload');
    if (!zone) return;
    ['dragenter', 'dragover'].forEach(name => zone.addEventListener(name, event => { event.preventDefault(); zone.classList.add('dragging'); }));
    ['dragleave', 'drop'].forEach(name => zone.addEventListener(name, event => { event.preventDefault(); zone.classList.remove('dragging'); }));
    zone.addEventListener('drop', event => handleDocumentFiles([...(event.dataTransfer?.files || [])]));
}

window.handleDocumentUpload = function() {
    const input = document.getElementById('documentUpload');
    handleDocumentFiles([...(input?.files || [])]);
};

async function handleDocumentFiles(files) {
    if (!state.viewedAsset || !files.length) return;
    let saved = 0;
    let skipped = 0;
    for (const file of files) {
        if (file.size > ENHANCED_DOCUMENT_LIMIT_BYTES) { skipped++; continue; }
        try {
            const dataUrl = await fileToDataUrl(file);
            const document = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, name: file.name, size: file.size, type: file.type || 'application/octet-stream', uploadedAt: new Date().toISOString(), dataUrl };
            const remote = await glpi.saveDocument(state.viewedAsset.apiType, state.viewedAsset.id, document);
            const savedDocument = remote || document;
            const meta = getAssetMeta(state.viewedAsset.apiType, state.viewedAsset.id);
            await saveAssetMeta(state.viewedAsset.apiType, state.viewedAsset.id, { documents: [savedDocument, ...meta.documents.filter(item => String(item.id) !== String(savedDocument.id))] });
            await appendAssetActivity(state.viewedAsset.apiType, state.viewedAsset.id, { type: 'document', title: `Document uploaded: ${file.name}`, description: formatBytes(file.size) });
            saved++;
        } catch (error) {
            console.error(error);
            skipped++;
        }
    }
    const input = document.getElementById('documentUpload'); if (input) input.value = '';
    renderDocumentsList(state.viewedAsset.apiType, state.viewedAsset.id);
    showToast(`${saved} document${saved === 1 ? '' : 's'} uploaded${skipped ? `; ${skipped} skipped or failed` : ''}.`, skipped ? 'warning' : 'success');
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Unable to read file.'));
        reader.readAsDataURL(file);
    });
}

window.removeAssetDocument = function(apiType, id, docId) {
    const meta = getAssetMeta(apiType, id);
    const document = meta.documents.find(item => String(item.id) === String(docId));
    openConfirmation({
        title: 'Remove document?',
        message: `Remove “${document?.name || 'this document'}” from the asset?`,
        confirmLabel: 'Remove document',
        danger: true,
        onConfirm: async () => {
            await glpi.deleteDocument(apiType, id, docId);
            await saveAssetMeta(apiType, id, { documents: meta.documents.filter(item => String(item.id) !== String(docId)) });
            await appendAssetActivity(apiType, id, { type: 'document', title: `Document removed: ${document?.name || 'Document'}`, description: '' });
            renderDocumentsList(apiType, id);
            showToast('Document removed.', 'success');
        }
    });
};

window.switchAssetTab = function(tab) {
    document.querySelectorAll('#viewModal .tab-btn').forEach(button => button.classList.remove('active'));
    document.querySelectorAll('#viewModal .tab-content').forEach(content => { content.style.display = 'none'; });
    const button = document.querySelector(`#viewModal .tab-btn[onclick="switchAssetTab('${tab}')"]`);
    const content = document.getElementById(`asset${tab.charAt(0).toUpperCase()}${tab.slice(1)}Tab`);
    if (button) button.classList.add('active');
    if (content) content.style.display = 'block';
};

// Rebind event handlers and inline globals to the enhanced implementations.
window.loadDashboard = loadDashboard;
window.refreshDashboard = loadDashboard;
window.loadAssetList = loadAssetList;
window.renderAssetTable = renderAssetTable;
window.showAssignViewedAsset = showAssignViewedAsset;

async function checkAlerts() {
    state.alerts = [];
    const assets = state.dashboardAssets.length ? state.dashboardAssets : [];
    assets.forEach(asset => {
        const meta = getAssetMeta(asset.assetType, asset.id);
        if (normalizeAssetStatus(asset) === 3) {
            state.alerts.push({ type: 'danger', title: 'Asset under maintenance', desc: `${asset.name || 'Unnamed asset'} (${getAssetTypeLabel(asset.assetType)}) requires attention`, time: asset.date_mod || new Date().toISOString() });
        }
        const warranty = getWarrantyCategory(meta.financial.warrantyExpiry);
        if (warranty === 'expiring') {
            state.alerts.push({ type: 'warning', title: 'Warranty expiring', desc: `${asset.name || 'Unnamed asset'} warranty expires ${formatDate(meta.financial.warrantyExpiry)}`, time: new Date().toISOString() });
        } else if (warranty === 'expired') {
            state.alerts.push({ type: 'info', title: 'Warranty expired', desc: `${asset.name || 'Unnamed asset'} is no longer under warranty`, time: new Date().toISOString() });
        }
        if (meta.stock.quantity !== '' && Number(meta.stock.quantity) <= Number(meta.stock.threshold || 5)) {
            state.alerts.push({ type: 'warning', title: 'Low stock', desc: `${asset.name || 'Stock item'} is at or below its reorder threshold`, time: new Date().toISOString() });
        }
    });
    const dangerCount = state.alerts.filter(alert => alert.type === 'danger').length;
    const warningCount = state.alerts.filter(alert => alert.type === 'warning').length;
    const infoCount = state.alerts.filter(alert => alert.type === 'info').length;
    setTextIfPresent('warningCount', warningCount);
    setTextIfPresent('dangerCount', dangerCount);
    setTextIfPresent('infoCount', infoCount);
    const banner = document.getElementById('alertsBanner');
    if (banner) {
        const total = state.alerts.length;
        banner.style.display = total ? 'flex' : 'none';
        setTextIfPresent('alertsBannerText', `${total} item${total === 1 ? '' : 's'} need attention`);
    }
    updateNotificationBadge();
}
window.checkAlerts = checkAlerts;

function renderDocumentsList(apiType, id) {
    const documents = getAssetMeta(apiType, id).documents;
    const list = document.getElementById('documentsList');
    if (!list) return;
    if (!documents.length) {
        list.innerHTML = '<div class="document-empty"><i class="fas fa-folder-open"></i><strong>No documents attached</strong><span>Upload invoices, warranty documents, handover forms or service reports.</span></div>';
        return;
    }
    list.innerHTML = documents.map(doc => `
        <div class="document-item">
            <div class="doc-icon"><i class="fas ${documentIcon(doc.type)}"></i></div>
            <div class="doc-info"><div class="doc-name">${escapeHtml(doc.name || 'Document')}</div><div class="doc-meta">${formatBytes(doc.size)} • ${formatDate(doc.uploadedAt)}</div></div>
            <div class="doc-actions">
                <button onclick="downloadAssetDocument('${apiType}', ${id}, '${escapeAttribute(doc.id)}')" title="Download"><i class="fas fa-download"></i></button>
                <button class="delete" onclick="removeAssetDocument('${apiType}', ${id}, '${escapeAttribute(doc.id)}')" title="Remove"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function documentIcon(type = '') {
    if (/pdf/i.test(type)) return 'fa-file-pdf';
    if (/image/i.test(type)) return 'fa-file-image';
    if (/sheet|excel|csv/i.test(type)) return 'fa-file-excel';
    if (/word|document/i.test(type)) return 'fa-file-word';
    return 'fa-file-lines';
}

function assetToExportRow(asset, apiType, label = apiType) {
    const meta = getAssetMeta(apiType, asset.id);
    return {
        ItemType: label,
        GLPI_ID: asset.id || '',
        Name: asset.name || '',
        Serial: asset.serial || '',
        InventoryNumber: asset.otherserial || '',
        Status: STATUS_MAP[normalizeAssetStatus(asset)]?.label || normalizeAssetStatus(asset),
        AssignedTo: getUserDisplayName(getAssetUserId(asset)),
        Location: getAssetLocationLabel(asset, meta),
        Value: meta.financial.value || '',
        PurchaseDate: meta.financial.purchaseDate || '',
        WarrantyExpiry: meta.financial.warrantyExpiry || '',
        WarrantyStatus: getWarrantyCategory(meta.financial.warrantyExpiry),
        Supplier: meta.financial.supplier || '',
        Stock: meta.stock.quantity || '',
        LowStockThreshold: meta.stock.threshold || '',
        AssignmentRecords: meta.assignments.length,
        MaintenanceRecords: meta.maintenance.length,
        Documents: meta.documents.length,
        Modified: asset.date_mod || ''
    };
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;').replace(/\\/g, '&#92;');
}

function renderFinancialTab(financial) {
    const value = Number(financial.value || 0);
    const depreciated = calculateDepreciatedValue(value, financial.purchaseDate);
    const warranty = getWarrantyStatus(financial.warrantyExpiry);
    const container = document.getElementById('assetFinancialTab');
    if (!container) return;
    container.innerHTML = `
        <div class="financial-cards">
            <div class="financial-card"><div class="fin-label">Purchase value</div><div class="fin-value">${formatMoney(financial.value)}</div><div class="fin-date">${formatDate(financial.purchaseDate)}</div></div>
            <div class="financial-card"><div class="fin-label">Estimated current value</div><div class="fin-value">${formatMoney(depreciated)}</div><div class="fin-date">Five-year straight-line estimate</div></div>
            <div class="financial-card"><div class="fin-label">Warranty</div><div class="fin-value ${warranty.className}">${escapeHtml(warranty.label)}</div><div class="fin-date">${formatDate(financial.warrantyExpiry)}</div></div>
            <div class="financial-card"><div class="fin-label">Supplier</div><div class="fin-value">${escapeHtml(financial.supplier || '-')}</div><div class="fin-date">${escapeHtml(financial.orderNumber || 'No order number')}</div></div>
        </div>
    `;
}
