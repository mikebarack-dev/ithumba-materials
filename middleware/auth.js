// middleware/auth.js
const admin = require('firebase-admin');
const { logger } = require('./logger');

// Firebase ID Token Verification Middleware
// Validates Firebase ID tokens sent as "Bearer {idToken}"
// ✅ SECURITY: Validates token format, expiration, and user existence
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    // 1. Validation: Check if header exists and has correct format
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn({ type: 'MISSING_AUTH_HEADER', endpoint: req.path, ip: req.ip });
        return res.status(401).json({ error: 'Unauthorized: No token provided.' });
    }

    // 2. Extraction: Get the actual token string
    const idToken = authHeader.split(' ')[1];
    
    // ✅ SECURITY: Validate token format (basic check)
    if (!idToken || idToken.length < 10) {
        logger.warn({ type: 'MALFORMED_TOKEN', endpoint: req.path, ip: req.ip });
        return res.status(401).json({ error: 'Unauthorized: Invalid token format.' });
    }

    try {
        // 3. Verification: Decode token with Firebase Admin SDK
        const decodedToken = await admin.auth().verifyIdToken(idToken);
       
        // ✅ SECURITY: Verify token is not expired and user exists
        const userRecord = await admin.auth().getUser(decodedToken.uid);
        if (!userRecord) {
            logger.warn({ type: 'USER_NOT_FOUND', userId: decodedToken.uid, ip: req.ip });
            return res.status(403).json({ error: 'Forbidden: User does not exist.' });
        }
        
        // 4. Attachment: Add UID to request for the next function to use
        req.userId = decodedToken.uid;
        next();
    } catch (error) {
        logger.warn({ type: 'TOKEN_VERIFICATION_FAILED', error: error.code, ip: req.ip });
        return res.status(403).json({ error: 'Forbidden: Invalid or expired token.' });
    }
};

// Admin Check Middleware
// ✅ SECURITY: Verifies that the authenticated user has admin privileges
// Must be used AFTER authMiddleware to ensure req.userId is set
const isAdmin = async (req, res, next) => {
    try {
        // Get userId from authMiddleware
        const userId = req.userId;

        if (!userId) {
            logger.warn({ type: 'MISSING_USER_ID_IN_ADMIN_CHECK', endpoint: req.path, ip: req.ip });
            return res.status(401).json({ error: 'Unauthorized: No user ID' });
        }

        // Get user document from Firestore
        const db = require('../db');
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            logger.warn({ type: 'ADMIN_USER_NOT_FOUND', userId, endpoint: req.path, ip: req.ip });
            return res.status(403).json({ error: 'Forbidden: User not found' });
        }

        const userData = userDoc.data();

        // ✅ SECURITY: Check if user has admin role (must be true, not just truthy)
        if (userData.isAdmin !== true) {
            logger.warn({ type: 'UNAUTHORIZED_ADMIN_ACCESS', userId, endpoint: req.path, ip: req.ip });
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        // User is admin, continue
        req.user = { uid: userId, ...userData };
        next();
    } catch (error) {
        console.error('isAdmin middleware error:', error);
        return res.status(500).json({ error: 'Server error checking admin status' });
    }
};

module.exports = authMiddleware;
module.exports.isAdmin = isAdmin;