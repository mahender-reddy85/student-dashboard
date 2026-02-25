/**
 * Application State Management
 * @namespace state
 * @property {Array} tasks - Array of task objects
 * @property {string} theme - Current theme ('light' or 'dark')
 * @property {string} filterQuery - Current search query
 * @property {string} priorityFilter - Priority filter ('all', 'high', 'medium', 'low')
 * @property {string} sortOrder - Sort order ('none', 'asc', 'desc')
 * @property {Object|null} lastDeletedTask - Last deleted task for undo functionality
 */
const state = {
    tasks: [],
    theme: (() => {
        try {
            return localStorage.getItem('kanbanflow_theme') || 'light';
        } catch (error) {
            console.error('Error accessing localStorage:', error);
            return 'light';
        }
    })(),
    filterQuery: '',
    priorityFilter: 'all',
    sortOrder: 'none',
    lastDeletedTask: null
};

// Toast Notification System
function showToast(message, type = 'info', duration = 5000, undoAction = null) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const toastId = 'toast-' + Date.now();
    toast.id = toastId;

    let icon = 'ℹ️';
    switch (type) {
        case 'success':
            icon = '✅';
            break;
        case 'error':
            icon = '❌';
            break;
        case 'warning':
            icon = '⚠️';
            break;
    }

    toast.innerHTML = `
        <span class="toast-message">${icon} ${message}</span>
        ${undoAction ? `<button class="toast-undo" id="${toastId}-undo">Undo</button>` : ''}
        <button class="toast-close" id="${toastId}-close">&times;</button>
    `;

    container.appendChild(toast);

    // Trigger reflow to enable the show animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Set up close button
    const closeBtn = document.getElementById(`${toastId}-close`);
    if (closeBtn) {
        closeBtn.onclick = () => {
            hideToast(toast);
        };
    }

    // Set up undo button if applicable
    if (undoAction) {
        const undoBtn = document.getElementById(`${toastId}-undo`);
        if (undoBtn) {
            undoBtn.onclick = (e) => {
                e.stopPropagation();
                undoAction();
                hideToast(toast);
            };
        }
    }

    // Auto-hide after duration
    const timeoutId = setTimeout(() => {
        hideToast(toast);
    }, duration);

    // Store timeout ID on the toast element for cleanup
    toast.timeoutId = timeoutId;

    // Pause auto-hide on hover
    toast.addEventListener('mouseenter', () => {
        clearTimeout(timeoutId);
    });

    // Resume auto-hide when mouse leaves
    toast.addEventListener('mouseleave', () => {
        toast.timeoutId = setTimeout(() => {
            hideToast(toast);
        }, 1000);
    });

    return toast;
}

function hideToast(toastElement) {
    if (!toastElement) return;

    // Clear any pending timeout
    if (toastElement.timeoutId) {
        clearTimeout(toastElement.timeoutId);
    }

    // Start hide animation
    toastElement.classList.remove('show');

    // Remove from DOM after animation completes
    setTimeout(() => {
        if (toastElement && toastElement.parentNode) {
            toastElement.parentNode.removeChild(toastElement);
        }
    }, 300);
}

// Firebase Functions
async function saveTaskToFirebase(title, status, dueDate, description = '', priority = 'medium') {
    try {
        await addDoc(collection(db, "tasks"), {
            title: title,
            status: status,
            dueDate: dueDate || "",
            description: description,
            priority: priority,
            createdAt: new Date()
        });
    } catch (error) {
        console.error("Firebase save error:", error);
    }
}

async function loadTasksFromFirebase() {
    try {
        // Clear local state first to prevent duplicates
        state.tasks = [];
        
        const querySnapshot = await getDocs(collection(db, "tasks"));

        querySnapshot.forEach((doc) => {
            const data = doc.data();

            // Create task object compatible with your system
            const task = {
                id: doc.id,
                title: data.title,
                status: data.status,
                dueDate: data.dueDate || null,
                createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
                description: data.description || '',
                priority: data.priority || 'medium',
                pinned: false,
                subtasks: [],
                files: []
            };

            // Add to state
            state.tasks.push(task);
        });

        // Render board with loaded tasks
        renderBoard();
        console.log("Tasks loaded from Firebase");
    } catch (error) {
        console.error("Firebase load error:", error);
    }
}

// DOM Elements
const DOM = {
    board: document.getElementById('board'),
    modal: document.getElementById('modalOverlay'),
    form: document.getElementById('taskForm'),
    searchInput: document.getElementById('searchInput'),
    themeToggle: document.getElementById('themeToggle'),
    clearBtn: document.getElementById('clearBoard'),
    closeModal: document.getElementById('closeModal')
};

// Constants
const COLUMNS = [
    { id: 'todo', title: '<i class="fas fa-list-ul"></i> To Do' },
    { id: 'progress', title: '<i class="fas fa-spinner"></i> In Progress' },
    { id: 'done', title: '<i class="fas fa-check-circle"></i> Done' }
];

// Initializes the application
function init() {
    try {
        // Initialize theme manager first
        ThemeManager.init();

        // Clear local state to load fresh from Firebase
        state.tasks = [];

        // Initialize the rest of the application
        renderBoard();
        setupEventListeners();

        // Add loaded class to body for CSS transitions
        document.body.classList.add('loaded');

        // Show welcome message
        showToast('Welcome to YoursKanban!', 'success');

        // Load tasks from Firebase after initialization
        loadTasksFromFirebase();
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize the application', 'error');
    }
}

// Saves the current application state to localStorage (DISABLED - Using Firebase instead)
function saveState() {
    try {
        // DISABLED: Using Firebase for persistence now
        // const stateToSave = {
        //     tasks: state.tasks,
        //     lastDeletedTask: state.lastDeletedTask
        // };
        // localStorage.setItem('kanbanflow_state', JSON.stringify(stateToSave));
        console.log('State save skipped - using Firebase');
    } catch (error) {
        console.error('Failed to save state:', error);
        showToast('Failed to save board state', 'error');
    }
}

// Loads the application state from localStorage (DISABLED - Using Firebase instead)
function loadState() {
    try {
        // DISABLED: Using Firebase for persistence now
        // const savedState = localStorage.getItem('kanbanflow_state');
        // if (savedState) {
        //     const parsedState = JSON.parse(savedState);
        //     state.tasks = parsedState.tasks || [];
        //     state.lastDeletedTask = parsedState.lastDeletedTask || null;
        // }
        console.log('State load skipped - using Firebase');
    } catch (error) {
        console.error('Failed to load state:', error);
        showToast('Failed to load board state', 'error');
    }
}

// --- Theme Management ---
const ThemeManager = (() => {
    const STORAGE_KEY = 'kanbanflow_theme';
    const THEME_ATTR = 'data-theme';
    const THEMES = {
        LIGHT: 'light',
        DARK: 'dark'
    };

    // DOM Elements
    let themeToggle = null;

    /**
     * Initialize theme management
     */
    function init() {
        themeToggle = document.getElementById('themeToggle');

        // Set initial theme
        const savedTheme = getSavedThemePreference();
        setTheme(savedTheme, false);

        // Add event listeners
        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
        }

        // Listen for system theme changes
        const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        if (colorSchemeQuery.addEventListener) {
            colorSchemeQuery.addEventListener('change', handleSystemThemeChange);
        }
    }

    /**
     * Get the user's saved theme preference
     * @returns {string} The saved theme or system preference
     */
    function getSavedThemePreference() {
        try {
            return localStorage.getItem(STORAGE_KEY) || getSystemPreference();
        } catch (error) {
            console.error('Error accessing localStorage:', error);
            return THEMES.LIGHT;
        }
    }

    /**
     * Get system color scheme preference
     * @returns {string} 'dark' or 'light'
     */
    function getSystemPreference() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
            ? THEMES.DARK
            : THEMES.LIGHT;
    }

    /**
     * Handle system theme changes
     * @param {MediaQueryListEvent} event 
     */
    function handleSystemThemeChange(event) {
        // Only apply system theme if user hasn't explicitly set a preference
        if (!localStorage.getItem(STORAGE_KEY)) {
            setTheme(event.matches ? THEMES.DARK : THEMES.LIGHT, false);
        }
    }

    /**
     * Toggle between light and dark themes
     */
    function toggleTheme() {
        console.log('toggleTheme called');
        const currentTheme = document.documentElement.getAttribute(THEME_ATTR);
        console.log('Current theme:', currentTheme);
        const newTheme = currentTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
        console.log('New theme:', newTheme);
        setTheme(newTheme, true);
    }

    /**
     * Set the current theme
     * @param {string} theme - Theme to set ('light' or 'dark')
     * @param {boolean} savePreference - Whether to save the preference
     */
    function setTheme(theme, savePreference = true) {
        console.log('setTheme called with:', { theme, savePreference });

        if (!Object.values(THEMES).includes(theme)) {
            console.warn(`Invalid theme: ${theme}. Defaulting to light.`);
            theme = THEMES.LIGHT;
        }

        // Update the DOM
        console.log('Setting theme attribute to:', theme);
        document.documentElement.setAttribute(THEME_ATTR, theme);

        // Save preference if requested
        if (savePreference) {
            try {
                localStorage.setItem(STORAGE_KEY, theme);
                console.log('Theme preference saved to localStorage:', theme);
            } catch (error) {
                console.error('Failed to save theme preference:', error);
            }
        }

        // Update UI
        console.log('Updating UI for theme:', theme);
        updateThemeUI(theme);
    }

    /**
     * Update UI elements to reflect the current theme
     * @param {string} theme - Current theme
     */
    function updateThemeUI(theme) {
        if (!themeToggle) return;

        const oppositeTheme = theme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
        const label = `Switch to ${oppositeTheme} mode`;

        themeToggle.setAttribute('aria-label', label);
        themeToggle.setAttribute('title', label);

        // Dispatch custom event for other components
        document.dispatchEvent(new CustomEvent('themeChange', {
            detail: {
                theme,
                oppositeTheme
            }
        }));
    }

    // Public API
    return {
        init,
        getCurrentTheme: () => document.documentElement.getAttribute(THEME_ATTR) || THEMES.LIGHT,
        setTheme,
        toggleTheme: () => toggleTheme() // Ensure we're calling the inner function
    };
})();

// Initialize theme management when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();

    // Set up keyboard shortcut for theme toggle (Alt+T)
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 't') {
            e.preventDefault();
            ThemeManager.toggleTheme();
        }
    });
});

// Theme management is now handled by the ThemeManager module
function applyTheme() {
    // This is a compatibility function for existing code
    ThemeManager.setTheme(ThemeManager.getCurrentTheme(), false);
}

// --- UI Rendering ---
function sortTasksByDueDate(tasks, order) {
    if (order === 'none') return [...tasks];

    return [...tasks].sort((a, b) => {
        const dateA = a.dueDate ? new Date(a.dueDate) : new Date(0);
        const dateB = b.dueDate ? new Date(b.dueDate) : new Date(0);

        // If both tasks don't have due dates, maintain their order
        if (!a.dueDate && !b.dueDate) return 0;
        // Tasks without due dates go to the end when sorting in ascending order, or to the start when descending
        if (!a.dueDate) return order === 'asc' ? 1 : -1;
        if (!b.dueDate) return order === 'asc' ? -1 : 1;

        // Sort by date
        return order === 'asc' ? dateA - dateB : dateB - dateA;
    });
}

function toggleSortOrder() {
    // Cycle through sort orders: none -> asc -> desc -> none
    state.sortOrder = state.sortOrder === 'none' ? 'asc' :
        state.sortOrder === 'asc' ? 'desc' : 'none';

    // Update button appearance
    const sortButton = document.getElementById('sortByDate');
    if (sortButton) {
        sortButton.style.opacity = state.sortOrder === 'none' ? '0.6' : '1';
        sortButton.title = state.sortOrder === 'none' ? 'Sort by due date' :
            state.sortOrder === 'asc' ? 'Sort: Oldest first' : 'Sort: Newest first';
    }

    renderBoard();
}

function renderBoard() {
    DOM.board.innerHTML = '';

    COLUMNS.forEach(col => {
        let columnTasks = state.tasks.filter(task => {
            // Filter by status
            if (task.status !== col.id) return false;

            // Filter by search query
            const matchesSearch = state.filterQuery === '' ||
                task.title.toLowerCase().includes(state.filterQuery.toLowerCase()) ||
                (task.description && task.description.toLowerCase().includes(state.filterQuery.toLowerCase()));

            // Filter by priority
            const matchesPriority = state.priorityFilter === 'all' ||
                (task.priority && task.priority.toLowerCase() === state.priorityFilter);

            return matchesSearch && matchesPriority;
        });

        // Apply sorting - pinned tasks first, then by due date if enabled
        columnTasks.sort((a, b) => {
            // Pinned tasks first
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;

            // If sort order is enabled, sort by due date
            if (state.sortOrder !== 'none') {
                return sortTasksByDueDate([a, b], state.sortOrder);
            }

            return 0;
        });

        const colEl = document.createElement('div');
        colEl.className = 'column';
        colEl.dataset.status = col.id;

        colEl.innerHTML = `
            <div class="column-header">
                <h3 class="column-title">
                    ${col.title} <span class="task-count">${columnTasks.length}</span>
                </h3>
                <button class="add-task-btn" data-status="${col.id}">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
            <div class="task-list" data-status="${col.id}">
                ${columnTasks.length === 0 ? '<div class="empty-state">No tasks here</div>' : ''}
            </div>
        `;

        if (columnTasks.length > 0) {
            const listEl = colEl.querySelector('.task-list');
            columnTasks.forEach(task => {
                listEl.appendChild(createTaskCard(task));
            });
        }

        DOM.board.appendChild(colEl);
    });

    attachDragEvents();
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        // Images
        'jpg': 'fa-file-image',
        'jpeg': 'fa-file-image',
        'png': 'fa-file-image',
        'gif': 'fa-file-image',
        'webp': 'fa-file-image',
        'svg': 'fa-file-image',
        // Documents
        'pdf': 'fa-file-pdf',
        'doc': 'fa-file-word',
        'docx': 'fa-file-word',
        'txt': 'fa-file-alt',
        'rtf': 'fa-file-alt',
        // Spreadsheets
        'xls': 'fa-file-excel',
        'xlsx': 'fa-file-excel',
        'csv': 'fa-file-csv',
        // Archives
        'zip': 'fa-file-archive',
        'rar': 'fa-file-archive',
        '7z': 'fa-file-archive',
        // Code
        'js': 'fa-file-code',
        'html': 'fa-file-code',
        'css': 'fa-file-code',
        'json': 'fa-file-code',
        // Default
        'default': 'fa-file'
    };
    
    return icons[ext] || icons['default'];
}

function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = `task-card ${task.pinned ? 'pinned' : ''}`;
    card.draggable = true;
    card.dataset.taskId = task.id;

    // Check if task is overdue
    if (task.dueDate && task.status !== 'done') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        
        if (dueDate < today) {
            card.classList.add('overdue');
        }
    }

    card.draggable = true;
    card.dataset.id = task.id;

    // Set up inline editing after card is created
    setTimeout(() => {
        setupInlineEditing(card, task);
    }, 0);

    // Format due date
    let dueDateText = '';
    if (task.dueDate) {
        const date = new Date(task.dueDate);
        dueDateText = `• Due ${date.toLocaleDateString()}`;
    }

    // Calculate progress for subtasks
    let progressHTML = '';
    if (task.subtasks && task.subtasks.length > 0) {
        const completedCount = task.subtasks.filter(st => st.completed).length;
        const progressPercent = (completedCount / task.subtasks.length) * 100;
        progressHTML = `
            <div class="subtask-progress">
                <div class="progress-bar">
                    <div class="progress" style="width: ${progressPercent}%"></div>
                </div>
                <div class="progress-text">
                    ${completedCount} of ${task.subtasks.length} tasks
                </div>
            </div>
            <div class="subtask-list">
                ${task.subtasks.map(subtask => `
                    <div class="subtask-preview">
                        <span class="subtask-checkbox ${subtask.completed ? 'completed' : ''}">
                            ${subtask.completed ? '✓' : ''}
                        </span>
                        <span class="subtask-text ${subtask.completed ? 'completed' : ''}">
                            ${sanitize(subtask.text)}
                        </span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    card.innerHTML = `
        <div class="card-header">
            <div class="card-title" tabindex="0">
                <span class="card-title-text">${sanitize(task.title) || '/'}</span>
                <input type="text" class="card-title-edit" value="${sanitize(task.title) || ''}" style="display: none;">
            </div>
            <div class="card-actions">
                <button class="icon-btn pin-btn ${task.pinned ? 'pinned' : ''}" data-id="${task.id}" title="${task.pinned ? 'Unpin' : 'Pin'}">
                    <i class="fas fa-thumbtack" style="color: ${task.pinned ? '#f59e0b' : '#94a3b8'}; font-size: 13px;"></i>
                </button>
                <button class="icon-btn duplicate-btn" data-id="${task.id}" title="Duplicate">
                    <i class="fas fa-copy" style="color: #94a3b8; font-size: 13px;"></i>
                </button>
                <button class="icon-btn edit-btn" data-id="${task.id}" title="Edit">
                    <i class="fas fa-pencil-alt" style="color: #94a3b8; font-size: 13px;"></i>
                </button>
                <button class="icon-btn delete-btn" data-id="${task.id}" title="Delete">
                    <i class="fas fa-trash" style="color: #94a3b8; font-size: 13px;"></i>
                </button>
            </div>
        </div>
        ${task.description ? `<div class="card-desc">${sanitize(task.description)}</div>` : ''}
        
        <!-- Subtask Progress -->
        ${task.subtasks?.length > 0 ? `
        <div class="subtask-progress">
            <div class="progress-bar">
                <div class="progress" style="width: ${(task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100}%"></div>
            </div>
            <div class="progress-text">
                ${task.subtasks.filter(st => st.completed).length} of ${task.subtasks.length} tasks
            </div>
        </div>` : ''}
        
        ${task.files && task.files.length > 0 ? `
        <div class="file-preview">
            ${task.files.map(file => `
                <div class="file-item">
                    <i class="fas ${getFileIcon(file.name)} file-icon"></i>
                    <span>${file.name}</span>
                    <a href="${file.url || '#'}" target="_blank" class="file-link">
                        <i class="fas fa-external-link-alt file-icon"></i>
                    </a>
                </div>
            `).join('')}
        </div>` : ''}
        <div class="card-footer">
            <span class="priority-badge priority-${task.priority || 'medium'}">
                ${(task.priority || 'medium').toUpperCase()}
            </span>
            ${task.dueDate ? `
            <div class="card-date">
                <i class="far fa-calendar-alt"></i>
                ${new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>` : ''}
        </div>
    `;

    return card;
}

// --- Drag and Drop ---
function attachDragEvents() {
    const cards = document.querySelectorAll('.task-card');
    const dropzones = document.querySelectorAll('.task-list');

    cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', card.dataset.id);
            setTimeout(() => {
                card.classList.add('dragging');
            }, 0);
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            renderBoard(); // Cleanup and persist
        });
    });

    dropzones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = getDragAfterElement(zone, e.clientY);
            const card = document.querySelector('.dragging');

            if (afterElement) {
                zone.insertBefore(card, afterElement);
            } else {
                zone.appendChild(card);
            }
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            const taskId = e.dataTransfer.getData('text/plain');
            const status = zone.dataset.status;
            updateTaskStatus(taskId, status);
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function updateTaskStatus(id, status) {
    const task = state.tasks.find(t => t.id === id);
    if (task) {
        task.status = status;
        // saveState(); // DISABLED - Using Firebase
        renderBoard();
    }
}

// File Handling
function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const dropZone = document.getElementById('dropZoneOverlay');
    dropZone.classList.remove('active');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        // Get the current task being edited or create a new one
        const taskId = document.getElementById('taskId')?.value;
        const task = taskId ? state.tasks.find(t => t.id === taskId) : null;

        if (task) {
            // Add files to existing task
            task.files = task.files || [];
            Array.from(files).forEach(file => {
                // In a real app, you would upload the file to a server here
                // For this example, we'll just store the file info
                task.files.push({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified,
                    // In a real app, you would have a URL to the uploaded file
                    // For this example, we'll use a data URL for images
                    url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '#'
                });
            });
            // saveState(); // DISABLED - Using Firebase
            renderBoard();
        } else {
            // If no task is being edited, create a new task with the files
            const newTask = {
                id: Date.now().toString(),
                title: files[0].name.split('.')[0], // Use first filename as title
                description: `Added ${files.length} file(s)`,
                status: 'todo',
                priority: 'medium',
                files: Array.from(files).map(file => ({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified,
                    url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '#'
                })),
                createdAt: Date.now()
            };

            state.tasks.push(newTask);
            // saveState(); // DISABLED - Using Firebase
            renderBoard();
        }
    }
}

// --- Event Handlers ---
function setupEventListeners() {
    // File drag and drop
    const dropZone = document.getElementById('dropZoneOverlay');
    const board = document.getElementById('board');

    // Show drop zone when dragging files over the board
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        board.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone when dragging files over it
    ['dragenter', 'dragover'].forEach(eventName => {
        board.addEventListener(eventName, () => {
            dropZone.classList.add('active');
        });
    });

    // Remove highlight when leaving
    ['dragleave', 'drop'].forEach(eventName => {
        board.addEventListener(eventName, () => {
            dropZone.classList.remove('active');
        });
    });

    // Handle file drop
    board.addEventListener('drop', handleFileDrop, false);

    // Prevent default drag behaviors
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Add keyboard event listener
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Sort button
    document.getElementById('sortByDate')?.addEventListener('click', toggleSortOrder);

    // Export button
    document.getElementById('exportBoard')?.addEventListener('click', exportBoard);

    // Add/Edit Task delegators
    DOM.board.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.add-task-btn');
        if (addBtn) openModal(null, addBtn.dataset.status);

        const editBtn = e.target.closest('.edit-btn');
        if (editBtn) openModal(editBtn.dataset.id);

        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) showDeleteConfirmation(deleteBtn.dataset.id);

        const duplicateBtn = e.target.closest('.duplicate-btn');
        if (duplicateBtn) duplicateTask(duplicateBtn.dataset.id);

        const pinBtn = e.target.closest('.pin-btn') || e.target.closest('.pin-btn i');
        if (pinBtn) {
            const btn = pinBtn.closest('.pin-btn');
            if (btn) togglePin(btn.dataset.id);
        }
    });

    // Search
    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', (e) => {
            state.filterQuery = e.target.value;
            renderBoard();
        });
    }

    // Priority filter
    const priorityFilter = document.getElementById('priorityFilter');
    if (priorityFilter) {
        priorityFilter.addEventListener('change', (e) => {
            state.priorityFilter = e.target.value;
            renderBoard();
        });
    }

    // Modal
    if (DOM.modal) {
        DOM.closeModal?.addEventListener('click', closeModal);
        DOM.modal.addEventListener('click', (e) => {
            if (e.target === DOM.modal) closeModal();
        });
    }

    // Form submission
    if (DOM.form) {
        DOM.form.addEventListener('submit', handleFormSubmit);
    }

    // Theme toggle is handled by ThemeManager.init()
    // No need to add another event listener here

    // Clear Board Confirmation
    const clearBoardModal = document.getElementById('clearBoardModal');
    const confirmClearBtn = document.getElementById('confirmClearBoard');
    const cancelClearBtn = document.getElementById('cancelClearBoard');

    function showClearBoardConfirmation() {
        clearBoardModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function hideClearBoardConfirmation() {
        clearBoardModal.style.display = 'none';
        document.body.style.overflow = '';
    }

    function clearBoard() {
        // Store the current tasks for potential undo
        const previousTasks = [...state.tasks];

        // Clear the board
        state.tasks = [];
        // saveState(); // DISABLED - Using Firebase
        renderBoard();
        hideClearBoardConfirmation();

        // Show toast with undo option
        showToast(
            'Board cleared',
            'error',
            5000,
            () => {
                // Undo clear action
                state.tasks = previousTasks;
                // saveState(); // DISABLED - Using Firebase
                renderBoard();
                showToast('Board restored', 'success');
            }
        );
    }

    // Clear Board Button
    if (DOM.clearBtn) {
        DOM.clearBtn.addEventListener('click', showClearBoardConfirmation);
    }

    if (confirmClearBtn && cancelClearBtn) {
        confirmClearBtn.addEventListener('click', clearBoard);
        cancelClearBtn.addEventListener('click', hideClearBoardConfirmation);
    }

    // Close modal when clicking outside
    if (clearBoardModal) {
        clearBoardModal.addEventListener('click', (e) => {
            if (e.target === clearBoardModal) {
                hideClearBoardConfirmation();
            }
        });
    }

    // Keyboard
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            hideDeleteConfirmation();
            hideClearBoardConfirmation();
        }
    });
}

// --- Modal Management ---
function openModal(taskId = null, status = 'todo') {
    document.getElementById('modalTitle').innerText = taskId ? 'Edit Task' : 'Create New Task';

    // Reset form
    const form = document.getElementById('taskForm');
    form.reset();
    form.dataset.id = taskId || '';

    // Set status
    document.getElementById('taskStatus').value = status;

    // If editing, populate form with task data
    if (taskId) {
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            document.getElementById('taskTitle').value = task.title || '';
            document.getElementById('taskDesc').value = task.description || '';
            document.getElementById('taskPriority').value = task.priority || 'medium';
            document.getElementById('taskDueDate').value = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';

            // Populate subtasks
            const subtasksContainer = document.getElementById('subtasksContainer');
            subtasksContainer.innerHTML = '';
            if (task.subtasks && task.subtasks.length > 0) {
                task.subtasks.forEach((subtask, index) => {
                    const subtaskEl = createSubtaskElement(subtask, index);
                    subtasksContainer.appendChild(subtaskEl);
                });
            }
        }
    } else {
        // Clear subtasks for new task
        document.getElementById('subtasksContainer').innerHTML = '';
    }

    // Show modal
    DOM.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Focus first input
    document.getElementById('taskTitle').focus();
}

function closeModal() {
    DOM.modal.style.display = 'none';
    document.body.style.overflow = '';
}

function handleFormSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const id = form.dataset.id || Date.now().toString();
    const title = form.elements['title'].value.trim();
    const description = form.elements['description'].value.trim();
    const priority = form.elements['priority'].value;
    const status = form.elements['status'].value;
    const dueDate = form.elements['dueDate'].value;

    // Get current subtasks from UI
    const currentSubtasks = getSubtasksFromUI();
    
    // Find existing task or create new one
    const existingTask = state.tasks.find(t => t.id === id);
    const taskData = {
        id,
        title: title || 'Untitled Task',
        description: description || '',
        priority,
        status,
        dueDate: dueDate ? new Date(dueDate).getTime() : null,
        pinned: existingTask?.pinned || false,
        subtasks: currentSubtasks.length > 0 ? currentSubtasks : (existingTask?.subtasks || []),
        files: existingTask?.files || [],
        updatedAt: Date.now()
    };

    if (existingTask) {
        // Update existing task
        Object.assign(existingTask, taskData);
        showToast('Task updated', 'success');
    } else {
        // Add new task
        taskData.createdAt = Date.now();
        state.tasks.push(taskData);
        showToast('Task created', 'success');
        
        // Save to Firebase
        saveTaskToFirebase(title, status, dueDate, description, priority);
    }

    // saveState(); // DISABLED - Using Firebase
    renderBoard();
    closeModal();
}

// --- Inline Editing ---
function setupInlineEditing(card, task) {
    const titleElement = card.querySelector('.card-title');
    const titleText = titleElement.querySelector('.card-title-text');
    const titleInput = titleElement.querySelector('.card-title-edit');

    // Double click to edit
    titleElement.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        startEditing();
    });

    // Handle Enter key to start editing
    titleElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            startEditing();
        }
    });

    function startEditing() {
        // Show input and hide text
        titleText.style.display = 'none';
        titleInput.style.display = 'block';
        titleInput.focus();
        titleInput.select();

        // Select all text in the input
        titleInput.setSelectionRange(0, titleInput.value.length);
    }

    function saveEdit() {
        const newTitle = titleInput.value.trim();
        if (newTitle && newTitle !== task.title) {
            task.title = newTitle;
            titleText.textContent = newTitle || '/';
            // saveState(); // DISABLED - Using Firebase
            showToast('Task updated', 'success');
        }

        // Reset UI
        titleText.style.display = 'block';
        titleInput.style.display = 'none';
    }

    // Handle Enter/ESC keys in input
    titleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            // Reset to original value
            titleInput.value = task.title || '';
            titleText.style.display = 'block';
            titleInput.style.display = 'none';
        }
    });

    // Save on blur
    titleInput.addEventListener('blur', () => {
        // Use setTimeout to let click events process first
        setTimeout(saveEdit, 200);
    });
}

// --- Subtasks Management ---
function createSubtaskElement(subtask, index) {
    const subtaskEl = document.createElement('div');
    subtaskEl.className = 'subtask';
    subtaskEl.dataset.index = index;

    subtaskEl.innerHTML = `
        <label class="subtask-label">
            <input type="checkbox" ${subtask.completed ? 'checked' : ''}>
            <span class="checkmark"></span>
            <span class="subtask-text">${sanitize(subtask.text)}</span>
        </label>
        <button class="icon-btn delete-subtask" title="Delete subtask">
            <i class="fas fa-times"></i>
        </button>
    `;

    return subtaskEl;
}

function addSubtask(text, completed = false) {
    const subtasksContainer = document.getElementById('subtasksContainer');
    const subtask = { text, completed };
    const subtaskEl = createSubtaskElement(subtask, subtasksContainer.children.length);
    subtasksContainer.appendChild(subtaskEl);

    // Clear input and focus it
    const input = document.getElementById('newSubtaskInput');
    input.value = '';
    input.focus();
}

function getSubtasksFromUI() {
    const subtasks = [];
    const subtaskElements = document.querySelectorAll('#subtasksContainer .subtask');

    subtaskElements.forEach(el => {
        const textEl = el.querySelector('.subtask-text');
        const checkbox = el.querySelector('input[type="checkbox"]');
        if (textEl && checkbox) {
            subtasks.push({
                text: textEl.textContent,
                completed: checkbox.checked
            });
        }
    });

    return subtasks;
}

// --- Task Deletion ---
let taskToDelete = null;

function showDeleteConfirmation(id) {
    taskToDelete = id;
    const modal = document.getElementById('deleteConfirmModal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function hideDeleteConfirmation() {
    const modal = document.getElementById('deleteConfirmModal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
    taskToDelete = null;
}

// Toggle task pinned status
function togglePin(id) {
    const task = state.tasks.find(t => t.id === id);
    if (task) {
        task.pinned = !task.pinned;
        // saveState(); // DISABLED - Using Firebase
        renderBoard();
        showToast(task.pinned ? 'Task pinned' : 'Task unpinned', 'success');
    }
}

function duplicateTask(id) {
    const taskToDuplicate = state.tasks.find(task => task.id === id);
    if (!taskToDuplicate) return;

    // Create a deep copy of the task
    const newTask = JSON.parse(JSON.stringify(taskToDuplicate));

    // Generate a new ID and update timestamps
    newTask.id = Date.now().toString();
    newTask.createdAt = Date.now();
    newTask.updatedAt = Date.now();

    // Add " (Copy)" to the title if it doesn't already have it
    if (!newTask.title.includes(' (Copy)')) {
        newTask.title = `${newTask.title} (Copy)`;
    }

    // Add the new task to the beginning of the tasks array
    state.tasks.unshift(newTask);
    // saveState(); // DISABLED - Using Firebase
    renderBoard();

    // Show success toast
    showToast('Task duplicated', 'success');
}

function deleteTask(id) {
    const taskToDelete = state.tasks.find(task => task.id === id);
    if (!taskToDelete) return;

    // Store the deleted task for potential undo
    state.lastDeletedTask = { ...taskToDelete, deletedAt: Date.now() };

    // Remove the task
    state.tasks = state.tasks.filter(task => task.id !== id);
    // saveState(); // DISABLED - Using Firebase
    renderBoard();
    hideDeleteConfirmation();

    // Show toast with undo option
    showToast(
        'Task deleted',
        'error',
        5000,
        () => {
            // Undo delete action
            if (state.lastDeletedTask) {
                // Remove the deletedAt property before adding back
                const { deletedAt, ...task } = state.lastDeletedTask;
                state.tasks.push(task);
                // saveState(); // DISABLED - Using Firebase
                renderBoard();
                showToast('Task restored', 'success');
                state.lastDeletedTask = null;
            }
        }
    );
}

// Export Function
function exportBoard() {
    const data = {
        version: '1.0',
        tasks: state.tasks,
        theme: state.theme,
        exportedAt: new Date().toISOString()
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportName = `yourskanban-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportName);
    linkElement.click();

    showNotification('Board exported successfully!', 'success');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    // Add icon based on type
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';

    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(notification);

    // Add show class after a small delay to trigger the animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Remove notification after 3 seconds
    const duration = type === 'error' ? 5000 : 3000; // Show errors longer
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, duration);
}

// --- Utility Functions ---
function sanitize(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
}

// Keyboard Shortcuts
function handleKeyboardShortcuts(e) {
    // Don't trigger if typing in an input or textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
    }

    // Close modal with Escape
    if (e.key === 'Escape') {
        if (document.getElementById('modalOverlay').style.display === 'flex') {
            closeModal();
        } else if (document.getElementById('deleteConfirmModal').style.display === 'flex') {
            hideDeleteConfirmation();
        } else if (document.getElementById('keyboardShortcutsModal').style.display === 'flex') {
            document.getElementById('keyboardShortcutsModal').style.display = 'none';
        }
        return;
    }

    // Only process single key shortcuts when not in an input field
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable) {
        return;
    }

    // Show keyboard shortcuts help with ?
    if (e.key === '?') {
        e.preventDefault();
        const modal = document.getElementById('keyboardShortcutsModal');
        if (modal) {
            modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
        }
        return;
    }

    // Focus search with /
    if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.focus();
        }
        return;
    }

    // New task with N
    if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        const addButtons = document.querySelectorAll('.add-task-btn');
        if (addButtons.length > 0) {
            addButtons[0].click(); // Click the first "Add Task" button
        }
        return;
    }

    // Toggle theme with T
    if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        ThemeManager.toggleTheme();
        return;
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the application first
    init();
    
    // Set up delete confirmation
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => {
            if (taskToDelete) {
                deleteTask(taskToDelete);
                hideDeleteConfirmation();
            }
        });
    }

    // Set up cancel delete button
    const cancelDeleteBtn = document.getElementById('cancelDelete');
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', hideDeleteConfirmation);
    }
    document.getElementById('addSubtaskBtn')?.addEventListener('click', () => {
        const input = document.getElementById('newSubtaskInput');
        if (input.value.trim()) {
            addSubtask(input.value.trim());
        }
    });

    document.getElementById('newSubtaskInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const input = document.getElementById('newSubtaskInput');
            if (input.value.trim()) {
                addSubtask(input.value.trim());
            }
        }
    });

    document.getElementById('subtasksContainer')?.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-subtask');
        if (deleteBtn) {
            const subtaskEl = deleteBtn.closest('.subtask');
            if (subtaskEl) {
                subtaskEl.remove();
            }
        }
    });
});
