// Minimal test server with route imports
const express = require('express');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const path = require('path');

dotenv.config();

console.log('1. Initializing Firebase...');
try {
    const serviceAccountPath = path.resolve(__dirname, process.env.SERVICE_ACCOUNT_PATH);
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin SDK initialized');
} catch (error) {
    console.error('❌ Firebase error:', error.message);
    process.exit(1);
}

const app = express();
const PORT = 8082;

console.log('2. Creating app...');
app.use(express.json());

console.log('3. Loading routes...');
try {
    console.log('   - Loading cart routes...');
    const cartRoutes = require('./routes/cart');
    app.use('/api/cart', cartRoutes);
    console.log('   ✅ Cart routes loaded');
} catch (e) {
    console.error('   ❌ Cart routes failed:', e.message);
}

try {
    console.log('   - Loading product routes...');
    const productRoutes = require('./routes/product');
    app.use('/api/products', productRoutes);
    console.log('   ✅ Product routes loaded');
} catch (e) {
    console.error('   ❌ Product routes failed:', e.message);
}

try {
    console.log('   - Loading inventory routes...');
    const inventoryRoutes = require('./routes/inventory');
    app.use('/api/inventory', inventoryRoutes);
    console.log('   ✅ Inventory routes loaded');
} catch (e) {
    console.error('   ❌ Inventory routes failed:', e.message);
}

console.log('4. Starting server...');
const server = app.listen(PORT, () => {
    console.log(`✅ Test server running on port ${PORT}`);
});

console.log('✅✅✅ SERVER STARTUP COMPLETE - READY FOR CONNECTIONS');

// Keep alive
process.stdin.resume();
