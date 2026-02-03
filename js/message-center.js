/**
 * Message Center - Chat System
 * 
 * Features:
 * - Regular users can send messages to admin
 * - Admin can see all users and chat with them
 * - Real-time conversation view
 * - Message threading by user
 */

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

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

// Initialize Firebase
async function initializeFirebaseAuth() {
    await waitForConfig();
    const firebaseConfig = JSON.parse(window.__firebase_config);
    const app = initializeApp(firebaseConfig);
    return getAuth(app);
}

// State
let currentUser = null;
let auth = null;
let selectedUserId = null;
let allUsers = {};

// DOM Elements - Regular User
let regularUserView, regularInput, regularMessages, errorMsg, successMsg;

// DOM Elements - Admin
let adminView, usersList, conversationHeader, adminMessages, adminInput, conversationInputSection, adminErrorMsg, adminSuccessMsg;

// Notification container
let notificationContainer = null;

function initDOMElements() {
    // Regular user
    regularUserView = document.getElementById('regular-user-view');
    regularInput = document.getElementById('regular-input');
    regularMessages = document.getElementById('regular-messages');
    errorMsg = document.getElementById('error-message');
    successMsg = document.getElementById('success-message');

    // Admin
    adminView = document.getElementById('admin-view');
    usersList = document.getElementById('users-list');
    conversationHeader = document.getElementById('conversation-header');
    adminMessages = document.getElementById('admin-messages');
    adminInput = document.getElementById('admin-input');
    conversationInputSection = document.getElementById('conversation-input-section');
    adminErrorMsg = document.getElementById('admin-error-message');
    adminSuccessMsg = document.getElementById('admin-success-message');

    console.log('✅ DOM Elements initialized:', {
        regularUserView: !!regularUserView,
        regularInput: !!regularInput,
        regularMessages: !!regularMessages,
        adminView: !!adminView,
        usersList: !!usersList,
        conversationHeader: !!conversationHeader,
        adminMessages: !!adminMessages,
        adminInput: !!adminInput,
        conversationInputSection: !!conversationInputSection
    });
}

function showError(msg, isAdmin = false) {
    const el = isAdmin ? adminErrorMsg : errorMsg;
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    const successEl = isAdmin ? adminSuccessMsg : successMsg;
    if (successEl) successEl.style.display = 'none';
}

function showSuccess(msg, isAdmin = false) {
    const el = isAdmin ? adminSuccessMsg : successMsg;
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    const errorEl = isAdmin ? adminErrorMsg : errorMsg;
    if (errorEl) errorEl.style.display = 'none';
}

/**
 * Initialize notification container
 */
function initNotificationContainer() {
    // Check if container already exists in DOM
    let container = document.getElementById('notification-container');
    if (container) {
        notificationContainer = container;
        console.log('✅ Using existing notification container');
        return;
    }
    
    // Create new container if it doesn't exist
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.className = 'notification-container';
    notificationContainer.style.cssText = `
        position: fixed;
        top: 70px;
        right: 20px;
        z-index: 10000;
    `;
    document.body.appendChild(notificationContainer);
    console.log('✅ Created new notification container');
}

/**
 * Show notification toast
 */
function showNotification(message, type = 'success', duration = 4000) {
    if (!notificationContainer) initNotificationContainer();
    
    const notification = document.createElement('div');
    const bgColor = type === 'success' ? '#4CAF50' : (type === 'error' ? '#f44336' : '#2196F3');
    const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
    
    notification.style.cssText = `
        background: ${bgColor};
        color: white;
        padding: 15px 20px;
        margin-bottom: 10px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    
    notification.innerHTML = `<span style="font-size: 18px;">${icon}</span><span>${message}</span>`;
    notificationContainer.appendChild(notification);
    
    // Add animation
    const style = document.createElement('style');
    if (!document.getElementById('notification-animation')) {
        style.id = 'notification-animation';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

async function getAuthToken() {
    if (!currentUser) return null;
    try {
        return await currentUser.getIdToken(true);
    } catch (error) {
        console.error('Error getting token:', error);
        return null;
    }
}

/**
 * Send message - Regular user to admin
 */
window.sendRegularMessage = async function() {
    const message = regularInput?.value.trim();
    if (!message) {
        showError('Please enter a message');
        return;
    }

    try {
        const token = await getAuthToken();
        if (!token) {
            showError('Please log in to send messages');
            return;
        }

        console.log('📤 Sending message:', { 
            token: token.substring(0, 20) + '...', 
            message: message.substring(0, 50) 
        });

        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ message })
        });

        const data = await response.json();
        console.log('📬 API Response:', { status: response.status, data });
        
        if (!response.ok) throw new Error(data.error || 'Failed to send message');

        regularInput.value = '';
        showSuccess('✅ Message sent to admin!');
        showNotification('Message sent successfully! ✨', 'success');
        console.log('✅ Message sent successfully:', data);
        setTimeout(() => fetchRegularMessages(), 500);
    } catch (error) {
        console.error('❌ Error sending message:', error);
        showError(`Failed: ${error.message}`);
        showNotification(`Failed to send message: ${error.message}`, 'error');
    }
};

/**
 * Send reply - Admin to user
 */
window.sendAdminReply = async function() {
    if (!selectedUserId) {
        showError('Please select a user first', true);
        return;
    }

    const reply = adminInput?.value.trim();
    if (!reply) {
        showError('Please enter a message', true);
        return;
    }

    try {
        const token = await getAuthToken();
        if (!token) {
            showError('Please log in', true);
            return;
        }

        console.log('📤 Sending admin reply to user:', selectedUserId);

        // Send as regular message but mark it as admin reply
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                message: reply,
                replyToUserId: selectedUserId,
                isAdminReply: true
            })
        });

        const data = await response.json();
        console.log('📬 Admin reply response:', { status: response.status, data });
        
        if (!response.ok) throw new Error(data.error || 'Failed to send reply');

        adminInput.value = '';
        showSuccess('✅ Reply sent to user!', true);
        showNotification('Reply sent to user! 📨', 'success');
        setTimeout(() => fetchAdminConversation(selectedUserId), 500);
    } catch (error) {
        console.error('❌ Error sending reply:', error);
        showError(`Failed: ${error.message}`, true);
        showNotification(`Failed to send reply: ${error.message}`, 'error');
    }
};

/**
 * Fetch messages for regular user
 */
async function fetchRegularMessages() {
    try {
        const token = await getAuthToken();
        if (!token) {
            if (regularMessages) regularMessages.innerHTML = '<div class="empty-state">Please log in</div>';
            return;
        }

        const response = await fetch('/api/messages', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = await response.json();
        if (data.success) {
            renderRegularMessages(data.data.messages);
        }
    } catch (error) {
        console.error('Error fetching messages:', error);
        if (regularMessages) regularMessages.innerHTML = '<div class="empty-state">Error loading messages</div>';
    }
}

/**
 * Render messages for regular user
 */
function renderRegularMessages(messages) {
    if (!regularMessages) return;

    if (!messages || messages.length === 0) {
        regularMessages.innerHTML = '<div class="empty-state">No messages yet. Send one to start!</div>';
        return;
    }

    // Check for new admin replies
    const adminReplies = messages.filter(msg => msg.isAdminReply);
    if (adminReplies.length > 0) {
        // Show notification for latest admin reply
        const latestAdminReply = adminReplies[adminReplies.length - 1];
        showNotification('You have a new reply from Admin! 💬', 'info');
    }

    regularMessages.innerHTML = messages.map(msg => `
        <div class="message-item ${msg.isAdminReply ? 'admin-reply' : ''}">
            <div class="message-header">
                <div class="message-sender ${msg.isAdminReply ? 'admin' : ''}">
                    ${msg.isAdminReply ? '👨‍💼 Admin' : '👤 You'} - ${escapeHtml(msg.senderEmail)}
                </div>
                <div class="message-time">${formatDate(msg.timestamp)}</div>
            </div>
            <div class="message-content">${escapeHtml(msg.message)}</div>
        </div>
    `).join('');

    // Scroll to bottom
    regularMessages.scrollTop = regularMessages.scrollHeight;
}

/**
 * Fetch all users for admin
 */
async function fetchAdminUsers() {
    try {
        const token = await getAuthToken();
        if (!token) {
            console.warn('⚠️ No token for admin users fetch');
            return;
        }

        console.log('👥 Fetching users from /api/messages/users/list API...');
        const response = await fetch('/api/messages/users/list', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('📬 Users API response status:', response.status);
        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = await response.json();
        console.log('✅ Users API response:', {
            success: data.success,
            userCount: data.data?.users?.length,
            totalRegistered: data.data?.totalRegistered
        });
        
        if (data.success) {
            renderAdminUsers(data.data.users);
        } else {
            console.error('❌ API returned success=false:', data);
        }
    } catch (error) {
        console.error('❌ Error fetching users:', error);
        if (usersList) usersList.innerHTML = '<div class="no-messages">❌ Error loading users. Check console.</div>';
    }
}

/**
 * Render users for admin
 */
function renderAdminUsers(users) {
    if (!usersList) return;

    if (!users || users.length === 0) {
        usersList.innerHTML = '<div class="no-messages">No users yet</div>';
        return;
    }

    // Store users for quick lookup
    users.forEach(user => {
        allUsers[user.uid] = user;
    });

    console.log('👥 Rendering', users.length, 'users for admin');

    usersList.innerHTML = users.map(user => `
        <div class="user-item" onclick="selectUser('${user.uid}')" style="cursor: pointer; padding: 12px; margin-bottom: 8px; border-left: 4px solid #ff6b35; background: #f9f9f9; border-radius: 4px; transition: all 0.2s;">
            <div style="font-weight: bold; color: #333;">${escapeHtml(user.name || user.email)}</div>
            <div style="font-size: 12px; color: #666;">📧 ${escapeHtml(user.email)}</div>
            ${user.hasMessages ? '<div style="font-size: 11px; color: #4CAF50; margin-top: 4px;">💬 Has sent messages</div>' : ''}
            ${!user.isRegisteredUser ? '<div style="font-size: 11px; color: #f57c00; margin-top: 2px;">⚠️ Not registered</div>' : '<div style="font-size: 11px; color: #4CAF50; margin-top: 2px;">✓ Registered</div>'}
        </div>
    `).join('');
}

/**
 * Select a user to chat with
 */
window.selectUser = async function(userId) {
    selectedUserId = userId;
    console.log('👤 Selected user:', userId);
    
    // Update UI - highlight selected user
    document.querySelectorAll('.user-item').forEach(el => {
        el.style.borderLeftColor = '#ff6b35';
        el.style.background = '#f9f9f9';
    });
    // Find and highlight the clicked user
    const userElements = document.querySelectorAll('.user-item');
    userElements.forEach(el => {
        if (el.onclick && el.onclick.toString().includes(userId)) {
            el.style.borderLeftColor = '#4CAF50';
            el.style.background = '#e8f5e9';
        }
    });

    // Update header
    const user = allUsers[userId];
    if (conversationHeader && user) {
        conversationHeader.style.display = 'block';
        conversationHeader.innerHTML = `
            <h3 style="margin: 0; padding: 10px 0;">
                💬 Chat with <strong>${escapeHtml(user.name || user.email)}</strong>
                <br><small style="color: #666;">📧 ${escapeHtml(user.email)}</small>
            </h3>
        `;
    }

    // Show input
    if (conversationInputSection) {
        conversationInputSection.style.display = 'block';
    }

    // Fetch conversation
    console.log('📥 Fetching conversation with user:', userId);
    await fetchAdminConversation(userId);
};

/**
 * Fetch conversation with specific user
 */
async function fetchAdminConversation(userId) {
    try {
        const token = await getAuthToken();
        if (!token) {
            console.error('❌ No auth token available');
            return;
        }

        console.log('📥 Fetching all messages from API...');
        const response = await fetch('/api/messages', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('📬 Messages API response status:', response.status);
        
        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = await response.json();
        console.log('✅ Messages API data:', {
            success: data.success,
            messageCount: data.data?.messages?.length,
            isAdmin: data.data?.isAdmin,
            userId: userId.substring(0, 10) + '...'
        });
        
        if (data.success) {
            // Get admin's UID for filtering
            const adminUid = data.data.userId; // Current user is admin
            const adminEmail = 'mikebarack5525@gmail.com';
            
            console.log('👨‍💼 Admin info:', { adminUid: adminUid.substring(0, 10) + '...', adminEmail });
            
            // Filter messages for this conversation:
            // - Messages FROM the user (senderId === userId)
            // - Messages FROM the admin TO this user (senderId === adminUid OR senderEmail === adminEmail)
            const allMessages = data.data.messages;
            
            // Create a conversation by finding all messages related to this user
            const userMessages = allMessages.filter(msg => msg.senderId === userId);
            console.log('📨 User messages from user:', userMessages.length);
            
            // Get the time range of user messages to identify admin replies in the conversation
            const userMessageTimestamps = userMessages.map(m => m.timestamp).sort((a, b) => new Date(a) - new Date(b));
            const firstUserMessageTime = userMessageTimestamps[0] ? new Date(userMessageTimestamps[0]) : new Date(0);
            
            console.log('⏰ First user message time:', firstUserMessageTime);
            
            // Build full conversation including admin replies
            const conversationMessages = allMessages.filter(msg => {
                // Include all messages from the user
                if (msg.senderId === userId) {
                    console.log('  ✓ Including user message:', msg.id);
                    return true;
                }
                
                // Include admin messages that come after the first user message
                // Check both UID and email for flexibility
                if ((msg.senderId === adminUid || msg.senderEmail === adminEmail) && new Date(msg.timestamp) >= firstUserMessageTime) {
                    console.log('  ✓ Including admin message:', msg.id, 'from:', msg.senderEmail || msg.senderId);
                    return true;
                }
                
                return false;
            });
            
            console.log('🔍 Filtered conversation for user:', conversationMessages.length, 'messages', 
                'out of', allMessages.length, 'total');
            
            // Sort by timestamp
            conversationMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            renderAdminConversation(conversationMessages, userId);
        }
    } catch (error) {
        console.error('❌ Error fetching conversation:', error);
        if (adminMessages) adminMessages.innerHTML = '<div class="empty-state">Error loading conversation</div>';
    }
}

/**
 * Render conversation for admin
 */
function renderAdminConversation(messages, userId) {
    if (!adminMessages) return;

    if (!messages || messages.length === 0) {
        adminMessages.innerHTML = '<div class="empty-state">No messages with this user yet</div>';
        return;
    }

    const user = allUsers[userId];
    const userEmail = user?.email || 'Unknown';
    const userName = user?.name || 'Unknown';

    // Check for new user messages
    const userMessages = messages.filter(msg => !msg.isAdminReply);
    if (userMessages.length > 0) {
        // Show notification for latest user message
        const latestUserMessage = userMessages[userMessages.length - 1];
        showNotification(`New message from ${escapeHtml(userName)}! 📩`, 'info');
    }

    adminMessages.innerHTML = messages.map(msg => `
        <div class="message-item ${msg.isAdminReply ? 'admin-reply' : ''}">
            <div class="message-header">
                <div class="message-sender ${msg.isAdminReply ? 'admin' : ''}">
                    ${msg.isAdminReply ? '👨‍💼 You (Admin)' : `👤 ${escapeHtml(userName)}`}
                </div>
                <div class="message-time">${formatDate(msg.timestamp)}</div>
            </div>
            <div class="message-content">${escapeHtml(msg.message)}</div>
        </div>
    `).join('');

    // Scroll to bottom
    adminMessages.scrollTop = adminMessages.scrollHeight;
}

/**
 * Format timestamp
 */
function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Update unread badge in navbar
 */
async function updateUnreadBadge() {
    try {
        const token = currentUser ? await currentUser.getIdToken(true) : null;
        if (!token) return;
        
        const response = await fetch('/api/messages/unread/count', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        const badge = document.getElementById('unread-badge');
        
        if (badge) {
            if (data.unreadCount > 0) {
                badge.textContent = data.unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.warn('Error updating badge:', error);
    }
}

/**
 * WebSocket Connection for Real-time Notifications
 */
let wsConnection = null;

function initWebSocket(userId) {
    // Determine WebSocket URL based on current location
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
    
    console.log('🔌 Connecting to WebSocket:', wsUrl);
    
    try {
        wsConnection = new WebSocket(wsUrl);
        
        wsConnection.onopen = () => {
            console.log('✅ WebSocket connected');
            // Send user identification
            wsConnection.send(JSON.stringify({
                type: 'CONNECT',
                userId: userId
            }));
        };
        
        wsConnection.onmessage = (event) => {
            try {
                const notification = JSON.parse(event.data);
                console.log('📬 Received notification:', notification);
                
                // Handle different notification types
                if (notification.type === 'NEW_MESSAGE') {
                    handleNewMessageNotification(notification);
                } else if (notification.type === 'ORDER_STATUS_CHANGE') {
                    handleOrderStatusNotification(notification);
                }
            } catch (err) {
                console.error('⚠️ Failed to parse notification:', err);
            }
        };
        
        wsConnection.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
        };
        
        wsConnection.onclose = () => {
            console.log('🔌 WebSocket disconnected');
            // Attempt to reconnect after 3 seconds
            setTimeout(() => {
                if (currentUser) {
                    initWebSocket(currentUser.uid);
                }
            }, 3000);
        };
    } catch (err) {
        console.error('⚠️ Failed to initialize WebSocket:', err);
    }
}

function handleNewMessageNotification(notification) {
    console.log('💬 New message notification:', notification.title, notification.message);
    
    // Update unread badge immediately
    updateUnreadBadge();
    
    // Show visual notification
    showWebSocketNotification(
        notification.title || 'New Message',
        notification.message || 'You have a new message',
        'message'
    );
    
    // If in message center, refresh messages
    if (currentUser) {
        const isAdmin = currentUser.email === 'mikebarack5525@gmail.com';
        if (isAdmin) {
            fetchAdminUsers();
        } else {
            fetchRegularMessages();
        }
    }
}

function handleOrderStatusNotification(notification) {
    console.log('📦 Order status notification:', notification.title, notification.message);
    
    // Show visual notification
    showWebSocketNotification(
        notification.title || 'Order Status Update',
        notification.message || 'Your order status has changed',
        'order'
    );
}

function showWebSocketNotification(title, message, type = 'message') {
    console.log('🔔 Attempting to show notification:', { title, message, type });
    
    if (!notificationContainer) {
        console.warn('⚠️ Notification container not found, initializing...');
        initNotificationContainer();
    }
    
    if (!notificationContainer) {
        console.error('❌ Failed to initialize notification container');
        return;
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification-toast notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-title">${escapeHtml(title)}</div>
            <div class="notification-message">${escapeHtml(message)}</div>
        </div>
        <div class="notification-close">×</div>
    `;
    
    notificationContainer.appendChild(notification);
    console.log('✅ Notification added to DOM');
    
    // Add animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    });
    
    // Auto-close after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

/**
 * Initialize message center
 */
async function initMessageCenter() {
    console.log('🔄 Initializing Message Center...');
    initDOMElements();
    initNotificationContainer();

    auth = await initializeFirebaseAuth();
    console.log('✅ Firebase Auth initialized');
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            console.log('✅ User authenticated:', user.email);

            // Initialize WebSocket for real-time notifications
            initWebSocket(user.uid);

            // Determine if admin
            const idTokenResult = await user.getIdTokenResult();
            const isAdmin = idTokenResult.claims.admin === true || user.email === 'mikebarack5525@gmail.com';

            console.log('👤 User Info:', {
                email: user.email,
                displayName: user.displayName,
                isAdmin: isAdmin,
                uid: user.uid.substring(0, 10) + '...'
            });

            if (isAdmin) {
                console.log('👨‍💼 Admin view activated');
                // Show admin view
                if (adminView) {
                    adminView.style.display = 'block';
                    console.log('✅ Admin view displayed');
                }
                if (regularUserView) regularUserView.style.display = 'none';
                
                // Load admin data
                console.log('📥 Loading admin users...');
                await fetchAdminUsers();
            } else {
                console.log('👤 Regular user view activated');
                // Show regular user view
                if (regularUserView) regularUserView.style.display = 'block';
                if (adminView) adminView.style.display = 'none';

                // Load user messages
                console.log('📥 Loading user messages...');
                await fetchRegularMessages();
            }
            
            // Update unread badge on load and every 10 seconds
            updateUnreadBadge();
            setInterval(updateUnreadBadge, 10000);
        } else {
            console.warn('⚠️ User not authenticated');
            if (regularUserView) regularUserView.innerHTML = '<div class="empty-state">Please log in to use messages</div>';
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initMessageCenter().catch(error => {
            console.error('Failed to initialize:', error);
            showError('Failed to initialize messaging');
        });
    });
} else {
    initMessageCenter().catch(error => {
        console.error('Failed to initialize:', error);
        showError('Failed to initialize messaging');
    });
}
