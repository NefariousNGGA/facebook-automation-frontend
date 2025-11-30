class NexusAutomation {
    constructor() {
        this.backendUrl = 'YOUR_RAILWAY_URL_HERE'; // We'll update this after backend deploy
        this.isRunning = false;
        this.currentSession = null;
        this.stats = {
            shares: 0,
            success: 0,
            failed: 0
        };
        
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupEventListeners();
        this.updateStats();
        this.log('System initialized', 'success');
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const tabContents = document.querySelectorAll('.tab-content');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Remove active class from all
                navItems.forEach(nav => nav.classList.remove('active'));
                tabContents.forEach(tab => tab.classList.remove('active'));
                
                // Add active class to clicked
                item.classList.add('active');
                const tabId = `${item.dataset.tab}-tab`;
                document.getElementById(tabId).classList.add('active');
                
                this.log(`Switched to ${item.dataset.tab}`, 'info');
            });
        });
    }

    setupEventListeners() {
        // Quick Actions
        document.getElementById('quickValidate').addEventListener('click', () => {
            this.validateSession();
        });

        document.getElementById('quickShare').addEventListener('click', () => {
            // Switch to automation tab
            document.querySelector('[data-tab="automation"]').click();
        });

        // Automation Controls
        document.getElementById('startAutomation').addEventListener('click', () => {
            this.startAutomation();
        });

        document.getElementById('stopAutomation').addEventListener('click', () => {
            this.stopAutomation();
        });

        document.getElementById('saveConfig').addEventListener('click', () => {
            this.saveConfiguration();
        });
    }

    async validateSession() {
        const appstateInput = document.getElementById('appstateInput');
        const appstate = appstateInput.value.trim();

        if (!appstate) {
            this.showNotification('Please enter AppState JSON', 'error');
            return;
        }

        try {
            this.log('Validating session...', 'info');
            this.updateStatus('validating');

            const response = await fetch(`${this.backendUrl}/api/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    appstate: JSON.parse(appstate)
                })
            });

            const data = await response.json();

            if (data.success) {
                this.currentSession = data;
                this.log(`Session validated - ${data.user}`, 'success');
                this.showNotification('Session validated successfully!', 'success');
                this.updateStatus('ready');
            } else {
                throw new Error(data.error || 'Validation failed');
            }

        } catch (error) {
            this.log(`Validation failed: ${error.message}`, 'error');
            this.showNotification('Session validation failed', 'error');
            this.updateStatus('error');
        }
    }

    async startAutomation() {
        if (this.isRunning) {
            this.showNotification('Automation is already running', 'warning');
            return;
        }

        const appstate = document.getElementById('appstateInput').value.trim();
        const message = document.getElementById('messageInput').value.trim();
        const url = document.getElementById('urlInput').value.trim();
        const count = parseInt(document.getElementById('countInput').value) || 5;
        const delay = parseInt(document.getElementById('delayInput').value) || 15;

        // Validation
        if (!appstate) {
            this.showNotification('Please enter AppState JSON', 'error');
            return;
        }

        if (!message) {
            this.showNotification('Please enter a message', 'error');
            return;
        }

        try {
            this.isRunning = true;
            this.updateAutomationUI(true);
            this.log('Starting automation...', 'info');
            this.resetStats();

            const response = await fetch(`${this.backendUrl}/api/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    appstate: JSON.parse(appstate),
                    message: message,
                    link: url,
                    count: count,
                    delay: delay
                })
            });

            const data = await response.json();

            if (data.success) {
                this.processResults(data.results);
                this.log(`Automation completed: ${data.summary.successful}/${data.summary.total} successful`, 'success');
                this.showNotification(`Completed: ${data.summary.successful} successful, ${data.summary.failed} failed`, 'success');
            } else {
                throw new Error(data.error || 'Automation failed');
            }

        } catch (error) {
            this.log(`Automation failed: ${error.message}`, 'error');
            this.showNotification('Automation failed to start', 'error');
        } finally {
            this.isRunning = false;
            this.updateAutomationUI(false);
        }
    }

    stopAutomation() {
        if (this.isRunning) {
            this.isRunning = false;
            this.log('Automation stopped by user', 'warning');
            this.showNotification('Automation stopped', 'warning');
            this.updateAutomationUI(false);
        }
    }

    processResults(results) {
        results.forEach((result, index) => {
            setTimeout(() => {
                if (result.success) {
                    this.stats.success++;
                    this.log(`Share ${result.attempt}: ✅ Success`, 'success');
                } else {
                    this.stats.failed++;
                    this.log(`Share ${result.attempt}: ❌ Failed - ${result.error}`, 'error');
                }
                
                this.stats.shares++;
                this.updateStats();
                this.updateProgress((index + 1) / results.length * 100);
            }, index * 100);
        });
    }

    updateStats() {
        // Update dashboard stats
        document.querySelectorAll('.stat-value')[0].textContent = this.currentSession ? '1' : '0';
        document.querySelectorAll('.stat-value')[1].textContent = this.stats.shares;
        document.querySelectorAll('.stat-value')[2].textContent = this.stats.shares > 0 
            ? Math.round((this.stats.success / this.stats.shares) * 100) + '%' 
            : '0%';
        document.querySelectorAll('.stat-value')[3].textContent = '~15s';

        // Update monitor stats
        document.getElementById('currentShares').textContent = this.stats.shares;
        document.getElementById('successfulShares').textContent = this.stats.success;
        document.getElementById('failedShares').textContent = this.stats.failed;
    }

    updateProgress(percentage) {
        const progressFill = document.getElementById('progressFill');
        progressFill.style.width = `${percentage}%`;
    }

    updateStatus(status) {
        const statusIndicator = document.getElementById('automationStatus');
        const statusDot = statusIndicator.querySelector('.status-dot');
        
        statusIndicator.className = 'status-indicator';
        statusDot.style.background = '';
        
        switch(status) {
            case 'validating':
                statusIndicator.classList.add('validating');
                statusDot.style.background = 'var(--accent-warning)';
                statusIndicator.innerHTML = '<div class="status-dot"></div>Validating...';
                break;
            case 'ready':
                statusIndicator.classList.add('active');
                statusDot.style.background = 'var(--accent-secondary)';
                statusIndicator.innerHTML = '<div class="status-dot"></div>Ready';
                break;
            case 'running':
                statusIndicator.classList.add('active');
                statusDot.style.background = 'var(--accent-primary)';
                statusIndicator.innerHTML = '<div class="status-dot"></div>Running';
                break;
            case 'error':
                statusDot.style.background = 'var(--accent-danger)';
                statusIndicator.innerHTML = '<div class="status-dot"></div>Error';
                break;
            default:
                statusDot.style.background = 'var(--text-muted)';
                statusIndicator.innerHTML = '<div class="status-dot"></div>Idle';
        }
    }

    updateAutomationUI(running) {
        const startBtn = document.getElementById('startAutomation');
        const stopBtn = document.getElementById('stopAutomation');
        
        startBtn.disabled = running;
        stopBtn.disabled = !running;
        
        if (running) {
            this.updateStatus('running');
            startBtn.style.opacity = '0.6';
            stopBtn.style.opacity = '1';
        } else {
            this.updateStatus('ready');
            startBtn.style.opacity = '1';
            stopBtn.style.opacity = '0.6';
        }
    }

    resetStats() {
        this.stats = { shares: 0, success: 0, failed: 0 };
        this.updateStats();
        this.updateProgress(0);
    }

    saveConfiguration() {
        const config = {
            message: document.getElementById('messageInput').value,
            url: document.getElementById('urlInput').value,
            count: document.getElementById('countInput').value,
            delay: document.getElementById('delayInput').value
        };
        
        localStorage.setItem('nexus-config', JSON.stringify(config));
        this.showNotification('Configuration saved', 'success');
        this.log('Configuration saved to local storage', 'info');
    }

    loadConfiguration() {
        const saved = localStorage.getItem('nexus-config');
        if (saved) {
            const config = JSON.parse(saved);
            document.getElementById('messageInput').value = config.message || '';
            document.getElementById('urlInput').value = config.url || '';
            document.getElementById('countInput').value = config.count || 5;
            document.getElementById('delayInput').value = config.delay || 15;
        }
    }

    log(message, type = 'info') {
        const logs = document.querySelector('.activity-list');
        const timestamp = new Date().toLocaleTimeString();
        
        const icons = {
            info: 'ℹ️',
            success: '✅',
            error: '❌',
            warning: '⚠️'
        };

        const logEntry = document.createElement('div');
        logEntry.className = 'activity-item';
        logEntry.innerHTML = `
            <div class="activity-icon">${icons[type] || icons.info}</div>
            <div class="activity-info">
                <div class="activity-text">${message}</div>
                <div class="activity-time">${timestamp}</div>
            </div>
        `;

        logs.insertBefore(logEntry, logs.firstChild);
        
        // Keep only last 10 entries
        while (logs.children.length > 10) {
            logs.removeChild(logs.lastChild);
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            background: var(--bg-card);
            border: 1px solid var(--border-primary);
            border-left: 4px solid var(--accent-${type});
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            z-index: 1000;
            transform: translateX(120%);
            transition: transform 0.3s ease;
            max-width: 300px;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after delay
        setTimeout(() => {
            notification.style.transform = 'translateX(120%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.nexusApp = new NexusAutomation();
    
    // Load saved configuration
    window.nexusApp.loadConfiguration();
    
    // Add some demo logs
    setTimeout(() => {
        window.nexusApp.log('Welcome to Nexus Automation', 'info');
        window.nexusApp.log('Ready to start Facebook automation', 'success');
    }, 1000);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        window.nexusApp.saveConfiguration();
    }
    
    if (e.key === 'Escape' && window.nexusApp.isRunning) {
        window.nexusApp.stopAutomation();
    }
});
