// Fix product categories in Firestore
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

async function fixCategories() {
    try {
        console.log('🔧 Fixing product categories in Firestore...\n');
        
        const snapshot = await db.collection('products').get();
        
        if (snapshot.empty) {
            console.log('❌ No products found');
            process.exit(0);
        }
        
        const batch = db.batch();
        let updated = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const oldCategory = data.category;
            let newCategory = oldCategory;
            
            // Fix category names
            if (oldCategory === 'Paints') {
                newCategory = 'Paints & Chemicals';
            } else if (oldCategory === 'plumbing') {
                newCategory = 'Plumbing';
            }
            
            // Update if changed
            if (newCategory !== oldCategory) {
                batch.update(doc.ref, { category: newCategory });
                console.log(`✏️ ${data.name}: "${oldCategory}" → "${newCategory}"`);
                updated++;
            }
        });
        
        if (updated > 0) {
            await batch.commit();
            console.log(`\n✅ Updated ${updated} product(s)`);
        } else {
            console.log('\n✓ All categories are correct');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixCategories();
