// index.js - Refactored & Clean Version for Home Page

// --- Firebase Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Wait for config.js to load ---
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

// --- Global Variables from config.js ---
const appId = window.__app_id;
const firebaseConfig = JSON.parse(window.__firebase_config);
const initialAuthToken = window.__initial_auth_token;

let db, auth, currentUser = null, isAuthReady = false;

// --- DOM Elements ---
const featuredContainer = document.getElementById('featured-products');
const allContainer = document.getElementById('all-products');
const errorElement = document.getElementById('error-message');
const loadingFeatured = document.getElementById('loading-featured');
const loadingAll = document.getElementById('loading-all');

// --- Utility Functions ---
async function getAuthToken() {
    return currentUser ? await currentUser.getIdToken(true) : null;
}

function toggleVisibility(element, show) {
    if (element) element.style.display = show ? 'block' : 'none';
}

function updateAuthUI(user) {
    const authLink = document.getElementById('auth-link');
    if (authLink) {
        if (user) {
            authLink.href = 'profile.html';
            authLink.textContent = 'Profile';
        } else {
            authLink.href = 'login.html';
            authLink.textContent = 'Login';
        }
    }
}

function updateCartBadge(count) {
    const badge = document.querySelector('.cart-badge');
    if (badge) {
        badge.textContent = count;
    }
}

function renderProducts(container, products) {
    if (products.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No products available yet. Check back soon!</p></div>';
        return;
    }

    container.innerHTML = products.map(product => {
        const priceValue = product.price ? Number(product.price) : null;
        const priceDisplay = priceValue !== null ? `${priceValue.toLocaleString()} Ksh` : 'Price on Inquiry';
        const imageUrl = product.imageUrl || 'https://placehold.co/400x300/b6d094/6a2e35?text=' + encodeURIComponent(product.name || product.category);

        const secureArgs = JSON.stringify({
            id: product.id,
            name: product.name || 'Unknown Product',
            price: priceValue || 0,
            unit: product.size || product.unit || 'N/A'
        }).replace(/"/g, '&quot;');

        return `
            <div class="card">
                <div class="image-box">
                    <img src="${imageUrl}" alt="${product.name}" onerror="this.onerror=null; this.src='https://placehold.co/400x300/ccc/333?text=Image+Missing'">
                    <span class="badge">24+1 Warranty</span>
                </div>
                <div class="details">
                    <div class="title">${product.name || 'Unknown Product'}</div>
                    <div class="price">${priceDisplay}</div>
                    <div class="stars">⭐⭐⭐⭐☆</div>
                    <div class="delivery">Free Delivery</div>
                    <button class="add-to-cart-btn" onclick="secureAddToCart(${secureArgs})">Add to Cart</button>
                </div>
            </div>
        `;
    }).join('');
}

// --- Firebase Initialization & Product Fetching ---
async function initializeFirebase() {
    try {
        if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
            throw new Error("Firebase configuration is missing.");
        }

        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, async (user) => {
            currentUser = user;
            updateAuthUI(user);
            if (user) {
                isAuthReady = true;
                fetchProducts();
            } else {
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(auth, initialAuthToken);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch {
                    console.warn("Auth failed, using anonymous access.");
                    isAuthReady = true;
                    fetchProducts();
                }
            }
        });

        // Define global secureAddToCart if not already defined
        if (!window.secureAddToCart) {
            window.secureAddToCart = async (item) => {
                if (!currentUser) {
                    alert("Please log in or wait for authentication to complete before adding items to your cart.");
                    return;
                }

                const cartItem = {
                    productId: item.id,
                    quantity: 1,
                    name: item.name,
                    price: item.price,
                    unit: item.unit
                };

                const token = await getAuthToken();

                try {
                    const response = await fetch('/api/cart', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token && { 'Authorization': `Bearer ${token}` })
                        },
                        body: JSON.stringify(cartItem)
                    });

                    const result = await response.json();
                    if (response.ok || response.status === 201) {
                        alert(`🛒 ${item.name} added/updated in cart!`);
                    } else {
                        alert(`Failed to add to cart: ${result.message || 'Server error.'}`);
                        console.error('Cart API Error:', result.error);
                    }
                } catch (error) {
                    console.error('Network Error during AddToCart:', error);
                    alert('Network error. Could not connect to server.');
                }
            };
        }

    } catch (error) {
        console.error("Firebase Initialization Error:", error);
        toggleVisibility(errorElement, true);
        errorElement.textContent = `Initialization Error: ${error.message}`;
        if (loadingFeatured) loadingFeatured.remove();
        if (loadingAll) loadingAll.remove();
    }
}

// --- Fetch All Products & Featured Products ---
function fetchProducts() {
    if (!db || !isAuthReady) return;

    toggleVisibility(errorElement, false);
    toggleVisibility(loadingFeatured, true);
    toggleVisibility(loadingAll, true);

    const productsCollectionPath = `/artifacts/${appId}/public/data/products`;
    const q = collection(db, productsCollectionPath);

    onSnapshot(q, (snapshot) => {
        const allProducts = [];
        snapshot.forEach(doc => allProducts.push({ id: doc.id, ...doc.data() }));

        // Shuffle and split for featured & remaining products
        const shuffled = allProducts.sort(() => 0.5 - Math.random());
        const featured = shuffled.slice(0, 4);
        const remaining = shuffled.slice(4);

        if (featured.length === 0) {
            featuredContainer.innerHTML = '<div class="feedback-message">No featured products are currently available. Please check back later!</div>';
        } else {
            featuredContainer.innerHTML = ''; // Clear previous content
            renderProducts(featuredContainer, featured);
        }

        renderProducts(allContainer, remaining);

        toggleVisibility(loadingFeatured, false);
        toggleVisibility(loadingAll, false);

        if (allProducts.length === 0) {
            featuredContainer.innerHTML = '<div class="feedback-message">No products are currently available.</div>';
        }
    }, (error) => {
        console.error("Error fetching all products:", error);
        toggleVisibility(errorElement, true);
        errorElement.textContent = `Error loading products: ${error.message}`;
        toggleVisibility(loadingFeatured, false);
        toggleVisibility(loadingAll, false);
    });
}

// --- Menu Toggle for Mobile ---
document.addEventListener('DOMContentLoaded', () => {
    // Add null check for menuToggle
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');
    
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('show');
        });
        
        // Close menu when a link is clicked
        navLinks.querySelectorAll('a, button').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('show');
            });
        });
    }

    // Enhanced search functionality with backend integration
    const searchBar = document.getElementById('search-bar');
    if (searchBar) {
        let searchTimeout;
        
        searchBar.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            const query = this.value.trim();
            
            // Debounce search to avoid too many API calls
            searchTimeout = setTimeout(async () => {
                if (!query) {
                    // If search is empty, reload all products
                    fetchProducts();
                    return;
                }
                
                try {
                    // Call backend search API
                    const response = await fetch(`/api/products?search=${encodeURIComponent(query)}`);
                    if (!response.ok) throw new Error('Search failed');
                    
                    const searchResults = await response.json();
                    const allContainer = document.getElementById('all-products');
                    
                    // Display search results
                    if (searchResults.length === 0) {
                        if (allContainer) {
                            allContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;"><p>No products found matching "<strong>' + escapeHtml(query) + '</strong>"</p></div>';
                        }
                    } else {
                        renderProducts(allContainer, searchResults);
                    }
                } catch (error) {
                    console.error('Search error:', error);
                    const allContainer = document.getElementById('all-products');
                    if (allContainer) {
                        allContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #c62828;"><p>Error searching products. Please try again.</p></div>';
                    }
                }
            }, 300); // Wait 300ms after user stops typing before searching
        });
    } else {
        console.error('search-bar element not found.');
    }
});

// Helper function to escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// --- Start App ---
window.addEventListener('load', () => {
    if (typeof initializeFirebase === 'function') {
        initializeFirebase();
    } else {
        console.error('initializeFirebase function not defined.');
    }
});
