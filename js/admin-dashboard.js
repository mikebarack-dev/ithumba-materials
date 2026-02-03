// Admin Dashboard JS
let auth = null;
let currentUser = null;
let db = null;
let refreshInterval = null;
let lastUpdated = null;

// Initialize Firebase and check admin status
async function initAdminPanel() {
    try {
        // Wait for Firebase config
        let attempts = 0;
        while (!window.firebaseConfig && attempts < 50) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (!window.firebaseConfig) {
            showError('Firebase config not loaded');
            return;
        }

        // Initialize Firebase
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js');
        const { getAuth, onAuthStateChanged, signOut } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js');
        const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');

        const app = initializeApp(window.firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        // Check if user is authenticated
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                window.location.href = '/login.html';
                return;
            }

            currentUser = user;

            // For now, all authenticated users can access the admin dashboard
            // In production, add proper admin role check
            
            // User is authenticated, load dashboard
            loadDashboard();
            
            // Start auto-refresh every 30 seconds
            startAutoRefresh();
        });
    } catch (error) {
        console.error('Init error:', error);
        showError('Error initializing admin panel');
    }
}

// Start auto-refresh
function startAutoRefresh() {
    // Clear any existing interval
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    // Refresh every 30 seconds
    refreshInterval = setInterval(() => {
        const currentSection = document.querySelector('.dashboard-section:not([style*="display: none"])');
        if (currentSection) {
            const sectionId = currentSection.id;
            
            // Only refresh dashboard, payments, and orders sections (most important for real-time)
            if (sectionId === 'dashboard') {
                loadDashboard();
            } else if (sectionId === 'payments') {
                loadPayments();
            } else if (sectionId === 'orders') {
                loadOrders();
            }
        }
    }, 30000); // 30 seconds
}

// Manually refresh current section
async function refreshCurrentData() {
    const currentSection = document.querySelector('.dashboard-section:not([style*="display: none"])');
    if (!currentSection) return;
    
    const sectionId = currentSection.id;
    
    // Show loading state
    const content = currentSection.querySelector('div[id*="Content"]') || currentSection;
    const originalHTML = content.innerHTML;
    content.innerHTML = '<div class="loading">Refreshing...</div>';
    
    try {
        if (sectionId === 'dashboard') {
            await loadDashboard();
        } else if (sectionId === 'payments') {
            await loadPayments();
        } else if (sectionId === 'orders') {
            await loadOrders();
        } else if (sectionId === 'inventory') {
            await loadInventory();
        } else if (sectionId === 'reconciliation') {
            await loadReconciliation();
        } else if (sectionId === 'logs') {
            await loadLogs();
        }
    } catch (error) {
        console.error('Refresh error:', error);
        content.innerHTML = originalHTML;
    }
}

// Load main dashboard metrics
async function loadDashboard() {
    try {
        const token = await currentUser.getIdToken();
        
        // Fetch reports data (includes revenue, orders, customers)
        const reportsRes = await fetch('/api/clients/reports', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        let reportsData = { overview: {}, last30Days: {} };
        if (reportsRes.ok) {
            reportsData = await reportsRes.json();
        }

        // Fetch all clients
        const clientsRes = await fetch('/api/clients', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        let clientsData = { clients: [] };
        if (clientsRes.ok) {
            clientsData = await clientsRes.json();
        }

        // Update stats with real data
        const overview = reportsData.overview || {};
        const last30 = reportsData.last30Days || {};
        
        document.getElementById('todayRevenue').textContent = formatCurrency(overview.totalRevenue || 0);
        document.getElementById('weekRevenue').textContent = formatCurrency(last30.revenue || 0);
        
        // Calculate success rate from returning customers
        const totalCustomers = overview.totalCustomers || 1;
        const returningCustomers = overview.returningCustomers || 0;
        const successRate = totalCustomers > 0 ? ((returningCustomers / totalCustomers) * 100) : 0;
        document.getElementById('successRate').textContent = successRate.toFixed(1) + '%';
        
        // Display total clients
        document.getElementById('unmatchedCount').textContent = (clientsData.clients || []).length;

        // Update last refreshed time
        updateLastRefreshed();

        // Load recent payments and orders
        await loadRecentPayments();
        await loadRecentOrders();

    } catch (error) {
        console.error('Dashboard load error:', error);
        showError('Error loading dashboard: ' + error.message);
    }
}

// Load recent payments
async function loadRecentPayments() {
    try {
        const token = await currentUser.getIdToken();
        const res = await fetch('/api/clients/activity', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            document.getElementById('recentPayments').innerHTML = '<p style="color: #999;">No payment data available</p>';
            return;
        }
        
        const data = await res.json();
        const orders = data.recentOrders || [];

        if (orders.length === 0) {
            document.getElementById('recentPayments').innerHTML = '<p style="color: #999;">No recent payments</p>';
            return;
        }

        let html = '<table class="data-table" id="recentPaymentsTable"><thead><tr><th>Order ID</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>';
        
        orders.slice(0, 10).forEach(p => {
            html += `<tr>
                <td>${p.id || 'N/A'}</td>
                <td class="amount">KSh ${formatCurrency(p.total || 0)}</td>
                <td><span class="status-badge status-completed">Completed</span></td>
                <td>${p.createdAt || 'N/A'}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        document.getElementById('recentPayments').innerHTML = html;
        
        // Highlight today's orders
        highlightTodayOrders('#recentPaymentsTable');
        updateLastRefreshed();
    } catch (error) {
        console.error('Load payments error:', error);
        document.getElementById('recentPayments').innerHTML = `<div class="error">${error.message}</div>`;
    }
}

// Load recent orders
async function loadRecentOrders() {
    try {
        const token = await currentUser.getIdToken();
        const res = await fetch('/api/clients/activity', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            document.getElementById('recentOrders').innerHTML = '<p style="color: #999;">No order data available</p>';
            return;
        }
        
        const data = await res.json();
        const orders = data.recentOrders || [];

        if (orders.length === 0) {
            document.getElementById('recentOrders').innerHTML = '<p style="color: #999;">No recent orders</p>';
            return;
        }

        let html = '<table class="data-table" id="recentOrdersTable"><thead><tr><th>Order ID</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody>';
        
        orders.slice(0, 10).forEach(o => {
            html += `<tr>
                <td>${o.id || 'N/A'}</td>
                <td class="amount">KSh ${formatCurrency(o.total || 0)}</td>
                <td><span class="status-badge status-pending">Processing</span></td>
                <td>${o.createdAt || 'N/A'}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        document.getElementById('recentOrders').innerHTML = html;
        
        // Highlight today's orders
        highlightTodayOrders('#recentOrdersTable');
        updateLastRefreshed();
    } catch (error) {
        console.error('Load orders error:', error);
        document.getElementById('recentOrders').innerHTML = `<div class="error">${error.message}</div>`;
    }
}

// Load all payments with filters
async function loadPayments() {
    try {
        const token = await currentUser.getIdToken();

        const res = await fetch('/api/clients/activity', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Failed to fetch payments');
        const data = await res.json();
        const payments = data.recentOrders || [];

        let html = '<table class="data-table"><thead><tr><th>Order ID</th><th>Amount</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>';
        
        payments.forEach(p => {
            html += `<tr>
                <td>${p.id || 'N/A'}</td>
                <td class="amount">KSh ${formatCurrency(p.total || 0)}</td>
                <td><span class="status-badge status-completed">Completed</span></td>
                <td>${p.createdAt || 'N/A'}</td>
                <td><button class="btn-small" onclick="editPayment('${p.id}')">View</button></td>
            </tr>`;
        });

        html += '</tbody></table>';
        if (payments.length === 0) html = '<p style="text-align: center; color: #999;">No payment data available</p>';
        
        document.getElementById('paymentsContent').innerHTML = html;
    } catch (error) {
        console.error('Load payments error:', error);
        document.getElementById('paymentsContent').innerHTML = `<div class="error">${error.message}</div>`;
    }
}

// Load all orders with search
async function loadOrders() {
    try {
        const search = document.getElementById('orderSearch').value;
        const token = await currentUser.getIdToken();

        const res = await fetch('/api/clients/activity', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Failed to fetch orders');
        let data = await res.json();
        let orders = data.recentOrders || [];

        // Client-side filtering if search is present
        if (search) {
            orders = orders.filter(o => 
                (o.id && o.id.includes(search)) ||
                (o.userId && o.userId.toLowerCase().includes(search.toLowerCase()))
            );
        }

        let html = '<table class="data-table"><thead><tr><th>Order ID</th><th>Total</th><th>Items</th><th>Date</th></tr></thead><tbody>';
        
        orders.forEach(o => {
            const itemCount = (o.items && o.items.length) || 1;
            html += `<tr>
                <td>${o.id || 'N/A'}</td>
                <td class="amount">KSh ${formatCurrency(o.total || 0)}</td>
                <td>${itemCount} item${itemCount !== 1 ? 's' : ''}</td>
                <td>${o.createdAt || 'N/A'}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        if (orders.length === 0) html = '<p style="text-align: center; color: #999;">No orders found</p>';
        
        document.getElementById('ordersContent').innerHTML = html;
    } catch (error) {
        console.error('Load orders error:', error);
        document.getElementById('ordersContent').innerHTML = `<div class="error">${error.message}</div>`;
    }
}

// Load inventory
async function loadInventory() {
    try {
        const token = await currentUser.getIdToken();
        const res = await fetch('/api/products', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Failed to fetch products');
        let products = await res.json();

        const search = document.getElementById('productSearch').value;
        if (search) {
            products = products.filter(p => 
                p.name.toLowerCase().includes(search.toLowerCase())
            );
        }

        let html = '<table class="data-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead><tbody>';
        
        products.slice(0, 50).forEach(p => {
            const stock = p.quantity || 0;
            const stockStatus = stock === 0 ? 'status-failed' : stock < 5 ? 'status-pending' : 'status-completed';
            
            html += `<tr>
                <td>${p.name}</td>
                <td>${p.category || 'N/A'}</td>
                <td class="amount">KSh ${formatCurrency(p.price || 0)}</td>
                <td><span class="status-badge ${stockStatus}">${stock} units</span></td>
                <td><button class="btn-small" onclick="editStock('${p.id}')">Update</button></td>
            </tr>`;
        });

        html += '</tbody></table>';
        if (products.length === 0) html = '<p style="text-align: center; color: #999;">No products found</p>';
        
        document.getElementById('inventoryContent').innerHTML = html;
    } catch (error) {
        console.error('Load inventory error:', error);
        document.getElementById('inventoryContent').innerHTML = `<div class="error">${error.message}</div>`;
    }
}

// Run reconciliation
async function runReconciliation() {
    try {
        const date = document.getElementById('reconcileDate').value;
        const token = await currentUser.getIdToken();
        
        const res = await fetch('/api/admin/reconcile', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ date })
        });
        
        if (!res.ok) throw new Error('Reconciliation failed');
        const result = await res.json();

        let html = `<div style="background: #d4edda; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
            <strong>Reconciliation Complete</strong><br>
            Matched: ${result.matched || 0} payments<br>
            Unmatched: ${result.unmatched || 0} payments<br>
            Total: KSh ${formatCurrency(result.total || 0)}
        </div>`;

        if (result.unmatched > 0) {
            html += '<h3>Unmatched Payments</h3>';
            html += '<table class="data-table"><thead><tr><th>Transaction ID</th><th>Amount</th><th>Phone</th><th>Action</th></tr></thead><tbody>';
            
            // Note: Would need to fetch unmatched payments here
            html += '</tbody></table>';
        }

        document.getElementById('reconciliationContent').innerHTML = html;
    } catch (error) {
        console.error('Reconciliation error:', error);
        showError('Reconciliation error: ' + error.message);
    }
}

// Load activity logs
async function loadLogs() {
    try {
        const type = document.getElementById('logType').value;
        const token = await currentUser.getIdToken();

        const res = await fetch('/api/clients', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Failed to fetch logs');
        const data = await res.json();
        let clients = data.clients || [];

        let html = '<table class="data-table"><thead><tr><th>User Email</th><th>Last Sign In</th><th>Orders</th><th>Total Spent</th></tr></thead><tbody>';
        
        clients.slice(0, 50).forEach(c => {
            html += `<tr>
                <td>${c.email || 'N/A'}</td>
                <td>${c.lastSignIn || 'N/A'}</td>
                <td>${c.orderCount || 0}</td>
                <td class="amount">KSh ${formatCurrency(c.totalSpent || 0)}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        if (clients.length === 0) html = '<p style="text-align: center; color: #999;">No activity logs available</p>';
        
        document.getElementById('logsContent').innerHTML = html;
    } catch (error) {
        console.error('Load logs error:', error);
        document.getElementById('logsContent').innerHTML = `<div class="error">${error.message}</div>`;
    }
}

// Switch between sections
function switchSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.dashboard-section').forEach(s => s.style.display = 'none');
    
    // Show selected section
    document.getElementById(sectionId).style.display = 'block';
    
    // Update nav styling
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`[onclick="switchSection('${sectionId}')"]`).classList.add('active');

    // Load data for section
    if (sectionId === 'payments') {
        loadPayments();
    } else if (sectionId === 'orders') {
        loadOrders();
    } else if (sectionId === 'inventory') {
        loadInventory();
    } else if (sectionId === 'reconciliation') {
        // Pre-fill with today's date
        document.getElementById('reconcileDate').valueAsDate = new Date();
    } else if (sectionId === 'logs') {
        loadLogs();
    }
}

// Edit payment (stub)
function editPayment(transactionId) {
    alert(`Edit payment: ${transactionId}`);
}

// Edit stock (stub)
function editStock(productId) {
    const newStock = prompt('Enter new stock quantity:');
    if (newStock !== null) {
        alert(`Updating stock for ${productId} to ${newStock}`);
    }
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
        minimumFractionDigits: 0
    }).format(amount).replace('KES', '').trim();
}

// Update last refreshed timestamp
function updateLastRefreshed() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-KE', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    
    lastUpdated = now;
    
    const indicator = document.getElementById('lastUpdated');
    if (indicator) {
        indicator.textContent = `Last updated: ${timeString}`;
        indicator.style.color = '#4caf50';
        
        // Fade out the "updated" indicator after 5 seconds
        setTimeout(() => {
            indicator.style.color = '#999';
        }, 5000);
    }
}

// Check if order is from today
function isToday(dateString) {
    if (!dateString) return false;
    
    try {
        const orderDate = new Date(dateString);
        const today = new Date();
        
        return orderDate.toDateString() === today.toDateString();
    } catch (e) {
        return false;
    }
}

// Highlight new/today orders
function highlightTodayOrders(tableSelector) {
    const rows = document.querySelectorAll(tableSelector + ' tbody tr');
    rows.forEach(row => {
        // Get the date from the last visible cell
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) {
            const dateText = cells[cells.length - 1].textContent;
            const today = new Date().toLocaleDateString();
            
            if (dateText.includes(today)) {
                row.style.backgroundColor = '#fffacd';
                row.style.borderLeft = '4px solid #ffc107';
            } else {
                row.style.backgroundColor = 'transparent';
                row.style.borderLeft = 'none';
            }
        }
    });
}

// Show error
function showError(message) {
    const errorEl = document.getElementById('dashboardError');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
}

// Logout
async function logout() {
    try {
        await auth.signOut();
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', initAdminPanel);
