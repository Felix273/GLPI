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
                    const items = await glpi.getItems(apiType);
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
                getAssetTypeLabel(asset.assetType)
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
                                            getAssetTypeLabel(asset.assetType)
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
