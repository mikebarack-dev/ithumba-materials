/**
 * Homepage Product Display
 * Fetches and displays products from API
 * Shows featured products and categories
 */

console.log('🔄 homepage.js module loaded');

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

let allProducts = [];
let currentUser = null;
let productsLoaded = false; // Track if products are loaded
const FEATURED_COUNT = 8; // Show 8 featured products

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

// Load products on page load
async function loadHomepageProducts() {
    try {
        console.log('🚀 Loading products for homepage...');
        
        // Show loading indicators
        const loadingFeatured = document.getElementById('loading-featured');
        const loadingAll = document.getElementById('loading-all');
        console.log('Loading indicators:', { loadingFeatured, loadingAll });
        
        if (loadingFeatured) loadingFeatured.style.display = 'block';
        if (loadingAll) loadingAll.style.display = 'block';
        
        // Fetch products from API
        console.log('Fetching from /api/products...');
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Add auth token if user is logged in (to bypass rate limit)
        if (currentUser) {
            const token = await currentUser.getIdToken();
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch('/api/products', {
            method: 'GET',
            headers: headers
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            console.error('❌ API response status:', response.status);
            console.error('API response:', response);
            const text = await response.text();
            console.error('API response text:', text);
            throw new Error(`HTTP ${response.status}: ${text}`);
        }
        
        allProducts = await response.json();
        console.log('✅ Loaded products:', allProducts.length);
        
        // Log sample products for debugging
        if (allProducts.length > 0) {
            console.log('📋 Sample product 1:', allProducts[0]);
            const hammerProduct = allProducts.find(p => p.name && p.name.toLowerCase().includes('hammer'));
            if (hammerProduct) {
                console.log('🔨 Found hammer product:', hammerProduct);
            } else {
                console.warn('⚠️ No hammer product found in', allProducts.length, 'products');
                console.log('Available product names:', allProducts.slice(0, 10).map(p => p.name).join(', '));
            }
        }
        
        if (!allProducts || allProducts.length === 0) {
            console.warn('⚠️ No products available');
            showError('No products available');
            return;
        }
        
        // Display featured products (random selection)
        console.log('Calling displayFeaturedProducts...');
        displayFeaturedProducts();
        
        // Display products by category
        console.log('Calling displayProductsByCategory...');
        displayProductsByCategory();
        
        // Hide loading indicators
        if (loadingFeatured) loadingFeatured.style.display = 'none';
        if (loadingAll) loadingAll.style.display = 'none';
        
        // Mark products as loaded
        productsLoaded = true;
        console.log('✅ Homepage products loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading products:', error);
        const errorMsg = `Error: ${error.message}`;
        showError(errorMsg);
    }
}

// Display featured products (random selection of featured items)
function displayFeaturedProducts() {
    const featuredContainer = document.getElementById('featured-products');
    
    // Shuffle and get first N products as featured
    const shuffled = [...allProducts].sort(() => 0.5 - Math.random());
    const featured = shuffled.slice(0, FEATURED_COUNT);
    
    const html = featured.map(product => createProductCard(product)).join('');
    featuredContainer.innerHTML = html;
}

// Normalize category names to standard format
function normalizeCategory(categoryName) {
    if (!categoryName) return 'uncategorized';
    
    const normalized = categoryName.toLowerCase().trim();
    
    // Map variations to standard names
    const categoryMap = {
        'brushes': 'brushes & applicators',
        'brushes & applicators': 'brushes & applicators',
        'fencing': 'fencing & roofing',
        'fencing & wire': 'fencing & roofing',
        'fencing and roofing': 'fencing & roofing',
        'fencing & roofing': 'fencing & roofing',
        'roofing': 'fencing & roofing',
        'paints': 'paints & chemicals',
        'paints & chemicals': 'paints & chemicals',
        'plumbing': 'plumbing',
        'plumbing supplies': 'plumbing',
        'structural': 'structural materials',
        'structural materials': 'structural materials',
        'tools': 'tools & hardware',
        'tools & hardware': 'tools & hardware'
    };
    
    return categoryMap[normalized] || normalized;
}

// Display all products organized by category
function displayProductsByCategory() {
    const allProductsContainer = document.getElementById('all-products');
    
    // Group products by category
    const categories = {};
    allProducts.forEach(product => {
        const category = normalizeCategory(product.category || 'Uncategorized');
        if (!categories[category]) {
            categories[category] = [];
        }
        categories[category].push(product);
    });
    
    // Create HTML for each category
    let html = '';
    
    Object.keys(categories).sort().forEach(category => {
        const products = categories[category];
        html += `
            <div class="category-section" style="margin: 40px 0; border-top: 2px solid #ff6b35; padding-top: 20px;">
                <h3 style="color: #ff6b35; margin-bottom: 20px; font-size: 24px;">
                    ${category} (${products.length} products)
                </h3>
                <div class="product-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; width: 100%;">
                    ${products.map(product => createProductCard(product)).join('')}
                </div>
            </div>
        `;
    });
    
    allProductsContainer.innerHTML = html;
}

// Create a product card HTML
function createProductCard(product) {
    const imageUrl = product.image || '/placeholder.jpg';
    
    return `
        <div class="product-card" style="border-radius: 8px; padding: 15px; text-align: center; min-height: 300px; display: flex; flex-direction: column; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: relative;">
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
                    KES ${parseFloat(product.price || 0).toFixed(2)}
                </p>
            </div>
            
            <button class="add-to-cart-btn" onclick="addToCart('${product.id}', '${escapeHtml(product.name)}', ${product.price})" style="background: #ff6b35; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer; margin-top: 10px; font-weight: bold; font-size: 14px; transition: background 0.2s;">
                Add to Cart
            </button>
        </div>
    `;
}

// Add product to cart
async function addToCart(productId, productName, price) {
    // Check if user is logged in
    if (!currentUser) {
        showNotification('Please login to add items to cart', 'warning');
        setTimeout(() => {
            window.location.href = '/login.html?redirect=/';
        }, 2000);
        return;
    }

    try {
        // Get cart from localStorage
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        
        // Check if product already in cart
        const existingItem = cart.find(item => item.id === productId);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                id: productId,
                name: productName,
                price: price,
                quantity: 1
            });
        }
        
        // Save cart locally
        localStorage.setItem('cart', JSON.stringify(cart));
        
        // Also send to server API
        try {
            const token = await currentUser.getIdToken(true);
            console.log('🛒 addToCart - Sending to server API...');
            console.log('🛒 addToCart - Token length:', token.length);
            const response = await fetch('/api/cart', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    productId: productId,
                    name: productName,
                    price: price,
                    quantity: existingItem ? existingItem.quantity : 1,
                    unit: 'pc'
                })
            });
            
            console.log('🛒 addToCart - Response status:', response.status);
            if (!response.ok) {
                console.warn('❌ addToCart - Failed to sync cart to server:', response.status);
            } else {
                console.log('✅ addToCart - Synced to server successfully');
            }
        } catch (serverError) {
            console.warn('❌ addToCart - Could not sync cart to server:', serverError.message);
            // Continue anyway - item is saved locally
        }
        
        // Update badge
        updateCartBadge();
        
        // Show notification
        showNotification(`${productName} added to cart!`);
        
    } catch (error) {
        console.error('Error adding to cart:', error);
        showError('Error adding to cart');
    }
}

// Update cart badge
function updateCartBadge() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const badge = document.querySelector('.cart-badge');
    if (badge) {
        badge.textContent = cart.length;
    }
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.textContent = message;
    
    const bgColor = type === 'warning' ? '#ff9800' : '#4CAF50';
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 15px 20px;
        border-radius: 4px;
        z-index: 1000;
        animation: slideIn 0.3s ease-in-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Show error
function showError(message) {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Filter and display products by search term
function filterProductsBySearch(searchTerm) {
    const allProductsContainer = document.getElementById('all-products');
    
    console.log('🔍 filterProductsBySearch called with:', searchTerm);
    console.log('📦 allProducts available:', allProducts.length);
    console.log('⏳ productsLoaded:', productsLoaded);
    
    if (!productsLoaded) {
        console.warn('⚠️ Products not loaded yet, skipping search');
        return;
    }
    
    if (!searchTerm.trim()) {
        // If search is empty, show all products by category
        console.log('🔄 Search cleared, showing all products by category');
        displayProductsByCategory();
        return;
    }
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = allProducts.filter(product => {
        const name = (product.name || '').toLowerCase();
        const description = (product.description || '').toLowerCase();
        const category = (product.category || '').toLowerCase();
        
        const matches = name.includes(lowerSearchTerm) || 
               description.includes(lowerSearchTerm) ||
               category.includes(lowerSearchTerm);
        
        if (matches) {
            console.log(`✅ Match found: "${product.name}" (${product.category})`);
        }
        return matches;
    });
    
    console.log('🔍 Search for:', searchTerm, '- Found:', filtered.length, 'products');
    
    let html = '';
    
    if (filtered.length === 0) {
        html = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">
                <p>No products found matching "${escapeHtml(searchTerm)}"</p>
            </div>
        `;
    } else {
        html = `
            <div class="search-results-section" style="margin: 40px 0; border-top: 2px solid #ff6b35; padding-top: 20px;">
                <h3 style="color: #ff6b35; margin-bottom: 20px; font-size: 24px;">
                    Search Results (${filtered.length} products)
                </h3>
                <div class="product-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; width: 100%;">
                    ${filtered.map(product => createProductCard(product)).join('')}
                </div>
            </div>
        `;
    }
    
    allProductsContainer.innerHTML = html;
}

// Expose functions to global scope for inline onclick handlers
window.addToCart = addToCart;

// Load products when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('📍 DOMContentLoaded event fired');
    initFirebase();
    loadHomepageProducts();
    updateCartBadge();
    
    // Setup search functionality
    const searchBar = document.getElementById('search-bar');
    if (searchBar) {
        searchBar.addEventListener('input', function(e) {
            filterProductsBySearch(e.target.value);
        });
        
        searchBar.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                filterProductsBySearch(this.value);
            }
        });
    }
});

console.log('✅ homepage.js module execution complete');
