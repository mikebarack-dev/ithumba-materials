// routes/admin-orders.js - Admin order management

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const firestore = admin.firestore();

// Middleware to check if user is admin (basic check - in production use proper role system)
const isAdmin = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        // Check if user is admin (check in users collection for isAdmin flag)
        const userRef = firestore.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (userDoc.exists && userDoc.data().isAdmin) {
            next();
        } else {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
    } catch (err) {
        console.error('Admin check error:', err);
        return res.status(500).json({ success: false, message: 'Error checking admin status' });
    }
};

/**
 * GET /api/admin/orders
 * Get all orders with optional filtering
 */
router.get('/', isAdmin, async (req, res) => {
    try {
        const { status, search, limit = 50, page = 1 } = req.query;
        
        console.log('📋 Fetching orders - Status:', status, 'Search:', search);
        
        let query = firestore.collection('orders');
        
        // Filter by status if provided
        if (status) {
            query = query.where('status', '==', status);
        }
        
        // Get total count
        const countSnapshot = await query.get();
        const totalOrders = countSnapshot.size;
        
        // Get paginated results, ordered by most recent first
        const snapshot = await query
            .orderBy('createdAt', 'desc')
            .limit(parseInt(limit))
            .offset((parseInt(page) - 1) * parseInt(limit))
            .get();
        
        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
            updatedAt: doc.data().updatedAt?.toDate?.() || new Date(doc.data().updatedAt)
        }));
        
        // Filter by search term if provided (client-side for now)
        let filteredOrders = orders;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredOrders = orders.filter(order => 
                order.orderId.includes(search) ||
                order.billingDetails?.email?.toLowerCase().includes(searchLower) ||
                order.billingDetails?.phone?.includes(search) ||
                order.billingDetails?.firstName?.toLowerCase().includes(searchLower) ||
                order.billingDetails?.lastName?.toLowerCase().includes(searchLower)
            );
        }
        
        res.json({
            success: true,
            orders: filteredOrders,
            pagination: {
                total: totalOrders,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalOrders / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('❌ Error fetching orders:', err);
        res.status(500).json({ success: false, message: 'Error fetching orders' });
    }
});

/**
 * GET /api/admin/orders/:orderId
 * Get single order details
 */
router.get('/:orderId', isAdmin, async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const orderDoc = await firestore.collection('orders').doc(orderId).get();
        
        if (!orderDoc.exists) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        
        const orderData = orderDoc.data();
        
        // Get payment info if exists
        let paymentData = null;
        const paymentDoc = await firestore.collection('payments').doc(orderData.checkoutRequestId || '').get();
        if (paymentDoc.exists) {
            paymentData = paymentDoc.data();
        }
        
        res.json({
            success: true,
            order: {
                id: orderDoc.id,
                ...orderData,
                createdAt: orderData.createdAt?.toDate?.() || new Date(orderData.createdAt),
                updatedAt: orderData.updatedAt?.toDate?.() || new Date(orderData.updatedAt)
            },
            payment: paymentData
        });
    } catch (err) {
        console.error('❌ Error fetching order:', err);
        res.status(500).json({ success: false, message: 'Error fetching order' });
    }
});

/**
 * PATCH /api/admin/orders/:orderId
 * Update order status and details
 */
router.patch('/:orderId', isAdmin, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, notes, trackingNumber } = req.body;
        
        console.log('📝 Updating order:', orderId, 'Status:', status);
        
        const orderRef = firestore.collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        
        if (!orderDoc.exists) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        
        // Build update object
        const updateData = {
            updatedAt: new Date()
        };
        
        if (status) {
            updateData.status = status;
        }
        
        if (notes !== undefined) {
            updateData.notes = notes;
        }
        
        if (trackingNumber !== undefined) {
            updateData.trackingNumber = trackingNumber;
        }
        
        await orderRef.update(updateData);
        
        console.log('✅ Order updated:', orderId);
        
        res.json({
            success: true,
            message: 'Order updated successfully',
            order: {
                id: orderId,
                ...updateData
            }
        });
    } catch (err) {
        console.error('❌ Error updating order:', err);
        res.status(500).json({ success: false, message: 'Error updating order' });
    }
});

/**
 * POST /api/admin/orders/:orderId/mark-paid
 * Manually mark order as paid (admin override)
 */
router.post('/:orderId/mark-paid', isAdmin, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { paymentMethod = 'cash', paymentRef = '' } = req.body;
        
        console.log('💰 Marking order as paid:', orderId, 'Method:', paymentMethod);
        
        const orderRef = firestore.collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        
        if (!orderDoc.exists) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        
        const orderData = orderDoc.data();
        
        // Update order status to paid
        await orderRef.update({
            status: 'paid',
            paymentMethod: paymentMethod,
            paymentRef: paymentRef,
            paidAt: new Date(),
            updatedAt: new Date(),
            adminPaid: true,
            adminPaidBy: req.userId,
            adminPaidAt: new Date()
        });
        
        // Update client stats if exists
        if (orderData.userId) {
            const clientRef = firestore.collection('clients').doc(orderData.userId);
            await clientRef.update({
                lastActive: new Date().toISOString()
            }).catch(err => console.warn('Could not update client:', err));
        }
        
        console.log('✅ Order marked as paid:', orderId);
        
        res.json({
            success: true,
            message: 'Order marked as paid successfully'
        });
    } catch (err) {
        console.error('❌ Error marking order as paid:', err);
        res.status(500).json({ success: false, message: 'Error marking order as paid' });
    }
});

/**
 * POST /api/admin/orders
 * Create order as admin (no payment required)
 */
router.post('/', isAdmin, async (req, res) => {
    try {
        const { customerName, customerEmail, customerPhone, items, notes, markAsPaid } = req.body;
        
        console.log('📦 Admin creating order for:', customerName);
        
        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Order must have items' });
        }
        
        // Calculate totals
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shipping = 0; // Admin orders are free shipping
        const total = subtotal + shipping;
        
        // Generate order ID
        const orderId = `order-${Date.now()}`;
        
        // Create order document
        const orderData = {
            orderId: orderId,
            userId: 'admin-created',
            billingDetails: {
                firstName: customerName.split(' ')[0] || 'Admin',
                lastName: customerName.split(' ').slice(1).join(' ') || 'Order',
                email: customerEmail || 'no-email@ithumba.com',
                phone: customerPhone || 'N/A',
                country: 'Kenya',
                streetAddress: 'Admin Created',
                city: 'N/A',
                county: 'N/A',
                postcode: '00000'
            },
            items: items.map(item => ({
                id: item.id || '',
                name: item.name || 'Unknown Product',
                category: item.category || 'Uncategorized',
                quantity: item.quantity || 1,
                price: item.price || 0,
                subtotal: (item.price || 0) * (item.quantity || 1),
                unit: item.unit || 'pc'
            })),
            subtotal: subtotal,
            shipping: shipping,
            total: total,
            paymentMethod: 'admin-created',
            status: markAsPaid ? 'paid' : 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdByAdmin: req.userId,
            notes: notes || '',
            adminCreated: true
        };
        
        if (markAsPaid) {
            orderData.paidAt = new Date();
            orderData.adminPaid = true;
            orderData.adminPaidBy = req.userId;
            orderData.adminPaidAt = new Date();
        }
        
        // Save order to Firestore
        await firestore.collection('orders').doc(orderId).set(orderData);
        console.log('✅ Admin order created:', orderId);
        
        res.json({
            success: true,
            message: 'Order created successfully',
            orderId: orderId,
            order: {
                id: orderId,
                ...orderData
            }
        });
    } catch (err) {
        console.error('❌ Error creating admin order:', err);
        res.status(500).json({ success: false, message: 'Error creating order' });
    }
});

/**
 * GET /api/admin/orders/stats/summary
 * Get order statistics
 */
router.get('/stats/summary', isAdmin, async (req, res) => {
    try {
        const ordersRef = firestore.collection('orders');
        
        // Get counts by status
        const allOrders = await ordersRef.get();
        
        const stats = {
            total: allOrders.size,
            pending: 0,
            paid: 0,
            processing: 0,
            shipped: 0,
            delivered: 0,
            cancelled: 0,
            totalRevenue: 0,
            averageOrderValue: 0
        };
        
        allOrders.docs.forEach(doc => {
            const data = doc.data();
            stats[data.status] = (stats[data.status] || 0) + 1;
            if (data.status === 'paid' || data.status === 'delivered' || data.status === 'shipped') {
                stats.totalRevenue += data.total || 0;
            }
        });
        
        stats.averageOrderValue = stats.total > 0 ? stats.totalRevenue / stats.total : 0;
        
        res.json({
            success: true,
            stats: stats
        });
    } catch (err) {
        console.error('❌ Error getting stats:', err);
        res.status(500).json({ success: false, message: 'Error getting statistics' });
    }
});

/**
 * DELETE /api/admin/orders/:orderId
 * Delete an order (admin only)
 */
router.delete('/:orderId', isAdmin, async (req, res) => {
    try {
        const { orderId } = req.params;
        console.log('🗑️ Deleting order:', orderId);
        
        const orderRef = firestore.collection('orders').doc(orderId);
        await orderRef.delete();
        
        res.json({
            success: true,
            message: 'Order deleted successfully'
        });
    } catch (err) {
        console.error('❌ Error deleting order:', err);
        res.status(500).json({ success: false, message: 'Error deleting order' });
    }
});

/**
 * GET /api/orders/customer/all
 * Get orders for current customer (by email or userId)
 */
router.get('/customer/all', async (req, res) => {
    try {
        const { email, userId } = req.query;
        
        if (!email && !userId) {
            return res.status(400).json({ success: false, message: 'Email or userId required' });
        }
        
        let snapshot;
        
        if (userId) {
            console.log('👤 Fetching orders for user ID:', userId);
            snapshot = await firestore.collection('orders')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();
        } else {
            // Also try searching by email (case-insensitive)
            console.log('👤 Fetching orders for email:', email);
            
            // First try exact match
            snapshot = await firestore.collection('orders')
                .where('billingDetails.email', '==', email)
                .orderBy('createdAt', 'desc')
                .get();
            
            // If no results, try lowercase match
            if (snapshot.empty) {
                console.log('📭 No exact email match, trying all orders for manual match');
                const allOrders = await firestore.collection('orders')
                    .orderBy('createdAt', 'desc')
                    .get();
                
                snapshot = {
                    empty: false,
                    docs: allOrders.docs.filter(doc => 
                        doc.data().billingDetails?.email?.toLowerCase() === email.toLowerCase()
                    )
                };
                
                if (snapshot.docs.length === 0) {
                    snapshot = { empty: true, docs: [] };
                }
            }
        }
        
        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
            updatedAt: doc.data().updatedAt?.toDate?.() || new Date(doc.data().updatedAt)
        }));
        
        console.log('📦 Found', orders.length, 'orders');
        
        res.json({
            success: true,
            orders: orders
        });
    } catch (err) {
        console.error('❌ Error fetching customer orders:', err);
        res.status(500).json({ success: false, message: 'Error fetching orders' });
    }
});

module.exports = router;
