import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';

const dashboardCustomizationModule = await import(
  fileURLToPath(new URL('../assets/js/features/dashboard-customization.js', import.meta.url))
);

const {
  normalizeDashboardLayout,
  toggleDashboardWidgetVisibility,
  removeCustomDashboardWidget,
} = dashboardCustomizationModule;

describe('dashboard customization helpers', () => {
  it('keeps a valid layout ordered, appends missing widgets, and honors default hidden widgets', () => {
    const layout = normalizeDashboardLayout(
      { order: ['charts', 'unknown'], hidden: ['software', 'bad'] },
      ['asset-stats', 'charts', 'software', 'recent-activity'],
      ['software']
    );

    expect(layout).toEqual({
      order: ['charts', 'asset-stats', 'recent-activity', 'software'],
      hidden: ['software'],
    });
  });

  it('toggles only the selected widget visibility and preserves the rest', () => {
    const layout = toggleDashboardWidgetVisibility(
      { order: ['asset-stats', 'charts'], hidden: ['charts'] },
      'asset-stats'
    );

    expect(layout).toEqual({
      order: ['asset-stats', 'charts'],
      hidden: ['charts', 'asset-stats'],
    });
  });

  it('removes a custom widget without disturbing the others', () => {
    const widgets = [
      { id: 'custom-1', title: 'First widget', type: 'kpi' },
      { id: 'custom-2', title: 'Second widget', type: 'list' },
      { id: 'custom-3', title: 'Third widget', type: 'notes' },
    ];

    expect(removeCustomDashboardWidget(widgets, 'custom-2')).toEqual([
      { id: 'custom-1', title: 'First widget', type: 'kpi' },
      { id: 'custom-3', title: 'Third widget', type: 'notes' },
    ]);
  });
});
