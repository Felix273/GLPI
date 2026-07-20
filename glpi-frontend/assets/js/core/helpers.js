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
        location: data.locations_id || data.location || '',
        defaultLocation: data.default_location || '',
        checkedOut: data.checked_out || data.assigned_to || '',
        assignedOffice: data.assigned_to || '',
        mappedUserId: Number(data.import_user_id) > 0 ? Number(data.import_user_id) : 0,
        userResolution: data.import_user_resolution || '',
        acquisitionYear: data.acquisition_year || '',
        sourceAssetType: data.itemtype || '',
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
function getStockCount(asset, stockMeta = {}) {
    return stockMeta.quantity || asset.stock || asset.quantity || asset.qty || asset.nb || asset.number || '-';
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

    const currency = state.systemSettings?.general?.currency || 'KES';

    try {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency,
            maximumFractionDigits: 2
        }).format(number);
    } catch {
        return `${currency} ${number.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    }
}
function formatBytes(bytes) {
    const number = Number(bytes || 0);
    if (number < 1024) return `${number} B`;
    if (number < 1024 * 1024) return `${(number / 1024).toFixed(1)} KB`;
    return `${(number / 1024 / 1024).toFixed(1)} MB`;
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
window.refreshDashboard = (...args) => loadDashboard(...args);
window.globalSearch = handleGlobalSearch;

document.querySelectorAll('.modal').forEach(modal => modal.addEventListener('click', event => {
    if (event.target !== modal) return;
    if (modal.id === 'loginModal' && !state.isLoggedIn) return;
    modal.classList.remove('show');
}));
document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.modal.show').forEach(modal => {
        if (modal.id === 'loginModal' && !state.isLoggedIn) return;
        modal.classList.remove('show');
    });
});
