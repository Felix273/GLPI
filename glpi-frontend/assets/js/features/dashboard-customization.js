export function normalizeDashboardLayout(savedLayout = {}, widgetIds = [], defaultHiddenWidgetIds = []) {
    const knownWidgets = Array.isArray(widgetIds) ? widgetIds : [];
    const defaults = Array.isArray(defaultHiddenWidgetIds) ? defaultHiddenWidgetIds : [];
    const incoming = savedLayout && typeof savedLayout === 'object' ? savedLayout : {};

    const order = Array.isArray(incoming.order)
        ? incoming.order.filter((id) => knownWidgets.includes(id))
        : [];

    const hidden = Array.isArray(incoming.hidden)
        ? incoming.hidden.filter((id) => knownWidgets.includes(id))
        : [];

    const missingVisibleWidgets = knownWidgets.filter((id) => !order.includes(id) && !defaults.includes(id));
    const missingHiddenWidgets = knownWidgets.filter((id) => !order.includes(id) && defaults.includes(id));
    const nextOrder = [...new Set([...order, ...missingVisibleWidgets, ...missingHiddenWidgets])];
    const nextHidden = [...new Set([
        ...hidden.filter((id) => knownWidgets.includes(id)),
        ...defaults.filter((id) => knownWidgets.includes(id)),
    ])];

    return {
        order: nextOrder,
        hidden: nextHidden.filter((id) => nextOrder.includes(id)),
    };
}

export function toggleDashboardWidgetVisibility(layout = { order: [], hidden: [] }, widgetId) {
    if (!widgetId) return layout;
    const next = {
        order: Array.isArray(layout.order) ? [...layout.order] : [],
        hidden: Array.isArray(layout.hidden) ? [...layout.hidden] : [],
    };

    if (next.hidden.includes(widgetId)) {
        next.hidden = next.hidden.filter((id) => id !== widgetId);
    } else {
        next.hidden = [...new Set([...next.hidden, widgetId])];
    }

    return next;
}

export function removeCustomDashboardWidget(widgets = [], widgetId) {
    if (!widgetId) return widgets;
    return widgets.filter((widget) => widget && widget.id !== widgetId);
}

if (typeof window !== 'undefined') {
    window.dashboardCustomization = {
        normalizeDashboardLayout,
        toggleDashboardWidgetVisibility,
        removeCustomDashboardWidget,
    };
    window.normalizeDashboardLayout = normalizeDashboardLayout;
    window.toggleDashboardWidgetVisibility = toggleDashboardWidgetVisibility;
    window.removeCustomDashboardWidget = removeCustomDashboardWidget;
}
