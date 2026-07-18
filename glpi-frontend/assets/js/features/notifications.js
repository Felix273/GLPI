// Notifications & Alerts
function loadStoredNotifications() {
    const stored = localStorage.getItem('glpi_notifications');
    if (stored) state.notifications = JSON.parse(stored);
    updateNotificationBadge();
}

function saveNotifications() {
    localStorage.setItem('glpi_notifications', JSON.stringify(state.notifications));
    updateNotificationBadge();
}

function addNotification(title, message, type = 'info') {
    const notification = { id: Date.now(), title, message, type, time: new Date().toISOString(), read: false };
    state.notifications.unshift(notification);
    if (state.notifications.length > 50) state.notifications = state.notifications.slice(0, 50);
    saveNotifications();
    addAlert(title, message, type);
}

function updateNotificationBadge() {
    const unread = state.notifications.filter(n => !n.read).length;
    const notificationCount = document.getElementById('notificationCount');
    if (notificationCount) {
        notificationCount.textContent = unread;
        notificationCount.classList.toggle('hidden', unread === 0);
    }
    const alertBadge = document.getElementById('alertBadge');
    if (alertBadge) {
        alertBadge.textContent = state.alerts.length;
        alertBadge.style.display = state.alerts.length > 0 ? 'block' : 'none';
    }
}

function toggleNotifications() {
    const panel = document.getElementById('notificationsPanel');
    panel.classList.toggle('show');
    if (panel.classList.contains('show')) renderNotifications();
}

function renderNotifications() {
    const list = document.getElementById('notificationsList');
    if (!state.notifications.length) {
        list.innerHTML = '<div class="notification-empty">No notifications</div>';
        return;
    }
    list.innerHTML = state.notifications.map(n => `
        <div class="notification-item ${n.read ? '' : 'unread'}" onclick="markAsRead(${n.id})">
            <div class="notif-icon ${n.type}"><i class="fas fa-${n.type === 'danger' ? 'times-circle' : n.type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i></div>
            <div class="notif-content">
                <div class="notif-title">${n.title}</div>
                <div class="notif-time">${formatDate(n.time)}</div>
            </div>
        </div>
    `).join('');
}

function markAsRead(id) {
    const notif = state.notifications.find(n => n.id === id);
    if (notif) notif.read = true;
    saveNotifications();
    renderNotifications();
}

function clearAllNotifications() {
    state.notifications = [];
    saveNotifications();
    renderNotifications();
}
window.markAsRead = markAsRead;
window.clearAllNotifications = clearAllNotifications;
window.toggleNotifications = toggleNotifications;
window.toggleMobileMenu = function() {
    var sidebar = document.querySelector(".sidebar");
    var overlay = document.querySelector(".sidebar-overlay");
    if (sidebar) sidebar.classList.toggle("mobile-open");
    if (overlay) overlay.classList.toggle("show");
}


function loadAlerts() {
    const list = document.getElementById('alertsList');
    if (!state.alerts.length) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><h3>All Clear!</h3><p>No alerts at this time.</p></div>';
        return;
    }
    list.innerHTML = state.alerts.map(a => `
        <div class="alert-item ${a.type}">
            <div class="alert-icon"><i class="fas fa-${a.type === 'danger' ? 'times-circle' : a.type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i></div>
            <div class="alert-content">
                <div class="alert-title">${a.title}</div>
                <div class="alert-desc">${a.desc}</div>
            </div>
            <div class="alert-time">${formatDate(a.time)}</div>
        </div>
    `).join('');
}


function addAlert(title, desc, type) {
    state.alerts.push({ type, title, desc, time: new Date().toISOString() });
}
