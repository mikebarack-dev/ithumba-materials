const fs = require('fs');
const path = require('path');

// Read the JSON file
const keyPath = path.join(__dirname, 'ithumba-materials-key.json');
const keyContent = fs.readFileSync(keyPath, 'utf8');

// Convert to base64
const base64Key = Buffer.from(keyContent).toString('base64');

console.log("🔐 Firebase Key Encoded in Base64");
console.log("=".repeat(80));
console.log(base64Key);
console.log("=".repeat(80));
console.log("\n📋 Instructions:");
console.log("1. Copy the entire base64 string above");
console.log("2. Go to Render dashboard → ithumba-hardware → Environment");
console.log("3. Delete the existing FIREBASE_KEY_JSON");
console.log("4. Create a NEW environment variable:");
console.log("   Name: FIREBASE_KEY_BASE64");
console.log("   Value: [paste the base64 string above]");
console.log("5. Click Save and Redeploy");
console.log("\n✅ The server will automatically decode it!");
