# 🚀 Quick Start: Production Features

## ⚡ 30-Second Setup

### 1. Enable Email Receipts (5 minutes)
```bash
# Open .env file and add:
EMAIL_SERVICE=gmail
EMAIL_FROM=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
```

**Get your app password:**
1. Go to myaccount.google.com
2. Security (left menu)
3. Enable "2-Step Verification"
4. Scroll to "App passwords" → Select Mail + Windows Computer
5. Copy the 16-character password
6. Paste into .env

### 2. Check Logs
```
Open: logs/combined.log       (all requests)
Open: logs/payments.log       (payment transactions)
Open: logs/error.log          (errors only)
```

### 3. Test Payment Logging
- Place an order in checkout
- Check `logs/payments.log`
- See: timestamp, user, amount, M-Pesa receipt

---

## 📊 Available Features (Now Working)

### View Payment Analytics
```javascript
// Add to your admin page
const PaymentService = require('./services/paymentService');
const stats = await PaymentService.getAnalytics(7); // Last 7 days

// Returns:
{
  totalRevenue: 15650,
  completedPayments: 12,
  failedPayments: 2,
  successRate: "85.71%"
}
```

### Check Duplicate Payments
```javascript
const dup = await PaymentService.checkDuplicate(
  userId, amount, phone, 5
);
if (dup.isDuplicate) {
  console.log('Duplicate found:', dup.existingPayment.id);
}
```

### Send Email Receipt
```javascript
const EmailService = require('./services/emailService');

// After successful payment
await EmailService.sendPaymentReceipt(payment, order);

// After order creation
await EmailService.sendOrderConfirmation(order);
```

### Generate Daily Report
```javascript
const report = await PaymentService.reconcilePayments();
// Checks: Do all payments have orders? Do all orders have payments?
// Stores report in Firestore for audit
```

---

## 🔒 Security Features (Active)

✅ **Input Validation** - Form submissions checked for:
- Invalid phone numbers rejected
- Invalid emails rejected
- Malicious input blocked
- Error messages returned

✅ **Rate Limiting** - Prevents:
- Brute force attacks (5 auth attempts/15min)
- Payment spam (5 payments/min)
- API abuse (100 requests/15min)

✅ **Logging** - All transactions logged:
- Who accessed what
- When they accessed it
- What they did
- Any errors that occurred

---

## 📈 Monitor Payment Health

### Daily Revenue Report
```javascript
const stats = await PaymentService.getAnalytics(1); // Yesterday
console.log('Yesterday revenue:', stats.totalRevenue);
```

### Weekly Trend
```javascript
const stats = await PaymentService.getAnalytics(7); // Last 7 days
console.log('Weekly success rate:', stats.successRate);
```

### Check for Problems
```javascript
const report = await PaymentService.reconcilePayments();
report.details.forEach(item => {
  if (item.status === 'unmatched') {
    console.log('⚠️ Unmatched payment:', item.paymentId);
  }
});
```

---

## 🐛 Troubleshooting

**Q: Emails not sending?**
- Check .env has EMAIL_FROM and EMAIL_PASSWORD
- Use Google App Password (not Gmail password)
- Check logs/error.log for error details

**Q: Payment logs empty?**
- Logs auto-created, check logs/payments.log
- Payment must be completed for logging
- Check Firestore for payment status

**Q: Rate limiting rejecting my requests?**
- Each user gets different limit (authenticated higher)
- Restart browser if getting 429 errors
- Increase limits in middleware/rateLimiter.js if needed

**Q: How to clear logs?**
- Delete logs/combined.log, errors will recreate
- Or just let Winston handle rotation
- Keep one copy for audit trail

---

## 📋 Firestore Collections Added

**transaction_logs** - Every payment logged here
- timestamp, userId, amount, status
- resultCode (M-Pesa response)
- mpesaReceiptNumber

**reconciliation_reports** - Daily audit reports
- date, matched count, unmatched count  
- Details of each payment/order match

---

## 🎯 What's Still TODO

- [ ] Order history page (customers view past orders)
- [ ] Inventory/stock tracking
- [ ] Invoice PDF downloads
- [ ] Admin dashboard
- [ ] Image 404 fallback
- [ ] Mobile testing

---

## 💡 Pro Tips

1. **Daily reconciliation:** Run at midnight via cron job
   ```javascript
   node -e "require('./services/paymentService').reconcilePayments()"
   ```

2. **Check revenue:** Run weekly analytics script
   ```javascript
   // Add to admin panel or email to yourself daily
   ```

3. **Monitor errors:** Check logs/error.log hourly
   ```bash
   # On your server, run daily
   tail -f logs/error.log
   ```

4. **Backup logs:** Archive old logs monthly
   ```bash
   mv logs/combined.log logs/backup-$(date +%Y%m%d).log
   ```

---

**Setup Time:** ~5 minutes (email only)
**No downtime:** Add features while running
**Backward compatible:** Existing code works as-is

🎉 **You're ready for 60% of production!**
