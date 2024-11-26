export const CONSTANTS = {
    // Message durations
    MESSAGE_DURATION: 3000,
    SEARCH_DEBOUNCE_DELAY: 300,
    
    // Group colors
    GROUP_COLORS: [
        'grey',
        'blue',
        'red',
        'yellow',
        'green',
        'pink',
        'purple',
        'cyan'
    ],
    
    // Event types
    EVENTS: {
        GROUP_UPDATED: 'groupUpdated',
        TABS_UPDATED: 'tabsUpdated',
        SEARCH_UPDATED: 'searchUpdated',
        THEME_CHANGED: 'themeChanged'
    },
    
    // Storage keys
    STORAGE_KEYS: {
        DARK_MODE: 'darkMode',
        FILE_NAME_TEMPLATE: 'fileNameTemplate',
        AUTO_GROUP: 'autoGroup',
        AUTO_GROUP_DOMAINS: 'autoGroupDomains',
        GROUP_COLORS: 'groupColors'
    },
    
    // Local storage defaults
    DEFAULTS: {
        fileNameTemplate: '{index}_{title}',
        darkMode: false,
        autoGroup: false,
        autoGroupDomains: []
    },

    // DOM IDs
    DOM_IDS: {
        APP: 'app',
        SEARCH_INPUT: 'searchInput',
        GROUP_LIST: 'groupList',
        FILE_LIST: 'fileList',
        MESSAGE: 'message',
        PROGRESS_CONTAINER: 'progressContainer',
        PROGRESS_BAR: 'progressBar',
        EXPORT_MODAL: 'exportModal',
        WELCOME_MESSAGE: 'welcomeMessage'
    },
    
    // Keyboard shortcuts
    SHORTCUTS: {
        SEARCH: 'ctrl+f',
        NEW_GROUP: 'ctrl+g',
        EXPORT: 'ctrl+e',
        IMPORT: 'ctrl+i',
        CLOSE_GROUP: 'ctrl+w',
        SELECT_ALL: 'ctrl+a',
        TOGGLE_COLLAPSE: 'ctrl+space'
    }
};