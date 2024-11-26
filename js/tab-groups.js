import { CONSTANTS } from '../constants.js';
import { showMessage } from './utils.js';

class TabGroupsManager {
    constructor() {
        this.groups = new Map();
        this.activeGroupId = null;
        this.settings = {
            autoGroup: false,
            groupColors: CONSTANTS.GROUP_COLORS,
            defaultColor: 'blue'
        };
    }

    async init() {
        await this.loadSettings();
        await this.refreshGroups();
    }

    async loadSettings() {
        try {
            const settings = await chrome.storage.sync.get({
                autoGroup: false,
                groupColors: CONSTANTS.GROUP_COLORS,
                defaultColor: 'blue'
            });
            this.settings = settings;
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    async refreshGroups() {
        try {
            const groups = await chrome.tabGroups.query({});
            this.groups.clear();
            
            for (const group of groups) {
                const tabs = await chrome.tabs.query({ groupId: group.id });
                this.groups.set(group.id, {
                    ...group,
                    tabs: tabs
                });
            }
            
            return Array.from(this.groups.values());
        } catch (error) {
            console.error('Failed to refresh groups:', error);
            throw error;
        }
    }

    async createGroup(tabIds, options = {}) {
        try {
            const groupId = await chrome.tabs.group({ tabIds });
            const color = options.color || this.getNextColor();
            
            await chrome.tabGroups.update(groupId, {
                color,
                title: options.title || 'New Group'
            });

            await this.refreshGroups();
            return groupId;
        } catch (error) {
            console.error('Failed to create group:', error);
            throw error;
        }
    }

    getNextColor() {
        const usedColors = new Set([...this.groups.values()].map(group => group.color));
        const availableColors = this.settings.groupColors.filter(color => !usedColors.has(color));
        return availableColors.length > 0 ? availableColors[0] : this.settings.defaultColor;
    }

    async updateGroup(groupId, updates) {
        try {
            await chrome.tabGroups.update(groupId, updates);
            await this.refreshGroups();
        } catch (error) {
            console.error('Failed to update group:', error);
            throw error;
        }
    }

    async removeGroup(groupId) {
        try {
            const group = this.groups.get(groupId);
            if (!group) return;

            await chrome.tabs.ungroup(group.tabs.map(tab => tab.id));
            await this.refreshGroups();
        } catch (error) {
            console.error('Failed to remove group:', error);
            throw error;
        }
    }

    async addTabsToGroup(groupId, tabIds) {
        try {
            await chrome.tabs.group({ groupId, tabIds });
            await this.refreshGroups();
        } catch (error) {
            console.error('Failed to add tabs to group:', error);
            throw error;
        }
    }

    async removeTabsFromGroup(tabIds) {
        try {
            await chrome.tabs.ungroup(tabIds);
            await this.refreshGroups();
        } catch (error) {
            console.error('Failed to remove tabs from group:', error);
            throw error;
        }
    }

    getGroup(groupId) {
        return this.groups.get(groupId);
    }

    getAllGroups() {
        return Array.from(this.groups.values());
    }

    getGroupedTabs(groupId) {
        const group = this.groups.get(groupId);
        return group ? group.tabs : [];
    }
}

// Create and export a singleton instance
export const tabGroupsManager = new TabGroupsManager();

// Also export the class for flexibility
export default TabGroupsManager;