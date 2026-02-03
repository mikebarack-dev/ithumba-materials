const admin = require('firebase-admin');
const serviceAccount = require('./ithumba-materials-key.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteAllProducts() {
    try {
        console.log('Starting to delete all products...');
        
        const snapshot = await db.collection('products').get();
        const batch = db.batch();
        let count = 0;
        
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
            count++;
        });
        
        if (count === 0) {
            console.log('No products found to delete');
            process.exit(0);
        }
        
        await batch.commit();
        console.log(`✓ Successfully deleted ${count} products`);
        process.exit(0);
    } catch (error) {
        console.error('Error deleting products:', error);
        process.exit(1);
    }
}

deleteAllProducts();
