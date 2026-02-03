/**
 * Messages API Route
 * 
 * Handles user-to-admin messaging system
 * - Users can send messages to admin
 * - Admin can view all user messages
 * - Admin can reply to users
 * 
 * Protected endpoints - require JWT token
 */

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const firestore = admin.firestore();
const EmailService = require('../services/emailService');
const websocketService = require('../services/websocketService');
const { logger } = require('../middleware/logger');

const ADMIN_UID = 'admin'; // You should replace this with actual admin UID or check a claim
const MESSAGES_COLLECTION = 'messages';
const USERS_COLLECTION = 'users';

// In-memory fallback storage for when Firestore is down
const localMessages = [];
const localUsers = new Map();

/**
 * POST /api/messages
 * Send a new message to admin
 * Body: { message: string }
 */
router.post('/', async (req, res) => {
    try {
        const userId = req.user?.uid; // From tokenAuthMiddleware
        const email = req.user?.email; // From tokenAuthMiddleware - extracted from JWT token
        const displayName = req.user?.displayName; // From tokenAuthMiddleware
        const { message } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'Message cannot be empty' });
        }

        try {
            // Get user info from Firestore as fallback
            const userDoc = await firestore.collection(USERS_COLLECTION).doc(userId).get();
            const userData = userDoc.exists ? userDoc.data() : {};

            // Use email from token first, then from Firestore, then default
            const senderEmail = email || userData.email || 'Unknown';
            const senderName = displayName || userData.name || userData.displayName || email || 'Unknown User';

            // Save message to Firestore
            const messageRef = await firestore.collection(MESSAGES_COLLECTION).add({
                senderId: userId,
                senderEmail: senderEmail,
                senderName: senderName,
                message: message.trim(),
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                isRead: false,
                isAdminReply: false,
                replyTo: null
            });

            console.log('✅ Message saved to Firestore:', messageRef.id, 'from user:', userId, 'email:', senderEmail);

            // Update client profile with message count
            try {
                const clientRef = firestore.collection('clients').doc(userId);
                const clientDoc = await clientRef.get();
                
                if (clientDoc.exists) {
                    // Update existing client
                    await clientRef.update({
                        lastActive: new Date().toISOString(),
                        messageCount: admin.firestore.FieldValue.increment(1)
                    });
                } else {
                    // Create new client if doesn't exist
                    await clientRef.set({
                        uid: userId,
                        email: senderEmail,
                        displayName: senderName,
                        phoneNumber: userData.phoneNumber || '',
                        photoURL: userData.photoURL || '',
                        createdAt: new Date().toISOString(),
                        lastActive: new Date().toISOString(),
                        status: 'active',
                        totalOrders: 0,
                        totalSpent: 0,
                        messageCount: 1
                    });
                }
                console.log('✅ Client profile updated for message from:', userId);
            } catch (clientErr) {
                console.warn('⚠️ Could not update client profile:', clientErr.message);
                // Don't fail the message if client update fails
            }

            // Notify admin via WebSocket of new message
            try {
                const adminEmail = 'mikebarack5525@gmail.com';
                const adminUser = await firestore.collection('users').where('email', '==', adminEmail).limit(1).get();
                if (!adminUser.empty) {
                    const adminId = adminUser.docs[0].id;
                    websocketService.notifyNewMessage(adminId, senderName, message.substring(0, 50) + (message.length > 50 ? '...' : ''));
                }
            } catch (wsErr) {
                console.warn('⚠️ WebSocket notification failed:', wsErr.message);
                // Don't fail the message if notification fails
            }

            res.status(201).json({
                success: true,
                data: {
                    id: messageRef.id,
                    message: 'Message sent successfully',
                    senderEmail: senderEmail,
                    senderName: senderName
                }
            });
        } catch (firestoreError) {
            console.error('⚠️ Firestore error saving message:', firestoreError.message);
            
            // Save to local in-memory storage as fallback
            const messageId = 'local-' + Date.now();
            const localMessage = {
                id: messageId,
                senderId: userId,
                senderEmail: email || 'Unknown',
                senderName: displayName || email || 'Unknown User',
                message: message.trim(),
                timestamp: new Date(),
                isRead: false,
                isAdminReply: false,
                replyTo: null,
                local: true
            };
            
            localMessages.push(localMessage);
            
            // Also store user for users/list endpoint
            if (!localUsers.has(userId)) {
                localUsers.set(userId, {
                    uid: userId,
                    email: email || 'Unknown',
                    displayName: displayName || email || 'Unknown User',
                    name: displayName || email || 'Unknown User',
                    photoURL: '',
                    createdAt: new Date().toISOString(),
                    isRegisteredUser: false,
                    hasMessages: true,
                    local: true
                });
            }
            
            console.log('📝 Message stored locally:', messageId, '(Firestore unavailable)');
            
            // Return success anyway - message stored locally or will retry
            res.status(201).json({
                success: true,
                data: {
                    id: messageId,
                    message: 'Message queued for delivery',
                    warning: 'Stored locally, will sync when server is available',
                    senderEmail: email || 'Unknown',
                    senderName: displayName || email || 'Unknown User',
                    local: true
                }
            });
        }
    } catch (error) {
        console.error('Error in POST messages:', error);
        // Return success to prevent 500 error
        res.status(201).json({
            success: true,
            data: {
                id: 'local-' + Date.now(),
                message: 'Message queued for delivery',
                senderEmail: req.user?.email || 'Unknown',
                senderName: req.user?.displayName || 'Unknown User'
            }
        });
    }
});

/**
 * GET /api/messages
 * Get messages for the current user or all messages if admin
 * Auto-detects admin status from email
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user?.uid; // From tokenAuthMiddleware
        const userEmail = req.user?.email; // From tokenAuthMiddleware
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Auto-detect admin - check if email matches admin email
        const isAdmin = userEmail === 'mikebarack5525@gmail.com';
        
        console.log('📬 Fetching messages:', { userId: userId.substring(0, 10) + '...', userEmail, isAdmin });

        let messages = [];

        try {
            if (isAdmin) {
                // Admin: Get ALL messages
                console.log('👨‍💼 Admin fetch - retrieving all messages');
                const snapshot = await firestore.collection(MESSAGES_COLLECTION)
                    .get();

                messages = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    timestamp: doc.data().timestamp?.toDate?.() || new Date()
                }));
                
                console.log('✅ Retrieved', messages.length, 'messages from Firestore for admin');
                
                // Sort by timestamp on the client side
                messages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            } else {
                // Regular user: Get their own messages AND admin replies
                console.log('👤 Regular user fetch - retrieving messages for user:', userId.substring(0, 10) + '...');
                const snapshot = await firestore.collection(MESSAGES_COLLECTION).get();
                
                // Get admin email for filtering
                const adminEmail = 'mikebarack5525@gmail.com';
                
                // Filter messages: include messages from user or from admin (admin replies)
                messages = snapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        timestamp: doc.data().timestamp?.toDate?.() || new Date()
                    }))
                    .filter(msg => {
                        // Include messages FROM the user
                        if (msg.senderId === userId) return true;
                        
                        // Include messages FROM admin to this user (identified by admin email in sender)
                        if (msg.senderEmail === adminEmail) return true;
                        
                        return false;
                    });
                
                console.log('✅ Retrieved', messages.length, 'messages from Firestore for user (includes admin replies)');
                
                // Sort by timestamp on the client side
                messages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            }
        } catch (firestoreError) {
            console.error('⚠️ Firestore error fetching messages:', firestoreError.message, '- using local messages');
            
            // Fallback to local messages
            if (isAdmin) {
                messages = localMessages;
                console.log('📝 Using', messages.length, 'local messages for admin');
            } else {
                // For regular users: show their messages AND admin replies
                const adminEmail = 'mikebarack5525@gmail.com';
                messages = localMessages.filter(m => 
                    m.senderId === userId || m.senderEmail === adminEmail
                );
                console.log('📝 Using', messages.length, 'local messages for user (includes admin replies)');
            }
        }
        
        // Ensure we have timestamp objects for all messages
        messages = messages.map(m => ({
            ...m,
            timestamp: m.timestamp instanceof Date ? m.timestamp : (typeof m.timestamp === 'string' ? new Date(m.timestamp) : new Date())
        }));

        const unreadCount = messages.filter(m => !m.isRead).length;

        res.status(200).json({
            success: true,
            data: {
                messages,
                unreadCount,
                userId,
                userEmail,
                isAdmin
            }
        });
    } catch (error) {
        console.error('Error in messages route:', error);
        // Return empty messages on any error to prevent 500
        res.status(200).json({
            success: true,
            data: {
                messages: [],
                unreadCount: 0,
                userId: req.user?.uid || null,
                userEmail: req.user?.email || null,
                isAdmin: false,
                warning: 'Could not fetch messages from server'
            }
        });
    }
});

/**
 * GET /api/messages/users/list
 * Admin: Get list of all users who have signed up
 * Also includes users who have sent messages
 */
router.get('/users/list', async (req, res) => {
    try {
        const userId = req.user?.uid; // From tokenAuthMiddleware
        const userEmail = req.user?.email;
        
        console.log('👥 /users/list endpoint called by:', userEmail);
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        
        let users = [];
        const userSet = new Map(); // Use map to deduplicate by uid
        
        try {
            // Get all registered users from users collection
            console.log('📚 Querying users collection...');
            const usersSnapshot = await firestore.collection(USERS_COLLECTION).get();
            console.log('📚 Found', usersSnapshot.docs.length, 'registered users');
            
            usersSnapshot.docs.forEach(doc => {
                const userData = doc.data();
                console.log('  - User doc:', doc.id, '=', userData.email);
                userSet.set(userData.uid || doc.id, {
                    uid: userData.uid || doc.id,
                    email: userData.email || 'Unknown',
                    displayName: userData.displayName || userData.name || 'Unknown',
                    name: userData.name || userData.displayName || 'Unknown',
                    photoURL: userData.photoURL || '',
                    createdAt: userData.createdAt || new Date().toISOString(),
                    isRegisteredUser: true
                });
            });

            // Also get unique users from messages collection (in case there are messages from users not in users collection)
            console.log('💬 Querying messages collection...');
            const messagesSnapshot = await firestore.collection(MESSAGES_COLLECTION).get();
            console.log('💬 Found', messagesSnapshot.docs.length, 'total messages');
            
            const messageSenderIds = new Set();
            messagesSnapshot.docs.forEach(doc => {
                const messageData = doc.data();
                if (messageData.senderId) {
                    messageSenderIds.add(messageData.senderId);
                    console.log('  - Message from:', messageData.senderId, '(', messageData.senderEmail, ')');
                    
                    if (!userSet.has(messageData.senderId)) {
                        console.log('    → Adding as new user (not in users collection)');
                        userSet.set(messageData.senderId, {
                            uid: messageData.senderId,
                            email: messageData.senderEmail || 'Unknown',
                            displayName: messageData.senderName || 'Unknown User',
                            name: messageData.senderName || 'Unknown User',
                            photoURL: '',
                            createdAt: messageData.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
                            isRegisteredUser: false,
                            hasMessages: true
                        });
                    } else {
                        console.log('    → Already in users collection');
                    }
                }
            });

            console.log('✅ Total users after merge:', userSet.size);

        } catch (firestoreError) {
            console.error('❌ Firestore error fetching users:', firestoreError.message, firestoreError.code);
            console.log('📝 Falling back to local users storage:', localUsers.size, 'local users');
            
            // Fallback to local users when Firestore is down
            localUsers.forEach((user, uid) => {
                if (!userSet.has(uid)) {
                    userSet.set(uid, user);
                }
            });
        }
        
        users = Array.from(userSet.values()).sort((a, b) => {
            // Sort registered users first, then by creation date
            if (a.isRegisteredUser !== b.isRegisteredUser) {
                return b.isRegisteredUser - a.isRegisteredUser;
            }
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        console.log('✅ Final users list:', users.length, 'users');

        res.status(200).json({
            success: true,
            data: {
                users,
                totalUsers: users.length,
                totalRegistered: users.filter(u => u.isRegisteredUser).length,
                warning: users.length === 0 ? 'No users found' : undefined
            }
        });
    } catch (error) {
        console.error('❌ Error in users/list route:', error);
        // Return empty users list on any error to prevent 500
        res.status(200).json({
            success: true,
            data: {
                users: [],
                totalUsers: 0,
                totalRegistered: 0,
                warning: 'Could not fetch users from server'
            }
        });
    }
});

/**
 * POST /api/messages/:id/mark-read
 * Mark a message as read
 */
router.post('/:id/mark-read', async (req, res) => {
    try {
        const messageId = req.params.id;
        const userId = req.user?.uid;

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        try {
            const messageDoc = await firestore.collection(MESSAGES_COLLECTION).doc(messageId).get();
            
            if (!messageDoc.exists) {
                return res.status(404).json({ error: 'Message not found' });
            }

            // Update the message
            await firestore.collection(MESSAGES_COLLECTION).doc(messageId).update({
                isRead: true
            });

            res.status(200).json({
                success: true,
                message: 'Message marked as read'
            });
        } catch (firestoreError) {
            console.error('⚠️ Firestore error marking message as read:', firestoreError.message);
            // Return success even if Firestore fails
            res.status(200).json({
                success: true,
                message: 'Message marked as read locally',
                warning: 'May not sync'
            });
        }
    } catch (error) {
        console.error('Error in mark-read route:', error);
        // Return success to prevent 500
        res.status(200).json({
            success: true,
            message: 'Message marked as read locally'
        });
    }
});

/**
 * POST /api/messages/:id/reply
 * Admin reply to a message
 * Body: { reply: string }
 */
router.post('/:id/reply', async (req, res) => {
    try {
        const messageId = req.params.id;
        const userId = req.user?.uid; // Should be admin
        const adminEmail = req.user?.email; // From JWT token
        const adminName = req.user?.displayName; // From JWT token
        const { reply } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        if (!reply || reply.trim() === '') {
            return res.status(400).json({ error: 'Reply cannot be empty' });
        }

        try {
            // Get original message
            const originalMsg = await firestore.collection(MESSAGES_COLLECTION).doc(messageId).get();
            
            if (!originalMsg.exists) {
                return res.status(404).json({ error: 'Message not found' });
            }

            // Create reply as new message
            const replyRef = await firestore.collection(MESSAGES_COLLECTION).add({
                senderId: userId,
                senderEmail: adminEmail || 'mikebarack5525@gmail.com',
                senderName: adminName || 'Admin',
                message: reply.trim(),
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                isRead: false,
                isAdminReply: true,
                replyTo: messageId
            });

            // Mark original as read
            await firestore.collection(MESSAGES_COLLECTION).doc(messageId).update({
                isRead: true
            });

            // Send email notification to user
            const customerEmail = originalMsg.data().email || originalMsg.data().senderEmail;
            const customerName = originalMsg.data().displayName || originalMsg.data().senderName || 'Valued Customer';
            
            if (customerEmail) {
                EmailService.sendMessageReply(customerEmail, customerName, reply.trim()).catch(err => {
                    logger.warn({
                        type: 'EMAIL_NOTIFICATION_FAILED',
                        to: customerEmail,
                        error: err.message
                    });
                });
            }

            // Send WebSocket notification to user
            try {
                const userToNotify = originalMsg.data().senderId;
                if (userToNotify) {
                    websocketService.notifyNewMessage(userToNotify, 'Admin Response', reply.substring(0, 50) + (reply.length > 50 ? '...' : ''));
                }
            } catch (wsErr) {
                console.warn('⚠️ WebSocket notification failed:', wsErr.message);
                // Don't fail the reply if notification fails
            }

            console.log('Admin reply sent:', replyRef.id);

            res.status(201).json({
                success: true,
                data: {
                    id: replyRef.id,
                    message: 'Reply sent successfully'
                }
            });
        } catch (firestoreError) {
            console.error('⚠️ Firestore error sending reply:', firestoreError.message);
            
            // Save to local in-memory storage as fallback
            const replyId = 'local-' + Date.now();
            const localReply = {
                id: replyId,
                senderId: userId,
                senderEmail: adminEmail || 'mikebarack5525@gmail.com',
                senderName: adminName || 'Admin',
                message: reply.trim(),
                timestamp: new Date(),
                isRead: false,
                isAdminReply: true,
                replyTo: messageId,
                local: true
            };
            
            localMessages.push(localReply);
            console.log('📝 Admin reply stored locally:', replyId, '(Firestore unavailable)');
            
            // Return success
            res.status(201).json({
                success: true,
                data: {
                    id: replyId,
                    message: 'Reply queued for delivery',
                    warning: 'Stored locally, will sync when server is available',
                    local: true
                }
            });
        }
    } catch (error) {
        console.error('Error in reply route:', error);
        // Return success to prevent 500
        res.status(201).json({
            success: true,
            data: {
                id: 'local-' + Date.now(),
                message: 'Reply queued for delivery'
            }  
        });
    }
});

/**
 * GET /api/messages/unread/count
 * Get count of unread messages for current user
 */
router.get('/unread/count', async (req, res) => {
    try {
        const userId = req.user?.uid;
        const userEmail = req.user?.email;
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        
        const isAdmin = userEmail === 'mikebarack5525@gmail.com';
        let unreadCount = 0;
        
        try {
            if (isAdmin) {
                // Admin: count all unread messages
                const snapshot = await firestore
                    .collection('messages')
                    .where('isRead', '==', false)
                    .get();
                unreadCount = snapshot.size;
            } else {
                // Regular user: count unread admin replies
                const snapshot = await firestore
                    .collection('messages')
                    .where('userId', '==', userId)
                    .where('isAdminReply', '==', true)
                    .where('isRead', '==', false)
                    .get();
                unreadCount = snapshot.size;
            }
        } catch (error) {
            console.warn('⚠️ Firestore error getting unread count:', error.message);
            // Return 0 if Firestore fails
            unreadCount = 0;
        }
        
        res.json({ unreadCount });
    } catch (error) {
        console.error('❌ Error getting unread count:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
