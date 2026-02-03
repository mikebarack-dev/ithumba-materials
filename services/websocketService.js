/**
 * WebSocket Service - Real-time notifications
 * Handles live messages and order status updates
 */

const WebSocket = require('ws');
const { logger } = require('../middleware/logger');

class WebSocketService {
    constructor() {
        this.clients = new Map(); // userId -> Set of WebSocket connections
        this.wss = null;
    }

    /**
     * Initialize WebSocket server
     */
    initialize(server) {
        this.wss = new WebSocket.Server({ 
            server,
            path: '/ws'
        });

        this.wss.on('connection', (ws) => {
            console.log('📡 New WebSocket connection');
            
            // Handle incoming messages
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleMessage(ws, message);
                } catch (error) {
                    console.error('WebSocket message parse error:', error);
                }
            });

            // Handle client disconnect
            ws.on('close', () => {
                this.removeClient(ws);
                console.log('📡 Client disconnected');
            });

            // Handle errors
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.removeClient(ws);
            });
        });

        console.log('✅ WebSocket server initialized on /ws');
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(ws, message) {
        const { type, userId, token } = message;

        if (type === 'CONNECT') {
            // Register user connection
            if (userId) {
                if (!this.clients.has(userId)) {
                    this.clients.set(userId, new Set());
                }
                this.clients.get(userId).add(ws);
                ws.userId = userId;
                
                console.log(`✅ User ${userId} connected to WebSocket`);
                ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Connected to notifications' }));
            }
        }
    }

    /**
     * Send notification to specific user
     */
    notifyUser(userId, notification) {
        const connections = this.clients.get(userId);
        
        if (connections && connections.size > 0) {
            const message = JSON.stringify({
                type: notification.type,
                title: notification.title,
                message: notification.message,
                timestamp: new Date().toISOString(),
                data: notification.data || {}
            });

            connections.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(message);
                }
            });

            console.log(`📤 Notification sent to ${userId}: ${notification.title}`);
        }
    }

    /**
     * Broadcast to multiple users (e.g., admins, specific user)
     */
    broadcastToUsers(userIds, notification) {
        userIds.forEach(userId => this.notifyUser(userId, notification));
    }

    /**
     * Notify about new message
     */
    notifyNewMessage(recipientId, senderName, messagePreview) {
        this.notifyUser(recipientId, {
            type: 'NEW_MESSAGE',
            title: '📨 New Message',
            message: `Message from ${senderName}: ${messagePreview.substring(0, 50)}${messagePreview.length > 50 ? '...' : ''}`,
            data: { senderName, messagePreview }
        });
    }

    /**
     * Notify about order status change
     */
    notifyOrderStatusChange(userId, orderId, newStatus, details = {}) {
        const statusEmojis = {
            'pending': '⏳',
            'confirmed': '✅',
            'processing': '⚙️',
            'shipping': '🚚',
            'delivered': '📦',
            'cancelled': '❌',
            'paid': '💰'
        };

        const emoji = statusEmojis[newStatus] || '📝';

        this.notifyUser(userId, {
            type: 'ORDER_STATUS_CHANGE',
            title: `${emoji} Order Status Updated`,
            message: `Order #${orderId} is now ${newStatus}`,
            data: { orderId, newStatus, ...details }
        });
    }

    /**
     * Remove disconnected client
     */
    removeClient(ws) {
        if (ws.userId) {
            const connections = this.clients.get(ws.userId);
            if (connections) {
                connections.delete(ws);
                if (connections.size === 0) {
                    this.clients.delete(ws.userId);
                }
            }
        }
    }

    /**
     * Get connected users count
     */
    getConnectedUsersCount() {
        return this.clients.size;
    }

    /**
     * Get user connection status
     */
    isUserConnected(userId) {
        return this.clients.has(userId) && this.clients.get(userId).size > 0;
    }
}

module.exports = new WebSocketService();
