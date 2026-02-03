# Security Fixes Implementation Guide

## ✅ Completed Fixes

### 1. Firestore Security Rules (`firestore.rules`)
**Status**: ✅ Created
- Restricts orders/payments to authenticated users only
- Admin-only access to transaction logs
- User-specific cart/wishlist protection
- Product catalog is public (read-only)
- Messages only visible to participants or admin

**Deploy via Firebase Console**:
1. Go to Firestore → Rules
2. Copy contents of `firestore.rules`
3. Click "Publish"

---

## 🔄 Next Steps to Implement

### 2. Install Helmet (Security Headers)
```bash
npm install helmet
```

Then update `server.js` (after line 41):
```javascript
const helmet = require('helmet');
app.use(helmet());
```

### 3. M-Pesa Callback Signature Validation
File: `routes/mpesa.js`
- Add signature verification before processing callback
- Use `crypto` to validate HMAC-SHA256

### 4. Enforce HTTPS in Production
Update `server.js` to redirect HTTP → HTTPS:
```javascript
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            res.redirect(`https://${req.header('host')}${req.url}`);
        } else {
            next();
        }
    });
}
```

### 5. Strengthen Phone Validation
Update `middleware/validation.js` to reject dangerous characters in M-Pesa phone:
- Allow only: `+254`, `0`, `2`, `5` followed by 8 digits
- Reject: `<`, `>`, `'`, `"`, `;`, `&`, etc.

---

## 🔒 Security Checklist

- [ ] Deploy firestore.rules to Firebase
- [ ] Install helmet and add to server.js
- [ ] Add M-Pesa signature validation
- [ ] Add HTTPS redirect (production)
- [ ] Remove sensitive logs from console
- [ ] Set up CORS to specific domain (not '*')
- [ ] Rotate M-Pesa credentials after testing
- [ ] Never commit .env file to git
- [ ] Use HTTP-only cookies for auth (future enhancement)

---

## Testing Security

1. **Test Firestore Rules**:
   - Try reading other user's orders (should fail)
   - Try creating order without auth (should fail)
   - Try modifying payment status (should fail unless admin)

2. **Test M-Pesa Validation**:
   - Send callback with forged signature
   - System should reject it

3. **Test Rate Limiting**:
   - Rapid requests should be blocked

