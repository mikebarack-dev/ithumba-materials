/**
 * Clients API Routes
 * Provides real-time client data and analytics for admin dashboard
 */

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const firestore = admin.firestore();
const authMiddleware = require('../middleware/auth');
const { isAdmin } = require('../middleware/auth');

// In-memory storage for client activity
let clientActivity = {};
let orderHistory = [];

/**
 * GET /api/clients
 * Get all registered clients with their activity data
 * Shows all registered users who have an account
 */
router.get('/', async (req, res) => {
    try {
        console.log('📋 [CLIENTS API] Fetching registered clients list...');
        
        const clients = [];
        
        try {
            // Get all registered users from users collection
            const usersSnapshot = await firestore.collection('users').get();
            console.log(`✅ Got ${usersSnapshot.size} registered users from users collection`);
            
            // Get all orders from main orders collection for order counts
            const allOrdersSnapshot = await firestore.collection('orders').get();
            const ordersByUser = {};
            allOrdersSnapshot.docs.forEach(doc => {
                const order = doc.data();
                const userId = order.userId || order.email;
                if (!ordersByUser[userId]) {
                    ordersByUser[userId] = [];
                }
                ordersByUser[userId].push(order);
            });
            
            for (const userDoc of usersSnapshot.docs) {
                try {
                    const userData = userDoc.data();
                    const userId = userDoc.id;
                    
                    // Get this user's orders from main orders collection
                    const userOrders = ordersByUser[userId] || [];
                    
                    const totalSpent = userOrders.reduce((sum, order) => sum + (order.total || 0), 0);
                    const orderCount = userOrders.length;
                    
                    // Format orders for display
                    const formattedOrders = userOrders.slice(0, 3).map(order => ({
                        id: order.id || 'unknown',
                        total: order.total || 0,
                        status: order.status || 'pending',
                        createdAt: order.createdAt ? (order.createdAt.toDate ? order.createdAt.toDate().toLocaleString() : new Date(order.createdAt).toLocaleString()) : 'N/A'
                    }));
                    
                    clients.push({
                        uid: userId,
                        email: userData.email || 'N/A',
                        displayName: userData.displayName || 'N/A',
                        phoneNumber: userData.phoneNumber || 'N/A',
                        createdAt: userData.createdAt || 'N/A',
                        lastSignIn: userData.lastSignIn || 'N/A',
                        status: userData.status || 'active',
                        totalSpent: totalSpent.toFixed(2),
                        orderCount: orderCount,
                        recentOrders: formattedOrders
                    });
                } catch (err) {
                    console.error(`Error processing user ${userDoc.id}:`, err.message);
                }
            }
        } catch (firestoreErr) {
            console.warn('⚠️ Firestore error getting users:', firestoreErr.message);
        }
        
        // Sort by most recent signup
        clients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        console.log(`✅ Registered clients list ready: ${clients.length} clients`);
        res.json({
            success: true,
            totalClients: clients.length,
            clients: clients
        });
    } catch (error) {
        console.error('❌ Error fetching clients:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            clients: []
        });
    }
});

/**
 * GET /api/clients/activity
 * Get real-time activity data (ADMIN ONLY)
 */
router.get('/activity', authMiddleware, isAdmin, async (req, res) => {
    try {
        console.log('📊 [CLIENTS API] Fetching activity data...');
        let recentOrders = [];
        let recentMessages = [];
        let todayRevenue = 0;
        let todayOrderCount = 0;
        try {
            // Get recent orders
            const ordersSnapshot = await firestore
                .collectionGroup('orders')
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get();
            recentOrders = ordersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt ? doc.data().createdAt.toDate().toLocaleString() : 'N/A'
            }));
            console.log(`✅ Got ${recentOrders.length} recent orders`);
        } catch (err) {
            console.warn('⚠️ Could not fetch recent orders:', err.message);
        }
        try {
            // Get recent messages
            const messagesSnapshot = await firestore
                .collection('messages')
                .orderBy('timestamp', 'desc')
                .limit(50)
                .get();
            recentMessages = messagesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp ? doc.data().timestamp.toDate().toLocaleString() : 'N/A'
            }));
            console.log(`✅ Got ${recentMessages.length} recent messages`);
        } catch (err) {
            console.warn('⚠️ Could not fetch recent messages:', err.message);
        }
        try {
            // Get today's stats
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayOrdersSnapshot = await firestore
                .collectionGroup('orders')
                .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
                .get();
            todayOrderCount = todayOrdersSnapshot.size;
            todayRevenue = todayOrdersSnapshot.docs.reduce((sum, doc) => sum + (doc.data().total || 0), 0);
            console.log(`✅ Today: ${todayOrderCount} orders, KES ${todayRevenue.toFixed(2)} revenue`);
        } catch (err) {
            console.warn('⚠️ Could not fetch today stats:', err.message);
        }
        res.json({
            success: true,
            todayStats: {
                ordersToday: todayOrderCount,
                revenueToday: todayRevenue.toFixed(2)
            },
            recentOrders: recentOrders.slice(0, 20),
            recentMessages: recentMessages.slice(0, 20)
        });
    } catch (error) {
        console.error('❌ Error fetching activity:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/clients/reports
 * Generate real-time analytics reports based on actual orders
 */
router.get('/reports', async (req, res) => {
    try {
        console.log('📈 [CLIENTS API] Generating reports from real order data...');
        
        let allOrders = [];
        let totalCustomers = 0;
        
        try {
            // Get all orders from main orders collection (not subcollections)
            const ordersSnapshot = await firestore
                .collection('orders')
                .get();
            
            allOrders = ordersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt ? (doc.data().createdAt.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt)) : new Date()
            }));
            console.log(`✅ Got ${allOrders.length} total orders from main orders collection`);
        } catch (err) {
            console.warn('⚠️ Could not fetch orders for reports:', err.message);
        }
        
        try {
            // Get total registered users (not clients collection)
            const usersSnapshot = await firestore.collection('users').get();
            totalCustomers = usersSnapshot.size;
            console.log(`✅ Got ${totalCustomers} registered users`);
        } catch (err) {
            console.warn('⚠️ Could not fetch registered users count:', err.message);
        }
        
        // Calculate metrics
        const totalRevenue = allOrders.reduce((sum, order) => sum + (order.total || 0), 0);
        const totalOrders = allOrders.length;
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        
        // Orders by date (last 30 days)
        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);
        
        const last30DaysOrders = allOrders.filter(order => new Date(order.createdAt) >= last30Days);
        const last30DaysRevenue = last30DaysOrders.reduce((sum, order) => sum + (order.total || 0), 0);
        
        // Get top products from orders in last 30 days
        const productSales = {};
        last30DaysOrders.forEach(order => {
            if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    const productName = item.name || 'Unknown';
                    if (!productSales[productName]) {
                        productSales[productName] = { quantity: 0, revenue: 0 };
                    }
                    productSales[productName].quantity += item.quantity || 1;
                    productSales[productName].revenue += (item.price || 0) * (item.quantity || 1);
                });
            }
        });
        
        const topProducts = Object.entries(productSales)
            .map(([name, data]) => ({
                name,
                quantity: data.quantity,
                revenue: data.revenue.toFixed(2)
            }))
            .sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue))
            .slice(0, 10);
        
        // Customer metrics - unique customers from orders
        const ordersByCustomer = {};
        allOrders.forEach(order => {
            const customerId = order.userId || order.email || 'unknown';
            if (!ordersByCustomer[customerId]) {
                ordersByCustomer[customerId] = 0;
            }
            ordersByCustomer[customerId]++;
        });
        
        const uniqueCustomersWithOrders = Object.keys(ordersByCustomer).length;
        const returningCustomers = Object.values(ordersByCustomer).filter(count => count > 1).length;
        const oneTimeCustomers = uniqueCustomersWithOrders - returningCustomers;
        
        console.log(`✅ Reports generated: Revenue KES ${totalRevenue.toFixed(2)}, Orders ${totalOrders}, Customers ${uniqueCustomersWithOrders}`);
        
        res.json({
            success: true,
            overview: {
                totalRevenue: totalRevenue.toFixed(2),
                totalOrders: totalOrders,
                averageOrderValue: averageOrderValue.toFixed(2),
                totalRegisteredUsers: totalCustomers,
                customersWithOrders: uniqueCustomersWithOrders,
                returningCustomers: returningCustomers,
                newCustomers: oneTimeCustomers
            },
            last30Days: {
                revenue: last30DaysRevenue.toFixed(2),
                orders: last30DaysOrders.length,
                averageOrderValue: last30DaysOrders.length > 0 ? (last30DaysRevenue / last30DaysOrders.length).toFixed(2) : '0.00'
            },
            topProducts: topProducts,
            customerMetrics: {
                totalRegisteredUsers: totalCustomers,
                customersWithOrders: uniqueCustomersWithOrders,
                returningRate: uniqueCustomersWithOrders > 0 ? ((returningCustomers / uniqueCustomersWithOrders) * 100).toFixed(2) : '0.00',
                conversionRate: totalCustomers > 0 ? ((uniqueCustomersWithOrders / totalCustomers) * 100).toFixed(2) : '0.00'
            }
        });
    } catch (error) {
        console.error('❌ Error generating reports:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/clients/:uid/activity
 * Update client's last active timestamp
 * Called whenever a client performs an action
 */
router.post('/:uid/activity', async (req, res) => {
    try {
        const { uid } = req.params;
        
        await firestore.collection('clients').doc(uid).update({
            lastActive: new Date().toISOString()
        });
        
        console.log(`✅ Updated lastActive for client ${uid}`);
        
        res.json({
            success: true,
            message: 'Activity recorded'
        });
    } catch (error) {
        console.error('Error updating client activity:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/clients/:uid
 * Get detailed client information
 */
router.get('/:uid', async (req, res) => {
    try {
        const { uid } = req.params;
        
        // Get user from Firebase Auth
        const userRecord = await admin.auth().getUser(uid);
        
        // Get user profile
        const userDoc = await firestore.collection('users').doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        
        // Get all orders
        const ordersSnapshot = await firestore
            .collection('users')
            .doc(uid)
            .collection('orders')
            .orderBy('createdAt', 'desc')
            .get();
        
        const orders = ordersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt ? doc.data().createdAt.toDate().toLocaleString() : 'N/A'
        }));
        
        // Get all messages
        const messagesSnapshot = await firestore
            .collection('messages')
            .where('userEmail', '==', userRecord.email)
            .orderBy('timestamp', 'desc')
            .get();
        
        const messages = messagesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp ? doc.data().timestamp.toDate().toLocaleString() : 'N/A'
        }));
        
        // Calculate stats
        const totalSpent = orders.reduce((sum, order) => sum + (order.total || 0), 0);
        const totalItems = orders.reduce((sum, order) => {
            const itemCount = order.items ? order.items.reduce((itemSum, item) => itemSum + (item.quantity || 1), 0) : 0;
            return sum + itemCount;
        }, 0);
        
        res.json({
            success: true,
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName || 'N/A',
                phoneNumber: userRecord.phoneNumber || 'N/A',
                createdAt: new Date(userRecord.metadata.creationTime).toLocaleString(),
                lastSignIn: new Date(userRecord.metadata.lastSignInTime).toLocaleString(),
                customClaims: userRecord.customClaims || {}
            },
            stats: {
                totalOrders: orders.length,
                totalSpent: totalSpent.toFixed(2),
                totalItems: totalItems,
                averageOrderValue: orders.length > 0 ? (totalSpent / orders.length).toFixed(2) : '0.00'
            },
            orders: orders,
            messages: messages,
            profileData: userData
        });
    } catch (error) {
        console.error('Error fetching client details:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
