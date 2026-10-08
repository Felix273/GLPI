# KUCCPS / Snipe-IT CSV Import Template

The frontend import template now uses these columns in this exact order:

1. STAFF ASSIGNED/OFFICE
2. LOCATION
3. ASSET TYPE
4. MODEL
5. SERIAL NO.
6. ASSET TAG
7. YEAR OF ACQUISITION
8. STATUS

The importer accepts the original headings without renaming them. Asset Tag is used as the GLPI asset name when no separate name is supplied. Location names are resolved or created in GLPI, `Access Point` is imported as Network Equipment, acquisition years are stored as January 1 of the supplied year, and `ACTIVE-IN USE` maps to the assigned/in-use status.
