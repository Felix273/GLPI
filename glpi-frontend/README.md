# GLPI Asset Management Frontend

A simplified, modern frontend for GLPI that connects via the REST API.

## Features

- **Dashboard** - Overview with asset counts
- **Asset Management** - View computers, monitors, printers, network equipment, software, licenses, and contracts
- **Modern UI** - Clean, dark-themed interface
- **API Integration** - PHP backend proxy for GLPI REST API
- **Shared Custom Metadata** - Financial, stock, and document metadata stored on the server
- **Inventory Health** - Agent-reporting/stale-machine summary when GLPI inventory is available
- **Software Matrix** - Software catalog/install visibility helpers

## Prerequisites

1. GLPI 10.x installed and running
2. GLPI API enabled (API > Setup in GLPI admin)
3. A GLPI user with API token

## Setup Instructions

### Step 1: Enable GLPI API

1. Log into GLPI as an administrator
2. Go to **Setup** > **General** > **API**
3. Enable the API
4. Note the API URL (e.g., `http://localhost:8099/apirest.php`)

### Step 2: Get User Token

1. Log into GLPI
2. Click on your username in the top-right
3. Go to **Settings** > **API token**
4. Generate or copy your user token

### Step 3: Run the Frontend

#### Option A: Direct Browser
Open `index.html` directly in your browser:
```
file:///path/to/glpi-frontend/index.html
```

#### Option B: PHP Server (Recommended)
Start the built-in PHP server:

```bash
cd /home/felix/FENTECH\ PROJECTS/GLPI/glpi-frontend
php -S localhost:8080 server.php
```

Then open `http://localhost:8080` in your browser.

The PHP server is now the preferred mode. It provides:

- `/backend/session` for GLPI login/session handling
- `/backend/glpi/...` as the GLPI API proxy
- `/backend/metadata/{itemtype}/{id}` for shared financial/stock/document metadata
- `/backend/inventory/summary` for GLPI Agent inventory health
- `/backend/software/installations` for software relationship reporting

Custom dashboard metadata is stored under `data/metadata`. Document metadata is stored with the asset metadata; `data/documents` is reserved for backend document storage.

## Usage

1. Enter your GLPI URL (e.g., `http://localhost:8099`)
2. Enter your GLPI user token
3. Click "Connect"

The dashboard will load asset counts from your GLPI instance. If served through `server.php`, the browser authenticates to the local backend and the backend proxies GLPI requests.

## Inventory Agent Flow

For automatic machine health and software inventory:

1. Enable GLPI native inventory.
2. Install GLPI Agent on at least one test computer.
3. Configure the agent server URL, for example:

```text
http://your-glpi-server/front/inventory.php
```

4. Confirm the computer appears in GLPI with inventory data.
5. Open **Inventory Health** and **Software Matrix** in this dashboard.

## Project Structure

```
glpi-frontend/
├── index.html          # Main HTML
├── server.php          # PHP server/backend proxy
├── data/               # Shared metadata/document storage
├── assets/
│   ├── css/
│   │   └── style.css   # Styling
│   └── js/
│       ├── api.js      # GLPI API client
│       └── app.js     # Application logic
└── README.md
```

## API Endpoints Used

- `GET /initSession` - Start API session
- `GET /killSession` - End API session
- `GET /getFullSession` - Get user info
- `GET /Computer` - List computers
- `GET /Monitor` - List monitors
- `GET /Printer` - List printers
- `GET /NetworkEquipment` - List network equipment
- `GET /Software` - List software
- `GET /SoftwareLicense` - List licenses

## Extending

To add more asset types, edit `ASSET_TYPES` in `assets/js/app.js`:

```javascript
const ASSET_TYPES = {
    phones: { name: 'Phone', icon: 'phones', searchField: 1 },
    // Add more...
};
```

## Troubleshooting

### CORS Errors
If you see CORS errors, use the PHP server (`server.php`) which proxies requests.

### Authentication Failed
- Verify your GLPI URL is correct
- Check the API is enabled in GLPI
- Ensure your user token is valid

### Empty Data
- Verify your user has permissions to view assets
- Check the API log in GLPI for errors
