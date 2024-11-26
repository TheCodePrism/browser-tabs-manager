import { CONSTANTS } from '../constants.js';
import { storage, showMessage, debounce, safeExecute } from '../js/utils.js';
import { keyboardShortcuts } from '../js/keyboard-shortcuts.js';
import { tabGroupsManager } from '../js/tab-groups.js';
import TabExportImport from '../js/export-import.js';

class TabManager {
    constructor() {
        this.state = {
            currentGroupId: null,
            groups: [],
            tabs: [],
            searchTerm: '',
            settings: {
                darkMode: false,
                fileNameTemplate: '{index}_{title}',
                autoGroup: false,
                autoGroupDomains: []
            },
            selectedTabs: new Set()
        };

        this.elements = {
            searchInput: document.getElementById('searchInput'),
            groupList: document.getElementById('groupList'),
            fileList: document.getElementById('fileList'),
            welcomeMessage: document.getElementById('welcomeMessage'),
            exportModal: document.getElementById('exportModal'),
            keyboardShortcutsModal: document.getElementById('shortcutsModal'),
            closeButtons: document.querySelectorAll('.close-button, .modal .cancel'),
            modalOverlay: document.querySelectorAll('.modal'),
            contextMenu: document.getElementById('contextMenu'),
            createGroup: document.getElementById('createGroup'),
            exportGroups: document.getElementById('exportGroups'),
            importGroups: document.getElementById('importGroups'),
            confirmExport: document.getElementById('confirmExport'),
            groupCheckboxes: document.getElementById('groupCheckboxes'),
            progressContainer: document.getElementById('progressContainer'),
            progressBar: document.getElementById('progressBar')
        };

        // Initialize the export/import functionality
        this.tabExportImport = new TabExportImport();

        // Bind methods after they're defined
        this.bindMethods();
    }

    bindMethods() {
        // Bind all methods that need 'this' context
        this.handleSearch = this.handleSearch.bind(this);
        this.handleTabClick = this.handleTabClick.bind(this);
        this.handleGroupClick = this.handleGroupClick.bind(this);
        this.showContextMenu = this.showContextMenu.bind(this);
        this.hideContextMenu = this.hideContextMenu.bind(this);
        this.handleTabUpdate = this.handleTabUpdate.bind(this);
        this.handleTabRemove = this.handleTabRemove.bind(this);
        this.handleGroupUpdate = this.handleGroupUpdate.bind(this);
        this.createNewGroup = this.createNewGroup.bind(this);
        this.exportSelectedGroups = this.exportSelectedGroups.bind(this);
        this.importGroups = this.importGroups.bind(this);
        this.toggleExportModal = this.toggleExportModal.bind(this);
        this.closeAllModals = this.closeAllModals.bind(this);
        this.handleModalClick = this.handleModalClick.bind(this);
        this.setupModalEventListeners();
    }

    async init() {
        try {
            await this.loadSettings();
            this.setupEventListeners();
            await tabGroupsManager.init();
            keyboardShortcuts.init();
            await this.loadTabGroups();
            this.initTheme();
        } catch (error) {
            console.error('Failed to initialize TabManager:', error);
            showMessage('Failed to initialize Tab Manager', 'error');
        }
    }

    setupEventListeners() {
        // Search
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input',
                debounce(this.handleSearch, CONSTANTS.SEARCH_DEBOUNCE_DELAY)
            );
        }

        // Group Actions
        if (this.elements.createGroup) {
            this.elements.createGroup.addEventListener('click',
                () => safeExecute(this.createNewGroup)
            );
        }

        // Export/Import
        if (this.elements.exportGroups) {
            this.elements.exportGroups.addEventListener('click',
                () => this.toggleExportModal(true)
            );
        }

        if (this.elements.importGroups) {
            this.elements.importGroups.addEventListener('click',
                () => safeExecute(this.importGroups)
            );
        }

        if (this.elements.confirmExport) {
            this.elements.confirmExport.addEventListener('click',
                () => safeExecute(this.exportSelectedGroups)
            );
        }

        // Modal Close
        document.querySelectorAll('.close-button').forEach(button => {
            button.addEventListener('click', this.closeAllModals);
        });

        // Context Menu
        document.addEventListener('click', this.hideContextMenu);
        if (this.elements.fileList) {
            this.elements.fileList.addEventListener('contextmenu', this.showContextMenu);
            this.elements.fileList.addEventListener('click', this.handleTabClick);
        }

        // Chrome Events
        chrome.tabs.onUpdated.addListener(this.handleTabUpdate);
        chrome.tabs.onRemoved.addListener(this.handleTabRemove);
        chrome.tabGroups.onUpdated.addListener(this.handleGroupUpdate);
    }

    // Add these methods to TabManager class
    setupModalEventListeners() {
        // Close button handlers
        this.elements.closeButtons?.forEach(button => {
            button.addEventListener('click', this.closeAllModals);
        });

        // Click outside modal to close
        this.elements.modalOverlay?.forEach(modal => {
            modal.addEventListener('click', this.handleModalClick);
        });

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    handleModalClick(event) {
        // Close if clicking outside the modal content
        if (event.target.classList.contains('modal')) {
            this.closeAllModals();
        }
    }

    async loadSettings() {
        try {
            const settings = await storage.get(Object.keys(this.state.settings));
            this.state.settings = { ...this.state.settings, ...settings };
        } catch (error) {
            console.error('Failed to load settings:', error);
            showMessage('Failed to load settings', 'error');
        }
    }

    // Event handler methods
    handleSearch = async (event) => {
        const searchTerm = event.target.value.toLowerCase();
        this.state.searchTerm = searchTerm;

        if (!searchTerm) {
            await this.loadTabGroups();
            return;
        }

        try {
            const allTabs = await chrome.tabs.query({});
            const filteredTabs = allTabs.filter(tab =>
                tab.title.toLowerCase().includes(searchTerm) ||
                tab.url.toLowerCase().includes(searchTerm)
            );

            const groupIds = new Set(filteredTabs.map(tab => tab.groupId));
            const filteredGroups = this.state.groups.filter(group =>
                groupIds.has(group.id) ||
                (group.title && group.title.toLowerCase().includes(searchTerm))
            );

            this.state.groups = filteredGroups;
            this.renderGroups();
            this.renderTabs(filteredTabs);
        } catch (error) {
            console.error('Search failed:', error);
            showMessage('Search failed', 'error');
        }
    }

    async loadTabGroups() {
        try {
            const groups = await tabGroupsManager.refreshGroups();
            this.state.groups = groups;
            await this.renderGroups();

            // Load ungrouped tabs if no group is selected
            if (!this.state.currentGroupId) {
                const ungroupedTabs = await chrome.tabs.query({ groupId: -1 });
                this.renderTabs(ungroupedTabs);
            }
        } catch (error) {
            console.error('Failed to load tab groups:', error);
            showMessage('Failed to load tab groups', 'error');
        }
    }

    createNewGroup = async () => {
        try {
            const tabs = await chrome.tabs.query({
                highlighted: true,
                currentWindow: true
            });

            if (tabs.length === 0) {
                showMessage('Please select at least one tab', 'error');
                return;
            }

            const groupName = prompt('Enter a name for the new group:');
            if (!groupName) return;

            const tabIds = tabs.map(tab => tab.id);
            const groupId = await tabGroupsManager.createGroup(tabIds, {
                title: groupName
            });

            await this.loadTabGroups();
            this.selectGroup(groupId);

            showMessage('Group created successfully', 'success');
        } catch (error) {
            console.error('Failed to create group:', error);
            showMessage('Failed to create group', 'error');
        }
    }

    async renderGroups() {
        const groupList = this.elements.groupList;
        if (!groupList) return;

        groupList.innerHTML = '';

        // Add ungrouped tabs option
        const ungroupedItem = this.createGroupElement({
            id: -1,
            title: 'Ungrouped Tabs',
            color: 'grey'
        });
        groupList.appendChild(ungroupedItem);

        // Add groups
        this.state.groups.forEach(group => {
            const groupElement = this.createGroupElement(group);
            groupList.appendChild(groupElement);
        });

        this.highlightSelectedGroup();
    }

    createGroupElement(group) {
        const li = document.createElement('li');
        li.className = 'group-item';
        li.dataset.groupId = group.id;

        const colorDot = document.createElement('span');
        colorDot.className = `color-dot ${group.color || 'grey'}`;

        const title = document.createElement('span');
        title.className = 'group-title';
        title.textContent = group.title || 'Unnamed Group';

        const count = document.createElement('span');
        count.className = 'tab-count';
        this.updateTabCount(group.id).then(tabCount => {
            count.textContent = tabCount;
        });

        li.appendChild(colorDot);
        li.appendChild(title);
        li.appendChild(count);

        li.addEventListener('click', () => this.selectGroup(group.id));

        return li;
    }

    async updateTabCount(groupId) {
        try {
            const tabs = await chrome.tabs.query({ groupId });
            return tabs.length;
        } catch (error) {
            console.error('Failed to get tab count:', error);
            return 0;
        }
    }

    async selectGroup(groupId) {
        this.state.currentGroupId = groupId;
        this.highlightSelectedGroup();
        await this.loadTabsForGroup(groupId);
    }

    highlightSelectedGroup() {
        if (!this.elements.groupList) return;

        this.elements.groupList.querySelectorAll('.group-item').forEach(item => {
            item.classList.toggle('selected',
                item.dataset.groupId == this.state.currentGroupId
            );
        });
    }

    async loadTabsForGroup(groupId) {
        try {
            const tabs = await chrome.tabs.query({ groupId });
            this.renderTabs(tabs);
        } catch (error) {
            console.error('Failed to load tabs for group:', error);
            showMessage('Failed to load tabs', 'error');
        }
    }

    renderTabs(tabs) {
        if (!this.elements.fileList || !this.elements.welcomeMessage) return;

        this.elements.fileList.innerHTML = '';

        if (!tabs || tabs.length === 0) {
            this.elements.welcomeMessage.style.display = 'block';
            return;
        }

        this.elements.welcomeMessage.style.display = 'none';

        tabs.forEach(tab => {
            const tabElement = this.createTabElement(tab);
            this.elements.fileList.appendChild(tabElement);
        });
    }

    createTabElement(tab) {
        const li = document.createElement('li');
        li.className = 'tab-item';
        li.dataset.tabId = tab.id;

        if (this.state.selectedTabs.has(tab.id)) {
            li.classList.add('selected');
        }

        const favicon = document.createElement('img');
        favicon.className = 'tab-icon';
        favicon.src = tab.favIconUrl || chrome.runtime.getURL('images/default-favicon.png');
        favicon.alt = '';
        favicon.onerror = () => {
            favicon.src = chrome.runtime.getURL('images/default-favicon.png');
        };

        const info = document.createElement('div');
        info.className = 'tab-info';

        const title = document.createElement('p');
        title.className = 'tab-title';
        title.textContent = tab.title || 'Untitled';

        const url = document.createElement('p');
        url.className = 'tab-url';
        url.textContent = tab.url || '';

        info.appendChild(title);
        info.appendChild(url);

        li.appendChild(favicon);
        li.appendChild(info);

        return li;
    }

    handleTabClick = async (event) => {
        const tabElement = event.target.closest('.tab-item');
        if (!tabElement) return;

        const tabId = parseInt(tabElement.dataset.tabId);
        if (event.ctrlKey || event.metaKey) {
            this.toggleTabSelection(tabId);
        } else {
            await this.activateTab(tabId);
        }
    }

    handleGroupClick = (event) => {
        const groupElement = event.target.closest('.group-item');
        if (!groupElement) return;

        const groupId = parseInt(groupElement.dataset.groupId);
        this.selectGroup(groupId);
    }

    toggleTabSelection(tabId) {
        if (this.state.selectedTabs.has(tabId)) {
            this.state.selectedTabs.delete(tabId);
        } else {
            this.state.selectedTabs.add(tabId);
        }
        this.renderTabs(this.state.tabs);
    }

    async activateTab(tabId) {
        try {
            await chrome.tabs.update(tabId, { active: true });
        } catch (error) {
            console.error('Failed to activate tab:', error);
            showMessage('Failed to activate tab', 'error');
        }
    }

    async getTabCountForGroup(groupId) {
        try {
            const tabs = await chrome.tabs.query({ groupId });
            return tabs.length;
        } catch (error) {
            console.error('Failed to get tab count:', error);
            return 0;
        }
    }

    exportSelectedGroups = async () => {
        try {
            // Get selected group IDs
            const selectedGroups = Array.from(
                document.querySelectorAll('#groupCheckboxes input[type="checkbox"]:checked')
            ).map(checkbox => parseInt(checkbox.value));

            // Get additional options
            const exportUngrouped = document.getElementById('exportUngroupedTabs')?.checked || false;
            const exportPinned = document.getElementById('exportPinnedTabs')?.checked || false;

            if (selectedGroups.length === 0 && !exportUngrouped && !exportPinned) {
                showMessage('Please select at least one option to export', 'error');
                return;
            }

            // Collect export data
            const exportData = await this.collectExportData(selectedGroups, exportUngrouped, exportPinned);
            
            // Download the export file
            await this.downloadExportData(exportData);
            
            // Close modal and show success message
            this.toggleExportModal(false);
            showMessage('Groups exported successfully', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            showMessage('Failed to export groups', 'error');
        }
    }

    async collectExportData(selectedGroups, exportUngrouped, exportPinned) {
        const exportData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            groups: []
        };

        // Export selected groups
        for (const groupId of selectedGroups) {
            const groupTabs = await chrome.tabs.query({ groupId });
            if (groupTabs.length > 0) {
                const group = await chrome.tabGroups.get(groupId);
                exportData.groups.push({
                    id: groupId,
                    title: group.title,
                    color: group.color,
                    tabs: groupTabs.map(this.formatTabForExport)
                });
            }
        }

        // Export ungrouped tabs
        if (exportUngrouped) {
            const ungroupedTabs = await chrome.tabs.query({ groupId: -1 });
            if (ungroupedTabs.length > 0) {
                exportData.groups.push({
                    id: -1,
                    title: 'Ungrouped',
                    tabs: ungroupedTabs.filter(tab => !tab.pinned).map(this.formatTabForExport)
                });
            }
        }

        // Export pinned tabs
        if (exportPinned) {
            const pinnedTabs = await chrome.tabs.query({ pinned: true });
            if (pinnedTabs.length > 0) {
                exportData.groups.push({
                    id: -2,
                    title: 'Pinned',
                    tabs: pinnedTabs.map(this.formatTabForExport)
                });
            }
        }

        return exportData;
    }

    formatTabForExport(tab) {
        return {
            url: tab.url,
            title: tab.title,
            pinned: tab.pinned,
            favIconUrl: tab.favIconUrl
        };
    }

    async downloadExportData(exportData) {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        
        try {
            const timestamp = new Date().toISOString().split('T')[0];
            await chrome.downloads.download({
                url: url,
                filename: `tab_groups_export_${timestamp}.json`,
                saveAs: true
            });
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    importGroups = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (event) => {
            const file = event.target?.files?.[0];
            if (file) {
                await this.tabExportImport.importGroups(file);
                await this.loadTabGroups();
            }
        };

        input.click();
    }

    closeAllModals() {
        // Hide all modals
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
            modal.hidden = true;
        });
    }

    toggleExportModal = async (show) => {
        if (!this.elements.exportModal) return;
        
        if (show) {
            await this.updateExportGroupsList();
            this.elements.exportModal.style.display = 'flex';
            this.elements.exportModal.hidden = false;
        } else {
            this.elements.exportModal.style.display = 'none';
            this.elements.exportModal.hidden = true;
        }
    }

    updateExportGroupsList = async () => {
        const groupCheckboxes = document.getElementById('groupCheckboxes');
        if (!groupCheckboxes) return;

        // Clear existing checkboxes
        groupCheckboxes.innerHTML = '';
        
        // Get all groups
        const groups = await chrome.tabGroups.query({});
        
        // Create checkbox for each group
        for (const group of groups) {
            const tabCount = await this.getTabCountForGroup(group.id);
            const groupElement = this.createGroupCheckboxItem(group, tabCount);
            groupCheckboxes.appendChild(groupElement);
        }

        // Set up select/deselect all functionality
        const selectAllBtn = document.getElementById('selectAllGroups');
        const deselectAllBtn = document.getElementById('deselectAllGroups');

        if (selectAllBtn) {
            selectAllBtn.onclick = () => {
                const checkboxes = groupCheckboxes.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => cb.checked = true);
            };
        }

        if (deselectAllBtn) {
            deselectAllBtn.onclick = () => {
                const checkboxes = groupCheckboxes.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => cb.checked = false);
            };
        }
    }

    createGroupCheckboxItem = (group, tabCount) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'group-checkbox-item';
        
        const label = document.createElement('label');
        label.className = 'checkbox-wrapper';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = group.id;
        checkbox.id = `group-${group.id}`;
        
        const colorDot = document.createElement('span');
        colorDot.className = `color-dot ${group.color || 'grey'}`;
        
        const title = document.createElement('span');
        title.className = 'group-title';
        title.textContent = group.title || 'Unnamed Group';
        
        const count = document.createElement('span');
        count.className = 'tab-count';
        count.textContent = `${tabCount} tabs`;
        
        label.appendChild(checkbox);
        label.appendChild(colorDot);
        label.appendChild(title);
        label.appendChild(count);
        wrapper.appendChild(label);
        
        return wrapper;
    }

    showKeyboardShortcuts() {
        if (this.elements.keyboardShortcutsModal) {
            this.elements.keyboardShortcutsModal.style.display = 'flex';
            this.elements.keyboardShortcutsModal.hidden = false;
        }
    }

    initTheme() {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.applyTheme(this.state.settings.darkMode || prefersDark);

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!this.state.settings.darkMode) {
                this.applyTheme(e.matches);
            }
        });
    }

    applyTheme(isDark) {
        document.documentElement.classList.toggle('dark', isDark);
    }

    handleTabUpdate = (tabId, changeInfo, tab) => {
        if (tab.groupId === this.state.currentGroupId) {
            this.loadTabsForGroup(this.state.currentGroupId);
        }
    }

    handleTabRemove = () => {
        this.loadTabGroups();
    }

    handleGroupUpdate = () => {
        this.loadTabGroups();
    }

    showContextMenu = (event) => {
        event.preventDefault();
        if (!this.elements.contextMenu) return;

        this.elements.contextMenu.style.left = `${event.pageX}px`;
        this.elements.contextMenu.style.top = `${event.pageY}px`;
        this.elements.contextMenu.hidden = false;
    }

    hideContextMenu = () => {
        if (this.elements.contextMenu) {
            this.elements.contextMenu.hidden = true;
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        const tabManager = new TabManager();
        tabManager.init().catch(error => {
            console.error('Failed to initialize tab manager:', error);
            showMessage('Failed to initialize tab manager', 'error');
        });
    } catch (error) {
        console.error('Failed to create TabManager instance:', error);
        showMessage('Failed to create TabManager instance', 'error');
    }
});