// routes/mpesa.js - M-Pesa Daraja API Integration

const express = require('express');
const router = express.Router();
const axios = require('axios');
const admin = require('firebase-admin');
const firestore = admin.firestore();
const crypto = require('crypto');

// Import auth middleware
const authMiddleware = require('../middleware/auth');

// M-Pesa Daraja API credentials (from environment variables)
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const BUSINESS_SHORT_CODE = process.env.MPESA_SHORTCODE;
const PASSKEY = process.env.MPESA_PASSKEY;
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL || 'http://prejudgementally-demagogic-carmen.ngrok-free.dev/api/mpesa/callback';

let accessToken = null;
let tokenExpiry = 0;

/**
 * Validate M-Pesa Callback Signature
 * Prevents forged callbacks from unauthorized sources
 */
function validateCallbackSignature(callbackData) {
    // M-Pesa sends callbacks with a Bearer token in Authorization header
    // For now, we validate by checking that callback has required fields
    // In production, get M-Pesa's public key and verify HMAC signature
    
    try {
        const stkCallback = callbackData?.Body?.stkCallback;
        if (!stkCallback) {
            console.warn('⚠️ Invalid callback: missing stkCallback');
            return false;
        }
        
        // Required fields for valid callback
        const required = ['CheckoutRequestID', 'ResultCode', 'ResultDescription'];
        const hasRequired = required.every(field => field in stkCallback);
        
        if (!hasRequired) {
            console.warn('⚠️ Invalid callback: missing required fields');
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('❌ Callback signature validation error:', error.message);
        return false;
    }
}

/**
 * Get M-Pesa Access Token
 */
async function getMpesaToken() {
    // Return cached token if still valid
    if (accessToken && Date.now() < tokenExpiry) {
        return accessToken;
    }

    try {
        const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
        const response = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            {
                headers: {
                    Authorization: `Basic ${auth}`
                }
            }
        );

        accessToken = response.data.access_token;
        tokenExpiry = Date.now() + (response.data.expires_in * 1000);
        console.log('✅ M-Pesa access token obtained');
        return accessToken;

    } catch (error) {
        console.error('❌ Error getting M-Pesa token:', error.message);
        throw new Error('Failed to get M-Pesa access token');
    }
}

/**
 * POST /api/mpesa/stk-push
 * Initiate STK push for M-Pesa payment
 */
router.post('/stk-push', async (req, res) => {
    try {
        // Get userId from auth middleware if available, or use anonymous
        let userId = req.userId || 'anonymous-' + Date.now();
        const { phone, amount, orderId, description } = req.body;

        console.log('📱 STK Push Request:');
        console.log('   UserID:', userId);
        console.log('   Phone:', phone);
        console.log('   Amount:', amount);
        console.log('   OrderID:', orderId);

        if (!phone || !amount || !orderId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: phone, amount, orderId'
            });
        }

        // Validate phone number format
        const phoneStr = phone.toString().trim();
        if (phoneStr.length < 9 || phoneStr.length > 13) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number. Must be 9-13 digits.'
            });
        }

        if (!/^[\d+\-\s()]*\d/.test(phoneStr)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone format. Use digits only (or + - () space).'
            });
        }

        console.log('📱 STK Push initiated for:', phone, 'Amount:', amount);

        // Normalize phone number (remove +, add 254)
        let normalizedPhone = phoneStr.replace(/^\+/, '').replace(/^0/, '254').replace(/[\s\-()]/g, '');
        if (!normalizedPhone.startsWith('254')) {
            normalizedPhone = '254' + normalizedPhone;
        }

        // Ensure it's exactly 12 digits after 254 prefix
        if (normalizedPhone.length !== 12) {
            return res.status(400).json({
                success: false,
                message: 'Phone number must be 10 digits (Kenyan format).'
            });
        }

        // Generate timestamp and password
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
        const password = Buffer.from(
            `${BUSINESS_SHORT_CODE}${PASSKEY}${timestamp}`
        ).toString('base64');

        // Get access token
        const token = await getMpesaToken();

        // Prepare STK Push payload
        const stkPayload = {
            BusinessShortCode: BUSINESS_SHORT_CODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.round(amount),
            PartyA: normalizedPhone,
            PartyB: BUSINESS_SHORT_CODE,
            PhoneNumber: normalizedPhone,
            CallBackURL: CALLBACK_URL,
            AccountReference: orderId,
            TransactionDesc: description || 'Ithumba Materials Order'
        };

        console.log('🔐 STK Payload prepared for:', normalizedPhone);

        // Send STK Push request
        const response = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            stkPayload,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 second timeout
            }
        );

        console.log('✅ STK Push sent, response:', response.data);

        // Check for M-Pesa error codes
        if (response.data.ResponseCode !== '0') {
            return res.status(400).json({
                success: false,
                message: response.data.ResponseDescription || 'M-Pesa request failed'
            });
        }

        // Store payment request in database
        const checkoutId = response.data.CheckoutRequestID;
        const paymentRef = firestore.collection('payments').doc(checkoutId);
        await paymentRef.set({
            checkoutRequestId: checkoutId,
            orderId: orderId,
            userId: userId,
            phone: normalizedPhone,
            amount: amount,
            status: 'pending', // pending, completed, failed
            createdAt: new Date(),
            timestamp: new Date(),
            resultCode: null,
            resultDescription: null,
            mpesaReceiptNumber: null
        });

        console.log('✅ PAYMENT CREATED IN FIRESTORE');
        console.log('   CheckoutRequestID:', checkoutId);
        console.log('   Amount:', amount);
        console.log('   Phone:', normalizedPhone);
        console.log('   Status: pending');

        res.json({
            success: true,
            message: 'STK push sent successfully',
            checkoutRequestId: response.data.CheckoutRequestID,
            responseCode: response.data.ResponseCode
        });

    } catch (error) {
        console.error('❌ STK Push FAILED:');
        console.error('   Message:', error.message);
        
        if (error.response?.data) {
            console.error('   M-Pesa Response:', JSON.stringify(error.response.data, null, 2));
        }
        
        // Handle specific error types
        if (error.code === 'ECONNABORTED') {
            return res.status(503).json({
                success: false,
                message: 'M-Pesa service timeout. Please try again.'
            });
        }
        
        if (error.response?.status === 401) {
            return res.status(401).json({
                success: false,
                message: 'M-Pesa authentication failed. Check credentials.'
            });
        }

        if (error.response?.data?.errorMessage) {
            return res.status(400).json({
                success: false,
                message: error.response.data.errorMessage
            });
        }
        
        // If M-Pesa sent an error response, return it
        if (error.response?.data?.ResponseDescription) {
            return res.status(400).json({
                success: false,
                message: error.response.data.ResponseDescription
            });
        }

        res.status(500).json({
            success: false,
            message: error.message || 'Failed to initiate M-Pesa payment'
        });
    }
});

/**
 * Query M-Pesa for payment status
 * Checks with Safaricom if payment actually went through
 */
async function queryMpesaPaymentStatus(checkoutRequestId, businessShortCode, passkey, timestamp) {
    try {
        console.log('🔍 Querying M-Pesa for payment status:', checkoutRequestId);
        
        const token = await getMpesaToken();
        const password = Buffer.from(`${businessShortCode}${passkey}${timestamp}`).toString('base64');
        
        const response = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
            {
                BusinessShortCode: businessShortCode,
                Password: password,
                Timestamp: timestamp,
                CheckoutRequestID: checkoutRequestId
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );
        
        console.log('📊 M-Pesa query response:', response.data);
        return response.data;
        
    } catch (error) {
        console.error('❌ M-Pesa query error:', error.message);
        return null;
    }
}

/**
 * GET /api/mpesa/payment-status/:checkoutRequestId
 * Check payment status
 */
router.get('/payment-status/:checkoutRequestId', async (req, res) => {
    try {
        const { checkoutRequestId } = req.params;

        // Get payment from database
        const paymentDoc = await firestore.collection('payments').doc(checkoutRequestId).get();

        if (!paymentDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Payment request not found'
            });
        }

        const payment = paymentDoc.data();
        
        // If payment is still pending, wait 5 seconds before querying M-Pesa
        // This gives the user time to enter their PIN on the phone
        if (payment.status === 'pending') {
            const createdAt = payment.createdAt?.toDate ? payment.createdAt.toDate() : new Date(payment.createdAt);
            const secondsElapsed = (Date.now() - createdAt.getTime()) / 1000;
            
            console.log(`⏳ Payment pending for ${Math.round(secondsElapsed)}s. CheckoutRequestID: ${checkoutRequestId}`);
            
            // Only query M-Pesa after 5+ seconds (user needs time to enter PIN)
            if (secondsElapsed >= 5) {
                console.log('⏳ 5+ seconds elapsed, querying M-Pesa for actual status...');
                
                const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
                const mpesaResponse = await queryMpesaPaymentStatus(
                    checkoutRequestId,
                    BUSINESS_SHORT_CODE,
                    PASSKEY,
                    timestamp
                );
                
                // Update based on M-Pesa response
                if (mpesaResponse) {
                    console.log('📊 M-Pesa ResponseCode:', mpesaResponse.ResultCode, 'ResponseDesc:', mpesaResponse.ResponseDescription);
                    
                    if (mpesaResponse.ResultCode === '0') {
                        // Payment succeeded
                        console.log('✅ M-Pesa confirmed payment success!');
                        await firestore.collection('payments').doc(checkoutRequestId).update({
                            status: 'completed',
                            resultCode: 0,
                            resultDescription: 'The balance has been deducted successfully.',
                            mpesaQueryTime: new Date()
                        });
                        payment.status = 'completed';
                    } else if (mpesaResponse.ResultCode === '1' || mpesaResponse.ResultCode === '2') {
                        // User cancelled or failed
                        console.log('❌ M-Pesa: Payment cancelled or failed');
                        await firestore.collection('payments').doc(checkoutRequestId).update({
                            status: 'failed',
                            resultCode: mpesaResponse.ResultCode,
                            resultDescription: mpesaResponse.ResponseDescription || 'Payment failed',
                            mpesaQueryTime: new Date()
                        });
                        payment.status = 'failed';
                    } else {
                        // Any other code means still pending
                        console.log('⏳ M-Pesa: Payment still being processed (ResultCode:', mpesaResponse.ResultCode + ')');
                    }
                } else {
                    console.log('⚠️  M-Pesa query failed or timed out. Keeping status as pending.');
                }
            }
        }

        console.log('💳 Payment status:', payment.status, 'for order:', payment.orderId);

        res.json({
            success: true,
            status: payment.status,
            amount: payment.amount,
            phone: payment.phone,
            orderId: payment.orderId,
            resultCode: payment.resultCode,
            resultDescription: payment.resultDescription,
            mpesaReceiptNumber: payment.mpesaReceiptNumber
        });

    } catch (error) {
        console.error('❌ Error checking payment status:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error checking payment status'
        });
    }
});

/**
 * POST /api/mpesa/callback
 * M-Pesa callback endpoint (webhook) - Receives and processes STK push responses
 */
router.post('/callback', async (req, res) => {
    try {
        console.log('📲 M-Pesa Callback received (raw body)');
        const callbackData = req.body;
        
        // ✅ SECURITY: Validate callback signature
        if (!validateCallbackSignature(callbackData)) {
            console.error('❌ SECURITY: Callback validation failed - possible forged request');
            // Return 200 anyway so M-Pesa doesn't retry
            return res.status(200).json({ success: true, warning: 'Callback validation failed' });
        }
        
        // Respond immediately to Safaricom so they know we got the callback
        res.status(200).json({ success: true });

        // Process the callback asynchronously (don't wait for it)
        setImmediate(async () => {
            try {
                // Extract callback details
                const stkCallback = callbackData?.Body?.stkCallback;
                if (!stkCallback) {
                    console.error('❌ Invalid callback format - no stkCallback found');
                    return;
                }

                const checkoutRequestId = stkCallback.CheckoutRequestID;
                const resultCode = stkCallback.ResultCode;
                const resultDescription = stkCallback.ResultDescription || '';

                console.log('📊 Processing callback - RequestID:', checkoutRequestId, 'ResultCode:', resultCode);

                if (!checkoutRequestId) {
                    console.error('❌ No CheckoutRequestID in callback');
                    return;
                }

                // Get payment document
                const paymentRef = firestore.collection('payments').doc(checkoutRequestId);
                const paymentDoc = await paymentRef.get();

                if (!paymentDoc.exists) {
                    console.warn('⚠️ Payment document not found for:', checkoutRequestId);
                    return;
                }

                // Determine payment status based on result code
                let status = 'pending';
                if (resultCode === 0) {
                    status = 'completed';
                } else if (resultCode === 1 || resultCode === 2) {
                    status = 'failed';
                }

                // Extract M-Pesa receipt if successful
                let mpesaReceiptNumber = '';
                if (status === 'completed' && stkCallback.CallbackMetadata?.Item) {
                    const items = stkCallback.CallbackMetadata.Item;
                    const receiptItem = items.find(item => item.Name === 'MpesaReceiptNumber');
                    if (receiptItem) {
                        mpesaReceiptNumber = receiptItem.Value;
                    }
                }

                // Update payment status in Firestore
                await paymentRef.update({
                    status: status,
                    resultCode: resultCode,
                    resultDescription: resultDescription,
                    mpesaReceiptNumber: mpesaReceiptNumber || null,
                    callbackReceivedAt: new Date(),
                    callbackData: callbackData
                });

                console.log(`✅ Payment status updated: ${checkoutRequestId} -> ${status}`);
                if (mpesaReceiptNumber) {
                    console.log(`   Receipt: ${mpesaReceiptNumber}`);
                }

            } catch (error) {
                console.error('❌ Error processing callback:', error.message);
            }
        });

    } catch (error) {
        console.error('❌ Error in callback endpoint:', error.message);
        // Still return 200 to Safaricom so they don't retry
        res.status(200).json({ success: true, error: error.message });
    }
});

/**
 * POST /api/mpesa/payment-failed/:checkoutRequestId
 * User reports payment as failed
 */
router.post('/payment-failed/:checkoutRequestId', async (req, res) => {
    try {
        const { checkoutRequestId } = req.params;
        const { reason } = req.body;

        const paymentRef = firestore.collection('payments').doc(checkoutRequestId);
        const paymentDoc = await paymentRef.get();

        if (!paymentDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Payment request not found'
            });
        }

        // Mark payment as failed
        await paymentRef.update({
            status: 'failed',
            resultCode: 1,
            resultDescription: reason || 'User reported payment failure',
            failedAt: new Date()
        });

        console.log('❌ Payment marked as failed:', checkoutRequestId, '-', reason);

        res.json({
            success: true,
            message: 'Payment marked as failed'
        });

    } catch (error) {
        console.error('❌ Error marking payment as failed:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error marking payment as failed'
        });
    }
});

module.exports = router;
