const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

console.log("Testing Firebase initialization...\n");

// Check if env variable is set, otherwise read from file
let keyJson;
if (process.env.FIREBASE_KEY_JSON) {
    console.log("✅ FIREBASE_KEY_JSON is set");
    keyJson = process.env.FIREBASE_KEY_JSON;
} else {
    console.log("📖 Reading Firebase key from file (local mode)...");
    const keyPath = path.join(__dirname, 'ithumba-materials-key.json');
    keyJson = fs.readFileSync(keyPath, 'utf8');
}

console.log("Length:", keyJson.length);
console.log("First 100 chars:", keyJson.substring(0, 100));

// Try to parse it
try {
    const serviceAccount = JSON.parse(keyJson);
    console.log("✅ Successfully parsed JSON");
    console.log("Project ID:", serviceAccount.project_id);
    console.log("Type:", serviceAccount.type);
    
    // Try to initialize Firebase
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    
    console.log("✅ Firebase Admin SDK initialized successfully!");
    
    // Try to fetch products
    const db = admin.firestore();
    db.collection('products').get().then(snapshot => {
        console.log("✅ Firestore connection works!");
        console.log("Products found:", snapshot.size);
        snapshot.forEach(doc => {
            console.log(`  - ${doc.data().name} (${doc.data().category})`);
        });
        process.exit(0);
    }).catch(err => {
        console.error("❌ Error fetching products:", err.message);
        process.exit(1);
    });
    
} catch (error) {
    console.error("❌ Error parsing JSON:", error.message);
    console.error("This means FIREBASE_KEY_JSON is not properly formatted");
    process.exit(1);
}
