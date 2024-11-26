import { showMessage } from './utils.js';

class TabExportImport {
    constructor() {
        this.progressContainer = document.getElementById('progressContainer');
        this.progressBar = document.getElementById('progressBar');
    }

    // Export functionality
    async exportGroups(selectedGroupIds, includeUngrouped = false, includePinned = false) {
        try {
            this.showProgress();
            const exportData = await this.collectExportData(selectedGroupIds, includeUngrouped, includePinned);
            await this.downloadExportData(exportData);
            showMessage('Export completed successfully', 'success');
        } catch (error) {
            showMessage(`Export failed: ${error.message}`, 'error');
            console.error('Export error:', error);
        } finally {
            this.hideProgress();
        }
    }

    async collectExportData(selectedGroupIds, includeUngrouped, includePinned) {
        const exportData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            groups: []
        };

        // Export selected groups
        let processedCount = 0;
        for (const groupId of selectedGroupIds) {
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
            this.updateProgress(++processedCount / (selectedGroupIds.length + 2) * 100);
        }

        // Export ungrouped tabs
        if (includeUngrouped) {
            const ungroupedTabs = await chrome.tabs.query({ groupId: -1 });
            if (ungroupedTabs.length > 0) {
                exportData.groups.push({
                    id: -1,
                    title: 'Ungrouped',
                    tabs: ungroupedTabs.filter(tab => !tab.pinned).map(this.formatTabForExport)
                });
            }
            this.updateProgress(++processedCount / (selectedGroupIds.length + 2) * 100);
        }

        // Export pinned tabs
        if (includePinned) {
            const pinnedTabs = await chrome.tabs.query({ pinned: true });
            if (pinnedTabs.length > 0) {
                exportData.groups.push({
                    id: -2,
                    title: 'Pinned',
                    tabs: pinnedTabs.map(this.formatTabForExport)
                });
            }
            this.updateProgress(100);
        }

        return exportData;
    }

    formatTabForExport(tab) {
        return {
            url: tab.url,
            title: tab.title,
            pinned: tab.pinned,
            muted: tab.mutedInfo?.muted || false
        };
    }

    async downloadExportData(exportData) {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
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

    // Import functionality
    async importGroups(file) {
        try {
            this.showProgress();
            const importedData = await this.readFileAsJson(file);
            await this.validateImportData(importedData);
            
            const window = await chrome.windows.getCurrent();
            await this.importGroupsSequentially(importedData, window.id);
            
            showMessage('Import completed successfully', 'success');
        } catch (error) {
            showMessage(`Import failed: ${error.message}`, 'error');
            console.error('Import error:', error);
        } finally {
            this.hideProgress();
        }
    }

    async readFileAsJson(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    resolve(JSON.parse(e.target.result));
                } catch {
                    reject(new Error('Invalid JSON file'));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    validateImportData(data) {
        if (!data.version || !data.groups || !Array.isArray(data.groups)) {
            throw new Error('Invalid import file format');
        }
    }

    async importGroupsSequentially(importedData, windowId) {
        const totalGroups = importedData.groups.length;
        let completedGroups = 0;

        for (const group of importedData.groups) {
            const tabIds = await this.createTabsForGroup(group.tabs, windowId);
            
            if (tabIds.length > 0) {
                const groupId = await chrome.tabs.group({ tabIds });
                await chrome.tabGroups.update(groupId, {
                    title: group.title,
                    color: group.color
                });
            }

            this.updateProgress(++completedGroups / totalGroups * 100);
        }
    }

    async createTabsForGroup(tabs, windowId) {
        const tabIds = [];
        for (const tabInfo of tabs) {
            try {
                const tab = await chrome.tabs.create({
                    url: tabInfo.url,
                    pinned: tabInfo.pinned,
                    active: false,
                    windowId
                });
                tabIds.push(tab.id);
            } catch (error) {
                console.error(`Failed to create tab: ${error.message}`);
            }
        }
        return tabIds;
    }

    // Progress bar management
    showProgress() {
        if (this.progressContainer) {
            this.progressContainer.style.display = 'block';
            this.updateProgress(0);
        }
    }

    hideProgress() {
        if (this.progressContainer) {
            this.progressContainer.style.display = 'none';
        }
    }

    updateProgress(percent) {
        if (this.progressBar) {
            this.progressBar.style.width = `${percent}%`;
            this.progressBar.setAttribute('aria-valuenow', percent);
        }
    }
}

// Export a singleton instance
export const tabExportImport = new TabExportImport();
export default TabExportImport;