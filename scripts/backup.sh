#!/usr/bin/env bash
set -euo pipefail

# GLPI Asset Dashboard Backup Script
# Creates backups of:
#   - GLPI database (mysqldump)
#   - GLPI data volume (tar.gz)
#   - Frontend settings and documents

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

if [ "${1:-}" = "--cleanup" ]; then
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR" -name "backup-*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    log "Cleanup complete."
    exit 0
fi

BACKUP_NAME="backup-$TIMESTAMP"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
mkdir -p "$BACKUP_PATH"

# 1. Database backup
if command -v mysqldump &>/dev/null; then
    DB_NAME="${GLPI_DB_NAME:-glpi}"
    DB_HOST="${GLPI_DB_HOST:-localhost}"
    DB_USER="${GLPI_DB_USER:-glpi}"
    DB_PASS="${GLPI_DB_PASSWORD:-}"
    export MYSQL_PWD="$DB_PASS"
    if mysqldump -h "$DB_HOST" -u "$DB_USER" "$DB_NAME" > "$BACKUP_PATH/glpi_db.sql" 2>/dev/null; then
        log "✓ Database backed up"
    else
        log "✗ Database backup failed (MariaDB/MySQL not reachable)"
    fi
    unset MYSQL_PWD
elif docker ps --format '{{.Names}}' | grep -q glpi-docker; then
    DB_NAME="${GLPI_DB_NAME:-glpi}"
    DB_USER="${GLPI_DB_USER:-glpi}"
    DB_PASS="${GLPI_DB_PASSWORD:-changeme}"
    if docker exec glpi-docker sh -c "MYSQL_PWD='$DB_PASS' mysqldump -u '$DB_USER' '$DB_NAME'" > "$BACKUP_PATH/glpi_db.sql" 2>/dev/null; then
        log "✓ Database backed up (via container)"
    else
        log "✗ Database backup failed (container exec failed)"
    fi
else
    log "∅ Skipping database backup (no mysqldump or container)"
fi

# 2. GLPI data directory
if docker volume ls --format '{{.Name}}' | grep -q "^${GLPI_DATA_VOLUME:-}"; then
    : # volume-based backup handled below
fi
if [ -d "$ROOT/glpi/files" ]; then
    tar czf "$BACKUP_PATH/glpi_files.tar.gz" -C "$ROOT/glpi" files 2>/dev/null && log "✓ GLPI files backed up" || log "∅ GLPI files dir not found"
fi

# 3. Frontend data (settings, metadata, documents)
if [ -d "$ROOT/glpi-frontend/data" ]; then
    tar czf "$BACKUP_PATH/frontend_data.tar.gz" -C "$ROOT/glpi-frontend" data 2>/dev/null && log "✓ Frontend data backed up" || log "∅ Frontend data not found"
fi

# 4. Config files
cp "$ROOT/compose.yml" "$BACKUP_PATH/" 2>/dev/null || true
cp "$ROOT/.env.example" "$BACKUP_PATH/" 2>/dev/null || true
cp "$ROOT/Caddyfile" "$BACKUP_PATH/" 2>/dev/null || true
cp "$ROOT/README.md" "$BACKUP_PATH/" 2>/dev/null || true

log "Compressing backup..."
cd "$BACKUP_DIR"
tar czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_PATH"
log "✓ Backup complete: $BACKUP_PATH.tar.gz"

# Cleanup old backups
find "$BACKUP_DIR" -name "backup-*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
log "✓ Cleanup of backups older than $RETENTION_DAYS days complete."
