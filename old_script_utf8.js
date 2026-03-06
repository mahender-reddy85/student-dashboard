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
// Global variables from index.html
let currentUserId = window.currentUserId || null;
let db = window.db || null;
let writeBatch = window.writeBatch || null;
let Timestamp = window.Timestamp || null;

// Flag to prevent reloading during clear/undo operations
let isClearingOrUndoing = false;

// Function to update global variables when Firebase auth is ready
function updateGlobalVariables() {
    if (window.currentUserId !== undefined) {
        currentUserId = window.currentUserId;
    }
    if (window.db !== undefined) {
        db = window.db;
    }
    if (window.writeBatch !== undefined) {
        writeBatch = window.writeBatch;
    }
    if (window.Timestamp !== undefined) {
        Timestamp = window.Timestamp;
    }
}

// Check for updates periodically
setInterval(updateGlobalVariables, 100);

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

    let icon = 'Γä╣∩╕Å';
    switch (type) {
        case 'success':
            icon = 'Γ£à';
            break;
        case 'error':
            icon = 'Γ¥î';
            break;
        case 'warning':
            icon = 'ΓÜá∩╕Å';
            break;
    }

    toast.innerHTML = `
        <span class="toast-message">${icon} ${message}</span>
        ${undoAction ? `<button class="toast-undo" id="${toastId}-undo">Undo</button>` : ''}
        <button class="toast-close" id="${toastId}-close">&times;</button>
    `;

    container.appendChild(toast);

    // Trigger reflow to enable the show animation
    if (toast) {
        setTimeout(() => toast.classList.add('show'), 10);
    }

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
            undoBtn.onclick = async (e) => {
                e.stopPropagation();
                await undoAction();
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

// Database Functions
async function saveTaskToDatabase(title, status, dueDate, description = '', priority = 'medium', subtasks = [], isChecklist = false) {
    try {
        // Check if user is using skip auth
        if (currentUserId === 'skip-auth-user') {
            // Use localStorage for skip auth users
            const tasks = JSON.parse(localStorage.getItem('skip-auth-tasks') || '[]');
            const newTask = {
                id: Date.now().toString(),
                title: title,
                description: description,
                status: status,
                priority: priority,
                pinned: false,
                order: 0,
                dueDate: dueDate,
                createdAt: new Date().getTime(),
                updatedAt: new Date().getTime(),
                userId: currentUserId,
                subtasks: subtasks,
                isChecklist: isChecklist
            };
            tasks.push(newTask);
            localStorage.setItem('skip-auth-tasks', JSON.stringify(tasks));
            return { id: newTask.id };
        }

        // Check if currentUserId is valid before accessing Firestore
        if (!currentUserId || currentUserId === null || currentUserId === undefined) {
            console.warn('No valid currentUserId found, cannot save to database');
            return null;
        }

        // Convert dueDate to Firestore Timestamp if provided
        const dueDateTimestamp = dueDate ? Timestamp.fromDate(new Date(dueDate)) : null;

        const docRef = await addDoc(collection(db, "users", currentUserId, "tasks"), {
            title: title,
            description: description,
            status: status,
            priority: priority,
            pinned: false,
            order: 0,
            dueDate: dueDateTimestamp,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            userId: currentUserId,
            subtasks: subtasks,
            isChecklist: isChecklist
        });

        // Return the document reference with the generated ID
        return docRef;
    } catch (error) {
        console.error("Database save error:", error);
        return null;
    }
}

async function updateTaskInDatabase(taskId, taskData) {
    try {
        // Check if user is using skip auth
        if (currentUserId === 'skip-auth-user') {
            // Use localStorage for skip auth users
            const tasks = JSON.parse(localStorage.getItem('skip-auth-tasks') || '[]');
            const taskIndex = tasks.findIndex(task => task.id === taskId);
            if (taskIndex !== -1) {
                tasks[taskIndex] = {
                    ...tasks[taskIndex],
                    ...taskData,
                    updatedAt: new Date().getTime()
                };
                localStorage.setItem('skip-auth-tasks', JSON.stringify(tasks));
            }
            return;
        }

        // Check if currentUserId is valid before accessing Firestore
        if (!currentUserId || currentUserId === null || currentUserId === undefined) {
            console.warn('No valid currentUserId found, cannot update database');
            return;
        }

        // Convert dueDate to Firestore Timestamp if provided
        const updateData = { ...taskData };
        if (updateData.dueDate) {
            updateData.dueDate = Timestamp.fromDate(new Date(updateData.dueDate));
        }

        const taskRef = doc(db, "users", currentUserId, "tasks", taskId);

        // First check if document exists
        const taskDoc = await getDoc(taskRef);
        if (!taskDoc.exists()) {
            console.warn(`Task ${taskId} not found in database, creating new document`);
            // If document doesn't exist, create it instead
            await setDoc(taskRef, {
                title: updateData.title || '',
                description: updateData.description || null,
                status: updateData.status || 'todo',
                priority: updateData.priority || 'medium',
                pinned: updateData.pinned || false,
                order: updateData.order || 0,
                dueDate: updateData.dueDate || null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                userId: currentUserId,
                subtasks: updateData.subtasks || []
            });
        } else {
            // Document exists, update it
            await updateDoc(taskRef, {
                ...updateData,
                updatedAt: serverTimestamp()
            });
        }
    } catch (error) {
        console.error("Database update error:", error);
        showToast('Failed to update task', 'error');
    }
}

async function deleteTaskFromDatabase(taskId) {
    try {
        // Check if user is using skip auth
        if (currentUserId === 'skip-auth-user') {
            // Use localStorage for skip auth users
            const tasks = JSON.parse(localStorage.getItem('skip-auth-tasks') || '[]');
            const filteredTasks = tasks.filter(task => task.id !== taskId);
            localStorage.setItem('skip-auth-tasks', JSON.stringify(filteredTasks));
            return;
        }

        // Check if currentUserId is valid before accessing Firestore
        if (!currentUserId || currentUserId === null || currentUserId === undefined) {
            console.warn('No valid currentUserId found, cannot delete from database');
            return;
        }

        const taskRef = doc(db, "users", currentUserId, "tasks", taskId);
        await deleteDoc(taskRef);
    } catch (error) {
        console.error("Database delete error:", error);
    }
}

async function loadTasksFromDatabase() {
    try {
        // Update global variables first
        updateGlobalVariables();

        // Skip loading if we're in the middle of clear/undo operations
        if (isClearingOrUndoing) {
            return;
        }

        // Wait a bit for Firebase auth to complete
        if (!currentUserId || currentUserId === null || currentUserId === undefined) {
            setTimeout(loadTasksFromDatabase, 100);
            return;
        }

        // Check if user is using skip auth
        if (currentUserId === 'skip-auth-user') {
            // Use localStorage for skip auth users
            const tasks = JSON.parse(localStorage.getItem('skip-auth-tasks') || '[]');
            state.tasks = tasks;
            renderBoard();
            return;
        }

        // Clear existing tasks to avoid duplicates
        state.tasks = [];

        const querySnapshot = await getDocs(collection(db, "users", currentUserId, "tasks"));
        querySnapshot.forEach((doc) => {
            const data = doc.data();

            // Handle Firestore Timestamps properly
            const getTimestampValue = (timestamp) => {
                if (!timestamp) return null;
                if (typeof timestamp.toDate === 'function') {
                    return timestamp.toDate().getTime();
                }
                if (typeof timestamp === 'number') {
                    return timestamp;
                }
                if (typeof timestamp === 'string') {
                    return new Date(timestamp).getTime();
                }
                return new Date(timestamp).getTime();
            };

            // Create task object with all fields from database
            const task = {
                id: doc.id, // Use actual Firestore document ID
                title: data.title,
                status: data.status,
                dueDate: getTimestampValue(data.dueDate),
                createdAt: getTimestampValue(data.createdAt),
                updatedAt: getTimestampValue(data.updatedAt),
                description: data.description || '',
                priority: data.priority || 'medium',
                pinned: data.pinned || false,
                userId: data.userId || currentUserId,
                subtasks: data.subtasks || [],
                order: data.order || 0
            };

            // Add to state
            state.tasks.push(task);
        });

        // Render board with loaded tasks
        renderBoard();
    } catch (error) {
        console.error("Database load error:", error);
    }
}

// Load tasks function for auth state change
window.loadTasks = function () {
    loadTasksFromDatabase();
};

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

        // Clear local state to load fresh from database
        state.tasks = [];

        // Initialize the rest of the application
        renderBoard();
        setupEventListeners();

        // Add loaded class to body for CSS transitions
        document.body.classList.add('loaded');

        // Show welcome message
        showToast('Welcome to your dashboard!', 'success');

        // Note: Tasks will be loaded by auth state change in index.html
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize the application', 'error');
    }
}

// Saves the current application state to localStorage (DISABLED - Using database instead)
function saveState() {
    try {
        // DISABLED: Using Database for persistence now
        // const stateToSave = {
        //     tasks: state.tasks,
        //     lastDeletedTask: state.lastDeletedTask
        // };
        // localStorage.setItem('kanbanflow_state', JSON.stringify(stateToSave));
        console.log('State save skipped - using database');
    } catch (error) {
        console.error('Failed to save state:', error);
        showToast('Failed to save board state', 'error');
    }
}

// Loads the application state from localStorage (DISABLED - Using Database instead)
function loadState() {
    try {
        // DISABLED: Using Database for persistence now
        // const savedState = localStorage.getItem('kanbanflow_state');
        // if (savedState) {
        //     const parsedState = JSON.parse(savedState);
        //     state.tasks = parsedState.tasks || [];
        //     state.lastDeletedTask = parsedState.lastDeletedTask || null;
        // }
        console.log('State load skipped - using database');
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
        const currentTheme = document.documentElement.getAttribute(THEME_ATTR);
        const newTheme = currentTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
        setTheme(newTheme, true);
    }

    /**
     * Set the current theme
     * @param {string} theme - Theme to set ('light' or 'dark')
     * @param {boolean} savePreference - Whether to save the preference
     */
    function setTheme(theme, savePreference = true) {

        if (!Object.values(THEMES).includes(theme)) {
            console.warn(`Invalid theme: ${theme}. Defaulting to light.`);
        }

        // Update the DOM
        document.documentElement.setAttribute(THEME_ATTR, theme);

        // Save preference if requested
        if (savePreference) {
            try {
                localStorage.setItem(STORAGE_KEY, theme);
            } catch (error) {
                console.error('Failed to save theme preference:', error);
            }
        }

        // Update UI
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

// --- UI Rendering ---
function compareTasksByDueDate(a, b, order) {
    if (order === 'none') return 0;

    // Handle Firestore Timestamp objects and regular dates
    const getDateValue = (date) => {
        if (!date) return new Date(0);

        // If it's a Firestore Timestamp (has toDate method)
        if (date && typeof date.toDate === 'function') {
            return date.toDate();
        }

        // If it's a number (milliseconds)
        if (typeof date === 'number') {
            return new Date(date);
        }

        // If it's a string date
        if (typeof date === 'string') {
            return new Date(date);
        }

        // Default: treat as date object
        return new Date(date);
    };

    const dateA = getDateValue(a.dueDate);
    const dateB = getDateValue(b.dueDate);

    // If both tasks don't have due dates, maintain their order
    if (!a.dueDate && !b.dueDate) return 0;
    // Tasks without due dates go to the end when sorting in ascending order, or to the start when descending
    if (!a.dueDate) return order === 'asc' ? 1 : -1;
    if (!b.dueDate) return order === 'asc' ? -1 : 1;

    // Sort by date
    return order === 'asc' ? dateA - dateB : dateB - dateA;
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

// --- Drag and Drop ---
let isDragging = false;

function attachDragEvents() {
    const cards = document.querySelectorAll('.task-card');
    const dropzones = document.querySelectorAll('.task-list');

    cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            isDragging = true;
            e.dataTransfer.setData('text/plain', card.dataset.id);
            setTimeout(() => {
                card.classList.add('dragging');
            }, 0);
        });

        card.addEventListener('dragend', () => {
            isDragging = false;
            card.classList.remove('dragging');
            // Add small delay to prevent race condition with drag operations
            setTimeout(() => {
                renderBoard(); // Cleanup and persist
            }, 50);
        });
    });

    dropzones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            // Prevent dragover if drag operation has ended
            if (!isDragging) return;

            e.preventDefault();
            const afterElement = getDragAfterElement(zone, e.clientY);
            const card = document.querySelector('.dragging');

            // Validate that card is a valid DOM element
            if (!card || !(card instanceof HTMLElement)) return;

            // Validate that afterElement is null or a valid DOM element
            if (afterElement && !(afterElement instanceof HTMLElement)) return;

            try {
                if (afterElement) {
                    zone.insertBefore(card, afterElement);
                } else {
                    zone.appendChild(card);
                }
            } catch (error) {
                console.error('Drag and drop error:', error);
                // Fallback: don't move element
            }
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!isDragging) return;

            const card = document.querySelector('.dragging');
            if (!card) return;

            const newStatus = zone.dataset.status;
            const taskId = card.dataset.id;

            // Update task status in local state
            const task = state.tasks.find(t => t.id === taskId);
            if (task) {
                task.status = newStatus;
                // Update in database
                updateTaskInDatabase(taskId, { status: newStatus, userId: currentUserId });
                showToast(`Task moved to ${newStatus}`, 'success');
            }

            isDragging = false;
            card.classList.remove('dragging');
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

        // Apply sorting - order first, then pinned tasks, then by due date if enabled
        columnTasks.sort((a, b) => {
            // First, sort by order (if available)
            const aOrder = a.order !== undefined ? a.order : 999;
            const bOrder = b.order !== undefined ? b.order : 999;
            if (aOrder !== bOrder) return aOrder - bOrder;

            // Pinned tasks first
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;

            // If sort order is enabled, sort by due date
            if (state.sortOrder !== 'none') {
                return compareTasksByDueDate(a, b, state.sortOrder);
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
                <div class="column-actions">
                    <button class="add-checklist-btn" data-status="${col.id}" title="Add checklist item">
                        <i class="fas fa-check-square"></i>
                    </button>
                    <button class="add-task-btn" data-status="${col.id}" title="Add task">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            </div>
            <div class="task-list" data-status="${col.id}">
                ${columnTasks.length === 0 ? '<div class="empty-state">No tasks here</div>' : ''}
            </div>
        `;

        if (columnTasks.length > 0) {
            const listEl = colEl.querySelector('.task-list');
            columnTasks.forEach(task => {
                const taskCard = createTaskCard(task);
                if (taskCard) {
                    listEl.appendChild(taskCard);
                }
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
    const isChecklist = task.isChecklist || false;
    card.className = `task-card ${task.pinned ? 'pinned' : ''} ${isChecklist ? 'checklist-item' : ''}`;
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

    // Set up inline editing after card is created (only for non-checklist items)
    if (!isChecklist) {
        setTimeout(() => {
            setupInlineEditing(card, task);
        }, 0);
    }

    // Format due date
    let dueDateText = '';
    if (task.dueDate) {
        const date = new Date(task.dueDate);
        dueDateText = `ΓÇó Due ${date.toLocaleDateString()}`;
    }

    // Calculate progress for subtasks (only for non-checklist items)
    let progressHTML = '';
    if (!isChecklist && task.subtasks && task.subtasks.length > 0) {
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
                            ${subtask.completed ? 'Γ£ô' : ''}
                        </span>
                        <span class="subtask-text ${subtask.completed ? 'completed' : ''}">
                            ${sanitize(subtask.text)}
                        </span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    if (isChecklist) {
        // Checklist item with checkbox
        card.innerHTML = `
            <div class="checklist-content">
                <label class="checklist-label">
                    <input type="checkbox" class="checklist-checkbox" ${task.completed ? 'checked' : ''} 
                           onchange="toggleChecklistItem('${task.id}', this.checked)">
                    <span class="checklist-mark"></span>
                    <span class="checklist-text ${task.completed ? 'completed' : ''}">${sanitize(task.title)}</span>
                </label>
                <div class="card-actions">
                    <button class="icon-btn delete-btn" data-id="${task.id}" title="Delete">
                        <i class="fas fa-trash" style="color: #94a3b8; font-size: 13px;"></i>
                    </button>
                </div>
            </div>
        `;
    } else {
        // Regular task card
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
    }

    // Set up inline editing after card is created (only for non-checklist items)
    if (!isChecklist) {
        setupInlineEditing(card, task);
    }

    return card;
}

// --- Keyboard Shortcuts ---
function handleKeyboardShortcuts(e) {
    // Don't trigger if typing in an input or textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
    }

    // Close modal with Escape
    if (e.key === 'Escape') {
        if (document.getElementById('modalOverlay') && document.getElementById('modalOverlay').style.display === 'flex') {
            closeModal();
        } else if (document.getElementById('deleteConfirmModal') && document.getElementById('deleteConfirmModal').style.display === 'flex') {
            hideDeleteConfirmation();
        } else if (document.getElementById('keyboardShortcutsModal') && document.getElementById('keyboardShortcutsModal').style.display === 'flex') {
            document.getElementById('keyboardShortcutsModal').style.display = 'none';
        }
        return;
    }

    // Only process single key shortcuts when not in an input field
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable)) {
        return;
    }

    // Show keyboard shortcuts help with ?
    if (e.key === '?') {
        const modal = document.getElementById('keyboardShortcutsModal');
        if (modal) {
            e.preventDefault();
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

// --- Event Handlers ---
function setupEventListeners() {
    // Prevent default drag behaviors
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Add keyboard event listener
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Sort button
    document.getElementById('sortByDate')?.addEventListener('click', toggleSortOrder);

    // Add/Edit Task delegators
    DOM.board.addEventListener('click', async (e) => {
        const addBtn = e.target.closest('.add-task-btn');
        if (addBtn) openModal(null, addBtn.dataset.status);

        const checklistBtn = e.target.closest('.add-checklist-btn');
        if (checklistBtn) createChecklistItem(checklistBtn.dataset.status);

        const editBtn = e.target.closest('.edit-btn');
        if (editBtn) openModal(editBtn.dataset.id);

        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) showDeleteConfirmation(deleteBtn.dataset.id);

        const duplicateBtn = e.target.closest('.duplicate-btn');
        if (duplicateBtn) await duplicateTask(duplicateBtn.dataset.id);

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

    async function clearBoard() {
        // Set flag to prevent reloading during clear operation
        isClearingOrUndoing = true;

        // Store current tasks for potential undo
        const previousTasks = [...state.tasks];

        // Clear board
        state.tasks = [];

        // Clear database for skip auth users
        if (currentUserId === 'skip-auth-user') {
            localStorage.removeItem('skip-auth-tasks');
        } else {
            // For authenticated users, delete all tasks from Firestore using batch
            try {
                const batch = writeBatch(db);
                const querySnapshot = await getDocs(collection(db, "users", currentUserId, "tasks"));

                querySnapshot.forEach((doc) => {
                    batch.delete(doc.ref);
                });

                await batch.commit();
            } catch (error) {
                console.error("Error clearing tasks from Firestore:", error);
                showToast('Failed to clear all tasks from database', 'error');
                // Restore tasks on error
                state.tasks = previousTasks;
                isClearingOrUndoing = false;
                return;
            }
        }

        renderBoard();
        hideClearBoardConfirmation();

        // Show toast with undo option
        showToast(
            'Board cleared',
            'error',
            5000,
            async () => {
                // Set flag to prevent reloading during undo operation
                isClearingOrUndoing = true;

                // Undo clear action
                state.tasks = previousTasks;

                // Restore database for skip auth users
                if (currentUserId === 'skip-auth-user') {
                    localStorage.setItem('skip-auth-tasks', JSON.stringify(previousTasks));
                } else {
                    // For authenticated users, restore all tasks to Firestore
                    try {
                        const batch = writeBatch(db);

                        previousTasks.forEach((task) => {
                            const docRef = doc(db, "users", currentUserId, "tasks", task.id);
                            batch.set(docRef, {
                                title: task.title,
                                status: task.status,
                                dueDate: task.dueDate ? new Date(task.dueDate) : null,
                                description: task.description || '',
                                priority: task.priority || 'medium',
                                pinned: task.pinned || false,
                                userId: currentUserId,
                                subtasks: task.subtasks || [],
                                createdAt: task.createdAt ? new Date(task.createdAt) : serverTimestamp(),
                                updatedAt: serverTimestamp()
                            });
                        });

                        await batch.commit();
                    } catch (error) {
                        console.error("Error restoring tasks to Firestore:", error);
                        showToast('Failed to restore tasks', 'error');
                    }
                }

                renderBoard();
                showToast('Board restored', 'success');

                // Clear flag after a short delay to allow undo to complete
                setTimeout(() => {
                    isClearingOrUndoing = false;
                }, 500);
            }
        );

        // Clear flag after a short delay
        setTimeout(() => {
            isClearingOrUndoing = false;
        }, 500);
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
} // Added missing closing brace for setupEventListeners function

// --- Checklist Management ---
function createChecklistItem(status) {
    const taskText = prompt('Enter checklist item:');
    if (!taskText || taskText.trim() === '') return;

    const checklistTask = {
        id: Date.now().toString(),
        title: taskText.trim(),
        description: '',
        priority: 'low',
        status: status,
        dueDate: '',
        completed: false,
        isChecklist: true,
        userId: currentUserId,
        subtasks: [],
        createdAt: Date.now()
    };

    // Save to database
    saveTaskToDatabase(
        checklistTask.title,
        checklistTask.status,
        checklistTask.dueDate,
        checklistTask.description,
        checklistTask.priority,
        checklistTask.subtasks,
        checklistTask.isChecklist
    ).then(docRef => {
        if (docRef) {
            checklistTask.id = docRef.id;
            showToast('Checklist item added', 'success');
            renderBoard();
        }
    });
}

function toggleChecklistItem(taskId, isCompleted) {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
        task.completed = isCompleted;

        // Update in database
        updateTaskInDatabase(taskId, {
            completed: isCompleted,
            userId: currentUserId
        });

        // Update visual state
        const card = document.querySelector(`[data-task-id="${taskId}"]`);
        if (card) {
            const textElement = card.querySelector('.checklist-text');
            if (textElement) {
                if (isCompleted) {
                    textElement.classList.add('completed');
                } else {
                    textElement.classList.remove('completed');
                }
            }
        }

        showToast(isCompleted ? 'Checklist item completed' : 'Checklist item unchecked', 'success');
    }
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
                    if (subtaskEl) {
                        subtasksContainer.appendChild(subtaskEl);
                    }
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

async function handleFormSubmit(e) {
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

    // Convert dueDate to timestamp for database
    const dueDateTimestamp = dueDate ? new Date(dueDate).getTime() : null;

    // Find existing task or create new one
    const existingTask = state.tasks.find(t => t.id === id);
    const taskData = {
        id,
        title: title || 'Untitled Task',
        description: description || '',
        priority,
        status,
        dueDate: dueDateTimestamp,
        pinned: existingTask?.pinned || false,
        subtasks: currentSubtasks.length > 0 ? currentSubtasks : (existingTask?.subtasks || []),
        userId: currentUserId,
        updatedAt: Date.now()
    };

    if (existingTask) {
        // Update existing task
        Object.assign(existingTask, taskData);
        // Update in database
        updateTaskInDatabase(id, taskData);
        showToast('Task updated', 'success');
    } else {
        // Add new task
        const docRef = await saveTaskToDatabase(title, status, dueDate, description, priority, currentSubtasks);

        if (docRef) {
            // Update local task with the correct Firestore ID
            taskData.id = docRef.id;
            taskData.createdAt = Date.now(); // Temporary until next refresh
            state.tasks.push(taskData);
            showToast('Task created', 'success');
        } else {
            showToast('Failed to create task', 'error');
        }
    }

    // saveState(); // DISABLED - Using database
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
            // Update in database
            updateTaskInDatabase(task.id, { title: newTitle, userId: currentUserId });
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

    // Add event listener for checkbox changes
    const checkbox = subtaskEl.querySelector('input[type="checkbox"]');
    const deleteBtn = subtaskEl.querySelector('.delete-subtask');

    if (checkbox) {
        checkbox.addEventListener('change', async (e) => {
            const taskId = document.getElementById('taskId')?.value;
            if (taskId) {
                const task = state.tasks.find(t => t.id === taskId);
                if (task && task.subtasks) {
                    task.subtasks[index].completed = e.target.checked;
                    // Update in database with new subtasks array
                    updateTaskInDatabase(taskId, {
                        subtasks: task.subtasks,
                        userId: currentUserId
                    });
                    showToast(e.target.checked ? 'Subtask completed' : 'Subtask unchecked', 'success');
                }
            }
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const taskId = document.getElementById('taskId')?.value;
            if (taskId) {
                const task = state.tasks.find(t => t.id === taskId);
                if (task && task.subtasks) {
                    task.subtasks.splice(index, 1);
                    // Update in database with new subtasks array
                    updateTaskInDatabase(taskId, {
                        subtasks: task.subtasks,
                        userId: currentUserId
                    });
                    // Re-render subtasks in modal
                    const subtasksContainer = document.getElementById('subtasksContainer');
                    subtasksContainer.innerHTML = '';
                    task.subtasks.forEach((subtask, i) => {
                        const subtaskEl = createSubtaskElement(subtask, i);
                        if (subtaskEl) {
                            subtasksContainer.appendChild(subtaskEl);
                        }
                    });
                    showToast('Subtask deleted', 'success');
                }
            }
        });
    }

    return subtaskEl;
}

function addSubtask(text, completed = false) {
    const subtasksContainer = document.getElementById('subtasksContainer');
    const subtask = { text, completed };
    const subtaskEl = createSubtaskElement(subtask, subtasksContainer.children.length);
    if (subtaskEl) {
        subtasksContainer.appendChild(subtaskEl);
    }

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
        // Update in database
        updateTaskInDatabase(id, { pinned: task.pinned, userId: currentUserId });
        renderBoard();
        showToast(task.pinned ? 'Task pinned' : 'Task unpinned', 'success');
    }
}

async function duplicateTask(id) {
    const taskToDuplicate = state.tasks.find(task => task.id === id);
    if (!taskToDuplicate) return;

    // Create a deep copy of task
    const newTask = JSON.parse(JSON.stringify(taskToDuplicate));

    // Generate a new ID and reset timestamps
    newTask.id = Date.now().toString();
    delete newTask.createdAt;
    delete newTask.updatedAt;

    // Add "(Copy)" to title if it doesn't already have it
    if (!newTask.title.includes(' (Copy)')) {
        newTask.title = `${newTask.title} (Copy)`;
    }

    // Remove files array if it exists
    delete newTask.files;

    // Add new task to beginning of tasks array
    state.tasks.unshift(newTask);

    // Save to database and update with correct ID
    const docRef = await saveTaskToDatabase(
        newTask.title,
        newTask.status,
        newTask.dueDate,
        newTask.description,
        newTask.priority,
        newTask.subtasks || []
    );

    if (docRef) {
        // Update local task with the correct Firestore ID
        newTask.id = docRef.id;
        newTask.createdAt = Date.now(); // Temporary until next refresh
    }

    renderBoard();

    // Show success toast
    showToast('Task duplicated', 'success');
}

function deleteTask(id) {
    const taskToDelete = state.tasks.find(task => task.id === id);
    if (!taskToDelete) return;

    state.lastDeletedTask = { ...taskToDelete, deletedAt: Date.now() };

    // Remove task from local state
    state.tasks = state.tasks.filter(task => task.id !== id);

    // Delete from database
    deleteTaskFromDatabase(id);

    renderBoard();
    hideDeleteConfirmation();

    // Show toast with undo option
    showToast(
        'Task deleted',
        'error',
        5000,
        async () => {
            // Undo delete action
            if (state.lastDeletedTask) {
                // Remove the deletedAt property before adding back
                const { deletedAt, ...task } = state.lastDeletedTask;

                try {
                    // Restore to database first
                    const docRef = await saveTaskToDatabase(
                        task.title,
                        task.status,
                        task.dueDate,
                        task.description,
                        task.priority,
                        task.subtasks || []
                    );

                    if (docRef) {
                        // Update local task with the correct Firestore ID
                        task.id = docRef.id;
                        task.createdAt = Date.now(); // Temporary until next refresh
                        state.tasks.push(task);
                        renderBoard();
                        showToast('Task restored', 'success');
                        state.lastDeletedTask = null;
                    } else {
                        showToast('Failed to restore task', 'error');
                    }
                } catch (error) {
                    console.error('Undo restore error:', error);
                    showToast('Failed to restore task', 'error');
                }
            }
        }
    );
}

// --- Utility Functions ---
function sanitize(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
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
