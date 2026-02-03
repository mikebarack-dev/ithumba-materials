# 🚀 QUICK REFERENCE - Security Fixes

## What Was Fixed

| Problem | Solution | File | Status |
|---------|----------|------|--------|
| 🔴 CORS open to any domain | Whitelist-based validation | [server.js](server.js#L72) | ✅ |
| 🔴 No rate limiting on auth | 5 attempts/15min on login | [server.js](server.js#L94) | ✅ |
| 🔴 Admin routes unprotected | Added `authMiddleware + isAdmin` | [server.js](server.js#L235) | ✅ |
| 🔴 Weak token validation | Format + existence checks | [auth.js](middleware/auth.js#L14) | ✅ |
| 🟡 Secrets in environment | .env in .gitignore | [.gitignore](.gitignore) | ✅ |

---

## Deployment Checklist

### 1. Update Configuration
```bash
# Edit .env and set your domains
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback
NODE_ENV=production
```

### 2. Restart Server
```bash
npm start
```

### 3. Test Each Protection
```bash
# Test 1: CORS blocks wrong origin
curl -H "Origin: http://attacker.com" http://localhost:8081/api/products

# Test 2: Rate limiting works (6th fails with 429)
for i in {1..6}; do curl -X POST http://localhost:8081/api/auth/login; done

# Test 3: Admin requires auth
curl http://localhost:8081/api/admin/orders
# Should return 401

# Test 4: Valid auth works
curl -H "Authorization: Bearer {token}" http://localhost:8081/api/orders
# Should return order data
```

### 4. Monitor Logs
```bash
tail -f logs/error.log
tail -f logs/combined.log
```

---

## Rate Limits

```
General API:     100 requests / 15 minutes per IP
Auth Routes:     5 attempts / 15 minutes per IP
Payments:        5 requests / 1 minute per IP
Cart:            30 operations / 1 minute per IP
```

---

## Protected Routes

### 🔐 Auth Required
```
POST /api/orders
GET  /api/orders
POST /api/cart
GET  /api/inventory
POST /api/mpesa/stk-push
```

### 👑 Auth + Admin Required
```
POST /api/admin/analytics
GET  /api/admin/orders
PUT  /api/admin/orders/:id
DELETE /api/admin/products/:id
```

---

## Troubleshooting

### CORS Error in Frontend
```
Problem: "Access to XMLHttpRequest blocked by CORS policy"

Solution:
1. Check that frontend domain is in .env CORS_ORIGIN
2. Make sure it's HTTPS in production
3. Restart server after changing .env
4. Clear browser cache
```

### Rate Limited (429)
```
Problem: "Too many requests" on login

Solution:
1. Wait 15 minutes for IP limit to reset
2. Use different IP if testing
3. Check if legitimate users are being blocked
4. Adjust limits in middleware/rateLimiter.js if needed
```

### Admin Endpoint Returns 403
```
Problem: "Admin access required" even for admin user

Solution:
1. Verify user has isAdmin === true in Firebase
2. Check that token is valid
3. Ensure token is passed as Bearer header
4. Try signing out and back in
```

---

## Security Headers Applied

```
✅ Content-Security-Policy      (XSS protection)
✅ X-Frame-Options: DENY         (Clickjacking protection)
✅ X-Content-Type-Options       (MIME-type sniffing protection)
✅ Strict-Transport-Security    (HTTPS enforcement)
✅ Referrer-Policy              (Privacy)
✅ X-DNS-Prefetch-Control       (DNS leaks prevention)
```

---

## Files to Monitor

```
logs/error.log         → Authentication & authorization failures
logs/payments.log      → Payment transaction details
logs/combined.log      → All requests with details
.env                   → Secret configuration (NEVER commit!)
middleware/auth.js     → Authentication logic
server.js             → Route protection & middleware
```

---

## Environment Variables

### Required
```env
PORT=8081
NODE_ENV=production
SERVICE_ACCOUNT_PATH=./ithumba-materials-key.json
```

### CORS Configuration
```env
# Single domain
CORS_ORIGIN=https://yourdomain.com

# Multiple domains (comma-separated)
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com,https://app.yourdomain.com
```

### M-Pesa (Secrets - Keep Secure!)
```env
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_SHORTCODE=174379
MPESA_PASSKEY=...
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback
```

---

## Key Concepts

### Authentication
- Uses Firebase ID tokens sent as `Authorization: Bearer {token}`
- Valid tokens required for protected routes
- Token format validated before Firebase verification

### Authorization (Admin)
- Requires role check in Firestore
- User must have `isAdmin === true`
- Checked per-request, can be revoked immediately

### Rate Limiting
- IP-based (not per-user)
- Sliding window approach
- Returns 429 when exceeded

### CORS
- Origin must match whitelist
- Checked before request reaches handler
- Prevents cross-origin data theft

### Input Validation
- Express-validator rules per endpoint
- Returns 400 with errors if validation fails
- Prevents SQL injection and malicious payloads

---

## Common curl Commands

### Test Public API
```bash
curl http://localhost:8081/api/products
```

### Test Protected API (requires token)
```bash
curl -H "Authorization: Bearer {firebase_idtoken}" \
  http://localhost:8081/api/orders
```

### Test Admin API
```bash
curl -H "Authorization: Bearer {admin_idtoken}" \
  http://localhost:8081/api/admin/orders
```

### Test Rate Limiting
```bash
for i in {1..6}; do
  curl -w "\n%{http_code}\n" \
    -X POST http://localhost:8081/api/auth/login \
    -d '{"email":"test@test.com","password":"test"}'
done
# 1-5 should be 401, 6th should be 429
```

### Test CORS
```bash
# This should fail
curl -i -H "Origin: http://attacker.com" \
  http://localhost:8081/api/products

# This should succeed (if domain in CORS_ORIGIN)
curl -i -H "Origin: https://yourdomain.com" \
  http://localhost:8081/api/products
```

---

## Related Documentation

- [SECURITY_FIXES_SUMMARY.md](SECURITY_FIXES_SUMMARY.md) - Complete overview
- [SECURITY_HARDENING.md](SECURITY_HARDENING.md) - Detailed implementation
- [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) - Layered security model
- [BEFORE_AND_AFTER.md](BEFORE_AND_AFTER.md) - Comparison of changes

---

## Getting Help

### If CORS is blocking valid requests:
1. Check browser Network tab for actual origin
2. Verify it's exactly in CORS_ORIGIN (comma-separated if multiple)
3. Ensure HTTPS (http vs https matters)
4. Restart server after .env changes

### If rate limiting is too strict:
1. Edit `middleware/rateLimiter.js`
2. Adjust `max` value in respective limiter
3. Restart server

### If admin endpoints return 403:
1. Verify user in Firebase Console
2. Check Firestore users collection for isAdmin field
3. Ensure token hasn't expired

---

## Last Checklist Before Deploy

- [ ] .env updated with your domains
- [ ] NODE_ENV set to 'production'
- [ ] HTTPS enabled (all URLs https://)
- [ ] Firebase credentials secure
- [ ] Logs directory writable
- [ ] All tests passing
- [ ] Admin users assigned
- [ ] CORS origins confirmed
- [ ] M-Pesa callback URL correct
- [ ] Database backups configured

---

**Version:** 1.0  
**Last Updated:** February 2, 2026  
**Status:** ✅ Ready for deployment
