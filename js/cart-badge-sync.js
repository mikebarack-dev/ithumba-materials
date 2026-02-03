/**
 * cart-badge-sync.js
 * Syncs cart badge across all pages by monitoring server cart
 * Include this script in pages that need to display the cart badge
 */

// Update cart badge from server
async function updateCartBadgeFromServerGlobal() {
    try {
        // Get auth from window (Firebase should be loaded on the page)
        if (!window.getAuth) {
            console.warn('Firebase Auth not available, skipping badge update');
            return;
        }

        const auth = window.getAuth ? window.getAuth() : null;
        if (!auth) {
            console.warn('getAuth() returned null');
            return;
        }

        const currentUser = auth.currentUser;
        if (!currentUser) {
            // No user logged in
            const badge = document.querySelector('.cart-badge');
            if (badge) badge.textContent = '0';
            return;
        }

        // Get fresh token and fetch cart from server
        const token = await currentUser.getIdToken(true);
        const response = await fetch('/api/cart', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const cartItems = await response.json();
            const count = Array.isArray(cartItems) ? cartItems.length : 0;
            const badge = document.querySelector('.cart-badge');
            if (badge) {
                badge.textContent = count;
                console.log('✅ Global cart badge updated to:', count);
            }
        }
    } catch (error) {
        console.error('Error updating cart badge from server:', error);
    }
}

// Listen for storage changes (cart updates from other tabs/windows)
window.addEventListener('storage', (event) => {
    if (event.key === 'cartBadgeUpdate') {
        // Cart was updated, refresh the badge
        console.log('Cart badge update signal received, refreshing...');
        updateCartBadgeFromServerGlobal();
    }
});

// Update badge on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🛒 cart-badge-sync.js loaded, updating badge...');
    
    // Wait for Firebase to be ready
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max
    
    const checkAndUpdate = async () => {
        if (window.getAuth && window.getAuth().currentUser !== undefined) {
            // Firebase is ready
            await updateCartBadgeFromServerGlobal();
        } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(checkAndUpdate, 100);
        } else {
            console.warn('Firebase not ready after 5 seconds, using fallback');
            const badge = document.querySelector('.cart-badge');
            if (badge) badge.textContent = '0';
        }
    };
    
    checkAndUpdate();
});

// Also monitor Firebase auth state changes
if (window.getAuth && window.getAuth().onAuthStateChanged) {
    window.getAuth().onAuthStateChanged(async (user) => {
        console.log('Auth state changed, updating badge...');
        await updateCartBadgeFromServerGlobal();
    });
}
