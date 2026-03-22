const { initializeApp } = require('firebase/app');
const { getFirestore, collection } = require('firebase/firestore');

const app = initializeApp({ projectId: "demo" });
const db = getFirestore(app);

try {
  let c = collection(db, "public", "demoTasks");
  console.log("Success! Path is:", c.path);
} catch (e) {
  console.log("Error:", e.message);
}
