class OptionsManager {
    constructor() {
        this.defaultSettings = {
            fileNameTemplate: '{index}_{title}',
            darkMode: false,
            autoGroup: false,
            autoGroupDomains: [],
            groupColors: ['blue', 'red', 'yellow', 'green', 'purple', 'pink'],
            showTabCount: true,
            confirmTabClose: true,
            saveGroupsOnExit: true,
            maxRecentGroups: 10,
            maxGroupSize: 20,
            groupNewTabs: true,
            collapseInactiveTabs: false,
            inactiveTimeout: 30,
            lastBackup: null
        };

        this.settings = Object.assign({}, this.defaultSettings);
        this.initializeElements();
        this.init();
    }

    initializeElements() {
        this.elements = {
            form: document.querySelector('form'),
            fileNameTemplate: document.getElementById('fileNameTemplate'),
            darkMode: document.getElementById('darkMode'),
            autoGroup: document.getElementById('autoGroup'),
            domainInput: document.getElementById('domainInput'),
            domainTags: document.getElementById('domainTags'),
            groupColors: document.getElementById('groupColors'),
            showTabCount: document.getElementById('showTabCount'),
            confirmTabClose: document.getElementById('confirmTabClose'),
            saveGroupsOnExit: document.getElementById('saveGroupsOnExit'),
            maxRecentGroups: document.getElementById('maxRecentGroups'),
            saveSettings: document.getElementById('saveSettings'),
            selectAllGroups: document.getElementById('selectAllGroups'),
            deselectAllGroups: document.getElementById('deselectAllGroups'),
            groupAllTabs: document.getElementById('groupAllTabs'),
            ungroupAllTabs: document.getElementById('ungroupAllTabs'),
            sortGroups: document.getElementById('sortGroups'),
            maxGroupSize: document.getElementById('maxGroupSize'),
            groupNewTabs: document.getElementById('groupNewTabs'),
            collapseInactiveTabs: document.getElementById('collapseInactiveTabs'),
            inactiveTimeout: document.getElementById('inactiveTimeout'),
            customizeShortcuts: document.getElementById('customizeShortcuts'),
            lastBackup: document.getElementById('lastBackup')
        };
    }

    async init() {
        try {
            await this.loadSettings();
            this.setupEventListeners();
            this.applyCurrentSettings();
        } catch (error) {
            this.showMessage('Failed to initialize settings', 'error');
            console.error('Initialization error:', error);
        }
    }

    async loadSettings() {
        try {
            const stored = await chrome.storage.sync.get(this.defaultSettings);
            this.settings = Object.assign({}, this.defaultSettings, stored);
            this.applyCurrentSettings();
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.showMessage('Failed to load settings', 'error');
        }
    }

    setupEventListeners() {
        // Save button
        if (this.elements.saveSettings) {
            this.elements.saveSettings.addEventListener('click', () => this.saveSettings());
        }

        // Dark mode toggle
        if (this.elements.darkMode) {
            this.elements.darkMode.addEventListener('change', (e) => {
                this.settings.darkMode = e.target.checked;
                this.applyTheme();
            });
        }

        // Auto-group toggle
        if (this.elements.autoGroup) {
            this.elements.autoGroup.addEventListener('change', (e) => {
                this.settings.autoGroup = e.target.checked;
                this.updateAutoGroupUI();
            });
        }

        // Domain input
        if (this.elements.domainInput) {
            this.elements.domainInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addDomain();
                }
            });
        }

        // Watch for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!this.settings.darkMode) {
                document.documentElement.classList.toggle('dark', e.matches);
            }
        });

        // Quick Actions
        this.elements.groupAllTabs?.addEventListener('click', () => this.groupAllTabsByDomain());
        this.elements.ungroupAllTabs?.addEventListener('click', () => this.ungroupAllTabs());
        this.elements.sortGroups?.addEventListener('click', () => this.sortGroupsAlphabetically());

        // Quick add domain buttons
        document.querySelectorAll('.quick-add-domain').forEach(button => {
            button.addEventListener('click', (e) => {
                const domain = e.target.dataset.domain;
                if (domain) this.addDomain(domain);
            });
        });

        // Shortcuts customization
        this.elements.customizeShortcuts?.addEventListener('click', () => this.openShortcutsModal());

        // Collapse settings
        this.elements.collapseInactiveTabs?.addEventListener('change', (e) => {
            this.settings.collapseInactiveTabs = e.target.checked;
            if (this.elements.inactiveTimeout) {
                this.elements.inactiveTimeout.disabled = !e.target.checked;
            }
        });
    }

    async groupAllTabsByDomain() {
        try {
            const tabs = await chrome.tabs.query({ currentWindow: true });
            const domains = new Map();

            // Group tabs by domain
            tabs.forEach(tab => {
                try {
                    const domain = new URL(tab.url).hostname;
                    if (!domains.has(domain)) {
                        domains.set(domain, []);
                    }
                    domains.get(domain).push(tab.id);
                } catch (e) {
                    console.error('Invalid URL:', tab.url);
                }
            });

            // Create groups for each domain
            for (const [domain, tabIds] of domains) {
                if (tabIds.length >= 2) {  // Only group if there are at least 2 tabs
                    const groupId = await chrome.tabs.group({ tabIds });
                    await chrome.tabGroups.update(groupId, { 
                        title: domain,
                        color: this.getRandomColor()
                    });
                }
            }

            this.showMessage('Tabs grouped successfully', 'success');
        } catch (error) {
            console.error('Failed to group tabs:', error);
            this.showMessage('Failed to group tabs', 'error');
        }
    }

    async ungroupAllTabs() {
        try {
            const tabs = await chrome.tabs.query({ grouped: true });
            await chrome.tabs.ungroup(tabs.map(tab => tab.id));
            this.showMessage('All tabs ungrouped', 'success');
        } catch (error) {
            console.error('Failed to ungroup tabs:', error);
            this.showMessage('Failed to ungroup tabs', 'error');
        }
    }

    async sortGroupsAlphabetically() {
        try {
            const groups = await chrome.tabGroups.query({});
            const sortedGroups = groups.sort((a, b) => 
                (a.title || '').localeCompare(b.title || ''));

            // Reposition groups
            for (let i = 0; i < sortedGroups.length; i++) {
                await chrome.tabGroups.update(sortedGroups[i].id, { index: i });
            }

            this.showMessage('Groups sorted successfully', 'success');
        } catch (error) {
            console.error('Failed to sort groups:', error);
            this.showMessage('Failed to sort groups', 'error');
        }
    }

    getRandomColor() {
        const colors = this.settings.groupColors;
        return colors[Math.floor(Math.random() * colors.length)];
    }

    openShortcutsModal() {
        const modal = document.getElementById('shortcutsModal');
        if (!modal) return;

        const shortcutsList = document.getElementById('shortcutsList');
        if (shortcutsList) {
            shortcutsList.innerHTML = '';
            chrome.commands.getAll(commands => {
                commands.forEach(command => {
                    const shortcut = document.createElement('div');
                    shortcut.className = 'shortcut-item';
                    shortcut.innerHTML = `
                        <span>${command.description || command.name}</span>
                        <div class="shortcut-keys">
                            <input type="text" value="${command.shortcut || 'No shortcut'}" 
                                   readonly class="shortcut-input">
                        </div>
                    `;
                    shortcutsList.appendChild(shortcut);
                });
            });
        }

        modal.hidden = false;
    }

    applyCurrentSettings() {
        if (!this.elements) return;

        // Update form values
        if (this.elements.fileNameTemplate) {
            this.elements.fileNameTemplate.value = this.settings.fileNameTemplate;
        }
        if (this.elements.darkMode) {
            this.elements.darkMode.checked = this.settings.darkMode;
        }
        if (this.elements.autoGroup) {
            this.elements.autoGroup.checked = this.settings.autoGroup;
        }
        if (this.elements.showTabCount) {
            this.elements.showTabCount.checked = this.settings.showTabCount;
        }
        if (this.elements.confirmTabClose) {
            this.elements.confirmTabClose.checked = this.settings.confirmTabClose;
        }
        if (this.elements.saveGroupsOnExit) {
            this.elements.saveGroupsOnExit.checked = this.settings.saveGroupsOnExit;
        }
        if (this.elements.maxRecentGroups) {
            this.elements.maxRecentGroups.value = this.settings.maxRecentGroups;
        }

        // Apply theme
        this.applyTheme();

        // Update domain tags
        this.renderDomainTags();

        // Update group colors
        this.renderColorPicker();

        // Update auto-group UI
        this.updateAutoGroupUI();
    }

    applyTheme() {
        document.documentElement.classList.toggle('dark', this.settings.darkMode);
    }

    addDomain() {
        if (!this.elements.domainInput) return;

        const input = this.elements.domainInput;
        const domain = input.value.trim().toLowerCase();

        if (!domain) return;

        if (!this.isValidDomain(domain)) {
            this.showMessage('Please enter a valid domain', 'error');
            return;
        }

        if (!this.settings.autoGroupDomains.includes(domain)) {
            this.settings.autoGroupDomains.push(domain);
            this.renderDomainTags();
            input.value = '';
        }
    }

    removeDomain(domain) {
        this.settings.autoGroupDomains = this.settings.autoGroupDomains.filter(d => d !== domain);
        this.renderDomainTags();
    }

    renderDomainTags() {
        if (!this.elements.domainTags) return;

        this.elements.domainTags.innerHTML = '';
        this.settings.autoGroupDomains.forEach(domain => {
            const tag = document.createElement('span');
            tag.className = 'tag';
            
            // Create text node
            const text = document.createTextNode(domain);
            tag.appendChild(text);
            
            // Create remove button
            const removeButton = document.createElement('span');
            removeButton.className = 'tag-remove';
            removeButton.textContent = '×';
            removeButton.dataset.domain = domain;
            removeButton.addEventListener('click', () => this.removeDomain(domain));
            
            tag.appendChild(removeButton);
            this.elements.domainTags.appendChild(tag);
        });
    }

    renderColorPicker() {
        if (!this.elements.groupColors) return;

        this.elements.groupColors.innerHTML = '';
        const availableColors = ['blue', 'red', 'yellow', 'green', 'purple', 'pink', 'cyan', 'gray'];
        
        availableColors.forEach(color => {
            const option = document.createElement('div');
            option.className = 'color-option ' + color + 
                (this.settings.groupColors.includes(color) ? ' selected' : '');
            option.dataset.color = color;
            option.addEventListener('click', () => this.toggleColor(color));
            this.elements.groupColors.appendChild(option);
        });
    }

    toggleColor(color) {
        const index = this.settings.groupColors.indexOf(color);
        if (index === -1) {
            this.settings.groupColors.push(color);
        } else {
            this.settings.groupColors.splice(index, 1);
        }
        this.renderColorPicker();
    }

    updateAutoGroupUI() {
        const autoGroupSettings = document.getElementById('autoGroupSettings');
        if (autoGroupSettings) {
            autoGroupSettings.style.display = this.settings.autoGroup ? 'block' : 'none';
        }
    }

    isValidDomain(domain) {
        const pattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
        return pattern.test(domain);
    }

    async saveSettings() {
        try {
            if (!this.elements) return;

            // Get current form values
            const newSettings = {
                fileNameTemplate: this.elements.fileNameTemplate?.value || this.defaultSettings.fileNameTemplate,
                darkMode: this.elements.darkMode?.checked || false,
                autoGroup: this.elements.autoGroup?.checked || false,
                autoGroupDomains: this.settings.autoGroupDomains,
                groupColors: this.settings.groupColors,
                showTabCount: this.elements.showTabCount?.checked || false,
                confirmTabClose: this.elements.confirmTabClose?.checked || false,
                saveGroupsOnExit: this.elements.saveGroupsOnExit?.checked || false,
                maxRecentGroups: parseInt(this.elements.maxRecentGroups?.value) || 10,
                maxGroupSize: parseInt(this.elements.maxGroupSize?.value) || 20,
                groupNewTabs: this.elements.groupNewTabs?.checked || false,
                collapseInactiveTabs: this.elements.collapseInactiveTabs?.checked || false,
                inactiveTimeout: parseInt(this.elements.inactiveTimeout?.value) || 30,
                lastBackup: new Date().toISOString()
            };

            // Save to storage
            await chrome.storage.sync.set(newSettings);
            this.settings = newSettings;
            this.updateLastBackupTime();
            this.showMessage('Settings saved successfully', 'success');
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showMessage('Failed to save settings', 'error');
        }
    }

    updateLastBackupTime() {
        if (this.elements.lastBackup && this.settings.lastBackup) {
            const date = new Date(this.settings.lastBackup);
            this.elements.lastBackup.textContent = date.toLocaleDateString() + 
                ' ' + date.toLocaleTimeString();
        }
    }

    showMessage(message, type = 'info') {
        const messageElement = document.getElementById('message');
        if (!messageElement) {
            const div = document.createElement('div');
            div.id = 'message';
            document.body.appendChild(div);
        }

        const msg = document.getElementById('message');
        msg.textContent = message;
        msg.className = type;
        msg.classList.add('show');

        setTimeout(() => {
            msg.classList.remove('show');
        }, 3000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.optionsManager = new OptionsManager();
});