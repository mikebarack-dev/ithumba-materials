// routes/admin.js - Admin endpoints for monitoring and management
const express = require('express');
const router = express.Router();
const PaymentService = require('../services/paymentService');
const { logger } = require('../middleware/logger');
const admin = require('firebase-admin');
const firestore = admin.firestore();
const { isAdmin } = require('../middleware/auth');

// ✅ SECURITY: Use centralized isAdmin middleware from auth.js
// All routes below are protected with: authMiddleware (in server.js) + isAdmin (per-route)

// GET /api/admin/analytics - Payment analytics
router.get('/analytics', isAdmin, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const stats = await PaymentService.getAnalytics(days);
        
        logger.info({
            type: 'ADMIN_ANALYTICS_VIEWED',
            userId: req.userId,
            days
        });
        
        res.json({
            success: true,
            data: stats,
            viewedAt: new Date()
        });
    } catch (error) {
        logger.error({ type: 'ADMIN_ANALYTICS_ERROR', error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/admin/reconcile - Run reconciliation for a specific date
router.get('/reconcile', isAdmin, async (req, res) => {
    try {
        const dateStr = req.query.date; // Format: YYYY-MM-DD
        const date = dateStr ? new Date(dateStr) : new Date();
        
        const report = await PaymentService.reconcilePayments(date);
        
        logger.info({
            type: 'ADMIN_RECONCILIATION_RUN',
            userId: req.userId,
            date: date.toDateString(),
            matched: report.matched,
            unmatched: report.unmatched
        });
        
        res.json({
            success: true,
            report,
            generatedAt: new Date()
        });
    } catch (error) {
        logger.error({ type: 'ADMIN_RECONCILIATION_ERROR', error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/admin/payments - List recent payments
router.get('/payments', isAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const status = req.query.status; // 'pending', 'completed', 'failed'
        
        let query = firestore.collection('payments')
            .orderBy('timestamp', 'desc')
            .limit(limit);
        
        if (status) {
            query = query.where('status', '==', status);
        }
        
        const snapshot = await query.get();
        const payments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
        }));
        
        logger.info({
            type: 'ADMIN_PAYMENTS_VIEWED',
            userId: req.userId,
            count: payments.length,
            status: status || 'all'
        });
        
        res.json({
            success: true,
            count: payments.length,
            payments
        });
    } catch (error) {
        logger.error({ type: 'ADMIN_PAYMENTS_ERROR', error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/admin/orders - List recent orders
router.get('/orders', isAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        
        const snapshot = await firestore.collection('orders')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        
        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
        }));
        
        logger.info({
            type: 'ADMIN_ORDERS_VIEWED',
            userId: req.userId,
            count: orders.length
        });
        
        res.json({
            success: true,
            count: orders.length,
            orders
        });
    } catch (error) {
        logger.error({ type: 'ADMIN_ORDERS_ERROR', error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/admin/transaction-log - Detailed transaction logs
router.get('/transaction-log', isAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const userId = req.query.userId; // Optional: filter by user
        
        let query = firestore.collection('transaction_logs')
            .orderBy('timestamp', 'desc')
            .limit(limit);
        
        if (userId) {
            query = query.where('userId', '==', userId);
        }
        
        const snapshot = await query.get();
        const logs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
        }));
        
        logger.info({
            type: 'ADMIN_TRANSACTION_LOG_VIEWED',
            userId: req.userId,
            count: logs.length,
            filteredBy: userId || 'all'
        });
        
        res.json({
            success: true,
            count: logs.length,
            logs
        });
    } catch (error) {
        logger.error({ type: 'ADMIN_TRANSACTION_LOG_ERROR', error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/admin/unmatched-payments - Find problematic payments
router.get('/unmatched-payments', isAdmin, async (req, res) => {
    try {
        // Get all completed payments
        const paymentsSnapshot = await firestore.collection('payments')
            .where('status', '==', 'completed')
            .get();
        
        const unmatched = [];
        
        for (const paymentDoc of paymentsSnapshot.docs) {
            const payment = paymentDoc.data();
            
            // Check if order exists
            const orderQuery = await firestore.collection('orders')
                .where('paymentId', '==', paymentDoc.id)
                .limit(1)
                .get();
            
            if (orderQuery.empty) {
                unmatched.push({
                    paymentId: paymentDoc.id,
                    userId: payment.userId,
                    amount: payment.amount,
                    phone: payment.phone,
                    mpesaReceipt: payment.mpesaReceiptNumber,
                    timestamp: payment.completedAt
                });
            }
        }
        
        logger.info({
            type: 'ADMIN_UNMATCHED_PAYMENTS_CHECK',
            userId: req.userId,
            unmatchedCount: unmatched.length
        });
        
        res.json({
            success: true,
            unmatchedCount: unmatched.length,
            payments: unmatched
        });
    } catch (error) {
        logger.error({ type: 'ADMIN_UNMATCHED_ERROR', error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/admin/manual-reconcile - Manually reconcile a payment with an order
router.post('/manual-reconcile', isAdmin, async (req, res) => {
    try {
        const { paymentId, orderId } = req.body;
        
        if (!paymentId || !orderId) {
            return res.status(400).json({
                success: false,
                error: 'paymentId and orderId required'
            });
        }
        
        // Update order with payment ID
        await firestore.collection('orders').doc(orderId).update({
            paymentId,
            manualReconciliedAt: new Date(),
            manualReconciliedBy: req.userId
        });
        
        logger.info({
            type: 'ADMIN_MANUAL_RECONCILE',
            userId: req.userId,
            paymentId,
            orderId
        });
        
        res.json({
            success: true,
            message: 'Payment and order reconciled'
        });
    } catch (error) {
        logger.error({ type: 'ADMIN_RECONCILE_ERROR', error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/admin/dashboard - Overall dashboard stats
router.get('/dashboard', isAdmin, async (req, res) => {
    try {
        // Get today's stats
        const todayStats = await PaymentService.getAnalytics(1);
        
        // Get week's stats
        const weekStats = await PaymentService.getAnalytics(7);
        
        // Get unmatched
        const paymentsSnapshot = await firestore.collection('payments')
            .where('status', '==', 'completed')
            .get();
        
        let unmatched = 0;
        for (const paymentDoc of paymentsSnapshot.docs) {
            const orderQuery = await firestore.collection('orders')
                .where('paymentId', '==', paymentDoc.id)
                .limit(1)
                .get();
            if (orderQuery.empty) unmatched++;
        }
        
        logger.info({
            type: 'ADMIN_DASHBOARD_VIEWED',
            userId: req.userId
        });
        
        res.json({
            success: true,
            dashboard: {
                today: todayStats,
                week: weekStats,
                alerts: {
                    unmatchedPayments: unmatched,
                    requiresAttention: unmatched > 0
                }
            }
        });
    } catch (error) {
        logger.error({ type: 'ADMIN_DASHBOARD_ERROR', error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
