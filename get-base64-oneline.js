const fs = require('fs');
const path = require('path');

// Read the JSON file
const keyPath = path.join(__dirname, 'ithumba-materials-key.json');
const keyContent = fs.readFileSync(keyPath, 'utf8');

// Convert to base64 as ONE line
const base64Key = Buffer.from(keyContent).toString('base64');

// Write to file
fs.writeFileSync('firebase-key-base64.txt', base64Key);
console.log('✅ Base64 key written to firebase-key-base64.txt');
console.log('Copy the ENTIRE content of that file into Render!');
