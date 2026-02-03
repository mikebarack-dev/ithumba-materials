/**
 * Token Authentication Middleware
 * 
 * This middleware verifies JWT tokens for protected API routes ONLY.
 * It should NOT be applied to:
 * - Static files (/icons, /public, /css, /js, etc.)
 * - UI pages (/messages, /login, etc.)
 * - Public API endpoints (/api/products)
 */

const admin = require('firebase-admin');

const tokenAuthMiddleware = (req, res, next) => {
    try {
        console.log(`🔐 [TOKEN AUTH] Checking authorization for ${req.path}`);
        const authHeader = req.headers.authorization;
        
        // If no token provided, return 401 for API routes
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('🔓 [TOKEN AUTH] No token provided');
            return res.status(401).json({ 
                error: 'Unauthorized',
                message: 'No authentication token provided.'
            });
        }

        const token = authHeader.split(' ')[1];
        console.log(`🔐 [TOKEN AUTH] Verifying token for ${req.path}...`);
        
        // Verify token with Firebase Admin SDK
        admin.auth().verifyIdToken(token)
            .then((decodedToken) => {
                // Token is valid, attach user info to request
                console.log(`✅ [TOKEN AUTH] Token verified for user: ${decodedToken.email}`);
                req.user = {
                    uid: decodedToken.uid,
                    email: decodedToken.email || null,
                    displayName: decodedToken.name || null
                };
                next();
            })
            .catch((error) => {
                console.error(`❌ [TOKEN AUTH] Token verification failed for ${req.path}:`, error.message);
                res.status(403).json({ 
                    error: 'Forbidden',
                    message: 'Invalid or expired authentication token.'
                });
            });
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ 
            error: 'Server Error',
            message: 'An authentication error occurred.'
        });
    }
};

module.exports = tokenAuthMiddleware;
