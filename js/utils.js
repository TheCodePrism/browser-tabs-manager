import { CONSTANTS } from '../constants.js';

// DOM Utilities
export const createElement = (tagName, options = {}) => {
    const element = document.createElement(tagName);
    
    if (options.className) {
        element.className = options.className;
    }
    
    if (options.text) {
        element.textContent = options.text;
    }
    
    if (options.html) {
        element.innerHTML = options.html;
    }
    
    if (options.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
    }
    
    if (options.events) {
        Object.entries(options.events).forEach(([event, handler]) => {
            element.addEventListener(event, handler);
        });
    }
    
    return element;
};

// URL and File Name Utilities
export const sanitizeFileName = (fileName) => {
    return fileName
        .replace(/[<>:"/\\|?*]+/g, '_') // Replace invalid characters
        .replace(/\s+/g, '_')           // Replace spaces with underscores
        .replace(/_+/g, '_')            // Replace multiple underscores with single
        .replace(/^_+|_+$/g, '')        // Remove leading/trailing underscores
        .slice(0, 255);                 // Limit length
};

export const formatFileNameTemplate = (template, data, index) => {
    return template
        .replace(/{index}/g, index)
        .replace(/{title}/g, sanitizeFileName(data.title || ''))
        .replace(/{url}/g, sanitizeFileName(new URL(data.url).hostname))
        .replace(/{date}/g, new Date().toISOString().split('T')[0]);
};

// Storage Utilities
export const storage = {
    async get(keys, defaultValues = {}) {
        try {
            return await chrome.storage.sync.get(defaultValues);
        } catch (error) {
            console.error('Storage get error:', error);
            return defaultValues;
        }
    },

    async set(items) {
        try {
            await chrome.storage.sync.set(items);
            return true;
        } catch (error) {
            console.error('Storage set error:', error);
            return false;
        }
    }
};

// Message Utilities
export const showMessage = (message, type = 'info') => {
    const messageElement = document.getElementById(CONSTANTS.DOM_IDS.MESSAGE);
    if (!messageElement) return;

    messageElement.textContent = message;
    messageElement.className = `message ${type} show`;
    
    setTimeout(() => {
        messageElement.classList.remove('show');
    }, CONSTANTS.MESSAGE_DURATION);
};

// Progress Bar Utilities
export class ProgressBar {
    constructor() {
        this.container = document.getElementById(CONSTANTS.DOM_IDS.PROGRESS_CONTAINER);
        this.bar = document.getElementById(CONSTANTS.DOM_IDS.PROGRESS_BAR);
    }

    show() {
        if (this.container) {
            this.container.style.display = 'block';
            this.setValue(0);
        }
    }

    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    setValue(percent) {
        if (this.bar) {
            this.bar.style.width = `${percent}%`;
            this.bar.setAttribute('aria-valuenow', percent);
        }
    }
}

// Theme Utilities
export const detectColorScheme = () => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Date Utilities
export const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

// Tab Utilities
export const groupTabsByDomain = (tabs) => {
    return tabs.reduce((acc, tab) => {
        try {
            const url = new URL(tab.url);
            const domain = url.hostname;
            if (!acc[domain]) {
                acc[domain] = [];
            }
            acc[domain].push(tab);
        } catch (error) {
            console.warn('Invalid URL:', tab.url);
        }
        return acc;
    }, {});
};

// Function Utilities
export const debounce = (func, wait = CONSTANTS.SEARCH_DEBOUNCE_DELAY) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

export const throttle = (func, limit) => {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// Error Handling
export const safeExecute = async (operation) => {
    try {
        return await operation();
    } catch (error) {
        console.error('Operation failed:', error);
        showMessage(error.message, 'error');
        throw error;
    }
};