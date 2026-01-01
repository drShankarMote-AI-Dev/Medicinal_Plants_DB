// Notification System
class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.init();
    }

    init() {
        this.notificationsBtn = document.getElementById('notificationsBtn');
        this.notificationsPanel = document.getElementById('notificationsPanel');
        this.notificationsList = document.getElementById('notificationsList');
        this.notificationCount = document.getElementById('notificationCount');

        // Event Listeners
        this.notificationsBtn.addEventListener('click', () => this.togglePanel());
        document.addEventListener('click', (e) => this.handleClickOutside(e));
        
        // Initialize notifications
        this.fetchNotifications();
        
        // Set up periodic updates
        setInterval(() => this.fetchNotifications(), 30000);
    }

    async fetchNotifications() {
        try {
            const response = await fetch('/api/admin/notifications');
            const data = await response.json();
            this.notifications = data.notifications;
            this.updateNotificationCount();
            this.renderNotifications();
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }

    togglePanel() {
        this.notificationsPanel.classList.toggle('active');
    }

    handleClickOutside(event) {
        if (!this.notificationsBtn.contains(event.target) && 
            !this.notificationsPanel.contains(event.target)) {
            this.notificationsPanel.classList.remove('active');
        }
    }

    updateNotificationCount() {
        this.unreadCount = this.notifications.filter(n => !n.read).length;
        this.notificationCount.textContent = this.unreadCount;
        this.notificationCount.style.display = this.unreadCount > 0 ? 'inline' : 'none';
    }

    renderNotifications() {
        this.notificationsList.innerHTML = '';
        
        if (this.notifications.length === 0) {
            this.notificationsList.innerHTML = `
                <div class="notification-item">
                    <div class="notification-message">No notifications</div>
                </div>
            `;
            return;
        }

        this.notifications.forEach(notification => {
            const notificationEl = document.createElement('div');
            notificationEl.className = `notification-item${notification.read ? '' : ' unread'}`;
            notificationEl.innerHTML = `
                <div class="notification-title">${notification.title}</div>
                <div class="notification-message">${notification.message}</div>
                <span class="notification-time">${this.formatTime(notification.timestamp)}</span>
            `;
            notificationEl.addEventListener('click', () => this.markAsRead(notification.id));
            this.notificationsList.appendChild(notificationEl);
        });
    }

    async markAsRead(notificationId) {
        try {
            await fetch(`/api/admin/notifications/${notificationId}/read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            await this.fetchNotifications();
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = (now - date) / 1000; // difference in seconds

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return date.toLocaleDateString();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Notification System
    const notificationSystem = new NotificationSystem();
    
    // Dashboard Elements
    const totalPlantsElem = document.getElementById('totalPlants');
    const totalUsersElem = document.getElementById('totalUsers');
    const activeUsersElem = document.getElementById('activeUsers');
    const systemHealthElem = document.getElementById('systemHealth');
    const recentSearchesElem = document.getElementById('recentSearches');
    const plantsGrowthElem = document.getElementById('plantsGrowth');
    const usersGrowthElem = document.getElementById('usersGrowth');
    
    // Quick Action Buttons
    const addPlantBtn = document.getElementById('addPlantBtn');
    const addUserBtn = document.getElementById('addUserBtn');
    const generateReportBtn = document.getElementById('generateReportBtn');
    const backupBtn = document.getElementById('backupBtn');

    // Navigation Elements
    const sidebar = document.getElementById('sidebar');
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const menuOverlay = document.getElementById('menu-overlay');
    const themeSwitch = document.getElementById('themeSwitch');
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');

    // --- Sidebar Toggle ---
    if (mobileMenuToggle && sidebar && menuOverlay) {
        mobileMenuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('open');
            menuOverlay.classList.toggle('active');
        });

        menuOverlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            menuOverlay.classList.remove('active');
        });

        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== mobileMenuToggle) {
                sidebar.classList.remove('open');
                menuOverlay.classList.remove('active');
            }
        });
    }

    // --- Theme Management ---
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            if (themeSwitch) themeSwitch.checked = true;
        } else {
            document.body.classList.remove('dark-mode');
            if (themeSwitch) themeSwitch.checked = false;
        }
    };

    const toggleTheme = () => {
        const currentTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
        localStorage.setItem('theme', currentTheme);
        applyTheme(currentTheme);
    };

    if (themeSwitch) {
        themeSwitch.addEventListener('change', toggleTheme);
    }

    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme);


    // --- Section Navigation ---
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute('data-section');

            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Show corresponding content section
            contentSections.forEach(section => {
                if (section.id === sectionId) {
                    section.classList.add('active');
                } else {
                    section.classList.remove('active');
                }
            });

            // Close sidebar on mobile after selection
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
                menuOverlay.classList.remove('active');
            }
        });
    });

    // Activate the first section by default
    if (navItems.length > 0 && contentSections.length > 0) {
        navItems[0].classList.add('active');
        const firstSectionId = navItems[0].getAttribute('data-section');
        const firstSection = document.getElementById(firstSectionId);
        if (firstSection) {
            firstSection.classList.add('active');
        }
    }

    // Dashboard Data Updates
    async function fetchDashboardData() {
        try {
            const response = await fetch('/api/admin/dashboard-stats');
            const data = await response.json();
            
            // Update stat cards with real data
            if (totalPlantsElem) totalPlantsElem.textContent = data.totalPlants;
            if (totalUsersElem) totalUsersElem.textContent = data.totalUsers;
            if (activeUsersElem) activeUsersElem.textContent = data.activeUsers;
            if (systemHealthElem) systemHealthElem.textContent = data.systemHealth + '%';
            if (recentSearchesElem) recentSearchesElem.textContent = data.recentSearches;
            
            // Update growth trends
            if (plantsGrowthElem) {
                plantsGrowthElem.textContent = `${data.plantsGrowth > 0 ? '+' : ''}${data.plantsGrowth}% this month`;
                plantsGrowthElem.classList.toggle('negative', data.plantsGrowth < 0);
            }
            if (usersGrowthElem) {
                usersGrowthElem.textContent = `${data.usersGrowth > 0 ? '+' : ''}${data.usersGrowth}% this month`;
                usersGrowthElem.classList.toggle('negative', data.usersGrowth < 0);
            }

            // Update platform usage chart
            const platformUsageElem = document.querySelector('.usage-bar');
            if (platformUsageElem) {
                const desktopBar = platformUsageElem.querySelector('.desktop');
                const mobileBar = platformUsageElem.querySelector('.mobile');
                if (desktopBar && mobileBar) {
                    desktopBar.style.width = `${data.platformUsage.desktop}%`;
                    mobileBar.style.width = `${data.platformUsage.mobile}%`;
                    desktopBar.textContent = `Desktop: ${data.platformUsage.desktop}%`;
                    mobileBar.textContent = `Mobile: ${data.platformUsage.mobile}%`;
                }
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        }
    }

    // Quick Actions Event Listeners
    if (addPlantBtn) {
        addPlantBtn.addEventListener('click', () => {
            const plantModal = document.getElementById('plantModal');
            if (plantModal) {
                plantModal.classList.add('active');
            }
        });
    }

    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            const userModal = document.getElementById('userModal');
            if (userModal) {
                userModal.classList.add('active');
            }
        });
    }

    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/admin/generate-report', {
                    method: 'POST'
                });
                if (response.ok) {
                    alert('Report generated successfully!');
                }
            } catch (error) {
                console.error('Error generating report:', error);
                alert('Failed to generate report');
            }
        });
    }

    if (backupBtn) {
        backupBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/admin/backup', {
                    method: 'POST'
                });
                if (response.ok) {
                    alert('Backup created successfully!');
                }
            } catch (error) {
                console.error('Error creating backup:', error);
                alert('Failed to create backup');
            }
        });
    }

    // Initial data fetch
    fetchDashboardData();

    // Set up periodic updates (every 30 seconds)
    setInterval(fetchDashboardData, 30000);

    // Export functionality
    const exportPlantsCSV = document.getElementById('exportPlantsCSV');
    const exportPlantsJSON = document.getElementById('exportPlantsJSON');
    const exportUsersCSV = document.getElementById('exportUsersCSV');
    const exportUsersJSON = document.getElementById('exportUsersJSON');
    const exportLogsCSV = document.getElementById('exportLogsCSV');
    const exportLogsJSON = document.getElementById('exportLogsJSON');

    async function downloadFile(url, filename) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading file:', error);
            alert('Error downloading file. Please try again.');
        }
    }

    if (exportPlantsCSV) {
        exportPlantsCSV.addEventListener('click', () => {
            downloadFile('/api/admin/export/plants?format=csv', 'medicinal_plants.csv');
        });
    }

    if (exportPlantsJSON) {
        exportPlantsJSON.addEventListener('click', () => {
            downloadFile('/api/admin/export/plants?format=json', 'medicinal_plants.json');
        });
    }

    if (exportUsersCSV) {
        exportUsersCSV.addEventListener('click', () => {
            downloadFile('/api/admin/export/users?format=csv', 'users.csv');
        });
    }

    if (exportUsersJSON) {
        exportUsersJSON.addEventListener('click', () => {
            downloadFile('/api/admin/export/users?format=json', 'users.json');
        });
    }

    if (exportLogsCSV) {
        exportLogsCSV.addEventListener('click', () => {
            downloadFile('/api/admin/export/logs?format=csv', 'system_logs.csv');
        });
    }

    if (exportLogsJSON) {
        exportLogsJSON.addEventListener('click', () => {
            downloadFile('/api/admin/export/logs?format=json', 'system_logs.json');
        });
    }

    // Plant moderation functionality
    const plantsTableBody = document.getElementById('plantsTableBody');
    
    async function loadPlants() {
        try {
            const response = await fetch('/api/plants');
            const plants = await response.json();
            
            plantsTableBody.innerHTML = '';
            plants.forEach(plant => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${plant.common_name}</td>
                    <td>${plant.scientific_name}</td>
                    <td>${plant.date_added || 'N/A'}</td>
                    <td>
                        <span class="status-badge ${plant.moderated ? 'approved' : 'pending'}">
                            ${plant.moderated ? '✓ Approved' : '⏳ Pending'}
                        </span>
                    </td>
                    <td class="actions-cell">
                        ${plant.moderated ? `
                            <button class="action-btn small" onclick="moderatePlant('${plant.id}', false)">
                                ❌ Revoke
                            </button>
                        ` : `
                            <button class="action-btn small success" onclick="moderatePlant('${plant.id}', true)">
                                ✓ Approve
                            </button>
                        `}
                        <button class="action-btn small" onclick="editPlant('${plant.id}')">
                            ✏️ Edit
                        </button>
                        <button class="action-btn small danger" onclick="deletePlant('${plant.id}')">
                            🗑️ Delete
                        </button>
                    </td>
                `;
                plantsTableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading plants:', error);
        }
    }

    async function moderatePlant(plantId, approve) {
        try {
            const response = await fetch(`/api/admin/plants/${plantId}/moderate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                },
                body: JSON.stringify({ approved: approve })
            });

            if (response.ok) {
                // Reload plants table
                loadPlants();
                // Show success message
                const message = approve ? 'Plant approved successfully' : 'Plant approval revoked';
                alert(message);
            } else {
                throw new Error('Failed to moderate plant');
            }
        } catch (error) {
            console.error('Error moderating plant:', error);
            alert('Failed to moderate plant. Please try again.');
        }
    }

    // Initial plants load
    loadPlants();

    // System Health Monitoring
    class SystemMonitor {
        constructor() {
            this.errorRate = document.getElementById('errorRate');
            this.errorTrend = document.getElementById('errorTrend');
            this.responseTime = document.getElementById('responseTime');
            this.responseTrend = document.getElementById('responseTrend');
            this.dbSize = document.getElementById('dbSize');
            this.dbTrend = document.getElementById('dbTrend');
            this.errorList = document.getElementById('errorList');
            
            // System action buttons
            this.clearErrorLogsBtn = document.getElementById('clearErrorLogsBtn');
            this.optimizeDbBtn = document.getElementById('optimizeDbBtn');
            this.testSystemBtn = document.getElementById('testSystemBtn');

            this.initializeEventListeners();
            this.startMonitoring();
        }

        initializeEventListeners() {
            if (this.clearErrorLogsBtn) {
                this.clearErrorLogsBtn.addEventListener('click', () => this.clearErrorLogs());
            }
            if (this.optimizeDbBtn) {
                this.optimizeDbBtn.addEventListener('click', () => this.optimizeDatabase());
            }
            if (this.testSystemBtn) {
                this.testSystemBtn.addEventListener('click', () => this.runSystemTest());
            }
        }

        async startMonitoring() {
            await this.updateMetrics();
            await this.loadErrorLogs();
            
            // Update metrics every minute
            setInterval(() => this.updateMetrics(), 60000);
            // Update error logs every 30 seconds
            setInterval(() => this.loadErrorLogs(), 30000);
        }

        async updateMetrics() {
            try {
                const response = await fetch('/api/admin/system-health');
                const data = await response.json();

                // Update Error Rate
                if (this.errorRate) {
                    this.errorRate.textContent = data.error_rate + '%';
                    this.updateTrend(this.errorTrend, data.error_rate_change);
                }

                // Update Response Time
                if (this.responseTime) {
                    this.responseTime.textContent = data.response_time + 'ms';
                    this.updateTrend(this.responseTrend, data.response_time_change);
                }

                // Update Database Size
                if (this.dbSize) {
                    this.dbSize.textContent = this.formatSize(data.db_size);
                    this.updateTrend(this.dbTrend, data.db_size_change);
                }
            } catch (error) {
                console.error('Error updating system metrics:', error);
            }
        }

        async loadErrorLogs() {
            try {
                const response = await fetch('/api/admin/error-logs');
                const data = await response.json();

                if (this.errorList) {
                    this.errorList.innerHTML = '';
                    
                    if (data.errors.length === 0) {
                        this.errorList.innerHTML = `
                            <div class="error-item">
                                <div class="error-info">
                                    <div class="error-message">No errors found</div>
                                </div>
                            </div>
                        `;
                        return;
                    }

                    data.errors.forEach(error => {
                        const errorItem = document.createElement('div');
                        errorItem.className = 'error-item';
                        errorItem.innerHTML = `
                            <div class="error-info">
                                <div class="error-time">${this.formatDate(error.timestamp)}</div>
                                <div class="error-message">${error.message}</div>
                                <div class="error-details">${error.details || ''}</div>
                            </div>
                            <button class="action-btn small" onclick="systemMonitor.acknowledgeError('${error.id}')">
                                ✓ Acknowledge
                            </button>
                        `;
                        this.errorList.appendChild(errorItem);
                    });
                }
            } catch (error) {
                console.error('Error loading error logs:', error);
            }
        }

        async clearErrorLogs() {
            if (!confirm('Are you sure you want to clear all error logs?')) return;

            try {
                const response = await fetch('/api/admin/error-logs/clear', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                    }
                });

                if (response.ok) {
                    await this.loadErrorLogs();
                    alert('Error logs cleared successfully');
                } else {
                    throw new Error('Failed to clear error logs');
                }
            } catch (error) {
                console.error('Error clearing logs:', error);
                alert('Failed to clear error logs');
            }
        }

        async optimizeDatabase() {
            try {
                const response = await fetch('/api/admin/optimize-db', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                    }
                });

                if (response.ok) {
                    alert('Database optimization completed successfully');
                    await this.updateMetrics();
                } else {
                    throw new Error('Failed to optimize database');
                }
            } catch (error) {
                console.error('Error optimizing database:', error);
                alert('Failed to optimize database');
            }
        }

        async runSystemTest() {
            try {
                const response = await fetch('/api/admin/system-test', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                    }
                });

                const data = await response.json();
                alert(`System test completed.\n\nResults:\n${data.results.join('\n')}`);
            } catch (error) {
                console.error('Error running system test:', error);
                alert('Failed to run system test');
            }
        }

        async acknowledgeError(errorId) {
            try {
                const response = await fetch(`/api/admin/error-logs/${errorId}/acknowledge`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                    }
                });

                if (response.ok) {
                    await this.loadErrorLogs();
                } else {
                    throw new Error('Failed to acknowledge error');
                }
            } catch (error) {
                console.error('Error acknowledging error:', error);
                alert('Failed to acknowledge error');
            }
        }

        updateTrend(element, change) {
            if (!element) return;
            
            const isPositive = change > 0;
            const isNegative = change < 0;
            const arrow = isPositive ? '↑' : isNegative ? '↓' : '→';
            const trendClass = isPositive ? 'up' : isNegative ? 'down' : '';
            
            element.className = `metric-trend ${trendClass}`;
            element.textContent = `${arrow} ${Math.abs(change)}%`;
        }

        formatSize(bytes) {
            const units = ['B', 'KB', 'MB', 'GB'];
            let size = bytes;
            let unitIndex = 0;
            
            while (size >= 1024 && unitIndex < units.length - 1) {
                size /= 1024;
                unitIndex++;
            }
            
            return `${size.toFixed(1)} ${units[unitIndex]}`;
        }

        formatDate(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleString();
        }
    }

    // Initialize system monitoring
    const systemMonitor = new SystemMonitor();

    // User Analytics System
    class UserAnalytics {
        constructor() {
            this.initializeCharts();
            this.loadAnalytics();
            setInterval(() => this.loadAnalytics(), 60000); // Update every minute
            this.previousUsers = {
                active: [],
                recent: []
            };
        }

        initializeCharts() {
            // User Activity Chart
            const activityCtx = document.getElementById('userActivityChart').getContext('2d');
            this.activityChart = new Chart(activityCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'User Activity',
                        data: [],
                        borderColor: '#2e7d32',
                        tension: 0.3,
                        fill: true,
                        backgroundColor: 'rgba(46, 125, 50, 0.1)'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: '24-Hour Activity'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });

            // Search Terms Chart
            const searchCtx = document.getElementById('searchTermsChart').getContext('2d');
            this.searchChart = new Chart(searchCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Search Frequency',
                        data: [],
                        backgroundColor: '#388e3c'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Popular Searches'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });

            // User Engagement Chart
            const engagementCtx = document.getElementById('userEngagementChart').getContext('2d');
            this.engagementChart = new Chart(engagementCtx, {
                type: 'radar',
                data: {
                    labels: ['Active Users', 'Page Views', 'Searches', 'Plant Views', 'Comments'],
                    datasets: [{
                        label: 'Today',
                        data: [0, 0, 0, 0, 0],
                        borderColor: '#2e7d32',
                        backgroundColor: 'rgba(46, 125, 50, 0.2)'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'User Engagement Metrics'
                        }
                    },
                    scales: {
                        r: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        initializeHeatmap() {
            const heatmapContainer = document.getElementById('activityHeatmap');
            if (!heatmapContainer) return;

            heatmapContainer.innerHTML = '';
            
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const hours = Array.from({length: 24}, (_, i) => i);

            // Create heatmap grid
            days.forEach((day, dayIndex) => {
                hours.forEach((hour, hourIndex) => {
                    const cell = document.createElement('div');
                    cell.className = 'heatmap-cell';
                    cell.dataset.day = dayIndex;
                    cell.dataset.hour = hourIndex;
                    heatmapContainer.appendChild(cell);
                });
            });
        }

        updateHeatmap(data) {
            const cells = document.querySelectorAll('.heatmap-cell');
            if (!cells.length) return;

            // Find max value for color scaling
            const maxValue = Math.max(...data.flat());

            cells.forEach(cell => {
                const dayIndex = parseInt(cell.dataset.day);
                const hourIndex = parseInt(cell.dataset.hour);
                const value = data[dayIndex][hourIndex];
                
                // Calculate color intensity
                const intensity = maxValue > 0 ? value / maxValue : 0;
                cell.style.backgroundColor = `rgba(46, 125, 50, ${intensity})`;

                // Add tooltip
                cell.title = `${value} activities at ${hourIndex}:00`;

                // Add hover effect
                cell.onmouseover = (e) => {
                    const tooltip = document.createElement('div');
                    tooltip.className = 'heatmap-tooltip';
                    tooltip.textContent = cell.title;
                    tooltip.style.left = e.pageX + 10 + 'px';
                    tooltip.style.top = e.pageY + 10 + 'px';
                    document.body.appendChild(tooltip);
                };

                cell.onmousemove = (e) => {
                    const tooltip = document.querySelector('.heatmap-tooltip');
                    if (tooltip) {
                        tooltip.style.left = e.pageX + 10 + 'px';
                        tooltip.style.top = e.pageY + 10 + 'px';
                    }
                };

                cell.onmouseout = () => {
                    const tooltip = document.querySelector('.heatmap-tooltip');
                    if (tooltip) tooltip.remove();
                };
            });
        }

        async loadAnalytics() {
            try {
                const response = await fetch('/api/admin/user-analytics');
                const data = await response.json();

                // Update activity chart
                this.activityChart.data.labels = data.hourly_labels;
                this.activityChart.data.datasets[0].data = data.hourly_activity;
                this.activityChart.update();

                // Update search terms chart
                this.searchChart.data.labels = data.popular_searches.map(s => s.term);
                this.searchChart.data.datasets[0].data = data.popular_searches.map(s => s.count);
                this.searchChart.update();

                // Update engagement chart
                if (data.engagement_metrics) {
                    const metrics = data.engagement_metrics;
                    this.engagementChart.data.datasets[0].data = [
                        metrics.active_sessions,
                        metrics.page_views,
                        data.search_analytics ? data.search_analytics.length : 0,
                        metrics.plant_views || 0,
                        metrics.comments || 0
                    ];
                    this.engagementChart.update();

                    // Update metric cards
                    document.getElementById('activeSessionsValue').textContent = metrics.active_sessions;
                    document.getElementById('avgSessionDurationValue').textContent = `${metrics.avg_session_duration} min`;
                    document.getElementById('pageViewsValue').textContent = metrics.page_views;
                }

                // Initialize and update heatmap
                if (!this.heatmapInitialized) {
                    this.initializeHeatmap();
                    this.heatmapInitialized = true;
                }
                if (data.engagement_metrics && data.engagement_metrics.activity_heatmap) {
                    this.updateHeatmap(data.engagement_metrics.activity_heatmap);
                }

                // Update timeline
                this.updateTimeline(data.recent_activity);

                // Update user lists
                this.updateUserLists(data.active_users, data.recent_users);

                // Update search stats
                this.updateSearchStats(data.search_analytics);

                // Update retention metrics
                this.updateRetentionMetrics(data.retention_metrics);

            } catch (error) {
                console.error('Error loading analytics:', error);
            }
        }

        updateRetentionMetrics(metrics) {
            if (!metrics) return;
            
            const container = document.getElementById('retentionMetrics');
            if (!container) return;

            container.innerHTML = `
                <div class="retention-metric">
                    <div class="value">${metrics.daily || 0}%</div>
                    <div class="label">Daily Retention</div>
                </div>
                <div class="retention-metric">
                    <div class="value">${metrics.weekly || 0}%</div>
                    <div class="label">Weekly Retention</div>
                </div>
                <div class="retention-metric">
                    <div class="value">${metrics.monthly || 0}%</div>
                    <div class="label">Monthly Retention</div>
                </div>
            `;
        }

        updateTimeline(activities) {
            const timeline = document.getElementById('userTimeline');
            if (!timeline) return;

            timeline.innerHTML = activities.map(activity => `
                <div class="timeline-item">
                    <div class="timeline-time">${this.formatTime(activity.timestamp)}</div>
                    <div class="timeline-action">${activity.action}</div>
                    <div class="timeline-details">${activity.details}</div>
                </div>
            `).join('');
        }

        updateUserLists(activeUsers, recentUsers) {
            if (JSON.stringify(activeUsers) === JSON.stringify(this.previousUsers.active) &&
                JSON.stringify(recentUsers) === JSON.stringify(this.previousUsers.recent)) {
                return; // Data is the same, no need to update
            }

            const activeList = document.getElementById('activeUsersList');
            const recentList = document.getElementById('recentUsersList');

            if (activeList) {
                activeList.innerHTML = activeUsers.map(user => this.createUserListItem(user)).join('');
            }

            if (recentList) {
                recentList.innerHTML = recentUsers.map(user => this.createUserListItem(user)).join('');
            }

            this.previousUsers.active = activeUsers;
            this.previousUsers.recent = recentUsers;
        }

        updateSearchStats(searchStats) {
            const statsList = document.getElementById('searchStatsList');
            if (!statsList) return;

            statsList.innerHTML = searchStats.map(stat => `
                <div class="search-term">
                    <span class="search-term-text">${stat.term}</span>
                    <span class="search-term-count">${stat.count} searches</span>
                </div>
            `).join('');
        }

        createUserListItem(user) {
            const avatarUrl = user.avatar ? user.avatar : '/static/images/default_plant.jpg';
            return `
                <div class="user-list-item">
                    <img src="${avatarUrl}" alt="${user.username}" class="user-avatar">
                    <div class="user-info">
                        <div class="user-name">${user.username}</div>
                        <div class="user-activity">${user.activity}</div>
                    </div>
                </div>
            `;
        }

        formatTime(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleString();
        }
    }

    // Initialize user analytics
    const userAnalytics = new UserAnalytics();

    // Initialize Charts
    const visitsChartCtx = document.getElementById('visitsChart').getContext('2d');
    const plantStatsChartCtx = document.getElementById('plantStatsChart').getContext('2d');
    const categoryTrendsChartCtx = document.getElementById('categoryTrendsChart').getContext('2d');
    const medicinalUsesChartCtx = document.getElementById('medicinalUsesChart').getContext('2d');

    // User Visits Chart
    const visitsChart = new Chart(visitsChartCtx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Daily Visits',
                data: [0, 0, 0, 0, 0, 0, 0],
                borderColor: '#2e7d32',
                tension: 0.3,
                fill: true,
                backgroundColor: 'rgba(46, 125, 50, 0.1)'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Weekly User Activity'
                },
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Plant Categories Chart
    const plantStatsChart = new Chart(plantStatsChartCtx, {
        type: 'doughnut',
        data: {
            labels: ['Herbs', 'Trees', 'Shrubs', 'Climbers', 'Others'],
            datasets: [{
                data: [0, 0, 0, 0, 0],
                backgroundColor: [
                    '#2e7d32',
                    '#388e3c',
                    '#66bb6a',
                    '#81c784',
                    '#a5d6a7'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Plant Categories Distribution'
                },
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    // Medicinal Uses Chart
    const medicinalUsesChart = new Chart(medicinalUsesChartCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Number of Plants',
                data: [],
                backgroundColor: '#2e7d32',
                borderColor: '#1b5e20',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Most Common Medicinal Uses'
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Plants'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Medicinal Use'
                    }
                }
            }
        }
    });

    // Category Trends Chart
    const categoryTrendsChart = new Chart(categoryTrendsChartCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Plant Categories Growth Over Time'
                },
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Number of Plants'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Month'
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });

    // Function to update charts with real data
    async function updateCharts() {
        try {
            const response = await fetch('/api/admin/chart-data');
            const data = await response.json();

            // Update visits chart
            visitsChart.data.datasets[0].data = data.weeklyVisits;
            visitsChart.update();

            // Update plant categories chart
            plantStatsChart.data.datasets[0].data = data.plantCategories;
            plantStatsChart.update();

            // Update category trends chart
            if (data.categoryTrends) {
                const colors = {
                    'Herbs': '#2e7d32',
                    'Trees': '#388e3c',
                    'Shrubs': '#66bb6a',
                    'Climbers': '#81c784',
                    'Others': '#a5d6a7'
                };

                categoryTrendsChart.data.labels = data.categoryTrends.labels.map(label => {
                    const [year, month] = label.split('-');
                    return new Date(year, month - 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
                });

                categoryTrendsChart.data.datasets = Object.entries(data.categoryTrends.datasets).map(([category, values]) => ({
                    label: category,
                    data: values,
                    borderColor: colors[category],
                    backgroundColor: colors[category] + '40',
                    fill: true,
                    tension: 0.4
                }));

                categoryTrendsChart.update();
            }

            // Update medicinal uses chart
            if (data.medicinalUses) {
                medicinalUsesChart.data.labels = data.medicinalUses.labels;
                medicinalUsesChart.data.datasets[0].data = data.medicinalUses.values;
                medicinalUsesChart.update();
            }

            // Update region map
            if (data.regionDistribution) {
                updateRegionMap(data.regionDistribution);
            }
        } catch (error) {
            console.error('Error updating charts:', error);
        }
    }

    // Region Map functionality
    function updateRegionMap(regionData) {
        const mapContainer = document.getElementById('regionMap');
        if (!mapContainer) return;

        // Clear previous content
        mapContainer.innerHTML = '';

        // Create SVG element
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 1000 500');
        svg.style.width = '100%';
        svg.style.height = '100%';

        // Define region paths (simplified world map regions)
        const regions = {
            'Asia': {
                path: 'M600 100 L800 100 L800 300 L600 300 Z',
                center: [700, 200]
            },
            'Europe': {
                path: 'M500 50 L600 50 L600 200 L500 200 Z',
                center: [550, 125]
            },
            'Africa': {
                path: 'M500 200 L600 200 L600 400 L500 400 Z',
                center: [550, 300]
            },
            'North America': {
                path: 'M200 50 L400 50 L400 200 L200 200 Z',
                center: [300, 125]
            },
            'South America': {
                path: 'M300 250 L400 250 L400 400 L300 400 Z',
                center: [350, 325]
            },
            'Oceania': {
                path: 'M700 350 L800 350 L800 400 L700 400 Z',
                center: [750, 375]
            }
        };

        // Calculate color scale
        const maxValue = Math.max(...Object.values(regionData));
        const getColor = (value) => {
            const intensity = value / maxValue;
            return `rgba(46, 125, 50, ${0.2 + intensity * 0.8})`;
        };

        // Create and append regions
        Object.entries(regions).forEach(([name, regionInfo]) => {
            const count = regionData[name] || 0;
            const region = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            region.setAttribute('d', regionInfo.path);
            region.setAttribute('fill', getColor(count));
            region.setAttribute('stroke', '#1b5e20');
            region.setAttribute('class', 'region');
            
            // Add hover tooltip
            region.addEventListener('mouseover', (e) => {
                const tooltip = document.createElement('div');
                tooltip.className = 'region-tooltip';
                tooltip.textContent = `${name}: ${count} plants`;
                tooltip.style.left = e.pageX + 10 + 'px';
                tooltip.style.top = e.pageY + 10 + 'px';
                document.body.appendChild(tooltip);
            });

            region.addEventListener('mousemove', (e) => {
                const tooltip = document.querySelector('.region-tooltip');
                if (tooltip) {
                    tooltip.style.left = e.pageX + 10 + 'px';
                    tooltip.style.top = e.pageY + 10 + 'px';
                }
            });

            region.addEventListener('mouseout', () => {
                const tooltip = document.querySelector('.region-tooltip');
                if (tooltip) {
                    tooltip.remove();
                }
            });

            svg.appendChild(region);

            // Add region label
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', regionInfo.center[0]);
            text.setAttribute('y', regionInfo.center[1]);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', '#000');
            text.setAttribute('font-size', '14');
            text.textContent = `${name}\n(${count})`;
            svg.appendChild(text);
        });

        // Add legend
        const legend = document.createElement('div');
        legend.className = 'legend';
        legend.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">Plants per Region</div>
            <div style="display: flex; align-items: center; gap: 5px;">
                <div style="width: 20px; height: 20px; background: rgba(46, 125, 50, 0.2);"></div>
                <span>Few</span>
            </div>
            <div style="display: flex; align-items: center; gap: 5px;">
                <div style="width: 20px; height: 20px; background: rgba(46, 125, 50, 1);"></div>
                <span>Many</span>
            </div>
        `;
        mapContainer.appendChild(legend);

        mapContainer.appendChild(svg);
    }

    // Initial chart update
    updateCharts();

    // Update charts every minute
    setInterval(updateCharts, 60000);

    // Search and Filter Functionality
    const plantsSearch = document.getElementById('plantsSearch');
    const plantsCategoryFilter = document.getElementById('plantsCategoryFilter');
    const usersSearch = document.getElementById('usersSearch');
    const usersRoleFilter = document.getElementById('usersRoleFilter');

    // Function to filter table rows
    function filterTable(tableBody, searchValue, filterValue, searchColumn, filterColumn) {
        const rows = tableBody.getElementsByTagName('tr');
        
        for (const row of rows) {
            const searchText = row.cells[searchColumn].textContent.toLowerCase();
            const filterText = row.cells[filterColumn].textContent.toLowerCase();
            
            const matchesSearch = searchValue === '' || searchText.includes(searchValue.toLowerCase());
            const matchesFilter = filterValue === '' || filterText === filterValue.toLowerCase();
            
            row.style.display = matchesSearch && matchesFilter ? '' : 'none';
        }
    }

    // Plants table search and filter
    if (plantsSearch && plantsCategoryFilter) {
        const plantsTableBody = document.getElementById('plantsTableBody');
        
        plantsSearch.addEventListener('input', () => {
            filterTable(plantsTableBody, plantsSearch.value, plantsCategoryFilter.value, 0, 2);
        });

        plantsCategoryFilter.addEventListener('change', () => {
            filterTable(plantsTableBody, plantsSearch.value, plantsCategoryFilter.value, 0, 2);
        });
    }

    // Users table search and filter
    if (usersSearch && usersRoleFilter) {
        const usersTableBody = document.getElementById('usersTableBody');
        
        usersSearch.addEventListener('input', () => {
            filterTable(usersTableBody, usersSearch.value, usersRoleFilter.value, 0, 2);
        });

        usersRoleFilter.addEventListener('change', () => {
            filterTable(usersTableBody, usersSearch.value, usersRoleFilter.value, 0, 2);
        });
    }
});