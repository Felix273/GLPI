# GLPI Asset Management Enhancement Platform

A modern enterprise IT Asset Management (ITAM) platform built on top of GLPI, featuring a custom dashboard, enhanced asset analytics, interactive reporting, REST API integration, and a modern responsive frontend.

---

## Project Overview

This project extends the capabilities of GLPI by providing a modern user experience and enterprise-grade management features while preserving the stability of the GLPI core.

The custom frontend runs as a small PHP application and communicates with GLPI through its REST API. GLPI remains the system of record; the frontend stores only shared dashboard metadata and document files under its data directory.

The goal is to transform GLPI into a comprehensive enterprise asset management platform suitable for organizations of all sizes.

---

## Key Features

- Asset Lifecycle Management
- Modern Responsive Dashboard
- Asset Analytics
- QR Code & Barcode Support
- Interactive Charts
- REST API Integration
- Custom Backend Services
- Department & User Management
- Software License Tracking
- Maintenance Tracking
- Warranty Monitoring
- Report Generation
- Docker Support
- Plugin Architecture
- Mobile-Friendly Interface

---

## Technology Stack

| Layer | Technology |
|--------|------------|
| Backend | PHP, GLPI REST API |
| Frontend | HTML, CSS, JavaScript |
| Database | MariaDB / MySQL |
| Web Server | Apache |
| Containerization | Docker |
| Version Control | Git & GitHub |

---

## Repository Structure

```
GLPI/
├── glpi/                 # GLPI core application
├── glpi-frontend/        # PHP backend proxy and modular dashboard
├── sample-assets/        # Import templates and sample data
├── scripts/              # Backup and disk checks
├── secrets/              # Secret-file examples only
├── compose.yml           # Application, proxy, and monitoring services
├── .github/workflows/    # CI and deployment workflows
├── verify-project.sh     # Local verification checks
├── .env.example          # Non-secret deployment settings
└── start.sh              # Local startup helper
```

---

## Project Architecture

```text
                    +-----------------------+
                    |    Web Browser        |
                    +----------+------------+
                               |
                               |
                    Custom Frontend (UI)
                               |
                               |
                 Backend API / Integration Layer
                               |
                               |
                       GLPI REST API
                               |
                               |
                      GLPI Core Application
                               |
                               |
                        MariaDB Database
```
---

# Installation

## Prerequisites

Before setting up the project, ensure you have the following installed:

- Git
- PHP 8.1+
- Apache 2.4+
- MariaDB/MySQL
- Docker & Docker Compose
- Composer
- Node.js (if working on the frontend)

---

## Clone the Repository

```bash
git clone https://github.com/Felix273/GLPI.git
cd GLPI
git checkout develop
```

---

## Configure GLPI

1. Create a database.
2. Configure Apache.
3. Configure PHP.
4. Update GLPI configuration.
5. Start Apache and MariaDB.

---

## Docker Deployment

The Compose file expects two ignored environment files: `.env.glpi` for GLPI/database settings and `.env.settings` for frontend settings. It also expects the external Docker network and GLPI data volume named by `GLPI_NETWORK` and `GLPI_DATA_VOLUME`.

1. Copy `.env.example` to `.env` and review the image, port, network, and volume values.
2. Create `.env.glpi` with the database values required by the GLPI image.
3. Create `.env.settings` with frontend runtime settings. Keep both files out of version control.
4. Ensure the configured external network and data volume exist before starting.

```bash
docker compose up -d
docker compose ps
```

The default local URLs are `http://127.0.0.1:8091` for the Asset Hub and `http://127.0.0.1:8095` for native GLPI.

---

## Start the Frontend

```bash
cd glpi-frontend
npm ci
npm test -- --run
php vendor/bin/phpunit --no-coverage
npm run build
npm run lint
```

For the authenticated browser smoke test, provide a test GLPI user token and run:

```bash
E2E_GLPI_USER_TOKEN='...' npm run test:e2e
```

Set `E2E_REQUIRED=1` when missing credentials should fail the test instead of skipping it. The test covers login, asset loading, metadata loading, document upload/delete, and logout.

---

## Access the Application

Open the Asset Hub at:

```
http://127.0.0.1:8091
```

> **Project Status:** Active Development 🚧
