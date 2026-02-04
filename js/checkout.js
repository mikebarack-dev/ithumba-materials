/**
 * Checkout Page JavaScript
 * Handles form validation, cart loading, totals calculation, and M-Pesa payment
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

console.log('🛒 checkout.js loaded');

// Wait for config.js to load
async function waitForConfig() {
    return new Promise((resolve) => {
        const checkConfig = () => {
            if (window.__firebase_config) {
                resolve();
            } else {
                setTimeout(checkConfig, 100);
            }
        };
        checkConfig();
    });
}

// Initialize Firebase
let currentUser = null;
let cartItems = [];

async function initFirebase() {
    await waitForConfig();
    const firebaseConfig = JSON.parse(window.__firebase_config);
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    return new Promise((resolve) => {
        onAuthStateChanged(auth, (user) => {
            currentUser = user;
            if (!user) {
                alert('Please log in to checkout');
                window.location.href = '/login.html?redirect=/checkout.html';
            } else {
                console.log('✅ User authenticated:', user.email);
                resolve(user);
            }
        });
    });
}

// Fetch cart items
async function loadCartItems() {
    try {
        if (!currentUser) {
            throw new Error('Not authenticated');
        }

        const token = await currentUser.getIdToken(true);
        const response = await fetch('/api/cart', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch cart');

        cartItems = await response.json();
        console.log('✅ Loaded cart items:', cartItems.length);
        renderOrderSummary();
        calculateTotals();

    } catch (error) {
        console.error('❌ Error loading cart:', error);
        // Fallback to localStorage
        cartItems = JSON.parse(localStorage.getItem('cart')) || [];
        renderOrderSummary();
        calculateTotals();
    }
}

// Normalize category name to lowercase
function normalizeCategory(categoryName) {
    return (categoryName || 'uncategorized').toLowerCase().trim();
}

// Render order summary
function renderOrderSummary() {
    const container = document.getElementById('order-items');

    if (cartItems.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">Your cart is empty. <a href="index.html">Continue shopping</a></p>';
        return;
    }

    let html = '';
    cartItems.forEach(item => {
        const quantity = item.quantity || 1;
        const price = parseFloat(item.price) || 0;
        const subtotal = price * quantity;
        const category = normalizeCategory(item.category);

        html += `
            <div class="order-item">
                <div class="item-details">
                    <div class="item-name">${escapeHtml(item.name)}</div>
                    <div class="item-category">${escapeHtml(category)}</div>
                </div>
                <div class="item-qty">x ${quantity}</div>
                <div class="item-price">KSh ${subtotal.toLocaleString()}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Calculate totals
function calculateTotals() {
    const subtotal = cartItems.reduce((sum, item) => {
        return sum + (parseFloat(item.price) || 0) * (item.quantity || 1);
    }, 0);

    const checkedRadio = document.querySelector('input[name="shipping"]:checked');
    const shippingCost = checkedRadio ? parseFloat(checkedRadio.value) : 100;

    const total = subtotal + shippingCost;

    document.getElementById('subtotal').textContent = `KSh ${subtotal.toLocaleString()}`;
    document.getElementById('shipping-cost').textContent = shippingCost === 0 ? 'Free' : `KSh ${shippingCost.toLocaleString()}`;
    document.getElementById('total-amount').textContent = `KSh ${total.toLocaleString()}`;

    // Store for submission
    document.getElementById('checkout-form').dataset.subtotal = subtotal;
    document.getElementById('checkout-form').dataset.shipping = shippingCost;
    document.getElementById('checkout-form').dataset.total = total;
}

// Form validation
function validateForm(formData) {
    const errors = [];

    // Check required fields
    if (!formData.firstName.trim()) errors.push('firstName');
    if (!formData.lastName.trim()) errors.push('lastName');
    if (!formData.email.trim() || !isValidEmail(formData.email)) errors.push('email');
    if (!formData.phone.trim() || !isValidPhone(formData.phone)) errors.push('phone');
    if (!formData.country) errors.push('country');
    if (!formData.streetAddress.trim()) errors.push('streetAddress');
    if (!formData.city.trim()) errors.push('city');
    if (!formData.county) errors.push('county');
    if (!formData.postcode.trim()) errors.push('postcode');
    if (!formData.mpesaPhone.trim() || !isValidPhone(formData.mpesaPhone)) errors.push('mpesaPhone');

    return errors;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    return /^(\+254|254|0)[0-9]{9}$/.test(phone.replace(/\s/g, ''));
}

function showFieldError(fieldName, message = 'This field is required') {
    const field = document.getElementById(fieldName);
    const errorEl = field.parentElement.querySelector('.error-message');
    if (field) {
        field.classList.add('error');
    }
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
    }
}

function clearFieldError(fieldName) {
    const field = document.getElementById(fieldName);
    if (!field) return; // Safety check
    
    const errorEl = field.parentElement.querySelector('.error-message');
    if (field) {
        field.classList.remove('error');
    }
    if (errorEl) {
        errorEl.classList.remove('show');
    }
}

// HTML escape
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Process checkout - Initiate M-Pesa STK Push
async function processCheckout(formData) {
    try {
        console.log('📦 Processing checkout - Initiating M-Pesa STK Push...');

        if (!currentUser) {
            throw new Error('Not authenticated');
        }

        // Generate temporary order ID for payment tracking
        const tempOrderId = `temp-${Date.now()}`;
        const total = parseFloat(document.getElementById('checkout-form').dataset.total);

        // Get auth token
        const token = await currentUser.getIdToken(true);
        console.log('🔐 Auth token obtained, length:', token?.length);

        // Initiate STK Push
        console.log('📱 Sending STK push to:', formData.mpesaPhone);
        const stkResponse = await fetch('/api/mpesa/stk-push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                phone: formData.mpesaPhone,
                amount: total,
                orderId: tempOrderId,
                description: `Ithumba Materials Order - ${cartItems.length} items`
            })
        });

        console.log('📊 STK Response status:', stkResponse.status);
        
        if (!stkResponse.ok) {
            const errorData = await stkResponse.json();
            console.error('❌ STK Error response:', errorData);
            throw new Error(`M-Pesa API Error: ${errorData.message || errorData.error || 'Unknown error'}`);
        }

        const stkData = await stkResponse.json();
        console.log('✅ STK Data received:', stkData);

        if (!stkData.success) {
            throw new Error(stkData.message || 'Failed to initiate STK push');
        }

        const checkoutRequestId = stkData.checkoutRequestId;
        console.log('✅ STK Push sent, CheckoutRequestId:', checkoutRequestId);

        // Show STK status and wait for payment
        showStkWaitingUI(checkoutRequestId, formData, tempOrderId, total);

    } catch (error) {
        console.error('❌ Checkout error:', error);
        alert('Error processing checkout: ' + error.message);
    }
}

// Show UI while waiting for STK payment
function showStkWaitingUI(checkoutRequestId, formData, tempOrderId, total) {
    // Hide form
    document.getElementById('checkout-form').style.display = 'none';

    // Show waiting message
    const container = document.querySelector('.container');
    const waitingDiv = document.createElement('div');
    waitingDiv.id = 'stk-waiting';
    waitingDiv.style.cssText = `
        background: white;
        padding: 40px;
        border-radius: 8px;
        text-align: center;
        max-width: 500px;
        margin: 40px auto;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    
    let checkCount = 0;
    const maxChecks = 120; // 120 checks * 3 seconds = 6 minutes timeout
    let stillWaitingShown = false;
    
    waitingDiv.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 20px;">📱</div>
        <h2 style="color: #2e2836; margin-bottom: 20px;">Complete Payment</h2>
        <p style="color: #666; margin-bottom: 15px; font-size: 16px;">
            An M-Pesa prompt has been sent to <strong>${formData.mpesaPhone}</strong>
        </p>
        <p style="color: #666; margin-bottom: 25px; font-size: 14px;">
            Enter your M-Pesa PIN to complete the payment of <strong>KSh ${total.toLocaleString()}</strong>
        </p>
        <div id="payment-status" style="background: #f5f5f5; padding: 20px; border-radius: 4px; margin-bottom: 20px; display: none;">
            <p id="status-message" style="margin: 0; color: #666;"></p>
        </div>
        <div id="still-waiting" style="background: #fff3cd; padding: 15px; border-radius: 4px; margin-bottom: 20px; display: none; border: 1px solid #ffc107;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>Still waiting for payment...</strong><br>
                If you entered the wrong PIN, you can try again below.
            </p>
        </div>
        <div style="display: flex; gap: 10px;">
            <button onclick="window.reportPaymentFailed('${checkoutRequestId}', '${JSON.stringify(formData).replace(/"/g, '&quot;')}')" style="flex: 1; padding: 12px; background: #f0f0f0; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; color: #333;">
                Payment Failed
            </button>
            <button onclick="window.checkPaymentStatus('${checkoutRequestId}', '${tempOrderId}', ${total}, '${JSON.stringify(formData).replace(/"/g, '&quot;')}')" style="flex: 1; padding: 12px; background: #e91e63; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; color: white;">
                Check Status
            </button>
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 15px;">Waiting for payment confirmation... <span id="timer">6:00</span></p>
    `;

    container.appendChild(waitingDiv);

    // Update timer
    const updateTimer = () => {
        const remainingChecks = maxChecks - checkCount;
        const seconds = remainingChecks * 3;
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const timerEl = document.getElementById('timer');
        if (timerEl) {
            timerEl.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
        
        // Show "Still waiting" message after 30 seconds
        if (checkCount > 10 && !stillWaitingShown) {
            stillWaitingShown = true;
            const stillWaitingEl = document.getElementById('still-waiting');
            if (stillWaitingEl) {
                stillWaitingEl.style.display = 'block';
            }
        }
    };

    // Poll for payment status every 3 seconds
    window.paymentCheckInterval = setInterval(() => {
        checkCount++;
        updateTimer();
        
        if (checkCount > maxChecks) {
            // Timeout - payment not confirmed
            clearInterval(window.paymentCheckInterval);
            showPaymentTimeout(checkoutRequestId, formData, tempOrderId, total);
        } else {
            checkPaymentStatusAuto(checkoutRequestId, tempOrderId, total, formData);
        }
    }, 3000);
}

// Show error if payment times out
function showPaymentTimeout(checkoutRequestId, formData, tempOrderId, total) {
    const waitingDiv = document.getElementById('stk-waiting');
    if (!waitingDiv) return;
    
    waitingDiv.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 20px;">⏱️</div>
        <h2 style="color: #d32f2f; margin-bottom: 20px;">Payment Timeout</h2>
        <p style="color: #666; margin-bottom: 15px;">
            The M-Pesa prompt expired or payment was not confirmed.
        </p>
        <p style="color: #999; margin-bottom: 25px; font-size: 14px;">
            Your payment must be completed within 6 minutes.
        </p>
        <div style="display: flex; gap: 10px; flex-direction: column;">
            <button onclick="window.retryPayment('${checkoutRequestId}', '${tempOrderId}', ${total}, '${JSON.stringify(formData).replace(/"/g, '&quot;')}')" style="padding: 12px; background: #e91e63; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; color: white; font-size: 16px;">
                Retry Payment
            </button>
            <button onclick="window.goBackToCheckout()" style="padding: 12px; background: #f0f0f0; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; color: #333; font-size: 16px;">
                Go Back
            </button>
        </div>
    `;
}

// Retry payment
window.retryPayment = async function(checkoutRequestId, tempOrderId, total, formDataStr) {
    const formData = JSON.parse(formDataStr.replace(/&quot;/g, '"'));
    
    // Reset form and try again
    document.getElementById('stk-waiting').remove();
    document.getElementById('checkout-form').style.display = 'block';
    
    // Re-initiate STK push
    await processCheckout(formData);
};

// Go back to checkout
window.goBackToCheckout = function() {
    document.getElementById('stk-waiting').remove();
    document.getElementById('checkout-form').style.display = 'block';
};

// Auto-check payment status
async function checkPaymentStatusAuto(checkoutRequestId, tempOrderId, total, formData) {
    try {
        if (!currentUser) {
            console.warn('User not authenticated');
            return;
        }

        const token = await currentUser.getIdToken(true);
        const response = await fetch(`/api/mpesa/payment-status/${checkoutRequestId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        console.log('💳 Payment status response:', data.status, 'Result Code:', data.resultCode);

        // Update status display
        const statusDiv = document.getElementById('payment-status');
        const statusMsg = document.getElementById('status-message');
        if (statusDiv && statusMsg) {
            statusDiv.style.display = 'block';
            if (data.status === 'pending') {
                statusDiv.style.background = '#e3f2fd';
                statusMsg.innerHTML = '⏳ Waiting for payment confirmation...';
                statusMsg.style.color = '#1565c0';
            } else if (data.status === 'completed') {
                statusDiv.style.background = '#c8e6c9';
                statusMsg.innerHTML = '✅ Payment successful!';
                statusMsg.style.color = '#2e7d32';
            } else if (data.status === 'failed') {
                statusDiv.style.background = '#ffcdd2';
                statusMsg.innerHTML = '❌ Payment failed: ' + (data.resultDescription || 'Unknown error');
                statusMsg.style.color = '#c62828';
            }
        }

        if (data.status === 'completed') {
            // Payment successful
            clearInterval(window.paymentCheckInterval);
            finalizePurchase(checkoutRequestId, tempOrderId, total, formData, data.mpesaReceiptNumber);
        } else if (data.status === 'failed') {
            // Payment failed
            clearInterval(window.paymentCheckInterval);
            showPaymentFailed(data.resultDescription || 'Payment was not successful', checkoutRequestId, formData, tempOrderId, total);
        }
    } catch (error) {
        console.warn('Status check error:', error);
    }
}

// Show payment failed message
function showPaymentFailed(reason, checkoutRequestId, formData, tempOrderId, total) {
    const waitingDiv = document.getElementById('stk-waiting');
    if (!waitingDiv) return;
    
    waitingDiv.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
        <h2 style="color: #d32f2f; margin-bottom: 20px;">Payment Failed</h2>
        <p style="color: #666; margin-bottom: 15px;">
            Your M-Pesa payment was not successful.
        </p>
        <p style="color: #999; margin-bottom: 25px; font-size: 14px;">
            Reason: ${reason}
        </p>
        <div style="display: flex; gap: 10px; flex-direction: column;">
            <button onclick="window.retryPayment('${checkoutRequestId}', '${tempOrderId}', ${total}, '${JSON.stringify(formData).replace(/"/g, '&quot;')}')" style="padding: 12px; background: #e91e63; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; color: white; font-size: 16px;">
                Try Again
            </button>
            <button onclick="window.goBackToCheckout()" style="padding: 12px; background: #f0f0f0; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; color: #333; font-size: 16px;">
                Go Back
            </button>
        </div>
    `;
}

// Global function for manual status check
window.checkPaymentStatus = async function(checkoutRequestId, tempOrderId, total, formDataStr) {
    const formData = JSON.parse(formDataStr.replace(/&quot;/g, '"'));
    await checkPaymentStatusAuto(checkoutRequestId, tempOrderId, total, formData);
};

// User reports payment as failed (e.g., wrong PIN)
window.reportPaymentFailed = async function(checkoutRequestId, formDataStr) {
    const formData = JSON.parse(formDataStr.replace(/&quot;/g, '"'));
    
    // Mark payment as failed in database
    if (currentUser) {
        const token = await currentUser.getIdToken(true);
        try {
            const response = await fetch(`/api/mpesa/payment-failed/${checkoutRequestId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    reason: 'User reported payment failure (wrong PIN or cancelled)'
                })
            });
            
            if (response.ok) {
                clearInterval(window.paymentCheckInterval);
                showPaymentFailed('Payment was cancelled or incorrect PIN entered', checkoutRequestId, formData, '', 0);
            }
        } catch (error) {
            console.error('Error reporting payment failed:', error);
        }
    }
};

// Finalize purchase after payment
async function finalizePurchase(checkoutRequestId, tempOrderId, total, formData, mpesaReceiptNumber) {
    try {
        clearInterval(window.paymentCheckInterval);

        console.log('✅ Payment confirmed! Creating order...');

        const token = await currentUser.getIdToken(true);

        // Create actual order
        const orderResponse = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                billingDetails: formData,
                cartItems: cartItems,
                subtotal: parseFloat(document.getElementById('checkout-form').dataset.subtotal),
                shipping: parseFloat(document.getElementById('checkout-form').dataset.shipping),
                total: total,
                timestamp: new Date().toISOString(),
                paymentId: checkoutRequestId,
                mpesaReceiptNumber: mpesaReceiptNumber
            })
        });

        if (!orderResponse.ok) {
            const errorData = await orderResponse.json();
            console.error('❌ Order creation failed:', errorData);
            throw new Error(errorData.message || 'Failed to create order');
        }

        const orderData = await orderResponse.json();
        console.log('✅ Order created:', orderData.orderId);

        // Show success
        const waitingDiv = document.getElementById('stk-waiting');
        waitingDiv.innerHTML = `
            <div style="font-size: 64px; margin-bottom: 20px;">✅</div>
            <h2 style="color: #4caf50; margin-bottom: 20px;">Payment Successful!</h2>
            <p style="color: #666; margin-bottom: 15px;">Order #${orderData.orderId}</p>
            <p style="color: #666; margin-bottom: 25px;">Thank you! Your order has been confirmed.</p>
        `;

        // Redirect after 2 seconds
        setTimeout(() => {
            window.location.href = `/order-confirmation.html?orderId=${orderData.orderId}`;
        }, 2000);

    } catch (error) {
        console.error('❌ Error finalizing purchase:', error);
        alert('Error finalizing purchase: ' + error.message);
        
        // Show retry option
        const waitingDiv = document.getElementById('stk-waiting');
        if (waitingDiv) {
            waitingDiv.innerHTML = `
                <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
                <h2 style="color: #d32f2f; margin-bottom: 20px;">Error Creating Order</h2>
                <p style="color: #666; margin-bottom: 25px;">${error.message}</p>
                <button onclick="location.reload()" style="padding: 12px 30px; background: #e91e63; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; color: white; font-size: 16px;">
                    Try Again
                </button>
            `;
        }
    }
}

// Cancel payment
window.cancelPayment = function(checkoutRequestId) {
    clearInterval(window.paymentCheckInterval);
    document.getElementById('stk-waiting').remove();
    document.getElementById('checkout-form').style.display = 'block';
    console.log('❌ Payment cancelled');
};

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🛒 Checkout page loaded');

    await initFirebase();
    await loadCartItems();

    // Shipping option change
    const shippingRadios = document.querySelectorAll('input[name="shipping"]');
    shippingRadios.forEach(radio => {
        radio.addEventListener('change', calculateTotals);
    });

    // Calculate totals on page load to display default shipping option
    calculateTotals();

    // Clear field errors on input
    const form = document.getElementById('checkout-form');
    form.querySelectorAll('input, select').forEach(field => {
        field.addEventListener('input', function() {
            clearFieldError(this.id);
        });
        field.addEventListener('change', function() {
            clearFieldError(this.id);
        });
    });

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const formData = new FormData(this);
        const data = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            country: formData.get('country'),
            streetAddress: formData.get('streetAddress'),
            city: formData.get('city'),
            county: formData.get('county'),
            postcode: formData.get('postcode'),
            mpesaPhone: formData.get('mpesaPhone')
        };

        // Validate
        const errors = validateForm(data);

        if (errors.length > 0) {
            console.warn('❌ Validation errors:', errors);
            errors.forEach(fieldName => {
                showFieldError(fieldName);
            });
            alert('Please fill in all required fields correctly');
            return;
        }

        // Process checkout
        await processCheckout(data);
    });
});

// Alternative: Create order with cash payment (no M-Pesa)
window.createOrderWithCash = async function() {
    try {
        console.log('💰 Creating order for cash payment...');
        
        if (!currentUser) {
            alert('Please log in first');
            return;
        }

        // Get form data
        const formElement = document.getElementById('checkout-form');
        if (!formElement) {
            alert('Form not found');
            return;
        }

        const formData = new FormData(formElement);
        const data = {
            firstName: formData.get('firstName') || '',
            lastName: formData.get('lastName') || '',
            email: formData.get('email') || '',
            phone: formData.get('phone') || '',
            country: formData.get('country') || '',
            streetAddress: formData.get('streetAddress') || '',
            city: formData.get('city') || '',
            county: formData.get('county') || '',
            postcode: formData.get('postcode') || '',
            mpesaPhone: formData.get('phone') || ''
        };

        // Validate billing details only
        const billingErrors = [];
        if (!data.firstName.trim()) billingErrors.push('firstName');
        if (!data.lastName.trim()) billingErrors.push('lastName');
        if (!data.email.trim() || !isValidEmail(data.email)) billingErrors.push('email');
        if (!data.phone.trim() || !isValidPhone(data.phone)) billingErrors.push('phone');
        if (!data.country) billingErrors.push('country');
        if (!data.streetAddress.trim()) billingErrors.push('streetAddress');
        if (!data.city.trim()) billingErrors.push('city');
        if (!data.county) billingErrors.push('county');
        if (!data.postcode.trim()) billingErrors.push('postcode');
        
        if (billingErrors.length > 0) {
            alert('Please fill in all required billing details');
            return;
        }
        
        if (billingErrors.length > 0) {
            alert('Please fill in all required billing details');
            return;
        }

        const token = await currentUser.getIdToken(true);
        const subtotal = parseFloat(formElement.dataset.subtotal);
        const shipping = parseFloat(formElement.dataset.shipping);
        const total = parseFloat(formElement.dataset.total);

        console.log('📤 Sending order creation request...');
        
        const orderResponse = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                billingDetails: data,
                cartItems: cartItems,
                subtotal: subtotal,
                shipping: shipping,
                total: total,
                timestamp: new Date().toISOString(),
                paymentMethod: 'cash',
                status: 'pending'
            })
        });

        if (!orderResponse.ok) {
            try {
                const errorData = await orderResponse.json();
                console.error('❌ Server error:', errorData);
                throw new Error(errorData.error || errorData.message || `Failed to create order (${orderResponse.status})`);
            } catch (e) {
                console.error('❌ Could not parse error response:', orderResponse.status);
                throw new Error(`Failed to create order: ${orderResponse.status} ${orderResponse.statusText}`);
            }
        }

        const orderData = await orderResponse.json();
        console.log('✅ Cash order created:', orderData.orderId);
        console.log('📱 Order phone:', data.phone);

        // Clear cart
        localStorage.removeItem('cart');

        // Show success message
        alert('✅ Order placed successfully! Order #' + orderData.orderId);
        
        // Redirect to confirmation with phone parameter
        const encodedPhone = encodeURIComponent(data.phone);
        window.location.href = `/order-confirmation.html?orderId=${orderData.orderId}&phone=${encodedPhone}`;

    } catch (error) {
        console.error('❌ Error creating cash order:', error);
        alert('❌ Error placing order: ' + error.message);
    }
};

console.log('✅ checkout.js execution complete');
