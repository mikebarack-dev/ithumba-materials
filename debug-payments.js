// Quick debug script to check payments in Firestore
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase
const serviceAccountPath = path.resolve(__dirname, process.env.SERVICE_ACCOUNT_PATH);
const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'ithumba-materials.appspot.com'
});

const db = admin.firestore();

async function checkPayments() {
    try {
        console.log('📋 Fetching recent payments from Firestore...\n');
        
        // Get last 10 payments ordered by timestamp
        const snapshot = await db.collection('payments')
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        
        if (snapshot.empty) {
            console.log('❌ No payments found in Firestore');
            process.exit(0);
        }
        
        console.log(`✅ Found ${snapshot.size} payment(s):\n`);
        
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`📱 CheckoutRequestID: ${doc.id}`);
            console.log(`   Status: ${data.status}`);
            console.log(`   Amount: ${data.amount}`);
            console.log(`   Phone: ${data.phone}`);
            console.log(`   OrderID: ${data.orderId}`);
            console.log(`   ResultCode: ${data.resultCode}`);
            console.log(`   ResultDesc: ${data.resultDescription}`);
            console.log(`   Receipt: ${data.mpesaReceiptNumber || 'N/A'}`);
            console.log(`   Created: ${data.createdAt?.toDate?.() || data.createdAt}`);
            console.log(`   Callback Received: ${data.callbackReceivedAt?.toDate?.() || 'Not yet'}`);
            console.log('---');
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkPayments();
