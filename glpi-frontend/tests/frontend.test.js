import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const csvImportHelpers = require('../assets/js/core/import-format.cjs');

describe('computer CSV import format', () => {
    it('normalizes the requested computer spreadsheet headers', () => {
        const headers = [
            'NO.', 'STAFF ASSIGNED/OFFICE', 'LOCATION', 'MODEL', 'PROCESSOR',
            'RAM INSTALLED', 'WINDOWS (OS)', 'OFFICE SUITE', 'SERIAL NO',
            'ASSET TAG', 'YEAR OF ACQUISITION', 'LIFESPAN', 'STATUS',
            'ASSET CONDITION', 'COMMENT/ISSUE'
        ];

        expect(headers.map(csvImportHelpers.normalizeImportHeader)).toEqual([
            'external_id', 'assigned_to', 'locations_id', 'model', 'processor',
            'ram_installed', 'operating_system', 'office_suite', 'serial',
            'otherserial', 'acquisition_year', 'lifespan', 'status',
            'asset_condition', 'comment'
        ]);
    });

    it('preserves aliases from previous CSV formats', () => {
        expect(csvImportHelpers.normalizeImportHeader('Purchase Value')).toBe('value');
        expect(csvImportHelpers.normalizeImportHeader('Asset Type')).toBe('itemtype');
        expect(csvImportHelpers.normalizeImportHeader('Comments')).toBe('comment');
        expect(csvImportHelpers.normalizeImportHeader('CPU SERIAL NO')).toBe('serial');
        expect(csvImportHelpers.normalizeImportHeader('CPU TAG')).toBe('otherserial');
    });

    it('accepts punctuation variants of common GLPI statuses', () => {
        expect(csvImportHelpers.importStatusValue('ACTIVE-IN USE')).toBe(1);
        expect(csvImportHelpers.importStatusValue('Checked Out')).toBe(1);
        expect(csvImportHelpers.importStatusValue('Available')).toBe(0);
        expect(csvImportHelpers.importStatusValue('Retired')).toBe(2);
        expect(csvImportHelpers.importStatusValue('Broken')).toBe(3);
        expect(csvImportHelpers.importStatusValue('Unrecognized')).toBeNull();
    });

    it('preserves organization-specific computer status labels as text', () => {
        expect(csvImportHelpers.normalizeImportedStatus('Active in Use')).toBe('Active in Use');
        expect(csvImportHelpers.normalizeImportedStatus('Returned to ICT')).toBe('Returned to ICT');
        expect(csvImportHelpers.normalizeImportedStatus('Not in Active Use')).toBe('Not in Active Use');
        expect(csvImportHelpers.normalizeImportedStatus('  ')).toBe('');
    });

    it('displays the resolved location name instead of its numeric GLPI ID', () => {
        expect(csvImportHelpers.assetLocationDisplayValue({ locations_id: 2, _keys_names: { locations_id: 'CEO’S OFFICE' } }, 'ICT Store')).toBe('ICT Store');
        expect(csvImportHelpers.assetLocationDisplayValue({ locations_id: 2 }, 'Imported Office')).toBe('Imported Office');
        expect(csvImportHelpers.assetLocationDisplayValue({ locations_id: 2, _keys_names: { locations_id: 'CEO’S OFFICE' } })).toBe('CEO’S OFFICE');
        expect(csvImportHelpers.assetLocationDisplayValue({ locations_id: 2 })).toBe('2');
    });

    it('routes APC model rows and explicit UPS rows to GLPI Peripheral', () => {
        expect(csvImportHelpers.resolveImportItemType({ model: 'APC Smart-UPS 1500' })).toBe('Peripheral');
        expect(csvImportHelpers.isUpsImportRow({ model: 'APC Smart-UPS 1500' })).toBe(true);
        expect(csvImportHelpers.resolveImportItemType({ itemtype: 'UPS', model: 'Back-UPS' })).toBe('Peripheral');
        expect(csvImportHelpers.isUpsImportRow({ itemtype: 'UPS', model: 'Back-UPS' })).toBe(true);
        expect(csvImportHelpers.resolveImportItemType({ model: 'Dell OptiPlex' })).toBe('Computer');
    });

    it('classifies laptop rows for the Laptop view while keeping them GLPI Computers', () => {
        expect(csvImportHelpers.isLaptopImportRow({ itemtype: 'Laptop', model: 'Generic Model' })).toBe(true);
        expect(csvImportHelpers.isLaptopImportRow({ model: 'Dell Latitude 5420' })).toBe(true);
        expect(csvImportHelpers.isLaptopImportRow({ model: 'HP EliteBook 840 G8' })).toBe(true);
        expect(csvImportHelpers.isLaptopImportRow({ model: 'Dell OptiPlex 7090' })).toBe(false);
        expect(csvImportHelpers.resolveImportItemType({ itemtype: 'Laptop', model: 'Dell Latitude 5420' })).toBe('Computer');
    });

    it('partitions dashboard Computer and Peripheral assets into exclusive categories', () => {
        const laptop = { itemtype: 'Computer', category: 'Laptop', model: 'Generic' };
        const desktop = { itemtype: 'Computer', model: 'Dell OptiPlex 7090' };
        const ups = { itemtype: 'Peripheral', category: 'UPS', model: 'Generic Battery Backup' };
        const keyboard = { itemtype: 'Peripheral', category: 'Keyboard', model: 'USB Keyboard' };
        const otherPeripheral = { itemtype: 'Peripheral', model: 'Scanner' };

        expect(csvImportHelpers.matchesDashboardCategory(laptop, 'Laptops')).toBe(true);
        expect(csvImportHelpers.matchesDashboardCategory(laptop, 'CPU')).toBe(false);
        expect(csvImportHelpers.matchesDashboardCategory(desktop, 'CPU')).toBe(true);
        expect(csvImportHelpers.matchesDashboardCategory(desktop, 'Laptops')).toBe(false);
        expect(csvImportHelpers.matchesDashboardCategory(ups, 'UPS')).toBe(true);
        expect(csvImportHelpers.matchesDashboardCategory(ups, 'Peripherals')).toBe(false);
        expect(csvImportHelpers.matchesDashboardCategory(keyboard, 'Peripherals')).toBe(true);
        expect(csvImportHelpers.matchesDashboardCategory({ model: 'Keyboard' }, 'Peripherals')).toBe(true);
        expect(csvImportHelpers.matchesDashboardCategory(otherPeripheral, 'Peripherals')).toBe(false);
    });

    it('stops bulk imports for permission, expired-session, and rate-limit errors', () => {
        expect(csvImportHelpers.shouldStopImportAfterError({ status: 400, message: "You don't have permission" })).toBe(true);
        expect(csvImportHelpers.shouldStopImportAfterError({ status: 401, message: 'Unauthorized' })).toBe(true);
        expect(csvImportHelpers.shouldStopImportAfterError({ status: 429, message: 'Too many requests' })).toBe(true);
        expect(csvImportHelpers.shouldStopImportAfterError({ status: 400, message: 'Invalid serial number' })).toBe(false);
    });
});

const buildAlertTarget = (target = null) => {
    if (!target) return null;
    if (typeof target === 'string') {
        return { type: 'view', view: target, apiType: null, id: null };
    }

    if (typeof target === 'object') {
        if (target.type === 'asset' || target.apiType) {
            return { type: 'asset', apiType: target.apiType ? String(target.apiType) : null, id: target.id !== undefined && target.id !== null ? Number(target.id) : null, view: null };
        }

        if (target.type === 'view' || target.view) {
            return { type: 'view', view: target.view || target.route || 'alerts', apiType: null, id: null };
        }
    }

    return null;
};

const resolveAlertTarget = (target = null) => {
    const normalized = buildAlertTarget(target);
    if (!normalized) return { type: 'view', view: 'alerts', apiType: null, id: null };
    if (normalized.type === 'asset' && normalized.apiType && normalized.id !== null) {
        return { type: 'asset', apiType: normalized.apiType, id: Number(normalized.id), view: null };
    }
    return { type: 'view', view: normalized.view || 'alerts', apiType: null, id: null };
};

describe('escapeHtml', () => {
    const escapeHtml = (value) => {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]);
    };

    it('should escape HTML special characters', () => {
        expect(escapeHtml('<script>alert("xss")</script>')).toBe(
            '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
        );
    });

    it('should escape quotes and ampersands', () => {
        expect(escapeHtml('"\'<>')).toBe('&quot;&#39;&lt;&gt;');
    });

    it('should handle null and undefined', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });

    it('should handle regular text', () => {
        expect(escapeHtml('Hello World')).toBe('Hello World');
    });
});

describe('normalizeUserAssociationKey', () => {
    const normalizeUserAssociationKey = (value) => {
        return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    };

    it('should normalize whitespace and case', () => {
        expect(normalizeUserAssociationKey('  John  Doe  ')).toBe('john doe');
    });

    it('should handle empty values', () => {
        expect(normalizeUserAssociationKey('')).toBe('');
        expect(normalizeUserAssociationKey(null)).toBe('');
        expect(normalizeUserAssociationKey(undefined)).toBe('');
    });

    it('should normalize case', () => {
        expect(normalizeUserAssociationKey('DEREK MAKANA')).toBe('derek makana');
    });
});

describe('dashboard layout', () => {
    const normalizeDashboardLayout = (saved, widgets) => {
        const order = Array.isArray(saved?.order) ? saved.order.filter(id => widgets.includes(id)) : [];
        return {
            order: [...order, ...widgets.filter(id => !order.includes(id))],
            hidden: Array.isArray(saved?.hidden) ? saved.hidden.filter(id => widgets.includes(id)) : []
        };
    };

    it('keeps unknown widgets out and appends missing defaults', () => {
        expect(normalizeDashboardLayout({ order: ['charts', 'unknown'], hidden: ['software', 'bad'] }, ['asset-stats', 'charts', 'software'])).toEqual({
            order: ['charts', 'asset-stats', 'software'],
            hidden: ['software']
        });
    });

    it('keeps optional widgets hidden until selected', () => {
        const widgets = ['asset-stats', 'warranty-watch', 'team-notes'];
        const saved = normalizeDashboardLayout({}, widgets);
        expect(saved.order).toEqual(widgets);
    });
});

describe('alert navigation targets', () => {
    it('maps asset targets to a GLPI asset view route', () => {
        const target = buildAlertTarget({ apiType: 'Computer', id: 42 });
        expect(resolveAlertTarget(target)).toEqual({
            type: 'asset',
            apiType: 'Computer',
            id: 42,
            view: null
        });
    });

    it('keeps simple view routes intact', () => {
        expect(resolveAlertTarget('alerts')).toEqual({
            type: 'view',
            view: 'alerts',
            apiType: null,
            id: null
        });
    });
});
