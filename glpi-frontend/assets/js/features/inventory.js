/**
 * GLPI Agent inventory and installed-software visibility.
 */

async function loadInventoryHealth() {
  const tbody = document.getElementById("inventoryHealthTable");

  if (!tbody) return;

  tbody.innerHTML = `
        <tr>
            <td colspan="8">
                <div class="loading"><div class="spinner"></div></div>
            </td>
        </tr>
    `;

  try {
    const summary = await glpi.getInventorySummary();

    if (!summary) {
      throw new Error("Inventory health requires the PHP backend server.");
    }

    state.inventoryHealth = summary;

    setTextIfPresent("healthTotal", summary.total || 0);
    setTextIfPresent("healthAgents", summary.agentsTotal || 0);
    setTextIfPresent("healthReporting24", summary.reporting24Hours || 0);
    setTextIfPresent("healthReporting", summary.reporting7Days || 0);
    setTextIfPresent("healthStale", summary.stale14Days || 0);
    setTextIfPresent("healthNever", summary.neverReported || 0);

    renderInventoryHealth();

    if (summary.stale14Days > 0) {
      addAlert(
        "Stale inventory agents",
        `${summary.stale14Days} agent(s) have not reported in over 14 days`,
        "warning",
        "inventory-stale",
      );
    }
    if (summary.neverReported > 0) {
      addAlert(
        "Unreported inventory agents",
        `${summary.neverReported} agent(s) have never reported inventory`,
        "info",
        "inventory-never",
      );
    }
    if (summary.items) {
      const critical = summary.items.filter((item) =>
        String(item.status || "")
          .toLowerCase()
          .includes("critical"),
      );
      if (critical.length) {
        addAlert(
          "Critical inventory status",
          `${critical.length} computer(s) report critical inventory status`,
          "danger",
          "inventory-critical",
        );
      }
    }
    updateNotificationBadge();
  } catch (error) {
    tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state error-state">
                        <i class="fas fa-triangle-exclamation"></i>
                        <h3>Inventory unavailable</h3>
                        <p>${escapeHtml(
                          formatApiError(
                            error,
                            "Unable to load GLPI Agent inventory.",
                          ),
                        )}</p>
                    </div>
                </td>
            </tr>
        `;
  }
}
window.loadInventoryHealth = loadInventoryHealth;

function renderInventoryHealth() {
  const tbody = document.getElementById("inventoryHealthTable");

  if (!tbody) return;

  const items = state.inventoryHealth?.items || [];
  const search = (document.getElementById("inventoryHealthSearch")?.value || "")
    .trim()
    .toLowerCase();
  const statusFilter =
    document.getElementById("inventoryHealthStatusFilter")?.value || "";
  const agentFilter =
    document.getElementById("inventoryHealthAgentFilter")?.value || "";

  let filtered = items.filter((item) => {
    const normalizedStatus = normalizeInventoryPageStatus(item.status);

    if (statusFilter && normalizedStatus !== statusFilter) {
      return false;
    }

    if (agentFilter === "managed" && !item.isAgentManaged) {
      return false;
    }

    if (agentFilter === "unmanaged" && item.isAgentManaged) {
      return false;
    }

    if (!search) return true;

    return [
      item.name,
      item.serial,
      item.agentName,
      item.agentVersion,
      item.agentTag,
      item.remoteAddress,
    ].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(search),
    );
  });

  if (state.sortConfig.key && state.sortConfig.view === "inventoryHealth") {
    filtered = sortRows(
      filtered,
      state.sortConfig.key,
      state.sortConfig.direction,
      "inventoryHealth",
    );
  }

  tbody.innerHTML = filtered.length
    ? filtered
        .map(
          (item) => `
            <tr>
                <td>
                    <div class="inventory-computer-cell">
                        <strong>${escapeHtml(item.name || "Unnamed")}</strong>
                        <small>
                            ${
                              item.isDynamic
                                ? "Agent inventory"
                                : "Manual GLPI record"
                            }
                        </small>
                    </div>
                </td>
                <td>${escapeHtml(item.serial || "-")}</td>
                <td>
                    ${
                      item.isAgentManaged
                        ? `
                                <div class="inventory-computer-cell">
                                    <strong>${escapeHtml(
                                      item.agentName || "Registered",
                                    )}</strong>
                                    <small>${escapeHtml(
                                      item.agentTag || item.remoteAddress || "",
                                    )}</small>
                                </div>
                            `
                        : '<span class="inventory-muted">Not registered</span>'
                    }
                </td>
                <td>${escapeHtml(item.agentVersion || "-")}</td>
                <td>${formatInventoryPageDate(item.lastContact)}</td>
                <td>${formatInventoryPageDate(item.lastInventory)}</td>
                <td>${inventoryPageStatusBadge(item.status)}</td>
                <td class="actions">
                    <button
                        class="btn-icon"
                        title="Open computer inventory"
                        onclick="openComputerInventory(${Number(item.id)})"
                    >
                        <i class="fas fa-microchip"></i>
                    </button>
                    <button
                        class="btn-icon"
                        title="Open computer record"
                        onclick="viewAsset('Computer', ${Number(item.id)})"
                    >
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `,
        )
        .join("")
    : `
            <tr>
                <td colspan="8">
                    <div class="empty-state compact">
                        <i class="fas fa-computer"></i>
                        <h3>No matching computers</h3>
                        <p>Adjust the health or agent filters.</p>
                    </div>
                </td>
            </tr>
        `;

  const note = document.getElementById("inventoryHealthResultNote");

  if (note) {
    note.textContent = `${filtered.length} of ${items.length} computers shown.`;
  }
}
window.renderInventoryHealth = renderInventoryHealth;

async function openComputerInventory(id) {
  await viewAsset("Computer", id);
  switchAssetTab("inventory");
}
window.openComputerInventory = openComputerInventory;

async function loadSoftwareMatrix() {
  const tbody = document.getElementById("softwareMatrixTable");

  if (!tbody) return;

  tbody.innerHTML = `
        <tr>
            <td colspan="6">
                <div class="loading"><div class="spinner"></div></div>
            </td>
        </tr>
    `;

  try {
    const data = await glpi.getSoftwareInstallations();

    if (!data) {
      throw new Error("Software matrix requires the PHP backend server.");
    }

    state.softwareMatrixData = data;
    state.softwareMatrix = Array.isArray(data.matrix)
      ? data.matrix
      : buildSoftwareMatrix(data);

    setTextIfPresent(
      "softwareTotalCount",
      data.totals?.software ?? state.softwareMatrix.length,
    );
    setTextIfPresent("softwareVersionCount", data.totals?.versions ?? 0);
    setTextIfPresent(
      "softwareInstallationCount",
      data.totals?.installations ?? 0,
    );
    setTextIfPresent("softwareComputerCount", data.totals?.computers ?? 0);
    setTextIfPresent("softwareLicenseCount", data.totals?.licenses ?? 0);

    renderSoftwareMatrix();
  } catch (error) {
    tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state error-state">
                        <i class="fas fa-triangle-exclamation"></i>
                        <h3>Software data unavailable</h3>
                        <p>${escapeHtml(
                          formatApiError(
                            error,
                            "Unable to load software inventory.",
                          ),
                        )}</p>
                    </div>
                </td>
            </tr>
        `;
  }
}
window.loadSoftwareMatrix = loadSoftwareMatrix;

function renderSoftwareMatrix() {
  const tbody = document.getElementById("softwareMatrixTable");

  if (!tbody || !state.softwareMatrix) return;

  const search = (document.getElementById("softwareMatrixSearch")?.value || "")
    .trim()
    .toLowerCase();
  const coverage =
    document.getElementById("softwareMatrixCoverageFilter")?.value || "";

  let filtered = state.softwareMatrix.filter((row) => {
    const computerCount = Number(row.computerCount || 0);

    if (coverage === "multiple" && computerCount < 2) {
      return false;
    }

    if (coverage === "single" && computerCount !== 1) {
      return false;
    }

    if (!search) return true;

    return [
      row.name,
      row.publisher,
      ...(row.versions || []),
      ...(row.computers || []),
    ].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(search),
    );
  });

  if (state.sortConfig.key) {
    filtered = sortRows(
      filtered,
      state.sortConfig.key,
      state.sortConfig.direction,
      "softwareMatrix",
    );
  }

  const maximumVisible = 250;
  const visible = filtered.slice(0, maximumVisible);

  tbody.innerHTML = visible.length
    ? visible
        .map(
          (row) => `
            <tr>
                <td>
                    <div class="inventory-computer-cell">
                        <strong>${escapeHtml(row.name || "Unnamed")}</strong>
                        <small>GLPI software #${Number(row.id) || "-"}</small>
                    </div>
                </td>
                <td>${escapeHtml(row.publisher || "-")}</td>
                <td>${Number(row.versionCount || 0)}</td>
                <td>${Number(row.computerCount || 0)}</td>
                <td>${Number(row.installCount || 0)}</td>
                <td>${renderLicenseCell(row.license)}</td>
                <td>
                    ${renderSoftwareDeploymentDetails(row)}
                </td>
            </tr>
        `,
        )
        .join("")
    : `
            <tr>
                <td colspan="7">
                    <div class="empty-state compact">
                        <i class="fas fa-layer-group"></i>
                        <h3>No matching software</h3>
                        <p>Search by product, version, publisher or computer.</p>
                    </div>
                </td>
            </tr>
        `;

  const note = document.getElementById("softwareMatrixResultNote");

  if (note) {
    note.textContent =
      filtered.length > maximumVisible
        ? `Showing the first ${maximumVisible} of ${filtered.length} matching products.`
        : `${filtered.length} of ${state.softwareMatrix.length} software products shown.`;
  }
}
window.renderSoftwareMatrix = renderSoftwareMatrix;

function renderLicenseCell(license) {
  if (!license || !license.id) {
    return '<span class="inventory-muted">No license</span>';
  }

  const usage =
    license.used && license.number
      ? `${license.used} / ${license.number}`
      : license.number
        ? `${license.used || 0} used`
        : "";

  const overLicense = license.used > license.number && license.number > 0;
  const badgeClass = overLicense ? "critical" : "healthy";

  return `
        <div class="inventory-computer-cell">
            <strong>${escapeHtml(license.name || "License")}</strong>
            <small class="inventory-health-chip ${badgeClass}">${escapeHtml(usage || "Unmanaged")}</small>
        </div>
    `;
}

function renderSoftwareDeploymentDetails(row) {
  const versions = row.versions || [];
  const computers = row.computers || [];

  if (!versions.length && !computers.length) {
    return '<span class="inventory-muted">No deployment details</span>';
  }

  return `
        <details class="software-deployment-details">
            <summary>View deployment</summary>
            <div class="software-deployment-content">
                <strong>Versions</strong>
                <div class="software-detail-chips">
                    ${
                      versions.length
                        ? versions
                            .slice(0, 30)
                            .map(
                              (version) => `
                                <span>${escapeHtml(version)}</span>
                            `,
                            )
                            .join("")
                        : "<em>Not reported</em>"
                    }
                </div>
                <strong>Computers</strong>
                <div class="software-detail-chips">
                    ${
                      computers.length
                        ? computers
                            .slice(0, 50)
                            .map(
                              (computer) => `
                                <span>${escapeHtml(computer)}</span>
                            `,
                            )
                            .join("")
                        : "<em>No computers linked</em>"
                    }
                </div>
            </div>
        </details>
    `;
}

function inventoryPageStatusBadge(status) {
  const normalized = normalizeInventoryPageStatus(status);
  const labels = {
    healthy: "Healthy",
    aging: "Aging",
    stale: "Stale",
    never: "Never reported",
    warning: "Warning",
    critical: "Critical",
    unknown: "Unknown",
  };

  return `
        <span class="inventory-health-chip ${escapeAttribute(normalized)}">
            ${escapeHtml(labels[normalized] || normalized)}
        </span>
    `;
}

function normalizeInventoryPageStatus(status) {
  const value = String(status || "unknown").toLowerCase();

  if (value.includes("never")) return "never";
  if (value.includes("aging")) return "aging";
  if (value.includes("stale")) return "stale";
  if (value.includes("critical")) return "critical";
  if (value.includes("warning")) return "warning";
  if (value.includes("healthy")) return "healthy";

  return "unknown";
}

function formatInventoryPageDate(value) {
  if (!value) {
    return '<span class="inventory-muted">Never</span>';
  }

  return escapeHtml(formatDate(value));
}

function buildSoftwareMatrix(data) {
  const versionCounts = {};
  const installCounts = {};

  (data.versions || []).forEach((version) => {
    const softwareId =
      version.softwares_id ||
      version.software_id ||
      version.items_id ||
      "unknown";

    versionCounts[softwareId] = (versionCounts[softwareId] || 0) + 1;
  });

  (data.installations || []).forEach((installation) => {
    const softwareId =
      installation.softwares_id ||
      installation.software_id ||
      installation.items_id ||
      installation.softwareversions_id ||
      "unknown";

    installCounts[softwareId] = (installCounts[softwareId] || 0) + 1;
  });

  return (data.software || [])
    .map((software) => ({
      id: software.id,
      name: software.name || "Unnamed",
      publisher: software.manufacturers_id || software.publisher || "",
      versionCount: versionCounts[software.id] || 0,
      installCount: installCounts[software.id] || 0,
      computerCount: 0,
      versions: [],
      computers: [],
    }))
    .sort(
      (left, right) =>
        right.installCount - left.installCount ||
        left.name.localeCompare(right.name),
    );
}

window.exportSoftwareMatrix = function () {
  const rows = state.softwareMatrix || [];
  if (!rows.length) return showToast("No software data to export", "error");

  exportToCSV(
    rows.map((row) => ({
      Software: row.name || "Unnamed",
      Publisher: row.publisher || "-",
      Versions: Number(row.versionCount || 0),
      Computers: Number(row.computerCount || 0),
      Installations: Number(row.installCount || 0),
      License: row.license?.name || "No license",
      LicenseUsed: row.license?.used || 0,
      LicenseTotal: row.license?.number || 0,
      VersionNames: (row.versions || []).join(" | "),
      ComputerNames: (row.computers || []).join(" | "),
    })),
    "Software_Matrix",
  );
};

window.exportInventoryHealth = function () {
  const items = state.inventoryHealth?.items || [];
  if (!items.length) return showToast("No inventory data to export", "error");

  exportToCSV(
    items.map((item) => ({
      Computer: item.name || "Unnamed",
      Serial: item.serial || "-",
      AgentName: item.agentName || "Not registered",
      AgentVersion: item.agentVersion || "-",
      AgentTag: item.agentTag || "-",
      RemoteAddress: item.remoteAddress || "-",
      LastContact: item.lastContact || "Never",
      LastInventory: item.lastInventory || "Never",
      Status:
        inventoryPageStatusBadge(item.status).match(/>\s*([^<]+?)\s*</)?.[1] ||
        item.status ||
        "Unknown",
    })),
    "Inventory_Health",
  );
};

function sortRows(rows, key, direction, view) {
  const cmp = (a, b) => {
    let aVal = a[key] ?? "";
    let bVal = b[key] ?? "";

    if (view === "softwareMatrix") {
      switch (key) {
        case "name":
        case "publisher":
        case "versions":
        case "computers":
          return String(aVal || "").localeCompare(String(bVal || ""));
        case "versionCount":
        case "computerCount":
        case "installCount":
          return Number(aVal || 0) - Number(bVal || 0);
        case "license":
          const aLic = aVal?.number || 0;
          const bLic = bVal?.number || 0;
          return Number(aLic) - Number(bLic);
        default:
          return String(aVal || "").localeCompare(String(bVal || ""));
      }
    } else {
      switch (key) {
        case "name":
        case "serial":
        case "agentName":
        case "agentVersion":
        case "agentTag":
        case "remoteAddress":
          return String(aVal || "").localeCompare(String(bVal || ""));
        case "status":
          return normalizeInventoryPageStatus(aVal).localeCompare(
            normalizeInventoryPageStatus(bVal),
          );
        case "isAgentManaged":
          return Number(bVal || 0) - Number(aVal || 0);
        case "lastContact":
        case "lastInventory":
          const ta = new Date(aVal || 0).getTime();
          const tb = new Date(bVal || 0).getTime();
          return ta - tb;
        default:
          return String(aVal || "").localeCompare(String(bVal || ""));
      }
    }
  };

  const sorted = [...rows].sort(cmp);
  return direction === "desc" ? sorted.reverse() : sorted;
}

window.toggleSort = function (view, key) {
  if (state.sortConfig.key === key && state.sortConfig.view === view) {
    state.sortConfig.direction =
      state.sortConfig.direction === "asc" ? "desc" : "asc";
  } else {
    state.sortConfig.key = key;
    state.sortConfig.view = view;
    state.sortConfig.direction = "asc";
  }

  if (view === "softwareMatrix") {
    renderSoftwareMatrix();
  } else if (view === "inventoryHealth") {
    renderInventoryHealth();
  }
};

function sortIndicator(key, view) {
  if (state.sortConfig.view !== view || state.sortConfig.key !== key)
    return " \u00b7";
  return state.sortConfig.direction === "asc" ? " \u2191" : " \u2193";
}
