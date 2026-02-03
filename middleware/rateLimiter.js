// middleware/rateLimiter.js - Rate limiting to prevent abuse
const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting if user has Authorization header (authenticated)
        return req.headers.authorization && req.headers.authorization.startsWith('Bearer ');
    }
});

// Strict rate limiter for authentication
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per windowMs
    skipSuccessfulRequests: true,
    message: 'Too many login attempts, please try again later'
});

// Payment API limiter (stricter)
const paymentLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // limit each IP to 5 payment requests per minute
    message: 'Too many payment attempts, please try again later',
    skip: (req) => !req.body // Skip non-payment requests
});

// Cart limiter
const cartLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // allow 30 cart operations per minute
    skipSuccessfulRequests: false
});

module.exports = {
    apiLimiter,
    authLimiter,
    paymentLimiter,
    cartLimiter
};
