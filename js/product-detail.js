

// product-detail.js (FINAL CODE)

// --- Firebase Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    serverTimestamp,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Configuration & Initialization ---
const firebaseConfig = JSON.parse(window.__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let productData = null; // Store product details globally once fetched

// --- DOM Elements ---
const productNameEl = document.getElementById('product-name');
const productPriceEl = document.getElementById('product-price');
const productUnitEl = document.getElementById('product-unit');
const productDescEl = document.getElementById('product-description');
const quantityInput = document.getElementById('quantity-input');
const addToCartBtn = document.getElementById('add-to-cart-btn');
const addToWishlistBtn = document.getElementById('add-to-wishlist-btn');

// --- Helper Functions ---

async function getAuthToken() {
    if (currentUser) {
        return await currentUser.getIdToken(true);
    }
    return null;
}

/**
* Parses URL to get the product ID.
* @returns {string} The product ID.
*/
function getProductIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

/**
* Fetches product details from the API.
*/
async function fetchProductDetails(productId) {
    if (!productId) {
        productNameEl.textContent = 'Error: No product ID specified.';
        return null;
    }
   
    try {
        // Use the Express API endpoint
        const response = await fetch(`/api/products/${productId}`);
       
        if (!response.ok) {
            throw new Error(`Failed to fetch product details. Status: ${response.status}`);
        }
       
        const data = await response.json();
       
        if (!data) {
             productNameEl.textContent = 'Error: Product not found.';
             return null;
        }

        return data;

    } catch (error) {
        console.error('Error fetching product details:', error);
        productNameEl.textContent = 'Error loading product details.';
        return null;
    }
}

/**
* Renders the fetched data to the page.
*/
function renderProduct(data) {
    productNameEl.textContent = data.name;
    productPriceEl.innerHTML = `<strong>Ksh ${data.price.toLocaleString()}</strong>`;
    productUnitEl.textContent = `Unit: ${data.unit}`;
    productDescEl.textContent = data.description || 'No description available.';
    // Update the HTML page title
    document.title = `${data.name} | Ithumba Materials`;
}

// --- SECURE ACTION FUNCTIONS ---

/**
* Exposes a global function for adding to wishlist (used by utils.js).
* This function uses the Firebase Client SDK directly.
*/
window.secureAddToWishlist = async (item) => {
    if (!currentUser) {
        alert("Please log in to add items to your persistent wishlist.");
        return;
    }

    try {
        const itemRef = doc(db, 'users', currentUser.uid, 'wishlist', item.id);
       
        // Check if item already exists to prevent unnecessary writes
        const existingDoc = await getDoc(itemRef);

        if (existingDoc.exists()) {
            alert(`${item.name} is already in your Wishlist!`);
            return;
        }

        // Add the new item to Firestore
        await setDoc(itemRef, {
            productId: item.id,
            name: item.name,
            price: parseFloat(item.price),
            unit: item.unit,
            addedAt: serverTimestamp()
        });

        alert(`✅ ${item.name} added to Wishlist successfully!`);

    } catch (error) {
        console.error('Error adding to wishlist:', error);
        alert('Failed to add to wishlist. Check console for details.');
    }
}

/**
* Handles adding the current product to the cart via the secured Express API.
*/
async function handleAddToCart() {
    if (!currentUser) {
        alert("Please log in to add items to your persistent cart.");
        return;
    }
   
    if (!productData) {
        alert("Product data not loaded.");
        return;
    }

    const quantity = parseInt(quantityInput.value, 10);
    if (quantity <= 0 || isNaN(quantity)) {
        alert("Please enter a valid quantity.");
        return;
    }

    // Prepare data packet for POST /api/cart
    const cartItem = {
        productId: productData.id,
        quantity: quantity,
        name: productData.name,
        price: productData.price,
        unit: productData.unit
    };
   
    // Get secure token
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
            alert(`🛒 ${productData.name} added/updated in cart!`);
        } else {
            alert(`Failed to add to cart: ${result.message || 'Server error.'}`);
            console.error('Cart API Error:', result.error);
        }

    } catch (error) {
        console.error('Network Error during AddToCart:', error);
        alert('A network error occurred. Could not connect to the server.');
    }
}

// --- Initialization ---

async function initializeProductPage() {
    const productId = getProductIdFromUrl();
    if (productId) {
        const data = await fetchProductDetails(productId);
        if (data) {
            productData = data;
            renderProduct(data);
        }
    }
}

// Attach event listeners after the page loads
addToCartBtn.addEventListener('click', handleAddToCart);

// The Add to Wishlist button uses the exposed global function
addToWishlistBtn.addEventListener('click', () => {
    if (productData) {
        // Pass the necessary details to the global function
        window.secureAddToWishlist({
            id: productData.id,
            name: productData.name,
            price: productData.price,
            unit: productData.unit
        });
    } else {
        alert("Product data not loaded.");
    }
});

// Start fetching product details
window.addEventListener('DOMContentLoaded', initializeProductPage);

// Handle Firebase Auth State Change
onAuthStateChanged(auth, (user) => {
    currentUser = user;
});

