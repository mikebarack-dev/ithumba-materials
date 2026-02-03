// Test the complete flow: Auth + STK Push through the server
const axios = require('axios');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();

const serviceAccountPath = path.resolve(__dirname, process.env.SERVICE_ACCOUNT_PATH);
const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'ithumba-materials.appspot.com'
});

const auth = admin.auth();

const SERVER_URL = 'https://ithumbadhardware.com';

async function testEndToEnd() {
    try {
        console.log('🧪 Testing End-to-End Payment Flow\n');
        
        // Step 1: Create a test user token
        console.log('1️⃣  Creating test Firebase token...');
        const testUid = 'test-user-' + Date.now();
        const customToken = await auth.createCustomToken(testUid);
        
        // Exchange custom token for ID token (we need ID token for our API)
        // For testing, we'll use custom token directly and see if it works
        console.log('   ✅ Custom token created\n');
        
        // Step 2: Call STK Push endpoint
        console.log('2️⃣  Calling /api/mpesa/stk-push endpoint...');
        try {
            const response = await axios.post(
                `${SERVER_URL}/api/mpesa/stk-push`,
                {
                    phone: '254723456789',
                    amount: 100,
                    orderId: 'test-order-' + Date.now(),
                    description: 'Test payment'
                },
                {
                    headers: {
                        'Authorization': `Bearer ${customToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000,
                    validateStatus: () => true  // Don't throw on any status
                }
            );
            
            console.log(`   Status: ${response.status}`);
            console.log(`   Response:`, JSON.stringify(response.data, null, 2));
            
            if (response.status === 200 && response.data.success) {
                console.log('\n✅ SUCCESS! Payment initiated');
                console.log('   CheckoutRequestID:', response.data.checkoutRequestId);
                
                // Step 3: Check payment status
                console.log('\n3️⃣  Checking payment status...');
                const statusResponse = await axios.get(
                    `${SERVER_URL}/api/mpesa/payment-status/${response.data.checkoutRequestId}`,
                    { validateStatus: () => true }
                );
                
                console.log(`   Status response:`, JSON.stringify(statusResponse.data, null, 2));
                
            } else {
                console.log('\n❌ Error from endpoint:', response.status);
            }
            
        } catch (error) {
            console.log('   ❌ Request error:', error.message);
            if (error.response?.data) {
                console.log('   Data:', error.response.data);
            }
        }
        
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
    } finally {
        process.exit(0);
    }
}

testEndToEnd();
