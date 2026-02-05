const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, 'ithumba-materials-key.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://ithumba-materials.firebaseio.com'
});

async function listAllUsers() {
  try {
    console.log('📋 Fetching all users from Firebase Auth...\n');
    
    let allUsers = [];
    let pageToken = undefined;
    
    do {
      const result = await admin.auth().listUsers(1000, pageToken);
      allUsers = allUsers.concat(result.users);
      pageToken = result.pageToken;
    } while (pageToken);
    
    console.log(`✅ Total users in Firebase Auth: ${allUsers.length}\n`);
    
    allUsers.forEach(user => {
      console.log(`Email: ${user.email}`);
      console.log(`UID: ${user.uid}`);
      console.log(`Created: ${user.metadata.creationTime}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('❌ Error listing users:', error);
  } finally {
    process.exit(0);
  }
}

listAllUsers();
