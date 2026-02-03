

// db.js (FINAL FIX)

const admin = require('firebase-admin');

// 1. Check if the app is already initialized by the main server file (server.js/app.js)
if (admin.apps.length === 0) {
    // If running in isolation or if server initialization failed, exit or handle error
    console.error("❌ CRITICAL ERROR: Firebase Admin SDK must be initialized in the main server file.");
    // We will assume that the main file handles the critical initialization.
    // In a real application, you would handle this more gracefully.
}

// 2. Export the initialized firestore instance and storage
const dbInstance = admin.firestore();
const storageInstance = admin.storage();

module.exports = dbInstance;
module.exports.storage = storageInstance;

