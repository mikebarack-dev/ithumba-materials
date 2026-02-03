// routes/orders.js - Handle order creation

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const firestore = admin.firestore();
const websocketService = require('../services/websocketService');
const logger = require('../middleware/logger');

/**
 * POST /api/orders
 * Create a new order from checkout
 */
router.post('/', async (req, res) => {
    try {
        const userId = req.userId; // Set by authMiddleware
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required.' 
            });
        }

        const { billingDetails, cartItems, subtotal, shipping, total, timestamp } = req.body;

        console.log('📦 Creating order for user:', userId);
        console.log('   Subtotal:', subtotal, 'Shipping:', shipping, 'Total:', total);
        console.log('   Customer Phone: 📱', billingDetails?.phone);
        console.log('   Customer Name:', billingDetails?.firstName, billingDetails?.lastName);

        // Validate required fields
        if (!billingDetails || !cartItems || typeof total !== 'number') {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid order data' 
            });
        }

        // Generate order ID
        const orderId = `order-${Date.now()}`;

        // Create order document
        const orderData = {
            orderId: orderId,
            userId: userId,
            billingDetails: {
                firstName: billingDetails.firstName,
                lastName: billingDetails.lastName,
                email: billingDetails.email,
                phone: billingDetails.phone,
                country: billingDetails.country,
                streetAddress: billingDetails.streetAddress,
                city: billingDetails.city,
                county: billingDetails.county,
                postcode: billingDetails.postcode
            },
            items: cartItems.map(item => ({
                id: item.id || '',
                name: item.name || 'Unknown Product',
                category: item.category || 'Uncategorized',
                quantity: item.quantity || 1,
                price: item.price || 0,
                subtotal: (item.price || 0) * (item.quantity || 1),
                unit: item.unit || 'pc'
            })),
            subtotal: subtotal || 0,
            shipping: shipping || 0,
            total: total || 0,
            paymentMethod: 'mpesa',
            status: 'pending', // Will be 'paid' once M-Pesa confirms
            createdAt: new Date(timestamp),
            updatedAt: new Date(),
            notes: ''
        };

        // Save order to Firestore
        await firestore.collection('orders').doc(orderId).set(orderData);
        console.log('✅ Order created:', orderId);

        // Update client profile with order info
        try {
            const clientRef = firestore.collection('clients').doc(userId);
            const clientDoc = await clientRef.get();
            
            if (clientDoc.exists) {
                // Update existing client
                await clientRef.update({
                    lastActive: new Date().toISOString(),
                    totalOrders: admin.firestore.FieldValue.increment(1),
                    totalSpent: admin.firestore.FieldValue.increment(total)
                });
            } else {
                // Create new client if doesn't exist
                const userRef = firestore.collection('users').doc(userId);
                const userDoc = await userRef.get();
                const userData = userDoc.exists ? userDoc.data() : {};
                
                await clientRef.set({
                    uid: userId,
                    email: billingDetails.email || userData.email || 'unknown',
                    displayName: userData.displayName || billingDetails.firstName + ' ' + billingDetails.lastName,
                    phoneNumber: billingDetails.phone || userData.phoneNumber || '',
                    photoURL: userData.photoURL || '',
                    createdAt: new Date().toISOString(),
                    lastActive: new Date().toISOString(),
                    status: 'active',
                    totalOrders: 1,
                    totalSpent: total,
                    messageCount: 0
                });
            }
            console.log('✅ Client profile updated/created for order:', userId);
        } catch (clientErr) {
            console.warn('⚠️ Could not update client profile:', clientErr.message);
            // Don't fail the order if client update fails
        }

        // Update inventory - decrement stock for each item
        const batch = firestore.batch();
        
        for (const item of cartItems) {
            if (item.id) {
                const productRef = firestore.collection('products').doc(item.id);
                const productDoc = await productRef.get();
                
                if (productDoc.exists) {
                    const currentQuantity = productDoc.data().quantity || 0;
                    const newQuantity = Math.max(0, currentQuantity - (item.quantity || 1));
                    
                    batch.update(productRef, {
                        quantity: newQuantity,
                        lastSold: new Date().toISOString(),
                        totalSold: (productDoc.data().totalSold || 0) + (item.quantity || 1)
                    });
                    
                    console.log(`📦 Updated inventory: ${item.name} - ${currentQuantity} → ${newQuantity}`);
                }
            }
        }

        // Clear user's cart after successful order creation
        const cartRef = firestore.collection(`users/${userId}/cart`);
        const cartSnapshot = await cartRef.get();
        
        cartSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        console.log('✅ Cart cleared for user:', userId);

        // Return success with order details
        res.json({
            success: true,
            message: 'Order created successfully',
            orderId: orderId,
            total: total,
            status: 'pending',
            phone: billingDetails.phone,
            customerName: `${billingDetails.firstName} ${billingDetails.lastName}`
        });

    } catch (error) {
        console.error('❌ Error creating order:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Error creating order: ' + error.message 
        });
    }
});

/**
 * GET /api/orders/:orderId
 * Get order details
 */
router.get('/:orderId', async (req, res) => {
    try {
        const userId = req.userId;
        const { orderId } = req.params;

        const orderDoc = await firestore.collection('orders').doc(orderId).get();

        if (!orderDoc.exists) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        const orderData = orderDoc.data();

        // Verify user owns this order
        if (orderData.userId !== userId) {
            return res.status(403).json({ 
                success: false, 
                message: 'Unauthorized' 
            });
        }

        res.json(orderData);

    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching order' 
        });
    }
});

/**
 * GET /api/orders
 * Get all orders for current user
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.userId;
        console.log('📋 GET /api/orders - userId:', userId);

        if (!userId) {
            console.log('⚠️ No userId found');
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required.' 
            });
        }

        console.log('🔍 Querying orders for user:', userId);
        const snapshot = await firestore
            .collection('orders')
            .where('userId', '==', userId)
            .get();

        let orders = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt ? (data.createdAt instanceof Date ? data.createdAt.toISOString() : data.createdAt) : new Date().toISOString()
            };
        });

        // Sort by createdAt descending (handle timestamps safely)
        orders.sort((a, b) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            return timeB - timeA;
        });

        console.log('✅ Found', orders.length, 'orders for user:', userId);

        res.json(orders);

    } catch (error) {
        console.error('❌ Error fetching orders:', error.message, error.code);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching orders',
            error: error.message
        });
    }
});

/**
 * PATCH /api/orders/:orderId/status
 * Update order status (admin only)
 */
router.patch('/:orderId/status', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        
        // Valid statuses
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }
        
        // Get the order to find userId
        const orderDoc = await firestore.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        const orderData = orderDoc.data();
        const userId = orderData.userId;
        
        // Update the order in Firestore
        const orderRef = firestore.collection('orders').doc(orderId);
        
        await orderRef.update({
            status: status,
            updatedAt: new Date(),
            statusUpdatedAt: new Date()
        });
        
        console.log(`✅ Order ${orderId} status updated to: ${status}`);
        
        // Send WebSocket notification to customer
        try {
            const statusEmojis = {
                'pending': '⏳',
                'processing': '⚙️',
                'shipped': '🚚',
                'delivered': '📦',
                'cancelled': '❌'
            };
            const emoji = statusEmojis[status] || '📦';
            const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
            
            websocketService.notifyOrderStatusChange(
                userId,
                orderId,
                status,
                { emoji, statusLabel }
            );
        } catch (wsErr) {
            console.warn('⚠️ WebSocket notification failed:', wsErr.message);
            // Don't fail the update if WebSocket fails
        }
        
        res.json({
            success: true,
            message: `Order status updated to ${status}`,
            orderId: orderId,
            status: status
        });
    } catch (error) {
        console.error('❌ Error updating order status:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error updating order status',
            error: error.message
        });
    }
});

module.exports = router;

