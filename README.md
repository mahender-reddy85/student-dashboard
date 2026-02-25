# Student Productivity Board

A modern Kanban board application with Firebase backend for task management.

## Features

- **Task Management**: Create, edit, delete tasks
- **Priority Levels**: High, Medium, Low
- **Task Status**: To Do, In Progress, Done
- **Due Dates**: Set deadlines for tasks
- **Subtasks**: Add checklist items to tasks
- **Search & Filter**: Find tasks quickly
- **Drag & Drop**: Move tasks between columns
- **Theme Toggle**: Light/Dark mode
- **Firebase Integration**: Real-time data persistence
- **Responsive Design**: Works on all devices
- **Keyboard Shortcuts**: Productivity shortcuts

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6)
- **Backend**: Firebase Firestore
- **Icons**: Font Awesome
- **Fonts**: Google Fonts

## Setup Instructions

1. **Firebase Setup**:
   - Create a Firebase project at https://console.firebase.google.com
   - Copy your Firebase configuration
   - Update `firebase-config.js` with your credentials:
     ```javascript
     const firebaseConfig = {
         apiKey: "YOUR_API_KEY",
         authDomain: "YOUR_AUTH_DOMAIN", 
         projectId: "YOUR_PROJECT_ID",
         storageBucket: "YOUR_STORAGE_BUCKET",
         messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
         appId: "YOUR_APP_ID"
     };
     ```

2. **Run the Application**:
   - Open `index.html` in your browser
   - The application will automatically connect to Firebase and load tasks

## File Structure

```
buildathon/
├── index.html          # Main application file
├── styles.css           # Complete CSS styling
├── firebase-config.js   # Firebase configuration
├── firebase.js           # Firebase integration and task management
├── README.md            # Documentation
└── favicon.jpg         # Application icon
```

## Usage

The application provides a complete task management system with:
- Real-time synchronization with Firebase
- Intuitive drag-and-drop interface
- Responsive design for all devices
- Professional UI with smooth animations
- Comprehensive task features including priorities, due dates, and subtasks

## Firebase Data Structure

Tasks are stored in Firestore with the following structure:
```javascript
{
  title: "Task title",
  status: "todo|progress|done",
  dueDate: "YYYY-MM-DD",
  createdAt: timestamp,
  priority: "high|medium|low",
  description: "Task description (optional)",
  subtasks: [
    {
      text: "Subtask item",
      completed: true|false
    }
  ]
}
```

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support  
- Safari: Full support
- Mobile: Responsive design with touch support
