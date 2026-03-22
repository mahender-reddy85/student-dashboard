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
let doc = window.doc || null;
let collection = window.collection || null;
let getDocs = window.getDocs || null;
let addDoc = window.addDoc || null;
let deleteDoc = window.deleteDoc || null;
let updateDoc = window.updateDoc || null;
let getDoc = window.getDoc || null;
let setDoc = window.setDoc || null;
let serverTimestamp = window.serverTimestamp || null;
let writeBatch = window.writeBatch || null;
let Timestamp = window.Timestamp || null;
// Flag to prevent reloading during clear/undo operations
let isClearingOrUndoing = false;
const state = {
    tasks: [],
    theme: (() => {
        try {
            return localStorage.getItem('kanbanflow_theme') || 'light';
        }
        catch (error) {
            console.error('Error accessing localStorage:', error);
            return 'light';
        }
    })(),
    filterQuery: '',
    priorityFilter: 'all',
    sortOrder: 'none',
    lastDeletedTask: null
}
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
    toast.innerHTML = ` <span class="toast-message">${icon} ${message}</span>${undoAction ? `<button class="toast-undo" id="${toastId}-undo">Undo</button>` : ''}
 <button class="toast-close" id="${toastId}-close">×
	</button>`;
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
        }
    }
    // Set up undo button if applicable
    if (undoAction) {
        const undoBtn = document.getElementById(`${toastId}-undo`);
        if (undoBtn) {
            undoBtn.onclick = async (e) => {
                e.stopPropagation();
                await undoAction();
                hideToast(toast);
            }
        }
    }
    // Auto-hide after duration
    const timeoutId = setTimeout(() => {
        hideToast(toast);
    }
        , duration);
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
        }
            , 1000);
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
    }
        , 300);
}
// Database Functions
async function saveTaskToDatabase(title, status, dueDate, description = '', priority = 'medium', subtasks = [], isChecklist = false, completed = false) {
    try {
        if (currentUserId === 'skip-auth-user') {
            const tasks = JSON.parse(localStorage.getItem('skip-auth-tasks') || '[]');
            const columnTasks = tasks.filter(task => task.status === status);
            const newOrder = columnTasks.length;
            const newTask = {
                id: 'local-' + Date.now().toString(),
                title: title,
                description: description,
                status: status,
                priority: priority,
                pinned: false,
                order: newOrder,
                dueDate: dueDate,
                createdAt: new Date().getTime(),
                updatedAt: new Date().getTime(),
                userId: 'anonymous-visitor',
                subtasks: subtasks,
                isChecklist: isChecklist,
                completed: completed
            };
            tasks.push(newTask);
            localStorage.setItem('skip-auth-tasks', JSON.stringify(tasks));
            return { id: newTask.id };
        }
        if (!currentUserId || currentUserId === null || currentUserId === undefined) {
            console.warn('No valid currentUserId found, cannot save to database');
            return null;
        }
        const dueDateTimestamp = dueDate ? Timestamp.fromDate(new Date(dueDate)) : null;
        const columnTasks = state.tasks.filter(task => task.status === status);
        const newOrder = columnTasks.length;
        
        const docRef = await addDoc(collection(db, "users", currentUserId, "tasks"), {
            title: title,
            description: description,
            status: status,
            priority: priority,
            pinned: false,
            order: newOrder,
            dueDate: dueDateTimestamp,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            userId: currentUserId,
            subtasks: subtasks,
            isChecklist: isChecklist,
            completed: completed
        });
        return docRef;
    } catch (error) {
        handleDatabaseError(error, 'save task');
        return null;
    }
}
// Centralized error handling
function handleDatabaseError(error, operation) {
    console.error(`Database ${operation} error:`, error);
    showToast(`Failed to ${operation}. Please try again.`, 'error');
}
async function updateTaskInDatabase(taskId, taskData) {
    try {
        if (currentUserId === 'skip-auth-user') {
            const tasks = JSON.parse(localStorage.getItem('skip-auth-tasks') || '[]');
            const taskIndex = tasks.findIndex(task => task.id === taskId);
            if (taskIndex !== -1) {
                tasks[taskIndex] = { ...tasks[taskIndex], ...taskData, updatedAt: new Date().getTime() };
                localStorage.setItem('skip-auth-tasks', JSON.stringify(tasks));
            }
            return;
        }
        if (!currentUserId || currentUserId === null || currentUserId === undefined) {
            console.warn('No valid currentUserId found, cannot update database');
            return;
        }
        const updateData = { ...taskData };
        if (updateData.dueDate) {
            updateData.dueDate = Timestamp.fromDate(new Date(updateData.dueDate));
        }
        const taskRef = doc(db, "users", currentUserId, "tasks", taskId);
        const taskDoc = await getDoc(taskRef);
        if (!taskDoc.exists()) {
            console.warn(`Task ${taskId} not found in database, creating new document`);
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
            // Prepare clean data for Firestore
            const cleanUpdateData = { ...updateData };
            
            // Remove 'id' if present (it's the document reference, not a field)
            delete cleanUpdateData.id;
            
            // Convert any primitive timestamp numbers back to Firestore Timestamps 
            // for security rule compatibility (rules expect timestamp type)
            if (cleanUpdateData.createdAt && typeof cleanUpdateData.createdAt === 'number') {
                cleanUpdateData.createdAt = Timestamp.fromMillis(cleanUpdateData.createdAt);
            }
            if (cleanUpdateData.dueDate && typeof cleanUpdateData.dueDate === 'number') {
                cleanUpdateData.dueDate = Timestamp.fromMillis(cleanUpdateData.dueDate);
            }

            await updateDoc(taskRef, { ...cleanUpdateData, updatedAt: serverTimestamp() });
        }
    } catch (error) {
        console.error("Database update error:", error);
        showToast('Failed to update task', 'error');
    }
}
async function deleteTaskFromDatabase(taskId) {
    try {
        if (currentUserId === 'skip-auth-user') {
            const tasks = JSON.parse(localStorage.getItem('skip-auth-tasks') || '[]');
            const filteredTasks = tasks.filter(task => task.id !== taskId);
            localStorage.setItem('skip-auth-tasks', JSON.stringify(filteredTasks));
            return;
        }
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
        if (isClearingOrUndoing) return;
        // Try to get values from window if they aren't initialized
        // Ensure we have latest Firebase references
        currentUserId = window.currentUserId;
        db = window.db || db;
        doc = window.doc || doc;
        collection = window.collection || collection;
        getDocs = window.getDocs || getDocs;
        addDoc = window.addDoc || addDoc;
        deleteDoc = window.deleteDoc || deleteDoc;
        updateDoc = window.updateDoc || updateDoc;
        getDoc = window.getDoc || getDoc;
        setDoc = window.setDoc || setDoc;
        serverTimestamp = window.serverTimestamp || serverTimestamp;
        writeBatch = window.writeBatch || writeBatch;
        Timestamp = window.Timestamp || Timestamp;
        if (!currentUserId || currentUserId === null || currentUserId === undefined) {
            setTimeout(loadTasksFromDatabase, 500);
            return;
        }
        const parseTaskDoc = (doc, userId) => {
            const data = doc.data();
            const getTimestampValue = (ts) => {
                if (!ts) return null;
                if (typeof ts.toDate === 'function') return ts.toDate().getTime();
                return new Date(ts).getTime();
            };
            return {
                id: doc.id,
                title: data.title || '',
                status: data.status || 'todo',
                dueDate: getTimestampValue(data.dueDate),
                createdAt: getTimestampValue(data.createdAt),
                updatedAt: getTimestampValue(data.updatedAt),
                description: data.description || '',
                priority: data.priority || 'medium',
                pinned: data.pinned || false,
                userId: data.userId || userId,
                subtasks: data.subtasks || [],
                order: data.order || 0,
                isChecklist: data.isChecklist || false,
                completed: data.completed || false
            };
        };
        if (currentUserId === 'skip-auth-user') {
            const localTasks = JSON.parse(localStorage.getItem('skip-auth-tasks') || '[]');
            try {
                // Hierarchical Path: public (Col) -> demo (Doc) -> demoTasks (Sub-Col)
                const publicSnap = await getDocs(collection(db, "public", "demo", "demoTasks"));
                const publicTasks = publicSnap.docs.map(d => parseTaskDoc(d, 'anonymous-visitor'));
                state.tasks = [...publicTasks, ...localTasks];
            } catch (e) {
                console.warn('Failed to load demoTasks from Firestore:', e);
                state.tasks = localTasks;
            }
        } else {
            const querySnapshot = await getDocs(collection(window.db, "users", currentUserId, "tasks"));
            state.tasks = querySnapshot.docs.map(d => parseTaskDoc(d, currentUserId));
        }
        renderBoard();
    } catch (error) {
        console.error("Database load error:", error);
        showToast('Failed to load tasks', 'error');
    }
}
// Load tasks function for auth state change
window.loadTasks = function () {
    loadTasksFromDatabase();
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
}
// Constants
const COLUMNS = [{
    id: 'todo', title: '<i class="fas fa-list-ul"></i> To Do'
}
    ,
{
    id: 'progress', title: '<i class="fas fa-spinner"></i> In Progress'
}
    ,
{
    id: 'done', title: '<i class="fas fa-check-circle"></i> Done'
}
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
    }
    catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize the application', 'error');
    }
}
// --- Theme Management ---
const ThemeManager = (() => {
    const STORAGE_KEY = 'kanbanflow_theme';
    const THEME_ATTR = 'data-theme';
    const THEMES = {
        LIGHT: 'light',
        DARK: 'dark'
    }
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
        }
        catch (error) {
            console.error('Error accessing localStorage:', error);
            return THEMES.LIGHT;
        }
    }
    /**
 * Get system color scheme preference
 * @returns {string} 'dark' or 'light'
 */
    function getSystemPreference() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? THEMES.DARK : THEMES.LIGHT;
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
            }
            catch (error) {
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
    }
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
    }
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
let draggedElement = null;
let dragStartColumn = null;
function attachDragEvents() {
    const cards = document.querySelectorAll('.task-card');
    const dropzones = document.querySelectorAll('.task-list');
    cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            isDragging = true;
            draggedElement = card;
            dragStartColumn = card.closest('.task-list').dataset.status;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', card.dataset.id);
            // Add visual feedback
            setTimeout(() => {
                card.classList.add('dragging');
                // Highlight all drop zones
                dropzones.forEach(zone => {
                    zone.classList.add('drop-zone-active');
                });
            }
                , 0);
        });
        card.addEventListener('dragend', (e) => {
            isDragging = false;
            draggedElement = null;
            dragStartColumn = null;
            // Remove visual feedback
            card.classList.remove('dragging');
            dropzones.forEach(zone => {
                zone.classList.remove('drop-zone-active');
            });
            // Add small delay to prevent race condition with drag operations
            setTimeout(() => {
                renderBoard(); // Cleanup and persist
            }
                , 50);
        });
    });
    dropzones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            // Prevent dragover if drag operation has ended
            if (!isDragging) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const afterElement = getDragAfterElement(zone, e.clientY);
            const card = document.querySelector('.dragging');
            // Validate that card is a valid DOM element
            if (!card || !(card instanceof HTMLElement)) return;
            // Validate that afterElement is null or a valid DOM element
            if (afterElement && !(afterElement instanceof HTMLElement)) return;
            try {
                if (afterElement) {
                    zone.insertBefore(card, afterElement);
                }
                else {
                    zone.appendChild(card);
                }
            }
            catch (error) {
                console.error('Drag and drop error:', error);
                // Fallback: don't move element
            }
        });
        zone.addEventListener('dragleave', (e) => {
            // Only remove highlight if leaving the zone entirely
            if (!zone.contains(e.relatedTarget)) {
                zone.classList.remove('drag-over');
            }
        });
        zone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!isDragging) return;
            const card = document.querySelector('.dragging');
            if (!card) return;
            const newStatus = zone.dataset.status;
            const taskId = card.dataset.id;
            const oldStatus = dragStartColumn;
            // Update task status in local state
            const task = state.tasks.find(t => t.id === taskId);
            if (task) {
                const statusChanged = oldStatus !== newStatus;
                // Update status if changed
                if (statusChanged) {
                    task.status = newStatus;
                }
                // Update order based on current position in the column
                const allCardsInZone = [...zone.querySelectorAll('.task-card')];
                const newPosition = allCardsInZone.findIndex(c => c.dataset.id === taskId);
                // Update order for all tasks in this column
                allCardsInZone.forEach((cardElement, index) => {
                    const cardTaskId = cardElement.dataset.id;
                    const cardTask = state.tasks.find(t => t.id === cardTaskId);
                    if (cardTask) {
                        cardTask.order = index;
                    }
                });
                // Update in database
                const updateData = {
                    order: task.order,
                    userId: currentUserId
                }
                if (statusChanged) {
                    updateData.status = newStatus;
                }
                updateTaskInDatabase(taskId, updateData);
                // Show appropriate message
                if (statusChanged) {
                    const statusNames = {
                        'todo': 'To Do',
                        'progress': 'In Progress',
                        'done': 'Done'
                    }
                    showToast(`Task moved to ${statusNames[newStatus]}`, 'success');
                }
            }
            // Clean up
            zone.classList.remove('drag-over');
            isDragging = false;
            card.classList.remove('dragging');
            dropzones.forEach(dz => {
                dz.classList.remove('drop-zone-active', 'drag-over');
            });
        });
    });
}
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return {
                offset: offset, element: child
            }
        }
        else {
            return closest;
        }
    }
        , {
            offset: Number.NEGATIVE_INFINITY
        }).element;
}
function renderBoard() {
    DOM.board.innerHTML = '';
    COLUMNS.forEach(col => {
        let columnTasks = state.tasks.filter(task => {
            // Filter by status
            if (task.status !== col.id) return false;
            // Filter by search query
            const matchesSearch = state.filterQuery === '' || task.title.toLowerCase().includes(state.filterQuery.toLowerCase()) || (task.description && task.description.toLowerCase().includes(state.filterQuery.toLowerCase()));
            // Filter by priority or checklist
            const matchesPriority = state.priorityFilter === 'all' || (state.priorityFilter === 'checklist' && task.isChecklist) || (state.priorityFilter !== 'checklist' && !task.isChecklist && task.priority && task.priority.toLowerCase() === state.priorityFilter);
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
        colEl.innerHTML = ` <div class="column-header" > <h3 class="column-title" > ${col.title} <span class="task-count" >${columnTasks.length}</span> </h3> <div class="column-actions" > <button class="add-checklist-btn" data-status="${col.id}" title="Add checklist item" > <i class="fas fa-check-square" ></i> </button> <button class="add-task-btn" data-status="${col.id}" title="Add task" > <i class="fas fa-plus" ></i> </button> </div> </div> <div class="task-list" data-status="${col.id}" > ${columnTasks.length === 0 ? '<div class="empty-state">No tasks here</div>' : ''} </div> `;
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
    }
    return icons[ext] || icons['default'];
}
function createTaskCard(task) {
    const card = document.createElement('div');
    const isChecklist = task.isChecklist || false;
    card.className = `task-card ${task.pinned ? 'pinned' : ''} ${isChecklist ? 'checklist-item' : ''}`;
    card.draggable = true;
    card.dataset.id = task.id;
    // Overdue check
    if (task.dueDate && task.status !== 'done') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate < today) {
            card.classList.add('overdue');
        }
    }
    if (isChecklist) {
        card.innerHTML = `
        <div class="checklist-content">
            <label class="checklist-label">
                <input type="checkbox" class="checklist-checkbox"
                    ${task.completed ? 'checked' : ''}
                    onchange="toggleChecklistItem('${task.id}', this.checked)">
                <span class="checklist-mark"></span>
                <span class="checklist-text ${task.completed ? 'completed' : ''}">
                    ${sanitize(task.title)}
                </span>
            </label>
            <div class="card-actions">
                <button class="icon-btn delete-btn" data-id="${task.id}" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        `;
    } else {
        const completed = task.subtasks?.filter(s => s.completed).length || 0;
        const total = task.subtasks?.length || 0;
        const percent = total ? (completed / total) * 100 : 0;
        card.innerHTML = `
        <div class="card-header">
            <div class="card-title" tabindex="0">
                <span class="card-title-text">${sanitize(task.title) || '/'}</span>
                <input type="text" class="card-title-edit"
                       value="${sanitize(task.title) || ''}" style="display:none;">
            </div>
            <div class="card-actions">
                <button class="icon-btn pin-btn ${task.pinned ? 'pinned' : ''}" data-id="${task.id}">
                    <i class="fas fa-thumbtack"></i>
                </button>
                <button class="icon-btn duplicate-btn" data-id="${task.id}">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="icon-btn edit-btn" data-id="${task.id}">
                    <i class="fas fa-pencil-alt"></i>
                </button>
                <button class="icon-btn delete-btn" data-id="${task.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        ${task.description ? `<div class="card-desc">${sanitize(task.description)}</div>` : ''}
        ${total > 0 ? `
        <div class="subtask-progress">
            <div class="progress-bar">
                <div class="progress" style="width:${percent}%"></div>
            </div>
            <div class="progress-text">${completed} of ${total} tasks</div>
        </div>` : ''}
        <div class="card-footer">
            <span class="priority-badge priority-${task.priority || 'medium'}">
                ${(task.priority || 'medium').toUpperCase()}
            </span>
            ${task.dueDate ? `
            <div class="card-date">
                <i class="far fa-calendar-alt"></i>
                ${new Date(task.dueDate).toLocaleDateString()}
            </div>` : ''}
        </div>
        `;
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
        }
        else if (document.getElementById('deleteConfirmModal') && document.getElementById('deleteConfirmModal').style.display === 'flex') {
            hideDeleteConfirmation();
        }
        else if (document.getElementById('keyboardShortcutsModal') && document.getElementById('keyboardShortcutsModal').style.display === 'flex') {
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
        if (editBtn) {
            const taskId = editBtn.dataset.id;
            const task = state.tasks.find(t => t.id === taskId);
            const currentStatus = task ? task.status : 'todo';
            openModal(taskId, currentStatus);
        }
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
        // Handle skip-auth users (Local storage only)
        if (currentUserId === 'skip-auth-user') {
            localStorage.setItem('skip-auth-tasks', '[]');
            renderBoard();
            hideClearBoardConfirmation();
            showToast('Board cleared', 'error');
            isClearingOrUndoing = false;
            return;
        }

        // Handle authenticated users (Firestore)
        try {
            const batch = writeBatch(db);
            const tasksCol = collection(db, "users", currentUserId, "tasks");
            const querySnapshot = await getDocs(tasksCol);
            querySnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }
        catch (error) {
            console.error("Error clearing tasks from Firestore:", error);
            showToast('Failed to clear all tasks from database', 'error');
            // Restore tasks on error
            state.tasks = previousTasks;
            isClearingOrUndoing = false;
            return;
        }
        renderBoard();
        hideClearBoardConfirmation();
        // Show toast with undo option
        showToast('Board cleared',
            'error',
            5000,
            async () => {
                // Set flag to prevent reloading during undo operation
                isClearingOrUndoing = true;
                // Undo clear action
                state.tasks = previousTasks;

                // Handle skip-auth users
                if (currentUserId === 'skip-auth-user') {
                    localStorage.setItem('skip-auth-tasks', JSON.stringify(previousTasks));
                    renderBoard();
                    showToast('Board restored', 'success');
                    isClearingOrUndoing = false;
                    return;
                }

                // Handle authenticated users (Firestore)
                try {
                    const batch = writeBatch(db);
                    previousTasks.forEach((task) => {
                        const taskData = {
                            title: task.title || '',
                            status: task.status || 'todo',
                            description: task.description || '',
                            priority: task.priority || 'medium',
                            pinned: task.pinned || false,
                            userId: currentUserId,
                            subtasks: task.subtasks || [],
                            updatedAt: serverTimestamp()
                        };
                        
                        if (task.dueDate) {
                            taskData.dueDate = Timestamp.fromDate(new Date(task.dueDate));
                        }
                        if (task.createdAt) {
                            taskData.createdAt = Timestamp.fromDate(new Date(task.createdAt));
                        }

                        const docRef = doc(db, "users", currentUserId, "tasks", task.id);
                        batch.set(docRef, taskData);
                    });
                    await batch.commit();
                }
                catch (error) {
                        console.error("Error restoring tasks to Firestore:", error);
                        showToast('Failed to restore tasks', 'error');
                    }
                renderBoard();
                showToast('Board restored', 'success');
                // Clear flag after a short delay to allow undo to complete
                setTimeout(() => {
                    isClearingOrUndoing = false;
                }
                    , 500);
            });
        // Clear flag after a short delay
        setTimeout(() => {
            isClearingOrUndoing = false;
        }
            , 500);
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
// Added missing closing brace for setupEventListeners function
// --- Checklist Management ---
let currentChecklistStatus = 'todo';
let recentlyAddedChecklistItems = [];
window.createChecklistItem = function (status) {
    currentChecklistStatus = status;
    recentlyAddedChecklistItems = []; // Reset for new session
    const modal = document.getElementById('checklistModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        // Reset UI
        document.getElementById('newChecklistInput').value = '';
        document.getElementById('recentlyAddedItems').style.display = 'none';
        document.getElementById('recentItemsList').innerHTML = '';
        document.getElementById('itemsCount').textContent = '0 items added';
        setTimeout(() => {
            document.getElementById('newChecklistInput').focus();
        }
            , 100);
    }
}
window.closeChecklistModal = function () {
    const modal = document.getElementById('checklistModal');
    if (modal) {
        // If there are queued items, save them all before closing
        if (recentlyAddedChecklistItems.length > 0) {
            saveQueuedChecklistItems();
        }
        else {
            // Just close if no items to save
            modal.style.display = 'none';
            document.body.style.overflow = '';
            document.getElementById('newChecklistInput').value = '';
        }
    }
}
async function saveQueuedChecklistItems() {
    if (recentlyAddedChecklistItems.length === 0) return;
    try {
        // Save all queued items to database
        const savePromises = recentlyAddedChecklistItems.map(async (item) => {
            const taskData = item.taskData;
            const docRef = await saveTaskToDatabase(taskData.title,
                taskData.status,
                taskData.dueDate,
                taskData.description,
                taskData.priority,
                taskData.subtasks,
                taskData.isChecklist,
                taskData.completed);
            if (docRef) {
                // Update with real database ID
                taskData.id = docRef.id;
                return taskData;
            }
            return null;
        });
        const results = await Promise.all(savePromises);
        // Add successfully saved tasks to state
        const savedTasks = results.filter(task => task !== null);
        state.tasks.push(...savedTasks);
        // Show success message
        showToast(`${savedTasks.length} checklist item${savedTasks.length !== 1 ? 's' : ''} added`, 'success');
        // Render the board to show the new tasks
        renderBoard();
        // Close modal and reset
        const modal = document.getElementById('checklistModal');
        modal.style.display = 'none';
        document.body.style.overflow = '';
        document.getElementById('newChecklistInput').value = '';
        // Clear the queue
        recentlyAddedChecklistItems = [];
    }
    catch (error) {
        console.error('Error saving checklist items:', error);
        showToast('Failed to save some checklist items', 'error');
    }
}
window.saveChecklistItem = function () {
    const input = document.getElementById('newChecklistInput');
    const taskText = input.value;
    if (!taskText || taskText.trim() === '') return;
    // Create checklist task object but don't add to state or database yet
    const checklistTask = {
        id: Date.now().toString() + Math.random(), // Temporary ID
        title: taskText.trim(),
        description: '',
        priority: 'low',
        status: currentChecklistStatus,
        dueDate: '',
        completed: false,
        isChecklist: true,
        userId: currentUserId,
        subtasks: [],
        createdAt: Date.now()
    }
    // Add to recently added list (for UI display)
    recentlyAddedChecklistItems.push({
        id: checklistTask.id,
        title: checklistTask.title,
        timestamp: new Date().toLocaleTimeString(),
        taskData: checklistTask // Store the full task data
    });
    // Update UI
    updateRecentlyAddedItems();
    showToast('Checklist item queued', 'info');
    // Clear input and focus for next item
    input.value = '';
    input.focus();
}
function updateRecentlyAddedItems() {
    const container = document.getElementById('recentlyAddedItems');
    const list = document.getElementById('recentItemsList');
    const count = document.getElementById('itemsCount');
    if (recentlyAddedChecklistItems.length > 0) {
        container.style.display = 'block';
        // Update list HTML
        list.innerHTML = recentlyAddedChecklistItems.map(item => ` <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; margin-bottom: 4px; background: white; border-radius: 4px; border: 1px solid #e2e8f0;" > <div style="display: flex; align-items: center; flex-grow: 1;" > <i class="fas fa-clock" style="color: #f59e0b; margin-right: 8px; font-size: 12px;" ></i> <span style="font-size: 13px; color: #334155;" >${sanitize(item.title)}</span> </div> <span style="font-size: 11px; color: #94a3b8;" >${item.timestamp}</span> </div> `).join('');
        // Update count
        count.textContent = `${recentlyAddedChecklistItems.length} item${recentlyAddedChecklistItems.length !== 1 ? 's' : ''} added`;
    }
    else {
        container.style.display = 'none';
        count.textContent = '0 items added';
    }
}
window.clearRecentItems = function () {
    recentlyAddedChecklistItems = [];
    updateRecentlyAddedItems();
    showToast('Queued items cleared', 'info');
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
                }
                else {
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
            // Preserve the current status when editing
            document.getElementById('taskStatus').value = task.status || status;
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
    }
    else {
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
    }
    if (existingTask) {
        // Update existing task
        Object.assign(existingTask, taskData);
        // Update in database
        updateTaskInDatabase(id, taskData);
        showToast('Task updated', 'success');
    }
    else {
        // Add new task
        const docRef = await saveTaskToDatabase(title, status, dueDate, description, priority, currentSubtasks);
        if (docRef) {
            // Update local task with the correct Firestore ID
            taskData.id = docRef.id;
            taskData.createdAt = Date.now(); // Temporary until next refresh
            state.tasks.push(taskData);
            showToast('Task created', 'success');
        }
        else {
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
            updateTaskInDatabase(task.id, {
                title: newTitle, userId: currentUserId
            });
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
        }
        else if (e.key === 'Escape') {
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
    subtaskEl.innerHTML = ` <label class="subtask-label"><input type="checkbox"${subtask.completed ? 'checked' : ''}><span class="checkmark"></span><span class="subtask-text">${sanitize(subtask.text)}</span></label><button class="icon-btn delete-subtask" title="Delete subtask"><i class="fas fa-times"></i></button>`;
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
    const subtask = {
        text,
        completed
    }
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
        updateTaskInDatabase(id, {
            pinned: task.pinned, userId: currentUserId
        });
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
    const docRef = await saveTaskToDatabase(newTask.title,
        newTask.status,
        newTask.dueDate,
        newTask.description,
        newTask.priority,
        newTask.subtasks || [],
        newTask.isChecklist,
        newTask.completed);
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
    state.lastDeletedTask = {
        ...taskToDelete,
        deletedAt: Date.now()
    }
    // Remove task from local state
    state.tasks = state.tasks.filter(task => task.id !== id);
    // Delete from database
    deleteTaskFromDatabase(id);
    renderBoard();
    hideDeleteConfirmation();
    // Show toast with undo option
    showToast('Task deleted',
        'error',
        5000,
        async () => {
            // Undo delete action
            if (state.lastDeletedTask) {
                // Remove the deletedAt property before adding back
                const {
                    deletedAt, ...task
                }
                    = state.lastDeletedTask;
                try {
                    // Restore to database first
                    const docRef = await saveTaskToDatabase(task.title,
                        task.status,
                        task.dueDate,
                        task.description,
                        task.priority,
                        task.subtasks || [],
                        task.isChecklist,
                        task.completed);
                    if (docRef) {
                        // Update local task with the correct Firestore ID
                        task.id = docRef.id;
                        task.createdAt = Date.now(); // Temporary until next refresh
                        state.tasks.push(task);
                        renderBoard();
                        showToast('Task restored', 'success');
                        state.lastDeletedTask = null;
                    }
                    else {
                        showToast('Failed to restore task', 'error');
                    }
                }
                catch (error) {
                    console.error('Undo restore error:', error);
                    showToast('Failed to restore task', 'error');
                }
            }
        });
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
