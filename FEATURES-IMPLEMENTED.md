# GLPI Asset Hub — Enhanced Release

This release upgrades the custom GLPI frontend while keeping the native GLPI 10.0.26 backend and existing external Docker volume.

## Dashboard

- Operational KPI cards for total, available, assigned, maintenance, and warranties expiring within 30 days.
- KPI drill-down modal showing the matching assets.
- Asset distribution by type and operational status charts.
- Recent activity stream covering creation, edits, assignments, returns, maintenance, and documents.
- Quick actions for adding an asset, assigning available equipment, CSV import, and inventory export.
- Loading skeletons, retryable error states, and useful empty states.

## Asset management

- Improved responsive asset table with serial/inventory context, assignment, location, warranty, value, modified date, and actions.
- Filters for search, operational status, assignment, location, warranty, sorting, and page size.
- Bulk assignment, mark available, mark maintenance, export, and confirmed deletion.
- Mobile card layout for asset tables.
- Operational status normalization using GLPI `states_id` with compatibility for older `status` responses.
- Create and edit actions now write GLPI status through `states_id`.

## Asset lifecycle

- Rich asset-detail header and overview.
- Persistent assignment history with assignment date, expected return, notes, and return-to-inventory action.
- Persistent maintenance history with service type, vendor/technician, cost, next due date, notes, and completion workflow.
- Activity timeline generated from actual lifecycle actions rather than placeholder entries.
- Document drag-and-drop and file selection up to 5 MB per file, with download and confirmed removal.
- Dashboard metadata collection is lightweight and excludes document file payloads.

## Reliability and operations

- Automatic sign-in prompt when GLPI returns an expired session.
- Thirty-minute frontend inactivity timeout.
- Request timeout and clearer network/API error messages.
- Confirmation modal for individual deletion, bulk deletion, asset returns, and document removal.
- Frontend `/backend/health` endpoint.
- Docker health checks for GLPI and the custom frontend.
- Frontend waits for a healthy GLPI service before starting.
- Environment-based images, ports, backend URL, network, and external volume values.
- `.env.example` documents non-secret deployment settings.

## Deploying the update

Preserve the existing `.env.glpi` file because it contains the database configuration and is deliberately excluded from this archive.

```bash
cd "/home/felix/FENTECH PROJECTS/GLPI"
docker compose up -d --build
docker compose ps
```

Open the improved frontend at `http://127.0.0.1:8091` and native GLPI at `http://127.0.0.1:8095`.

Health check:

```bash
curl -fsS http://127.0.0.1:8091/backend/health
```

## Validation performed

- PHP syntax validation for `server.php`.
- JavaScript syntax validation for `api.js` and `app.js`.
- HTML parsing and duplicate-ID checks.
- Static server and health-endpoint checks.
- Dashboard KPI/activity smoke test with representative GLPI responses.
- Asset table/filter/warranty smoke test.
- Assignment and maintenance persistence smoke test.
- Compose YAML structure validation.

Docker image startup could not be executed in the packaging environment because Docker is not installed there. The Compose files were parsed and validated as YAML, and the services retain the existing image, external volume, socket mount, and network configuration.
