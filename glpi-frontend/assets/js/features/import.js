// Import
window.showImportModal = function() { navigateTo('import'); };

window.handleCSVUpload = function() {
    const file = document.getElementById('csvFileInput').files[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = async function(e) {
        try {
            const parsed = parseCSV(e.target.result);
            const normalized = normalizeImportRows(parsed.headers, parsed.rows);

            state.importHeaders = normalized.headers;
            state.importData = normalized.rows;
            state.importErrors = validateImportRows(state.importData);
            state.importUserMappings = [];
            state.importUserResolutionError = '';
            state.importUsersResolving = true;
            renderImportPreview();

            try {
                await resolveImportUsers();
            } catch (error) {
                console.error('Unable to resolve imported users:', error);
                state.importUserResolutionError = error.message || 'Unable to load GLPI users';
            } finally {
                state.importUsersResolving = false;
            }

            state.importDuplicatesChecking = true;
            state.importDuplicateErrors = [];
            state.importDuplicateCheckError = '';
            renderImportPreview();

            try {
                await checkImportDuplicates();
            } catch (error) {
                console.error('Unable to check duplicate assets:', error);
                state.importDuplicateCheckError =
                    error.message || 'Unable to check existing GLPI assets';
            } finally {
                state.importDuplicatesChecking = false;
            }

            state.importErrors = validateImportRows(state.importData);
            renderImportPreview();
        } catch (error) {
            state.importData = [];
            state.importHeaders = [];
            state.importUserMappings = [];
            state.importUsersResolving = false;
            state.importUserResolutionError = '';
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
    state.importUserMappings = [];
    state.importUsersResolving = false;
    state.importUserResolutionError = '';
    state.importDuplicateErrors = [];
    state.importDuplicatesChecking = false;
    state.importDuplicateCheckError = '';
    document.getElementById('csvFileInput').value = '';
    document.getElementById('importPreview').style.display = 'none';
    document.getElementById('importResults').innerHTML = '';
};

window.confirmImport = async function() {
    if (!state.importData.length) return showToast('Select a CSV file first', 'error');

    if (state.importUsersResolving) {
        return showToast('User matching is still in progress', 'error');
    }

    state.importDuplicatesChecking = true;
    state.importDuplicateErrors = [];
    state.importDuplicateCheckError = '';
    renderImportValidation();

    try {
        await checkImportDuplicates();
    } catch (error) {
        console.error('Unable to recheck duplicate assets:', error);
        state.importDuplicateCheckError =
            error.message || 'Unable to check existing GLPI assets';
    } finally {
        state.importDuplicatesChecking = false;
    }

    state.importErrors = validateImportRows(state.importData);
    const mappingErrors = validateImportUserMappings();
    const duplicateErrors = validateImportDuplicateResults();
    renderImportPreview();

    if (
        state.importErrors.length ||
        mappingErrors.length ||
        duplicateErrors.length
    ) {
        return showToast(
            'Resolve duplicate, validation and user-mapping issues before importing',
            'error'
        );
    }

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
            if (window.GLPIImportFormat.shouldStopImportAfterError(error)) {
                for (let pending = index + 1; pending < state.importData.length; pending++) {
                    const pendingRow = state.importData[pending];
                    results.push({
                        row: pending + 2,
                        status: 'failed',
                        name: pendingRow.name || '(blank)',
                        itemtype: resolveImportItemType(pendingRow),
                        error: `Not attempted after an authorization or service error in row ${index + 2}`
                    });
                    failed++;
                }
                break;
            }
        }
    }
    renderImportResults(results);
    showToast(`Complete: ${success} ok, ${failed} failed`, failed > 0 ? 'error' : 'success');
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-check"></i> Confirm';
    if (failed > 0) {
        addAlert('Import failures', `${failed} row(s) failed to import into GLPI`, 'danger', 'import-failed');
    }
    if (success > 0) {
        state.currentAssetType ? await loadAssetList(state.currentAssetType) : await loadDashboard();
    }
};

window.downloadImportTemplate = function() {
    const rows = [
        ['NO.', 'STAFF ASSIGNED/OFFICE', 'LOCATION', 'MODEL', 'PROCESSOR', 'RAM INSTALLED', 'WINDOWS (OS)', 'OFFICE SUITE', 'SERIAL NO', 'ASSET TAG', 'YEAR OF ACQUISITION', 'LIFESPAN', 'STATUS', 'ASSET CONDITION', 'COMMENT/ISSUE'],
        ['1', '4TH FLOOR - ICT SWITCH ROOM', '4TH FLOOR - ICT SWITCH ROOM', 'ThinkCentre M70q', 'Intel Core i5', '16 GB', 'Windows 11 Pro', 'Microsoft 365', 'PF4A1234', 'IT-0001', '2023', '5 years', 'Available', 'Good', ''],
        ['2', 'CALL CENTRE', 'CALL CENTRE', 'ProBook 450 G8', 'Intel Core i7', '16 GB', 'Windows 10 Pro', 'Microsoft Office 2021', '5CD2127T22', 'IT-0002', '2021', '4 years', 'Checked Out', 'Fair', 'Battery needs replacement']
    ];
    exportToCSVRows(rows, 'GLPI_Computers');
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
    const hasAssetIdentity = headers.includes('name') || headers.includes('otherserial') || headers.includes('serial');
    if (!hasAssetIdentity) {
        throw new Error('CSV must include Asset Tag, Serial No., or Asset Name');
    }
    const body = rows.slice(1).map(values => headers.reduce((obj, header, index) => {
        if (!header) return obj;
        obj[header] = values[index] || '';
        return obj;
    }, {})).filter(rowObj => Object.values(rowObj).some(value => String(value).trim() !== ''));

    return { headers: [...new Set(headers.filter(Boolean))], rows: body };
}

function normalizeImportHeader(header) {
    return window.GLPIImportFormat.normalizeImportHeader(header);
}


function buildImportUserCandidateLookup(users) {
    const lookup = new Map();

    users.filter(isUserActive).forEach(user => {
        const email = getUserEmail(user);
        const values = [
            user.name,
            user.login,
            email === '-' ? '' : email,
            user.usermail,
            user.useremail,
            [user.firstname, user.realname].filter(Boolean).join(' '),
            [user.realname, user.firstname].filter(Boolean).join(' ')
        ];

        values.forEach(value => {
            const key = normalizeUserAssociationKey(value);
            if (!key) return;

            if (!lookup.has(key)) lookup.set(key, new Map());
            lookup.get(key).set(Number(user.id), user);
        });
    });

    return lookup;
}


function isImportOfficeAssociation(label, row = {}) {
    const association = normalizeUserAssociationKey(label);
    const location = normalizeUserAssociationKey(
        row.locations_id || row.location || ''
    );

    if (!association) return false;

    if (
        location &&
        (
            association === location ||
            association.includes(location) ||
            location.includes(association)
        )
    ) {
        return true;
    }

    return /\b(office|reception|corridor|floor|wing|room|board\s*room|switch\s*room|access\s*point|call\s*centre|call\s*center|store|warehouse|laboratory|lab)\b/i.test(
        String(label || '')
    );
}

async function resolveImportUsers() {
    await ensureUsersLoaded(true);

    const groups = new Map();
    const lookup = buildImportUserCandidateLookup(state.users);

    state.importData.forEach((row, index) => {
        const label = String(row.assigned_to || '').trim();
        if (!label) return;

        const key = normalizeUserAssociationKey(label);

        if (!groups.has(key)) {
            groups.set(key, {
                key,
                label,
                rowIndexes: []
            });
        }

        groups.get(key).rowIndexes.push(index);
    });

    state.importUserMappings = [...groups.values()].map(group => {
        const candidateMap = lookup.get(group.key) || new Map();
        const candidateUserIds = [...candidateMap.keys()];

        const officeAssociation = group.rowIndexes.every(index =>
            isImportOfficeAssociation(
                group.label,
                state.importData[index] || {}
            )
        );

        return {
            ...group,
            candidateUserIds,
            selectedUserId: candidateUserIds.length === 1
                ? candidateUserIds[0]
                : (officeAssociation ? -1 : null)
        };
    });

    applyImportUserMappingsToRows();
}

function applyImportUserMappingsToRows() {
    state.importData.forEach(row => {
        row.import_user_id = '';
        row.import_user_resolution = row.assigned_to ? 'unresolved' : 'none';
    });

    state.importUserMappings.forEach(mapping => {
        const selected = mapping.selectedUserId;

        mapping.rowIndexes.forEach(index => {
            const row = state.importData[index];
            if (!row) return;

            if (selected === null || selected === undefined || selected === '') {
                row.import_user_id = '';
                row.import_user_resolution = 'unresolved';
            } else if (Number(selected) > 0) {
                row.import_user_id = Number(selected);
                row.import_user_resolution = 'matched';
            } else if (Number(selected) === -1) {
                row.import_user_id = 0;
                row.import_user_resolution = 'office';
            } else {
                row.import_user_id = 0;
                row.import_user_resolution = 'unassigned';
            }
        });
    });
}

function validateImportUserMappings() {
    const errors = [];

    if (state.importUserResolutionError) {
        errors.push(`User directory: ${state.importUserResolutionError}`);
    }

    state.importUserMappings.forEach(mapping => {
        if (mapping.selectedUserId === null || mapping.selectedUserId === undefined || mapping.selectedUserId === '') {
            const reason = mapping.candidateUserIds.length > 1
                ? 'matches multiple GLPI users'
                : 'was not found among synchronized GLPI users';

            errors.push(`Staff "${mapping.label}" ${reason}`);
        }
    });

    return errors;
}

function importUserOptionLabel(user) {
    const fullName = [user.firstname, user.realname].filter(Boolean).join(' ').trim();
    const login = user.name || user.login || '';
    const email = getUserEmail(user);
    const details = [login, email !== '-' ? email : ''].filter(Boolean).join(' · ');

    return fullName
        ? `${fullName}${details ? ` (${details})` : ''}`
        : details || `User #${user.id}`;
}

window.setImportUserMapping = function(index, value) {
    const mapping = state.importUserMappings[Number(index)];
    if (!mapping) return;

    mapping.selectedUserId = value === ''
        ? null
        : Number(value);

    applyImportUserMappingsToRows();
    renderImportPreview();
};

function renderImportUserMappings() {
    const section = document.getElementById('importUserMappingSection');
    const body = document.getElementById('importUserMappingBody');

    if (!section || !body) return;

    if (!state.importUserMappings.length) {
        section.hidden = true;
        body.innerHTML = '';
        return;
    }

    section.hidden = false;

    const activeUsers = state.users
        .filter(isUserActive)
        .slice()
        .sort((a, b) => importUserOptionLabel(a).localeCompare(importUserOptionLabel(b)));

    let matched = 0;
    let offices = 0;
    let ambiguous = 0;
    let unmatched = 0;

    body.innerHTML = state.importUserMappings.map((mapping, index) => {
        const selected = mapping.selectedUserId;
        const candidateCount = mapping.candidateUserIds.length;

        let statusClass = 'unmatched';
        let statusLabel = 'Unmatched';

        if (Number(selected) > 0) {
            matched += 1;
            statusClass = 'matched';
            statusLabel = candidateCount === 1 ? 'Matched' : 'Manually selected';
        } else if (Number(selected) === -1) {
            offices += 1;
            statusClass = 'office';
            statusLabel = 'Office / shared location';
        } else if (Number(selected) === 0 && selected !== null) {
            unmatched += 1;
            statusClass = 'unassigned';
            statusLabel = 'Left unassigned';
        } else if (candidateCount > 1) {
            ambiguous += 1;
            statusClass = 'ambiguous';
            statusLabel = `${candidateCount} possible matches`;
        } else {
            unmatched += 1;
        }

        const options = activeUsers.map(user => {
            const userId = Number(user.id);
            const isCandidate = mapping.candidateUserIds.includes(userId);
            const selectedAttribute = Number(selected) === userId ? ' selected' : '';
            const candidateLabel = isCandidate && candidateCount > 1 ? ' — possible match' : '';

            return `<option value="${userId}"${selectedAttribute}>${escapeHtml(importUserOptionLabel(user) + candidateLabel)}</option>`;
        }).join('');

        return `
            <tr>
                <td><strong>${escapeHtml(mapping.label)}</strong></td>
                <td><span class="mapping-status ${statusClass}">${escapeHtml(statusLabel)}</span></td>
                <td>
                    <select class="form-control import-user-select" data-searchable onchange="setImportUserMapping(${index}, this.value)">
                        <option value=""${selected === null ? ' selected' : ''} disabled>Select a GLPI user</option>
                        <option value="-1"${Number(selected) === -1 ? ' selected' : ''}>Treat as office / shared location</option>
                        <option value="0"${Number(selected) === 0 && selected !== null ? ' selected' : ''}>Leave unassigned</option>
                        ${options}
                    </select>
                </td>
                <td>${mapping.rowIndexes.map(rowIndex => rowIndex + 2).join(', ')}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('importMatchedUsers').textContent = matched;
    document.getElementById('importOfficeAssignments').textContent = offices;
    document.getElementById('importAmbiguousUsers').textContent = ambiguous;
    document.getElementById('importUnmatchedUsers').textContent = unmatched;
}


function normalizeImportAssetIdentity(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}

async function loadAllItemsForDuplicateCheck(itemtype) {
    const pageSize = 500;
    const maximumItems = 50000;
    const items = [];

    for (let offset = 0; offset < maximumItems; offset += pageSize) {
        const page = await glpi.getItems(itemtype, {
            range: `${offset}-${offset + pageSize - 1}`
        });

        const rows = Array.isArray(page) ? page : [];
        items.push(...rows);

        if (rows.length < pageSize) break;
    }

    return items;
}

function addImportDuplicateIssue(row, message) {
    if (!row.import_duplicate_issues) row.import_duplicate_issues = [];

    if (!row.import_duplicate_issues.includes(message)) {
        row.import_duplicate_issues.push(message);
    }
}

function validateImportDuplicateResults() {
    const errors = [...state.importDuplicateErrors];

    if (state.importDuplicateCheckError) {
        errors.unshift(
            `Duplicate check: ${state.importDuplicateCheckError}`
        );
    }

    return errors;
}

async function checkImportDuplicates() {
    state.importDuplicateErrors = [];
    state.importDuplicateCheckError = '';

    state.importData.forEach(row => {
        row.import_duplicate_issues = [];
    });

    const errors = [];
    const csvFields = [
        {
            key: 'otherserial',
            label: 'asset tag'
        },
        {
            key: 'serial',
            label: 'serial number'
        }
    ];

    // Detect repeated identities inside the selected CSV.
    csvFields.forEach(field => {
        const groups = new Map();

        state.importData.forEach((row, index) => {
            const rawValue = String(row[field.key] || '').trim();
            const normalized = normalizeImportAssetIdentity(rawValue);

            if (!normalized) return;

            if (!groups.has(normalized)) {
                groups.set(normalized, {
                    value: rawValue,
                    indexes: []
                });
            }

            groups.get(normalized).indexes.push(index);
        });

        groups.forEach(group => {
            if (group.indexes.length < 2) return;

            const csvRows = group.indexes.map(index => index + 2);
            const message =
                `CSV rows ${csvRows.join(', ')} contain duplicate ` +
                `${field.label} "${group.value}"`;

            errors.push(message);

            group.indexes.forEach(index => {
                addImportDuplicateIssue(
                    state.importData[index],
                    `Duplicate ${field.label} in CSV`
                );
            });
        });
    });

    const importedTypes = state.importData
        .map(resolveImportItemType)
        .filter(Boolean);

    const operationalTypes =
        typeof OPERATIONAL_ASSET_APIS !== 'undefined'
            ? [...OPERATIONAL_ASSET_APIS]
            : [];

    const assetTypes = [...new Set([
        ...operationalTypes,
        ...importedTypes
    ])];

    const existingGroups = await Promise.all(
        assetTypes.map(async itemtype => ({
            itemtype,
            items: await loadAllItemsForDuplicateCheck(itemtype)
        }))
    );

    const existing = {
        otherserial: new Map(),
        serial: new Map()
    };

    existingGroups.forEach(group => {
        group.items.forEach(item => {
            csvFields.forEach(field => {
                const rawValue = String(item[field.key] || '').trim();
                const normalized = normalizeImportAssetIdentity(rawValue);

                if (!normalized) return;

                if (!existing[field.key].has(normalized)) {
                    existing[field.key].set(normalized, []);
                }

                existing[field.key].get(normalized).push({
                    id: Number(item.id),
                    itemtype: group.itemtype,
                    name: item.name || `GLPI #${item.id}`,
                    value: rawValue
                });
            });
        });
    });

    state.importData.forEach((row, index) => {
        csvFields.forEach(field => {
            const rawValue = String(row[field.key] || '').trim();
            const normalized = normalizeImportAssetIdentity(rawValue);

            if (!normalized) return;

            const matches = existing[field.key].get(normalized) || [];

            if (!matches.length) return;

            const existingLabels = matches
                .slice(0, 3)
                .map(match =>
                    `${match.itemtype} "${match.name}" (GLPI #${match.id})`
                )
                .join(', ');

            const extraCount = Math.max(0, matches.length - 3);
            const message =
                `Row ${index + 2}: ${field.label} "${rawValue}" already ` +
                `exists on ${existingLabels}` +
                (extraCount ? ` and ${extraCount} more asset(s)` : '');

            errors.push(message);
            addImportDuplicateIssue(
                row,
                `${field.label} already exists in GLPI`
            );
        });
    });

    state.importDuplicateErrors = [...new Set(errors)];
    return state.importDuplicateErrors;
}

function normalizeImportRows(headers, rows) {
    const defaultType = document.getElementById('importDefaultType')?.value || 'Computer';
    const normalizedHeaders = [
        'row_status',
        'assigned_to',
        'locations_id',
        'itemtype',
        'model',
        'serial',
        'otherserial',
        'acquisition_year',
        'status',
        ...headers.filter(header => ![
            'assigned_to', 'locations_id', 'itemtype', 'model', 'serial',
            'otherserial', 'acquisition_year', 'status', 'name'
        ].includes(header))
    ];

    return {
        headers: [...new Set(normalizedHeaders)],
        rows: rows.map((row, index) => {
            const acquisitionYear = String(row.acquisition_year || '').trim();
            const assetTag = String(row.otherserial || '').trim();
            const serial = String(row.serial || '').trim();
            const model = String(row.model || '').trim();
            const assignedTo = String(row.assigned_to || '').trim();
            const location = String(row.locations_id || row.location || '').trim();

            return {
                ...row,
                name: String(row.name || assetTag || serial || model || `Imported Asset ${index + 1}`).trim(),
                assigned_to: assignedTo,
                locations_id: location,
                status: window.GLPIImportFormat.normalizeImportedStatus(row.status),
                itemtype: resolveImportItemType({ ...row, itemtype: row.itemtype || defaultType }),
                asset_category: window.GLPIImportFormat.isUpsImportRow(row)
                    ? 'UPS'
                    : (window.GLPIImportFormat.isKeyboardImportRow(row)
                        ? 'Keyboard'
                        : (window.GLPIImportFormat.isLaptopImportRow({ ...row, itemtype: row.itemtype || defaultType }) ? 'Laptop' : String(row.category || ''))),
                purchase_date: row.purchase_date || (/^\d{4}$/.test(acquisitionYear) ? `${acquisitionYear}-01-01` : ''),
                acquisition_year: acquisitionYear
            };
        })
    };
}

// Cache for resolving location names to IDs
const locationCache = {};
let locationPermissionDenied = false;

async function resolveLocationId(locationName) {
    if (!locationName || isPositiveInteger(locationName)) return locationName;
    if (locationPermissionDenied) return null;
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
        if ([401, 403, 429].includes(Number(e.status))) {
            locationPermissionDenied = true;
            console.warn('GLPI denied location lookup; remaining location names will be kept as imported text.');
        } else {
            console.error('Failed to resolve location:', locationName, e);
        }
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
        if (row.value && Number.isNaN(Number(row.value))) errors.push(`Row ${rowNumber}: value must be numeric`);
    });
    return errors;
}

function renderImportPreview() {
    const headers = state.importHeaders.length ? state.importHeaders : ['name'];
    document.getElementById('importRowCount').textContent = state.importData.length;
    document.getElementById('importPreviewHead').innerHTML = `<tr>${headers.map(h => `<th>${escapeHtml(importHeaderLabel(h))}</th>`).join('')}</tr>`;
    document.getElementById('importPreviewBody').innerHTML = state.importData.slice(0, 20).map((row, index) => {
        const rowErrors = [
            ...validateImportRows([row]),
            ...(row.import_duplicate_issues || [])
        ];
        return `<tr class="${rowErrors.length ? 'import-row-error' : ''}">${headers.map(header => {
            let value = row[header] || '';

            if (header === 'row_status') {
                if (rowErrors.length) {
                    value = rowErrors.join('; ');
                } else if (row.import_user_resolution === 'matched') {
                    value = `Mapped to ${getUserDisplayName(row.import_user_id)}`;
                } else if (row.import_user_resolution === 'office') {
                    value = 'Ready — office / shared location';
                } else if (row.import_user_resolution === 'unassigned') {
                    value = 'Ready — intentionally unassigned';
                } else if (row.import_user_resolution === 'unresolved') {
                    value = 'User mapping required';
                } else {
                    value = 'Ready';
                }
            }

            return `<td>${escapeHtml(value)}</td>`;
        }).join('')}</tr>`;
    }).join('');
    document.getElementById('importPreview').style.display = 'block';
    document.getElementById('importResults').innerHTML = '';
    renderImportUserMappings();
    renderImportValidation();
}

function renderImportValidation() {
    const validation = document.getElementById('importValidation');
    const button = document.getElementById('confirmImportBtn');
    if (!validation || !button) return;

    if (state.importUsersResolving) {
        validation.innerHTML = '<div class="import-message warning"><i class="fas fa-spinner fa-spin"></i> Checking CSV assignees against synchronized GLPI users...</div>';
        button.disabled = true;
        return;
    }

    if (state.importDuplicatesChecking) {
        validation.innerHTML = '<div class="import-message warning"><i class="fas fa-spinner fa-spin"></i> Checking serial numbers and asset tags for duplicates...</div>';
        button.disabled = true;
        return;
    }

    const mappingErrors = validateImportUserMappings();
    const duplicateErrors = validateImportDuplicateResults();
    const allErrors = [
        ...state.importErrors,
        ...mappingErrors,
        ...duplicateErrors
    ];

    if (!allErrors.length) {
        const mappedRows = state.importData.filter(row => Number(row.import_user_id) > 0).length;
        const officeRows = state.importData.filter(row => row.import_user_resolution === 'office').length;

        validation.innerHTML = state.importData.length
            ? `<div class="import-message success"><i class="fas fa-check-circle"></i> ${state.importData.length} row(s) ready to import. Duplicate check passed; ${mappedRows} user assignment(s) and ${officeRows} office/location assignment(s) resolved.</div>`
            : '<div class="import-message warning"><i class="fas fa-exclamation-triangle"></i> No import rows found.</div>';

        button.disabled = !state.importData.length;
        return;
    }

    validation.innerHTML = `
        <div class="import-message danger">
            <i class="fas fa-times-circle"></i>
            ${allErrors.length} issue(s) must be resolved before import.
        </div>
        <ul>${allErrors.slice(0, 12).map(error => `<li>${escapeHtml(error)}</li>`).join('')}</ul>
    `;

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
    if (window.GLPIImportFormat.isUpsImportRow(row)) return 'Peripheral';
    const value = raw || fallback;
    const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '');

    if (normalized === 'ups') return 'Peripheral';

    const aliases = {
        accesspoint: 'NetworkEquipment',
        wirelessaccesspoint: 'NetworkEquipment',
        networkdevice: 'NetworkEquipment',
        networkequipment: 'NetworkEquipment',
        router: 'NetworkEquipment',
        switch: 'NetworkEquipment',
        firewall: 'NetworkEquipment',
        laptop: 'Computer',
        desktop: 'Computer',
        workstation: 'Computer',
        server: 'Computer',
        computer: 'Computer',
        monitor: 'Monitor',
        screen: 'Monitor',
        printer: 'Printer',
        photocopier: 'Printer',
        scanner: 'Peripheral',
        keyboard: 'Peripheral',
        keyboards: 'Peripheral',
        peripheral: 'Peripheral',
        projector: 'Peripheral',
        ups: 'Peripheral',
        phone: 'Phone',
        telephone: 'Phone',
        smartphone: 'Phone',
        rack: 'Rack',
        cartridge: 'CartridgeItem',
        consumable: 'ConsumableItem',
        software: 'Software'
    };

    if (aliases[normalized]) return aliases[normalized];

    const match = Object.values(ASSET_TYPES).find(type =>
        type.api.toLowerCase().replace(/[^a-z0-9]+/g, '') === normalized ||
        type.name.toLowerCase().replace(/[^a-z0-9]+/g, '') === normalized ||
        type.label.toLowerCase().replace(/[^a-z0-9]+/g, '') === normalized
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
    setPayloadIfPresent(payload, 'comment', importCommentFromRow(data));

    // Resolve the location name from the KUCCPS/Snipe-IT template to a GLPI location ID.
    const locationValue = data.locations_id || data.location || '';
    if (locationValue) {
        if (isPositiveInteger(locationValue)) {
            payload.locations_id = Number(locationValue);
        } else {
            const locId = await resolveLocationId(locationValue);
            if (locId) payload.locations_id = Number(locId);
        }
    }
    if (isPositiveInteger(data.entities_id)) payload.entities_id = Number(data.entities_id);
    if (Number(data.import_user_id) > 0) payload.users_id = Number(data.import_user_id);

    const typeField = importTypeField(apiType);
    if (typeField && isPositiveInteger(data.type)) payload[typeField] = Number(data.type);
    return payload;
}

function importCommentFromRow(data) {
    const lines = [];
    if (data.asset_category || data.category) lines.push(`Asset Category: ${data.asset_category || data.category}`);
    if (data.external_id) lines.push(`No.: ${data.external_id}`);
    if (data.assigned_to) lines.push(`Staff Assigned/Office: ${data.assigned_to}`);
    if (data.model) lines.push(`Model: ${data.model}`);
    if (data.processor) lines.push(`Processor: ${data.processor}`);
    if (data.ram_installed) lines.push(`RAM Installed: ${data.ram_installed}`);
    if (data.operating_system) lines.push(`Windows (OS): ${data.operating_system}`);
    if (data.office_suite) lines.push(`Office Suite: ${data.office_suite}`);
    if (data.locations_id || data.location) lines.push(`Location: ${data.locations_id || data.location}`);
    if (data.acquisition_year) lines.push(`Year of Acquisition: ${data.acquisition_year}`);
    if (data.lifespan) lines.push(`Lifespan: ${data.lifespan}`);
    if (data.status) lines.push(`Imported Status: ${data.status}`);
    if (data.asset_condition) lines.push(`Asset Condition: ${data.asset_condition}`);
    if (data.comment) lines.push(`Comment/Issue: ${data.comment}`);
    return lines.join('\n');
}

function setPayloadIfPresent(payload, key, value) {
    const clean = String(value || '').trim();
    if (clean) payload[key] = clean;
}

function importStatusValue(value) {
    return window.GLPIImportFormat.importStatusValue(value);
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
    const labels = {
        row_status: 'Import status',
        assigned_to: 'Staff assigned/office',
        locations_id: 'Location',
        itemtype: 'Asset type',
        model: 'Model',
        serial: 'Serial no.',
        otherserial: 'Asset tag',
        acquisition_year: 'Year of acquisition',
        status: 'Status'
    };
    return labels[header] || header.replace(/_/g, ' ');
}
