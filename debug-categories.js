// Debug script to check products by category in Firestore
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase
const serviceAccountPath = path.resolve(__dirname, process.env.SERVICE_ACCOUNT_PATH || 'ithumba-materials-key.json');
const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'ithumba-materials.appspot.com'
});

const db = admin.firestore();

async function debugCategories() {
    try {
        console.log('📦 Checking products in Firestore by category...\n');
        
        // Get all products
        const snapshot = await db.collection('products').get();
        
        if (snapshot.empty) {
            console.log('❌ No products found in Firestore');
            process.exit(0);
        }
        
        console.log(`✅ Found ${snapshot.size} total product(s):\n`);
        
        // Group by category
        const byCategory = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const category = data.category || 'Uncategorized';
            
            if (!byCategory[category]) {
                byCategory[category] = [];
            }
            
            byCategory[category].push({
                id: doc.id,
                name: data.name,
                price: data.price,
                unit: data.unit
            });
        });
        
        // Display by category
        Object.keys(byCategory).forEach(category => {
            const products = byCategory[category];
            console.log(`📁 ${category} (${products.length} items)`);
            products.forEach(p => {
                console.log(`   - ${p.name} | ${p.price} (${p.unit})`);
            });
            console.log('');
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

debugCategories();
