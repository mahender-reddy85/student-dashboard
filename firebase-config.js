// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  addDoc, 
  collection, 
  getDocs,
  doc,
  deleteDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCGtESYwNTtp0eaOjCc-ii-ukTjXJ7LIyY",
  authDomain: "student-dashboard-2c69c.firebaseapp.com",
  databaseURL: "https://student-dashboard-2c69c-default-rtdb.firebaseio.com",
  projectId: "student-dashboard-2c69c",
  storageBucket: "student-dashboard-2c69c.firebasestorage.app",
  messagingSenderId: "460268749441",
  appId: "1:460268749441:web:67baf73c70f34bd9130380",
  measurementId: "G-K6S3ZYFT18"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Make available globally
window.db = db;
window.addDoc = addDoc;
window.collection = collection;
window.getDocs = getDocs;
window.doc = doc;
window.deleteDoc = deleteDoc;
window.updateDoc = updateDoc;
