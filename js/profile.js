// profile.js
// This file handles user authentication state, profile data display,
// and real-time fetching of orders/wishlist from Firestore.

// --- Firebase Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut,
    signInAnonymously,
    signInWithCustomToken
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    onSnapshot,
    collection,
    query
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Global Variables (Read from config.js) ---
// FIX 2: Simplify global access, relying on window object.
const appId = window.__app_id || 'default-app-id';
const firebaseConfig = JSON.parse(window.__firebase_config || '{}');
const initialAuthToken = window.__initial_auth_token || null;

// --- Initialize Firebase Services ---
if (Object.keys(firebaseConfig).length === 0) {
    console.error("Firebase config is empty. Cannot initialize app.");
}
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM Elements ---
const authStatusEl = document.getElementById('auth-status');
const userIdEl = document.getElementById('user-id');
const userEmailEl = document.getElementById('user-email');
const userPhoneEl = document.getElementById('user-phone');
const userAddressEl = document.getElementById('user-address');
const logoutBtn = document.getElementById('logout-btn');
const authLink = document.getElementById('auth-link');
const ordersListEl = document.getElementById('orders-list');
const wishlistListEl = document.getElementById('wishlist-list');

// --- Utility Functions ---

/** Displays status/error messages to the user. */
function showStatus(status, isError = false) {
    if (!authStatusEl) return;
    authStatusEl.textContent = status;
    authStatusEl.style.color = isError ? '#c9302c' : '#15803d';
    authStatusEl.style.fontWeight = 'bold';
}

/** Redirects to login page after a delay */
function redirectToLogin() {
    showStatus('Session ended. Redirecting to login...', true);
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1500);
}

/** Logs the user out of Firebase */
async function handleLogout() {
    try {
        await signOut(auth);
        // Redirection is handled by onAuthStateChanged listener
    } catch (error) {
        console.error('Logout error:', error);
        showStatus('Logout failed.', true);
    }
}

/** Fetches private profile data from Firestore. */
function fetchUserProfileData(uid) {
    // FIX 1: Simplify collection path: users/{uid}/profile/data
    const docRef = doc(db, 'users', uid, 'profile', 'data');
   
    // Set up real-time listener for profile data
    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            userPhoneEl.textContent = data.phone || 'Not set';
            userAddressEl.textContent = data.address || 'Not set';
        } else {
            userPhoneEl.textContent = 'Not set';
            userAddressEl.textContent = 'Not set';
        }
    }, (error) => {
        console.error("Error fetching profile data:", error);
        userPhoneEl.textContent = 'Error';
        userAddressEl.textContent = 'Error';
    });
}

/** Fetches the latest orders for the user */
function fetchUserOrders(userId) {
    const ordersRef = collection(db, 'users', userId, 'orders');
    onSnapshot(ordersRef, (snapshot) => {
        ordersListEl.innerHTML = '';
        if (snapshot.empty) {
            ordersListEl.textContent = 'No orders found.';
        } else {
            snapshot.forEach((doc) => {
                const order = doc.data();
                const orderItem = document.createElement('div');
                orderItem.textContent = `Order ID: ${doc.id}, Total: ${order.total}`;
                ordersListEl.appendChild(orderItem);
            });
        }
    }, (error) => {
        console.error('Error fetching orders:', error);
        ordersListEl.textContent = 'Error loading orders.';
    });
}

/** Fetches the user's wishlist items */
function fetchUserWishlist(userId) {
    const wishlistRef = collection(db, 'users', userId, 'wishlist');
    onSnapshot(wishlistRef, (snapshot) => {
        wishlistListEl.innerHTML = '';
        if (snapshot.empty) {
            wishlistListEl.textContent = 'No items in wishlist.';
        } else {
            snapshot.forEach((doc) => {
                const item = doc.data();
                const wishlistItem = document.createElement('div');
                wishlistItem.textContent = `${item.name} - ${item.price} Ksh`;
                wishlistListEl.appendChild(wishlistItem);
            });
        }
    }, (error) => {
        console.error('Error fetching wishlist:', error);
        wishlistListEl.textContent = 'Error loading wishlist.';
    });
}

// --- Initialization and Auth Listener ---

// Keep track of active Firestore listeners to unsubscribe them on logout
let profileUnsub = null;
let ordersUnsub = null;
let wishlistUnsub = null;

function unsubscribeAll() {
    if (profileUnsub) profileUnsub();
    if (ordersUnsub) ordersUnsub();
    if (wishlistUnsub) wishlistUnsub();
    profileUnsub = ordersUnsub = wishlistUnsub = null;
}

async function initializeFirebase() {
    try {
        // Set up authentication listener
        onAuthStateChanged(auth, (user) => {
            unsubscribeAll(); // Stop previous listeners when auth state changes

            if (user && user.isAnonymous === false) {
                // --- Authenticated User ---
                authStatusEl.textContent = 'Authenticated';
                userIdEl.textContent = user.uid;
                userEmailEl.textContent = user.email || 'N/A';
                userPhoneEl.textContent = user.phoneNumber || 'N/A';
                showStatus('Signed in successfully.');
                logoutBtn.style.display = 'inline-block';
               
                // Attach logout handler to the nav link
                authLink.textContent = 'Logout';
                authLink.href = 'javascript:void(0);';
                authLink.onclick = handleLogout;
               
                // Start fetching user-specific data and store unsubscribe functions
                profileUnsub = fetchUserProfileData(user.uid);
                ordersUnsub = fetchUserOrders(user.uid);
                wishlistUnsub = fetchUserWishlist(user.uid);

            } else if (user && user.isAnonymous === true) {
                 // --- Anonymous User ---
                userIdEl.textContent = user.uid;
                userEmailEl.textContent = 'N/A (Guest)';
                userPhoneEl.textContent = 'N/A';
                userAddressEl.textContent = 'N/A';
                showStatus('Guest Access. Please log in to personalize.', true);
                logoutBtn.style.display = 'none';
               
                // Ensure nav link is for login
                authLink.textContent = 'Login';
                authLink.href = 'login.html';
                authLink.onclick = null;
               
                ordersListEl.textContent = 'Log in to view orders.';
                wishlistListEl.textContent = 'Log in to view wishlist.';

            } else {
                // --- User is Signed Out ---
                userIdEl.textContent = 'N/A';
                userEmailEl.textContent = 'Not Signed In';
                logoutBtn.style.display = 'none';
               
                // Ensure nav link is for login
                authLink.textContent = 'Login';
                authLink.href = 'login.html';
                authLink.onclick = null;

                // FIX 3: Redirect to login.html if the user is completely signed out and on the profile page.
                if (window.location.pathname.includes('profile.html')) {
                    redirectToLogin();
                } else {
                    showStatus('Content unavailable.', true);
                    ordersListEl.textContent = 'Content unavailable.';
                    wishlistListEl.textContent = 'Content unavailable.';
                    userPhoneEl.textContent = 'N/A';
                    userAddressEl.textContent = 'N/A';
                }
            }
        });

        // Initial sign-in attempt using custom token (if token is provided)
        if (initialAuthToken) {
            showStatus('Initializing session...');
            await signInWithCustomToken(auth, initialAuthToken);
        }
        // FIX 3: Removed the unnecessary signInAnonymously(auth) here.

    } catch (error) {
        console.error("Firebase Initialization or Auth Error:", error);
        showStatus(`Initialization Error: ${error.message}`, true);
    }
}

// --- App Start ---
window.addEventListener('load', () => {
    initializeFirebase();
    // Ensure logout button exists before adding event listener
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Add fallback logic for MappingForm properties
    if (MappingForm) {
        MappingForm.onLoadAutofill = function() {
            if (!this.disabledWebsites) {
                console.warn('disabledWebsites is not initialized.');
                this.disabledWebsites = [];
            }
            // Existing logic for onLoadAutofill
        };
    } else {
        console.error('MappingForm is not defined.');
    }
});

