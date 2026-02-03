// services/emailService.js - Email notifications and receipts
const nodemailer = require('nodemailer');
const { logger } = require('../middleware/logger');

// Configure email transporter
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_FROM,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Verify connection
transporter.verify((error, success) => {
    if (error) {
        logger.warn({
            type: 'EMAIL_SERVICE_WARN',
            message: 'Email service not configured - receipts will not be sent',
            error: error.message
        });
    } else {
        logger.info({ type: 'EMAIL_SERVICE_READY', message: 'Email service connected' });
    }
});

class EmailService {
    /**
     * Send message reply email to user
     */
    static async sendMessageReply(userEmail, userName, adminReply) {
        try {
            const htmlContent = `
                <h2>New Message from Ithumba Materials</h2>
                <p>Hi ${userName || 'there'},</p>
                <p>You have a new reply from our support team:</p>
                
                <div style="margin: 20px 0; padding: 15px; background: #f0f0f0; border-left: 4px solid #ff6b35; border-radius: 4px;">
                    <p>${adminReply}</p>
                </div>
                
                <p>Please log in to <a href="https://ithumbadhardware.com/messages">your messages</a> to respond.</p>
                
                <hr style="margin: 20px 0;">
                <p style="color: #666; font-size: 12px;">
                    Ithumba Materials<br>
                    Customer Support Team
                </p>
            `;
            
            const info = await transporter.sendMail({
                from: process.env.EMAIL_FROM,
                to: userEmail,
                subject: 'New Reply from Ithumba Materials Support',
                html: htmlContent,
                text: `New message: ${adminReply}`
            });
            
            logger.info({
                type: 'EMAIL_SENT',
                to: userEmail,
                messageId: info.messageId
            });
            
            return true;
        } catch (error) {
            logger.warn({
                type: 'EMAIL_SEND_FAILED',
                to: userEmail,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Send order confirmation email
     */
    static async sendOrderConfirmation(order) {
        try {
            const itemsList = order.items
                .map(item => `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;">${item.name}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">KSh ${(item.price * item.quantity).toLocaleString()}</td>
                    </tr>
                `).join('');

            const htmlContent = `
                <h2>Order Confirmation</h2>
                <p>Hi ${order.firstName},</p>
                <p>Thank you for your order! Here are the details:</p>
                
                <div style="margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 4px;">
                    <p><strong>Order ID:</strong> ${order.orderId}</p>
                    <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
                    <p><strong>Total Amount:</strong> KSh ${order.amount.toLocaleString()}</p>
                    <p><strong>Delivery Method:</strong> ${order.shippingMethod}</p>
                    <p><strong>Delivery Address:</strong> ${order.address}, ${order.county}</p>
                </div>

                <h3>Items Ordered</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background: #e91e63; color: white;">
                        <th style="padding: 8px; text-align: left;">Product</th>
                        <th style="padding: 8px; text-align: center;">Quantity</th>
                        <th style="padding: 8px; text-align: right;">Total</th>
                    </tr>
                    ${itemsList}
                </table>

                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
                    <p>Your order will be processed shortly. We'll send you tracking information once it ships.</p>
                    <p>Thank you for shopping with Ithumba Materials!</p>
                </div>
            `;

            await transporter.sendMail({
                from: process.env.EMAIL_FROM,
                to: order.email,
                subject: `Order Confirmation - #${order.orderId}`,
                html: htmlContent
            });

            logger.info({
                type: 'EMAIL_SENT',
                to: order.email,
                subject: 'Order Confirmation',
                orderId: order.orderId
            });

            return { success: true };
        } catch (error) {
            logger.error({
                type: 'EMAIL_ERROR',
                error: error.message,
                orderId: order.orderId,
                recipient: order.email
            });
            // Don't throw - email failure shouldn't fail the order
            return { success: false, error: error.message };
        }
    }

    /**
     * Send payment receipt email
     */
    static async sendPaymentReceipt(payment, order) {
        try {
            const htmlContent = `
                <h2>Payment Receipt</h2>
                <p>Hi ${order.firstName},</p>
                <p>Your payment has been received and processed successfully.</p>
                
                <div style="margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 4px;">
                    <p><strong>Receipt Number:</strong> ${payment.mpesaReceiptNumber || 'N/A'}</p>
                    <p><strong>Amount Paid:</strong> KSh ${payment.amount.toLocaleString()}</p>
                    <p><strong>Payment Date:</strong> ${new Date(payment.completedAt).toLocaleDateString()}</p>
                    <p><strong>Payment Method:</strong> M-Pesa (${payment.phone})</p>
                    <p><strong>Order ID:</strong> ${order.orderId}</p>
                </div>

                <p>Your order has been confirmed and is now being processed.</p>
                <p>Thank you for your business!</p>
            `;

            await transporter.sendMail({
                from: process.env.EMAIL_FROM,
                to: order.email,
                subject: `Payment Receipt - ${payment.mpesaReceiptNumber || 'Reference'}`,
                html: htmlContent
            });

            logger.info({
                type: 'RECEIPT_EMAIL_SENT',
                to: order.email,
                mpesaReceipt: payment.mpesaReceiptNumber,
                orderId: order.orderId
            });

            return { success: true };
        } catch (error) {
            logger.error({
                type: 'RECEIPT_EMAIL_ERROR',
                error: error.message,
                orderId: order.orderId
            });
            return { success: false, error: error.message };
        }
    }

    /**
     * Send payment failed notification
     */
    static async sendPaymentFailedNotice(email, firstName, reason) {
        try {
            const htmlContent = `
                <h2>Payment Failed</h2>
                <p>Hi ${firstName},</p>
                <p>Your recent payment attempt was not successful.</p>
                <p><strong>Reason:</strong> ${reason}</p>
                <p>Please try again or contact our support team for assistance.</p>
            `;

            await transporter.sendMail({
                from: process.env.EMAIL_FROM,
                to: email,
                subject: 'Payment Failed - Please Retry',
                html: htmlContent
            });

            logger.info({
                type: 'PAYMENT_FAILED_EMAIL_SENT',
                to: email,
                reason
            });

            return { success: true };
        } catch (error) {
            logger.error({
                type: 'PAYMENT_FAILED_EMAIL_ERROR',
                error: error.message,
                recipient: email
            });
            return { success: false, error: error.message };
        }
    }

    /**
     * Send invoice
     */
    static async sendInvoice(order) {
        try {
            const itemsList = order.items
                .map(item => `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;">${item.name}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">KSh ${item.price}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">KSh ${(item.price * item.quantity).toLocaleString()}</td>
                    </tr>
                `).join('');

            const htmlContent = `
                <h1 style="color: #e91e63;">INVOICE</h1>
                <p><strong>Invoice Number:</strong> INV-${order.orderId}</p>
                <p><strong>Invoice Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>

                <h3>Bill To:</h3>
                <p>
                    ${order.firstName} ${order.lastName}<br>
                    ${order.address}<br>
                    ${order.county}, ${order.postcode}<br>
                    ${order.email}<br>
                    ${order.phone}
                </p>

                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr style="background: #e91e63; color: white;">
                        <th style="padding: 8px; text-align: left;">Description</th>
                        <th style="padding: 8px; text-align: center;">Qty</th>
                        <th style="padding: 8px; text-align: right;">Unit Price</th>
                        <th style="padding: 8px; text-align: right;">Amount</th>
                    </tr>
                    ${itemsList}
                    <tr style="font-weight: bold; background: #f9f9f9;">
                        <td colspan="3" style="padding: 8px; text-align: right;">TOTAL:</td>
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">KSh ${order.amount.toLocaleString()}</td>
                    </tr>
                </table>

                <p style="margin-top: 20px;">Thank you for your business!</p>
            `;

            await transporter.sendMail({
                from: process.env.EMAIL_FROM,
                to: order.email,
                subject: `Invoice INV-${order.orderId}`,
                html: htmlContent
            });

            logger.info({
                type: 'INVOICE_SENT',
                to: order.email,
                orderId: order.orderId
            });

            return { success: true };
        } catch (error) {
            logger.error({
                type: 'INVOICE_EMAIL_ERROR',
                error: error.message,
                orderId: order.orderId
            });
            return { success: false, error: error.message };
        }
    }
}

module.exports = EmailService;
