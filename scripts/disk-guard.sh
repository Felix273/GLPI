#!/usr/bin/env bash
set -euo pipefail

# GLPI Asset Dashboard Disk Guard Script
# Monitors disk usage and cleans up:
#   - Old log files
#   - Rate-limit cache files
#   - Old backups beyond retention

LOG_LEVEL="${DISK_GUARD_LOG_LEVEL:-INFO}"
THRESHOLD="${DISK_GUARD_THRESHOLD:-90}"

log() {
    local level="$1"; shift
    if [ "$level" = "ERROR" ] || [ "$LOG_LEVEL" = "DEBUG" ] || [ "$LOG_LEVEL" = "INFO" ]; then
        echo "[$(date '+%H:%M:%S')] [$level] $*" >&2
    fi
}

check_disk() {
    local usage
    usage=$(df / --output=pcent 2>/dev/null | tail -1 | tr -dc '0-9')
    if [ -z "$usage" ]; then
        log "WARN" "Unable to determine disk usage"
        return 0
    fi
    log "INFO" "Disk usage: ${usage}%"
    if [ "$usage" -ge "$THRESHOLD" ]; then
        log "WARN" "Disk usage ${usage}% exceeds threshold ${THRESHOLD}%. Cleaning up..."
        cleanup
    else
        log "INFO" "Disk usage below threshold (${THRESHOLD}%). No action needed."
    fi
}

cleanup() {
    # Clean old rate-limit cache files
    local rate_limit_dir="${TMPDIR:-/tmp}/glpi-ratelimit"
    if [ -d "$rate_limit_dir" ]; then
        find "$rate_limit_dir" -name "*.json" -mmin +120 -delete 2>/dev/null || true
        log "INFO" "Cleaned rate-limit cache files"
    fi

    # Clean old PHP logs
    find /tmp -name "glpi-*.log" -mmin +1440 -delete 2>/dev/null || true
    log "INFO" "Cleaned old log files"

    # Clean old backups beyond retention
    local backup_retention="${BACKUP_RETENTION_DAYS:-7}"
    local backup_dir="${BACKUP_DIR:-$(pwd)/backups}"
    if [ -d "$backup_dir" ]; then
        find "$backup_dir" -name "backup-*.tar.gz" -mtime +$backup_retention -delete 2>/dev/null || true
        log "INFO" "Cleaned old backups (retention: $backup_retention days)"
    fi

    # Verify disk is now below threshold
    local usage
    usage=$(df / --output=pcent 2>/dev/null | tail -1 | tr -dc '0-9')
    if [ -n "$usage" ]; then
        log "INFO" "Disk usage after cleanup: ${usage}%"
    fi
}

case "${1:---check}" in
    --check)
        check_disk
        ;;
    --cleanup)
        cleanup
        ;;
    --monitor)
        while true; do
            check_disk
            sleep 300
        done
        ;;
    *)
        echo "Usage: $0 {--check|--cleanup|--monitor}"
        exit 1
        ;;
esac
