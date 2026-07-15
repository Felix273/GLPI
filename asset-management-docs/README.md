# GLPI Asset Management - Complete Features

## Overview

This document provides a comprehensive breakdown of all Asset Management functionalities available in GLPI 10.0.17.

---

## 1. Hardware Inventory

| Asset Type | Description | Key Features |
|------------|-------------|--------------|
| **Computers** | Desktops & Laptops | Full hardware specs, OS, components, antivirus, virtual machines |
| **Monitors** | Displays & screens | Model, size, connection type |
| **Printers** | Printing devices | Cartridge management, page counts, network info |
| **Peripherals** | Keyboards, mice, scanners, etc. | USB/hardware details |
| **Phones** | VoIP phones, mobile devices | Phone power supply, models |
| **Network Equipment** | Switches, routers, firewalls | SNMP credentials, ports, IP management |
| **Unmanaged Devices** | Discovered but not inventoried | Auto-discovery integration |

---

## 2. Software Management

- **Software Catalog** - Track all installed software
- **Software Versions** - Version control per asset
- **Software Licenses** - License tracking (perpetual, subscription, OEM, volume)
- **License Assignment** - Link licenses to users/computers
- **Software Categories** - Organizational categorization

---

## 3. Consumables & Cartridges

- **Cartridge Items** - Printer cartridge types
- **Cartridge Management** - Stock levels, alerts
- **Consumables** - General consumable tracking (toner, paper, etc.)
- **Stock Management** - Inventory levels with alerts

---

## 4. Datacenter Infrastructure

- **Racks** - Server rack management
- **Rack Models** - Rack types/sizes
- **PDUs** - Power Distribution Units
- **Enclosures** - Blade chassis
- **Passive Equipment** - Cable trays, patch panels
- **Cables** - Cable management with tracing
- **Sockets** - Power outlet mapping

---

## 5. Virtualization

- **Virtual Machines** - VMware, Hyper-V, KVM, etc.
- **Clusters** - HA cluster management
- **VM Types/States** - Classification

---

## 6. Database Instance Management

- **Database Instances** - MySQL, PostgreSQL, Oracle, SQL Server
- **Database Categories** - Environment classification
- **Instance Types** - Purpose categorization

---

## 7. Certificates & SSL/TLS

- **Certificate Management** - SSL certificates tracking
- **Expiration Alerts** - Automated renewal reminders
- **Certificate Types** - Organization

---

## 8. Appliances

- **Appliance Tracking** - Application stacks
- **Appliance Types** - Categories (servers, services)
- **Environments** - Dev, Staging, Production

---

## 9. Contracts Management

- **Contract Tracking** - Support, leasing, warranties
- **Contract Types** - SLA, maintenance, hardware support
- **Contract Costs** - Financial tracking
- **Contract Assignment** - Link to assets

---

## 10. Financial & Budget

- **Infocom** - Asset financial info (purchase date, warranty, value)
- **Budgets** - Budget planning and tracking
- **Depreciation** - Asset value depreciation

---

## 11. Document Management

- **Documents** - Attach manuals, receipts, photos to assets
- **Document Categories** - Organized filing
- **File Types** - Supported formats

---

## 12. Location Management

- **Locations** - Buildings, floors, rooms
- **Datacenters** - Server room management
- **Racks** - Physical positioning

---

## 13. Domain & Network

- **Domains** - Domain name tracking
- **DNS Records** - A, CNAME, MX records
- **IP Management** - IP subnets, addresses
- **VLANS** - Network segmentation
- **WiFi Networks** - Wireless SSIDs

---

## 14. Contacts & Suppliers

- **Contacts** - Vendor/tech contact info
- **Suppliers** - Company profiles
- **Supplier Contracts** - Link suppliers to contracts

---

## 15. Rule-Based Automation

- **Asset Import Rules** - Auto-discovery rules
- **Entity Rules** - Multi-entity configuration
- **Location Rules** - Auto-location assignment
- **Dictionary Rules** - Auto-categorization

---

## 16. Inventory Tools

- **Agent Deployment** - GLPI Agent for auto-inventory
- **SNMP Discovery** - Network device scanning
- **Inventory Formats** - XML, CSV, JSON imports

---

## Summary Table of Asset Types

| Category | Assets |
|----------|--------|
| **Computing** | Computer, Server, Monitor, Peripheral, Phone |
| **Networking** | NetworkEquipment, Unmanaged |
| **Printing** | Printer, Cartridge, CartridgeItem |
| **Software** | Software, SoftwareLicense, SoftwareVersion |
| **Infrastructure** | Rack, PDU, Enclosure, PassiveDCEquipment |
| **Virtualization** | VirtualMachine, Cluster |
| **Databases** | DatabaseInstance |
| **Security** | Certificate, Certificate_Item |
| **Appliances** | Appliance, ApplianceEnvironment |
| **Contracts** | Contract, Contract_Item, Infocom |
| **Financial** | Budget, BudgetType |
| **Documents** | Document, DocumentCategory |
| **Location** | Location, Datacenter, DCRoom |
| **Network** | Domain, IPNetwork, IPAddress, Vlan |
| **Contacts** | Contact, Supplier |

---

## Source Code References

All asset types are defined in `/src/` directory:
- Main classes: `Computer.php`, `Printer.php`, `Monitor.php`, `NetworkEquipment.php`, etc.
- Asset rules: `RuleAsset.php`, `RuleImportAsset.php`
- Device components: `Device*.php` (DeviceBattery, DeviceMemory, etc.)

---

*Generated for GLPI 10.0.17*
