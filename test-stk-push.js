// Test STK push directly
const axios = require('axios');
require('dotenv').config();

const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const BUSINESS_SHORT_CODE = process.env.MPESA_SHORTCODE;
const PASSKEY = process.env.MPESA_PASSKEY;

console.log('📱 Testing M-Pesa STK Push...\n');
console.log('Config:');
console.log('  ShortCode:', BUSINESS_SHORT_CODE);
console.log('  Consumer Key:', CONSUMER_KEY?.substring(0, 10) + '...');
console.log('');

async function testStkPush() {
    try {
        // Step 1: Get token
        console.log('1️⃣  Getting access token...');
        const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
        const tokenResponse = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            { headers: { Authorization: `Basic ${auth}` }, timeout: 10000 }
        );
        
        const token = tokenResponse.data.access_token;
        console.log('   ✅ Token obtained\n');

        // Step 2: Prepare payload
        console.log('2️⃣  Preparing STK push payload...');
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
        const password = Buffer.from(`${BUSINESS_SHORT_CODE}${PASSKEY}${timestamp}`).toString('base64');
        
        const payload = {
            BusinessShortCode: BUSINESS_SHORT_CODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: 1,
            PartyA: '254723456789',
            PartyB: BUSINESS_SHORT_CODE,
            PhoneNumber: '254723456789',
            CallBackURL: 'http://prejudgementally-demagogic-carmen.ngrok-free.dev/api/mpesa/callback',
            AccountReference: 'TEST-001',
            TransactionDesc: 'Test Payment'
        };
        
        console.log('   ✅ Payload ready\n');

        // Step 3: Send STK push
        console.log('3️⃣  Sending STK push to M-Pesa sandbox...');
        const stkResponse = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            payload,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        console.log('   ✅ Response received:\n');
        console.log(JSON.stringify(stkResponse.data, null, 2));
        
        if (stkResponse.data.ResponseCode === '0') {
            console.log('\n✅ SUCCESS! STK Push initiated');
            console.log('   CheckoutRequestID:', stkResponse.data.CheckoutRequestID);
        } else {
            console.log('\n❌ M-Pesa returned error:');
            console.log('   ResponseCode:', stkResponse.data.ResponseCode);
            console.log('   Description:', stkResponse.data.ResponseDescription);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response?.data) {
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testStkPush();
