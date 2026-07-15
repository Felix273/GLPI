/**
 * GLPI API Client
 * Handles all communication with GLPI REST API
 */

class GLPIClient {
    constructor() {
        this.baseUrl = '';
        this.userToken = '';
        this.appToken = '';
        this.sessionToken = null;
        this.sessionInfo = null;
        this.backendMode = false;
        this.backendAuthenticated = false;
    }

    /**
     * Initialize the API client with credentials
     */
    init(baseUrl, userToken, appToken = '') {
        // Remove trailing slash
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.userToken = userToken;
        this.appToken = appToken;
    }

    async detectBackend() {
        if (window.location.protocol === 'file:' || window.location.port === '5500') {
            this.backendMode = false;
            return false;
        }

        try {
            const response = await fetch('/backend/session', {
                cache: 'no-store',
                credentials: 'same-origin'
            });
            this.backendMode = response.ok && response.headers.get('content-type')?.includes('application/json');
        } catch {
            this.backendMode = false;
        }
        return this.backendMode;
    }

    /**
     * Make authenticated API request
     */
    async request(endpoint, options = {}) {
        if (this.backendMode) {
            await this.ensureBackendSession();
            return await this.backendRequest(`/backend/glpi${endpoint}`, options);
        }

        if (this.isLiveServerUrl(this.baseUrl)) {
            throw new Error('Live Server cannot serve GLPI API. Use the GLPI URL, for example http://localhost:8099, or run php -S 127.0.0.1:8091 server.php.');
        }

        const url = `${this.baseUrl}/apirest.php${endpoint}`;
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `user_token ${this.userToken}`
        };

        if (this.appToken) {
            headers['App-Token'] = this.appToken;
        }

        if (this.sessionToken) {
            headers['Session-Token'] = this.sessionToken;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers: { ...headers, ...options.headers }
            });

            const contentType = response.headers.get('content-type') || '';
            const data = contentType.includes('application/json') ? await response.json() : await response.text();

            if (!response.ok) {
                const message = Array.isArray(data)
                    ? data.filter(Boolean).join(': ')
                    : typeof data === 'string'
                        ? `HTTP ${response.status}: ${data.slice(0, 160)}`
                        : data?.message || data?.error || `HTTP ${response.status}`;
                throw new Error(message);
            }

            if (!contentType.includes('application/json')) {
                throw new Error(`Expected JSON from GLPI API but received ${contentType || 'non-JSON response'}`);
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    isLiveServerUrl(url) {
        try {
            return new URL(url, window.location.href).port === '5500';
        } catch {
            return false;
        }
    }

    /**
     * Start a session with the API
     */
    async initSession() {
        if (this.backendMode) {
            const data = await this.backendRequest('/backend/session', {
                method: 'POST',
                body: JSON.stringify({ url: this.baseUrl, token: this.userToken, appToken: this.appToken })
            });
            this.sessionToken = data.session_token;
            this.sessionInfo = data.session;
            this.backendAuthenticated = true;
            await this.ensureBackendSession();
            return data;
        }

        const data = await this.request('/initSession');
        this.sessionToken = data.session_token;
        return data;
    }

    /**
     * End the current session
     */
    async killSession() {
        if (this.backendMode) {
            await this.backendRequest('/backend/logout', { method: 'POST' });
            this.sessionToken = null;
            this.backendAuthenticated = false;
            return;
        }

        await this.request('/killSession');
        this.sessionToken = null;
    }

    /**
     * Get current user info
     */
    async getMyInfo() {
        if (this.backendMode) {
            const data = await this.backendRequest('/backend/session');
            if (!data.authenticated) throw new Error('Not authenticated');
            return this.sessionInfo || { session: null };
        }
        return await this.request('/getFullSession');
    }

    async ensureBackendSession() {
        if (!this.backendMode) return true;
        if (!this.backendAuthenticated) {
            throw new Error('Not authenticated with GLPI. Please sign in again.');
        }
        const data = await this.backendRequest('/backend/session');
        if (!data.authenticated) {
            this.sessionToken = null;
            this.backendAuthenticated = false;
            throw new Error('Not authenticated with GLPI. Please sign in again.');
        }
        return true;
    }

    async backendRequest(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (response.status === 401) {
                this.sessionToken = null;
                this.backendAuthenticated = false;
            }
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        return data;
    }

    async getMetadata(itemtype, id) {
        if (!this.backendMode) return null;
        return await this.backendRequest(`/backend/metadata/${encodeURIComponent(itemtype)}/${encodeURIComponent(id)}`);
    }

    async saveMetadata(itemtype, id, data) {
        if (!this.backendMode) return null;
        return await this.backendRequest(`/backend/metadata/${encodeURIComponent(itemtype)}/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async saveDocument(itemtype, id, document) {
        if (!this.backendMode) return null;
        return await this.backendRequest(`/backend/documents/${encodeURIComponent(itemtype)}/${encodeURIComponent(id)}`, {
            method: 'POST',
            body: JSON.stringify(document)
        });
    }

    async deleteDocument(itemtype, id, documentId) {
        if (!this.backendMode) return null;
        return await this.backendRequest(`/backend/documents/${encodeURIComponent(itemtype)}/${encodeURIComponent(id)}?id=${encodeURIComponent(documentId)}`, {
            method: 'DELETE'
        });
    }

    async getInventorySummary() {
        if (!this.backendMode) return null;
        return await this.backendRequest('/backend/inventory/summary');
    }

    async getComputerInventory(id) {
        if (!this.backendMode) return null;
        return await this.backendRequest(`/backend/inventory/computer/${encodeURIComponent(id)}`);
    }

    async getSoftwareInstallations() {
        if (!this.backendMode) return null;
        return await this.backendRequest('/backend/software/installations');
    }

    /**
     * Get all items of a specific type
     */
    async getItems(itemtype, options = {}) {
        const params = new URLSearchParams({
            range: options.range || '0-1000',
            ...options
        });
        return await this.request(`/${itemtype}?${params}`);
    }

    /**
     * Get a single item
     */
    async getItem(itemtype, id) {
        return await this.request(`/${itemtype}/${id}`);
    }

    /**
     * Search for items
     */
    async search(itemtype, criteria = []) {
        const params = new URLSearchParams({
            'criteria[0][field]': '1',
            'criteria[0][searchtype]': 'contains',
            'criteria[0][value]': '',
            'range': '0-1000'
        });
        
        criteria.forEach((c, i) => {
            params.set(`criteria[${i+2}][field]`, c.field);
            params.set(`criteria[${i+2}][searchtype]`, c.searchtype);
            params.set(`criteria[${i+2}][value]`, c.value);
        });

        return await this.request(`/search${itemtype}?${params}`);
    }

    /**
     * Create a new item
     */
    async createItem(itemtype, data) {
        return await this.request(`/${itemtype}`, {
            method: 'POST',
            body: JSON.stringify({ input: data })
        });
    }

    /**
     * Update an item
     */
    async updateItem(itemtype, id, data) {
        return await this.request(`/${itemtype}/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ input: data })
        });
    }

    /**
     * Delete an item
     */
    async deleteItem(itemtype, id) {
        return await this.request(`/${itemtype}/${id}`, {
            method: 'DELETE'
        });
    }

    /**
     * Get dropdown values
     */
    async getDropdownValues(itemtype) {
        return await this.request(`/${itemtype}`);
    }

    /**
     * Get list of active entities
     */
    async getEntities() {
        return await this.request('/getMyEntities');
    }
}

// Export singleton instance
const glpi = new GLPIClient();
