# Ithumba Materials - AI Agent Instructions

## Architecture Overview

**Ithumba** is a full-stack Node.js/Express e-commerce platform with Firebase Firestore backend. The system follows a **layered security model**: validation → rate limiting → business logic → database.

### Key Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Backend** | Express.js + Node.js | REST API for products, orders, payments, auth |
| **Database** | Firebase Firestore | Real-time data storage, transaction logs, user profiles |
| **Auth** | Firebase Auth + ID Tokens | User authentication via Bearer tokens |
| **Payments** | M-Pesa Daraja API | STK Push payments with callback handling |
| **Frontend** | Vanilla JS + HTML/CSS | Single-page app with Firebase SDK |
| **Logging** | Winston | Structured logs: `logs/{error,combined,payments}.log` |

### Data Flow for Orders

```
User Checkout → Validate Inputs → Rate Limit Check → Create Order in Firestore
    → Decrement Inventory → Log Transaction → Send M-Pesa STK Push
    → M-Pesa Callback → Mark Order Paid → Email Receipt
```

## Critical Patterns & Conventions

### 1. Middleware Execution Order (server.js)
- **Line 47**: M-Pesa callback route MUST be first (unauthenticated)
- **Line 50+**: Request logging middleware
- **Line 55+**: CORS, JSON parsing, rate limiting
- Validation middleware applied per-route using `validateCheckout`, `validateMpesaPayment`, etc.

### 2. Firebase Integration Pattern
```javascript
const firestore = admin.firestore(); // Access via admin SDK
const db = require('./db'); // Or import db.js which re-exports
// Always use Firestore transactions for multi-document updates:
const batch = firestore.batch(); // See routes/orders.js:125+
```

### 3. Authentication Pattern
- **Backend**: Expects `Authorization: Bearer {idToken}` header
- **Middleware**: `authMiddleware` (middleware/auth.js) extracts `req.userId`
- **Admin Check**: `isAdmin` middleware validates admin privileges via Firestore `users.role`
- Frontend: Firebase Auth SDK handles token generation

### 4. Input Validation Pattern
- **Source**: `middleware/validation.js` uses `express-validator`
- **Application**: Chain validation before route handlers: `router.post('/', validateCheckout, handleRequest)`
- **Error Response**: Returns 400 with `{ errors: [{ field, message }] }`
- **Patterns**: Phone format `/^[0-9\s\-\+\(\)]{9,}$/`, Kenya postcode `/^[0-9]{5}$/`

### 5. Payment Duplicate Detection
```javascript
// In services/paymentService.js:
const { isDuplicate, existingPayment } = await PaymentService.checkDuplicate(
    userId, amount, phone, timeWindowMinutes=5
);
// Time window: last 5 minutes, prevents same user/phone/amount within window
```

### 6. Order Creation Transaction
- Create order with status `"pending"` in `orders` collection
- Update `clients` collection (create if missing) with totals
- Batch decrement product `quantity` and increment `totalSold`
- Batch delete cart items
- All in single batch.commit() for atomicity (routes/orders.js:100+)

### 7. Rate Limiting Configuration
- **General API**: 100 req/15min (apiLimiter)
- **Auth**: 5 attempts/15min (authLimiter)
- **Payments**: 5 req/min (paymentLimiter)
- **Cart**: 30 ops/min (cartLimiter)
- Source: `middleware/rateLimiter.js`

### 8. Email Service Pattern
- **Service**: `services/emailService.js` (Nodemailer)
- **Usage**: Called after order/payment state changes
- **Methods**: `sendOrderConfirmation()`, `sendPaymentReceipt()`, `sendInvoice()`

### 9. Logging Pattern
- **Error**: `logger.error({ type: 'OPERATION', details })`
- **Info**: `logger.info({ type: 'ACTION', userId, amount })`
- **Warn**: `logger.warn({ type: 'POTENTIAL_ISSUE', evidence })`
- **Files**: Check `logs/error.log` for crashes, `logs/payments.log` for transactions

### 10. Product Inventory Tracking
- Decremented on order creation (routes/orders.js)
- Fields tracked: `quantity` (current stock), `totalSold` (lifetime), `lastSold` (timestamp)
- No negative quantities (use `Math.max(0, newQuantity)`)

## Developer Workflows

### Starting the Server
```bash
npm start  # or npm install + npm start
# Runs server.js on PORT (default 8081)
# Requires: ithumba-materials-key.json in root + .env file
```

### Testing M-Pesa Flow
- Use sandbox credentials in `.env`: `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`
- STK Push endpoint: `POST /api/mpesa/stk-push` → waits for callback at `POST /api/mpesa/callback`
- Test files: `test-stk-push.js`, `test-e2e-payment.js`

### Debugging Payment Issues
- Check `logs/payments.log` for transaction records
- Use `debug-payments.js` script for payment reconciliation
- Payment status flow: `pending` → `confirmed` → `failed` (in orders collection)

### Environment Variables Required
- `PORT`, `NODE_ENV`
- `SERVICE_ACCOUNT_PATH` (Firebase key file path)
- `CORS_ORIGIN`, `MONGO_URI` (if using MongoDB)
- M-Pesa: `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_URL`
- Email: `EMAIL_USER`, `EMAIL_PASSWORD`, `SMTP_HOST`, `SMTP_PORT`

## File Organization

```
/routes          → API endpoints (orders, mpesa, cart, product, admin-orders)
/middleware      → auth, validation, logging, rate limiting, token verification
/services        → Business logic (payments, emails)
/js              → Frontend controllers (checkout.js, product-detail.js, etc.)
/public          → Static HTML pages
/logs            → Winston log files (git-ignored)
/icons           → Product category icons
```

## Common Tasks & Patterns

| Task | Key Files | Pattern |
|------|-----------|---------|
| Add new API endpoint | routes/*, middleware/validation.js | Validate → Log → Execute → Respond |
| Fix payment issue | routes/mpesa.js, services/paymentService.js, logs/payments.log | Check duplicate, verify callback |
| Debug auth error | middleware/auth.js, middleware/tokenAuth.js | Verify token format, check Bearer header |
| Update product | routes/product.js, services/* | Validate input → Update Firestore → Log |
| Create order report | services/paymentService.js (reconcilePayments) | Query transaction_logs, aggregate |

## Anti-Patterns to Avoid

❌ Calling async Firestore operations without await
❌ Creating orders without batch transactions (risk of partial updates)
❌ Skipping duplicate payment checks
❌ Adding authenticated routes without rate limiting
❌ Logging sensitive data (passwords, full card numbers) - already protected in validation layer
❌ Ignoring `lastActive`/`totalOrders` fields when updating client profiles

## Testing Strategy

- **Unit**: Middleware and utilities (validation, rate limiting)
- **Integration**: Order flow with cart → checkout → payment
- **E2E**: Full M-Pesa callback cycle (test-e2e-payment.js)
- **Manual**: STK Push in sandbox mode (test-stk-push.js)
