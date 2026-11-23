// Users and asset relationships
function normalizeUserAssociationKey(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getUserEmail(user) {
    return user?.email || user?.usermail || user?.useremail || '-';
}

function getUserProfileLabel(user) {
    return user?.profile || user?.profiles_name || user?.profile_name || 'User';
}

function isUserActive(user) {
    return String(user?.is_active ?? user?.active ?? '1') !== '0';
}

function buildUserAssociationLookup(users) {
    const lookup = new Map();

    users.forEach(user => {
        const values = [
            user.name,
            user.login,
            user.email,
            user.usermail,
            [user.firstname, user.realname].filter(Boolean).join(' '),
            [user.realname, user.firstname].filter(Boolean).join(' ')
        ];

        values.forEach(value => {
            const key = normalizeUserAssociationKey(value);
            if (key) lookup.set(key, Number(user.id));
        });
    });

    return lookup;
}

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    tbody.innerHTML = dashboardSkeletonRows(7);

    try {
        await Promise.all([ensureUsersLoaded(true), hydrateAllAssetMeta()]);

        const assetGroups = await Promise.all(
            [...OPERATIONAL_ASSET_APIS].map(async apiType => {
                try {
                    const opts = apiType === 'Computer' ? { add_keys_names: ['computertypes_id'] } : {};
                    const items = await glpi.getItems(apiType, opts);
                    return (Array.isArray(items) ? items : []).map(item => ({
                        ...item,
                        assetType: apiType
                    }));
                } catch (error) {
                    console.warn(`Unable to load ${apiType}:`, error);
                    return [];
                }
            })
        );

        const assets = assetGroups.flat();
        state.allOperationalAssets = assets;
        const lookup = buildUserAssociationLookup(state.users);

        state.userAssetMap = new Map(
            state.users.map(user => [Number(user.id), []])
        );
        state.unlinkedAssociations = new Map();

        assets.forEach(asset => {
            const meta = getAssetMeta(asset.assetType, asset.id);
            const importedAssociation =
                meta?.importSource?.checkedOut ||
                meta?.importSource?.assignedOffice ||
                '';

            let userId = getAssetUserId(asset);

            if (!userId && importedAssociation) {
                userId =
                    lookup.get(
                        normalizeUserAssociationKey(importedAssociation)
                    ) || 0;
            }

            if (userId) {
                if (!state.userAssetMap.has(userId)) {
                    state.userAssetMap.set(userId, []);
                }

                state.userAssetMap.get(userId).push(asset);
                return;
            }

            if (importedAssociation) {
                const key = normalizeUserAssociationKey(importedAssociation);

                if (!state.unlinkedAssociations.has(key)) {
                    state.unlinkedAssociations.set(key, {
                        label: importedAssociation,
                        assets: []
                    });
                }

                state.unlinkedAssociations.get(key).assets.push(asset);
            }
        });

        const usersWithAssets = state.users.filter(user =>
            (state.userAssetMap.get(Number(user.id)) || []).length > 0
        ).length;

        const assignedAssets = [...state.userAssetMap.values()]
            .reduce((sum, assets) => sum + assets.length, 0);

        document.getElementById('userCountTotal').textContent =
            state.users.length;
        document.getElementById('userCountAssigned').textContent =
            usersWithAssets;
        document.getElementById('userAssetCount').textContent =
            assignedAssets;
        document.getElementById('unlinkedAssociationCount').textContent =
            state.unlinkedAssociations.size;

        renderUsersTable();
        renderUnlinkedAssociations();

        const inactiveUsers = state.users.filter(user => String(user.is_active ?? user.active ?? '1') === '0');
        if (inactiveUsers.length) {
            addAlert('Inactive users detected', `${inactiveUsers.length} user(s) are disabled in GLPI`, 'info', 'users-inactive');
        }
        updateNotificationBadge();
    } catch (error) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    ${renderInlineError(formatApiError(error), 'loadUsers()')}
                </td>
            </tr>
        `;
    }
}

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    const term = normalizeUserAssociationKey(
        document.getElementById('userSearch')?.value
    );
    const filter =
        document.getElementById('userAssignmentFilter')?.value || '';

    const users = [...state.users]
        .filter(user => {
            const assets =
                state.userAssetMap?.get(Number(user.id)) || [];

            const searchText = normalizeUserAssociationKey([
                getUserDisplayName(user.id),
                getUserEmail(user),
                getUserProfileLabel(user)
            ].join(' '));

            if (term && !searchText.includes(term)) return false;
            if (filter === 'assigned' && !assets.length) return false;
            if (filter === 'unassigned' && assets.length) return false;

            return true;
        })
        .sort((a, b) => {
            const aCount =
                (state.userAssetMap?.get(Number(a.id)) || []).length;
            const bCount =
                (state.userAssetMap?.get(Number(b.id)) || []).length;

            return bCount - aCount ||
                getUserDisplayName(a.id)
                    .localeCompare(getUserDisplayName(b.id));
        });

    if (!users.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <i class="fas fa-user-slash"></i>
                        <h3>No matching users</h3>
                        <p>Adjust the search or assignment filter.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = users.map(user => {
        const assets =
            state.userAssetMap?.get(Number(user.id)) || [];

        const types = [...new Set(
            assets.map(asset =>
                getAssetTypeLabel(asset.assetType, asset)
            )
        )];

        const locations = [...new Set(
            assets.map(asset =>
                String(getAssetLocationLabel(
                    asset,
                    getAssetMeta(asset.assetType, asset.id)
                ))
            ).filter(location =>
                location && location !== 'Not set'
            )
        )];

        const initials = getUserDisplayName(user.id)
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part[0])
            .join('')
            .toUpperCase() || 'U';

        return `
            <tr>
                <td data-label="User">
                    <div class="user-relationship-cell">
                        <span class="relationship-avatar">
                            ${escapeHtml(initials)}
                        </span>
                        <span>
                            <strong>
                                ${escapeHtml(getUserDisplayName(user.id))}
                            </strong>
                            <small>${escapeHtml(getUserEmail(user))}</small>
                        </span>
                    </div>
                </td>

                <td data-label="Profile">
                    ${escapeHtml(getUserProfileLabel(user))}
                </td>

                <td data-label="Account status">
                    ${isUserActive(user)
                        ? '<span class="status-badge available"><span class="status-dot"></span>Active</span>'
                        : '<span class="status-badge inactive"><span class="status-dot"></span>Inactive</span>'}
                </td>

                <td data-label="Assigned assets">
                    <button
                        class="asset-count-button ${assets.length ? 'has-assets' : ''}"
                        onclick="viewUserAssets(${Number(user.id)})"
                    >
                        <strong>${assets.length}</strong>
                        <span>${assets.length === 1 ? 'asset' : 'assets'}</span>
                    </button>
                </td>

                <td data-label="Asset types">
                    <div class="relationship-tags">
                        ${types.length
                            ? types.slice(0, 3).map(type =>
                                `<span>${escapeHtml(type)}</span>`
                            ).join('')
                            : '<span class="muted-tag">None</span>'}
                        ${types.length > 3
                            ? `<span>+${types.length - 3}</span>`
                            : ''}
                    </div>
                </td>

                <td data-label="Locations">
                    ${locations.length
                        ? escapeHtml(locations.slice(0, 2).join(', '))
                        : '<span class="text-muted">Not assigned</span>'}
                </td>

                <td data-label="Actions" class="actions">
                    <button
                        class="btn-secondary btn-sm"
                        onclick="viewUserAssets(${Number(user.id)})"
                    >
                        <i class="fas fa-boxes-stacked"></i>
                        View assets
                    </button>
                    <button
                        class="btn-secondary btn-sm"
                        onclick="openExitClearanceModal(${Number(user.id)})"
                        title="Print or email staff exit clearance form"
                    >
                        <i class="fas fa-file-signature"></i>
                        Exit clearance
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderUnlinkedAssociations() {
    const section =
        document.getElementById('unlinkedAssociationsSection');
    const container =
        document.getElementById('unlinkedAssociationsList');

    if (!section || !container) return;

    const associations =
        [...(state.unlinkedAssociations?.values() || [])]
            .sort((a, b) => b.assets.length - a.assets.length);

    section.style.display = associations.length ? 'block' : 'none';

    container.innerHTML = associations.map((association, index) => `
        <button
            class="unlinked-association-card"
            onclick="viewUnlinkedAssociationAssets(${index})"
        >
            <span class="association-icon">
                <i class="fas fa-link-slash"></i>
            </span>

            <span class="association-copy">
                <strong>${escapeHtml(association.label)}</strong>
                <small>
                    ${association.assets.length}
                    ${association.assets.length === 1 ? 'asset' : 'assets'}
                </small>
            </span>

            <span class="association-warning">
                Not linked to a GLPI user
            </span>

            <i class="fas fa-arrow-right"></i>
        </button>
    `).join('');
}

function showUserAssetAssociationModal(title, subtitle, assets) {
    let modal = document.getElementById('userAssetsModal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'userAssetsModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <div>
                        <span class="eyebrow">Asset association</span>
                        <h2 id="userAssetsModalTitle">Assigned assets</h2>
                        <p id="userAssetsModalSubtitle"></p>
                    </div>

                    <button
                        class="modal-close"
                        onclick="closeModal('userAssetsModal')"
                    >
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div
                    class="modal-body"
                    id="userAssetsModalBody"
                ></div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    document.getElementById('userAssetsModalTitle').textContent =
        title;
    document.getElementById('userAssetsModalSubtitle').textContent =
        subtitle;

    const body = document.getElementById('userAssetsModalBody');

    if (!assets.length) {
        body.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>No assigned assets</h3>
                <p>This user currently has no associated equipment.</p>
            </div>
        `;
    } else {
        body.innerHTML = `
            <div class="relationship-modal-summary">
                <strong>${assets.length}</strong>
                <span>
                    ${assets.length === 1
                        ? 'associated asset'
                        : 'associated assets'}
                </span>
            </div>

            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Asset</th>
                            <th>Type</th>
                            <th>Asset tag / serial</th>
                            <th>Status</th>
                            <th>Location</th>
                            <th></th>
                        </tr>
                    </thead>

                    <tbody>
                        ${assets.map(asset => {
                            const meta =
                                getAssetMeta(asset.assetType, asset.id);

                            const reference =
                                meta?.importSource?.assetTag ||
                                asset.otherserial ||
                                asset.serial ||
                                `GLPI #${asset.id}`;

                            return `
                                <tr>
                                    <td data-label="Asset">
                                        <strong>
                                            ${escapeHtml(asset.name || 'Unnamed')}
                                        </strong>
                                    </td>

                                    <td data-label="Type">
                                        ${escapeHtml(
                                            getAssetTypeLabel(asset.assetType, asset)
                                        )}
                                    </td>

                                    <td data-label="Asset tag / serial">
                                        ${escapeHtml(reference)}
                                    </td>

                                    <td data-label="Status">
                                        ${getStatusBadge(asset)}
                                    </td>

                                    <td data-label="Location">
                                        ${escapeHtml(String(
                                            getAssetLocationLabel(asset, meta)
                                        ))}
                                    </td>

                                    <td data-label="Actions">
                                        <button
                                            class="btn-icon"
                                            title="View asset"
                                            onclick="closeModal('userAssetsModal'); viewAsset('${asset.assetType}', ${asset.id})"
                                        >
                                            <i class="fas fa-arrow-right"></i>
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    showModal('userAssetsModal');
}

window.viewUserAssets = function(userId) {
    const user = state.users.find(
        item => Number(item.id) === Number(userId)
    );

    const assets =
        state.userAssetMap?.get(Number(userId)) || [];

    const name =
        user ? getUserDisplayName(user.id) : `User #${userId}`;

    showUserAssetAssociationModal(
        name,
        `${assets.length} ${assets.length === 1 ? 'asset' : 'assets'} currently associated`,
        assets
    );
};

window.viewUnlinkedAssociationAssets = function(index) {
    const association =
        [...(state.unlinkedAssociations?.values() || [])]
            .sort((a, b) => b.assets.length - a.assets.length)[index];

    if (!association) return;

    showUserAssetAssociationModal(
        association.label,
        'Imported association not yet linked to a GLPI user',
        association.assets
    );
};

window.filterUsers = function() {
    renderUsersTable();
};

window.showCreateUserModal = function() {
    showToast(
        'Create users in native GLPI, then refresh this directory.',
        'info'
    );
};

function buildExitClearanceRows(userId) {
    const uid = Number(userId);
    const currentAssets = state.userAssetMap?.get(uid) || [];
    const currentKeys = new Set(currentAssets.map(a => `${a.assetType}:${a.id}`));
    const rows = currentAssets.map(asset => {
        const meta = getAssetMeta(asset.assetType, asset.id);
        const rec = meta.assignments.find(r => Number(r.userId) === uid && r.active) || meta.assignments[0] || {};
        return { name: asset.name || 'Unnamed', type: getAssetTypeLabel(asset.assetType, asset), tag: asset.otherserial || '-', serial: asset.serial || '-', assignedAt: rec.assignedAt || asset.date_mod || '', returnedAt: '', status: 'Pending Handover', handedBack: false };
    });
    Object.entries(getAllAssetMeta()).forEach(([key, meta]) => {
        if (currentKeys.has(key) || !Array.isArray(meta?.assignments)) return;
        const returned = meta.assignments.find(r => Number(r.userId) === uid && !r.active && r.returnedAt);
        if (!returned) return;
        const [apiType, id] = key.split(':');
        const found = (state.allOperationalAssets || []).find(a => a.assetType === apiType && Number(a.id) === Number(id)) || {};
        rows.push({ name: found.name || `${apiType} #${id}`, type: getAssetTypeLabel(apiType, found), tag: found.otherserial || meta.importSource?.assetTag || '-', serial: found.serial || '-', assignedAt: returned.assignedAt || '', returnedAt: returned.returnedAt, status: 'Handed Back', handedBack: true });
    });
    return rows;
}

window.openExitClearanceModal = function(userId) {
    const uid = Number(userId);
    const user = state.users.find(u => Number(u.id) === uid) || {};
    const name = user.id ? getUserDisplayName(uid) : `User #${uid}`;
    const rows = buildExitClearanceRows(uid);
    const pendingCount = rows.filter(r => !r.handedBack).length;
    const org = state.systemSettings?.organization?.name || 'GLPI Asset Hub';
    const logoUrl = state.systemSettings?.organization?.logoUrl || '';
    let modal = document.getElementById('exitClearanceModal');
    if (!modal) { modal = document.createElement('div'); modal.id = 'exitClearanceModal'; modal.className = 'modal'; document.body.appendChild(modal); }
    const tableRows = rows.length ? rows.map(r => `<tr><td><strong>${escapeHtml(r.name)}</strong></td><td>${escapeHtml(r.type)}</td><td>${escapeHtml(r.tag)} / ${escapeHtml(r.serial)}</td><td>${escapeHtml(formatDate(r.assignedAt))}</td><td>${r.returnedAt ? escapeHtml(formatDate(r.returnedAt)) : '-'}</td><td><span class="status-badge ${r.handedBack ? 'available' : 'maintenance'}">${escapeHtml(r.status)}</span></td></tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:16px">No equipment assigned or recorded for this officer.</td></tr>';
    modal.innerHTML = `<div class="modal-content modal-large"><div class="modal-header no-print"><div><span class="eyebrow">Staff exit clearance</span><h2>${escapeHtml(name)}</h2></div><button class="modal-close" onclick="closeModal('exitClearanceModal')"><i class="fas fa-times"></i></button></div><div class="modal-body" id="exitClearancePrintArea"><div class="clearance-header">${logoUrl ? `<img src="${escapeAttribute(logoUrl)}" alt="Logo" class="clearance-logo">` : ''}<div><h2>${escapeHtml(org)} — Officer Exit Equipment Clearance</h2><p>Generated ${escapeHtml(new Date().toLocaleString())} by ${escapeHtml(state.user?.name || 'Asset Administrator')}</p></div></div><div class="clearance-officer-box"><div><strong>Officer:</strong> ${escapeHtml(name)}</div><div><strong>Login:</strong> ${escapeHtml(user.name || user.login || '-')}</div><div><strong>Email:</strong> ${escapeHtml(getUserEmail(user))}</div><div><strong>Clearance Status:</strong> <span class="status-badge ${pendingCount === 0 ? 'available' : 'maintenance'}">${pendingCount === 0 ? 'CLEARED (All assets returned)' : `PENDING (${pendingCount} asset${pendingCount === 1 ? '' : 's'} not yet returned)`}</span></div></div><div class="table-container"><table class="data-table"><thead><tr><th>Asset</th><th>Type</th><th>Tag / Serial</th><th>Assigned</th><th>Handed Back</th><th>Status</th></tr></thead><tbody>${tableRows}</tbody></table></div><div class="clearance-signatures"><div><span>Exiting Officer Signature &amp; Date</span></div><div><span>IT / Asset Manager Signature &amp; Date</span></div><div><span>Supervisor / HR Signature &amp; Date</span></div></div></div><div class="form-actions no-print"><button type="button" class="btn-secondary" onclick="closeModal('exitClearanceModal')">Close</button><button type="button" class="btn-secondary" onclick="emailExitClearanceSummary(${uid})"><i class="fas fa-envelope"></i> Email officer</button><button type="button" class="btn-primary" onclick="printExitClearanceForm()"><i class="fas fa-print"></i> Print clearance form</button></div></div>`;
    showModal('exitClearanceModal');
};

window.printExitClearanceForm = function() {
    document.body.classList.add('printing-clearance');
    window.print();
    setTimeout(() => document.body.classList.remove('printing-clearance'), 500);
};

window.emailExitClearanceSummary = async function(userId) {
    const rows = buildExitClearanceRows(userId);
    if (!rows.length) return showToast('No equipment records to email for this officer.', 'warning');
    try {
        const res = await glpi.sendAssetNotification({ event: 'clearance', userId: Number(userId), assets: rows.map(r => ({ name: r.name, type: r.type, tag: r.tag, serial: r.serial, status: r.status })) });
        if (res?.sent) showToast(`Clearance summary emailed to ${res.to}`, 'success');
        else showToast(res?.reason || res?.error || 'Email not sent — check SMTP settings', 'warning');
    } catch (err) { showToast(err.message || 'Unable to send email', 'error'); }
};
