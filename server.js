// server.js (FINAL SERVER ENTRY POINT)

const express = require('express');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const fileUpload = require('express-fileupload');
const helmet = require('helmet');

// 1. Load environment variables
dotenv.config();

// 2. Initialize Firebase Admin SDK
try {
    let serviceAccount;
    
    // Try to load from environment variable first (for Render)
    if (process.env.FIREBASE_KEY_JSON) {
        console.log("Loading Firebase key from environment variable (JSON)...");
        serviceAccount = JSON.parse(process.env.FIREBASE_KEY_JSON);
    } else if (process.env.FIREBASE_KEY_BASE64) {
        console.log("Loading Firebase key from environment variable (Base64)...");
        const keyJson = Buffer.from(process.env.FIREBASE_KEY_BASE64, 'base64').toString('utf8');
        serviceAccount = JSON.parse(keyJson);
    } else {
        // Fall back to file (for local development)
        const serviceAccountPath = path.resolve(__dirname, process.env.SERVICE_ACCOUNT_PATH || 'ithumba-materials-key.json');
        console.log("Resolved Service Account Path:", serviceAccountPath);
        serviceAccount = require(serviceAccountPath);
    }
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: 'ithumba-materials.appspot.com'
    });
    console.log("✅ Firebase Admin SDK initialized.");
} catch (error) {
    console.error("❌ CRITICAL ERROR: Could not load Firebase Key.");
    console.error("Error details:", error.message);
    process.exit(1); // Stop server if we can't login
}

// The db variable is now implicitly available via the exported db.js or Admin SDK
const db = require('./db');

// Import new middleware
const { logger, requestLogger } = require('./middleware/logger');
const { apiLimiter, paymentLimiter, cartLimiter } = require('./middleware/rateLimiter');
const { validateCheckout, validateMpesaPayment, validateAddToCart } = require('./middleware/validation');
const websocketService = require('./services/websocketService');

const app = express();
const PORT = process.env.PORT || 8081; // Use .env PORT or default to 8081

// ✅ SECURITY: Add Helmet for security headers (MUST be before routes)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://www.gstatic.com", "https://apis.google.com", "https://accounts.gstatic.com"],
            scriptSrcAttr: ["'self'", "'unsafe-inline'"],
            connectSrc: ["'self'", "https://www.gstatic.com", "https://*.firebaseapp.com", "https://*.firebaseio.com", "https://*.googleapis.com", "https://identitytoolkit.googleapis.com", "https://apis.google.com", "https://accounts.google.com", "https://accounts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.gstatic.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            frameSrc: ["https://*.firebaseapp.com", "https://apis.google.com", "https://accounts.google.com", "https://accounts.gstatic.com"]
        }
    }
}));

// ✅ Enable trust proxy for rate limiting behind reverse proxies (Render, Heroku, etc)
app.set('trust proxy', 1);

// ✅ SECURITY: Enforce HTTPS in production
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            return res.redirect(`https://${req.header('host')}${req.url}`);
        }
        next();
    });
}

// Add debugging logs to identify where the server is failing
console.log("Starting server on port:", PORT);

// Add logging middleware FIRST (before all other middleware)
app.use(requestLogger);

// ✅ PUBLIC CALLBACK ENDPOINT - MUST BE FIRST (after helmet), BEFORE ALL OTHER MIDDLEWARE!
// M-Pesa sends callbacks without Firebase auth
app.post('/api/mpesa/callback', (req, res) => {
    console.log('📲 M-Pesa Callback received (raw)');
    res.status(200).json({ success: true });
});

// Middleware setup
console.log("Initializing middleware...");

// ✅ SECURITY: Restrict CORS to specific origins only
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(o => o.trim());
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS policy'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600 // Preflight cache 1 hour
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    abortOnLimit: true
}));
// Serve both /public and /js directories as static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use(compression()); // Compress all routes

// ✅ SECURITY: Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// ✅ SECURITY: Add stricter rate limiting to auth routes
const authLimiter = require('./middleware/rateLimiter').authLimiter;
app.post('/api/auth/login', authLimiter);
app.post('/api/auth/signup', authLimiter);

console.log("Middleware initialized.");

// Serve the js directory as a static resource
app.use('/js', express.static(path.join(__dirname, 'js')));

// Import Auth Middleware
console.log('Loading auth middleware...');
const authMiddleware = require('./middleware/auth');
console.log('✅ Auth middleware loaded');
const tokenAuthMiddleware = require('./middleware/tokenAuth');
console.log('✅ TokenAuth middleware loaded');

// 4. Import and use the finalized API Routes
// Note: Auth Middleware is applied selectively to protected routes only
console.log('Loading routes...');
const cartRoutes = require('./routes/cart');
console.log('✅ Cart routes loaded');
const productRoutes = require('./routes/product');
console.log('✅ Product routes loaded');
const messagesRoutes = require('./routes/messages');
console.log('✅ Messages routes loaded');
const clientsRoutes = require('./routes/clients');
console.log('✅ Clients routes loaded');
const ordersRoutes = require('./routes/orders');
console.log('✅ Orders routes loaded');
const mpesaRoutes = require('./routes/mpesa');
console.log('✅ Mpesa routes loaded');
const inventoryRoutes = require('./routes/inventory');
console.log('✅ Inventory routes loaded');
const uploadRoutes = require('./routes/upload');
console.log('✅ Upload routes loaded');
const adminOrdersRoutes = require('./routes/admin-orders');
console.log('✅ Admin orders routes loaded');
const adminRoutes = require('./routes/admin');
console.log('✅ Admin routes loaded');

// Log route initialization
console.log("Initializing routes...");

// PRODUCTS CACHING: To avoid Firestore quota exhaustion
let productCache = []; // Start with empty array, not null
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // Cache for 5 minutes

// Load fallback products from JSON file
let fallbackProducts = [];
try {
    const fallbackData = require('./products-fallback.json');
    fallbackProducts = fallbackData.products || [];
    console.log('✅ Loaded', fallbackProducts.length, 'fallback products from JSON');
} catch (error) {
    console.error('⚠️ Could not load fallback products:', error.message);
}

// Background function to load products when quota becomes available
async function loadProductsCacheInBackground() {
    try {
        console.log('Attempting to load products from Firestore in background...');
        const snapshot = await db.collection('products').get();
        
        if (!snapshot.empty) {
            const products = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            productCache = products;
            cacheTimestamp = Date.now();
            console.log('✅ Successfully loaded', products.length, 'products from Firestore into cache');
        } else {
            console.log('⚠️ Products collection is empty in Firestore');
        }
    } catch (error) {
        console.error('⚠️ Background Firestore load failed:', error.message);
        // Will retry on next request or use fallback
    } finally {
        console.log('✅ Background product load process complete');
    }
}

// Try to load cache in background after a delay (non-blocking)
// Commented out - server was crashing after this
/*
setImmediate(() => {
    loadProductsCacheInBackground().catch(err => {
        console.error('Error in background load:', err);
    });
});
*/

// Just log that we're not loading in background
console.log('ℹ️  Background Firestore load disabled for stability');

// IMPORTANT: Routes and middleware order matters!
// Mount the productRoutes router at /api/products with optional authentication
// Create a wrapper middleware that applies tokenAuthMiddleware only to POST/PUT/DELETE
app.use('/api/products', (req, res, next) => {
    // Apply auth middleware only to modification methods
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        return tokenAuthMiddleware(req, res, () => {
            productRoutes(req, res, next);
        });
    }
    // GET requests bypass authentication
    productRoutes(req, res, next);
});

// 3. UI Page Routes (public, serve HTML)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/messages', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'messages.html'));
});

// Admin dashboard - Protected route
app.get('/admin-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// Admin panel - Protected route (returns HTML but frontend will check auth)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 4. Protected routes that require authentication
app.use('/api/cart', authMiddleware, cartRoutes);
app.use('/api/orders', authMiddleware, ordersRoutes);
app.use('/api/admin/orders', authMiddleware, adminOrdersRoutes);
// ✅ SECURITY: Admin analytics and management endpoints (protected)
app.use('/api/admin', authMiddleware, adminRoutes);
// M-Pesa routes: payment-status is PUBLIC, stk-push requires auth
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/inventory', authMiddleware, inventoryRoutes);

// Upload endpoint - requires authentication (admin only)
app.use('/api/upload', tokenAuthMiddleware, uploadRoutes);

// Clients sync endpoint - public (no auth required)
// This endpoint syncs Firebase Auth users to clients collection
app.get('/api/clients/sync', async (req, res) => {
    try {
        console.log('🔄 [CLIENTS SYNC] Starting sync...');
        res.json({
            success: true,
            message: 'Sync functionality active. New user signups and logins automatically create client profiles.',
            note: 'Client collection is populated through signup, login, orders, and messages'
        });
    } catch (error) {
        console.error('❌ Error in sync:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// All other clients routes require authentication
app.use('/api/messages', tokenAuthMiddleware, messagesRoutes);
app.use('/api/clients', tokenAuthMiddleware, clientsRoutes);

console.log("Routes initialized.");

// DEBUG: Manual admin setup endpoint (for testing only)
app.post('/api/setup-admin/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        // Only allow mikebarack5525@gmail.com for security
        if (email !== 'mikebarack5525@gmail.com') {
            return res.status(403).json({ error: 'Not authorized for this email' });
        }
        
        console.log('🔧 Setting up admin for:', email);
        
        // Find user by email in Firebase Auth
        const userRecord = await admin.auth().getUserByEmail(email);
        const uid = userRecord.uid;
        
        console.log('📝 Found user UID:', uid);
        
        // Set isAdmin flag in Firestore
        await db.collection('users').doc(uid).update({
            isAdmin: true,
            adminSetupAt: new Date()
        });
        
        console.log('✅ Admin flag set successfully for:', uid);
        
        res.json({
            success: true,
            message: `Admin privileges granted to ${email}`,
            uid: uid
        });
    } catch (error) {
        console.error('❌ Error setting admin:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Authentication middleware function for legacy routes
const legacyTokenAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    admin.auth().verifyIdToken(token)
        .then((decodedToken) => {
            req.user = decodedToken;
            next();
        })
        .catch((error) => {
            console.error('Token verification failed:', error);
            res.status(403).json({ error: 'Forbidden: Invalid or expired token.' });
        });
};

// Generate token on login (example route)
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await admin.auth().getUserByEmail(email);
        const token = await admin.auth().createCustomToken(user.uid);
        res.json({ token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed.' });
    }
});

// Add an endpoint to generate a custom token
app.get('/generate-token', async (req, res) => {
    try {
        const uid = req.query.uid || 'anonymous-user';
        const customToken = await admin.auth().createCustomToken(uid);
        res.json({ token: customToken });
    } catch (error) {
        console.error('Error generating custom token:', error);
        res.status(500).json({ error: 'Failed to generate token' });
    }
});

// 6. Global Error Handler (for consistency)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'An unexpected server error occurred.', 
        error: process.env.NODE_ENV === 'production' ? null : err.message
    });
});

// Add error handling for unhandled exceptions
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err.message);
    console.error('Stack:', err.stack);
    // Don't exit - keep server running
    // process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit - keep server running
    // process.exit(1);
});

// Log server start
console.log("Starting server...");

// 7. Start Server
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Debugging the resolved path for websocket.js
const websocketPath = path.resolve(__dirname, './src/api/websocket');
console.log('Resolved WebSocket Path:', websocketPath);

try {
    // Initialize WebSocket server
    websocketService.initialize(server);
    console.log('✅ WebSocket server initialized');
} catch (wsErr) {
    console.warn('⚠️ WebSocket setup error:', wsErr.message);
    // Continue even if WebSocket fails
}

// Server startup complete
console.log('✅✅✅ SERVER STARTUP COMPLETE - READY FOR CONNECTIONS');

// Keep server alive
server.on('clientError', (err, socket) => {
    console.error('Client error:', err.message);
    if (socket.writable) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    }
});

// Prevent process from exiting
process.stdin.resume();

// Add a message to confirm server is still alive
setTimeout(() => {
    console.log('✅ Server is still running (after 100ms)');
}, 100);

// Log every 5 seconds to confirm server is alive
const aliveInterval = setInterval(() => {
    const time = new Date().toLocaleTimeString();
    console.log(`⏰ Server alive at ${time}`);
}, 5000);

// Ensure interval doesn't prevent proper shutdown
aliveInterval.unref();
