// Asset List



window.filterAssets = (...args) => renderAssetTable(...args);

// Assign



// Export
window.exportCurrentAssets = function() {
    const assetType = ASSET_TYPES[state.currentAssetType];
    exportToCSV(state.assets.map(a => assetToExportRow(a, assetType?.api || state.currentAssetType, assetType?.label || assetType?.name)), assetType?.label || assetType?.name || 'Assets');
};
window.exportAllAssets = async function() {
    showToast('Preparing...', 'info');
    const all = [];
    for (const assetType of Object.values(ASSET_TYPES).filter(type => type.api !== 'User' && type.api !== 'Location')) {
        try {
            const opts = assetType.api === 'Computer' ? { add_keys_names: ['computertypes_id'] } : {};
            const items = await glpi.getItems(assetType.api, opts);
            if (Array.isArray(items)) {
                const filtered = assetType.category ? items.filter(i => isAssetInCategory(i, assetType.category)) : items;
                all.push(...filtered.map(i => assetToExportRow(i, assetType.api, assetType.label || assetType.name)));
            }
        } catch {}
    }
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
window.exportReport = function() {
    const rows = state.filteredReportRows.length ? state.filteredReportRows : state.reportRows;
    if (!rows.length) return showToast('No report data to export', 'error');

    exportToCSV(rows.map(row => ({
        Asset: row.name,
        AssetTag: row.tag,
        SerialNumber: row.serial,
        Category: row.type,
        AssignedTo: row.assignedTo,
        Location: row.location,
        Status: STATUS_MAP[normalizeAssetStatus(row.asset)]?.label || `State ${normalizeAssetStatus(row.asset)}`,
        PurchaseDate: row.purchaseDate,
        AssetValue: row.value || '',
        WarrantyExpiry: row.warrantyExpiry,
        WarrantyStatus: row.warrantyCategory,
        LastModified: row.modified
    })), 'GLPI_Asset_Register');
};

// Asset CRUD




function showCreateModal(assetType = 'Computer') {
    state.editAssetId = null;
    const isLaptop = assetType === 'laptops' || assetType === 'Laptop';
    const isCpu = assetType === 'computers' || assetType === 'CPU' || (assetType === 'Computer' && state.currentAssetType === 'computers');
    const isUps = assetType === 'ups' || assetType === 'UPS' || (assetType === 'Peripheral' && state.currentAssetType === 'ups');
    const resolvedApiType = (isLaptop || isCpu) ? 'Computer' : (isUps ? 'Peripheral' : (ASSET_TYPES[assetType]?.api || assetType));
    state.editAssetType = resolvedApiType;

    const label = isLaptop ? 'Laptop' : (isCpu ? 'CPU' : (isUps ? 'UPS' : (ASSET_TYPES[assetType]?.label || ASSET_TYPES[assetType]?.name || resolvedApiType)));
    const pcidGroup = document.getElementById('assetPCIDGroup');
    if (pcidGroup) pcidGroup.style.display = ['Computer', 'Printer'].includes(resolvedApiType) ? '' : 'none';
    document.getElementById('createModalTitle').textContent = `Add New ${label}`;
    document.getElementById('createAssetForm').reset();
    const typeInput = document.getElementById('assetType');
    if (typeInput) {
        if (isLaptop) typeInput.value = 'Laptop';
        else if (isCpu) typeInput.value = 'Desktop';
        else if (isUps) typeInput.value = 'UPS';
    }
    fillFinancialForm({});
    fillPCIDForm();
    fillStockForm({});
    showModal('createModal');
}
window.showCreateModal = showCreateModal;




async function deleteAsset(apiType, id) {
    try {
        await glpi.deleteItem(apiType, id);
        showToast('Deleted!', 'success');
        closeModal('deleteModal');
        state.currentAssetType ? await loadAssetList(state.currentAssetType) : await loadDashboard();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}
window.deleteAsset = deleteAsset;


window.downloadAssetDocument = function(apiType, id, docId) {
    const doc = getAssetMeta(apiType, id).documents.find(item => String(item.id) === String(docId));
    if (!doc) return;
    const link = document.createElement('a');
    link.href = doc.dataUrl;
    link.download = doc.name;
    link.click();
};


// Tabs
