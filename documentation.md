# GLPI Asset Management and Agent Inventory Platform

**Technical Project Documentation**  
**Repository:** `https://github.com/Felix273/GLPI.git`  
**Primary branch:** `develop`  
**Document baseline:** Commit `ce4f9b1`  
**Implementation date:** 18 July 2026  
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

The implementation was committed and pushed to GitHub on branch `develop` as commit `ce4f9b1`.

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
- Agent status, inventory health, disk health, OS details and installed software shown in the custom frontend.
- Runtime data and backups excluded from Git.

### Not yet productionized

- Permanent HTTPS hosting and domain.
- Reverse proxy, TLS certificates and production firewall rules.
- Organization-wide Windows/Linux agent packages.
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

## 13. Verifying Agent Data

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

## 14. Software Inventory Relationship

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

## 15. CSV Import Integration

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

## 16. Settings and Directory Integration

Implemented settings include:

- Organization name, subtitle, workspace and logo.
- Currency, timezone, warranty days and items per page.
- LDAP/Active Directory connection settings.
- Directory connection test, preview and sync endpoints.
- Encrypted bind-password handling.
- Administrative authorization for protected settings endpoints.

Before production, validate TLS for directory connections and store encryption keys outside the repository.

## 17. Security Controls

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

## 18. Testing and Quality Assurance

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

## 19. Git and GitHub Workflow

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

## 20. Backup and Restore

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

## 21. Production Hosting Plan

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

## 22. Organization-Wide Agent Rollout

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

1. Obtain the official GLPI Agent Windows installer for the approved release.
2. Create a silent installation command targeting the HTTPS GLPI URL.
3. Include a site/department tag.
4. Test on a small Windows pilot group.
5. Deploy using Active Directory Group Policy, Intune, RMM or another software distribution platform.
6. Confirm Windows Defender/antivirus records and installed software are reported.

Exact Windows installer switches must be validated against the selected official installer version before mass deployment.

## 23. Operations and Maintenance

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

## 24. Troubleshooting

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

## 25. Current Local Baseline

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
| Git commit | `ce4f9b1` |

## 26. Recommended Next Enhancements

1. Production reverse proxy and HTTPS deployment.
2. Production secret management and restricted CORS.
3. Database-backed custom metadata instead of JSON files.
4. Windows agent packaging and automated deployment.
5. Agent compliance policies and required-software baselines.
6. CVE/vulnerability feed integration.
7. Patch and software deployment through approved GLPI capabilities.
8. Exportable inventory/compliance reports.
9. Alerting for stale devices, disk thresholds and agent version drift.
10. Automated CI checks for PHP, JavaScript, Docker and security scanning.

## 27. Acceptance Checklist

- [x] Docker services run locally.
- [x] Native GLPI is available on port 8095.
- [x] Enhanced frontend is available on port 8091.
- [x] Frontend JavaScript, CSS and HTML are modularized.
- [x] Internal files are protected from static access.
- [x] Native GLPI inventory is enabled.
- [x] Ubuntu pilot agent reports successfully.
- [x] Agent, OS, disk and software data are visible in the frontend.
- [x] Inventory Health and Software Matrix are implemented.
- [x] Runtime data and backups are excluded from Git.
- [x] Changes are committed and pushed to `develop`.
- [ ] Permanent hosting and HTTPS are configured.
- [ ] Production secrets and firewall rules are configured.
- [ ] Windows/Linux organization-wide deployment packages are approved.
- [ ] Backup restoration and disaster recovery are tested.

---

**Maintenance rule:** Update this document whenever architecture, ports, routes, environment variables, agent versions, deployment commands or security controls change.
