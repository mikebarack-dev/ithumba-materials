const fs = require('fs');
const path = require('path');

// Read the JSON file
const keyPath = path.join(__dirname, 'ithumba-materials-key.json');
const keyContent = fs.readFileSync(keyPath, 'utf8');

// This is the format Render expects - the raw JSON as a single string
console.log("Copy this entire output and paste it into Render's FIREBASE_KEY_JSON environment variable:");
console.log("=".repeat(80));
console.log(keyContent);
console.log("=".repeat(80));
console.log("\nThe JSON is ready to paste into Render!");
