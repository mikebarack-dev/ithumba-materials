// routes/inventory.js - Inventory Management System
const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { logger } = require('../middleware/logger');

// Get all inventory
router.get('/', isAdmin, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const search = req.query.search;

        let query = db.collection('products');

        const snapshot = await query.limit(limit).get();
        
        if (snapshot.empty) {
            return res.json([]);
        }

        let inventory = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                category: data.category,
                price: data.price,
                quantity: data.quantity || 0,
                reorderLevel: data.reorderLevel || 5,
                lastRestocked: data.lastRestocked || null,
                sku: data.sku || doc.id,
                unit: data.unit || 'pcs'
            };
        });

        // Filter by search term if provided
        if (search) {
            inventory = inventory.filter(item => 
                item.name.toLowerCase().includes(search.toLowerCase()) ||
                item.sku.toLowerCase().includes(search.toLowerCase())
            );
        }

        res.json(inventory);
    } catch (error) {
        logger.error('Get inventory error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get low stock items
router.get('/low-stock', isAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('products').get();
        
        if (snapshot.empty) {
            return res.json([]);
        }

        const lowStock = snapshot.docs
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name,
                    quantity: data.quantity || 0,
                    reorderLevel: data.reorderLevel || 5,
                    category: data.category
                };
            })
            .filter(item => item.quantity <= (item.reorderLevel || 5))
            .sort((a, b) => a.quantity - b.quantity);

        res.json(lowStock);
    } catch (error) {
        logger.error('Get low stock error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get inventory item by ID
router.get('/:productId', isAdmin, async (req, res) => {
    try {
        const doc = await db.collection('products').doc(req.params.productId).get();
        
        if (!doc.exists) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const data = doc.data();
        res.json({
            id: doc.id,
            name: data.name,
            category: data.category,
            price: data.price,
            quantity: data.quantity || 0,
            reorderLevel: data.reorderLevel || 5,
            lastRestocked: data.lastRestocked || null,
            history: data.stockHistory || []
        });
    } catch (error) {
        logger.error('Get inventory item error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update stock quantity
router.post('/:productId/update-stock', isAdmin, [
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a positive integer'),
    body('reason').optional().isString().withMessage('Reason must be a string')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { quantity, reason = 'Manual adjustment' } = req.body;
        const productId = req.params.productId;
        const adminId = req.user.uid;

        const productRef = db.collection('products').doc(productId);
        const doc = await productRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const oldQuantity = doc.data().quantity || 0;
        const difference = quantity - oldQuantity;

        // Update product with new quantity
        await productRef.update({
            quantity: quantity,
            lastRestocked: new Date().toISOString(),
            lastRestockedBy: adminId
        });

        // Log the stock change
        const historyEntry = {
            timestamp: new Date().toISOString(),
            oldQuantity,
            newQuantity: quantity,
            difference,
            reason,
            changedBy: adminId
        };

        // Add to stock history array
        await productRef.update({
            stockHistory: [...(doc.data().stockHistory || []), historyEntry]
        });

        logger.info(`Stock updated for ${productId}: ${oldQuantity} → ${quantity} (${reason})`);

        res.json({
            success: true,
            productId,
            oldQuantity,
            newQuantity: quantity,
            difference,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Update stock error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Bulk update stock
router.post('/bulk-update', isAdmin, [
    body('updates').isArray().withMessage('Updates must be an array'),
    body('updates.*.productId').notEmpty().withMessage('Product ID required'),
    body('updates.*.quantity').isInt({ min: 0 }).withMessage('Quantity must be non-negative')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { updates } = req.body;
        const results = [];

        for (const update of updates) {
            try {
                const productRef = db.collection('products').doc(update.productId);
                const doc = await productRef.get();

                if (!doc.exists) {
                    results.push({
                        productId: update.productId,
                        success: false,
                        error: 'Product not found'
                    });
                    continue;
                }

                const oldQuantity = doc.data().quantity || 0;
                await productRef.update({
                    quantity: update.quantity,
                    lastRestocked: new Date().toISOString()
                });

                results.push({
                    productId: update.productId,
                    success: true,
                    oldQuantity,
                    newQuantity: update.quantity
                });
            } catch (error) {
                results.push({
                    productId: update.productId,
                    success: false,
                    error: error.message
                });
            }
        }

        logger.info(`Bulk stock update: ${results.filter(r => r.success).length}/${results.length} successful`);

        res.json({
            success: true,
            updated: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        });
    } catch (error) {
        logger.error('Bulk update error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Set reorder level for product
router.post('/:productId/set-reorder-level', isAdmin, [
    body('level').isInt({ min: 1 }).withMessage('Level must be at least 1')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { level } = req.body;
        const productId = req.params.productId;

        const productRef = db.collection('products').doc(productId);
        const doc = await productRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Product not found' });
        }

        await productRef.update({ reorderLevel: level });

        logger.info(`Reorder level set for ${productId}: ${level}`);

        res.json({ success: true, productId, reorderLevel: level });
    } catch (error) {
        logger.error('Set reorder level error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get stock movement report
router.get('/:productId/history', isAdmin, async (req, res) => {
    try {
        const doc = await db.collection('products').doc(req.params.productId).get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const history = doc.data().stockHistory || [];
        const sorted = history.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        res.json({
            productId: doc.id,
            productName: doc.data().name,
            currentQuantity: doc.data().quantity || 0,
            history: sorted
        });
    } catch (error) {
        logger.error('Get history error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
