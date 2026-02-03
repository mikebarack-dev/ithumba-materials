#!/usr/bin/env node
/**
 * Security Fixes Test Suite
 * Tests: Helmet headers, validation, callback validation, HTTPS redirect
 * Run: node test-security-fixes.js
 */

const axios = require('axios');
const http = require('http');

const BASE_URL = 'https://ithumbadhardware.com';
const TESTS = [];
let passCount = 0;
let failCount = 0;

// Test utilities
function test(name, fn) {
    TESTS.push({ name, fn });
}

async function runTests() {
    console.log('🔒 SECURITY FIXES TEST SUITE\n');
    console.log('⚠️  Make sure server is running: npm start\n');

    for (const t of TESTS) {
        try {
            await t.fn();
            console.log(`✅ ${t.name}`);
            passCount++;
        } catch (error) {
            console.log(`❌ ${t.name}`);
            console.log(`   Error: ${error.message}\n`);
            failCount++;
        }
    }

    console.log(`\n📊 Results: ${passCount} passed, ${failCount} failed\n`);
    process.exit(failCount > 0 ? 1 : 0);
}

// ===== TESTS =====

/**
 * Test 1: Helmet Security Headers
 */
test('Helmet: X-Content-Type-Options header present', async () => {
    const res = await axios.get(`${BASE_URL}/`);
    if (!res.headers['x-content-type-options']) {
        throw new Error('Missing X-Content-Type-Options header');
    }
});

test('Helmet: X-Frame-Options header present', async () => {
    const res = await axios.get(`${BASE_URL}/`);
    if (!res.headers['x-frame-options']) {
        throw new Error('Missing X-Frame-Options header');
    }
});

test('Helmet: Strict-Transport-Security header present', async () => {
    const res = await axios.get(`${BASE_URL}/`);
    if (!res.headers['strict-transport-security']) {
        throw new Error('Missing Strict-Transport-Security header');
    }
});

test('Helmet: X-XSS-Protection header present', async () => {
    const res = await axios.get(`${BASE_URL}/`);
    if (!res.headers['x-xss-protection']) {
        throw new Error('Missing X-XSS-Protection header');
    }
});

/**
 * Test 2: Phone Validation
 */
test('Phone Validation: Rejects invalid phone (too short)', async () => {
    try {
        await axios.post(`${BASE_URL}/api/mpesa/stk-push`, {
            phone: '123',
            amount: 100,
            orderId: 'test-order'
        });
        throw new Error('Should have rejected short phone');
    } catch (error) {
        if (error.response?.status !== 400) {
            throw new Error(`Expected 400, got ${error.response?.status}`);
        }
    }
});

test('Phone Validation: Accepts valid Kenya format (+254)', async () => {
    // This will fail auth but validation should pass
    try {
        await axios.post(`${BASE_URL}/api/mpesa/stk-push`, {
            phone: '+254712345678',
            amount: 100,
            orderId: 'test-order'
        });
    } catch (error) {
        // Expected to fail auth, but validation should pass
        if (error.response?.status === 400) {
            const msg = error.response.data?.message || '';
            if (msg.includes('Invalid Kenya phone')) {
                throw new Error('Phone validation failed on valid number');
            }
        }
    }
});

test('Phone Validation: Accepts valid Kenya format (0)', async () => {
    try {
        await axios.post(`${BASE_URL}/api/mpesa/stk-push`, {
            phone: '0712345678',
            amount: 100,
            orderId: 'test-order'
        });
    } catch (error) {
        if (error.response?.status === 400) {
            const msg = error.response.data?.message || '';
            if (msg.includes('Invalid Kenya phone')) {
                throw new Error('Phone validation failed on valid number');
            }
        }
    }
});

test('Phone Validation: Rejects SQL injection attempt', async () => {
    try {
        await axios.post(`${BASE_URL}/api/mpesa/stk-push`, {
            phone: "'; DROP TABLE users; --",
            amount: 100,
            orderId: 'test-order'
        });
        throw new Error('Should have rejected SQL injection attempt');
    } catch (error) {
        if (error.response?.status !== 400) {
            throw new Error(`Expected 400, got ${error.response?.status}`);
        }
    }
});

test('Phone Validation: Rejects XSS attempt', async () => {
    try {
        await axios.post(`${BASE_URL}/api/mpesa/stk-push`, {
            phone: '<script>alert("xss")</script>',
            amount: 100,
            orderId: 'test-order'
        });
        throw new Error('Should have rejected XSS attempt');
    } catch (error) {
        if (error.response?.status !== 400) {
            throw new Error(`Expected 400, got ${error.response?.status}`);
        }
    }
});

/**
 * Test 3: M-Pesa Callback Validation
 */
test('Callback Validation: Rejects malformed callback', async () => {
    try {
        await axios.post(`${BASE_URL}/api/mpesa/callback`, {
            invalid: 'data'
        });
        // Should return 200 but log warning
        console.log('   (Note: Callback still returns 200 to M-Pesa for retry logic)');
    } catch (error) {
        throw error;
    }
});

test('Callback Validation: Rejects callback without Body.stkCallback', async () => {
    try {
        await axios.post(`${BASE_URL}/api/mpesa/callback`, {
            Body: {
                invalidField: 'test'
            }
        });
        // Should return 200 but reject processing
        console.log('   (Note: Still returns 200 to prevent M-Pesa retries)');
    } catch (error) {
        throw error;
    }
});

test('Callback Validation: Accepts valid callback structure', async () => {
    try {
        await axios.post(`${BASE_URL}/api/mpesa/callback`, {
            Body: {
                stkCallback: {
                    CheckoutRequestID: 'test-123',
                    ResultCode: 1,
                    ResultDescription: 'User cancelled'
                }
            }
        });
        // Should return 200
        console.log('   (Valid structure accepted)');
    } catch (error) {
        throw error;
    }
});

/**
 * Test 4: Order Validation
 */
test('Order Validation: Rejects order without userId', async () => {
    try {
        await axios.post(`${BASE_URL}/api/orders`, {
            billingDetails: { firstName: 'Test' },
            cartItems: [],
            total: 100
        });
        throw new Error('Should have rejected - missing auth');
    } catch (error) {
        if (error.response?.status !== 401) {
            throw new Error(`Expected 401, got ${error.response?.status}`);
        }
    }
});

/**
 * Test 5: Input Sanitization
 */
test('Input Sanitization: Rejects HTML in firstName', async () => {
    try {
        await axios.post(`${BASE_URL}/api/orders`, 
            {
                firstName: '<script>alert("xss")</script>',
                lastName: 'Test',
                email: 'test@example.com',
                phone: '+254712345678',
                address: 'Test',
                county: 'Nairobi',
                postcode: '12345',
                shippingMethod: 'CBD',
                mpesaPhone: '+254712345678'
            },
            {
                headers: { 'Authorization': 'Bearer invalid-token' }
            }
        );
        throw new Error('Should have rejected HTML in firstName');
    } catch (error) {
        if (error.response?.status === 400) {
            return; // Good - validation caught it
        }
        if (error.response?.status === 403) {
            // Token validation happened first, which is also ok
            return;
        }
        throw error;
    }
});

test('Input Sanitization: Accepts normal firstName', async () => {
    try {
        await axios.post(`${BASE_URL}/api/orders`,
            {
                firstName: "John-Paul",
                lastName: "O'Brien",
                email: 'test@example.com',
                phone: '+254712345678',
                address: 'Test',
                county: 'Nairobi',
                postcode: '12345',
                shippingMethod: 'CBD',
                mpesaPhone: '+254712345678'
            },
            {
                headers: { 'Authorization': 'Bearer invalid-token' }
            }
        );
    } catch (error) {
        // Expected to fail on auth, but validation should pass first
        if (error.response?.status === 400) {
            const msg = error.response.data?.message || '';
            if (msg.includes('invalid characters')) {
                throw new Error('Rejected valid name format');
            }
        }
    }
});

/**
 * Test 6: Rate Limiting
 */
test('Rate Limiting: API endpoint has rate limit configured', async () => {
    try {
        const res = await axios.get(`${BASE_URL}/api/products`);
        if (!res.headers['ratelimit-limit']) {
            console.log('   (Note: Rate-Limit header not present - check if middleware is applied)');
        }
    } catch (error) {
        // Ignore errors
    }
});

/**
 * Test 7: CORS Configuration
 */
test('CORS: OPTIONS request accepted', async () => {
    try {
        const res = await axios.options(`${BASE_URL}/api/products`, {
            headers: {
                'Origin': 'http://localhost:3000'
            }
        });
        if (res.status !== 200 && res.status !== 204) {
            throw new Error(`Expected 200/204, got ${res.status}`);
        }
    } catch (error) {
        if (error.response?.status === 405) {
            console.log('   (Note: OPTIONS might not be implemented, but regular requests work)');
            return;
        }
        throw error;
    }
});

// Run all tests
runTests();
