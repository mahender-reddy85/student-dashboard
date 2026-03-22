# Student Productivity Board

A modern Kanban board application with Firebase authentication and real-time task management. Perfect for students and professionals to organize their work efficiently.

## ✨ Features

### 🎯 Core Task Management
- **Create, Edit, Delete Tasks**: Full CRUD operations with inline editing
- **Priority Levels**: High, Medium, Low with color-coded indicators
- **Task Status**: To Do, In Progress, Done columns
- **Due Dates**: Set and track deadlines with overdue indicators
- **Subtasks & Checklists**: Add detailed checklist items to tasks
- **Task Pinning**: Keep important tasks at the top

### 🔍 Search & Organization
- **Real-time Search**: Find tasks by title or description
- **Priority Filtering**: Filter by priority levels or checklist items
- **Date Sorting**: Sort tasks by due date (oldest/newest first)
- **Drag & Drop**: Intuitive task movement between columns

### 🎨 User Experience
- **Authentication System**: Email/Password and Google OAuth login
- **Skip Auth Option**: Quick access without registration
- **Theme Toggle**: Beautiful light/dark mode with system preference detection
- **Responsive Design**: Optimized for desktop, tablet, and mobile
- **Keyboard Shortcuts**: Productivity shortcuts (N: new task, /: search, T: theme, ?: help)
- **Smooth Animations**: Professional transitions and micro-interactions

### 🔧 Technical Features
- **Firebase Integration**: Real-time data persistence with Firestore
- **Offline Support**: Local storage fallback for skip-auth users
- **Error Handling**: Centralized error management with user-friendly messages
- **Toast Notifications**: Non-intrusive feedback system
- **Performance Monitoring**: Built-in performance metrics

## 🛠 Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Firebase Firestore & Authentication
- **UI Framework**: Custom CSS with modern design patterns
- **Icons**: Font Awesome 6.4.0
- **Fonts**: Inter & Montserrat (Google Fonts)
- **Build Tools**: No build process required - pure web technologies

## 🚀 Quick Start

### 1. Firebase Setup
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication (Email/Password and Google providers)
   - Create Firestore database
   - Copy your Firebase configuration

### 2. Configure Application
   - Open `index.html` and update the `firebaseConfig` object (around line 430):
     ```javascript
     const firebaseConfig = {
         apiKey: "YOUR_API_KEY",
         authDomain: "YOUR_AUTH_DOMAIN", 
         projectId: "YOUR_PROJECT_ID",
         databaseURL: "YOUR_DATABASE_URL",
         storageBucket: "YOUR_STORAGE_BUCKET",
         messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
         appId: "YOUR_APP_ID",
         measurementId: "YOUR_MEASUREMENT_ID"
     };
     ```

### 3. Run the Application
   - Open `index.html` in your browser
   - Sign up or use skip auth to get started
   - Start managing your tasks!

## 📁 File Structure

```
buildathon/ (current project root: student-dashboard)
├── index.html          # Main application with embedded auth & config
├── styles.css           # Complete styling with responsive design
├── script.js            # Application logic with real-time sync
├── package.json         # Project metadata & deployment config
├── README.md            # This documentation
├── firestore.rules      # Security rules for production
└── favicon.png          # Dashboard icon
```

## 🔐 Security Features

- **Firebase Configuration**: Embedded securely in HTML (external file ignored by Git)
- **Authentication**: Secure user authentication with Firebase Auth
- **Data Validation**: Input validation and sanitization
- **Error Handling**: Secure error logging without exposing sensitive information

## 📊 Firebase Data Structure

Tasks are stored in Firestore with the following structure:
```javascript
{
  title: "Task title",
  description: "Task description (optional)",
  status: "todo|progress|done",
  priority: "high|medium|low",
  dueDate: "YYYY-MM-DD",
  pinned: false,
  order: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
  userId: "user-identifier",
  subtasks: [
    {
      text: "Subtask item",
      completed: true|false
    }
  ],
  isChecklist: false,
  completed: false
}
```

## 🎯 Usage Guide

### Authentication
- **Email/Password**: Traditional signup and login
- **Google OAuth**: Quick Google account login
- **Skip Auth**: Try the app without registration (local storage only)

### Task Management
- **Create Task**: Click "+" button or press "N"
- **Edit Task**: Click on task title or description
- **Delete Task**: Click delete icon on task card
- **Move Task**: Drag and drop between columns
- **Add Subtasks**: Use checklist feature for detailed task breakdown

### Keyboard Shortcuts
- `N` - Create new task
- `/` - Focus search
- `T` - Toggle theme
- `?` - Show keyboard shortcuts
- `Esc` - Close modal

## 🌐 Browser Compatibility

- **Chrome/Edge**: Full support with all features
- **Firefox**: Full support
- **Safari**: Full support
- **Mobile**: Responsive design with touch support
- **Tablet**: Optimized tablet experience

## 📱 Deployment

### Firebase Hosting
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy to Firebase
npm run deploy
```

The application is optimized for Firebase Hosting with proper caching headers and performance optimizations.

---

## 📝 Contributing

Feel free to submit issues and enhancement requests to improve this task management application.