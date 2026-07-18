// Reports
async function loadReports() {
    const table = document.getElementById('reportAssetsTable');
    if (!table) return;

    table.innerHTML = '<tr><td colspan="10"><div class="loading"><div class="spinner"></div></div></td></tr>';

    try {
        await hydrateAllAssetMeta();

        if (!state.users.length) {
            try {
                const users = await glpi.getItems('User');
                state.users = Array.isArray(users) ? users : [];
            } catch (error) {
                console.warn('Unable to load report users:', error);
            }
        }

        const results = await Promise.all(
            [...OPERATIONAL_ASSET_APIS].map(async apiType => {
                try {
                    const items = await glpi.getItems(apiType);
                    return (Array.isArray(items) ? items : []).map(item => ({
                        ...item,
                        assetType: apiType
                    }));
                } catch (error) {
                    console.warn(`Unable to load ${apiType} report records:`, error);
                    return [];
                }
            })
        );

        state.reportRows = results.flat().map(asset => {
            const meta = getAssetMeta(asset.assetType, asset.id);
            const status = normalizeAssetStatus(asset);
            const userId = getAssetUserId(asset);
            const importedAssignee =
                meta.importSource?.assignedOffice ||
                meta.importSource?.checkedOut ||
                meta.importSource?.assignedTo ||
                '';

            let statusCategory = 'other';
            if (status === 3) statusCategory = 'maintenance';
            else if (userId > 0 || status === 1) statusCategory = 'assigned';
            else if (status === 0) statusCategory = 'available';

            return {
                asset,
                meta,
                name: asset.name || 'Unnamed',
                type: getAssetTypeLabel(asset.assetType),
                apiType: asset.assetType,
                tag: asset.otherserial || '',
                serial: asset.serial || '',
                assignedTo: userId ? getUserDisplayName(userId) : (importedAssignee || 'Unassigned'),
                location: String(getAssetLocationLabel(asset, meta)),
                statusCategory,
                value: Number(meta.financial.value || 0),
                purchaseDate: meta.financial.purchaseDate || '',
                warrantyExpiry: meta.financial.warrantyExpiry || '',
                warrantyCategory: getWarrantyCategory(meta.financial.warrantyExpiry),
                modified: asset.date_mod || asset.date_creation || ''
            };
        }).sort((a, b) => a.name.localeCompare(b.name));

        const totalValue = state.reportRows.reduce((sum, row) => sum + row.value, 0);
        const assigned = state.reportRows.filter(row => row.statusCategory === 'assigned').length;
        const expiring = state.reportRows.filter(row => row.warrantyCategory === 'expiring').length;

        setTextIfPresent('reportTotalAssets', state.reportRows.length);
        setTextIfPresent('reportActiveAssets', assigned);
        setTextIfPresent('reportTotalValue', formatMoney(totalValue));
        setTextIfPresent('reportExpiring', expiring);

        populateReportTypeFilter();
        renderReportTable();
    } catch (error) {
        console.error('Unable to load reports:', error);
        table.innerHTML = `<tr><td colspan="10"><div class="empty-state"><i class="fas fa-triangle-exclamation"></i><h3>Report unavailable</h3><p>${escapeHtml(getFriendlyErrorMessage(error))}</p></div></td></tr>`;
        showToast('Unable to load report data', 'error');
    }
}

function populateReportTypeFilter() {
    const select = document.getElementById('reportTypeFilter');
    if (!select) return;

    const currentValue = select.value;
    const types = [...new Set(state.reportRows.map(row => row.type))].sort();

    select.innerHTML =
        '<option value="">All asset types</option>' +
        types.map(type => `<option value="${escapeAttribute(type)}">${escapeHtml(type)}</option>`).join('');

    if (types.includes(currentValue)) select.value = currentValue;
}

function renderReportTable() {
    const table = document.getElementById('reportAssetsTable');
    if (!table) return;

    const search = (document.getElementById('reportSearch')?.value || '').trim().toLowerCase();
    const type = document.getElementById('reportTypeFilter')?.value || '';
    const status = document.getElementById('reportStatusFilter')?.value || '';
    const warranty = document.getElementById('reportWarrantyFilter')?.value || '';

    state.filteredReportRows = state.reportRows.filter(row => {
        const searchable = [
            row.name,
            row.type,
            row.tag,
            row.serial,
            row.assignedTo,
            row.location
        ].join(' ').toLowerCase();

        return (!search || searchable.includes(search)) &&
            (!type || row.type === type) &&
            (!status || row.statusCategory === status) &&
            (!warranty || row.warrantyCategory === warranty);
    });

    setTextIfPresent(
        'reportResultCount',
        `${state.filteredReportRows.length} ${state.filteredReportRows.length === 1 ? 'record' : 'records'}`
    );

    if (!state.filteredReportRows.length) {
        table.innerHTML = `
            <tr>
                <td colspan="10">
                    <div class="empty-state">
                        <i class="fas fa-magnifying-glass"></i>
                        <h3>No matching assets</h3>
                        <p>Adjust the report filters to display inventory records.</p>
                    </div>
                </td>
            </tr>`;
        return;
    }

    table.innerHTML = state.filteredReportRows.map(row => `
        <tr>
            <td data-label="Asset">
                <div class="asset-name-cell">
                    <strong>${escapeHtml(row.name)}</strong>
                    <small>GLPI #${escapeHtml(String(row.asset.id))}</small>
                </div>
            </td>
            <td data-label="Type">${escapeHtml(row.type)}</td>
            <td data-label="Tag / Serial">
                <div class="asset-name-cell">
                    <strong>${escapeHtml(row.tag || '-')}</strong>
                    <small>${escapeHtml(row.serial || 'No serial')}</small>
                </div>
            </td>
            <td data-label="Assigned to">${escapeHtml(row.assignedTo)}</td>
            <td data-label="Location">${escapeHtml(row.location)}</td>
            <td data-label="Status">${getStatusBadge(row.asset)}</td>
            <td data-label="Value">${formatMoney(row.value)}</td>
            <td data-label="Warranty">${renderWarrantyBadge(row.warrantyExpiry)}</td>
            <td data-label="Modified">${formatDate(row.modified)}</td>
            <td data-label="Actions">
                <button
                    class="btn-icon"
                    title="View asset"
                    onclick="viewAsset('${escapeAttribute(row.apiType)}', ${Number(row.asset.id)})"
                >
                    <i class="fas fa-arrow-right"></i>
                </button>
            </td>
        </tr>
    `).join('');
}
window.renderReportTable = renderReportTable;
