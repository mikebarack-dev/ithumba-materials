// middleware/validation.js - Input validation middleware
const { body, validationResult, param } = require('express-validator');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.param,
                message: err.msg
            }))
        });
    }
    next();
};

// ✅ SECURITY: Phone sanitization - only allow Kenya numbers
function sanitizeKenyaPhone(phone) {
    // Remove all non-digits except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // Convert Kenya formats to standard
    if (cleaned.startsWith('254')) return cleaned; // 254712345678
    if (cleaned.startsWith('+254')) return cleaned.substring(1); // +254712345678 → 254712345678
    if (cleaned.startsWith('0')) return '254' + cleaned.substring(1); // 0712345678 → 254712345678
    
    return cleaned;
}

function isValidKenyaPhone(phone) {
    const cleaned = sanitizeKenyaPhone(phone);
    // Must be: 254 (country code) + 7 or 1 (network) + 8 digits = 12 digits total
    return /^254[71]\d{8}$/.test(cleaned);
}

// Checkout form validation
const validateCheckout = [
    body('firstName')
        .trim()
        .notEmpty().withMessage('First name is required')
        .isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters')
        .matches(/^[a-zA-Z\s'-]+$/).withMessage('First name contains invalid characters'),
    
    body('lastName')
        .trim()
        .notEmpty().withMessage('Last name is required')
        .isLength({ min: 2, max: 50 }).withMessage('Last name must be 2-50 characters')
        .matches(/^[a-zA-Z\s'-]+$/).withMessage('Last name contains invalid characters'),
    
    body('email')
        .trim()
        .isEmail().withMessage('Valid email is required'),
    
    body('phone')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .custom((value) => {
            if (!isValidKenyaPhone(value)) {
                throw new Error('Invalid Kenya phone number. Use format: +254712345678 or 0712345678');
            }
            return true;
        }),
    
    body('address')
        .trim()
        .notEmpty().withMessage('Address is required')
        .isLength({ min: 5, max: 100 }).withMessage('Address must be 5-100 characters')
        .matches(/^[a-zA-Z0-9\s,.\-()]+$/).withMessage('Address contains invalid characters'),
    
    body('county')
        .trim()
        .notEmpty().withMessage('County is required')
        .isLength({ min: 2, max: 50 }).withMessage('Invalid county')
        .matches(/^[a-zA-Z\s-]+$/).withMessage('County contains invalid characters'),
    
    body('postcode')
        .trim()
        .notEmpty().withMessage('Postcode is required')
        .matches(/^[0-9]{5}$/).withMessage('Postcode must be 5 digits'),
    
    body('shippingMethod')
        .trim()
        .isIn(['CBD', 'Nairobi', 'Outside', 'Pickup']).withMessage('Invalid shipping method'),
    
    body('mpesaPhone')
        .trim()
        .notEmpty().withMessage('M-Pesa phone is required')
        .custom((value) => {
            if (!isValidKenyaPhone(value)) {
                throw new Error('Invalid M-Pesa phone number. Use format: +254712345678 or 0712345678');
            }
            return true;
        }),
    
    handleValidationErrors
];

// M-Pesa validation
const validateMpesaPayment = [
    body('phone')
        .trim()
        .notEmpty().withMessage('Phone number required')
        .custom((value) => {
            if (!isValidKenyaPhone(value)) {
                throw new Error('Invalid Kenya phone number. Use format: +254712345678 or 0712345678');
            }
            return true;
        }),
    
    body('amount')
        .isInt({ min: 1, max: 999999 }).withMessage('Amount must be 1-999999 KSh'),
    
    body('orderId')
        .trim()
        .notEmpty().withMessage('Order ID required')
        .matches(/^[a-zA-Z0-9\-_]+$/).withMessage('Invalid order ID format'),
    
    handleValidationErrors
];

// Add to cart validation
const validateAddToCart = [
    body('productId')
        .trim()
        .notEmpty().withMessage('Product ID required')
        .matches(/^[a-zA-Z0-9\-_]+$/).withMessage('Invalid product ID format'),
    
    body('quantity')
        .isInt({ min: 1, max: 100 }).withMessage('Quantity must be 1-100'),
    
    body('price')
        .isFloat({ min: 0.01 }).withMessage('Valid price required'),
    
    handleValidationErrors
];

module.exports = {
    validateCheckout,
    validateMpesaPayment,
    validateAddToCart,
    handleValidationErrors,
    sanitizeKenyaPhone,
    isValidKenyaPhone
};
