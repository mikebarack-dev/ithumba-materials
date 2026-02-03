// services/paymentService.js - Payment tracking and duplicate detection
const admin = require('firebase-admin');
const firestore = admin.firestore();
const { logger } = require('../middleware/logger');

class PaymentService {
    /**
     * Check for duplicate payments
     * Prevents same payment from being processed twice
     */
    static async checkDuplicate(userId, amount, phone, timeWindowMinutes = 5) {
        try {
            const timeThreshold = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
            
            const query = await firestore.collection('payments')
                .where('userId', '==', userId)
                .where('phone', '==', phone)
                .where('amount', '==', amount)
                .where('timestamp', '>=', timeThreshold)
                .limit(1)
                .get();
            
            if (!query.empty) {
                const existingPayment = query.docs[0].data();
                logger.warn({
                    type: 'DUPLICATE_PAYMENT_DETECTED',
                    userId,
                    phone,
                    amount,
                    previousStatus: existingPayment.status,
                    checkoutRequestId: query.docs[0].id
                });
                
                return {
                    isDuplicate: true,
                    existingPayment: {
                        id: query.docs[0].id,
                        ...existingPayment
                    }
                };
            }
            
            return { isDuplicate: false };
        } catch (error) {
            logger.error({
                type: 'DUPLICATE_CHECK_ERROR',
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Log payment transaction
     */
    static async logTransaction(data) {
        try {
            const transactionLog = {
                timestamp: new Date(),
                userId: data.userId,
                checkoutRequestId: data.checkoutRequestId,
                orderId: data.orderId,
                amount: data.amount,
                phone: data.phone,
                status: data.status,
                resultCode: data.resultCode || null,
                resultDescription: data.resultDescription || null,
                mpesaReceiptNumber: data.mpesaReceiptNumber || null,
                metadata: data.metadata || {}
            };

            await firestore.collection('transaction_logs').add(transactionLog);
            
            logger.info({
                type: 'PAYMENT_LOGGED',
                checkoutRequestId: data.checkoutRequestId,
                status: data.status,
                amount: data.amount
            });

            return transactionLog;
        } catch (error) {
            logger.error({
                type: 'TRANSACTION_LOG_ERROR',
                error: error.message,
                data
            });
            throw error;
        }
    }

    /**
     * Reconcile payments with orders
     * Run daily to match payments with orders
     */
    static async reconcilePayments(date = new Date()) {
        try {
            const dateStart = new Date(date);
            dateStart.setHours(0, 0, 0, 0);
            const dateEnd = new Date(date);
            dateEnd.setHours(23, 59, 59, 999);

            // Find all completed payments for the day
            const payments = await firestore.collection('payments')
                .where('status', '==', 'completed')
                .where('timestamp', '>=', dateStart)
                .where('timestamp', '<=', dateEnd)
                .get();

            let matched = 0;
            let unmatched = 0;
            const reconciliation = [];

            for (const paymentDoc of payments.docs) {
                const payment = paymentDoc.data();
                
                // Find corresponding order
                const orderQuery = await firestore.collection('orders')
                    .where('userId', '==', payment.userId)
                    .where('amount', '==', payment.amount)
                    .where('paymentId', '==', paymentDoc.id)
                    .limit(1)
                    .get();

                if (!orderQuery.empty) {
                    matched++;
                    reconciliation.push({
                        paymentId: paymentDoc.id,
                        orderId: orderQuery.docs[0].id,
                        status: 'matched',
                        amount: payment.amount,
                        receipt: payment.mpesaReceiptNumber
                    });
                } else {
                    unmatched++;
                    reconciliation.push({
                        paymentId: paymentDoc.id,
                        status: 'unmatched',
                        amount: payment.amount,
                        receipt: payment.mpesaReceiptNumber,
                        alert: true // Needs investigation
                    });
                }
            }

            logger.info({
                type: 'DAILY_RECONCILIATION',
                date: date.toDateString(),
                totalPayments: payments.size,
                matched,
                unmatched
            });

            // Store reconciliation report
            await firestore.collection('reconciliation_reports').add({
                date: dateStart,
                totalPayments: payments.size,
                matched,
                unmatched,
                details: reconciliation,
                createdAt: new Date()
            });

            return {
                date: dateStart,
                totalPayments: payments.size,
                matched,
                unmatched,
                details: reconciliation
            };
        } catch (error) {
            logger.error({
                type: 'RECONCILIATION_ERROR',
                error: error.message,
                date
            });
            throw error;
        }
    }

    /**
     * Get payment analytics
     */
    static async getAnalytics(days = 7) {
        try {
            const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

            const payments = await firestore.collection('payments')
                .where('timestamp', '>=', dateThreshold)
                .get();

            let totalRevenue = 0;
            let completedCount = 0;
            let failedCount = 0;
            let pendingCount = 0;

            payments.forEach(doc => {
                const payment = doc.data();
                if (payment.status === 'completed') {
                    totalRevenue += payment.amount;
                    completedCount++;
                } else if (payment.status === 'failed') {
                    failedCount++;
                } else {
                    pendingCount++;
                }
            });

            const successRate = completedCount > 0 
                ? (completedCount / (completedCount + failedCount) * 100).toFixed(2)
                : 0;

            logger.info({
                type: 'ANALYTICS_REPORT',
                period: `Last ${days} days`,
                totalRevenue,
                completedCount,
                failedCount,
                pendingCount,
                successRate: `${successRate}%`
            });

            return {
                period: `Last ${days} days`,
                totalRevenue,
                completedPayments: completedCount,
                failedPayments: failedCount,
                pendingPayments: pendingCount,
                successRate: `${successRate}%`,
                averageTransaction: totalRevenue > 0 ? (totalRevenue / completedCount).toFixed(2) : 0
            };
        } catch (error) {
            logger.error({
                type: 'ANALYTICS_ERROR',
                error: error.message
            });
            throw error;
        }
    }
}

module.exports = PaymentService;
