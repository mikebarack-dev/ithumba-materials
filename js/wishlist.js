// wishlist.js (CRITICALLY REWRITTEN for Firestore & Security)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    query,
    getDocs,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Configuration & Initialization ---
const firebaseConfig = JSON.parse(window.__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

// --- DOM Elements ---
const wishlistBody = document.getElementById('wishlist-body');
const wishlistFooter = document.getElementById('wishlist-footer');
const feedbackContainer = document.getElementById('wishlist-feedback');

// --- Utility Functions ---

/**
* Gets the current user's Firebase ID Token for secure API calls.
*/
async function getAuthToken() {
    if (currentUser) {
        return await currentUser.getIdToken(true);
    }
    return null;
}

// --- Wishlist Management Functions ---

/**
* Fetches the wishlist from Firestore based on the current user.
*/
async function fetchWishlist() {
    // Ensure feedback container exists before updating
    if (feedbackContainer) {
        feedbackContainer.textContent = 'Loading your wishlist...';
    }

    if (!currentUser) {
        if (feedbackContainer) feedbackContainer.textContent = '';
        return [];
    }

    if (feedbackContainer) feedbackContainer.textContent = 'Loading your wishlist...';

    try {
        const q = query(collection(db, 'users', currentUser.uid, 'wishlist'));
        const snapshot = await getDocs(q);

        if (feedbackContainer) feedbackContainer.textContent = '';

        if (snapshot.empty) {
            if (feedbackContainer) feedbackContainer.textContent = 'Your wishlist is empty. Start adding items!';
            return [];
        }

        const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Render wishlist items
        renderWishlist(items);
        return items;

    } catch (error) {
        console.error('Error fetching wishlist:', error);
        if (feedbackContainer) feedbackContainer.textContent = 'Error loading wishlist.';
        return [];
    }
}

/**
* Renders the wishlist items and total price to the table.
*/
function renderWishlist(items) {
    wishlistBody.innerHTML = '';
    wishlistFooter.innerHTML = '';
   
    if (items.length === 0) {
        // Only show this message if the user is logged in AND the list is empty
        if(currentUser) {
             wishlistBody.innerHTML = '<tr><td colspan="4" class="empty-message">Your wishlist is empty. Start adding items!</td></tr>';
        }
        return;
    }

    let total = 0;

    items.forEach(item => {
        const itemPrice = parseFloat(item.price) || 0;
        total += itemPrice;
       
        const row = document.createElement('tr');
        // Use window.removeItem and window.moveToCart established below
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.unit}</td>
            <td>Ksh ${itemPrice.toLocaleString()}</td>
            <td class="actions-cell">
                <button class="add-to-cart-btn" onclick="window.moveToCart('${item.id}')">Add to Cart</button>
                <button class="remove-btn" onclick="window.removeItem('${item.id}')">Remove</button>
            </td>
        `;
        wishlistBody.appendChild(row);
    });

    wishlistFooter.innerHTML = `
        <tr class="total-row">
            <td colspan="2" style="text-align:right">Total Estimate:</td>
            <td colspan="2">Ksh ${total.toLocaleString()}</td>
        </tr>
    `;
}

/**
* Removes an item from the Firestore wishlist.
*/
window.removeItem = async (docId) => {
    if (!currentUser) {
        alert("Please log in to manage your permanent Wishlist.");
        return;
    }
   
    try {
        const docRef = doc(db, 'users', currentUser.uid, 'wishlist', docId);
        await deleteDoc(docRef);
        feedbackContainer.textContent = 'Item removed successfully.';
       
        // Re-render the list immediately
        const updatedItems = await fetchWishlist();
        renderWishlist(updatedItems);
       
    } catch (error) {
        console.error('Error removing item from Firestore:', error);
        alert('Failed to remove item. Please try again.');
    }
};

/**
* Moves an item from the wishlist (Firestore) to the cart (Backend API).
*/
window.moveToCart = async (productId) => {
    if (!currentUser) {
        alert("Please log in to add items to your cart.");
        return;
    }
   
    const token = await getAuthToken();
   
    try {
        const response = await fetch('/api/cart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            body: JSON.stringify({
                productId: productId,
                quantity: 1
            })
        });

        const result = await response.json();

        if (response.ok) {
            alert(`SUCCESS: Item added to cart!`);
            window.removeItem(productId); // Remove from wishlist after successful cart addition
        } else {
            alert(`Failed to add to cart: ${result.message || 'Server error.'}`);
            console.error('Cart API Error:', result.error);
        }

    } catch (error) {
        console.error('Network Error during moveToCart:', error);
        alert('A network error occurred. Could not connect to the server.');
    }
};

// --- Initialization ---
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
   
    // Clear any residual local storage wishlist data to enforce persistence
    localStorage.removeItem('wishlist');

    // The wishlist link from home.html needs a reference, which is now handled
    // by the auth state change implicitly.
    // The previous authLink logic is redundant now that we use onAuthStateChanged.

    const items = await fetchWishlist();
    renderWishlist(items);
});

