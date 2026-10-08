// Navigation
function showViewError(view, message) {
  const viewId = {
    dashboard: "dashboardView",
    reports: "reportsView",
    alerts: "alertsView",
    import: "importView",
    inventoryHealth: "inventoryHealthView",
    softwareMatrix: "softwareMatrixView",
    users: "usersView",
    settings: "settingsView",
    licenses: "licensesView",
  }[view];
  if (!viewId) return;
  const viewElement = document.getElementById(viewId);
  if (!viewElement) return;
  viewElement.classList.add("active");
  const content = viewElement.querySelector(".view-content") || viewElement;
  content.innerHTML = `<div class="view-error-boundary"><i class="fas fa-triangle-exclamation"></i><h3>Something went wrong</h3><p>${escapeHtml(message || "Unable to load this view.")}</p><button class="btn-secondary" onclick="navigateTo('${view}')">Retry</button></div>`;
}

async function navigateTo(view) {
  document
    .querySelectorAll(".nav-item")
    .forEach((item) =>
      item.classList.toggle("active", item.dataset.view === view),
    );
  state.currentView = view;
  updatePageContext(view);
  state.selectedAssets.clear();
  state.currentPage = 1;
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));

  const views = {
     dashboard: "dashboardView",
     reports: "reportsView",
     alerts: "alertsView",
     import: "importView",
     inventoryHealth: "inventoryHealthView",
     softwareMatrix: "softwareMatrixView",
     users: "usersView",
     settings: "settingsView",
     licenses: "licensesView",
   };
  if (views[view]) {
    state.currentAssetType = null;
    const viewElement = document.getElementById(views[view]);
    if (!viewElement) return;
    viewElement.classList.add("active");

    if (state.refreshIntervalId) {
      clearInterval(state.refreshIntervalId);
      state.refreshIntervalId = null;
    }

    try {
      if (view === "dashboard") await loadDashboard();
      else if (view === "reports") await loadReports();
      else if (view === "alerts") loadAlerts();
      else if (view === "inventoryHealth") await loadInventoryHealth();
      else if (view === "softwareMatrix") await loadSoftwareMatrix();
      else if (view === "users") await loadUsers();
      else if (view === "settings") await loadSettingsPage();
      else if (view === "licenses") await loadSlaLicences();

      if (view === "inventoryHealth" || view === "softwareMatrix") {
        state.refreshIntervalId = setInterval(
          () => {
            if (view === "inventoryHealth") loadInventoryHealth();
            else if (view === "softwareMatrix") loadSoftwareMatrix();
          },
          5 * 60 * 1000,
        );
      }
    } catch (error) {
      showViewError(view, error.message || "An unexpected error occurred.");
    }
  } else if (ASSET_TYPES[view]) {
    document.getElementById("assetListView").classList.add("active");
    document.getElementById("assetListTitle").textContent =
      ASSET_TYPES[view].name + "s";
    state.currentAssetType = view;
    try {
      await loadAssetList(view);
    } catch (error) {
      showViewError(view, error.message || "Unable to load asset list.");
    }
  }
}
window.navigateTo = navigateTo;

function updatePageContext(view) {
  const titleElement = document.getElementById("pageTitle");
  const eyebrowElement = document.getElementById("pageEyebrow");
  if (!titleElement || !eyebrowElement) return;

  const specialViews = {
    dashboard: ["Dashboard", "Overview"],
    reports: ["Reports", "Inventory intelligence"],
    settings: ["Settings", "Administration"],
    import: ["Import assets", "Data tools"],
    inventoryHealth: ["Inventory health", "Operations"],
    softwareMatrix: ["Software matrix", "Insights"],
    licenses: ["SLA & Licenses", "Service agreements and software"],
  };
  const [title, eyebrow] = specialViews[view] || [
    ASSET_TYPES[view]?.label || "Assets",
    "Inventory",
  ];
  titleElement.textContent = title;
  eyebrowElement.textContent = eyebrow;
  const organizationName =
    state.systemSettings?.organization?.name || "GLPI Asset Hub";
  document.title = `${title} · ${organizationName}`;
}

async function loadPublicSettings() {
  if (!glpi.backendMode) {
    state.systemSettings = mergeFrontendSettings(
      state.systemSettings || {},
      {
        organization: { name: "GLPI Asset Hub", subtitle: "IT operations", workspaceName: "Primary workspace", logoUrl: "" },
        general: { currency: "KES", timezone: "Africa/Nairobi", itemsPerPage: 10, warrantyWarningDays: 30, lowStockAlertsEnabled: true },
        sidebar: { showGroupTitles: true, items: DEFAULT_SIDEBAR_ITEMS },
      },
    );
    applySystemSettings(state.systemSettings);
    return null;
  }

  try {
    const settings = await glpi.getPublicSettings();
    if (settings) {
      state.systemSettings = mergeFrontendSettings(
        state.systemSettings || {},
        settings,
      );
      applySystemSettings(state.systemSettings);
    }
    return settings;
  } catch (error) {
    console.warn("Unable to load public system settings:", error);
    return null;
  }
}

function mergeFrontendSettings(base, patch) {
  const output = { ...(base || {}) };

  Object.entries(patch || {}).forEach(([key, value]) => {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === "object" &&
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
  const name = organization.name || "GLPI Asset Hub";
  const subtitle = organization.subtitle || "IT operations";
  const workspaceName = organization.workspaceName || "Primary workspace";

  document.querySelectorAll(".brand").forEach((element) => {
    element.textContent = name;
  });

  document.querySelectorAll(".brand-copy small").forEach((element) => {
    element.textContent = subtitle;
  });

  document.querySelectorAll(".workspace-chip strong").forEach((element) => {
    element.textContent = workspaceName;
  });

  const logoContainer = document.querySelector(".sidebar-header .logo");
  if (logoContainer && organization.logoUrl) {
    logoContainer.innerHTML = `<img src="${escapeAttribute(organization.logoUrl)}" alt="${escapeAttribute(name)} logo">`;
    logoContainer.classList.add("has-organization-logo");
  }

  const preview = document.getElementById("organizationLogoPreview");
  if (preview && organization.logoUrl) {
    preview.innerHTML = `<img src="${escapeAttribute(organization.logoUrl)}" alt="${escapeAttribute(name)} logo">`;
  }

  const itemsPerPage = Number(general.itemsPerPage);
  if (Number.isFinite(itemsPerPage) && itemsPerPage > 0) {
    state.itemsPerPage = itemsPerPage;
  }

  renderSidebar(settings.sidebar);

  updatePageContext(state.currentView || "dashboard");
}

const DEFAULT_SIDEBAR_ITEMS = [
  { type: "link", view: "dashboard", label: "Dashboard", icon: "fas fa-th-large", visible: true },
  { type: "link", view: "reports", label: "Reports", icon: "fas fa-chart-column", visible: true },
  { type: "link", view: "alerts", label: "Alerts", icon: "fas fa-bell", visible: true },
  { type: "group", title: "Computing", visible: true, items: [
    { type: "link", view: "computers", label: "CPU", icon: "fas fa-desktop", visible: true },
    { type: "link", view: "laptops", label: "Laptops", icon: "fas fa-laptop", visible: true },
    { type: "link", view: "monitors", label: "Monitors", icon: "fas fa-desktop", visible: true },
    { type: "link", view: "peripherals", label: "Peripherals", icon: "fas fa-keyboard", visible: true },
    { type: "link", view: "ups", label: "UPS", icon: "fas fa-car-battery", visible: true },
    { type: "link", view: "phones", label: "Phones", icon: "fas fa-phone", visible: true },
  ]},
  { type: "group", title: "Office", visible: true, items: [
    { type: "link", view: "printers", label: "Printers", icon: "fas fa-print", visible: true },
    { type: "link", view: "cartridges", label: "Cartridges", icon: "fas fa-cart-shopping", visible: true },
    { type: "link", view: "consumables", label: "Consumables", icon: "fas fa-box-open", visible: true },
  ]},
  { type: "group", title: "Infrastructure", visible: true, items: [
    { type: "link", view: "network", label: "Network", icon: "fas fa-network-wired", visible: true },
    { type: "link", view: "racks", label: "Racks", icon: "fas fa-server", visible: true },
    { type: "link", view: "datacenters", label: "Datacenters", icon: "fas fa-building", visible: true },
  ]},
  { type: "group", title: "Software & Licenses", visible: true, items: [
    { type: "link", view: "software", label: "Software", icon: "fas fa-code", visible: true },
    { type: "link", view: "licenses", label: "SLA & Licenses", icon: "fas fa-file-contract", visible: true },
    { type: "link", view: "certificates", label: "Certificates", icon: "fas fa-certificate", visible: true },
  ]},
  { type: "group", title: "Management", visible: true, items: [
    { type: "link", view: "contracts", label: "Contracts", icon: "fas fa-file-contract", visible: true },
    { type: "link", view: "suppliers", label: "Suppliers", icon: "fas fa-truck", visible: true },
    { type: "link", view: "contacts", label: "Contacts", icon: "fas fa-address-book", visible: true },
    { type: "link", view: "documents", label: "Documents", icon: "fas fa-folder", visible: true },
  ]},
  { type: "group", title: "Organization", visible: true, items: [
    { type: "link", view: "locations", label: "Locations", icon: "fas fa-map-marker-alt", visible: true },
    { type: "link", view: "domains", label: "Domains", icon: "fas fa-globe", visible: true },
    { type: "link", view: "users", label: "Users", icon: "fas fa-users", visible: true },
  ]},
  { type: "group", title: "Tools", visible: true, items: [
    { type: "link", view: "inventoryHealth", label: "Inventory Health", icon: "fas fa-heart-pulse", visible: true },
    { type: "link", view: "softwareMatrix", label: "Software Matrix", icon: "fas fa-layer-group", visible: true },
    { type: "link", view: "import", label: "Import", icon: "fas fa-upload", visible: true },
  ]},
];

function renderSidebar(config) {
  const nav = document.getElementById("sidebarNav");
  if (!nav) return;

  const showGroupTitles = config?.showGroupTitles !== false;
  const items = Array.isArray(config?.items) && config.items.length
    ? config.items
    : DEFAULT_SIDEBAR_ITEMS;
  normalizeSlaLicenceNavigationLabel(items);

  let html = "";

  for (const item of items) {
    if (item.type === "group") {
      const visibleItems = (item.items || []).filter((sub) => sub.visible !== false);
      if (item.visible === false || visibleItems.length === 0) continue;

      html += `<div class="nav-group">`;
      if (showGroupTitles && item.title) html += `<span class="nav-group-title">${escapeHtml(item.title)}</span>`;
      for (const sub of visibleItems) {
        html += renderNavItem(sub);
      }
      html += `</div>`;
    } else if (item.type === "link" && item.visible !== false) {
      html += renderNavItem(item);
    }
  }

  nav.innerHTML = html;
}

function renderNavItem(item) {
  const view = escapeAttribute(item.view || "");
  const label = escapeHtml(item.label || "");
  const icon = escapeAttribute(item.icon || "fas fa-circle");
  return `<a href="#" class="nav-item" data-view="${view}"><i class="${icon}"></i> ${label}</a>`;
}

function switchSettingsTab(tab) {
  document.querySelectorAll(".settings-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.settingsTab === tab);
  });

  document.querySelectorAll(".settings-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.settingsPanel === tab);
  });
  if (tab === "logs") loadSettingsLogs();
  if (tab === "access") loadSettingsAccess();
}
window.switchSettingsTab = switchSettingsTab;

async function loadSettingsPage(force = false) {
  if (state.settingsLoaded && !force) {
    populateSettingsForm(state.systemSettings);
    return;
  }

  const content = document.getElementById("settingsContent");
  const accessMessage = document.getElementById("settingsAccessMessage");
  const saveButton = document.getElementById("saveSettingsBtn");
  const skeleton = document.getElementById("settingsSkeleton");
  const errorBoundary = document.getElementById("settingsError");
  const panels = document.getElementById("settingsPanels");

  if (skeleton) skeleton.hidden = false;
  if (errorBoundary) errorBoundary.hidden = true;
  if (panels) panels.hidden = true;
  if (accessMessage) accessMessage.hidden = true;
  if (saveButton) saveButton.hidden = true;

  try {
    const settings = await glpi.getSettings();
    state.systemSettings = mergeFrontendSettings(
      state.systemSettings || {},
      settings || {},
    );
    state.settingsLoaded = true;

    if (skeleton) skeleton.hidden = true;
    if (panels) panels.hidden = false;
    if (saveButton) saveButton.hidden = false;

    applySystemSettings(state.systemSettings);
    populateSettingsForm(state.systemSettings);
  } catch (error) {
    console.error("Unable to load settings:", error);
    if (skeleton) skeleton.hidden = true;
    if (panels) panels.hidden = true;
    if (errorBoundary) errorBoundary.hidden = true;
    if (saveButton) saveButton.hidden = true;

    if (error.status === 403) {
      if (accessMessage) accessMessage.hidden = false;
    } else {
      if (accessMessage) accessMessage.hidden = true;
      if (errorBoundary) errorBoundary.hidden = false;
      showToast(error.message || "Unable to load settings", "error");
    }
  }
}
window.loadSettingsPage = loadSettingsPage;

function populateSettingsForm(settings) {
  if (!settings) return;

  const organization = settings.organization || {};
  const general = settings.general || {};
  const directory = settings.directory || {};
  const audit = settings.audit || {};

  setInputValue("settingsOrganizationName", organization.name || "");
  setInputValue("settingsOrganizationSubtitle", organization.subtitle || "");
  setInputValue("settingsWorkspaceName", organization.workspaceName || "");
  setInputValue("settingsCurrency", general.currency || "KES");
  setInputValue("settingsTimezone", general.timezone || "Africa/Nairobi");
  setInputValue("settingsWarrantyDays", general.warrantyWarningDays || 30);

  const overviewOrganization = document.getElementById("settingsOverviewOrganization");
  const overviewWorkspace = document.getElementById("settingsOverviewWorkspace");
  const overviewCurrency = document.getElementById("settingsOverviewCurrency");
  const overviewTimezone = document.getElementById("settingsOverviewTimezone");
  const overviewDirectory = document.getElementById("settingsOverviewDirectory");
  const overviewDirectoryHost = document.getElementById("settingsOverviewDirectoryHost");
  if (overviewOrganization) overviewOrganization.textContent = organization.name || "Not configured";
  if (overviewWorkspace) overviewWorkspace.textContent = organization.workspaceName || "Workspace not set";
  if (overviewCurrency) overviewCurrency.textContent = general.currency || "KES";
  if (overviewTimezone) overviewTimezone.textContent = general.timezone || "Africa/Nairobi";
  if (overviewDirectory) overviewDirectory.textContent = directory.enabled ? "Enabled" : "Not configured";
  if (overviewDirectoryHost) overviewDirectoryHost.textContent = directory.host || "LDAP connection";
  setInputValue("settingsItemsPerPage", general.itemsPerPage || 10);
  setInputChecked(
    "settingsLowStockAlerts",
    general.lowStockAlertsEnabled ?? true,
  );

  setInputChecked("directoryEnabled", directory.enabled);
  setInputValue(
    "directoryName",
    directory.name || "Microsoft Active Directory",
  );
  setInputValue("directoryHost", directory.host || "");
  setInputValue("directoryPort", directory.port || 389);
  setInputValue("directoryBaseDn", directory.baseDn || "");
  setInputValue("directoryBindDn", directory.bindDn || "");
  setInputValue("directoryBindPassword", "");
  setInputValue("directoryUserFilter", directory.userFilter || "");
  setInputChecked("directoryUseTls", directory.useTls);
  setInputChecked("directoryUseLdaps", directory.useLdaps);
  setInputValue(
    "directoryLoginField",
    directory.loginField || "samaccountname",
  );
  setInputValue("directorySyncField", directory.syncField || "objectguid");
  setInputValue("directoryEmailField", directory.emailField || "mail");
  setInputValue(
    "directoryFirstNameField",
    directory.firstNameField || "givenname",
  );
  setInputValue("directorySurnameField", directory.surnameField || "sn");
  setInputValue(
    "directoryPhoneField",
    directory.phoneField || "telephonenumber",
  );
  setInputValue("directoryMobileField", directory.mobileField || "mobile");
  setInputValue("directoryTitleField", directory.titleField || "title");
  setInputValue(
    "directoryDepartmentField",
    directory.departmentField || "department",
  );
  setInputValue("directoryPageSize", directory.pageSize || 1000);
  setInputValue("directoryDeletedStrategy", directory.deletedUserStrategy ?? 3);
  setInputValue("directoryAuthLdapId", directory.authLdapId || 0);

  const passwordStatus = document.getElementById("directoryPasswordStatus");
  if (passwordStatus) {
    passwordStatus.textContent = directory.hasBindPassword
      ? "A bind password is securely stored"
      : "No password stored";
  }

  renderDirectoryStatus(settings);

  const auditSummary = document.getElementById("settingsAuditSummary");
  if (auditSummary) {
    auditSummary.textContent = audit.updatedAt
      ? `Updated ${formatSettingsDate(audit.updatedAt)} by ${audit.updatedBy || "GLPI administrator"}.`
      : "No changes recorded.";
  }

  const preview = document.getElementById("organizationLogoPreview");
  if (preview && organization.logoUrl) {
    preview.innerHTML = `<img src="${escapeAttribute(organization.logoUrl)}" alt="${escapeAttribute(organization.name || "Organization")} logo">`;
  }

  populateSidebarSettings(settings);
}

function getSidebarConfig(settings) {
  const sidebar = settings?.sidebar || {};
  let items = Array.isArray(sidebar.items) && sidebar.items.length
    ? sidebar.items
    : JSON.parse(JSON.stringify(DEFAULT_SIDEBAR_ITEMS));
  normalizeSlaLicenceNavigationLabel(items);
  return { showGroupTitles: sidebar.showGroupTitles !== false, items };
}

function normalizeSlaLicenceNavigationLabel(items) {
  for (const item of items || []) {
    if (item?.type === "link" && item.view === "computers") {
      item.label = "CPU";
    }
    if (
      item?.type === "group" &&
      item.title === "Computing" &&
      Array.isArray(item.items)
    ) {
      const defaults = [
        { view: "laptops", label: "Laptops", icon: "fas fa-laptop" },
        { view: "ups", label: "UPS", icon: "fas fa-car-battery" },
      ];
      defaults.forEach(link => {
        if (!item.items.some(child => child?.type === "link" && child.view === link.view)) {
          item.items.push({ type: "link", ...link, visible: true });
        }
      });
    }
    if (item?.type === "link" && item.view === "licenses") {
      item.label = "SLA & Licenses";
    }
    if (item?.type === "group" && Array.isArray(item.items)) {
      normalizeSlaLicenceNavigationLabel(item.items);
    }
  }
  return items;
}

function populateSidebarSettings(settings) {
  const config = getSidebarConfig(settings);
  renderSidebarEditor(config.items, config.showGroupTitles);
  const showToggle = document.getElementById("sidebarShowGroupTitles");
  if (showToggle) showToggle.checked = config.showGroupTitles;
}

function renderSidebarEditor(items, showGroupTitles) {
  const container = document.getElementById("sidebarEditor");
  if (!container) return;

  let html = "";
  items.forEach((item, index) => {
    if (item.type === "group") {
      html += renderSidebarGroupRow(item, index, showGroupTitles);
    } else {
      html += renderSidebarLinkRow(item, index, 0);
    }
  });

  container.innerHTML = "";
  container.insertAdjacentHTML("beforeend", html);
}

function renderSidebarGroupRow(group, index, showGroupTitles) {
  const title = escapeHtml(group.title || "Untitled group");
  const visible = group.visible !== false;
  const visibleCount = (group.items || []).filter((sub) => sub.visible !== false).length;
  const total = (group.items || []).length;

  let html = `<li class="sidebar-editor-item" data-sidebar-key="group:${escapeAttribute(group.title)}" data-sidebar-index="${index}">
    <div class="sidebar-editor-row ${visible ? "" : "dimmed"}">
      <span class="sidebar-editor-handle" title="Drag to reorder"><i class="fas fa-grip-vertical"></i></span>
      <label class="sidebar-editor-checkbox">
        <input type="checkbox" ${visible ? "checked" : ""} onchange="toggleSidebarGroup(${index}, this.checked)">
      </label>
      <span class="sidebar-editor-icon"><i class="fas fa-folder-open" aria-hidden="true"></i></span>
      <span class="sidebar-editor-label">${title}</span>
      <span class="sidebar-editor-meta">${visibleCount}/${total} visible</span>
      <button class="btn-icon btn-sm btn-sidebar-toggle" onclick="toggleSidebarGroupItems(${index})" title="Expand or collapse"><i class="fas fa-chevron-down"></i></button>
      <button class="btn-icon btn-sm" onclick="moveSidebarItem(${index}, -1)" title="Move up"><i class="fas fa-chevron-up"></i></button>
      <button class="btn-icon btn-sm" onclick="moveSidebarItem(${index}, 1)" title="Move down"><i class="fas fa-chevron-down"></i></button>
    </div>
    <ul class="sidebar-editor-children" data-sidebar-children="${index}">
      ${renderSidebarGroupChildren(group, index)}
    </ul>
  </li>`;
  return html;
}

function renderSidebarLinkRow(item, index, depth) {
  const label = escapeHtml(item.label || item.view);
  const icon = escapeHtml(item.icon || "fas fa-circle");
  const visible = item.visible !== false;
  const indent = depth * 18;

  return `<li class="sidebar-editor-item" data-sidebar-key="${escapeAttribute(item.view)}" data-sidebar-index="${index}">
    <div class="sidebar-editor-row ${visible ? "" : "dimmed"}">
      <span class="sidebar-editor-handle" title="Drag to reorder"><i class="fas fa-grip-vertical"></i></span>
      <label class="sidebar-editor-checkbox">
        <input type="checkbox" ${visible ? "checked" : ""} onchange="toggleSidebarItem(${index}, this.checked)">
      </label>
      <span class="sidebar-editor-icon"><i class="${icon}"></i></span>
      <span class="sidebar-editor-label" style="padding-left:${indent}px">${label}</span>
    </div>
  </li>`;
}

function renderSidebarGroupChildren(group, groupIndex) {
  let html = "";
  (group.items || []).forEach((sub, subIndex) => {
    html += `<li class="sidebar-editor-subitem" data-sidebar-subindex="${subIndex}">
      <div class="sidebar-editor-row ${sub.visible !== false ? "" : "dimmed"}">
        <span class="sidebar-editor-handle"><i class="fas fa-ellipsis-vertical"></i></span>
        <label class="sidebar-editor-checkbox">
          <input type="checkbox" ${sub.visible !== false ? "checked" : ""} onchange="toggleSidebarSubItem(${groupIndex}, ${subIndex}, this.checked)">
        </label>
        <span class="sidebar-editor-icon"><i class="${escapeHtml(sub.icon || "fas fa-circle")}"></i></span>
        <span class="sidebar-editor-label">${escapeHtml(sub.label || sub.view)}</span>
      </div>
    </li>`;
  });
  return html;
}

function toggleSidebarItem(groupIndex, visible) {
  const config = getSidebarConfig(state.systemSettings);
  if (!config.items[groupIndex] || config.items[groupIndex].type !== "group") return;

  const group = config.items[groupIndex];
  (group.items || []).forEach((sub) => { sub.visible = visible; });

  state.systemSettings = state.systemSettings || {};
  state.systemSettings.sidebar = state.systemSettings.sidebar || {};
  state.systemSettings.sidebar.items = config.items;
  renderSidebarEditor(config.items, config.showGroupTitles);
}

function toggleSidebarSubItem(groupIndex, subIndex, visible) {
  const config = getSidebarConfig(state.systemSettings);
  const group = config.items[groupIndex];
  if (!group || !group.items[subIndex]) return;

  group.items[subIndex].visible = visible;

  state.systemSettings = state.systemSettings || {};
  state.systemSettings.sidebar = state.systemSettings.sidebar || {};
  state.systemSettings.sidebar.items = config.items;

  const groupRow = document.querySelector(`.sidebar-editor-item[data-sidebar-index="${groupIndex}"]`);
  const visibleCount = (group.items || []).filter((sub) => sub.visible !== false).length;
  const meta = groupRow?.querySelector(".sidebar-editor-meta");
  if (meta) meta.textContent = `${visibleCount}/${group.items.length} visible`;
}

function toggleSidebarGroup(groupIndex, visible) {
  const config = getSidebarConfig(state.systemSettings);
  if (config.items[groupIndex] && config.items[groupIndex].type === "group") {
    config.items[groupIndex].visible = visible;
    if (visible) {
      (config.items[groupIndex].items || []).forEach((sub) => {
        sub.visible = true;
      });
    }
    state.systemSettings = state.systemSettings || {};
    state.systemSettings.sidebar = state.systemSettings.sidebar || {};
    state.systemSettings.sidebar.items = config.items;
    renderSidebarEditor(config.items, config.showGroupTitles);
  }
}

function toggleSidebarGroupItems(groupIndex) {
  const childrenContainer = document.querySelector(`.sidebar-editor-children[data-sidebar-children="${groupIndex}"]`);
  const li = document.querySelector(`.sidebar-editor-item[data-sidebar-index="${groupIndex}"]`);
  if (!childrenContainer || !li) return;

  const isCollapsed = li.classList.toggle("collapsed");
  childrenContainer.style.display = isCollapsed ? "none" : "block";
  const toggleBtn = li.querySelector(".btn-sidebar-toggle i");
  if (toggleBtn) toggleBtn.className = isCollapsed ? "fas fa-chevron-right" : "fas fa-chevron-down";
}

function moveSidebarItem(index, direction) {
  const config = getSidebarConfig(state.systemSettings);
  const items = config.items;
  if (index < 0 || index >= items.length) return;

  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= items.length) return;

  const moved = items.splice(index, 1)[0];
  items.splice(newIndex, 0, moved);

  state.systemSettings = state.systemSettings || {};
  state.systemSettings.sidebar = state.systemSettings.sidebar || {};
  state.systemSettings.sidebar.items = items;
  renderSidebarEditor(items, config.showGroupTitles);
}

function saveSidebarGroupTitles() {
  const showToggle = document.getElementById("sidebarShowGroupTitles");
  if (!showToggle) return;
  const showGroupTitles = showToggle.checked;
  state.systemSettings = state.systemSettings || {};
  state.systemSettings.sidebar = state.systemSettings.sidebar || {};
  state.systemSettings.sidebar.showGroupTitles = showGroupTitles;
}

function collectSidebarSettings() {
  const config = getSidebarConfig(state.systemSettings);
  const showToggle = document.getElementById("sidebarShowGroupTitles");
  const showGroupTitles = showToggle ? showToggle.checked : config.showGroupTitles;
  return {
    showGroupTitles,
    items: config.items || [],
  };
}

function restoreDefaultSidebar() {
  state.systemSettings = state.systemSettings || {};
  state.systemSettings.sidebar = { items: JSON.parse(JSON.stringify(DEFAULT_SIDEBAR_ITEMS)), showGroupTitles: true };
  populateSidebarSettings(state.systemSettings);
  showToast("Sidebar restored to defaults", "success");
}
window.restoreDefaultSidebar = restoreDefaultSidebar;

function setInputValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value ?? "";
}

function setInputChecked(id, value) {
  const element = document.getElementById(id);
  if (element) element.checked = Boolean(value);
}

function collectDirectorySettings() {
  return {
    enabled: document.getElementById("directoryEnabled")?.checked || false,
    name:
      document.getElementById("directoryName")?.value.trim() ||
      "Microsoft Active Directory",
    host: document.getElementById("directoryHost")?.value.trim() || "",
    port: Number(document.getElementById("directoryPort")?.value || 389),
    useTls: document.getElementById("directoryUseTls")?.checked || false,
    useLdaps: document.getElementById("directoryUseLdaps")?.checked || false,
    baseDn: document.getElementById("directoryBaseDn")?.value.trim() || "",
    bindDn: document.getElementById("directoryBindDn")?.value.trim() || "",
    bindPassword: document.getElementById("directoryBindPassword")?.value || "",
    userFilter:
      document.getElementById("directoryUserFilter")?.value.trim() || "",
    loginField:
      document.getElementById("directoryLoginField")?.value.trim() ||
      "samaccountname",
    syncField:
      document.getElementById("directorySyncField")?.value.trim() ||
      "objectguid",
    emailField:
      document.getElementById("directoryEmailField")?.value.trim() || "mail",
    firstNameField:
      document.getElementById("directoryFirstNameField")?.value.trim() ||
      "givenname",
    surnameField:
      document.getElementById("directorySurnameField")?.value.trim() || "sn",
    phoneField:
      document.getElementById("directoryPhoneField")?.value.trim() ||
      "telephonenumber",
    mobileField:
      document.getElementById("directoryMobileField")?.value.trim() || "mobile",
    titleField:
      document.getElementById("directoryTitleField")?.value.trim() || "title",
    departmentField:
      document.getElementById("directoryDepartmentField")?.value.trim() ||
      "department",
    pageSize: Number(
      document.getElementById("directoryPageSize")?.value || 1000,
    ),
    deletedUserStrategy: Number(
      document.getElementById("directoryDeletedStrategy")?.value || 3,
    ),
    authLdapId: Number(
      document.getElementById("directoryAuthLdapId")?.value || 0,
    ),
  };
}

function collectSystemSettings() {
  const settings = {
    organization: {
      name:
        document.getElementById("settingsOrganizationName")?.value.trim() ||
        "GLPI Asset Hub",
      subtitle:
        document.getElementById("settingsOrganizationSubtitle")?.value.trim() ||
        "IT operations",
      workspaceName:
        document.getElementById("settingsWorkspaceName")?.value.trim() ||
        "Primary workspace",
    },
    general: {
      currency: document.getElementById("settingsCurrency")?.value || "KES",
      timezone:
        document.getElementById("settingsTimezone")?.value || "Africa/Nairobi",
      warrantyWarningDays: Number(
        document.getElementById("settingsWarrantyDays")?.value || 30,
      ),
      itemsPerPage: Number(
        document.getElementById("settingsItemsPerPage")?.value || 10,
      ),
      lowStockAlertsEnabled:
        document.getElementById("settingsLowStockAlerts")?.checked ?? true,
    },
    directory: collectDirectorySettings(),
  };
  settings.sidebar = collectSidebarSettings();
  return settings;
}

async function saveSystemSettings() {
  const button = document.getElementById("saveSettingsBtn");
  const original = button?.innerHTML;

  if (button) {
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving';
  }

  try {
    const settings = await glpi.saveSettings(collectSystemSettings());
    state.systemSettings = mergeFrontendSettings(
      state.systemSettings || {},
      settings || {},
    );
    state.settingsLoaded = true;
    applySystemSettings(state.systemSettings);
    populateSettingsForm(state.systemSettings);
    showToast("System settings saved", "success");
  } catch (error) {
    showToast(error.message || "Unable to save settings", "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = original;
    }
  }
}
window.saveSystemSettings = saveSystemSettings;

let settingsLogs = [];
let settingsAccessUsers = [];
let settingsAccessProfiles = [];

function settingsDisplayDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function getSettingsLogAction(entry) {
  const action = entry.linked_action ?? entry.action;
  if (typeof action === "string" && action.trim() && !Number.isFinite(Number(action))) return action;

  const actionLabels = {
    0: "Log message",
    1: "Component added",
    2: "Component changed",
    3: "Component deleted",
    4: "Software installed",
    5: "Software uninstalled",
    6: "Item disconnected",
    7: "Item connected",
    8: "Component locked",
    9: "Component unlocked",
    12: "Log message",
    13: "Item deleted",
    14: "Item restored",
    15: "Item linked",
    16: "Item unlinked",
    17: "Sub-item added",
    18: "Sub-item updated",
    19: "Sub-item deleted",
    20: "Item added",
    21: "Item link updated",
    22: "Item link locked",
    23: "Sub-item locked",
    24: "Item link unlocked",
    25: "Sub-item unlocked",
    26: "Item locked",
    27: "Item unlocked",
  };
  return actionLabels[Number(action)] || (action ? `Action ${action}` : "Updated");
}

function getSettingsLogDetails(entry) {
  if (entry.change || entry.message) return entry.change || entry.message;
  const oldValue = entry.old_value == null ? "" : String(entry.old_value);
  const newValue = entry.new_value == null ? "" : String(entry.new_value);
  if (oldValue && newValue) return `${oldValue} -> ${newValue}`;
  return newValue || oldValue || "-";
}

function getSettingsLogText(entry) {
  return [
    entry.date,
    entry.date_mod,
    entry.user_name,
    entry.user,
    entry.itemtype,
    entry.itemtype_name,
    entry.items_id,
    getSettingsLogAction(entry),
    getSettingsLogDetails(entry),
  ].filter(Boolean).join(" ").toLowerCase();
}

async function loadSettingsLogs(force = false) {
  const body = document.getElementById("settingsLogsBody");
  if (!body || (settingsLogs.length && !force)) {
    filterSettingsLogs();
    return;
  }
  body.innerHTML = '<tr><td colspan="5"><div class="loading"><div class="spinner"></div></div></td></tr>';
  try {
    const limit = Number(document.getElementById("settingsLogLimit")?.value || 25);
    const result = await glpi.getItems("Log", { range: `0-${limit - 1}`, sort: "date_mod", order: "DESC" });
    settingsLogs = Array.isArray(result) ? result.filter(entry => entry && typeof entry === "object") : [];
    filterSettingsLogs();
    setSettingsInlineStatus("settingsLogsStatus", `${settingsLogs.length} log entr${settingsLogs.length === 1 ? "y" : "ies"} loaded`, "success");
  } catch (error) {
    settingsLogs = [];
    body.innerHTML = `<tr><td colspan="5">${renderInlineError(formatApiError(error), "loadSettingsLogs()")}</td></tr>`;
    setSettingsInlineStatus("settingsLogsStatus", "Logs could not be loaded", "error");
  }
}
window.loadSettingsLogs = loadSettingsLogs;

function filterSettingsLogs() {
  const body = document.getElementById("settingsLogsBody");
  if (!body) return;
  const term = String(document.getElementById("settingsLogSearch")?.value || "").trim().toLowerCase();
  const rows = settingsLogs.filter(entry => !term || getSettingsLogText(entry).includes(term));
  const emptyMessage = settingsLogs.length ? "No matching log entries." : "No log entries recorded.";
  body.innerHTML = rows.length ? rows.map(entry => {
    const item = entry.itemtype_name || entry.itemtype || "-";
    const itemId = entry.items_id ? ` #${entry.items_id}` : "";
    return `<tr><td data-label="Date">${escapeHtml(settingsDisplayDate(entry.date || entry.date_mod))}</td><td data-label="User">${escapeHtml(entry.user_name || entry.user || "System")}</td><td data-label="Action"><span class="status-badge neutral">${escapeHtml(getSettingsLogAction(entry))}</span></td><td data-label="Item">${escapeHtml(`${item}${itemId}`)}</td><td data-label="Details">${escapeHtml(getSettingsLogDetails(entry))}</td></tr>`;
  }).join("") : `<tr><td colspan="5"><div class="empty-state compact"><i class="fas fa-filter-circle-xmark"></i><p>${emptyMessage}</p></div></td></tr>`;
}
window.filterSettingsLogs = filterSettingsLogs;

function getSettingsUserName(user) {
  return [user.firstname, user.realname].filter(Boolean).join(" ").trim() || user.name || user.login || `User #${user.id}`;
}

function getSettingsUserProfileId(user) {
  return Number(user.profiles_id || user.profile_id || user.profileId || 0);
}

function getSettingsUserProfileName(user) {
  return user.profiles_name || user.profile_name || user.profile || "Unassigned";
}

async function loadSettingsAccess(force = false) {
  const body = document.getElementById("settingsAccessBody");
  if (!body || (settingsAccessUsers.length && !force)) {
    filterSettingsAccess();
    return;
  }
  body.innerHTML = '<tr><td colspan="5"><div class="loading"><div class="spinner"></div></div></td></tr>';
  try {
    const [users, profiles] = await Promise.all([glpi.getItems("User", { range: "0-1000", is_active: 1 }), glpi.getItems("Profile", { range: "0-100" })]);
    settingsAccessUsers = Array.isArray(users) ? users : [];
    settingsAccessProfiles = Array.isArray(profiles) ? profiles : [];
    filterSettingsAccess();
    setSettingsInlineStatus("settingsAccessStatus", `${settingsAccessUsers.length} user${settingsAccessUsers.length === 1 ? "" : "s"} loaded`, "success");
  } catch (error) {
    settingsAccessUsers = [];
    body.innerHTML = `<tr><td colspan="5">${renderInlineError(formatApiError(error), "loadSettingsAccess()")}</td></tr>`;
    setSettingsInlineStatus("settingsAccessStatus", "Access levels could not be loaded", "error");
  }
}
window.loadSettingsAccess = loadSettingsAccess;

function filterSettingsAccess() {
  const body = document.getElementById("settingsAccessBody");
  if (!body) return;
  const term = String(document.getElementById("settingsAccessSearch")?.value || "").trim().toLowerCase();
  const users = settingsAccessUsers.filter(user => !term || [getSettingsUserName(user), user.login, user.name, getUserEmail(user)].join(" ").toLowerCase().includes(term));
  body.innerHTML = users.length ? users.map(user => `<tr><td data-label="User"><strong>${escapeHtml(getSettingsUserName(user))}</strong><small class="settings-table-subtext">${escapeHtml(getUserEmail(user))}</small></td><td data-label="Login">${escapeHtml(user.login || user.name || "-")}</td><td data-label="Account"><span class="status-badge ${String(user.is_active ?? user.active ?? 1) === "0" ? "retired" : "available"}">${String(user.is_active ?? user.active ?? 1) === "0" ? "Disabled" : "Active"}</span></td><td data-label="Access level">${escapeHtml(getSettingsUserProfileName(user))}</td><td data-label="Change"><select class="form-control settings-profile-select" onchange="changeUserAccessLevel(${Number(user.id)}, this.value)" aria-label="Change access for ${escapeAttribute(getSettingsUserName(user))}"><option value="">Select profile</option>${settingsAccessProfiles.map(profile => `<option value="${Number(profile.id)}" ${Number(profile.id) === getSettingsUserProfileId(user) ? "selected" : ""}>${escapeHtml(profile.name || `Profile #${profile.id}`)}</option>`).join("")}</select></td></tr>`).join("") : '<tr><td colspan="5"><div class="empty-state compact"><i class="fas fa-user-slash"></i><p>No matching users.</p></div></td></tr>';
}
window.filterSettingsAccess = filterSettingsAccess;

async function changeUserAccessLevel(userId, profileId) {
  if (!profileId) return;
  const user = settingsAccessUsers.find(item => Number(item.id) === Number(userId));
  const profile = settingsAccessProfiles.find(item => Number(item.id) === Number(profileId));
  if (!user || !profile) return;
  try {
    await glpi.updateItem("User", userId, { profiles_id: Number(profileId) });
    user.profiles_id = Number(profileId);
    user.profiles_name = profile.name;
    filterSettingsAccess();
    showToast(`${getSettingsUserName(user)} access updated`, "success");
  } catch (error) {
    filterSettingsAccess();
    showToast(formatApiError(error, "Unable to update user access"), "error");
  }
}
window.changeUserAccessLevel = changeUserAccessLevel;

function setSettingsInlineStatus(id, message, tone) {
  const element = document.getElementById(id);
  if (!element) return;
  element.hidden = false;
  element.className = `settings-inline-status ${tone || ""}`;
  element.textContent = message;
}

async function uploadOrganizationLogo() {
  const input = document.getElementById("organizationLogoInput");
  const file = input?.files?.[0];

  if (!file) {
    showToast("Choose a logo file first", "error");
    return;
  }

  const button = document.getElementById("uploadLogoBtn");
  const original = button?.innerHTML;

  if (button) {
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Uploading';
  }

  try {
    const result = await glpi.uploadOrganizationLogo(file);
    state.systemSettings = mergeFrontendSettings(
      state.systemSettings || {},
      result.settings || { organization: { logoUrl: result.logoUrl } },
    );
    applySystemSettings(state.systemSettings);

    if (input) input.value = "";
    const label = document.getElementById("selectedLogoName");
    if (label) label.textContent = "Logo uploaded successfully";

    showToast("Organization logo updated", "success");
  } catch (error) {
    showToast(error.message || "Unable to upload logo", "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = original;
    }
  }
}
window.uploadOrganizationLogo = uploadOrganizationLogo;

function toggleDirectoryPassword() {
  const input = document.getElementById("directoryBindPassword");
  if (!input) return;

  input.type = input.type === "password" ? "text" : "password";
}
window.toggleDirectoryPassword = toggleDirectoryPassword;

async function testDirectoryConnection() {
  const button = document.getElementById("testDirectoryBtn");
  const original = button?.innerHTML;

  setDirectoryActionState("testing", "Testing Active Directory connection...");

  if (button) {
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Testing';
  }

  try {
    const result = await glpi.testDirectory(collectDirectorySettings());
    setDirectoryActionState(
      "success",
      result.message || "Connection succeeded",
    );
    showToast("Active Directory connection succeeded", "success");

    state.systemSettings = mergeFrontendSettings(state.systemSettings || {}, {
      directory: {
        lastTestAt: result.testedAt,
        lastTestStatus: "success",
      },
    });
    renderDirectoryStatus(state.systemSettings);
  } catch (error) {
    setDirectoryActionState("error", error.message || "Connection failed");
    showToast(error.message || "Active Directory connection failed", "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = original;
    }
  }
}
window.testDirectoryConnection = testDirectoryConnection;

async function previewDirectoryUsers() {
  const button = document.getElementById("previewDirectoryBtn");
  const original = button?.innerHTML;

  if (button) {
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Loading';
  }

  try {
    const result = await glpi.previewDirectory(collectDirectorySettings(), 50);
    state.directoryPreviewUsers = Array.isArray(result.users)
      ? result.users
      : [];
    renderDirectoryPreview(state.directoryPreviewUsers);
    showToast(
      `${state.directoryPreviewUsers.length} directory users loaded`,
      "success",
    );
  } catch (error) {
    showToast(error.message || "Unable to preview directory users", "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = original;
    }
  }
}
window.previewDirectoryUsers = previewDirectoryUsers;

async function syncDirectoryUsers(mode = "all") {
  const buttons = [
    document.getElementById("syncUpdateBtn"),
    document.getElementById("syncCreateBtn"),
    document.getElementById("syncAllBtn"),
  ].filter(Boolean);

  const selectedButton = {
    update: document.getElementById("syncUpdateBtn"),
    create: document.getElementById("syncCreateBtn"),
    all: document.getElementById("syncAllBtn"),
  }[mode];

  const originalContent = selectedButton?.innerHTML;

  buttons.forEach((button) => {
    button.disabled = true;
  });

  if (selectedButton) {
    selectedButton.innerHTML =
      '<i class="fas fa-circle-notch fa-spin"></i> Synchronizing';
  }

  const output = document.getElementById("syncOutput");
  const outputText = document.getElementById("syncOutputText");

  if (output) output.hidden = false;
  if (outputText) {
    outputText.textContent = "Starting Active Directory synchronization...\n";
  }

  try {
    const directory = collectDirectorySettings();

    if (!directory.enabled) {
      throw new Error(
        "Enable Active Directory and save the settings before synchronizing.",
      );
    }

    if (!directory.host || !directory.baseDn) {
      throw new Error("The directory host and Base DN are required.");
    }

    const result = await glpi.syncDirectory(directory, mode);
    const summary = result.summary || {};
    const errors = Array.isArray(result.errors) ? result.errors : [];

    const lines = [
      `Status: ${result.status || "completed"}`,
      `Mode: ${summary.mode || mode}`,
      `Directory users found: ${summary.directoryUsers || 0}`,
      `Created in GLPI: ${summary.created || 0}`,
      `Updated in GLPI: ${summary.updated || 0}`,
      `Skipped: ${summary.skipped || 0}`,
      `Errors: ${summary.errors || 0}`,
      `GLPI AuthLDAP ID: ${result.authLdapId || "Not returned"}`,
      `Completed: ${formatSettingsDate(result.syncedAt)}`,
    ];

    if (errors.length) {
      lines.push("", "Errors:");
      errors.forEach((error) => {
        lines.push(
          `- ${error.login || "Unknown user"}: ${error.message || "Unknown error"}`,
        );
      });
    }

    if (outputText) {
      outputText.textContent = lines.join("\n");
    }

    state.systemSettings = mergeFrontendSettings(
      state.systemSettings || {},
      result.settings || {
        directory: {
          authLdapId: result.authLdapId,
          lastSyncAt: result.syncedAt,
          lastSyncStatus: result.status,
          lastSyncSummary: summary,
        },
      },
    );

    state.settingsLoaded = true;
    populateSettingsForm(state.systemSettings);
    renderDirectoryStatus(state.systemSettings);

    if (state.currentView === "users") {
      await loadUsers();
    } else {
      state.users = [];
    }

    const message = errors.length
      ? `Synchronization completed with ${errors.length} error${errors.length === 1 ? "" : "s"}`
      : `Synchronization complete: ${summary.created || 0} created, ${summary.updated || 0} updated`;

    showToast(message, errors.length ? "error" : "success");
  } catch (error) {
    if (outputText) {
      outputText.textContent = `Synchronization failed\n\n${error.message || error}`;
    }

    showToast(
      error.message || "Active Directory synchronization failed",
      "error",
    );
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
    });

    if (selectedButton) {
      selectedButton.innerHTML = originalContent;
    }
  }
}
window.syncDirectoryUsers = syncDirectoryUsers;

function renderDirectoryPreview(users) {
  const section = document.getElementById("directoryPreviewSection");
  const table = document.getElementById("directoryPreviewTable");
  const count = document.getElementById("directoryPreviewCount");

  if (!section || !table) return;

  section.hidden = false;
  if (count)
    count.textContent = `${users.length} ${users.length === 1 ? "user" : "users"}`;

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

  table.innerHTML = users
    .map(
      (user) => `
        <tr>
            <td data-label="Login"><strong>${escapeHtml(user.login || "-")}</strong></td>
            <td data-label="Name">${escapeHtml([user.firstName, user.surname].filter(Boolean).join(" ") || "-")}</td>
            <td data-label="Email">${escapeHtml(user.email || "-")}</td>
            <td data-label="Department">${escapeHtml(user.department || "-")}</td>
            <td data-label="Job title">${escapeHtml(user.title || "-")}</td>
        </tr>
    `,
    )
    .join("");
}

function setDirectoryActionState(status, message) {
  const element = document.getElementById("directoryTestStatus");
  if (!element) return;

  element.className = `directory-status ${status}`;
  element.innerHTML = `<i class="fas ${status === "success" ? "fa-circle-check" : status === "error" ? "fa-circle-xmark" : "fa-circle-notch fa-spin"}"></i><span>${escapeHtml(message)}</span>`;
}

function renderDirectoryStatus(settings) {
  const directory = settings?.directory || {};

  const directoryStatus = document.getElementById("syncDirectoryStatus");
  const directoryDetail = document.getElementById("syncDirectoryDetail");
  const lastTest = document.getElementById("syncLastTest");
  const lastTestResult = document.getElementById("syncLastTestResult");
  const lastRun = document.getElementById("syncLastRun");
  const lastRunResult = document.getElementById("syncLastRunResult");
  const authLdapId = document.getElementById("syncAuthLdapId");

  if (directoryStatus)
    directoryStatus.textContent = directory.enabled ? "Enabled" : "Disabled";
  if (directoryDetail) {
    directoryDetail.textContent = directory.host
      ? `${directory.host}:${directory.port || 389}`
      : "Directory host not configured.";
  }

  if (lastTest)
    lastTest.textContent = directory.lastTestAt
      ? formatSettingsDate(directory.lastTestAt)
      : "Never";
  if (lastTestResult)
    lastTestResult.textContent =
      directory.lastTestStatus || "No result recorded";
  if (lastRun)
    lastRun.textContent = directory.lastSyncAt
      ? formatSettingsDate(directory.lastSyncAt)
      : "Never";
  if (lastRunResult)
    lastRunResult.textContent =
      directory.lastSyncStatus || "No synchronization recorded";
  if (authLdapId)
    authLdapId.textContent =
      Number(directory.authLdapId) > 0
        ? `#${directory.authLdapId}`
        : "Not linked";

  if (directory.lastTestStatus === "success") {
    setDirectoryActionState(
      "success",
      `Connection tested ${formatSettingsDate(directory.lastTestAt)}`,
    );
  } else if (directory.lastTestStatus === "error") {
    setDirectoryActionState("error", "The last connection test failed.");
  } else {
    const status = document.getElementById("directoryTestStatus");
    if (status) {
      status.className = "directory-status neutral";
      status.innerHTML =
        '<i class="fas fa-circle"></i><span>Connection has not been tested.</span>';
    }
  }
}

function formatSettingsDate(value) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
