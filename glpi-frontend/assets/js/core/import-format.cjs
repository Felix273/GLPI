(function registerImportFormat(global) {
const aliases = {
    no: 'external_id',
    number: 'external_id',
    id: 'external_id',
    asset_id: 'external_id',
    category: 'category',
    assetname: 'name',
    asset_name: 'name',
    assettag: 'otherserial',
    asset_tag: 'otherserial',
    tag: 'otherserial',
    model_no: 'model_no',
    modelno: 'model_no',
    model_number: 'model_no',
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
    location_id: 'locations_id',
    purchase_value: 'value',
    purchasevalue: 'value',
    warranty_months: 'warranty',
    low_stock: 'threshold',
    lowstock: 'threshold',
    related_item: 'related_asset',
    cpu: 'processor',
    ram: 'ram_installed',
    ram_installed: 'ram_installed',
    memory: 'ram_installed',
    windows: 'operating_system',
    windows_os: 'operating_system',
    os: 'operating_system',
    operating_system: 'operating_system',
    office_suite: 'office_suite',
    serial_no: 'serial',
    serialno: 'serial',
    serial_number: 'serial',
    cpu_serial_no: 'serial',
    cpu_tag: 'otherserial',
    year_of_acquisition: 'acquisition_year',
    yearofacquisition: 'acquisition_year',
    acquisition_year: 'acquisition_year',
    staff_assignedoffice: 'assigned_to',
    staff_assigned_office: 'assigned_to',
    staffassignedoffice: 'assigned_to',
    assigned_office: 'assigned_to',
    assigned_to: 'assigned_to',
    location: 'locations_id',
    lifespan: 'lifespan',
    asset_condition: 'asset_condition',
    condition: 'asset_condition',
    comment_issue: 'comment',
    commentissue: 'comment',
    comments: 'comment',
    notes: 'comment'
};

function normalizeImportHeader(header) {
    const key = String(header || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
    return aliases[key] || key;
}

function importStatusValue(value) {
    if (value == null || value === '') return null;
    if (/^\d+$/.test(String(value).trim())) return Number(value);

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
        activeinuse: 1,
        activeuse: 1,
        inservice: 1,
        operational: 1,
        broken: 3,
        damaged: 3,
        lost: 3,
        disposed: 3
    };
    const normalized = String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return Object.prototype.hasOwnProperty.call(map, normalized) ? map[normalized] : null;
}

function normalizeImportedStatus(value) {
    return String(value ?? '').trim();
}

function isUpsImportRow(row) {
    const type = String(row?.itemtype || row?.asset_type || '').trim().toLowerCase();
    const category = String(row?.asset_category || row?.category || '').trim().toLowerCase();
    const model = String(row?.model || '').trim();
    return type === 'ups' || category === 'ups' || /^apc(?:\b|[-_])/i.test(model);
}

function isLaptopImportRow(row) {
    const type = String(row?.itemtype || row?.asset_type || '').trim().toLowerCase();
    if (type === 'laptop' || type === 'notebook') return true;

    const category = String(row?.asset_category || row?.category || '').trim().toLowerCase();
    if (category === 'laptop' || category === 'notebook') return true;

    const identifyingText = [row?.model, row?.name, row?.asset_name].filter(Boolean).join(' ');
    return /\b(laptop|notebook|macbook|thinkpad|thinkbook|latitude|elitebook|probook|travelmate|chromebook|surface\s+pro|surface\s+laptop|zenbook|vivobook|pavilion|inspiron)\b/i.test(identifyingText);
}

function isKeyboardImportRow(row) {
    const type = String(row?.itemtype || row?.asset_type || '').trim().toLowerCase();
    if (type === 'keyboard' || type === 'keyboards') return true;

    const category = String(row?.asset_category || row?.category || '').trim().toLowerCase();
    if (category === 'keyboard' || category === 'keyboards') return true;

    const identifyingText = [row?.model, row?.name, row?.asset_name].filter(Boolean).join(' ');
    return /\b(keyboard|keyboards)\b/i.test(identifyingText);
}

function matchesDashboardCategory(row, category) {
    const ups = isUpsImportRow(row);
    const laptop = isLaptopImportRow(row);
    const keyboard = isKeyboardImportRow(row);
    if (category === 'UPS') return ups;
    if (category === 'Peripherals') return keyboard && !ups;
    if (category === 'Laptops') return laptop;
    if (category === 'CPU') return !laptop;
    return true;
}
function resolveImportItemType(row, fallbackType = 'Computer') {
    if (isUpsImportRow(row)) return 'Peripheral';
    const rawType = String(row?.itemtype || row?.asset_type || '').trim();

    const normalized = rawType.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (normalized === 'ups') return 'Peripheral';
    if (['peripheral', 'keyboard', 'keyboards', 'scanner', 'projector'].includes(normalized)) return 'Peripheral';
    if (['laptop', 'desktop', 'workstation', 'server', 'computer'].includes(normalized)) return 'Computer';
    return rawType || fallbackType;
}

function shouldStopImportAfterError(error) {
    const status = Number(error?.status || 0);
    return [401, 403, 429].includes(status) || /permission|not authenticated|rate limit/i.test(String(error?.message || ''));
}

function assetLocationDisplayValue(asset, importedLocation = '') {
    if (importedLocation) return String(importedLocation);
    const resolved = asset?._keys_names?.locations_id
        || asset?.locations_name
        || asset?.location_name;
    if (resolved) return String(resolved);
    return asset?.locations_id ? String(asset.locations_id) : 'Not set';
}

const importHelpers = { normalizeImportHeader, importStatusValue, normalizeImportedStatus, isUpsImportRow, isLaptopImportRow, isKeyboardImportRow, matchesDashboardCategory, resolveImportItemType, shouldStopImportAfterError, assetLocationDisplayValue };

if (typeof module !== 'undefined' && module.exports) module.exports = importHelpers;
if (global) global.GLPIImportFormat = importHelpers;
})(typeof window !== 'undefined' ? window : null);