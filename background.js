import { CONSTANTS } from './constants.js';

// Context Menu IDs
const CONTEXT_MENU_IDS = {
    CREATE_GROUP: 'create-group',
    ADD_TO_GROUP: 'add-to-group',
    REMOVE_FROM_GROUP: 'remove-from-group',
    MANAGE_TABS: 'manage-tabs',
    GROUP_PREFIX: 'add-to-group-'
};

// State management for groups
let existingGroups = new Map();
let settings = {
    autoGroup: false,
    autoGroupDomains: [],
    groupColors: CONSTANTS.GROUP_COLORS,
    darkMode: false
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
    console.log('Tab Manager Extension installed/updated');
    await loadSettings();
    await setupContextMenus();
    updateBadgeCount();
});

// Load settings from storage
async function loadSettings() {
    try {
        const stored = await chrome.storage.sync.get({
            autoGroup: false,
            autoGroupDomains: [],
            groupColors: CONSTANTS.GROUP_COLORS,
            darkMode: false
        });
        settings = stored;
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Set up context menus
// Set up context menus
async function setupContextMenus() {
    try {
        // Remove existing menu items
        await chrome.contextMenus.removeAll();
        
        // Create main menu items
        chrome.contextMenus.create({
            id: CONTEXT_MENU_IDS.CREATE_GROUP,
            title: 'Create New Group',
            contexts: ['all']
        });

        chrome.contextMenus.create({
            id: CONTEXT_MENU_IDS.ADD_TO_GROUP,
            title: 'Add to Group',
            contexts: ['all']
        });

        chrome.contextMenus.create({
            id: CONTEXT_MENU_IDS.REMOVE_FROM_GROUP,
            title: 'Remove from Group',
            contexts: ['all']
        });

        chrome.contextMenus.create({
            id: CONTEXT_MENU_IDS.MANAGE_TABS,
            title: 'Open Tab Manager',
            contexts: ['all']
        });

        // Update groups submenu
        await updateGroupsContextMenu();
    } catch (error) {
        console.error('Failed to setup context menus:', error);
    }
}

// Update groups in context menu
async function updateGroupsContextMenu() {
    try {
        const groups = await chrome.tabGroups.query({});
        
        // Clear existing group submenus
        for (const menuId of existingGroups.keys()) {
            try {
                await chrome.contextMenus.remove(menuId);
            } catch (error) {
                console.error('Failed to remove menu item:', error);
            }
        }
        
        existingGroups.clear();
        
        // Add current groups to submenu
        for (const group of groups) {
            const menuId = `${CONTEXT_MENU_IDS.GROUP_PREFIX}${group.id}`;
            chrome.contextMenus.create({
                id: menuId,
                parentId: CONTEXT_MENU_IDS.ADD_TO_GROUP,
                title: group.title || `Group ${group.id}`,
                contexts: ['all']
            });
            existingGroups.set(menuId, group);
        }
    } catch (error) {
        console.error('Failed to update context menu:', error);
    }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab) return;

    try {
        if (info.menuItemId === CONTEXT_MENU_IDS.CREATE_GROUP) {
            await createNewGroup([tab.id]);
        } 
        else if (info.menuItemId === CONTEXT_MENU_IDS.REMOVE_FROM_GROUP) {
            await chrome.tabs.ungroup(tab.id);
        } 
        else if (info.menuItemId === CONTEXT_MENU_IDS.MANAGE_TABS) {
            chrome.action.openPopup();
        }
        else if (info.menuItemId.startsWith(CONTEXT_MENU_IDS.GROUP_PREFIX)) {
            const groupId = parseInt(info.menuItemId.replace(CONTEXT_MENU_IDS.GROUP_PREFIX, ''));
            await chrome.tabs.group({ tabIds: tab.id, groupId });
        }
    } catch (error) {
        console.error('Context menu action failed:', error);
    }
});

// Create a new group
async function createNewGroup(tabIds) {
    try {
        const groupId = await chrome.tabs.group({ tabIds });
        const randomColor = settings.groupColors[
            Math.floor(Math.random() * settings.groupColors.length)
        ];
        
        await chrome.tabGroups.update(groupId, { 
            color: randomColor,
            title: 'New Group'
        });
        
        await updateGroupsContextMenu();
        return groupId;
    } catch (error) {
        console.error('Failed to create group:', error);
        throw error;
    }
}

// Auto-grouping functionality
chrome.tabs.onCreated.addListener(async (tab) => {
    if (!settings.autoGroup || !tab.url || tab.groupId !== -1) return;

    try {
        const domain = new URL(tab.url).hostname;
        const matchingDomain = settings.autoGroupDomains.find(d => 
            domain.includes(d)
        );

        if (matchingDomain) {
            // Find existing group for this domain
            const groups = await chrome.tabGroups.query({});
            const tabs = await chrome.tabs.query({});
            
            const existingGroup = groups.find(group => {
                const groupTabs = tabs.filter(t => t.groupId === group.id);
                return groupTabs.some(t => {
                    try {
                        const tabDomain = new URL(t.url).hostname;
                        return tabDomain.includes(matchingDomain);
                    } catch {
                        return false;
                    }
                });
            });

            if (existingGroup) {
                await chrome.tabs.group({ 
                    tabIds: tab.id, 
                    groupId: existingGroup.id 
                });
            } else {
                await createNewGroup([tab.id]);
            }
        }
    } catch (error) {
        console.error('Auto-grouping failed:', error);
    }
});

// Watch for group changes
chrome.tabGroups.onCreated.addListener(updateGroupsContextMenu);
chrome.tabGroups.onRemoved.addListener(updateGroupsContextMenu);
chrome.tabGroups.onUpdated.addListener(updateGroupsContextMenu);

// Handle keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
    try {
        switch (command) {
            case "search_tabs":
                const [tab] = await chrome.tabs.query({ 
                    active: true, 
                    currentWindow: true 
                });
                if (tab) {
                    chrome.tabs.sendMessage(tab.id, { 
                        action: "focusSearch" 
                    });
                }
                break;
                
            case "create_group":
                const selectedTabs = await chrome.tabs.query({ 
                    highlighted: true, 
                    currentWindow: true 
                });
                if (selectedTabs.length > 0) {
                    await createNewGroup(selectedTabs.map(tab => tab.id));
                }
                break;
        }
    } catch (error) {
        console.error('Command execution failed:', error);
    }
});

// Update badge with group count
async function updateBadgeCount() {
    try {
        const groups = await chrome.tabGroups.query({});
        const count = groups.length.toString();
        
        await chrome.action.setBadgeText({ text: count });
        await chrome.action.setBadgeBackgroundColor({ 
            color: count === '0' ? '#64748b' : '#3b82f6' 
        });
    } catch (error) {
        console.error('Failed to update badge:', error);
    }
}

// Watch for changes that should update the badge
chrome.tabs.onCreated.addListener(updateBadgeCount);
chrome.tabs.onRemoved.addListener(updateBadgeCount);
chrome.tabGroups.onCreated.addListener(async () => {
    await updateBadgeCount();
    await updateGroupsContextMenu();
});
chrome.tabGroups.onRemoved.addListener(async () => {
    await updateBadgeCount();
    await updateGroupsContextMenu();
});
chrome.tabGroups.onUpdated.addListener(async () => {
    await updateGroupsContextMenu();
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'getGroups':
            chrome.tabGroups.query({})
                .then(groups => sendResponse({ groups }))
                .catch(error => sendResponse({ error: error.message }));
            return true;
            
        case 'createGroup':
            createNewGroup(request.tabIds)
                .then(groupId => sendResponse({ groupId }))
                .catch(error => sendResponse({ error: error.message }));
            return true;
            
        case 'updateSettings':
            loadSettings()
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ error: error.message }));
            return true;
    }
});

// Watch for settings changes
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
        Object.entries(changes).forEach(([key, { newValue }]) => {
            if (key in settings) {
                settings[key] = newValue;
            }
        });
    }
});