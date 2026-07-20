#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
php -l glpi-frontend/server.php
node --check glpi-frontend/assets/js/api.js
node --check glpi-frontend/assets/js/app.js
python3 - <<'PY'
from pathlib import Path
import yaml
for filename in ('compose.yml', 'compose.glpi.yml'):
    data = yaml.safe_load(Path(filename).read_text())
    assert set(data['services']) == {'glpi', 'frontend'}
print('Compose YAML is valid.')
PY
echo 'Project verification passed.'
