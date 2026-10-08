// Notifications & Alerts

function buildAssetTarget(apiType, id) {
    if (!apiType || id === null || id === undefined) return null;
    return { type: 'asset', apiType: String(apiType), id: Number(id), view: null };
}

function buildAlertTarget(target = null) {
    if (!target) return null;
    if (typeof target === 'string') {
        return { type: 'view', view: target, apiType: null, id: null };
    }

    if (typeof target === 'object') {
        if (target.type === 'asset' || target.apiType) {
            return {
                type: 'asset',
                apiType: target.apiType ? String(target.apiType) : null,
                id: target.id !== undefined && target.id !== null ? Number(target.id) : null,
                view: null,
            };
        }

        if (target.type === 'view' || target.view) {
            return {
                type: 'view',
                view: target.view || target.route || 'alerts',
                apiType: null,
                id: null,
            };
        }
    }

    return null;
}

function resolveAlertTarget(target = null) {
    const normalized = buildAlertTarget(target);
    if (!normalized) {
        return { type: 'view', view: 'alerts', apiType: null, id: null };
    }

    if (normalized.type === 'asset' && normalized.apiType && normalized.id !== null) {
        return {
            type: 'asset',
            apiType: normalized.apiType,
            id: Number(normalized.id),
            view: null,
        };
    }

    return {
        type: 'view',
        view: normalized.view || 'alerts',
        apiType: null,
        id: null,
    };
}

function openAlertTarget(target = null) {
    const resolved = resolveAlertTarget(target);

    if (resolved.type === 'asset') {
        if (typeof window !== 'undefined' && typeof window.viewAsset === 'function') {
            window.viewAsset(resolved.apiType, resolved.id);
            return true;
        }

        if (typeof viewAsset === 'function') {
            viewAsset(resolved.apiType, resolved.id);
            return true;
        }
    }

    if (resolved.type === 'view') {
        if (typeof window !== 'undefined' && typeof window.navigateTo === 'function') {
            window.navigateTo(resolved.view);
            return true;
        }

        if (typeof navigateTo === 'function') {
            navigateTo(resolved.view);
            return true;
        }
    }

    return false;
}

function handleAlertClick(key) {
    const alert = state.alerts.find(item => String(item.key || item.time) === String(key));
    if (alert) {
        if (alert.target) {
            openAlertTarget(alert.target);
        } else {
            navigateTo('alerts');
        }
    } else {
        navigateTo('alerts');
    }
}

function handleNotificationClick(id) {
    const notification = state.notifications.find(item => Number(item.id) === Number(id));
    if (notification) {
        if (notification.target) {
            openAlertTarget(notification.target);
        }
        markAsRead(notification.id);
    }
}

function loadStoredNotifications() {
    const stored = localStorage.getItem('glpi_notifications');
    if (stored) state.notifications = JSON.parse(stored);
    updateNotificationBadge();
}

function saveNotifications() {
    localStorage.setItem('glpi_notifications', JSON.stringify(state.notifications));
    updateNotificationBadge();
}

function addNotification(title, message, type = 'info', target = null) {
    const notification = {
        id: Date.now(),
        title,
        message,
        type,
        time: new Date().toISOString(),
        read: false,
        target: buildAlertTarget(target),
    };
    state.notifications.unshift(notification);
    if (state.notifications.length > 50) state.notifications = state.notifications.slice(0, 50);
    saveNotifications();
    if (target || typeof window !== 'undefined') {
        showToast(message || title, type, target);
    }
    addAlert(title, message, type, `notification-${notification.id}`, target);
}

function getDismissedAlertKeys() {
    try {
        const stored = localStorage.getItem('glpi_dismissed_alerts');
        return new Set(stored ? JSON.parse(stored) : []);
    } catch {
        return new Set();
    }
}

function persistDismissedAlertKeys(keys) {
    localStorage.setItem('glpi_dismissed_alerts', JSON.stringify([...keys]));
}

function updateNotificationBadge() {
    const unread = state.notifications.filter(n => !n.read).length;
    const alertCount = state.alerts.filter(a => !a.dismissed).length;
    const total = unread + alertCount;
    const notificationCount = document.getElementById('notificationCount');
    if (notificationCount) {
        notificationCount.textContent = total;
        notificationCount.classList.toggle('hidden', total === 0);
    }
}

function toggleNotifications() {
    const panel = document.getElementById('notificationsPanel');
    panel.classList.toggle('show');
    if (panel.classList.contains('show')) renderNotifications();
}

function renderNotifications() {
    const list = document.getElementById('notificationsList');
    if (!list) return;

    const unreadNotifications = state.notifications.filter(n => !n.read);
    const activeAlerts = state.alerts.filter(a => !a.dismissed);

    if (!unreadNotifications.length && !activeAlerts.length) {
        list.innerHTML = '<div class="notification-empty">No notifications or alerts</div>';
        return;
    }

    let html = '';

    if (activeAlerts.length) {
        html += activeAlerts.map(a => `
            <div class="notification-item alert-item ${a.type}" onclick="handleAlertClick('${escapeAttribute(String(a.key || a.time))}')">
                <div class="notif-icon ${a.type}"><i class="fas fa-${a.type === 'danger' ? 'times-circle' : a.type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i></div>
                <div class="notif-content">
                    <div class="notif-title">${escapeHtml(a.title)}</div>
                    <div class="notif-time">${formatDate(a.time)}</div>
                </div>
                <button class="alert-dismiss" onclick="event.stopPropagation(); dismissAlert('${escapeAttribute(a.key || a.time)}')" title="Dismiss"><i class="fas fa-times"></i></button>
            </div>
        `).join('');
    }

    if (unreadNotifications.length) {
        html += unreadNotifications.map(n => `
            <div class="notification-item ${n.read ? '' : 'unread'}" onclick="handleNotificationClick(${n.id})">
                <div class="notif-icon ${n.type}"><i class="fas fa-${n.type === 'danger' ? 'times-circle' : n.type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i></div>
                <div class="notif-content">
                    <div class="notif-title">${escapeHtml(n.title)}</div>
                    <div class="notif-time">${formatDate(n.time)}</div>
                </div>
            </div>
        `).join('');
    }

    list.innerHTML = html;
}

function markAsRead(id) {
    const notif = state.notifications.find(n => n.id === id);
    if (notif) notif.read = true;
    saveNotifications();
    renderNotifications();
    updateNotificationBadge();
}

function dismissAlert(key) {
    const dismissed = getDismissedAlertKeys();
    dismissed.add(String(key));
    persistDismissedAlertKeys(dismissed);
    state.alerts = state.alerts.filter(a => String(a.key || a.time) !== String(key));
    updateNotificationBadge();
    renderNotifications();
    if (state.currentView === 'alerts') loadAlerts();
}

function clearAllNotifications() {
    state.notifications = [];
    saveNotifications();
    renderNotifications();
    updateNotificationBadge();
}

function clearAllAlerts() {
    const dismissed = getDismissedAlertKeys();
    state.alerts.forEach(a => dismissed.add(String(a.key || a.time)));
    persistDismissedAlertKeys(dismissed);
    state.alerts = [];
    updateNotificationBadge();
    renderNotifications();
    if (state.currentView === 'alerts') loadAlerts();
}

function loadAlerts() {
    const list = document.getElementById('alertsList');
    if (!list) return;
    const activeAlerts = state.alerts.filter(a => !a.dismissed);
    if (!activeAlerts.length) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><h3>All Clear!</h3><p>No alerts at this time.</p></div>';
        return;
    }
    list.innerHTML = activeAlerts.map(a => `
        <div class="alert-item ${a.type}" onclick="handleAlertClick('${escapeAttribute(String(a.key || a.time))}')">
            <div class="alert-icon"><i class="fas fa-${a.type === 'danger' ? 'times-circle' : a.type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i></div>
            <div class="alert-content">
                <div class="alert-title">${escapeHtml(a.title)}</div>
                <div class="alert-desc">${escapeHtml(a.desc)}</div>
            </div>
            <div class="alert-time">${formatDate(a.time)}</div>
            <button class="alert-dismiss" onclick="dismissAlert('${escapeAttribute(a.key || a.time)}'); loadAlerts();" title="Dismiss"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
}


function addAlert(title, desc, type, key, target = null) {
    const alertKey = key || `${type}-${title}-${desc}`;
    const dismissed = getDismissedAlertKeys();
    if (dismissed.has(String(alertKey))) return;
    state.alerts.push({
        type,
        title,
        desc,
        time: new Date().toISOString(),
        dismissed: false,
        key: alertKey,
        target: buildAlertTarget(target),
    });
}

if (typeof window !== 'undefined') {
    window.buildAlertTarget = buildAlertTarget;
    window.resolveAlertTarget = resolveAlertTarget;
    window.openAlertTarget = openAlertTarget;
    window.markAsRead = markAsRead;
    window.dismissAlert = dismissAlert;
    window.clearAllNotifications = clearAllNotifications;
    window.clearAllAlerts = clearAllAlerts;
    window.toggleNotifications = toggleNotifications;
    window.handleAlertClick = handleAlertClick;
    window.handleNotificationClick = handleNotificationClick;
    window.toggleMobileMenu = function() {
        var sidebar = document.querySelector(".sidebar");
        var overlay = document.querySelector(".sidebar-overlay");
        if (sidebar) sidebar.classList.toggle("mobile-open");
        if (overlay) overlay.classList.toggle("show");
    }
}
