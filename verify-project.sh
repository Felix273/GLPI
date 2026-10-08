#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
php -l glpi-frontend/server.php
node --check glpi-frontend/assets/js/api.js
node --check glpi-frontend/main.js
while IFS= read -r -d '' file; do
    node --check "$file"
done < <(find glpi-frontend/assets/js -type f -name '*.js' -print0)
python3 - <<'PY'
from pathlib import Path
import yaml
data = yaml.safe_load(Path('compose.yml').read_text())
expected = {'glpi', 'frontend', 'glpi-cron', 'prometheus', 'caddy', 'cadvisor'}
assert set(data['services']) == expected
print('Compose YAML is valid.')
PY
echo 'Project verification passed.'
