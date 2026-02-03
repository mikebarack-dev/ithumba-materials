// js/order-history.js - Fetch and display customer's order history
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

console.log('📦 order-history.js loaded');

let currentUser = null;
let wsConnection = null;

// WebSocket for real-time order status updates
function initWebSocket(userId) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
    
    console.log('🔌 Connecting to WebSocket for orders:', wsUrl);
    
    try {
        wsConnection = new WebSocket(wsUrl);
        
        wsConnection.onopen = () => {
            console.log('✅ WebSocket connected for orders');
            wsConnection.send(JSON.stringify({
                type: 'CONNECT',
                userId: userId
            }));
        };
        
        wsConnection.onmessage = (event) => {
            try {
                const notification = JSON.parse(event.data);
                console.log('📦 Order notification received:', notification);
                
                if (notification.type === 'ORDER_STATUS_CHANGE') {
                    handleOrderStatusUpdate(notification);
                }
            } catch (err) {
                console.error('⚠️ Failed to parse notification:', err);
            }
        };
        
        wsConnection.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
        };
        
        wsConnection.onclose = () => {
            console.log('🔌 WebSocket disconnected');
            setTimeout(() => {
                if (currentUser) {
                    initWebSocket(currentUser.uid);
                }
            }, 3000);
        };
    } catch (err) {
        console.error('⚠️ Failed to initialize WebSocket:', err);
    }
}

function handleOrderStatusUpdate(notification) {
    console.log('📦 Order status changed:', notification.data);
    
    // Show visual notification
    showOrderNotification(
        notification.title || 'Order Status Updated',
        notification.message || 'Your order status has been updated',
        notification.data
    );
    
    // Reload orders to show updated status
    loadOrders();
}

function showOrderNotification(title, message, data) {
    // Create a toast notification
    const notifContainer = document.getElementById('notification-container');
    if (!notifContainer) return;
    
    const notification = document.createElement('div');
    notification.className = 'notification-toast notification-order';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-title">${escapeHtml(title)}</div>
            <div class="notification-message">${escapeHtml(message)}</div>
        </div>
        <div class="notification-close">×</div>
    `;
    
    notifContainer.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    });
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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

async function initFirebase() {
    await waitForConfig();
    const firebaseConfig = JSON.parse(window.__firebase_config);
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    return new Promise((resolve) => {
        onAuthStateChanged(auth, (user) => {
            currentUser = user;
            if (!user) {
                window.location.href = '/login.html?redirect=/order-history.html';
            } else {
                console.log('✅ User authenticated:', user.email);
                // Initialize WebSocket for real-time order updates
                initWebSocket(user.uid);
                resolve(user);
            }
        });
    });
}

async function loadOrders() {
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const noOrders = document.getElementById('noOrders');
    const ordersList = document.getElementById('ordersList');

    loading.style.display = 'block';
    error.style.display = 'none';
    noOrders.style.display = 'none';
    ordersList.innerHTML = '';

    try {
        if (!currentUser) {
            throw new Error('Not authenticated');
        }

        const token = await currentUser.getIdToken(true);

        const response = await fetch('/api/orders', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to load orders: ${response.status}`);
        }

        const orders = await response.json();

        if (!orders || orders.length === 0) {
            loading.style.display = 'none';
            noOrders.style.display = 'block';
            return;
        }

        console.log(`✅ Loaded ${orders.length} orders`);

        orders.forEach(order => {
            const orderCard = createOrderCard(order);
            ordersList.appendChild(orderCard);
        });

        loading.style.display = 'none';

    } catch (err) {
        console.error('❌ Error loading orders:', err);
        loading.style.display = 'none';
        error.style.display = 'block';
        error.innerHTML = `<strong>Error:</strong> ${err.message}. Please try again.`;
    }
}

function createOrderCard(order) {
    const card = document.createElement('div');
    card.className = 'order-card';

    // Handle both Firestore Timestamp and regular Date objects
    let orderDate;
    if (order.createdAt?.toDate && typeof order.createdAt.toDate === 'function') {
        // Firestore Timestamp object
        orderDate = order.createdAt.toDate();
    } else if (order.createdAt instanceof Date) {
        orderDate = order.createdAt;
    } else if (typeof order.createdAt === 'string') {
        // ISO string or other date string
        orderDate = new Date(order.createdAt);
    } else {
        // Fallback to current date if createdAt is missing
        orderDate = new Date();
    }

    // Format date with time
    const formattedDate = orderDate.toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const statusClass = `status-${(order.status || 'pending').toLowerCase()}`;
    const statusLabel = (order.status || 'Pending').toUpperCase();

    const itemsHTML = order.items.map(item => `
        <li>
            <span class="item-name">${item.name} × ${item.quantity}</span>
            <span class="item-price">KSh ${(item.price * item.quantity).toLocaleString()}</span>
        </li>
    `).join('');

    card.innerHTML = `
        <div class="order-header">
            <div>
                <div class="order-id">#${order.orderId}</div>
                <div class="order-date">${formattedDate}</div>
            </div>
            <div class="order-status ${statusClass}">${statusLabel}</div>
        </div>

        <div class="order-details">
            <div class="detail-item">
                <div class="detail-label">Order Total</div>
                <div class="detail-value">KSh ${order.total.toLocaleString()}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Subtotal</div>
                <div class="detail-value">KSh ${order.subtotal.toLocaleString()}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Shipping</div>
                <div class="detail-value">KSh ${order.shipping.toLocaleString()}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">County</div>
                <div class="detail-value">${order.billingDetails?.county || 'N/A'}</div>
            </div>
        </div>

        <div class="order-items">
            <h4>Items Ordered</h4>
            <ul class="item-list">
                ${itemsHTML}
            </ul>
        </div>

        <div class="order-footer">
            <div class="order-total">KSh ${order.total.toLocaleString()}</div>
            <div class="order-actions">
                <button class="btn-small" onclick="viewOrderDetails('${order.orderId}')">
                    View Details
                </button>
            </div>
        </div>
    `;

    return card;
}

window.viewOrderDetails = async function(orderId) {
    try {
        if (!currentUser) {
            alert('Please log in first');
            return;
        }

        const token = await currentUser.getIdToken(true);
        const response = await fetch(`/api/orders/${orderId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load order details');
        }

        const order = await response.json();
        
        // Show detailed modal or new page
        alert(`Order #${order.orderId}\nStatus: ${order.status}\nTotal: KSh ${order.total}\n\nDelivery to: ${order.billingDetails?.streetAddress}, ${order.billingDetails?.county}`);
        
    } catch (error) {
        console.error('Error viewing details:', error);
        alert('Could not load order details');
    }
};

window.downloadInvoice = async function(orderId) {
    try {
        if (!currentUser) {
            alert('Please log in first');
            return;
        }

        const token = await currentUser.getIdToken(true);
        const response = await fetch(`/api/orders/${orderId}/invoice`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to generate invoice');
        }

        // If PDF generation is available, trigger download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${orderId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
    } catch (error) {
        console.error('Error downloading invoice:', error);
        alert('Could not download invoice. Coming soon!');
    }
};

window.logout = function() {
    const auth = getAuth();
    auth.signOut().then(() => {
        window.location.href = '/login.html';
    });
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
    await initFirebase();
    await loadOrders();
});

console.log('✅ order-history.js execution complete');
