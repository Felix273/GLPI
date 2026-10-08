import { chromium } from 'playwright';

const baseUrl = (process.env.E2E_BASE_URL || 'http://127.0.0.1:8091').replace(/\/$/, '');
const glpiUrl = process.env.E2E_GLPI_URL || 'http://127.0.0.1:8095';
const userToken = process.env.E2E_GLPI_USER_TOKEN || '';
const appToken = process.env.E2E_GLPI_APP_TOKEN || '';
const itemType = process.env.E2E_ITEM_TYPE || 'Computer';
const configuredItemId = process.env.E2E_ITEM_ID || '';
const required = process.env.E2E_REQUIRED === '1';

if (!userToken) {
    const message = 'Authenticated E2E skipped: set E2E_GLPI_USER_TOKEN to enable it.';
    if (required) {
        console.error(message);
        process.exit(1);
    }
    console.log(message);
    process.exit(0);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const consoleErrors = [];
const failedRequests = [];

page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('requestfailed', request => {
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`);
});

async function expectJson(response, label) {
    if (!response.ok()) {
        throw new Error(`${label} failed with HTTP ${response.status()}: ${await response.text()}`);
    }
    return response.json();
}

try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.locator('#glpiUrl').fill(glpiUrl);
    await page.locator('#userToken').fill(userToken);
    await page.locator('#appToken').fill(appToken);
    await page.locator('#loginSubmit').click();

    await page.locator('#app.logged-in').waitFor({ state: 'attached', timeout: 30_000 });
    await page.getByRole('heading', { name: 'Operations overview' }).waitFor({ timeout: 30_000 });

    const computersResponse = await context.request.get(
        `${baseUrl}/backend/glpi/${itemType}?range=0-49`
    );
    const assets = await expectJson(computersResponse, 'asset loading');
    if (!Array.isArray(assets) || assets.length === 0) {
        throw new Error(`asset loading returned no ${itemType} records`);
    }

    const itemId = configuredItemId || String(assets[0].id || '');
    if (!itemId) throw new Error(`asset loading returned a ${itemType} without an id`);

    const metadataResponse = await context.request.get(
        `${baseUrl}/backend/metadata/${itemType}/${itemId}`
    );
    const metadata = await expectJson(metadataResponse, 'metadata loading');
    if (!metadata || typeof metadata !== 'object' || !Array.isArray(metadata.documents)) {
        throw new Error('metadata response has an invalid shape');
    }

    const documentName = `e2e-${Date.now()}.txt`;
    const documentResponse = await context.request.post(
        `${baseUrl}/backend/documents/${itemType}/${itemId}`,
        {
            data: {
                name: documentName,
                type: 'text/plain',
                dataUrl: 'data:text/plain;base64,RU5EVEVTVA=='
            }
        }
    );
    const document = await expectJson(documentResponse, 'document upload');
    if (!document.id || document.name !== documentName) {
        throw new Error('document upload response is missing the created document');
    }

    const deleteResponse = await context.request.delete(
        `${baseUrl}/backend/documents/${itemType}/${itemId}?id=${encodeURIComponent(document.id)}`
    );
    await expectJson(deleteResponse, 'document delete');

    const documentsResponse = await context.request.get(
        `${baseUrl}/backend/documents/${itemType}/${itemId}`
    );
    const documents = await expectJson(documentsResponse, 'document verification');
    if (documents.some(entry => entry.id === document.id)) {
        throw new Error('deleted document is still present');
    }

    await page.getByRole('button', { name: /Logout/ }).click();
    await page.locator('#loginModal').waitFor({ state: 'visible', timeout: 10_000 });

    const sessionResponse = await context.request.get(`${baseUrl}/backend/session`);
    const session = await expectJson(sessionResponse, 'logout verification');
    if (session.authenticated !== false) throw new Error('logout did not clear the backend session');

    if (consoleErrors.length || failedRequests.length) {
        throw new Error(`browser errors: ${JSON.stringify({ consoleErrors, failedRequests })}`);
    }

    console.log(`Authenticated E2E passed for ${itemType}/${itemId}.`);
} finally {
    await browser.close();
}
