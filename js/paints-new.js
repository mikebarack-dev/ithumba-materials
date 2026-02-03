import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const CATEGORY = 'Paints & Chemicals';
let products = [];
let currentUser = null;

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
async function initFirebase() {
    await waitForConfig();
    const firebaseConfig = JSON.parse(window.__firebase_config);
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        console.log('Auth state changed. User:', user ? user.email : 'Not logged in');
    });
}

// Fetch products from API
async function fetchProducts() {
    try {
        console.log('🚀 Fetching products for category:', CATEGORY);
        
        const loading = document.getElementById('loading-indicator');
        if (loading) loading.style.display = 'block';
        
        const url = '/api/products?category=' + encodeURIComponent(CATEGORY);
        console.log('Fetching from:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        products = await response.json();
        console.log('✅ Loaded products:', products.length);
        
        if (!products || products.length === 0) {
            console.warn('⚠️ No products in category');
            showNoProducts();
            return;
        }
        
        renderProducts(products);
        
    } catch (error) {
        console.error('❌ Error fetching products:', error);
        showError('Error loading products: ' + error.message);
    }
}

// Render products to the page
function renderProducts(productsList) {
    const grid = document.getElementById('product-grid');
    if (!grid) {
        console.error('product-grid container not found');
        return;
    }
    
    const html = productsList.map(product => {
        const price = parseFloat(product.price || 0);
        const priceDisplay = price > 0 ? `KES ${price.toFixed(2)}` : 'Price on Inquiry';
        const imageUrl = product.image || '/placeholder.jpg';
        
        return `
            <div class="product-card" style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; text-align: center; min-height: 320px; display: flex; flex-direction: column; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 4px; margin-bottom: 10px; background: #f0f0f0;">
                    <h4 style="margin: 10px 0; color: #333; font-size: 16px; font-weight: 600; line-height: 1.4; min-height: 40px; word-wrap: break-word;">
                        ${escapeHtml(product.name)}
                    </h4>
                    <p style="color: #666; font-size: 13px; margin: 5px 0; line-height: 1.4;">
                        <strong>${escapeHtml(product.category || 'N/A')}</strong> • ${escapeHtml(product.unit || 'N/A')}
                    </p>
                </div>
                
                <div style="margin-top: auto; padding-top: 10px; border-top: 1px solid #f0f0f0;">
                    <p style="color: #ff6b35; font-size: 20px; font-weight: bold; margin: 8px 0;">
                        ${priceDisplay}
                    </p>
                </div>
                
                <button onclick="addToCart('${product.id}', '${escapeHtml(product.name)}', ${product.price})" style="background: #ff6b35; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer; margin-top: 10px; font-weight: bold; font-size: 14px;">
                    Add to Cart
                </button>
            </div>
        `;
    }).join('');
    
    grid.innerHTML = html;
    
    const loading = document.getElementById('loading-indicator');
    if (loading) loading.style.display = 'none';
}

// Show no products message
function showNoProducts() {
    const loading = document.getElementById('loading-indicator');
    const noProducts = document.getElementById('no-products-message');
    
    if (loading) loading.style.display = 'none';
    if (noProducts) noProducts.style.display = 'block';
}

// Show error message
function showError(message) {
    const loading = document.getElementById('loading-indicator');
    const error = document.getElementById('error-message');
    
    if (loading) loading.style.display = 'none';
    if (error) {
        error.textContent = message;
        error.style.display = 'block';
    }
}

// Add to cart function (global)
window.addToCart = function(productId, productName, price) {
    if (!currentUser) {
        alert('Please login to add items to cart');
        window.location.href = '/login.html?redirect=' + window.location.pathname;
        return;
    }
    
    try {
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        const existing = cart.find(item => item.id === productId);
        
        if (existing) {
            existing.quantity += 1;
        } else {
            cart.push({
                id: productId,
                name: productName,
                price: price,
                quantity: 1
            });
        }
        
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartBadge();
        showNotification(productName + ' added to cart!');
        
    } catch (error) {
        console.error('Error adding to cart:', error);
        alert('Error adding to cart');
    }
};

// Update cart badge
function updateCartBadge() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const badge = document.querySelector('.cart-badge');
    if (badge) {
        badge.textContent = cart.length;
    }
}

// Show notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 4px;
        z-index: 1000;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('📍 DOMContentLoaded event fired');
    initFirebase();
    fetchProducts();
    updateCartBadge();
});

console.log('✅ paints.js module execution complete');
