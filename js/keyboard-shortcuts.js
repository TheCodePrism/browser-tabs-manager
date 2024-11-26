// Keyboard Shortcuts Manager
export class KeyboardShortcuts {
    constructor() {
        this.shortcuts = new Map();
        this.isCtrlPressed = false;
        this.isShiftPressed = false;
        this.isAltPressed = false;
    }

    init() {
        // Set up keyboard event listeners
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        // Register default shortcuts
        this.registerDefaultShortcuts();
    }

    // Register a new keyboard shortcut
    register(combination, description, callback) {
        this.shortcuts.set(combination, {
            description,
            callback,
            enabled: true
        });
    }

    // Handle keydown events
    handleKeyDown(event) {
        // Update modifier key states
        this.updateModifierStates(event);

        // Generate the key combination string
        const combination = this.generateCombination(event);
        
        // Find and execute matching shortcut
        const shortcut = this.shortcuts.get(combination);
        if (shortcut && shortcut.enabled && !this.isInputElement(event.target)) {
            event.preventDefault();
            shortcut.callback(event);
        }
    }

    // Handle keyup events
    handleKeyUp(event) {
        // Reset modifier states
        switch (event.key) {
            case 'Control':
                this.isCtrlPressed = false;
                break;
            case 'Shift':
                this.isShiftPressed = false;
                break;
            case 'Alt':
                this.isAltPressed = false;
                break;
        }
    }

    // Update modifier key states
    updateModifierStates(event) {
        switch (event.key) {
            case 'Control':
                this.isCtrlPressed = true;
                break;
            case 'Shift':
                this.isShiftPressed = true;
                break;
            case 'Alt':
                this.isAltPressed = true;
                break;
        }
    }

    // Generate key combination string
    generateCombination(event) {
        const modifiers = [];
        
        if (this.isCtrlPressed) modifiers.push('ctrl');
        if (this.isShiftPressed) modifiers.push('shift');
        if (this.isAltPressed) modifiers.push('alt');
        
        const key = event.key.toLowerCase();
        if (!['control', 'shift', 'alt'].includes(key)) {
            modifiers.push(key);
        }
        
        return modifiers.join('+');
    }

    // Check if target is an input element
    isInputElement(element) {
        const tagName = element.tagName.toLowerCase();
        return tagName === 'input' || 
               tagName === 'textarea' || 
               element.isContentEditable;
    }

    // Enable a specific shortcut
    enable(combination) {
        const shortcut = this.shortcuts.get(combination);
        if (shortcut) {
            shortcut.enabled = true;
        }
    }

    // Disable a specific shortcut
    disable(combination) {
        const shortcut = this.shortcuts.get(combination);
        if (shortcut) {
            shortcut.enabled = false;
        }
    }

    // Get all registered shortcuts
    getShortcuts() {
        const shortcuts = [];
        this.shortcuts.forEach((value, key) => {
            shortcuts.push({
                combination: key,
                description: value.description,
                enabled: value.enabled
            });
        });
        return shortcuts;
    }

    // Register default shortcuts
    registerDefaultShortcuts() {
        // Search
        this.register('ctrl+f', 'Search tabs', () => {
            document.getElementById('searchInput')?.focus();
        });

        // New group
        this.register('ctrl+g', 'Create new group', () => {
            document.getElementById('createGroup')?.click();
        });

        // Export
        this.register('ctrl+e', 'Export groups', () => {
            document.getElementById('exportGroups')?.click();
        });

        // Import
        this.register('ctrl+i', 'Import groups', () => {
            document.getElementById('importGroups')?.click();
        });

        // Close current group
        this.register('ctrl+w', 'Close current group', () => {
            if (window.TabManager.state.currentGroupId) {
                window.TabManager.closeCurrentGroup();
            }
        });

        // Select all tabs in current group
        this.register('ctrl+a', 'Select all tabs in group', (event) => {
            if (!this.isInputElement(event.target)) {
                window.TabManager.selectAllTabsInCurrentGroup();
            }
        });

        // Toggle group collapse
        this.register('ctrl+space', 'Toggle group collapse', () => {
            if (window.TabManager.state.currentGroupId) {
                window.TabManager.toggleGroupCollapse();
            }
        });

        // Navigation shortcuts
        this.register('up', 'Navigate up', () => {
            window.TabManager.navigateGroups('up');
        });

        this.register('down', 'Navigate down', () => {
            window.TabManager.navigateGroups('down');
        });
    }

    // Show keyboard shortcuts help
    showShortcutsHelp() {
        const shortcuts = this.getShortcuts();
        const helpContent = shortcuts.map(shortcut => 
            `<div class="shortcut-row">
                <kbd>${this.formatCombination(shortcut.combination)}</kbd>
                <span>${shortcut.description}</span>
             </div>`
        ).join('');

        // Create modal element
        const modal = document.createElement('div');
        modal.className = 'shortcuts-modal';
        modal.innerHTML = `
            <div class="shortcuts-content">
                <h2>Keyboard Shortcuts</h2>
                <div class="shortcuts-list">
                    ${helpContent}
                </div>
                <button class="close-button">Close</button>
            </div>
        `;

        // Add event listener to close modal
        modal.querySelector('.close-button').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Add to document
        document.body.appendChild(modal);
    }

    // Format key combination for display
    formatCombination(combination) {
        return combination
            .split('+')
            .map(key => `<span class="key">${key}</span>`)
            .join(' + ');
    }
}

// Export singleton instance
export const keyboardShortcuts = new KeyboardShortcuts();