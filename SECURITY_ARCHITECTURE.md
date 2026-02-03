# 🛡️ SECURITY ARCHITECTURE - Ithumba Materials

## Layered Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                     INCOMING REQUEST                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: HELMET SECURITY HEADERS                    ✅       │
│ - XSS Protection                                             │
│ - Content Security Policy                                    │
│ - HTTPS Redirect (production)                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: CORS VALIDATION                          ✅        │
│ - Whitelist-based origin check                               │
│ - Blocks unauthorized domains                                │
│ - Returns error for invalid origins                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: RATE LIMITING                            ✅        │
│ - General API: 100 req/15min per IP                          │
│ - Auth: 5 attempts/15min per IP                              │
│ - Payments: 5 req/min per IP                                 │
│ - Returns 429 if exceeded                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 4: REQUEST LOGGING                          ✅        │
│ - Log all requests (method, path, IP)                        │
│ - Structured JSON logging                                    │
│ - Security events logged separately                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼ (public endpoints only)
           ┌─────────────────┐
           │   PUBLIC API    │ (M-Pesa Callback, etc.)
           │   ENDPOINTS     │
           └────────────────┐│
                            │ auth required
                            │
           ┌────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 5: AUTHENTICATION (Protected Routes)        ✅        │
│ - Check Authorization header format                          │
│ - Verify Bearer token is Firebase ID token                  │
│ - Validate token format (min length)                         │
│ - Verify user exists in Firebase Auth                        │
│ - Extract req.userId for downstream use                      │
│ - Log unauthorized attempts with IP                          │
└────────────────────┬────────────────────────────────────────┘
                     │
           ┌─────────┴──────────┐
           │                    │
           ▼ (user routes)      ▼ (admin routes)
    ┌────────────────┐    ┌──────────────────┐
    │  USER ROUTES   │    │ LAYER 6: ADMIN   │
    │                │    │ AUTHORIZATION    │ ✅
    │ /api/orders    │    │ - Check isAdmin  │
    │ /api/cart      │    │   in Firestore   │
    │ /api/profile   │    │ - Strict equal   │
    │                │    │ - Log failures   │
    └────────────────┘    └──────────────────┘
           │                    │
           ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 7: INPUT VALIDATION                         ✅        │
│ - Express-validator rules per endpoint                       │
│ - Phone number format (Kenya)                                │
│ - Email validation                                           │
│ - Amount bounds (min/max)                                    │
│ - Address sanitization                                       │
│ - Return 400 with error details if fails                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 8: BUSINESS LOGIC                                     │
│ - Process request (create order, payment, etc.)              │
│ - Additional checks (inventory, duplicate payment, etc.)     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 9: FIRESTORE SECURITY                      ✅        │
│ - Database-level access control                              │
│ - Firestore Security Rules                                   │
│ - Admin SDK (server-side) bypass RLS                         │
│ - Collection-level permissions                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌─────────────────────────┐
         │  FIRESTORE DATABASE     │
         │  (Encrypted at rest)    │
         └─────────────────────────┘
```

---

## Protected Routes & Requirements

### ✅ Public Routes (No Auth Required)
```
GET  /                          → Serve index.html
GET  /messages                  → Serve messages.html
GET  /admin                     → Serve admin.html (frontend checks auth)
GET  /api/products              → List products
POST /api/mpesa/callback        → M-Pesa webhook (signature validated)
GET  /api/clients/sync          → Client sync info
```

### 🔐 Protected Routes (Auth Required)
```
POST /api/auth/login            → Rate limited (5/15min)
POST /api/auth/signup           → Rate limited (5/15min)

POST /api/orders                → Create order (req.userId required)
GET  /api/orders                → List user's orders
POST /api/cart                  → Add to cart
GET  /api/inventory             → Get inventory

POST /api/mpesa/stk-push        → Initiate payment (auth + validation)
GET  /api/mpesa/payment-status  → Check payment status

POST /api/upload                → Upload product image (admin only)
```

### 👑 Admin Routes (Auth + Admin Role Required)
```
POST /api/admin/analytics       → Payment analytics
POST /api/admin/dashboard       → Dashboard data
GET  /api/admin/orders          → List all orders
PUT  /api/admin/orders/:id      → Update order status
DELETE /api/admin/products/:id  → Delete product
```

---

## Rate Limiting Rules

### General API Limiter
```javascript
- Max Requests: 100 per 15 minutes
- Per: IP Address
- Reset: After 15 minutes
- Bypasses: Authenticated users (if they have valid Bearer token)
```

### Auth Limiter (login/signup)
```javascript
- Max Attempts: 5 per 15 minutes
- Per: IP Address  
- Reset: After 15 minutes
- Skip Success: No (counts all attempts)
- Purpose: Prevent brute force attacks
```

### Payment Limiter
```javascript
- Max Requests: 5 per 1 minute
- Per: IP Address
- Reset: After 1 minute
- Purpose: Prevent duplicate payments
```

### Cart Limiter
```javascript
- Max Operations: 30 per 1 minute
- Per: IP Address
- Reset: After 1 minute
- Purpose: Prevent cart spam
```

---

## Input Validation Rules

### Phone Number Validation
```
Format:   Kenya-specific (12 digits)
Valid:    254712345678, 0712345678, +254712345678
Invalid:  1234567890 (too short), abc123 (letters)
Regex:    ^254[71]\d{8}$
Sanitize: Remove +, convert 0→254
```

### Email Validation
```
Format:   Standard email format
Valid:    user@domain.com, john.doe@company.co.ke
Invalid:  notanemail, @domain.com
Method:   Express-validator isEmail()
```

### Amount Validation
```
Range:    1 to 999999 KSh
Type:     Integer
Valid:    1, 100, 50000
Invalid:  0, -100, 1000000
```

### Address Validation
```
Length:   5-100 characters
Chars:    a-z, A-Z, 0-9, space, comma, period, hyphen, parens
Valid:    123 Main St, Apartment 5
Invalid:  123 Main St @ #$%, SQL injection attempts
```

---

## Authentication Flow

```
┌──────────────────┐
│ Frontend/Client  │
└────────┬─────────┘
         │
         │ 1. User enters credentials
         ▼
┌──────────────────────────┐
│ Firebase Auth SDK        │
│ (Client-side)            │
│ - Create user            │
│ - Generate ID token      │
└────────┬─────────────────┘
         │
         │ 2. Send ID token in Authorization header
         │    Authorization: Bearer {idToken}
         ▼
┌──────────────────────────┐
│ Express Server           │
│ 1. Extract token         │
│ 2. Verify format         │
│ 3. Decode with Admin SDK │
│ 4. Verify user exists    │
│ 5. Set req.userId        │
└────────┬─────────────────┘
         │
         │ 3. Continue to route handler
         ▼
┌──────────────────────────┐
│ Route Handler            │
│ Use req.userId for ops   │
└──────────────────────────┘
```

---

## Admin Authorization Flow

```
┌──────────────────────────┐
│ Authenticated Request     │
│ (req.userId already set) │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ isAdmin Middleware           │
│ 1. Get req.userId            │
│ 2. Query Firestore users/:id │
│ 3. Check isAdmin === true    │
│ 4. Log if false              │
└────────┬─────────────────────┘
         │
    ┌────┴────┐
    │          │
    ▼          ▼
 Allowed    Forbidden
 (200)        (403)
   │            │
   │            └──→ Return: "Admin access required"
   │
   ▼
Continue to handler
```

---

## Payment Security Flow

```
┌─────────────────────┐
│ POST /api/mpesa/stk-push
│ with phone, amount, orderId
└──────────┬──────────┘
           │
           ▼
     [Auth Check]
     (Bearer token)
           │
           ▼
   [Rate Limiting Check]
   (5 requests/min)
           │
           ▼
  [Input Validation]
  - Phone format
  - Amount (1-999999)
  - Order ID format
           │
           ▼
  [Duplicate Payment Check]
  - Last 5 minutes
  - Same user/phone/amount
           │
           ▼
   [Create Payment Record]
   status: "pending"
           │
           ▼
  [Send M-Pesa STK Push]
           │
           ▼ (async callback)
┌─────────────────────────────┐
│ POST /api/mpesa/callback    │
│ (M-Pesa webhook)            │
└──────────┬──────────────────┘
           │
           ▼
 [Validate Callback Signature]
 - Check required fields
 - Verify CheckoutRequestID
           │
           ▼
   [Update Payment Status]
   pending → completed/failed
           │
           ▼
  [Update Order Status]
  [Send Receipt Email]
  [Log Transaction]
```

---

## Security Headers Applied

```
Helmet.js protects against:

✅ XSS (Cross-Site Scripting)
   Content-Security-Policy: default-src 'self'

✅ Clickjacking
   X-Frame-Options: DENY

✅ MIME-Type Sniffing
   X-Content-Type-Options: nosniff

✅ Referrer Policy
   Referrer-Policy: no-referrer

✅ Strict Transport Security (HTTPS)
   Strict-Transport-Security: max-age=31536000

✅ DNS Prefetch Control
   X-DNS-Prefetch-Control: off

✅ Powered-By Header (Hide stack)
   Removes X-Powered-By header
```

---

## Logging Strategy

### Error Log (`logs/error.log`)
```json
{
  "timestamp": "2024-02-02T10:30:00Z",
  "level": "error",
  "type": "TOKEN_VERIFICATION_FAILED",
  "userId": "user123",
  "ip": "192.168.1.1",
  "endpoint": "/api/admin/analytics",
  "error": "Token expired"
}
```

### Payment Log (`logs/payments.log`)
```json
{
  "timestamp": "2024-02-02T10:30:00Z",
  "type": "PAYMENT_INITIATED",
  "userId": "user123",
  "orderId": "order-1234567890",
  "amount": 5000,
  "phone": "254712345678",
  "checkoutRequestId": "ws_CO_DMZ_123"
}
```

### Combined Log (`logs/combined.log`)
```
2024-02-02T10:30:00Z [INFO] User signup: user123
2024-02-02T10:30:05Z [WARN] Failed login attempt from 192.168.1.1
2024-02-02T10:30:10Z [ERROR] Rate limit exceeded: 192.168.1.1
```

---

## Testing Security

### Test CORS
```bash
# Should FAIL (blocked by CORS):
curl -i -H "Origin: http://attacker.com" \
  http://localhost:8081/api/products

# Should SUCCEED (whitelisted origin):
curl -i -H "Origin: https://yourdomain.com" \
  http://localhost:8081/api/products
```

### Test Rate Limiting
```bash
# Run 6 times, 6th should fail with 429:
for i in {1..6}; do
  curl -i -X POST http://localhost:8081/api/auth/login \
    -d '{"email":"test@test.com","password":"test"}'
  sleep 1
done
```

### Test Authentication
```bash
# Should FAIL (no token):
curl -i http://localhost:8081/api/orders

# Should FAIL (invalid token):
curl -i -H "Authorization: Bearer invalid_token" \
  http://localhost:8081/api/orders

# Should SUCCEED (valid token):
curl -i -H "Authorization: Bearer {valid_firebase_idtoken}" \
  http://localhost:8081/api/orders
```

### Test Admin Authorization
```bash
# Should FAIL (user not admin):
curl -i -H "Authorization: Bearer {user_token}" \
  http://localhost:8081/api/admin/analytics

# Should SUCCEED (admin user):
curl -i -H "Authorization: Bearer {admin_token}" \
  http://localhost:8081/api/admin/analytics
```

### Test Input Validation
```bash
# Should FAIL (invalid phone):
curl -X POST http://localhost:8081/api/mpesa/stk-push \
  -H "Authorization: Bearer {token}" \
  -d '{"phone":"invalid","amount":5000}'

# Should FAIL (invalid amount):
curl -X POST http://localhost:8081/api/mpesa/stk-push \
  -H "Authorization: Bearer {token}" \
  -d '{"phone":"254712345678","amount":0}'

# Should SUCCEED:
curl -X POST http://localhost:8081/api/mpesa/stk-push \
  -H "Authorization: Bearer {token}" \
  -d '{"phone":"254712345678","amount":5000}'
```

---

## Incident Response

### If You See Rate Limiting Attacks
```
Check: tail -f logs/combined.log | grep "429"
Then: 
  1. Identify attacker IP
  2. Add to WAF/firewall blocklist (if available)
  3. Consider temporary IP ban if persistent
  4. Review logs for other attack patterns
```

### If You See Failed Auth Attempts
```
Check: tail -f logs/error.log | grep "TOKEN_VERIFICATION_FAILED"
Then:
  1. Identify affected users
  2. Check if tokens are expired (normal)
  3. Check if attacker is trying multiple IPs
  4. Verify Firebase Auth is functioning
```

### If You See Unauthorized Admin Access
```
Check: tail -f logs/error.log | grep "UNAUTHORIZED_ADMIN_ACCESS"
Then:
  1. Identify user and IP
  2. Check if user should be admin
  3. If not, investigate why non-admin can access
  4. Review admin list in Firestore
```

---

## Production Deployment Checklist

- [ ] `.env` has production values
- [ ] `CORS_ORIGIN` set to legitimate domains only
- [ ] `NODE_ENV=production`
- [ ] `.env` is in `.gitignore` (never committed)
- [ ] `ithumba-materials-key.json` never committed
- [ ] HTTPS enabled (CORS_ORIGIN uses https://)
- [ ] MPESA_CALLBACK_URL is HTTPS
- [ ] Rate limits appropriate for traffic
- [ ] Firestore Security Rules deployed
- [ ] Backups configured
- [ ] Monitoring/alerting setup
- [ ] Logs rotation configured
- [ ] Admin users properly assigned
- [ ] Test auth flow works end-to-end
- [ ] Test payment flow works end-to-end

---

**Last Updated:** February 2, 2026  
**Status:** ✅ Security architecture documented  
**Version:** 1.0
