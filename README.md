# GLPI Asset Management Enhancement Platform

A modern enterprise IT Asset Management (ITAM) platform built on top of GLPI, featuring a custom dashboard, enhanced asset analytics, interactive reporting, REST API integration, and a modern responsive frontend.

---

## Project Overview

This project extends the capabilities of GLPI by providing a modern user experience and enterprise-grade management features while preserving the stability of the GLPI core.

Instead of modifying the GLPI source directly, the system introduces a modular architecture consisting of a custom frontend, backend services, plugins, and API integrations that communicate with GLPI through its REST API.

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
├── backend/              # Backend services and API integrations
├── config/               # Configuration files
├── docker/               # Docker configuration
├── docs/                 # Project documentation
├── frontend/             # Future frontend components
├── glpi/                 # GLPI core application
├── glpi-frontend/        # Custom frontend dashboard
├── plugins/              # Custom GLPI plugins
├── sample-assets/        # Sample data for testing
├── scripts/              # Utility and deployment scripts
├── .github/              # GitHub workflows and templates
├── .gitignore
├── README.md
└── start.sh
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
- Docker & Docker Compose (optional)
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

```bash
docker compose up -d
```

---

## Start the Frontend

```bash
cd glpi-frontend
```

Run your preferred frontend development or build commands depending on the tooling used in that directory.

---

## Access the Application

Open your browser and visit:

```
http://localhost
```

> **Project Status:** Active Development 🚧
