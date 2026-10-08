/**
 * SLA / Licences feature module
 *
 * Provides the dedicated SLA/Licences view with two modes:
 *   - SLA  (GLPI "Contract" entity)  → Date Signed
 *   - License (GLPI "SoftwareLicense") → Start Date / End Date
 *
 * Both modes share the fields: Name of Product, Supplier, System Owner/Directorate.
 */

Object.assign(state, {
    slaLicenceMode: null,
    slaLicenceTypeFilter: 'all',
    slaLicenceStatusFilter: 'all',
    slaLicenceSuppliers: [],
    slaLicenceUsers: [],
    slaLicenceSoftwares: [],
    slaLicenceRecords: [],
});

const SLA_MODES = {
    sla: {
        label: 'SLA',
        api: 'Contract',
        dateField: 'date',
        dateLabel: 'Date Signed',
        submitLabel: 'Upload SLA Agreement',
    },
    license: {
        label: 'License',
        api: 'SoftwareLicense',
        dateField: 'start',
        dateLabel: 'Start Date / End Date',
        submitLabel: 'Upload Software License',
    },
};

const SLA_RENEWAL_LABELS = {
    0: 'No automatic renewal',
    1: 'Automatic renewal',
    2: 'Explicit renewal',
};

function slaLicenceParseDate(value) {
    if (!value || value === 'NULL') return null;
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function slaLicenceAddMonths(date, months) {
    if (!date || !Number.isFinite(months) || months <= 0) return null;
    const targetMonth = date.getMonth() + months;
    const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate();
    return new Date(date.getFullYear(), targetMonth, Math.min(date.getDate(), lastDay));
}

function slaLicenceDateFields(record) {
    const isSla = record._kind === 'sla';
    const start = slaLicenceParseDate(isSla ? record.begin_date : record._validFrom || record.start);
    const explicitEnd = slaLicenceParseDate(isSla ? record.end_date : record.expire || record.end);
    const end = explicitEnd || (isSla ? slaLicenceAddMonths(start, Number(record.duration)) : null);
    return { start, end };
}

function slaLicenceStatus(record) {
    const { start, end } = slaLicenceDateFields(record);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!start && !end) return 'undated';
    if (start && start > today) return 'upcoming';
    if (end) {
        end.setHours(0, 0, 0, 0);
        const daysLeft = Math.ceil((end.getTime() - today.getTime()) / 86400000);
        if (daysLeft < 0) return 'expired';
        if (daysLeft <= 30) return 'expiring';
    }
    return 'active';
}

function slaLicenceStatusLabel(status) {
    return ({ active: 'Active', upcoming: 'Upcoming', expiring: 'Expiring soon', expired: 'Expired', undated: 'No term dates' })[status] || status;
}

function slaLicenceFormatTerm(record) {
    const { start, end } = slaLicenceDateFields(record);
    if (record._kind === 'sla') {
        const signed = slaLicenceParseDate(record.date);
        const term = start ? `${slaLicenceFormatDate(start)} – ${end ? slaLicenceFormatDate(end) : `${Number(record.duration) || 'Open'} months`}` : 'Term not set';
        return `${signed ? `Signed ${slaLicenceFormatDate(signed)} · ` : ''}${term}`;
    }
    if (!start && !end) return 'Term not set';
    return `${start ? slaLicenceFormatDate(start) : 'Not set'} – ${end ? slaLicenceFormatDate(end) : 'No end date'}`;
}

function slaLicenceDisplayName(userId) {
    const id = Number(userId);
    if (!id) return '-';
    const match = state.slaLicenceUsers.find((u) => Number(u.id) === id);
    if (match) {
        const full = [match.firstname, match.realname].filter(Boolean).join(' ').trim();
        return full || match.name || match.email || `User #${id}`;
    }
    const fallback = state.users.find((u) => Number(u.id) === id);
    if (fallback) return getUserDisplayName(id);
    return `User #${id}`;
}

function slaLicenceOwnerName(userId, manualName = '') {
    return String(manualName || '').trim() || slaLicenceDisplayName(userId);
}

function slaLicenceSupplierName(supplierId) {
    const id = Number(supplierId);
    if (!id) return '-';
    const match = state.slaLicenceSuppliers.find((s) => Number(s.id) === id);
    return match ? (match.name || 'Unnamed') : `Supplier #${id}`;
}

function slaLicenceSoftwareName(softwareId) {
    const id = Number(softwareId);
    const match = state.slaLicenceSoftwares.find((software) => Number(software.id) === id);
    return match?.name || (id ? `Software #${id}` : '-');
}

function slaLicenceFormatDate(value) {
    if (!value) return '-';
    const d = value instanceof Date ? value : slaLicenceParseDate(value);
    return !d ? String(value) : d.toLocaleDateString();
}

async function loadSlaLicences() {
    switchSlaLicenceMode(null);

    const tbody = document.getElementById('slaLicenceRecordsBody');
    if (tbody) {
        tbody.innerHTML =
            '<tr><td colspan="7"><div class="loading"><div class="spinner"></div></div></td></tr>';
    }

    await loadSlaLicenceDropdowns();
    setupSupplierHandlers();
    setupOwnerHandlers();
    await loadSlaLicenceRecords();
}

async function loadSlaLicenceDropdowns() {
    ['slaSupplier', 'licenseSupplier', 'slaOwner', 'licenseOwner', 'licenseSoftware'].forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.disabled = false;
    });
    try {
        const [suppliers, users, softwares] = await Promise.all([
            glpi.getItems('Supplier'),
            glpi.getItems('User'),
            glpi.getItems('Software', { range: '0-1000' }),
        ]);

        state.slaLicenceSuppliers = Array.isArray(suppliers) ? suppliers : [];
        state.slaLicenceUsers = Array.isArray(users) ? users : [];
        state.slaLicenceSoftwares = Array.isArray(softwares)
            ? softwares.filter((software) => Number(software.is_deleted || 0) === 0 && Number(software.is_template || 0) === 0)
            : [];

        const supplierOptions = '<option value="">Select a supplier…</option>' +
            state.slaLicenceSuppliers
                .map((s) => `<option value="${Number(s.id)}">${escapeHtml(s.name || 'Unnamed')}</option>`)
                .join('') +
            '<option value="new" class="supplier-add-new">+ Add new supplier…</option>';

        const ownerOptions = '<option value="">Select a system owner…</option>' +
            state.slaLicenceUsers
                .map(
                    (u) =>
                        `<option value="${Number(u.id)}">${escapeHtml(slaLicenceDisplayName(u.id))}</option>`,
                )
                .join('') +
            '<option value="manual">+ Enter owner manually…</option>';

        ['slaSupplier', 'licenseSupplier'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = supplierOptions;
        });
        ['slaOwner', 'licenseOwner'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = ownerOptions;
        });
        const softwareSelect = document.getElementById('licenseSoftware');
        if (softwareSelect) {
            softwareSelect.innerHTML = '<option value="">Select GLPI software…</option>' +
                state.slaLicenceSoftwares
                    .map((software) => `<option value="${Number(software.id)}">${escapeHtml(software.name || 'Unnamed software')}</option>`)
                    .join('');
        }
        ['slaSupplier', 'licenseSupplier', 'slaOwner', 'licenseOwner', 'licenseSoftware'].forEach((id) => {
            window.refreshSearchableSelect?.(document.getElementById(id));
        });

        ['slaNewSupplier', 'licenseNewSupplier'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.hidden = true;
        });
        ['slaSupplierCreateBtn', 'licenseSupplierCreateBtn'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.hidden = true;
        });
    } catch (error) {
        console.warn('Unable to load SLA/Licences dropdowns:', error);
        ['slaSupplier', 'licenseSupplier', 'licenseSoftware'].forEach((id) => {
            const element = document.getElementById(id);
            if (element) {
                element.innerHTML = '<option value="">Unable to load options</option>';
                element.disabled = true;
            }
        });
        ['slaOwner', 'licenseOwner'].forEach((id) => {
            const element = document.getElementById(id);
            if (element) {
                element.innerHTML = '<option value="">Select a system owner…</option><option value="manual">+ Enter owner manually…</option>';
                element.disabled = false;
                window.refreshSearchableSelect?.(element);
            }
        });
        showToast(formatApiError(error, 'Unable to load suppliers and owners.'), 'error');
    }
}

function switchSlaLicenceMode(mode) {
    state.slaLicenceMode = mode;

    const slaCard = document.getElementById('slaUploadCard');
    const licenseCard = document.getElementById('licenseUploadCard');
    if (slaCard) slaCard.hidden = mode !== 'sla';
    if (licenseCard) licenseCard.hidden = mode !== 'license';
    document.querySelectorAll('.btn-mode').forEach((button) => {
        button.classList.toggle('active', button.dataset.mode === mode);
    });

    if (mode === 'sla') {
        document.getElementById('slaProductName')?.focus();
    } else if (mode === 'license') {
        document.getElementById('licenseProductName')?.focus();
    }
}

function resetUploadForm(formId) {
    const form = document.getElementById(formId);
    if (form) form.reset();
    const prefix = formId === 'slaUploadForm' ? 'sla' : 'license';
    const ownerInput = document.getElementById(`${prefix}OwnerManual`);
    if (ownerInput) {
        ownerInput.hidden = true;
        ownerInput.required = false;
    }
}

async function handleSlaLicenceDocumentUpload(itemtype, id, inputId) {
    const input = document.getElementById(inputId);
    if (!input || !input.files || !input.files.length || !id) return;

    const file = input.files[0];
    try {
        const dataUrl = await fileToDataUrl(file);
        const document = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            uploadedAt: new Date().toISOString(),
            dataUrl,
        };
        await glpi.saveDocument(itemtype, id, document);
    } catch (error) {
        console.error('Document upload failed:', error);
        showToast(`Failed to attach document “${file.name}”.`, 'warning');
    } finally {
        input.value = '';
    }
}

async function submitSlaForm(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('slaSubmitBtn');
    const original = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML =
            '<i class="fas fa-circle-notch fa-spin"></i> Uploading…';
    }

    try {
        const productName = document.getElementById('slaProductName')?.value.trim();
        const ownerValue = document.getElementById('slaOwner')?.value || '';
        const ownerId = ownerValue && ownerValue !== 'manual' ? Number(ownerValue) : 0;
        const ownerName = ownerValue === 'manual' ? document.getElementById('slaOwnerManual')?.value.trim() || '' : '';
        const dateSigned = document.getElementById('slaDateSigned')?.value;
        const startDate = document.getElementById('slaStartDate')?.value;
        const duration = Number(document.getElementById('slaDuration')?.value || 0);
        const renewal = Number(document.getElementById('slaRenewal')?.value || 0);
        const notice = Number(document.getElementById('slaNotice')?.value || 0);

        if (!productName) throw new Error('Name of Product is required.');
        const supplierValue = document.getElementById('slaSupplier')?.value || '';
        if (!supplierValue || supplierValue === 'new') throw new Error('Select or create a supplier.');
        const supplierId = Number(supplierValue);
        if (!ownerId && !ownerName) throw new Error('System Owner / Directorate is required.');
        if (!dateSigned) throw new Error('Date Signed is required.');
        if (!startDate) throw new Error('Agreement start date is required.');
        if (!Number.isInteger(duration) || duration < 1 || duration > 120) throw new Error('Term length must be between 1 and 120 months.');
        if (!Number.isInteger(notice) || notice < 0 || notice > duration) throw new Error('Notice period must be between 0 and the term length.');

        const data = {
            name: productName,
            date: dateSigned,
            begin_date: startDate,
            duration,
            renewal,
            notice,
        };

        const result = await glpi.createItem('Contract', data);
        const createdId = extractItemId(result);
        if (!createdId) throw new Error('GLPI created the agreement but did not return its ID.');

        const associationResults = await Promise.allSettled([
            glpi.createItem('Contract_Supplier', { contracts_id: createdId, suppliers_id: supplierId }),
            glpi.saveMetadata('Contract', createdId, { slaLicence: { ownerId, ownerName } }),
        ]);
        const associationFailures = associationResults.filter((entry) => entry.status === 'rejected');

        await handleSlaLicenceDocumentUpload('Contract', createdId, 'slaDocument');

        if (associationFailures.length) {
            showToast('SLA saved, but its supplier or owner could not be linked. Open the record and retry.', 'warning');
        } else {
            showToast('SLA agreement saved successfully.', 'success');
        }
        resetUploadForm('slaUploadForm');
        switchSlaLicenceMode(null);
        await loadSlaLicenceRecords();
    } catch (error) {
        showToast(formatApiError(error, 'Unable to upload SLA.'), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = original;
        }
    }
}

async function submitLicenseForm(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('licenseSubmitBtn');
    const original = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML =
            '<i class="fas fa-circle-notch fa-spin"></i> Uploading…';
    }

    try {
        const productName =
            document.getElementById('licenseProductName')?.value.trim();
        const ownerValue = document.getElementById('licenseOwner')?.value || '';
        const ownerId = ownerValue && ownerValue !== 'manual' ? Number(ownerValue) : 0;
        const ownerName = ownerValue === 'manual' ? document.getElementById('licenseOwnerManual')?.value.trim() || '' : '';
        const endDate = document.getElementById('licenseEndDate')?.value;
        const validFrom = document.getElementById('licenseStartDate')?.value || '';
        const licenseNumber = Number(document.getElementById('licenseNumber')?.value || 0);
        const serial = document.getElementById('licenseSerial')?.value.trim() || '';

        if (!productName) throw new Error('Name of Product is required.');
        const supplierValue =
            document.getElementById('licenseSupplier')?.value || '';
        const softwareId = Number(document.getElementById('licenseSoftware')?.value || 0);
        if (!supplierValue || supplierValue === 'new') throw new Error('Select or create a supplier.');
        const supplierId = Number(supplierValue);
        if (!softwareId) throw new Error('Select the GLPI software this license covers.');
        if (!ownerId && !ownerName) throw new Error('System Owner / Directorate is required.');
        if (validFrom && endDate && validFrom > endDate)
            throw new Error('Expiry date must be on or after the valid-from date.');
        if (!Number.isInteger(licenseNumber) || (licenseNumber < 1 && licenseNumber !== -1))
            throw new Error('Number of licenses must be a positive whole number or -1 for unlimited.');

        const data = {
            name: productName,
            softwares_id: softwareId,
            number: licenseNumber,
            serial,
            expire: endDate || null,
            ...(ownerId ? { users_id: ownerId } : {}),
        };

        const result = await glpi.createItem('SoftwareLicense', data);
        const createdId = extractItemId(result);
        if (!createdId) throw new Error('GLPI created the license but did not return its ID.');

        let metadataSaved = true;
        try {
            await glpi.saveMetadata('SoftwareLicense', createdId, {
                slaLicence: { supplierId, validFrom, ownerName },
            });
        } catch (error) {
            metadataSaved = false;
            console.warn('License supplier or start date could not be saved:', error);
        }

        await handleSlaLicenceDocumentUpload('SoftwareLicense', createdId, 'licenseDocument');

        showToast(metadataSaved ? 'Software license saved successfully.' : 'License saved, but supplier or valid-from details could not be stored.', metadataSaved ? 'success' : 'warning');
        resetUploadForm('licenseUploadForm');
        switchSlaLicenceMode(null);
        await loadSlaLicenceRecords();
    } catch (error) {
        showToast(formatApiError(error, 'Unable to upload license.'), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = original;
        }
    }
}

async function loadSlaLicenceRecords() {
    const tbody = document.getElementById('slaLicenceRecordsBody');
    const countEl = document.getElementById('slaLicencesCount');
    if (!tbody) return;

    tbody.innerHTML =
        '<tr><td colspan="7"><div class="loading"><div class="spinner"></div></div></td></tr>';

    try {
        const [contracts, licenses] = await Promise.all([
            glpi.getItems('Contract', { sort: 'date_mod', order: 'DESC' }),
            glpi.getItems('SoftwareLicense', { sort: 'date_mod', order: 'DESC' }),
        ]);

        const [supplierLinksResult, metadataResult] = await Promise.allSettled([
            glpi.getItems('Contract_Supplier'),
            glpi.getAllMetadata(),
        ]);
        const supplierLinks = supplierLinksResult.status === 'fulfilled' && Array.isArray(supplierLinksResult.value)
            ? supplierLinksResult.value
            : [];
        const metadata = metadataResult.status === 'fulfilled' && metadataResult.value && typeof metadataResult.value === 'object'
            ? metadataResult.value
            : {};
        if (supplierLinksResult.status === 'rejected' || metadataResult.status === 'rejected') {
            showToast('Some SLA supplier or owner details could not be loaded.', 'warning');
        }

        const contractList = Array.isArray(contracts) ? contracts : [];
        const licenseList = Array.isArray(licenses) ? licenses : [];

        state.slaLicenceRecords = [
            ...contractList.map((contract) => ({
                ...contract,
                _kind: 'sla',
                _supplierIds: supplierLinks
                    .filter((link) => Number(link.contracts_id) === Number(contract.id))
                    .map((link) => Number(link.suppliers_id))
                    .filter(Boolean),
                _ownerId: metadata[`Contract:${contract.id}`]?.slaLicence?.ownerId || 0,
                _ownerName: metadata[`Contract:${contract.id}`]?.slaLicence?.ownerName || '',
            })),
            ...licenseList.map((license) => ({
                ...license,
                _kind: 'license',
                _supplierId: metadata[`SoftwareLicense:${license.id}`]?.slaLicence?.supplierId || 0,
                _validFrom: metadata[`SoftwareLicense:${license.id}`]?.slaLicence?.validFrom || '',
                _ownerName: metadata[`SoftwareLicense:${license.id}`]?.slaLicence?.ownerName || '',
            })),
        ];
        state.slaLicenceRecords.sort((left, right) => {
            const leftDate = slaLicenceParseDate(left.date_mod || left.begin_date || left._validFrom || left.expire)?.getTime() || 0;
            const rightDate = slaLicenceParseDate(right.date_mod || right.begin_date || right._validFrom || right.expire)?.getTime() || 0;
            return rightDate - leftDate;
        });

        const total = state.slaLicenceRecords.length;
        const statuses = state.slaLicenceRecords.map(slaLicenceStatus);
        setTextIfPresent('slaSummaryTotal', total);
        setTextIfPresent('slaSummaryActive', statuses.filter((status) => status === 'active').length);
        setTextIfPresent('slaSummaryExpiring', statuses.filter((status) => status === 'expiring').length);
        setTextIfPresent('slaSummaryExpired', statuses.filter((status) => status === 'expired').length);
        setTextIfPresent('slaTypeCountAll', total);
        setTextIfPresent('slaTypeCountSla', contractList.length);
        setTextIfPresent('slaTypeCountLicense', licenseList.length);
        filterSlaLicenceRecords();
    } catch (error) {
        state.slaLicenceRecords = [];
        if (countEl) countEl.textContent = 'Records unavailable';
        ['slaSummaryTotal', 'slaSummaryActive', 'slaSummaryExpiring', 'slaSummaryExpired'].forEach((id) => setTextIfPresent(id, '—'));
        setTextIfPresent('slaTypeCountAll', '—');
        setTextIfPresent('slaTypeCountSla', '—');
        setTextIfPresent('slaTypeCountLicense', '—');
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state compact error-state"><i class="fas fa-triangle-exclamation"></i><h3>Records could not be loaded</h3><p>${escapeHtml(formatApiError(error, 'Unable to load records.'))}</p><button class="btn-secondary btn-sm" onclick="loadSlaLicenceRecords()"><i class="fas fa-rotate"></i> Try again</button></div></td></tr>`;
    }
}

function setSlaLicenceTypeFilter(type) {
    state.slaLicenceTypeFilter = ['all', 'sla', 'license'].includes(type) ? type : 'all';
    document.querySelectorAll('.sla-type-tab').forEach((button) => {
        const active = button.dataset.recordType === state.slaLicenceTypeFilter;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });
    filterSlaLicenceRecords();
}
window.setSlaLicenceTypeFilter = setSlaLicenceTypeFilter;

function filterSlaLicenceRecords() {
    const tbody = document.getElementById('slaLicenceRecordsBody');
    if (!tbody) return;
    const query = String(document.getElementById('slaLicenceSearch')?.value || '').trim().toLowerCase();
    const statusFilter = document.getElementById('slaStatusFilter')?.value || 'all';
    const records = state.slaLicenceRecords || [];
    const filtered = records.filter((record) => {
        if (state.slaLicenceTypeFilter !== 'all' && record._kind !== state.slaLicenceTypeFilter) return false;
        if (statusFilter !== 'all' && slaLicenceStatus(record) !== statusFilter) return false;
        const owner = record._kind === 'sla' ? record._ownerId : record.users_id;
        const suppliers = record._kind === 'sla'
            ? (record._supplierIds || []).map(slaLicenceSupplierName).join(' ')
            : slaLicenceSupplierName(record._supplierId);
        const searchable = [record.name, record.id, owner ? slaLicenceDisplayName(owner) : '', record._ownerName, suppliers, record.serial, record._kind === 'license' ? slaLicenceSoftwareName(record.softwares_id) : '']
            .join(' ').toLowerCase();
        return !query || searchable.includes(query);
    });
    const countEl = document.getElementById('slaLicencesCount');
    if (countEl) countEl.textContent = `${filtered.length} shown · ${records.length} total`;

    if (!filtered.length) {
        const message = records.length ? 'No records match these filters.' : 'Add an SLA or software license to start your register.';
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state compact"><i class="fas fa-inbox"></i><h3>${records.length ? 'No matching records' : 'No records yet'}</h3><p>${message}</p></div></td></tr>`;
        return;
    }
    tbody.innerHTML = filtered.map(renderSlaLicenceRow).join('');
}
window.filterSlaLicenceRecords = filterSlaLicenceRecords;

function renderSlaLicenceRow(item) {
    const isSla = item._kind === 'sla';
    const apiType = isSla ? 'Contract' : 'SoftwareLicense';
    const kindLabel = isSla ? 'SLA' : 'License';
    const status = slaLicenceStatus(item);
    const ownerId = isSla ? item._ownerId : item.users_id;
    const ownerName = slaLicenceOwnerName(ownerId, item._ownerName);
    const supplier = isSla
        ? (item._supplierIds || []).map(slaLicenceSupplierName).join(', ') || '-'
        : slaLicenceSupplierName(item._supplierId);
    const entitlement = !isSla
        ? `<small class="sla-record-subtitle">${escapeHtml(slaLicenceSoftwareName(item.softwares_id))} · ${Number(item.number) === -1 ? 'Unlimited licenses' : `${Number(item.number) || 1} license${Number(item.number) === 1 ? '' : 's'}`}${item.serial ? ` · ${escapeHtml(item.serial)}` : ''}</small>`
        : '';

    return `<tr>
        <td data-label="Type"><span class="record-chip ${isSla ? 'record-chip-sla' : 'record-chip-license'}">${escapeHtml(kindLabel)}</span></td>
        <td data-label="Agreement / license"><strong>${escapeHtml(item.name || 'Unnamed')}</strong>${entitlement}</td>
        <td data-label="Supplier">${escapeHtml(supplier)}</td>
        <td data-label="System owner">${escapeHtml(ownerName)}</td>
        <td data-label="Term">${escapeHtml(slaLicenceFormatTerm(item))}</td>
        <td data-label="Status"><span class="sla-status sla-status-${status}"><i aria-hidden="true"></i>${escapeHtml(slaLicenceStatusLabel(status))}</span></td>
        <td data-label="Actions"><button class="btn-icon" title="View ${escapeHtml(kindLabel)} record" aria-label="View ${escapeHtml(kindLabel)} record" onclick="viewLicenseRecord('${escapeAttribute(apiType)}', ${Number(item.id)})"><i class="fas fa-arrow-up-right-from-square"></i></button></td>
    </tr>`;
}

async function viewLicenseRecord(apiType, id) {
    const dialog = openRecordDialog('Loading…', '<div class="loading"><div class="spinner"></div></div>');
    try {
        const [item, documents] = await Promise.all([
            glpi.getItem(apiType, id),
            glpi.getDocuments(apiType, id).catch(() => []),
        ]);
        const isSla = apiType === 'Contract';
        const record = state.slaLicenceRecords.find((entry) =>
            Number(entry.id) === Number(id) && entry._kind === (isSla ? 'sla' : 'license'),
        ) || { ...item, _kind: isSla ? 'sla' : 'license' };
        const title = isSla ? 'SLA agreement' : 'Software license';
        const docList = Array.isArray(documents) ? documents : [];

        state.slaLicenceRecords = state.slaLicenceRecords.map((r) =>
            Number(r.id) === Number(id) &&
            ((apiType === 'Contract' && r._kind === 'sla') ||
                (apiType === 'SoftwareLicense' && r._kind === 'license'))
                ? { ...r, docCache: docList }
                : r,
        );
        let body = `
            <div class="detail-grid">
                <div class="detail-section"><h3>Identification</h3>
                    ${detailRow('Product name', item.name || 'N/A')}
                    ${detailRow('GLPI ID', item.id)}
                    ${detailRow('Type', isSla ? 'SLA agreement' : 'Software license')}
                    ${!isSla ? detailRow('GLPI software', slaLicenceSoftwareName(item.softwares_id)) : ''}
                    ${!isSla ? detailRow('Entitlement', Number(item.number) === -1 ? 'Unlimited' : `${Number(item.number) || 1} licenses`) : ''}
                    ${!isSla && item.serial ? detailRow('Serial number', item.serial) : ''}
                </div>
                <div class="detail-section"><h3>Details</h3>
                    ${detailRow('Supplier', isSla ? (record._supplierIds || []).map(slaLicenceSupplierName).join(', ') || 'Not linked' : slaLicenceSupplierName(record._supplierId))}
                    ${detailRow('System owner', slaLicenceOwnerName(isSla ? record._ownerId : item.users_id, record._ownerName))}
                    ${isSla
                        ? `${detailRow('Date signed', slaLicenceFormatDate(item.date))}${detailRow('Term', slaLicenceFormatTerm({ ...item, _kind: 'sla' }))}${detailRow('Renewal', SLA_RENEWAL_LABELS[Number(item.renewal)] || 'Not specified')}${detailRow('Notice period', `${Number(item.notice) || 0} months`)}`
                        : `${detailRow('Valid from', slaLicenceFormatDate(record._validFrom))}${detailRow('Expires on', slaLicenceFormatDate(item.expire))}`}
                </div>
                <div class="detail-section"><h3>Audit</h3>
                    ${detailRow('Created', slaLicenceFormatDate(item.date_creation))}
                    ${detailRow('Last modified', slaLicenceFormatDate(item.date_mod))}
                </div>
            </div>
        `;

        if (docList.length) {
            body += `
                <div class="detail-section sla-documents-section">
                    <h3>Attached Documents (${docList.length})</h3>
                    <div class="document-list-inline">
                        ${docList.map((doc) => {
                            const isImage = /^image\/.*/i.test(doc.type || '');
                            const thumbnail = isImage && doc.dataUrl
                                ? `<img src="${escapeAttribute(doc.dataUrl)}" alt="${escapeAttribute(doc.name)}" class="doc-image-preview">`
                                : `<i class="fas ${documentIcon(doc.type)} doc-file-icon"></i>`;
                            return `
                            <div class="document-item-inline">
                                <div class="doc-icon">${thumbnail}</div>
                                <div class="doc-info">
                                    <div class="doc-name">${escapeHtml(doc.name || 'Document')}</div>
                                    <small>${formatBytes(doc.size)} • ${slaLicenceFormatDate(doc.uploadedAt)}</small>
                                </div>
                                <button class="btn-icon" title="Download" onclick="downloadSlaLicenceDocument('${escapeAttribute(apiType)}', ${Number(id)}, '${escapeAttribute(doc.id)}')"><i class="fas fa-download"></i></button>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        } else {
            body += `
                <div class="detail-section sla-documents-section">
                    <h3>Attached Documents</h3>
                    <p style="color: var(--text-secondary); font-size: 14px;">No documents attached to this record.</p>
                </div>
            `;
        }

        const titleEl = document.getElementById('slaLicenceRecordTitle');
        if (titleEl) titleEl.textContent = title;
        renderRecordDialogBody(body);
    } catch (error) {
        renderRecordDialogBody(
            `<div class="empty-state compact error-state"><i class="fas fa-triangle-exclamation"></i><p>${escapeHtml(formatApiError(error, 'Unable to open the record.'))}</p></div>`,
        );
    }
}

function openRecordDialog(title, body) {
    let dialog = document.getElementById('slaLicenceRecordDialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'slaLicenceRecordDialog';
        dialog.className = 'modal';
        document.body.appendChild(dialog);
    }
    dialog.innerHTML = `
        <div class="modal-content modal-large">
            <div class="modal-header">
                <div><span class="eyebrow">SLA &amp; LICENSES</span><h2 id="slaLicenceRecordTitle">${escapeHtml(title)}</h2></div>
                <button class="modal-close" onclick="closeModal('slaLicenceRecordDialog')"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body" id="slaLicenceRecordBody">${body}</div>
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="closeModal('slaLicenceRecordDialog')">Close</button>
            </div>
        </div>
    `;
    showModal('slaLicenceRecordDialog');
    return dialog;
}

function renderRecordDialogBody(html) {
    const body = document.getElementById('slaLicenceRecordBody');
    if (body) body.innerHTML = html;
}

window.downloadSlaLicenceDocument = function (apiType, id, docId) {
    const allDocs = [];
    state.slaLicenceRecords.forEach((r) => {
        const matchesType = (apiType === 'Contract' && r._kind === 'sla')
            || (apiType === 'SoftwareLicense' && r._kind === 'license');
        if (matchesType && Number(r.id) === Number(id) && Array.isArray(r.docCache)) {
            allDocs.push(...r.docCache);
        }
    });
    const doc = allDocs.find((d) => String(d.id) === String(docId));
    if (!doc) return showToast('Document metadata not available locally.', 'error');
    const link = document.createElement('a');
    link.href = doc.dataUrl;
    link.download = doc.name;
    link.click();
};

const slaSupplierHandlerInputs = new WeakSet();
const slaOwnerHandlerInputs = new WeakSet();

function setupOwnerHandlers() {
    ['sla', 'license'].forEach((prefix) => {
        const select = document.getElementById(`${prefix}Owner`);
        const input = document.getElementById(`${prefix}OwnerManual`);
        if (!select || !input || slaOwnerHandlerInputs.has(select)) return;
        slaOwnerHandlerInputs.add(select);

        const syncManualOwnerInput = () => {
            const manual = select.value === 'manual';
            input.hidden = !manual;
            input.required = manual;
            if (!manual) input.value = '';
            if (manual) input.focus();
        };

        select.addEventListener('change', syncManualOwnerInput);
        syncManualOwnerInput();
    });
}

function setupSupplierHandlers() {
    ['sla', 'license'].forEach((prefix) => {
        const select = document.getElementById(`${prefix}Supplier`);
        const input = document.getElementById(`${prefix}NewSupplier`);
        const createBtn = document.getElementById(`${prefix}SupplierCreateBtn`);
        if (!select || !input || !createBtn || slaSupplierHandlerInputs.has(select)) return;
        slaSupplierHandlerInputs.add(select);

        select.addEventListener('change', () => {
            if (select.value === 'new') {
                input.value = '';
                input.hidden = false;
                createBtn.hidden = false;
                select.blur();
            } else {
                input.value = '';
                input.hidden = true;
                createBtn.hidden = true;
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                createSlaSupplier(prefix);
            }
        });
    });
}

async function createSlaSupplier(prefix) {
    const input = document.getElementById(`${prefix}NewSupplier`);
    const name = input?.value.trim();
    if (!name) return showToast('Enter a supplier name.', 'warning');

    const createBtn = document.getElementById(`${prefix}SupplierCreateBtn`);
    const original = createBtn ? createBtn.innerHTML : '';
    if (createBtn) {
        createBtn.disabled = true;
        createBtn.innerHTML =
            '<i class="fas fa-circle-notch fa-spin"></i> Creating…';
    }

    try {
        const result = await glpi.createItem('Supplier', { name });
        const id = extractItemId(result);
        if (!id) throw new Error('GLPI did not return a supplier ID.');

        const select = document.getElementById(`${prefix}Supplier`);
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        const newOption = select.querySelector('option[value="new"]');
        if (newOption) {
            select.insertBefore(option, newOption);
        } else {
            select.appendChild(option);
        }
        window.refreshSearchableSelect?.(select);
        select.value = id;

        input.hidden = true;
        createBtn.hidden = true;

        state.slaLicenceSuppliers = [
            ...state.slaLicenceSuppliers,
            { id, name },
        ];

        showToast(`Supplier “${name}” created.`, 'success');
    } catch (error) {
        showToast(formatApiError(error, 'Unable to create supplier.'), 'error');
    } finally {
        if (createBtn) {
            createBtn.disabled = false;
            createBtn.innerHTML = original;
        }
    }
}

window.loadSlaLicences = loadSlaLicences;
window.switchSlaLicenceMode = switchSlaLicenceMode;
window.submitSlaForm = submitSlaForm;
window.submitLicenseForm = submitLicenseForm;
window.viewLicenseRecord = viewLicenseRecord;
window.createSlaSupplier = createSlaSupplier;
