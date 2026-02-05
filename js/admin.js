/**
 * Admin Panel JavaScript
 * Manages products: View, Add, Edit, Delete
 * PROTECTED - Only admins can access
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const ADMIN_EMAIL = 'mikebarack5525@gmail.com';

/**
 * Sync all Firebase Auth users to clients collection
 */
window.syncClientsData = async function(event) {
    try {
        console.log('🔄 Starting client sync...');
        
        const btn = event?.target || document.querySelector('[onclick*="syncClientsData"]');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Syncing...';
        }
        
        // Get fresh token from Firebase
        const token = await currentUser.getIdToken();
        
        const response = await fetch('/api/clients/sync', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ Sync Complete!\n\nNew clients created: ${data.syncedCount}\nAlready existed: ${data.skippedCount}\nTotal processed: ${data.totalProcessed}`);
            console.log('✅ Sync successful:', data);
            
            // Reload the dashboard to show new data
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            alert(`❌ Sync failed: ${data.error}`);
            console.error('Sync error:', data);
        }
    } catch (error) {
        console.error('Error syncing clients:', error);
        alert('❌ Error syncing clients: ' + error.message);
    } finally {
        const btn = event?.target || document.querySelector('[onclick*="syncClientsData"]');
        if (btn) {
            btn.disabled = false;
            btn.textContent = '🔄 Sync Clients';
        }
    }
}

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

let auth;
let currentUser;
let allProducts = [];
let editingProductId = null;

// Initialize Firebase
async function initFirebase() {
    await waitForConfig();
    const firebaseConfig = JSON.parse(window.__firebase_config);
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
}

// Check authentication and authorization
async function checkAuth() {
    await initFirebase();

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.log('Not authenticated, redirecting to login');
            window.location.href = '/login.html?redirect=/admin';
            return;
        }

        // Check if admin
        const isAdmin = user.email === ADMIN_EMAIL;
        
        console.log('User email:', user.email);
        console.log('Is admin:', isAdmin);

        if (!isAdmin) {
            console.log('User is not admin, access denied');
            document.body.innerHTML = `
                <div style="text-align:center;padding:50px;">
                    <h2 style="color:#dc3545;">❌ Access Denied</h2>
                    <p>You do not have permission to access this page.</p>
                    <p>Admin email: ${ADMIN_EMAIL}</p>
                    <p>Your email: ${user.email}</p>
                    <button onclick="location.href='/index.html'" style="padding:10px 20px;background:#ff6b35;color:white;border:none;border-radius:4px;cursor:pointer;">Back to Shop</button>
                </div>
            `;
            return;
        }

        currentUser = user;
        console.log('Admin authenticated:', user.email);
        
        // Show admin panel
        document.body.style.display = 'block';
        const adminInfoEl = document.getElementById('admin-info');
        if (adminInfoEl) {
            adminInfoEl.textContent = `Welcome, ${user.email}`;
        }
        
        // Load products and stats
        await loadProducts();
        await loadStats();
        
        // Pre-load clients and reports data in the background
        console.log('⏳ Pre-loading clients and reports data...');
        setTimeout(() => {
            if (typeof loadClientsData === 'function') {
                loadClientsData().catch(err => console.error('Failed to pre-load clients:', err));
            }
            if (typeof loadReportsData === 'function') {
                loadReportsData().catch(err => console.error('Failed to pre-load reports:', err));
            }
        }, 1000);
        
        setupEventListeners();
    });
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('product-form').addEventListener('submit', addProduct);
    document.getElementById('edit-form').addEventListener('submit', updateProduct);
    document.getElementById('search-products').addEventListener('input', filterProducts);
}

// Switch tabs
window.switchTab = function(tabName) {
    console.log('🔄 Switching to tab:', tabName);
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab by ID
    const tab = document.getElementById(tabName);
    if (tab) {
        tab.classList.add('active');
        console.log('✅ Tab shown:', tabName);
    } else {
        console.error('❌ Tab element not found with ID:', tabName);
    }
    
    // Mark the button as active - find by onclick attribute
    const buttons = document.querySelectorAll('.tab-btn');
    for (let btn of buttons) {
        const onclickAttr = btn.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(`'${tabName}'`)) {
            btn.classList.add('active');
            console.log('✅ Button marked active');
            break;
        }
    }
    
    // Auto-load data for certain tabs
    if (tabName === 'orders' && typeof loadOrdersFromAdmin === 'function') {
        console.log('📋 Loading orders immediately...');
        loadOrdersFromAdmin().catch(err => console.error('Failed to load orders:', err));
    } else if (tabName === 'clients' && typeof loadClientsData === 'function') {
        console.log('👥 Loading clients...');
        loadClientsData().catch(err => console.error('Failed to load clients:', err));
    } else if (tabName === 'reports' && typeof loadReportsData === 'function') {
        console.log('📊 Loading reports...');
        loadReportsData().catch(err => console.error('Failed to load reports:', err));
    }
};

// Load all products
async function loadProducts() {
    try {
        // Show loading state
        const loadingEl = document.getElementById('products-loading');
        const contentEl = document.getElementById('products-content');
        if (loadingEl) loadingEl.classList.add('show');
        if (contentEl) contentEl.style.display = 'none';

        const token = await currentUser.getIdToken();
        const response = await fetch('/api/products', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);

        allProducts = await response.json();
        console.log('Loaded products:', allProducts.length);

        // Hide loading and show content
        if (loadingEl) loadingEl.classList.remove('show');
        if (contentEl) contentEl.style.display = 'block';
        
        renderProducts(allProducts);
    } catch (error) {
        console.error('Error loading products:', error);
        showMessage('Error loading products: ' + error.message, 'error', false);
    }
}

// Render products table
function renderProducts(products) {
    const tbody = document.getElementById('products-list');
    
    console.log('renderProducts called with:', products.length, 'products');
    console.log('tbody element:', tbody);
    
    if (!tbody) {
        console.error('ERROR: products-list tbody not found!');
        return;
    }
    
    if (!products || products.length === 0) {
        console.log('No products to render');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;">No products found</td></tr>';
        return;
    }

    const html = products.map((product, index) => `
        <tr>
            <td><strong>${escapeHtml(product.name)}</strong></td>
            <td>${escapeHtml(product.category || 'N/A')}</td>
            <td>${escapeHtml(product.unit || 'N/A')}</td>
            <td>KES ${parseFloat(product.price || 0).toFixed(2)}</td>
            <td>
                <button class="action-btn edit-btn" onclick="editProduct('${product.id}')">Edit</button>
                <button class="action-btn delete-btn" onclick="deleteProduct('${product.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
    
    console.log('Setting innerHTML with', products.length, 'rows');
    tbody.innerHTML = html;
    
    // Add debug info
    const firstRow = tbody.querySelector('tr');
    console.log('First row rendered:', firstRow);
    console.log('Total rows now:', tbody.querySelectorAll('tr').length);
    console.log('innerHTML set successfully');
    
    // Add visible debug message
    const contentEl = document.getElementById('products-content');
    if (contentEl) {
        const debugEl = document.createElement('div');
        debugEl.style.cssText = 'background: #d4edda; padding: 10px; margin-bottom: 10px; color: #155724; border: 1px solid #c3e6cb; border-radius: 4px;';
        debugEl.textContent = `✅ ${products.length} products loaded`;
        contentEl.parentNode.insertBefore(debugEl, contentEl);
    }
}

// Upload image to backend (which uploads to Firebase Storage)
async function uploadImage(fileInput, progressBarElementId) {
    const file = fileInput.files[0];
    if (!file) return null;

    // Validate file
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        throw new Error('Image must be smaller than 5MB');
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        throw new Error('Only JPG, PNG, and WebP images are allowed');
    }

    try {
        // Show progress bar
        const progressContainer = document.getElementById(progressBarElementId);
        if (progressContainer) {
            progressContainer.style.display = 'block';
        }

        // Create FormData for multipart file upload
        const formData = new FormData();
        formData.append('file', file);

        // Get auth token
        const token = await currentUser.getIdToken();

        // Upload via backend API
        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Upload failed');
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Upload failed');
        }

        // Hide progress bar
        if (progressContainer) {
            progressContainer.style.display = 'none';
            const progressBar = progressContainer.querySelector('div:last-child');
            if (progressBar) progressBar.style.width = '0%';
        }

        return data.url;
    } catch (error) {
        // Hide progress bar
        const progressContainer = document.getElementById(progressBarElementId);
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
        throw error;
    }
}

// Filter products by search
function filterProducts() {
    const searchTerm = document.getElementById('search-products').value.toLowerCase();
    const filtered = allProducts.filter(product => {
        const name = (product.name || '').toLowerCase();
        const category = (product.category || '').toLowerCase();
        return name.includes(searchTerm) || category.includes(searchTerm);
    });
    renderProducts(filtered);
}

// Add product
async function addProduct(e) {
    e.preventDefault();

    // Check for image file
    const imageFileInput = document.getElementById('product-image-file');
    let imageUrl = document.getElementById('product-image').value || '';

    if (imageFileInput.files.length > 0) {
        try {
            showMessage('Uploading image...', 'info', true);
            imageUrl = await uploadImage(imageFileInput, 'image-upload-progress');
            document.getElementById('product-image').value = imageUrl;
        } catch (error) {
            showMessage('Error: ' + error.message, 'error', true);
            return;
        }
    }

    const product = {
        name: document.getElementById('product-name').value,
        category: document.getElementById('product-category').value,
        unit: document.getElementById('product-unit').value,
        price: parseFloat(document.getElementById('product-price').value),
        image: imageUrl,
        sku: document.getElementById('product-sku').value || '',
        description: document.getElementById('product-description').value || '',
        featured: document.getElementById('product-featured').checked || false
    };

    if (!product.name || !product.category || !product.unit || !product.price) {
        showMessage('Please fill in all required fields', 'error', true);
        return;
    }

    try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(product)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.error || 'Failed to add product');
        }

        showMessage('Product added successfully!', 'success', true);
        document.getElementById('product-form').reset();
        
        // Reload products
        setTimeout(() => loadProducts(), 1000);
    } catch (error) {
        console.error('Error adding product:', error);
        showMessage('Error: ' + error.message, 'error', true);
    }
}

// Edit product
window.editProduct = function(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        alert('Product not found');
        return;
    }

    editingProductId = productId;

    document.getElementById('edit-product-name').value = product.name || '';
    document.getElementById('edit-product-category').value = product.category || '';
    document.getElementById('edit-product-unit').value = product.unit || '';
    document.getElementById('edit-product-price').value = product.price || '';
    document.getElementById('edit-product-image').value = product.image || '';
    document.getElementById('edit-product-sku').value = product.sku || '';
    document.getElementById('edit-product-description').value = product.description || '';
    document.getElementById('edit-product-featured').checked = product.featured || false;

    document.getElementById('edit-modal').classList.add('active');
};

// Close edit modal
window.closeEditModal = function() {
    document.getElementById('edit-modal').classList.remove('active');
    editingProductId = null;
};

// Update product
async function updateProduct(e) {
    e.preventDefault();

    if (!editingProductId) {
        showMessage('No product selected for editing', 'error', false);
        return;
    }

    // Check for image file
    const imageFileInput = document.getElementById('edit-product-image-file');
    let imageUrl = document.getElementById('edit-product-image').value || '';

    if (imageFileInput.files.length > 0) {
        try {
            showMessage('Uploading image...', 'info', false);
            imageUrl = await uploadImage(imageFileInput, 'edit-image-upload-progress');
            document.getElementById('edit-product-image').value = imageUrl;
        } catch (error) {
            document.getElementById('modal-error').textContent = 'Error: ' + error.message;
            document.getElementById('modal-error').style.display = 'block';
            return;
        }
    }

    const updates = {
        name: document.getElementById('edit-product-name').value,
        category: document.getElementById('edit-product-category').value,
        unit: document.getElementById('edit-product-unit').value,
        price: parseFloat(document.getElementById('edit-product-price').value),
        image: imageUrl,
        sku: document.getElementById('edit-product-sku').value || '',
        description: document.getElementById('edit-product-description').value || '',
        featured: document.getElementById('edit-product-featured').checked || false
    };

    try {
        const token = await currentUser.getIdToken();
        const response = await fetch(`/api/products/${editingProductId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updates)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.error || 'Failed to update product');
        }

        showMessage('Product updated successfully!', 'success', false);
        closeEditModal();
        
        // Reload products
        setTimeout(() => loadProducts(), 1000);
    } catch (error) {
        console.error('Error updating product:', error);
        document.getElementById('modal-error').textContent = 'Error: ' + error.message;
        document.getElementById('modal-error').style.display = 'block';
    }
}

// Delete product
window.deleteProduct = async function(productId) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }

    try {
        const token = await currentUser.getIdToken();
        const response = await fetch(`/api/products/${productId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.error || 'Failed to delete product');
        }

        showMessage('Product deleted successfully!', 'success', false);
        
        // Reload products
        setTimeout(() => loadProducts(), 1000);
    } catch (error) {
        console.error('Error deleting product:', error);
        showMessage('Error: ' + error.message, 'error', false);
    }
};

// Load statistics
async function loadStats() {
    try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/products', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const products = await response.json();
        
        // Calculate stats
        const totalProducts = products.length;
        const categories = new Set(products.map(p => p.category)).size;
        const totalValue = products.reduce((sum, p) => sum + (p.price * (p.stock || 0)), 0);
        const lowStock = products.filter(p => (p.stock || 0) < 10).length;

        const statsHtml = `
            <div class="stat-card">
                <h3>Total Products</h3>
                <div class="number">${totalProducts}</div>
            </div>
            <div class="stat-card">
                <h3>Categories</h3>
                <div class="number">${categories}</div>
            </div>
            <div class="stat-card">
                <h3>Inventory Value</h3>
                <div class="number">KES ${totalValue.toFixed(0)}</div>
            </div>
            <div class="stat-card">
                <h3>Low Stock</h3>
                <div class="number">${lowStock}</div>
            </div>
        `;

        document.getElementById('stats-container').innerHTML = statsHtml;
    } catch (error) {
        console.error('Error loading stats:', error);
        document.getElementById('stats-container').innerHTML = '<p>Error loading statistics</p>';
    }
}

// Show message
function showMessage(message, type, isForm) {
    const messageEl = document.getElementById(isForm ? 'form-' + type + '-message' : type + '-message');
    if (messageEl) {
        messageEl.textContent = message;
        messageEl.style.display = 'block';
        
        if (type === 'success') {
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 3000);
        }
    }
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}// Load clients data
window.loadClientsData = async function() {
    try {
        console.log('🔄 Loading clients data...');
        document.getElementById('clients-loading').classList.add('show');
        document.getElementById('clients-content').style.display = 'none';
        
        const token = await currentUser.getIdToken();
        console.log('✅ Got auth token');
        
        // Fetch clients list
        console.log('📡 Calling /api/clients endpoint...');
        const clientsResponse = await fetch('/api/clients', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log(`📊 Clients API Response Status: ${clientsResponse.status}`);
        
        if (!clientsResponse.ok) {
            throw new Error(`Failed to fetch clients: ${clientsResponse.status}`);
        }
        
        const clientsData = await clientsResponse.json();
        console.log('✅ Clients data received:', clientsData);
        
        // Fetch activity data
        console.log('📡 Calling /api/clients/activity endpoint...');
        const activityResponse = await fetch('/api/clients/activity', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log(`📊 Activity API Response Status: ${activityResponse.status}`);
        
        if (!activityResponse.ok) {
            throw new Error(`Failed to fetch activity: ${activityResponse.status}`);
        }
        
        const activityData = await activityResponse.json();
        console.log('✅ Activity data received:', activityData);
        
        // Update stats
        document.getElementById('total-clients').textContent = clientsData.totalClients;
        document.getElementById('today-orders').textContent = activityData.todayStats.ordersToday;
        document.getElementById('today-revenue').textContent = `KES ${parseFloat(activityData.todayStats.revenueToday).toLocaleString()}`;
        
        // Populate clients table
        const clientsList = document.getElementById('clients-list');
        console.log('📋 clientsData.clients:', clientsData.clients);
        console.log('📋 Number of clients:', clientsData.clients ? clientsData.clients.length : 'undefined');
        
        if (!clientsData.clients || clientsData.clients.length === 0) {
            console.warn('⚠️ No clients found in data');
            clientsList.innerHTML = '<tr><td colspan="6" style="padding:20px;text-align:center;color:#999;">No clients found</td></tr>';
        } else {
            console.log('🎨 Rendering', clientsData.clients.length, 'clients...');
            const html = clientsData.clients.map((client, index) => {
                console.log(`Client ${index}:`, client);
                return `
                <tr style="border-bottom:1px solid #ddd;">
                    <td style="padding:12px;"><strong>${client.email || 'N/A'}</strong></td>
                    <td style="padding:12px;">${client.displayName || 'N/A'}</td>
                    <td style="padding:12px;text-align:center;">${client.orderCount || 0}</td>
                    <td style="padding:12px;"><strong>KES ${parseFloat(client.totalSpent || 0).toLocaleString()}</strong></td>
                    <td style="padding:12px;">${client.lastSignIn || 'N/A'}</td>
                    <td style="padding:12px;">
                        <button onclick="viewClientDetails('${client.uid}')" style="padding:6px 12px;background:#007bff;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">View</button>
                    </td>
                </tr>
            `;
            }).join('');
            console.log('✅ HTML generated, length:', html.length);
            clientsList.innerHTML = html;
            console.log('✅ HTML set to clients-list');
        }
        
        document.getElementById('clients-loading').classList.remove('show');
        document.getElementById('clients-content').style.display = 'block';
        console.log('✅ Clients data loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading clients data:', error);
        document.getElementById('clients-loading').classList.remove('show');
        document.getElementById('clients-content').style.display = 'block';
        document.getElementById('clients-list').innerHTML = `<tr><td colspan="6" style="padding:20px;text-align:center;color:#dc3545;">Error: ${error.message}</td></tr>`;
    }
};

// View individual client details
window.viewClientDetails = async function(uid) {
    try {
        const token = await currentUser.getIdToken();
        const response = await fetch(`/api/clients/${uid}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error(`Failed to fetch client details: ${response.status}`);
        const client = await response.json();
        
        let detailsHtml = `
            <h3>${client.user.email}</h3>
            <div style="background:#f9f9f9;padding:15px;border-radius:4px;margin:15px 0;">
                <p><strong>Display Name:</strong> ${client.user.displayName}</p>
                <p><strong>Phone:</strong> ${client.user.phoneNumber}</p>
                <p><strong>Account Created:</strong> ${client.user.createdAt}</p>
                <p><strong>Last Sign In:</strong> ${client.user.lastSignIn}</p>
            </div>
            
            <h4>Purchase Statistics</h4>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;">
                <div style="background:#f0f0f0;padding:15px;border-radius:4px;text-align:center;">
                    <div style="font-size:24px;font-weight:bold;">${client.stats.totalOrders}</div>
                    <div style="color:#666;font-size:12px;">Total Orders</div>
                </div>
                <div style="background:#f0f0f0;padding:15px;border-radius:4px;text-align:center;">
                    <div style="font-size:24px;font-weight:bold;">KES ${parseFloat(client.stats.totalSpent).toLocaleString()}</div>
                    <div style="color:#666;font-size:12px;">Total Spent</div>
                </div>
                <div style="background:#f0f0f0;padding:15px;border-radius:4px;text-align:center;">
                    <div style="font-size:24px;font-weight:bold;">${client.stats.totalItems}</div>
                    <div style="color:#666;font-size:12px;">Items Purchased</div>
                </div>
                <div style="background:#f0f0f0;padding:15px;border-radius:4px;text-align:center;">
                    <div style="font-size:24px;font-weight:bold;">KES ${parseFloat(client.stats.averageOrderValue).toLocaleString()}</div>
                    <div style="color:#666;font-size:12px;">Avg Order Value</div>
                </div>
            </div>
            
            <h4>Recent Orders</h4>
            ${client.orders.length > 0 ? `
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead style="background:#333;color:white;">
                        <tr>
                            <th style="padding:10px;text-align:left;">Order ID</th>
                            <th style="padding:10px;text-align:left;">Date</th>
                            <th style="padding:10px;text-align:left;">Items</th>
                            <th style="padding:10px;text-align:left;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${client.orders.slice(0, 5).map(order => `
                            <tr style="border-bottom:1px solid #ddd;">
                                <td style="padding:10px;">${order.id}</td>
                                <td style="padding:10px;">${order.createdAt}</td>
                                <td style="padding:10px;">${order.itemCount || 0}</td>
                                <td style="padding:10px;"><strong>KES ${order.total.toLocaleString()}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p style="color:#999;">No orders yet</p>'}
        `;
        
        alert(`Client Details - ${client.user.email}\n\nOrders: ${client.stats.totalOrders}\nTotal Spent: KES ${parseFloat(client.stats.totalSpent).toLocaleString()}\n\n(Check console for full details)`);
        console.log('Client Details:', client);
        
    } catch (error) {
        console.error('Error loading client details:', error);
        alert('Error loading client details: ' + error.message);
    }
};

// Load reports data
window.loadReportsData = async function() {
    try {
        console.log('📊 Loading reports data...');
        document.getElementById('reports-loading').classList.add('show');
        document.getElementById('reports-content').style.display = 'none';
        
        const token = await currentUser.getIdToken();
        console.log('✅ Got auth token');
        
        console.log('📡 Calling /api/clients/reports endpoint...');
        const response = await fetch('/api/clients/reports', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log(`API Response Status: ${response.status}`);
        
        if (!response.ok) {
            console.error(`❌ Failed to fetch reports: ${response.status}`);
            throw new Error(`Failed to fetch reports: ${response.status}`);
        }
        
        const reports = await response.json();
        console.log('✅ Reports data received:', reports);
        
        // Update overview metrics
        document.getElementById('total-revenue').textContent = `KES ${parseFloat(reports.overview.totalRevenue).toLocaleString()}`;
        document.getElementById('total-orders-report').textContent = reports.overview.totalOrders;
        document.getElementById('avg-order-value').textContent = `KES ${parseFloat(reports.overview.averageOrderValue).toLocaleString()}`;
        document.getElementById('total-customers').textContent = reports.overview.totalCustomers;
        
        // Update 30-day metrics
        document.getElementById('revenue-30d').textContent = `KES ${parseFloat(reports.last30Days.revenue).toLocaleString()}`;
        document.getElementById('orders-30d').textContent = reports.last30Days.orders;
        document.getElementById('avg-order-30d').textContent = `KES ${parseFloat(reports.last30Days.averageOrderValue).toLocaleString()}`;
        
        // Update customer metrics
        document.getElementById('returning-customers').textContent = reports.overview.returningCustomers;
        document.getElementById('returning-rate').textContent = `${parseFloat(reports.customerMetrics.returningRate).toFixed(2)}%`;
        document.getElementById('new-customers').textContent = reports.overview.newCustomers;
        document.getElementById('churn-rate').textContent = `${parseFloat(reports.customerMetrics.churnRate).toFixed(2)}%`;
        
        // Populate top products
        const topProductsList = document.getElementById('top-products-list');
        if (reports.topProducts.length === 0) {
            topProductsList.innerHTML = '<tr><td colspan="3" style="padding:20px;text-align:center;color:#999;">No products sold yet</td></tr>';
        } else {
            topProductsList.innerHTML = reports.topProducts.map((product, index) => `
                <tr style="border-bottom:1px solid #ddd;">
                    <td style="padding:12px;"><strong>${index + 1}. ${product.name}</strong></td>
                    <td style="padding:12px;text-align:center;">${product.quantity}</td>
                    <td style="padding:12px;"><strong>KES ${parseFloat(product.revenue).toLocaleString()}</strong></td>
                </tr>
            `).join('');
        }
        
        document.getElementById('reports-loading').classList.remove('show');
        document.getElementById('reports-content').style.display = 'block';
        console.log('✅ Reports data loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading reports:', error);
        alert('Error loading reports: ' + error.message);
        document.getElementById('reports-loading').classList.remove('show');
        document.getElementById('reports-content').style.display = 'block';
    }
};
// Logout
window.logoutAdmin = async function() {
    try {
        await signOut(auth);
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out');
    }
};

// ========== ORDER MANAGEMENT FUNCTIONS ==========

window.loadOrdersFromAdmin = async function() {
    try {
        console.log('🔵 loadOrdersFromAdmin called');
        
        // Show loading state
        const container = document.getElementById('ordersContainer');
        if (container) {
            container.innerHTML = '<div style="text-align: center; padding: 20px;"><p>⏳ Loading orders...</p></div>';
        }
        
        // ALWAYS refresh the token before API call - don't reuse old tokens!
        let token = null;
        if (currentUser) {
            console.log('🔐 Refreshing token from Firebase...');
            token = await currentUser.getIdToken(true); // Force refresh
            localStorage.setItem('authToken', token);
            console.log('✅ Fresh token obtained');
        } else {
            token = localStorage.getItem('authToken');
            console.log('ℹ️ Using cached token from localStorage');
        }
        
        if (!token) {
            console.error('❌ No token available');
            if (container) {
                container.innerHTML = '<p style="color: red;">❌ Error: Not authenticated. Please log in again.</p>';
            }
            return;
        }

        const searchEl = document.getElementById('ordersSearchInput');
        const statusEl = document.getElementById('ordersStatusFilter');
        const search = searchEl ? searchEl.value : '';
        const status = statusEl ? statusEl.value : '';
        
        const params = new URLSearchParams({
            limit: 100,
            page: 1,
            ...(search && { search }),
            ...(status && { status })
        });

        console.log('📡 Calling API: /api/admin/orders?' + params.toString());
        const response = await fetch(`/api/admin/orders?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('📡 API Response Status:', response.status);
        const data = await response.json();
        console.log('📦 FULL DATA OBJECT:', JSON.stringify(data).substring(0, 500));
        console.log('✅ Orders loaded:', data.orders ? data.orders.length : 0, 'orders');
        console.log('Data structure:', { success: data.success, ordersCount: data.orders?.length, hasOrders: data.orders && data.orders.length > 0 });

        if (!response.ok) {
            console.error('❌ API Error:', response.status, data.error || data.message);
            if (container) {
                container.innerHTML = `<p style="color: red;">❌ Error: ${data.error || data.message || 'Failed to load orders'}</p>`;
            }
            return;
        }

        console.log('About to check if success and orders...');
        if (data.success && data.orders && data.orders.length > 0) {
            console.log('✅ BUILDING TABLE FOR', data.orders.length, 'orders');
            let tableRows = '';
            data.orders.forEach(order => {
                const statusColor = {
                    pending: '#fff3cd',
                    paid: '#d4edda',
                    processing: '#cfe2ff',
                    shipped: '#e2e3e5',
                    delivered: '#d1e7dd',
                    cancelled: '#f8d7da'
                }[order.status] || '#fff';
                
                const phoneDisplay = order.billingDetails?.phone || 'N/A';
                const phoneLink = phoneDisplay !== 'N/A' ? `tel:${phoneDisplay}` : '#';
                
                tableRows += `<tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 12px;">${order.orderId}</td>
                    <td style="padding: 12px;">${order.billingDetails?.firstName || ''} ${order.billingDetails?.lastName || ''}</td>
                    <td style="padding: 12px;"><a href="${phoneLink}" style="color: #FF4E00; text-decoration: none; font-weight: 500;">${phoneDisplay}</a></td>
                    <td style="padding: 12px;">KSh ${(order.total || 0).toLocaleString()}</td>
                    <td style="padding: 12px;"><span style="background: ${statusColor}; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${order.status.toUpperCase()}</span></td>
                    <td style="padding: 12px;">${new Date(order.createdAt).toLocaleDateString()}</td>
                    <td style="padding: 12px; text-align: center;">
                        <select id="status-${order.id}" style="padding: 6px 8px; font-size: 12px; border: 1px solid #ddd; border-radius: 4px; margin-right: 5px;" onchange="updateOrderStatus('${order.id}', this.value)">
                            <option value="" selected>Change Status</option>
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <button onclick="viewAdminOrder('${order.id}')" style="padding: 6px 12px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 5px;">View</button>
                        <button onclick="deleteAdminOrder('${order.id}')" style="padding: 6px 12px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Delete</button>
                    </td>
                </tr>`;
            });
            
            const html = `<table style="width: 100%; border-collapse: collapse; background: white;">
                <thead style="background: #f8f9fa;">
                    <tr>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Order ID</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Customer</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd; min-width: 120px;">Phone</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Total</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Status</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Date</th>
                        <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Action</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>`;
            
            console.log('📝 About to set HTML in container');
            console.log('Container element:', container);
            console.log('Container ID:', container?.id);
            console.log('Container classes:', container?.className);
            
            // Check if the orders tab is visible
            const ordersTab = document.getElementById('orders');
            console.log('Orders tab element:', ordersTab);
            console.log('Orders tab classes:', ordersTab?.className);
            console.log('Orders tab has active class:', ordersTab?.classList.contains('active'));
            
            // Check computed styles
            if (ordersTab) {
                const styles = window.getComputedStyle(ordersTab);
                console.log('Orders tab computed display:', styles.display);
                console.log('Orders tab computed visibility:', styles.visibility);
            }
            
            if (container) {
                console.log('Setting innerHTML...');
                container.innerHTML = html;
                console.log('✅ HTML SET! Container now has:', container.innerHTML.substring(0, 100));
                
                // Verify it's visible
                const containerStyles = window.getComputedStyle(container);
                console.log('Container computed display:', containerStyles.display);
            } else {
                console.error('❌ Container is NULL!');
            }
        } else if (data.success && (!data.orders || data.orders.length === 0)) {
            console.log('ℹ️ No orders found or empty array');
            console.log('Orders value:', data.orders);
            if (container) {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;"><p>📭 No orders found</p></div>';
            }
        } else {
            console.error('❌ Unexpected data structure. success:', data.success, 'orders:', data.orders ? 'exists' : 'missing');
            if (container) {
                container.innerHTML = `<p style="color: red;">❌ Unexpected response format</p>`;
            }
        }
    } catch (err) {
        console.error('❌ Error loading orders:', err);
        const container = document.getElementById('ordersContainer');
        if (container) {
            container.innerHTML = `<p style="color: red;">❌ Error: ${err.message}</p>`;
        }
    }
};

// Setup real-time order listener
window.setupOrdersListener = function() {
    console.log('🔔 Setting up orders listener...');
    
    // Load orders once when Orders tab becomes active (not constantly refreshing)
    const ordersTab = document.getElementById('orders');
    if (ordersTab) {
        // Find the Orders button
        const ordersBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => 
            btn.onclick && btn.onclick.toString().includes("'orders'")
        );
        
        if (ordersBtn) {
            // Add click listener to reload when tab is clicked
            ordersBtn.addEventListener('click', () => {
                console.log('📋 Orders tab clicked, loading...');
                loadOrdersFromAdmin().catch(err => console.error('Load error:', err));
            });
        }
    }
};

window.viewAdminOrder = async function(orderId) {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/admin/orders/${orderId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        if (data.success) {
            const order = data.order;
            const itemsHtml = (order.items || []).map(item => `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 8px;">${item.name}</td>
                    <td style="padding: 8px; text-align: center;">${item.quantity}</td>
                    <td style="padding: 8px; text-align: right;">KSh ${(item.price || 0).toLocaleString()}</td>
                    <td style="padding: 8px; text-align: right;">KSh ${(item.subtotal || 0).toLocaleString()}</td>
                </tr>
            `).join('');

            const details = `
                <h3>${order.orderId}</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <div>
                        <strong>Customer:</strong> ${order.billingDetails?.firstName || ''} ${order.billingDetails?.lastName || ''}<br>
                        <strong>Email:</strong> ${order.billingDetails?.email || 'N/A'}<br>
                        <strong>Phone:</strong> ${order.billingDetails?.phone || 'N/A'}<br>
                        <strong>City:</strong> ${order.billingDetails?.city || 'N/A'}
                    </div>
                    <div>
                        <strong>Status:</strong> ${order.status}<br>
                        <strong>Total:</strong> KSh ${(order.total || 0).toLocaleString()}<br>
                        <strong>Created:</strong> ${new Date(order.createdAt).toLocaleString()}<br>
                        <button onclick="editAdminOrder('${orderId}')" style="margin-top: 10px; padding: 8px 16px; background: #f39c12; color: white; border: none; border-radius: 4px; cursor: pointer;">Edit</button>
                    </div>
                </div>
                <div style="margin-top: 20px;">
                    <h4>Items</h4>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="background: #f8f9fa;">
                            <tr>
                                <th style="padding: 8px; text-align: left;">Product</th>
                                <th style="padding: 8px; text-align: center;">Qty</th>
                                <th style="padding: 8px; text-align: right;">Price</th>
                                <th style="padding: 8px; text-align: right;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                            <tr style="border-top: 2px solid #ddd; font-weight: 600;">
                                <td colspan="3" style="padding: 8px; text-align: right;">TOTAL:</td>
                                <td style="padding: 8px; text-align: right;">KSh ${(order.total || 0).toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;

            alert(details);
        }
    } catch (err) {
        console.error('Error viewing order:', err);
        alert('Error loading order details');
    }
};

window.deleteAdminOrder = async function(orderId) {
    try {
        if (!confirm('🗑️ Are you sure you want to delete this order? This cannot be undone.')) {
            return;
        }

        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/admin/orders/${orderId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        if (data.success) {
            alert('✅ Order deleted successfully');
            loadOrdersFromAdmin();
        } else {
            alert('❌ Error: ' + data.message);
        }
    } catch (err) {
        console.error('Error deleting order:', err);
        alert('❌ Error deleting order');
    }
};

window.editAdminOrder = async function(orderId) {
    const newStatus = prompt('Enter new status (pending/paid/processing/shipped/delivered/cancelled):');
    if (!newStatus) return;

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/admin/orders/${orderId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await response.json();
        if (data.success) {
            alert('Order updated successfully!');
            loadOrdersFromAdmin();
        }
    } catch (err) {
        console.error('Error updating order:', err);
        alert('Error updating order');
    }
};

window.adminAddItemRow = function() {
    const container = document.getElementById('adminItemsContainer');
    const rowHtml = `
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 10px; margin-bottom: 10px;">
            <input type="text" placeholder="Product name" class="admin-item-name" required style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <input type="number" placeholder="Qty" class="admin-item-qty" min="1" value="1" required style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <input type="number" placeholder="Price" class="admin-item-price" min="0" step="0.01" required style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <button type="button" onclick="this.parentElement.remove()" style="background: #e74c3c; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">×</button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', rowHtml);
};

window.adminCreateOrder = async function(e) {
    e.preventDefault();

    try {
        const token = localStorage.getItem('authToken');
        const customerName = document.getElementById('adminCustomerName').value;
        const customerEmail = document.getElementById('adminCustomerEmail').value;
        const customerPhone = document.getElementById('adminCustomerPhone').value;
        const notes = document.getElementById('adminOrderNotes').value;
        const markAsPaid = document.getElementById('adminMarkAsPaid').checked;

        const itemElements = document.querySelectorAll('.admin-item-name');
        if (itemElements.length === 0) {
            alert('Please add at least one item');
            return;
        }

        const items = Array.from(document.querySelectorAll('[class*="admin-item"]')).reduce((acc, el, idx) => {
            const itemIdx = Math.floor(idx / 3);
            if (!acc[itemIdx]) acc[itemIdx] = {};
            
            if (el.classList.contains('admin-item-name')) acc[itemIdx].name = el.value;
            else if (el.classList.contains('admin-item-qty')) acc[itemIdx].quantity = parseInt(el.value);
            else if (el.classList.contains('admin-item-price')) acc[itemIdx].price = parseFloat(el.value);
            
            return acc;
        }, []);

        const response = await fetch('/api/admin/orders', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customerName,
                customerEmail,
                customerPhone,
                items,
                notes,
                markAsPaid
            })
        });

        const data = await response.json();
        if (data.success) {
            alert('Order created successfully!');
            resetAdminForm();
            switchTab('orders');
            loadOrdersFromAdmin();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) {
        console.error('Error creating order:', err);
        alert('Error creating order');
    }
};

window.resetAdminForm = function() {
    document.getElementById('adminCreateOrderForm').reset();
    document.getElementById('adminItemsContainer').innerHTML = '';
    adminAddItemRow();
};

// Initialize on page load
/**
 * Update order status (admin function)
 */
window.updateOrderStatus = async function(orderId, newStatus) {
    if (!newStatus) {
        console.log('No status selected');
        return;
    }

    try {
        // Get fresh token
        const token = await currentUser.getIdToken(true);
        
        console.log(`🔄 Updating order ${orderId} status to ${newStatus}...`);
        
        // Call the API to update status
        const response = await fetch(`/api/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            console.error('❌ Update failed:', data);
            alert(`❌ Error updating order: ${data.message || 'Unknown error'}`);
            // Reset the dropdown
            document.getElementById(`status-${orderId}`).value = '';
            return;
        }
        
        console.log('✅ Order status updated successfully:', data);
        alert(`✅ Order ${orderId} status updated to ${newStatus.toUpperCase()}`);
        
        // Reset dropdown
        document.getElementById(`status-${orderId}`).value = '';
        
        // Reload orders to show updated status
        console.log('🔄 Reloading orders to show updated status');
        await loadOrdersFromAdmin();
        
    } catch (error) {
        console.error('❌ Error updating order status:', error);
        alert(`❌ Error updating order: ${error.message}`);
        // Reset the dropdown
        document.getElementById(`status-${orderId}`).value = '';
    }
}

async function initializeAdmin() {
    console.log('🔧 Initializing admin...');
    await checkAuth();
    
    // Wait a bit for Firebase to set currentUser
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (!currentUser) {
        console.error('❌ currentUser not set after auth check');
        return;
    }
    
    console.log('🔧 Admin initialized, currentUser:', currentUser.email);
    console.log('🔧 Force loading orders on startup');
    await loadOrdersFromAdmin();
    
    // Start real-time listener
    console.log('🔧 Starting orders listener');
    setupOrdersListener();
}

initializeAdmin().catch(err => console.error('Init error:', err));
