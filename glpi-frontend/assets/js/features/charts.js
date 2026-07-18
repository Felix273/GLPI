// Charts
function initCharts() {
    if (typeof Chart === 'undefined') return;

    const theme = document.body.getAttribute('data-theme') || 'light';
    const textColor = theme === 'dark' ? '#9fb0c5' : '#64748b';
    const gridColor = theme === 'dark' ? 'rgba(49, 67, 95, .55)' : 'rgba(226, 232, 240, .85)';
    if (state.charts.type) state.charts.type.destroy();
    if (state.charts.status) state.charts.status.destroy();

    Chart.defaults.font.family = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    Chart.defaults.font.size = 10;

    const typeCtx = document.getElementById('assetTypeChart')?.getContext('2d');
    if (typeCtx) {
        state.charts.type = new Chart(typeCtx, {
            type: 'doughnut',
            data: {
                labels: DASHBOARD_STATS.map(s => s.label),
                datasets: [{
                    data: DASHBOARD_STATS.map(s => state.dashboardTypeCounts[s.api] || 0),
                    backgroundColor: DASHBOARD_STATS.map(s => DASHBOARD_UI[s.view]?.color || CHART_COLORS.primary),
                    borderColor: theme === 'dark' ? '#101b2d' : '#ffffff',
                    borderWidth: 3,
                    hoverOffset: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: textColor, usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, padding: 13 }
                    },
                    tooltip: { padding: 10, cornerRadius: 8 }
                }
            }
        });
    }

    const statusCtx = document.getElementById('assetStatusChart')?.getContext('2d');
    if (statusCtx) {
        state.charts.status = new Chart(statusCtx, {
            type: 'bar',
            data: {
                labels: ['Available', 'Assigned', 'Maintenance', 'Other'],
                datasets: [{
                    label: 'Assets',
                    data: state.dashboardStatusCounts,
                    backgroundColor: [CHART_COLORS.success, CHART_COLORS.primary, CHART_COLORS.warning, CHART_COLORS.slate],
                    borderRadius: 7,
                    borderSkipped: false,
                    maxBarThickness: 34
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, ticks: { color: textColor, precision: 0 }, grid: { color: gridColor }, border: { display: false } },
                    x: { ticks: { color: textColor }, grid: { display: false }, border: { display: false } }
                },
                plugins: { legend: { display: false }, tooltip: { padding: 10, cornerRadius: 8 } }
            }
        });
    }
}
