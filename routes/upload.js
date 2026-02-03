// routes/upload.js - Handle image uploads to Firebase Storage OR local storage as fallback
const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

/**
 * POST /api/upload
 * Upload image file to Firebase Storage with local fallback
 * Requires authentication (admin only)
 */
router.post('/', async (req, res) => {
    try {
        // Check if file exists
        if (!req.files || !req.files.file) {
            return res.status(400).json({
                success: false,
                error: 'No file provided'
            });
        }

        const file = req.files.file;

        // Validate file size (5MB max)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            return res.status(400).json({
                success: false,
                error: 'File must be smaller than 5MB'
            });
        }

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.mimetype)) {
            return res.status(400).json({
                success: false,
                error: 'Only JPG, PNG, and WebP images are allowed'
            });
        }

        try {
            // Try Firebase Storage first
            const timestamp = Date.now();
            const filename = `products/${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            
            try {
                const bucket = admin.storage().bucket();
                const fileRef = bucket.file(filename);
                
                // Upload file with metadata
                await fileRef.save(file.data, {
                    metadata: {
                        contentType: file.mimetype
                    }
                });

                // Make file public
                await fileRef.makePublic();
                
                // Get the download URL
                const downloadURL = `https://storage.googleapis.com/${bucket.name}/${filename}`;

                console.log('✅ File uploaded to Firebase Storage:', downloadURL);

                return res.json({
                    success: true,
                    url: downloadURL,
                    filename: filename,
                    source: 'firebase'
                });
            } catch (firebaseError) {
                console.log('⚠️  Firebase Storage not available');
                console.log('📝 To enable Firebase Storage:');
                console.log('   1. Go to https://console.firebase.google.com/');
                console.log('   2. Select project: ithumba-materials');
                console.log('   3. Click Storage → Start');
                console.log('   4. Accept defaults (creates ithumba-materials.appspot.com bucket)');
                console.log('   5. Refresh this page');
                console.log('');
                console.log('Using local storage fallback for now...');
                console.log('Firebase error:', firebaseError.message);
                
                // Fallback to local storage
                const uploadsDir = path.join(__dirname, '../public/uploads/products');
                if (!fs.existsSync(uploadsDir)) {
                    fs.mkdirSync(uploadsDir, { recursive: true });
                }

                const ext = path.extname(file.name);
                const localFilename = `${timestamp}_${Math.random().toString(36).substr(2, 9)}${ext}`;
                const localPath = path.join(uploadsDir, localFilename);

                // Save file locally
                fs.writeFileSync(localPath, file.data);

                // Return URL for local file
                const downloadURL = `/uploads/products/${localFilename}`;

                console.log('✅ File uploaded to local storage:', downloadURL);

                return res.json({
                    success: true,
                    url: downloadURL,
                    filename: localFilename,
                    source: 'local'
                });
            }
        } catch (error) {
            console.error('Upload error:', error.message);
            return res.status(500).json({
                success: false,
                error: 'Failed to upload file: ' + error.message
            });
        }
    } catch (error) {
        console.error('Upload handler error:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Upload failed: ' + error.message
        });
    }
});

module.exports = router;
