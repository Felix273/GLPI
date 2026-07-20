# GLPI Asset Management and Agent Inventory Platform

**Technical Project Documentation**  
**Repository:** `https://github.com/Felix273/GLPI.git`  
**Primary branch:** `develop`  
**Document source baseline:** Commit `ccd180e`  
**Implementation date:** 18 July 2026  
**Documentation updated:** 20 July 2026  
**Local operating system:** Ubuntu 24.04  
**GLPI version:** 10.0.26  
**GLPI Agent version used:** 1.17-1

---

## 1. Executive Summary

This project combines native GLPI asset management with a custom modular frontend and GLPI Agent inventory reporting. The implementation provides normal GLPI asset administration together with an enhanced dashboard for asset operations, CSV imports, users, reports, inventory health, disk health, agent status and installed-software visibility.

The validated local architecture is:

```text
Managed PC -> GLPI Agent -> Native GLPI 10 Inventory -> GLPI REST API
           -> PHP backend proxy/aggregation -> Enhanced modular frontend
```

Local services:

| Service | URL | Purpose |
|---|---|---|
| Enhanced frontend | `http://127.0.0.1:8091` | Custom asset-management interface |
| Native GLPI | `http://127.0.0.1:8095` | GLPI administration, API and inventory receiver |
| GLPI inventory endpoint | `http://127.0.0.1:8095/front/inventory.php` | Accepts GLPI Agent POST inventory |
| GLPI Agent local HTTP service | Port `62354` | Agent local service, enabled by default in the pilot |

The implementation was committed and pushed to GitHub on branch `develop`. The documentation source baseline before this update is commit `ccd180e`.

## 2. Scope and Objectives

### Implemented

- Dockerized GLPI and enhanced frontend.
- Modular JavaScript, CSS and PHP templates replacing the original monolithic frontend.
- Secure static-file allowlisting.
- GLPI session proxying through the PHP backend.
- Asset CRUD, assignment, maintenance, documents, activity and reports.
- CSV import with user resolution and duplicate protection.
- Organization settings and directory integration scaffolding.
- Native GLPI inventory enabled.
- GLPI Agent pilot installed on Ubuntu.
- Windows GLPI Agent download, checksum verification, graphical installation, silent installation and deployment procedures documented.
- Agent status, inventory health, disk health, OS details and installed software shown in the custom frontend.
- Runtime data and backups excluded from Git.

### Not yet productionized

- Permanent HTTPS hosting and domain.
- Reverse proxy, TLS certificates and production firewall rules.
- Organization-wide endpoint deployment has not yet been executed. This document now includes repeatable Windows and Linux installation procedures for future rollout.
- Centralized agent authentication/certificate strategy.
- High availability, remote database backups and formal monitoring.
- Software vulnerability/CVE intelligence and patch deployment.

## 3. Solution Architecture

### Data flow

1. GLPI Agent inventories a managed computer.
2. The agent submits the inventory to native GLPI using HTTP POST.
3. GLPI creates or updates the computer, operating system, disks, agent and installed-software relationships.
4. The custom PHP backend authenticates to GLPI and retrieves records through the REST API.
5. The backend resolves relationships, computes health indicators and returns frontend-friendly JSON.
6. The modular frontend renders dashboards, tables and the computer Inventory tab.

### Core components

| Component | Responsibility |
|---|---|
| `glpi-docker` | Native GLPI 10.0.26 application |
| `glpi-frontend` | Custom PHP server and browser frontend |
| MariaDB | Native GLPI database persistence |
| GLPI Agent | Endpoint inventory collection and reporting |
| `server.php` | Static serving, GLPI proxy, settings, metadata, documents, import and inventory APIs |
| `api.js` | Browser API client with backend mode detection |

## 4. Repository Layout

```text
GLPI/
├── compose.yml
├── compose.glpi.yml
├── .env.example
├── verify-project.sh
├── glpi-frontend/
│   ├── Dockerfile
│   ├── server.php
│   ├── assets/
│   │   ├── css/
│   │   │   ├── core/
│   │   │   ├── features/
│   │   │   └── style.css
│   │   └── js/
│   │       ├── api.js
│   │       ├── core/
│   │       └── features/
│   ├── templates/
│   │   ├── index.php
│   │   ├── partials/
│   │   ├── views/
│   │   └── modals/
│   └── data/
│       ├── branding/
│       ├── documents/
│       └── metadata/
└── project documentation files
```

Runtime JSON, local settings, backups, checkpoints, database dumps and environment secrets are intentionally ignored.

## 5. Development Process Completed

### Phase 1 - Baseline and backups

- Verified Docker services, ports and persistent data.
- Created dated backup/checkpoint directories before each major change.
- Preserved the original monolithic frontend outside the public web root.

### Phase 2 - JavaScript modularization

The original `app.js` was split into:

- `core/application.js`
- `core/dom.js`
- `core/helpers.js`
- `core/navigation.js`
- `features/assets.js`
- `features/charts.js`
- `features/import.js`
- `features/inventory.js`
- `features/notifications.js`
- `features/operations.js`
- `features/reports.js`
- `features/users.js`

Duplicate function declarations were removed and authoritative enhanced implementations were retained.

### Phase 3 - CSS modularization

The monolithic stylesheet was split into:

- `core/base.css`
- `core/theme.css`
- `features/operations.css`
- `features/users.css`
- `features/reports.css`
- `features/settings.css`
- `features/import.css`

`assets/css/style.css` remains as a compatibility entry that imports the active modules for stale browser tabs.

### Phase 4 - HTML/PHP template composition

The monolithic `index.html` was replaced by `templates/index.php`, which composes:

- Head, login, shell and footer partials.
- Dashboard, reports, assets, import, inventory health, software matrix, users and settings views.
- View, create/edit, assignment and delete modals.

### Phase 5 - Static-file security

The PHP static server was changed from unrestricted file reads to an allowlist. Public access is limited to:

- `assets/`
- `data/branding/`

Internal files now return HTTP 404, including:

- `server.php`
- `templates/index.php`
- `templates/views/*`
- `data/settings.json`
- `data/metadata/*.json`
- archived monolithic files

### Phase 6 - GLPI Agent integration

- Enabled native inventory in GLPI.
- Confirmed `/front/inventory.php` exists. HTTP 405 on GET is expected because agents use POST.
- Installed GLPI Agent 1.17-1 on the Ubuntu pilot.
- Submitted a successful inventory.
- Confirmed one agent linked to computer 16.
- Imported one operating system, three disks and 3,590 installed-software records.
- Corrected software mapping to use `Item_SoftwareVersion -> SoftwareVersion -> Software`.
- Added Inventory Health, Software Matrix and a computer-only Inventory tab.
- Added a Windows x64 MSI download and deployment procedure for future pilot and organization-wide rollout.

### Phase 7 - Git cleanup and release

- Added runtime and backup exclusions to `.gitignore`.
- Removed tracked metadata JSON from the Git index without deleting local files.
- Ran PHP, JavaScript, whitespace and secret checks.
- Committed as `ce4f9b1` and pushed to `origin/develop`.

## 6. Local Setup from a Fresh Clone

### Prerequisites

- Git
- Docker Engine and Docker Compose plugin
- A modern browser
- Optional for local validation: PHP CLI, Node.js and Chromium/Google Chrome

### Clone and checkout

```bash
cd "/home/felix/FENTECH PROJECTS"
git clone https://github.com/Felix273/GLPI.git
cd GLPI
git checkout develop
```

### Prepare environment configuration

```bash
cp .env.example .env
nano .env
```

Never commit `.env`. Use strong database credentials and production secrets.

### Start services

```bash
docker compose up -d
docker compose ps
```

### Open the applications

```text
Enhanced frontend: http://127.0.0.1:8091
Native GLPI:       http://127.0.0.1:8095
```

### Validate the project

```bash
./verify-project.sh
php -l glpi-frontend/server.php
php -l glpi-frontend/templates/index.php
find glpi-frontend/assets/js/core glpi-frontend/assets/js/features \
  -type f -name '*.js' -print0 | sort -z | xargs -0 -n1 node --check
node --check glpi-frontend/assets/js/api.js
```

## 7. Docker Operations

```bash
# Start
docker compose up -d

# View status
docker compose ps

# View logs
docker compose logs -f
docker compose logs -f glpi-frontend
docker compose logs -f glpi-docker

# Restart one service
docker compose restart glpi-frontend

# Rebuild frontend after Dockerfile changes
docker compose build --no-cache glpi-frontend
docker compose up -d glpi-frontend

# Stop without deleting persistent volumes
docker compose down

# Do not use this in production unless intentionally deleting data
# docker compose down -v
```

## 8. Frontend Architecture

### JavaScript loading order

1. `api.js`
2. `core/application.js`
3. `core/dom.js`
4. `core/navigation.js`
5. Feature modules
6. `core/helpers.js`
7. `features/operations.js`

`escapeHtml()` is also defined defensively in the bootstrap for compatibility with older cached HTML.

### Key views

- Dashboard
- Reports
- Assets
- CSV Import
- Inventory Health
- Software Matrix
- Users
- Settings

### Computer Inventory tab

The computer-only modal tab displays:

- Agent name, version, tag, remote address and last contact.
- Inventory status, last inventory and last boot.
- Operating system, version, architecture and kernel.
- Disk capacity, free space, percentage used and status.
- Antivirus status when reported.
- Searchable installed-software list.

### Health thresholds

| Indicator | Logic |
|---|---|
| Reporting in 24 hours | Last contact/inventory age <= 24 hours |
| Reporting in 7 days | Age <= 7 days |
| Stale | Age >= 14 days |
| Never reported | No valid inventory or contact timestamp |
| Disk warning | Used capacity >= 80% |
| Disk critical | Used capacity >= 90% |

## 9. Backend Routes

All custom backend routes use the `/backend/` prefix.

| Method | Route | Purpose |
|---|---|---|
| GET | `/backend/health` | Frontend service health |
| GET/POST | `/backend/session` | Check/start GLPI-backed session |
| POST | `/backend/logout` | End session |
| Any supported | `/backend/glpi/*` | Proxy GLPI REST operations |
| GET | `/backend/settings/public` | Public branding/settings |
| GET/PUT | `/backend/settings` | Administrative settings |
| POST | `/backend/settings/logo` | Organization logo upload |
| POST | `/backend/settings/directory/test` | Test directory configuration |
| POST | `/backend/settings/directory/preview` | Preview directory users |
| POST | `/backend/settings/directory/sync` | Synchronize directory users |
| GET | `/backend/inventory/summary` | Agent and computer health summary |
| GET | `/backend/inventory/computer/{id}` | Full computer inventory |
| GET | `/backend/software/installations` | Organization software matrix |
| POST | `/backend/import*` | CSV import operations |

Do not use `/api/...`; the active prefix is `/backend/...`.

## 10. Runtime Data and Persistence

The custom frontend stores lightweight runtime data in:

```text
glpi-frontend/data/settings.json
glpi-frontend/data/metadata/*.json
glpi-frontend/data/documents/*
glpi-frontend/data/branding/*
```

Runtime settings, metadata and documents are excluded from Git. `.gitkeep` files retain empty directories.

Before production, move sensitive runtime data to durable Docker volumes or a database and ensure permissions allow only the application user.

## 11. Native GLPI Inventory

### Enable through the GLPI interface - preferred

Use GLPI administration to enable native inventory and software import. This is safer and more maintainable than editing the database directly.

### CLI/database fallback used during the local pilot

Back up configuration first, then enable `inventory.enabled_inventory` and clear cache:

```bash
cd "/home/felix/FENTECH PROJECTS/GLPI"
mkdir -p inventory-agent-backups

docker exec glpi-docker php -r '
define("GLPI_ROOT", "/var/www/glpi");
require GLPI_ROOT . "/inc/includes.php";
global $DB;
$DB->query("UPDATE glpi_configs SET value = \"1\" WHERE context = \"inventory\" AND name = \"enabled_inventory\"");
'

docker exec glpi-docker php bin/console cache:clear
```

This direct database method should be a controlled fallback, not the normal production operating procedure.

### Verify the endpoint

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  http://127.0.0.1:8095/front/inventory.php
```

HTTP `405` for GET is expected. A valid agent sends POST data.

## 12. Installing GLPI Agent on Ubuntu

The pilot used GLPI Agent `1.17-1`.

### Download and verify

```bash
rm -rf /tmp/glpi-agent-1.17
mkdir -p /tmp/glpi-agent-1.17
cd /tmp/glpi-agent-1.17

curl -fL -o glpi-agent-1.17-linux-installer.pl \
  https://github.com/glpi-project/glpi-agent/releases/download/1.17/glpi-agent-1.17-linux-installer.pl

curl -fL -o glpi-agent-1.17.sha256 \
  https://github.com/glpi-project/glpi-agent/releases/download/1.17/glpi-agent-1.17.sha256

expected="$(grep 'glpi-agent-1.17-linux-installer.pl$' glpi-agent-1.17.sha256 | awk '{print $1}')"
actual="$(sha256sum glpi-agent-1.17-linux-installer.pl | awk '{print $1}')"
test -n "$expected" && test "$expected" = "$actual"
```

### Install the local pilot

```bash
sudo perl glpi-agent-1.17-linux-installer.pl \
  --install \
  --type=typical \
  --service \
  --server="http://127.0.0.1:8095" \
  --glpi-version="10.0.26" \
  --tag="UBUNTU-PILOT" \
  --delaytime=0 \
  --runnow \
  --silent \
  --no-question
```

### Verify the service

```bash
glpi-agent --version
systemctl --no-pager --full status glpi-agent.service
```

### Active configuration

```text
/etc/glpi-agent/conf.d/00-install.cfg
```

```ini
server = http://127.0.0.1:8095
tag = UBUNTU-PILOT
```

### Force an immediate inventory

```bash
sudo systemctl kill -s SIGUSR1 glpi-agent.service
sudo journalctl -u glpi-agent.service --since "5 minutes ago" --no-pager
```

A successful run contains messages similar to:

```text
server answer shows it supports GLPI Agent protocol
running task Inventory
New inventory from <device-id> for server0
```

## 13. Installing GLPI Agent on Windows

This section is written for a first-time Windows pilot and later organization-wide deployment. It documents the process; it does **not** mean a Windows rollout has already been performed.

### 13.1 Choose the correct GLPI server address

The value passed to `SERVER=` must be reachable **from the Windows computer**.

| Scenario | Server value |
|---|---|
| GLPI and the agent are on the same Windows computer | `http://127.0.0.1:8095` |
| Windows computer is separate but on the same LAN | `http://<GLPI-SERVER-LAN-IP>:8095` |
| Hosted production system | `https://glpi.example.co.ke` |

Do not use `127.0.0.1` on a different computer. On a remote Windows endpoint, `127.0.0.1` refers to that Windows endpoint—not the GLPI server.

For the current Ubuntu-hosted local test, a separate Windows pilot would temporarily use the Ubuntu computer's reachable LAN address. After hosting, replace it with the permanent HTTPS domain.

### 13.2 Windows requirements

- Windows 10, Windows 11 or a supported Windows Server edition.
- A 64-bit operating system for GLPI Agent 1.17.
- Local administrator rights.
- Network access from the Windows computer to the GLPI server.
- Native inventory enabled in GLPI.
- The official MSI package and its verified SHA256 checksum.
- FusionInventory Agent removed first when this agent is replacing it.

> Since GLPI Agent 1.8, current releases are distributed as 64-bit Windows installers. Very old 32-bit computers require a separately approved legacy strategy and should not receive the 1.17 x64 MSI.

### 13.3 Official Windows installer used by this project

Approved package for the current project baseline:

```text
File: GLPI-Agent-1.17-x64.msi
Download: https://github.com/glpi-project/glpi-agent/releases/download/1.17/GLPI-Agent-1.17-x64.msi
SHA256: db2661a14359931a2d14ed7268f9b90763da4f2bec97b5ed8d51b9bb655d730c
```

Before a future rollout, check the official release page. If a newer version is approved, update the filename, URL, checksum and commands together.

### 13.4 Method A: graphical installation for the first pilot

Use this method on the first Windows computer because it is easier to inspect each setting.

1. Sign in to Windows using an administrator account.
2. Download `GLPI-Agent-1.17-x64.msi` from the official URL above.
3. Open **Command Prompt as Administrator**.
4. Verify the downloaded file:

```bat
cd /d "%USERPROFILE%\Downloads"
certutil -hashfile GLPI-Agent-1.17-x64.msi SHA256
```

5. Compare the displayed hash with:

```text
db2661a14359931a2d14ed7268f9b90763da4f2bec97b5ed8d51b9bb655d730c
```

6. Stop if the hashes do not match. Delete the file and download it again from the official release.
7. Double-click the MSI and approve the User Account Control prompt.
8. Use these settings in the installer. The exact screen wording may vary slightly:

| Setting | Pilot value | Production value |
|---|---|---|
| Execution mode | Service | Service |
| Server | Reachable local/LAN GLPI URL | Permanent HTTPS GLPI URL |
| Tag | `WINDOWS-PILOT` | Site or department, for example `NAIROBI-FINANCE` |
| Tasks/features | Agent and Inventory | Agent and Inventory unless more tasks are approved |
| Run immediately | Yes | Yes |
| Embedded HTTP server | Disable for inventory-only endpoints | Disable unless specifically required |

9. Complete the installation.
10. Continue with the verification steps in section 13.7.

### 13.5 Method B: download from an elevated Command Prompt

Use **Command Prompt (`cmd.exe`) as Administrator**, not PowerShell, for the installer workflow.

```bat
mkdir C:\GLPI-Agent-Install
cd /d C:\GLPI-Agent-Install
curl.exe -L -o GLPI-Agent-1.17-x64.msi "https://github.com/glpi-project/glpi-agent/releases/download/1.17/GLPI-Agent-1.17-x64.msi"
certutil -hashfile GLPI-Agent-1.17-x64.msi SHA256
```

Confirm that the hash is exactly:

```text
db2661a14359931a2d14ed7268f9b90763da4f2bec97b5ed8d51b9bb655d730c
```

### 13.6 Method C: silent installation

This is the recommended repeatable command after the graphical pilot succeeds.

Open **Command Prompt as Administrator** and run:

```bat
cd /d C:\GLPI-Agent-Install

msiexec.exe /i "GLPI-Agent-1.17-x64.msi" /quiet /norestart ^
 SERVER="http://192.168.1.11:8095" ^
 TAG="WINDOWS-PILOT" ^
 RUNNOW=1 ^
 EXECMODE=1 ^
 ADDLOCAL=feat_AGENT ^
 NO_HTTPD=1 ^
 GLPI_VERSION=10.0.26 ^
 /L*v "C:\GLPI-Agent-Install\install.log"
```

Important rules:

- Replace `http://192.168.1.11:8095` with an address reachable from the Windows computer.
- After hosting, use the permanent HTTPS domain, for example `https://glpi.example.co.ke`.
- Change `WINDOWS-PILOT` to a useful site or department tag.
- `EXECMODE=1` installs the agent as a Windows service.
- `ADDLOCAL=feat_AGENT` installs the base agent and Inventory task.
- `RUNNOW=1` requests an inventory immediately after installation.
- `NO_HTTPD=1` disables the endpoint's embedded HTTP server because this project currently needs outbound inventory reporting only.
- `/L*v` creates a detailed installer log for troubleshooting.
- A caret (`^`) must be the final character on each continued line—do not add spaces after it.

Production example:

```bat
msiexec.exe /i "GLPI-Agent-1.17-x64.msi" /quiet /norestart ^
 SERVER="https://glpi.example.co.ke" ^
 TAG="NAIROBI-FINANCE" ^
 RUNNOW=1 ^
 EXECMODE=1 ^
 ADDLOCAL=feat_AGENT ^
 NO_HTTPD=1 ^
 GLPI_VERSION=10.0.26 ^
 /L*v "C:\GLPI-Agent-Install\install.log"
```

Do not use `NO_SSL_CHECK=1` in production. Install a trusted certificate chain on the server and allow normal certificate validation.

### 13.7 Verify the Windows installation

Open **Command Prompt as Administrator**.

Check the Windows service:

```bat
sc.exe query glpi-agent
```

Expected result: the service exists and its state is `RUNNING`.

Check the installed version:

```bat
cd /d "C:\Program Files\GLPI-Agent"
glpi-agent --version
```

Check the configured server and tag stored in the Windows registry:

```bat
reg.exe query "HKLM\SOFTWARE\GLPI-Agent" /v server
reg.exe query "HKLM\SOFTWARE\GLPI-Agent" /v tag
```

Read the latest agent log:

```bat
type "C:\Program Files\GLPI-Agent\logs\glpi-agent.log"
```

Look for messages showing that the server supports the GLPI Agent protocol and that an inventory was submitted.

### 13.8 Force a complete Windows inventory

From an elevated Command Prompt:

```bat
cd /d "C:\Program Files\GLPI-Agent"
glpi-agent -f --full
```

Then read the log again:

```bat
type "C:\Program Files\GLPI-Agent\logs\glpi-agent.log"
```

The `-f` option forces submission, while `--full` requests a full inventory instead of a partial update.

### 13.9 Verify the Windows endpoint in GLPI and the custom frontend

In native GLPI:

1. Open **Assets -> Computers**.
2. Find the Windows hostname.
3. Confirm the serial number, UUID, operating system and last inventory date.
4. Confirm the linked Agent record and its version/tag.
5. Open the Software tab and confirm installed applications are present.
6. Check antivirus information on Windows endpoints.

In the enhanced frontend:

1. Open **Inventory Health**.
2. Confirm the endpoint is **Agent managed** and reports as healthy.
3. Open the computer record.
4. Select the **Inventory** tab.
5. Confirm Agent, Windows version, disks, antivirus and installed software.
6. Search for a known application to confirm software mapping.

### 13.10 Simple reusable Windows deployment script

Save the following as `install-glpi-agent.cmd`. Run it as Administrator or deploy it using an approved management platform.

```bat
@echo off
setlocal

set "MSI=C:\GLPI-Agent-Install\GLPI-Agent-1.17-x64.msi"
set "GLPI_URL=https://glpi.example.co.ke"
set "AGENT_TAG=NAIROBI-OFFICE"
set "LOG=C:\GLPI-Agent-Install\install.log"

if not exist "%MSI%" (
    echo ERROR: Installer not found: %MSI%
    exit /b 2
)

msiexec.exe /i "%MSI%" /quiet /norestart ^
 SERVER="%GLPI_URL%" ^
 TAG="%AGENT_TAG%" ^
 RUNNOW=1 ^
 EXECMODE=1 ^
 ADDLOCAL=feat_AGENT ^
 NO_HTTPD=1 ^
 GLPI_VERSION=10.0.26 ^
 /L*v "%LOG%"

set "RESULT=%ERRORLEVEL%"

if "%RESULT%"=="0" (
    echo GLPI Agent installed successfully.
    exit /b 0
)

if "%RESULT%"=="3010" (
    echo GLPI Agent installed successfully; Windows restart is required.
    exit /b 0
)

echo ERROR: GLPI Agent installation failed with code %RESULT%.
echo Review %LOG%
exit /b %RESULT%
```

For centralized deployment, place the verified MSI and script in a secured software-distribution location, then deploy with Group Policy, Microsoft Intune, an RMM platform or another approved endpoint-management tool.

### 13.11 Safe rollout process for Windows computers

1. Host GLPI on a stable HTTPS domain first.
2. Freeze an approved GLPI Agent version and checksum.
3. Test the installer manually on one Windows pilot.
4. Test the silent command on a second pilot.
5. Verify each pilot in native GLPI and the enhanced frontend.
6. Pilot on 5-10 computers from different departments.
7. Confirm no duplicate computers are created.
8. Confirm operating system, disks, antivirus and software inventory.
9. Deploy in controlled batches.
10. Monitor **Inventory Health** for stale or never-reported computers.
11. Keep the MSI, checksum, command and deployment log together as a release package.

### 13.12 Windows troubleshooting

| Problem | Check or resolution |
|---|---|
| MSI does not install | Run Command Prompt as Administrator and review `C:\GLPI-Agent-Install\install.log`. |
| Service is missing | Confirm `EXECMODE=1`; rerun the installer and inspect the MSI log. |
| Service exists but is stopped | Run `sc.exe start glpi-agent`, then check the agent log. |
| No computer appears in GLPI | Confirm `SERVER=` is reachable from Windows, native inventory is enabled and the agent log shows a successful contact. |
| `127.0.0.1` does not work | The GLPI server is on another computer. Use its LAN address or hosted HTTPS domain. |
| Certificate error | Install a valid server certificate and trusted CA chain. Do not disable SSL verification in production. |
| Software installed under user profiles is missing | Consider adding `SCAN_PROFILES=1` after testing the performance and privacy impact. |
| Duplicate computer appears | Check hostname, serial number, UUID and cloning process. Avoid regenerating agent/device identity unnecessarily. |
| Antivirus does not appear | Confirm Windows Security Center recognizes the antivirus product and run a full inventory. |
| Inventory takes too long | Review excluded categories, profile scanning and the agent log before increasing timeouts. |

### 13.13 Windows uninstall or reconfiguration

Uninstall using the same approved MSI:

```bat
msiexec.exe /x "C:\GLPI-Agent-Install\GLPI-Agent-1.17-x64.msi" /quiet /norestart
```

To reapply configuration with the same installer:

```bat
msiexec.exe /i "C:\GLPI-Agent-Install\GLPI-Agent-1.17-x64.msi" /quiet /norestart ^
 REINSTALL=feat_AGENT ^
 SERVER="https://glpi.example.co.ke" ^
 TAG="NAIROBI-OFFICE" ^
 RUNNOW=1 ^
 NO_HTTPD=1 ^
 /L*v "C:\GLPI-Agent-Install\reconfigure.log"
```

Always test reconfiguration on a pilot before applying it to the organization.

## 14. Verifying Agent Data

### Basic database verification

```bash
docker exec -i glpi-docker php <<'PHP'
<?php
define('GLPI_ROOT', '/var/www/glpi');
require GLPI_ROOT . '/inc/includes.php';
global $DB;

$tables = [
    'glpi_agents',
    'glpi_computers',
    'glpi_items_operatingsystems',
    'glpi_items_disks',
    'glpi_items_softwareversions',
    'glpi_softwareversions',
    'glpi_softwares',
];

foreach ($tables as $table) {
    $result = $DB->query("SELECT COUNT(*) AS total FROM `$table`");
    $row = $DB->fetchAssoc($result);
    echo "$table: " . ($row['total'] ?? 0) . "\n";
}
PHP
```

Validated pilot result:

- Agents: 1
- Computer: `felic`, GLPI ID 16
- Operating systems: 1
- Disks: 3
- Installed software relationships: 3,590
- Software products: 3,330

## 15. Software Inventory Relationship

The correct native GLPI relationship is:

```text
glpi_items_softwareversions.softwareversions_id
  -> glpi_softwareversions.id
  -> glpi_softwareversions.softwares_id
  -> glpi_softwares.id
```

The custom backend resolves this into:

- Software name
- Version
- Architecture
- Publisher/manufacturer
- Computer name
- Installation count
- Number of affected computers

The original prototype relationship `Computer_SoftwareVersion` was replaced with `Item_SoftwareVersion` for GLPI 10 compatibility.

## 16. CSV Import Integration

The exact template columns are:

```text
STAFF ASSIGNED/OFFICE, LOCATION, ASSET TYPE, MODEL, SERIAL NO., ASSET TAG, YEAR OF ACQUISITION, STATUS
```

Import protections include:

- CSV structure validation.
- User matching against synchronized GLPI/directory users.
- Ambiguous and unmatched user handling.
- Office/shared-location values treated separately from named users.
- Duplicate asset-tag and serial detection inside the CSV.
- Duplicate checks against existing GLPI asset types.
- Final duplicate recheck immediately before import.
- Confirmation disabled while blocking duplicates remain.

## 17. Settings and Directory Integration

Implemented settings include:

- Organization name, subtitle, workspace and logo.
- Currency, timezone, warranty days and items per page.
- LDAP/Active Directory connection settings.
- Directory connection test, preview and sync endpoints.
- Encrypted bind-password handling.
- Administrative authorization for protected settings endpoints.

Before production, validate TLS for directory connections and store encryption keys outside the repository.

## 18. Security Controls

### Implemented

- Tokens are handled through the PHP session proxy instead of repeatedly exposing them in browser requests.
- Session cookies are HTTP-only and become secure under HTTPS.
- Internal application files are blocked from static access.
- Runtime settings and metadata are excluded from Git.
- `.env`, database dumps, logs, backups and archives are ignored.
- Staged code was checked for obvious hard-coded secrets before commit.
- Uploaded branding is the only runtime data path exposed publicly.

### Required before production

1. Use a permanent HTTPS domain.
2. Put GLPI and the enhanced frontend behind a reverse proxy.
3. Do not expose container ports directly to the internet.
4. Restrict CORS; the current PHP header is permissive for local development.
5. Enable secure cookie behavior through HTTPS.
6. Validate all GLPI and directory TLS certificates.
7. Use strong secrets in a secret manager or protected environment file.
8. Decide whether the agent local HTTP service on port 62354 is needed; disable or firewall it if not.
9. Implement scheduled backups and restore tests.
10. Keep GLPI, images and agent versions patched.

## 19. Testing and Quality Assurance

### Syntax checks

```bash
php -l glpi-frontend/server.php
php -l glpi-frontend/templates/index.php
node --check glpi-frontend/assets/js/api.js
find glpi-frontend/assets/js/core glpi-frontend/assets/js/features \
  -type f -name '*.js' -print0 | sort -z | xargs -0 -n1 node --check
```

### HTTP checks

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8091/
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8091/assets/js/features/inventory.js
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8091/server.php
```

Expected:

- Application/assets: `200`
- Internal files such as `server.php`: `404`

### Headless browser smoke test

```bash
browser="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
"$browser" --headless --no-sandbox --disable-gpu --disable-cache \
  --virtual-time-budget=10000 --enable-logging=stderr \
  "http://127.0.0.1:8091/?v=$(date +%s)" 2>&1 >/dev/null
```

### Manual acceptance test

- Log in to the enhanced frontend.
- Open Dashboard, Reports, Assets, Import, Inventory Health, Software Matrix, Users and Settings.
- Open computer `felic` and select Inventory.
- Confirm agent, OS, disks and software load.
- Search the installed-software table.
- Confirm disk warning appears for the root volume when usage is above 80%.
- Confirm non-computer assets do not show the Inventory tab.

## 20. Git and GitHub Workflow

### Current repository state

```text
Remote: https://github.com/Felix273/GLPI.git
Branch: develop
Commit: ce4f9b1
Message: feat: integrate GLPI Agent inventory and refactor frontend
```

### Normal workflow

```bash
cd "/home/felix/FENTECH PROJECTS/GLPI"
git checkout develop
git pull --ff-only origin develop
git status --short

# Make and validate changes
./verify-project.sh
git diff --check

git add -A
git diff --cached --check
git diff --cached --stat

git commit -m "feat: describe the change"
git push origin develop
```

### Runtime and backup exclusions

```gitignore
*-backup-*/
*-backups/
*-checkpoint-*/
*-archives-*/
inventory-agent-backups/
glpi-frontend/data/settings.json
glpi-frontend/data/metadata/*.json
glpi-frontend/data/documents/*
!glpi-frontend/data/metadata/.gitkeep
!glpi-frontend/data/documents/.gitkeep
```

## 21. Backup and Restore

### Source code

Source code is protected through GitHub. Use branches and tags for releases.

### GLPI database

```bash
mkdir -p backups

docker exec glpi-db mariadb-dump \
  -u root -p"$MYSQL_ROOT_PASSWORD" \
  "$MYSQL_DATABASE" > "backups/glpi-$(date +%Y%m%d-%H%M%S).sql"
```

Container names and environment variable names must match `compose.yml`.

### GLPI persistent files

```bash
docker run --rm \
  -v glpi-data:/source:ro \
  -v "$PWD/backups:/backup" \
  alpine sh -c 'tar czf /backup/glpi-files-$(date +%Y%m%d-%H%M%S).tar.gz -C /source .'
```

### Custom frontend runtime data

```bash
tar czf "backups/frontend-runtime-$(date +%Y%m%d-%H%M%S).tar.gz" \
  glpi-frontend/data
```

### Restore principles

- Stop writes before restoring.
- Restore database and GLPI files from the same backup point.
- Restore custom frontend runtime data separately.
- Start services and run smoke tests.
- Perform scheduled restore drills, not only backups.

## 22. Production Hosting Plan

### Recommended architecture

```text
Internet / Organization network
  -> HTTPS reverse proxy
      -> enhanced frontend container
      -> native GLPI container
  -> private database network
```

Recommended domains:

```text
https://assets.example.co.ke       Enhanced frontend
https://glpi.example.co.ke         Native GLPI and agent target
```

### Production sequence

1. Provision a Linux server with stable IP and DNS.
2. Install Docker and the Compose plugin.
3. Clone the repository and checkout a release tag or protected branch.
4. Create production `.env` with strong secrets.
5. Create persistent volumes and backup destinations.
6. Start the stack on private/local interfaces where possible.
7. Configure Nginx, Caddy or Traefik with HTTPS.
8. Restrict direct access to ports 8091 and 8095.
9. Update the frontend GLPI backend URL.
10. Update agents to the permanent HTTPS GLPI URL.
11. Test certificate validation, inventory submission and frontend APIs.
12. Configure monitoring, backups, retention and patching.

## 23. Organization-Wide Agent Rollout

Do not use `127.0.0.1` on remote endpoints. After hosting, every agent must target the permanent GLPI HTTPS URL.

### Linux target example

```ini
server = https://glpi.example.co.ke
tag = NAIROBI-OFFICE
```

### Linux pilot rollout process

1. Download and verify the approved agent release.
2. Install on a small pilot group.
3. Use office/site tags such as `NAIROBI`, `MOMBASA` or `ISIOLO`.
4. Confirm each endpoint appears once and links to the expected computer.
5. Validate software, disk and OS inventory.
6. Expand deployment in controlled batches.
7. Monitor stale and never-reported devices.

### Windows rollout process

Use the complete download, checksum, graphical installation, silent installation, verification and troubleshooting procedure in **Section 13**.

1. Freeze an approved MSI version and SHA256 checksum.
2. Test the graphical installation on one pilot.
3. Test the silent command on another pilot.
4. Use the permanent HTTPS GLPI URL and a meaningful site/department tag.
5. Deploy using Active Directory Group Policy, Microsoft Intune, RMM or another approved software-distribution platform.
6. Confirm Windows operating system, disks, antivirus and installed software are reported.
7. Monitor Inventory Health and stop the rollout if duplicates, certificate failures or missing inventories appear.

## 24. Operations and Maintenance

### Daily

- Review Inventory Health.
- Investigate critical disks and agent failures.
- Review failed imports and authentication errors.

### Weekly

- Review stale and never-reported computers.
- Check container logs and storage usage.
- Confirm backups completed successfully.
- Review software matrix anomalies.

### Monthly

- Test a restore in a non-production environment.
- Update operating-system security patches.
- Review GLPI and GLPI Agent updates.
- Audit administrators, tokens and directory credentials.
- Review data retention for documents and metadata.

## 25. Troubleshooting

### `escapeHtml is not defined`

Cause: stale HTML loaded JavaScript modules in an old order.  
Resolution: load `core/dom.js` before dependent modules, keep a bootstrap fallback in `application.js`, update cache-busting versions and hard-refresh the browser.

### `style.css` returns 404

Cause: an older browser tab still requests the monolithic stylesheet.  
Resolution: keep `assets/css/style.css` as a compatibility file importing the active modular styles.

### `/api/inventory/summary` returns 404

Cause: the active custom route prefix is `/backend/`.  
Use:

```text
/backend/inventory/summary
/backend/inventory/computer/{id}
/backend/software/installations
```

### Backend endpoint returns 401

Cause: no authenticated frontend PHP session.  
Resolution: log in through the enhanced frontend and retry. The browser API client handles the session automatically.

### Inventory endpoint returns 405

Cause: GET was used against `/front/inventory.php`.  
This is expected. GLPI Agent submits POST inventory.

### Agent installed but no data appears

```bash
systemctl status glpi-agent.service
sudo systemctl kill -s SIGUSR1 glpi-agent.service
sudo journalctl -u glpi-agent.service --since "10 minutes ago" --no-pager
cat /etc/glpi-agent/conf.d/00-install.cfg
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8095/
```

Confirm native inventory is enabled and `import_software=1`.

### Duplicate computer created

Confirm the agent retains the same device identity and the existing GLPI computer has consistent serial/UUID information. Avoid repeatedly reinstalling with identity-changing options.

### Software counts appear wrong

Confirm the backend uses `Item_SoftwareVersion`, not the obsolete prototype relationship. Check pagination because the pilot imported more than 1,000 records.

### Terminal closes during validation

Cause: a command containing `exit 1` was run in the active shell.  
Resolution: run checks in a subshell or use `|| true` while investigating.

## 26. Current Local Baseline

| Item | Value |
|---|---|
| Host | `felic.localdomain.com` |
| OS | Ubuntu 24.04 x86_64 |
| Native GLPI | 10.0.26 |
| GLPI Agent | 1.17-1 |
| Agent target | `http://127.0.0.1:8095` |
| Agent tag | `UBUNTU-PILOT` |
| Enhanced frontend | `http://127.0.0.1:8091` |
| Native GLPI | `http://127.0.0.1:8095` |
| Pilot GLPI computer ID | 16 |
| Pilot software records | 3,590 |
| Git branch | `develop` |
| Documentation source baseline | `ccd180e` |

## 27. Recommended Next Enhancements

1. Production reverse proxy and HTTPS deployment.
2. Production secret management and restricted CORS.
3. Database-backed custom metadata instead of JSON files.
4. Execute and validate the documented Windows pilot, then package it for automated deployment.
5. Agent compliance policies and required-software baselines.
6. CVE/vulnerability feed integration.
7. Patch and software deployment through approved GLPI capabilities.
8. Exportable inventory/compliance reports.
9. Alerting for stale devices, disk thresholds and agent version drift.
10. Automated CI checks for PHP, JavaScript, Docker and security scanning.

## 28. Acceptance Checklist

- [x] Docker services run locally.
- [x] Native GLPI is available on port 8095.
- [x] Enhanced frontend is available on port 8091.
- [x] Frontend JavaScript, CSS and HTML are modularized.
- [x] Internal files are protected from static access.
- [x] Native GLPI inventory is enabled.
- [x] Ubuntu pilot agent reports successfully.
- [x] Windows x64 MSI download, checksum, installation and verification procedure documented.
- [x] Agent, OS, disk and software data are visible in the frontend.
- [x] Inventory Health and Software Matrix are implemented.
- [x] Runtime data and backups are excluded from Git.
- [x] Changes are committed and pushed to `develop`.
- [ ] Permanent hosting and HTTPS are configured.
- [ ] Production secrets and firewall rules are configured.
- [ ] Windows pilot is executed and organization-wide Windows/Linux deployment packages are approved.
- [ ] Backup restoration and disaster recovery are tested.

---

## 29. Official GLPI Agent References

- Official releases: `https://github.com/glpi-project/glpi-agent/releases`
- Windows installer documentation: `https://glpi-agent.readthedocs.io/en/1.17/installation/windows-command-line.html`
- GLPI Agent 1.17 documentation: `https://glpi-agent.readthedocs.io/en/1.17/`
- Configuration documentation: `https://glpi-agent.readthedocs.io/en/1.17/configuration.html`
- Command-line reference: `https://glpi-agent.readthedocs.io/en/1.17/man/glpi-agent.html`

**Maintenance rule:** Update this document whenever architecture, ports, routes, environment variables, agent versions, deployment commands or security controls change.
