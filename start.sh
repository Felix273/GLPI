#!/usr/bin/env bash
# Power up the GLPI stack locally:
#   - GLPI 10.0.17 backend  on http://127.0.0.1:8099  (PHP built-in server, glpi-router.php)
#   - Custom asset frontend on http://127.0.0.1:8091     (glpi-frontend/server.php)
#
# Requirements:
#   - MariaDB/MySQL running with DB "glpi" (user glpi / pass glpi12345) [already present]
#   - PHP 8.1+ CLI
#
# Note: port 8080 is occupied by another app (Snipe-IT / KUCCPS), so the
# frontend uses 8091 instead of the 8080 mentioned in older notes.

set -euo pipefail

ROOT="/home/felix/FENTECH PROJECTS/GLPI"
GLPI_PUBLIC="$ROOT/glpi/public"
FRONTEND="$ROOT/glpi-frontend"
GLPI_PORT=8099
FRONTEND_PORT=8091

# Bind to 0.0.0.0 so the stack is reachable via the machine LAN IP
# (e.g. 192.168.49.4) which usually bypasses a browser/forward proxy that
# blocks loopback (127.0.0.1 -> "Access denied / 403").
# NOTE: the GLPI router MUST be started from the public dir with a relative
# "index.php" router. Passing the absolute router path fails because it
# contains a space ("FENTECH PROJECTS").
BIND="0.0.0.0"

port_in_use() { ss -ltn 2>/dev/null | grep -q ":$1 "; }

# 1) GLPI backend
if port_in_use "$GLPI_PORT"; then
  echo "GLPI backend already listening on $GLPI_PORT"
else
  echo "Starting GLPI backend on $GLPI_PORT ..."
  ( cd "$GLPI_PUBLIC" && nohup php -S "$BIND:$GLPI_PORT" index.php >/tmp/glpi-backend.log 2>&1 & )
fi

# 2) Custom frontend
if port_in_use "$FRONTEND_PORT"; then
  echo "Frontend already listening on $FRONTEND_PORT"
else
  echo "Starting frontend on $FRONTEND_PORT ..."
  ( cd "$FRONTEND" && nohup php -S "$BIND:$FRONTEND_PORT" server.php >/tmp/glpi-frontend.log 2>&1 & )
fi

sleep 1
echo
echo "GLPI backend : http://127.0.0.1:$GLPI_PORT  (also http://<LAN-IP>:$GLPI_PORT)"
echo "Frontend     : http://127.0.0.1:$FRONTEND_PORT  (also http://<LAN-IP>:$FRONTEND_PORT)"
echo "LAN IP(s)    : $(hostname -I 2>/dev/null)"
