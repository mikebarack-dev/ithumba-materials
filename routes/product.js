// routes/product.js (UPDATED for Firestore with Fallback)

const express = require('express');
const router = express.Router();
// Import the Firestore instance from db.js
const db = require('../db'); 

// Set the name of your product collection
const PRODUCTS_COLLECTION = 'products'; 

// Load fallback products from JSON
let fallbackProducts = [];
try {
    const fallbackData = require('../products-fallback.json');
    fallbackProducts = fallbackData.products || [];
    console.log('✅ Loaded', fallbackProducts.length, 'fallback products for API');
} catch (error) {
    console.error('⚠️ Could not load fallback products:', error.message);
}

/**
 * GET /api/products
 * Fetch all products, or filter by category/search term.
 * Falls back to JSON if Firestore is unavailable.
 */
router.get('/', async (req, res, next) => {
    console.log('GET /api/products - Fetching all products'); // Debug log

    try {
        const { category, search } = req.query;
        let queryRef = db.collection(PRODUCTS_COLLECTION);
        
        // Build the Firestore query dynamically
        if (category) {
            // Filter by category field
            queryRef = queryRef.where('category', '==', category);
        }

        const snapshot = await queryRef.get();
        
        if (snapshot.empty) {
            return res.status(200).json([]); // Return an empty array if none found
        }
        
        let products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data() // Includes name, unit, price, category, etc.
        }));
        
        // Client-side search filter for name/description
        // This is efficient for datasets < 10k products
        if (search) {
            const searchLower = search.toLowerCase();
            products = products.filter(product => {
                const name = (product.name || '').toLowerCase();
                const description = (product.description || '').toLowerCase();
                const category = (product.category || '').toLowerCase();
                
                return name.includes(searchLower) || 
                       description.includes(searchLower) ||
                       category.includes(searchLower);
            });
        }
        
        console.log('GET /api/products - Products fetched:', products.length, 'items'); // Debug log
        res.json(products);
        
    } catch (error) {
        console.error("Firestore error fetching products:", error.message);
        
        // FALLBACK: Use JSON products if Firestore is unavailable
        console.log('⚠️ Falling back to JSON products...');
        
        let products = fallbackProducts;
        
        // Filter by category if requested
        if (req.query.category) {
            products = products.filter(p => p.category === req.query.category);
        }
        
        // Filter by search if requested
        if (req.query.search) {
            const searchLower = req.query.search.toLowerCase();
            products = products.filter(product => {
                const name = (product.name || '').toLowerCase();
                const description = (product.description || '').toLowerCase();
                return name.includes(searchLower) || description.includes(searchLower);
            });
        }
        
        console.log('📦 Returning', products.length, 'fallback products');
        res.json(products);
    }
});

/**
 * GET /api/products/:id
 * Fetch a single product by ID.
 */
router.get('/:id', async (req, res, next) => {
    const productId = req.params.id; 
    
    if (!productId) {
        return res.status(400).json({ success: false, message: 'Invalid product ID provided.' });
    }

    // Get the document reference
    const docRef = db.collection(PRODUCTS_COLLECTION).doc(productId);
    
    try {
        const docSnap = await docRef.get(); 

        if (!docSnap.exists) {
            return res.status(404).json({ success: false, message: `Product with ID ${productId} not found.` });
        }
        
        // Return the document data along with its ID
        res.json({ id: docSnap.id, ...docSnap.data() }); 
        
    } catch (error) {
        console.error("Firestore error fetching single product:", error);
        next(error); 
    }
});

/**
 * POST /api/products
 * Add a new product (Admin only)
 */
router.post('/', async (req, res) => {
    try {
        const userId = req.user?.uid;
        
        // Check if admin (basic check - you can enhance this with Firebase claims)
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { name, category, unit, price, stock, image, sku, description, featured } = req.body;

        // Validate required fields
        if (!name || !category || !unit || price === undefined) {
            return res.status(400).json({ error: 'Missing required fields: name, category, unit, price' });
        }

        const newProduct = {
            name: name.trim(),
            category: category.trim(),
            unit: unit.trim(),
            price: parseFloat(price),
            stock: parseInt(stock) || 0,
            image: image || '',
            sku: sku || '',
            description: description || '',
            featured: featured || false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const docRef = await db.collection(PRODUCTS_COLLECTION).add(newProduct);
        
        console.log('Product added:', docRef.id);

        res.status(201).json({
            success: true,
            message: 'Product added successfully',
            data: {
                id: docRef.id,
                ...newProduct
            }
        });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ 
            error: 'Failed to add product',
            message: error.message
        });
    }
});

/**
 * PUT /api/products/:id
 * Update a product (Admin only)
 */
router.put('/:id', async (req, res) => {
    try {
        const userId = req.user?.uid;
        const productId = req.params.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        const { name, category, unit, price, stock, image, sku, description, featured } = req.body;

        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (category !== undefined) updates.category = category.trim();
        if (unit !== undefined) updates.unit = unit.trim();
        if (price !== undefined) updates.price = parseFloat(price);
        if (stock !== undefined) updates.stock = parseInt(stock) || 0;
        if (image !== undefined) updates.image = image;
        if (sku !== undefined) updates.sku = sku;
        if (description !== undefined) updates.description = description;
        if (featured !== undefined) updates.featured = featured;
        
        updates.updatedAt = new Date().toISOString();

        await db.collection(PRODUCTS_COLLECTION).doc(productId).update(updates);
        
        console.log('Product updated:', productId);

        res.status(200).json({
            success: true,
            message: 'Product updated successfully',
            data: {
                id: productId,
                ...updates
            }
        });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ 
            error: 'Failed to update product',
            message: error.message
        });
    }
});

/**
 * DELETE /api/products/:id
 * Delete a product (Admin only)
 */
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user?.uid;
        const productId = req.params.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        await db.collection(PRODUCTS_COLLECTION).doc(productId).delete();
        
        console.log('Product deleted:', productId);

        res.status(200).json({
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ 
            error: 'Failed to delete product',
            message: error.message
        });
    }
});

module.exports = router;
