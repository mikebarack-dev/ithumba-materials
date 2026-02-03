// cart.js (FINAL CLIENT-SIDE CODE)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Wait for config to load
async function waitForConfig() {
    return new Promise((resolve) => {
        const checkConfig = () => {
            if (window.__firebase_config && window.__app_id) {
                resolve();
            } else {
                setTimeout(checkConfig, 50);
            }
        };
        checkConfig();
    });
}

await waitForConfig();

// --- Configuration & Initialization ---
const firebaseConfig = JSON.parse(window.__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUser = null;

// --- DOM Elements ---
const cartTable = document.getElementById('cart-table');
const cartBody = document.getElementById('cart-body');
const cartFooter = document.getElementById('cart-footer');
const loadingIndicator = document.getElementById('loading-indicator');
const errorMessage = document.getElementById('error-message');
const emptyMessage = document.getElementById('empty-message');

// --- Core API Functions ---

async function getAuthToken() {
    if (!currentUser) {
        console.warn('getAuthToken: No current user');
        return null;
    }
    try {
        const token = await currentUser.getIdToken(true);
        console.log('getAuthToken: Token obtained, length:', token.length);
        return token;
    } catch (error) {
        console.error('getAuthToken: Error getting token:', error);
        throw error;
    }
}

/**
* Sends a secure request to the Express Cart API.
*/
async function fetchCartAPI(method, endpoint = '', body = null) {
    console.log('fetchCartAPI called:', method, endpoint);
    
    const token = await getAuthToken();
    
    if (!token) {
        console.error('fetchCartAPI: No token available');
        throw new Error('Authentication required. Please log in.');
    }
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    console.log('fetchCartAPI: Sending request with token');

    const options = {
        method: method,
        headers: headers,
        ...(body && { body: JSON.stringify(body) })
    };

    const response = await fetch(`/api/cart${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
        console.error('fetchCartAPI: Response not ok:', response.status, data);
        throw new Error(data.message || `API Error: ${response.status}`);
    }
    
    console.log('fetchCartAPI: Success');
    return data;
}

// --- Cart Badge Update Function (Fetch from server) ---
/**
* Updates cart badge by fetching actual cart count from server
* This ensures the badge shows the real cart count, not localStorage which is cleared on page load
*/
async function updateCartBadgeFromServer() {
    try {
        if (!currentUser) {
            console.log('updateCartBadgeFromServer: No user, setting badge to 0');
            const badge = document.querySelector('.cart-badge');
            if (badge) badge.textContent = '0';
            return;
        }

        // Fetch actual cart from server
        const cartItems = await fetchCartAPI('GET');
        const itemCount = Array.isArray(cartItems) ? cartItems.length : 0;
        
        // Update badge on this page
        const badge = document.querySelector('.cart-badge');
        if (badge) {
            badge.textContent = itemCount;
            console.log('✅ Cart badge updated from server:', itemCount);
        }
        
        // Also try to update badges on other open pages via localStorage signal
        localStorage.setItem('cartBadgeUpdate', itemCount.toString());
        
    } catch (error) {
        console.error('updateCartBadgeFromServer: Error:', error);
        // Fall back to showing 0 if error
        const badge = document.querySelector('.cart-badge');
        if (badge) badge.textContent = '0';
    }
}

// --- Rendering and Management ---

async function fetchAndRenderCart() {
    hideAllMessages();
   
    if (!currentUser) {
        const loginMessage = document.createElement('div');
        loginMessage.style.cssText = 'text-align: center; padding: 40px; background: #f9f9f9; border-radius: 8px; margin: 20px;';
        loginMessage.innerHTML = `
            <h2 style="color: #666; margin-bottom: 20px;">Your Shopping Cart</h2>
            <p style="color: #999; font-size: 16px; margin-bottom: 30px;">Please log in to view and manage your shopping cart</p>
            <a href="/login.html" style="display: inline-block; padding: 12px 30px; background-color: #6a2e35; color: white; text-decoration: none; border-radius: 4px; font-weight: 600; margin-right: 10px;">Log In</a>
            <a href="/signup.html" style="display: inline-block; padding: 12px 30px; background-color: #d4726b; color: white; text-decoration: none; border-radius: 4px; font-weight: 600;">Create Account</a>
        `;
        
        const container = document.querySelector('main') || document.body;
        container.innerHTML = '';
        container.appendChild(loginMessage);
        
        loadingIndicator.style.display = 'none';
        cartTable.style.display = 'none';
        return;
    }
   
    loadingIndicator.textContent = 'Loading your shopping cart...';
    loadingIndicator.style.display = 'block';

    try {
        let cartData = await fetchCartAPI('GET');
        console.log('Cart API returned:', cartData.length, 'items');
       
        loadingIndicator.style.display = 'none';

        // If API returns empty, try localStorage as fallback
        if (!cartData || cartData.length === 0) {
            console.log('Cart API empty, checking localStorage...');
            const localCart = JSON.parse(localStorage.getItem('cart')) || [];
            if (localCart.length > 0) {
                console.log('Found', localCart.length, 'items in localStorage');
                cartData = localCart;
            }
        }

        if (!cartData || cartData.length === 0) {
            console.log('No items in cart');
            emptyMessage.style.display = 'block';
            cartTable.style.display = 'none';
            const clearBtn = document.getElementById('clear-cart-btn');
            if (clearBtn) clearBtn.style.display = 'none';
            return;
        }

        renderCart(cartData);

    } catch (error) {
        console.error('Error fetching cart:', error);
        loadingIndicator.style.display = 'none';
        
        // On error, try localStorage as fallback
        console.log('Cart API error, checking localStorage...');
        const localCart = JSON.parse(localStorage.getItem('cart')) || [];
        if (localCart.length > 0) {
            console.log('Falling back to localStorage with', localCart.length, 'items');
            renderCart(localCart);
            return;
        }
        
        // If no localStorage items either, show error
        errorMessage.textContent = `Error loading cart: ${error.message}. Please try refreshing the page.`;
        errorMessage.style.display = 'block';
    }
}

function renderCart(items) {
    cartBody.innerHTML = '';
    let totalAmount = 0;
    
    const clearBtn = document.getElementById('clear-cart-btn');
    
    // SVG placeholder as data URI
    const placeholderSvg = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22200%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 font-family=%22Arial%22 font-size=%2224%22 fill=%22%23999%22%3ENo Image%3C/text%3E%3C/svg%3E';
   
    items.forEach(item => {
        // Handle both Firestore items (with id) and localStorage items (with id property)
        const productId = item.id || item.productId;
        const itemPrice = parseFloat(item.price) || 0;
        const subtotal = itemPrice * (item.quantity || 1);
        const unit = item.unit || 'pc';
        // Use actual image if available, otherwise use SVG placeholder
        const imageUrl = item.image || item.imageUrl || item.thumbnail || placeholderSvg;
        totalAmount += subtotal;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <img src="${imageUrl}" alt="${item.name}" class="product-image">
            </td>
            <td>
                <div class="product-details">
                    <div class="product-name">${item.name}</div>
                    <div class="product-meta">Size/Unit: ${unit}</div>
                    <div class="product-price">Ksh ${itemPrice.toLocaleString()}</div>
                </div>
            </td>
            <td>
                <div class="quantity-actions">
                    <input type="number"
                           class="quantity-input"
                           value="${item.quantity || 1}"
                           min="1"
                           data-product-id="${productId}"
                           onchange="window.updateQuantity('${productId}', this.value)">
                    <div class="subtotal">Ksh ${subtotal.toLocaleString()}</div>
                    <button class="remove-btn" onclick="window.removeItem('${productId}')" title="Remove item">✕</button>
                </div>
            </td>
        `;
        cartBody.appendChild(row);
        
        // Fetch product details to get the image if not already present
        if (!imageUrl || imageUrl === placeholderSvg) {
            fetchProductImage(productId, row);
        }
    });

    cartFooter.innerHTML = `
        <tr class="total-row">
            <td colspan="3" style="text-align:center; padding: 0;">Total: <strong>Ksh ${totalAmount.toLocaleString()}</strong></td>
        </tr>
        <tr class="checkout-row">
            <td colspan="3" class="checkout-cell">
                <button class="checkout-btn" onclick="window.checkout()">Proceed to Checkout</button>
            </td>
        </tr>
    `;

    cartTable.style.display = 'table';
    
    // Show Clear Cart button if items exist
    if (clearBtn) {
        clearBtn.style.display = items.length > 0 ? 'inline-block' : 'none';
    }
}

// Fetch product image from the API
async function fetchProductImage(productId, rowElement) {
    try {
        const response = await fetch(`/api/products/${productId}`);
        if (response.ok) {
            const product = await response.json();
            if (product.image) {
                // Update the image src in the cart row
                const imgElement = rowElement.querySelector('.product-image');
                if (imgElement) {
                    imgElement.src = product.image;
                }
            }
        }
    } catch (error) {
        console.warn(`Could not fetch product image for ${productId}:`, error.message);
    }
}

function hideAllMessages() {
    loadingIndicator.style.display = 'none';
    errorMessage.style.display = 'none';
    emptyMessage.style.display = 'none';
}

// --- Global Actions (Attached to window for inline HTML calls) ---

window.updateQuantity = async (productId, quantity) => {
    const qty = parseInt(quantity, 10);
    if (qty < 1 || isNaN(qty)) return;

    try {
        // Try to update on server first
        try {
            await fetchCartAPI('PUT', `/${productId}`, { quantity: qty });
            console.log(`Updated quantity on server for ${productId} to ${qty}`);
        } catch (err) {
            console.warn('Could not update quantity on server:', err.message);
        }
        
        // Also update in localStorage
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        const item = cart.find(i => i.id === productId);
        if (item) {
            item.quantity = qty;
            localStorage.setItem('cart', JSON.stringify(cart));
            console.log(`Updated quantity in localStorage for ${productId} to ${qty}`);
        }
        
        fetchAndRenderCart();
    } catch (error) {
        alert('Failed to update quantity. Please try again.');
        console.error('Update quantity failed:', error);
        fetchAndRenderCart();
    }
};

window.removeItem = async (productId) => {
    if (!confirm('Are you sure you want to remove this item?')) return;
   
    try {
        // Try to DELETE from server first
        try {
            await fetchCartAPI('DELETE', `/${productId}`);
            console.log(`Removed item ${productId} from server`);
        } catch (err) {
            console.warn('Could not remove from server:', err.message);
        }
        
        // Also remove from localStorage
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        const updatedCart = cart.filter(item => item.id !== productId);
        localStorage.setItem('cart', JSON.stringify(updatedCart));
        console.log(`Removed item ${productId} from localStorage`);
        
        // Update cart badge from server
        updateCartBadgeFromServer();
        
        // Re-render cart
        fetchAndRenderCart();
    } catch (error) {
        alert('Failed to remove item. Please try again.');
        console.error('Remove item failed:', error);
    }
};

window.checkout = async () => {
    if (!currentUser) {
        alert('Please log in before checking out.');
        return;
    }
   
    // Redirect to checkout page
    window.location.href = '/checkout.html';
};

window.clearAllCart = async () => {
    if (!confirm('Are you sure you want to clear your entire cart? This cannot be undone.')) {
        return;
    }
    
    if (!confirm('This will remove ALL items from your cart. Continue?')) {
        return;
    }

    try {
        console.log('🗑️ Clearing entire cart...');
        
        // Get current cart items
        const cartItems = await fetchCartAPI('GET');
        
        // Delete each item
        for (const item of cartItems) {
            try {
                await fetchCartAPI('DELETE', `/${item.id}`);
                console.log(`✅ Deleted item: ${item.id}`);
            } catch (error) {
                console.error(`❌ Failed to delete item ${item.id}:`, error);
            }
        }
        
        console.log('✅ Cart cleared successfully');
        
        // Clear localStorage as well
        localStorage.removeItem('cart');
        
        // Re-render the cart (shows empty state)
        await fetchAndRenderCart();
        
        // Update cart badge from server
        updateCartBadgeFromServer();
        
        // Show success message
        alert('Cart cleared successfully!');
        
    } catch (error) {
        console.error('❌ Error clearing cart:', error);
        alert('Error clearing cart: ' + error.message);
    }
};

// Global function to update cart badge across all pages
function updateCartBadgeGlobal() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const badge = document.querySelector('.cart-badge');
    if (badge) {
        badge.textContent = cart.length;
        console.log('📊 Cart badge updated to:', cart.length);
    }
}

// --- Initialization ---

let authStateReady = false;

onAuthStateChanged(auth, async (user) => {
    console.log('onAuthStateChanged fired:', user ? `User: ${user.email}` : 'No user');
    
    currentUser = user;
    authStateReady = true;
    
    // Update cart badge when user state changes
    if (user) {
        console.log('User authenticated, updating cart badge');
        updateCartBadgeFromServer();
    } else {
        // No user, set badge to 0
        const badge = document.querySelector('.cart-badge');
        if (badge) badge.textContent = '0';
    }
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('DOMContentLoaded, now fetching cart');
            fetchAndRenderCart();
        });
    } else {
        console.log('DOM already ready, fetching cart');
        fetchAndRenderCart();
    }
});

// Also trigger on page load in case auth is already cached
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event, authStateReady:', authStateReady);
    if (authStateReady && currentUser) {
        console.log('Auth ready and user exists, fetching cart');
        fetchAndRenderCart();
    }
});

