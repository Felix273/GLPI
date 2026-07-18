// Navigation
async function navigateTo(view) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view));
    state.currentView = view;
    updatePageContext(view);
    state.selectedAssets.clear();
    state.currentPage = 1;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    const views = { dashboard: 'dashboardView', reports: 'reportsView', alerts: 'alertsView', import: 'importView', inventoryHealth: 'inventoryHealthView', softwareMatrix: 'softwareMatrixView', users: 'usersView', settings: 'settingsView' };
    if (views[view]) {
        state.currentAssetType = null;
        const viewElement = document.getElementById(views[view]);
        if (!viewElement) return;
        viewElement.classList.add('active');
        if (view === 'dashboard') loadDashboard();
        else if (view === 'reports') loadReports();
        else if (view === 'alerts') loadAlerts();
        else if (view === 'inventoryHealth') loadInventoryHealth();
        else if (view === 'softwareMatrix') loadSoftwareMatrix();
        else if (view === 'users') loadUsers();
        else if (view === 'settings') loadSettingsPage();
    } else if (ASSET_TYPES[view]) {
        document.getElementById('assetListView').classList.add('active');
        document.getElementById('assetListTitle').textContent = ASSET_TYPES[view].name + 's';
        state.currentAssetType = view;
        await loadAssetList(view);
    }
}
window.navigateTo = navigateTo;

function updatePageContext(view) {
    const titleElement = document.getElementById('pageTitle');
    const eyebrowElement = document.getElementById('pageEyebrow');
    if (!titleElement || !eyebrowElement) return;

    const specialViews = {
        dashboard: ['Dashboard', 'Overview'],
        reports: ['Reports', 'Inventory intelligence'],
        settings: ['Settings', 'Administration'],
        import: ['Import assets', 'Data tools'],
        inventoryHealth: ['Inventory health', 'Operations'],
        softwareMatrix: ['Software matrix', 'Insights']
    };
    const [title, eyebrow] = specialViews[view] || [ASSET_TYPES[view]?.label || 'Assets', 'Inventory'];
    titleElement.textContent = title;
    eyebrowElement.textContent = eyebrow;
    const organizationName = state.systemSettings?.organization?.name || 'GLPI Asset Hub';
    document.title = `${title} · ${organizationName}`;
}


async function loadPublicSettings() {
    if (!glpi.backendMode) return null;

    try {
        const settings = await glpi.getPublicSettings();
        if (settings) {
            state.systemSettings = mergeFrontendSettings(state.systemSettings || {}, settings);
            applySystemSettings(state.systemSettings);
        }
        return settings;
    } catch (error) {
        console.warn('Unable to load public system settings:', error);
        return null;
    }
}

function mergeFrontendSettings(base, patch) {
    const output = { ...(base || {}) };

    Object.entries(patch || {}).forEach(([key, value]) => {
        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            output[key] &&
            typeof output[key] === 'object' &&
            !Array.isArray(output[key])
        ) {
            output[key] = mergeFrontendSettings(output[key], value);
        } else {
            output[key] = value;
        }
    });

    return output;
}

function applySystemSettings(settings) {
    if (!settings) return;

    const organization = settings.organization || {};
    const general = settings.general || {};
    const name = organization.name || 'GLPI Asset Hub';
    const subtitle = organization.subtitle || 'IT operations';
    const workspaceName = organization.workspaceName || 'Primary workspace';

    document.querySelectorAll('.brand').forEach(element => {
        element.textContent = name;
    });

    document.querySelectorAll('.brand-copy small').forEach(element => {
        element.textContent = subtitle;
    });

    document.querySelectorAll('.workspace-chip strong').forEach(element => {
        element.textContent = workspaceName;
    });

    const logoContainer = document.querySelector('.sidebar-header .logo');
    if (logoContainer && organization.logoUrl) {
        logoContainer.innerHTML = `<img src="${escapeAttribute(organization.logoUrl)}" alt="${escapeAttribute(name)} logo">`;
        logoContainer.classList.add('has-organization-logo');
    }

    const preview = document.getElementById('organizationLogoPreview');
    if (preview && organization.logoUrl) {
        preview.innerHTML = `<img src="${escapeAttribute(organization.logoUrl)}" alt="${escapeAttribute(name)} logo">`;
    }

    const itemsPerPage = Number(general.itemsPerPage);
    if (Number.isFinite(itemsPerPage) && itemsPerPage > 0) {
        state.itemsPerPage = itemsPerPage;
    }

    updatePageContext(state.currentView || 'dashboard');
}

function switchSettingsTab(tab) {
    document.querySelectorAll('.settings-tab').forEach(button => {
        button.classList.toggle('active', button.dataset.settingsTab === tab);
    });

    document.querySelectorAll('.settings-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.settingsPanel === tab);
    });
}
window.switchSettingsTab = switchSettingsTab;

async function loadSettingsPage(force = false) {
    if (state.settingsLoaded && !force) {
        populateSettingsForm(state.systemSettings);
        return;
    }

    const content = document.getElementById('settingsContent');
    const accessMessage = document.getElementById('settingsAccessMessage');
    const saveButton = document.getElementById('saveSettingsBtn');

    try {
        const settings = await glpi.getSettings();
        state.systemSettings = mergeFrontendSettings(state.systemSettings || {}, settings || {});
        state.settingsLoaded = true;

        if (content) content.hidden = false;
        if (accessMessage) accessMessage.hidden = true;
        if (saveButton) saveButton.hidden = false;

        applySystemSettings(state.systemSettings);
        populateSettingsForm(state.systemSettings);
    } catch (error) {
        console.error('Unable to load settings:', error);

        if (content) content.hidden = true;
        if (accessMessage) accessMessage.hidden = false;
        if (saveButton) saveButton.hidden = true;

        showToast(error.message || 'Unable to load settings', 'error');
    }
}
window.loadSettingsPage = loadSettingsPage;

function populateSettingsForm(settings) {
    if (!settings) return;

    const organization = settings.organization || {};
    const general = settings.general || {};
    const directory = settings.directory || {};
    const audit = settings.audit || {};

    setInputValue('settingsOrganizationName', organization.name || '');
    setInputValue('settingsOrganizationSubtitle', organization.subtitle || '');
    setInputValue('settingsWorkspaceName', organization.workspaceName || '');
    setInputValue('settingsCurrency', general.currency || 'KES');
    setInputValue('settingsTimezone', general.timezone || 'Africa/Nairobi');
    setInputValue('settingsWarrantyDays', general.warrantyWarningDays || 30);
    setInputValue('settingsItemsPerPage', general.itemsPerPage || 10);

    setInputChecked('directoryEnabled', directory.enabled);
    setInputValue('directoryName', directory.name || 'Microsoft Active Directory');
    setInputValue('directoryHost', directory.host || '');
    setInputValue('directoryPort', directory.port || 389);
    setInputValue('directoryBaseDn', directory.baseDn || '');
    setInputValue('directoryBindDn', directory.bindDn || '');
    setInputValue('directoryBindPassword', '');
    setInputValue('directoryUserFilter', directory.userFilter || '');
    setInputChecked('directoryUseTls', directory.useTls);
    setInputChecked('directoryUseLdaps', directory.useLdaps);
    setInputValue('directoryLoginField', directory.loginField || 'samaccountname');
    setInputValue('directorySyncField', directory.syncField || 'objectguid');
    setInputValue('directoryEmailField', directory.emailField || 'mail');
    setInputValue('directoryFirstNameField', directory.firstNameField || 'givenname');
    setInputValue('directorySurnameField', directory.surnameField || 'sn');
    setInputValue('directoryPhoneField', directory.phoneField || 'telephonenumber');
    setInputValue('directoryMobileField', directory.mobileField || 'mobile');
    setInputValue('directoryTitleField', directory.titleField || 'title');
    setInputValue('directoryDepartmentField', directory.departmentField || 'department');
    setInputValue('directoryPageSize', directory.pageSize || 1000);
    setInputValue('directoryDeletedStrategy', directory.deletedUserStrategy ?? 3);
    setInputValue('directoryAuthLdapId', directory.authLdapId || 0);

    const passwordStatus = document.getElementById('directoryPasswordStatus');
    if (passwordStatus) {
        passwordStatus.textContent = directory.hasBindPassword
            ? 'A bind password is securely stored'
            : 'No password stored';
    }

    renderDirectoryStatus(settings);

    const auditSummary = document.getElementById('settingsAuditSummary');
    if (auditSummary) {
        auditSummary.textContent = audit.updatedAt
            ? `Updated ${formatSettingsDate(audit.updatedAt)} by ${audit.updatedBy || 'GLPI administrator'}.`
            : 'No changes recorded.';
    }

    const preview = document.getElementById('organizationLogoPreview');
    if (preview && organization.logoUrl) {
        preview.innerHTML = `<img src="${escapeAttribute(organization.logoUrl)}" alt="${escapeAttribute(organization.name || 'Organization')} logo">`;
    }
}

function setInputValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value ?? '';
}

function setInputChecked(id, value) {
    const element = document.getElementById(id);
    if (element) element.checked = Boolean(value);
}

function collectDirectorySettings() {
    return {
        enabled: document.getElementById('directoryEnabled')?.checked || false,
        name: document.getElementById('directoryName')?.value.trim() || 'Microsoft Active Directory',
        host: document.getElementById('directoryHost')?.value.trim() || '',
        port: Number(document.getElementById('directoryPort')?.value || 389),
        useTls: document.getElementById('directoryUseTls')?.checked || false,
        useLdaps: document.getElementById('directoryUseLdaps')?.checked || false,
        baseDn: document.getElementById('directoryBaseDn')?.value.trim() || '',
        bindDn: document.getElementById('directoryBindDn')?.value.trim() || '',
        bindPassword: document.getElementById('directoryBindPassword')?.value || '',
        userFilter: document.getElementById('directoryUserFilter')?.value.trim() || '',
        loginField: document.getElementById('directoryLoginField')?.value.trim() || 'samaccountname',
        syncField: document.getElementById('directorySyncField')?.value.trim() || 'objectguid',
        emailField: document.getElementById('directoryEmailField')?.value.trim() || 'mail',
        firstNameField: document.getElementById('directoryFirstNameField')?.value.trim() || 'givenname',
        surnameField: document.getElementById('directorySurnameField')?.value.trim() || 'sn',
        phoneField: document.getElementById('directoryPhoneField')?.value.trim() || 'telephonenumber',
        mobileField: document.getElementById('directoryMobileField')?.value.trim() || 'mobile',
        titleField: document.getElementById('directoryTitleField')?.value.trim() || 'title',
        departmentField: document.getElementById('directoryDepartmentField')?.value.trim() || 'department',
        pageSize: Number(document.getElementById('directoryPageSize')?.value || 1000),
        deletedUserStrategy: Number(document.getElementById('directoryDeletedStrategy')?.value || 3),
        authLdapId: Number(document.getElementById('directoryAuthLdapId')?.value || 0)
    };
}

function collectSystemSettings() {
    return {
        organization: {
            name: document.getElementById('settingsOrganizationName')?.value.trim() || 'GLPI Asset Hub',
            subtitle: document.getElementById('settingsOrganizationSubtitle')?.value.trim() || 'IT operations',
            workspaceName: document.getElementById('settingsWorkspaceName')?.value.trim() || 'Primary workspace'
        },
        general: {
            currency: document.getElementById('settingsCurrency')?.value || 'KES',
            timezone: document.getElementById('settingsTimezone')?.value || 'Africa/Nairobi',
            warrantyWarningDays: Number(document.getElementById('settingsWarrantyDays')?.value || 30),
            itemsPerPage: Number(document.getElementById('settingsItemsPerPage')?.value || 10)
        },
        directory: collectDirectorySettings()
    };
}

async function saveSystemSettings() {
    const button = document.getElementById('saveSettingsBtn');
    const original = button?.innerHTML;

    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving';
    }

    try {
        const settings = await glpi.saveSettings(collectSystemSettings());
        state.systemSettings = mergeFrontendSettings(state.systemSettings || {}, settings || {});
        state.settingsLoaded = true;
        applySystemSettings(state.systemSettings);
        populateSettingsForm(state.systemSettings);
        showToast('System settings saved', 'success');
    } catch (error) {
        showToast(error.message || 'Unable to save settings', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = original;
        }
    }
}
window.saveSystemSettings = saveSystemSettings;

async function uploadOrganizationLogo() {
    const input = document.getElementById('organizationLogoInput');
    const file = input?.files?.[0];

    if (!file) {
        showToast('Choose a logo file first', 'error');
        return;
    }

    const button = document.getElementById('uploadLogoBtn');
    const original = button?.innerHTML;

    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Uploading';
    }

    try {
        const result = await glpi.uploadOrganizationLogo(file);
        state.systemSettings = mergeFrontendSettings(
            state.systemSettings || {},
            result.settings || { organization: { logoUrl: result.logoUrl } }
        );
        applySystemSettings(state.systemSettings);

        if (input) input.value = '';
        const label = document.getElementById('selectedLogoName');
        if (label) label.textContent = 'Logo uploaded successfully';

        showToast('Organization logo updated', 'success');
    } catch (error) {
        showToast(error.message || 'Unable to upload logo', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = original;
        }
    }
}
window.uploadOrganizationLogo = uploadOrganizationLogo;

function toggleDirectoryPassword() {
    const input = document.getElementById('directoryBindPassword');
    if (!input) return;

    input.type = input.type === 'password' ? 'text' : 'password';
}
window.toggleDirectoryPassword = toggleDirectoryPassword;

async function testDirectoryConnection() {
    const button = document.getElementById('testDirectoryBtn');
    const original = button?.innerHTML;

    setDirectoryActionState('testing', 'Testing Active Directory connection...');

    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Testing';
    }

    try {
        const result = await glpi.testDirectory(collectDirectorySettings());
        setDirectoryActionState('success', result.message || 'Connection succeeded');
        showToast('Active Directory connection succeeded', 'success');

        state.systemSettings = mergeFrontendSettings(state.systemSettings || {}, {
            directory: {
                lastTestAt: result.testedAt,
                lastTestStatus: 'success'
            }
        });
        renderDirectoryStatus(state.systemSettings);
    } catch (error) {
        setDirectoryActionState('error', error.message || 'Connection failed');
        showToast(error.message || 'Active Directory connection failed', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = original;
        }
    }
}
window.testDirectoryConnection = testDirectoryConnection;

async function previewDirectoryUsers() {
    const button = document.getElementById('previewDirectoryBtn');
    const original = button?.innerHTML;

    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Loading';
    }

    try {
        const result = await glpi.previewDirectory(collectDirectorySettings(), 50);
        state.directoryPreviewUsers = Array.isArray(result.users) ? result.users : [];
        renderDirectoryPreview(state.directoryPreviewUsers);
        showToast(`${state.directoryPreviewUsers.length} directory users loaded`, 'success');
    } catch (error) {
        showToast(error.message || 'Unable to preview directory users', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = original;
        }
    }
}
window.previewDirectoryUsers = previewDirectoryUsers;


async function syncDirectoryUsers(mode = 'all') {
    const buttons = [
        document.getElementById('syncUpdateBtn'),
        document.getElementById('syncCreateBtn'),
        document.getElementById('syncAllBtn')
    ].filter(Boolean);

    const selectedButton = {
        update: document.getElementById('syncUpdateBtn'),
        create: document.getElementById('syncCreateBtn'),
        all: document.getElementById('syncAllBtn')
    }[mode];

    const originalContent = selectedButton?.innerHTML;

    buttons.forEach(button => {
        button.disabled = true;
    });

    if (selectedButton) {
        selectedButton.innerHTML =
            '<i class="fas fa-circle-notch fa-spin"></i> Synchronizing';
    }

    const output = document.getElementById('syncOutput');
    const outputText = document.getElementById('syncOutputText');

    if (output) output.hidden = false;
    if (outputText) {
        outputText.textContent =
            'Starting Active Directory synchronization...\n';
    }

    try {
        const directory = collectDirectorySettings();

        if (!directory.enabled) {
            throw new Error(
                'Enable Active Directory and save the settings before synchronizing.'
            );
        }

        if (!directory.host || !directory.baseDn) {
            throw new Error(
                'The directory host and Base DN are required.'
            );
        }

        const result = await glpi.syncDirectory(directory, mode);
        const summary = result.summary || {};
        const errors = Array.isArray(result.errors) ? result.errors : [];

        const lines = [
            `Status: ${result.status || 'completed'}`,
            `Mode: ${summary.mode || mode}`,
            `Directory users found: ${summary.directoryUsers || 0}`,
            `Created in GLPI: ${summary.created || 0}`,
            `Updated in GLPI: ${summary.updated || 0}`,
            `Skipped: ${summary.skipped || 0}`,
            `Errors: ${summary.errors || 0}`,
            `GLPI AuthLDAP ID: ${result.authLdapId || 'Not returned'}`,
            `Completed: ${formatSettingsDate(result.syncedAt)}`,
        ];

        if (errors.length) {
            lines.push('', 'Errors:');
            errors.forEach(error => {
                lines.push(
                    `- ${error.login || 'Unknown user'}: ${error.message || 'Unknown error'}`
                );
            });
        }

        if (outputText) {
            outputText.textContent = lines.join('\n');
        }

        state.systemSettings = mergeFrontendSettings(
            state.systemSettings || {},
            result.settings || {
                directory: {
                    authLdapId: result.authLdapId,
                    lastSyncAt: result.syncedAt,
                    lastSyncStatus: result.status,
                    lastSyncSummary: summary
                }
            }
        );

        state.settingsLoaded = true;
        populateSettingsForm(state.systemSettings);
        renderDirectoryStatus(state.systemSettings);

        if (state.currentView === 'users') {
            await loadUsers();
        } else {
            state.users = [];
        }

        const message = errors.length
            ? `Synchronization completed with ${errors.length} error${errors.length === 1 ? '' : 's'}`
            : `Synchronization complete: ${summary.created || 0} created, ${summary.updated || 0} updated`;

        showToast(message, errors.length ? 'error' : 'success');
    } catch (error) {
        if (outputText) {
            outputText.textContent =
                `Synchronization failed\n\n${error.message || error}`;
        }

        showToast(
            error.message || 'Active Directory synchronization failed',
            'error'
        );
    } finally {
        buttons.forEach(button => {
            button.disabled = false;
        });

        if (selectedButton) {
            selectedButton.innerHTML = originalContent;
        }
    }
}
window.syncDirectoryUsers = syncDirectoryUsers;

function renderDirectoryPreview(users) {
    const section = document.getElementById('directoryPreviewSection');
    const table = document.getElementById('directoryPreviewTable');
    const count = document.getElementById('directoryPreviewCount');

    if (!section || !table) return;

    section.hidden = false;
    if (count) count.textContent = `${users.length} ${users.length === 1 ? 'user' : 'users'}`;

    if (!users.length) {
        table.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <i class="fas fa-users-slash"></i>
                        <h3>No directory users found</h3>
                        <p>Review the Base DN and user search filter.</p>
                    </div>
                </td>
            </tr>`;
        return;
    }

    table.innerHTML = users.map(user => `
        <tr>
            <td data-label="Login"><strong>${escapeHtml(user.login || '-')}</strong></td>
            <td data-label="Name">${escapeHtml([user.firstName, user.surname].filter(Boolean).join(' ') || '-')}</td>
            <td data-label="Email">${escapeHtml(user.email || '-')}</td>
            <td data-label="Department">${escapeHtml(user.department || '-')}</td>
            <td data-label="Job title">${escapeHtml(user.title || '-')}</td>
        </tr>
    `).join('');
}

function setDirectoryActionState(status, message) {
    const element = document.getElementById('directoryTestStatus');
    if (!element) return;

    element.className = `directory-status ${status}`;
    element.innerHTML = `<i class="fas ${status === 'success' ? 'fa-circle-check' : status === 'error' ? 'fa-circle-xmark' : 'fa-circle-notch fa-spin'}"></i><span>${escapeHtml(message)}</span>`;
}

function renderDirectoryStatus(settings) {
    const directory = settings?.directory || {};

    const directoryStatus = document.getElementById('syncDirectoryStatus');
    const directoryDetail = document.getElementById('syncDirectoryDetail');
    const lastTest = document.getElementById('syncLastTest');
    const lastTestResult = document.getElementById('syncLastTestResult');
    const lastRun = document.getElementById('syncLastRun');
    const lastRunResult = document.getElementById('syncLastRunResult');
    const authLdapId = document.getElementById('syncAuthLdapId');

    if (directoryStatus) directoryStatus.textContent = directory.enabled ? 'Enabled' : 'Disabled';
    if (directoryDetail) {
        directoryDetail.textContent = directory.host
            ? `${directory.host}:${directory.port || 389}`
            : 'Directory host not configured.';
    }

    if (lastTest) lastTest.textContent = directory.lastTestAt ? formatSettingsDate(directory.lastTestAt) : 'Never';
    if (lastTestResult) lastTestResult.textContent = directory.lastTestStatus || 'No result recorded';
    if (lastRun) lastRun.textContent = directory.lastSyncAt ? formatSettingsDate(directory.lastSyncAt) : 'Never';
    if (lastRunResult) lastRunResult.textContent = directory.lastSyncStatus || 'No synchronization recorded';
    if (authLdapId) authLdapId.textContent = Number(directory.authLdapId) > 0 ? `#${directory.authLdapId}` : 'Not linked';

    if (directory.lastTestStatus === 'success') {
        setDirectoryActionState('success', `Connection tested ${formatSettingsDate(directory.lastTestAt)}`);
    } else if (directory.lastTestStatus === 'error') {
        setDirectoryActionState('error', 'The last connection test failed.');
    } else {
        const status = document.getElementById('directoryTestStatus');
        if (status) {
            status.className = 'directory-status neutral';
            status.innerHTML = '<i class="fas fa-circle"></i><span>Connection has not been tested.</span>';
        }
    }
}

function formatSettingsDate(value) {
    if (!value) return 'Never';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}
