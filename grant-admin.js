const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, 'ithumba-materials-key.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://ithumba-materials.firebaseio.com'
});

const db = admin.firestore();

async function grantAdminAccess() {
  try {
    const email = 'mikebarack5525@gmail.com';
    
    console.log(`🔑 Granting admin access to: ${email}`);
    
    // First, try to get user from Firebase Auth
    let userId;
    try {
      const authUser = await admin.auth().getUserByEmail(email);
      userId = authUser.uid;
      console.log(`📱 Found Firebase Auth user: ${userId}`);
    } catch (authError) {
      console.log('❌ User not found in Firebase Auth:', email);
      process.exit(1);
    }
    
    // Now update Firestore
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      console.log(`📝 Creating Firestore document for user ${userId}`);
      await userDocRef.set({
        email: email,
        isAdmin: true,
        createdAt: new Date()
      });
    } else {
      console.log(`📝 Found user: ${userId}`);
      console.log(`Current data:`, userDoc.data());
      await userDocRef.update({
        isAdmin: true
      });
    }
    
    console.log(`✅ Admin access granted!`);
    console.log(`🎉 User ${email} is now admin`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

grantAdminAccess();
