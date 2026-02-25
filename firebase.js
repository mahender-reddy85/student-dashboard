import { initializeApp } from './firebase-config.js';
import { getFirestore, addDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
window.db = db;
window.addDoc = addDoc;
window.collection = collection;
window.getDocs = getDocs;

// Save task to Firestore
async function saveTaskToFirebase(taskText, status, dueDate) {
    await addDoc(collection(db, "tasks"), {
        title: taskText,
        status: status,
        dueDate: dueDate,
        createdAt: new Date()
    });
}

// Load tasks from Firestore
async function loadTasksFromFirebase() {
    const querySnapshot = await getDocs(collection(db, "tasks"));
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        const task = createTaskElement(data.title);
        document.getElementById(data.status).appendChild(task);
    });
}

// Create task element (you can customize this)
function createTaskElement(title) {
    const taskElement = document.createElement('div');
    taskElement.className = 'task-item';
    taskElement.textContent = title;
    taskElement.draggable = true;
    taskElement.addEventListener('dragstart', handleDragStart);
    taskElement.addEventListener('dragend', handleDragEnd);
    return taskElement;
}

// Drag and drop handlers
function handleDragStart(e) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.target.textContent);
    e.target.style.opacity = '0.5';
}

function handleDragEnd(e) {
    e.target.style.opacity = '1';
    // Save the new position to Firestore if needed
    // This is where you would update the task status in Firestore
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadTasksFromFirebase();
});
