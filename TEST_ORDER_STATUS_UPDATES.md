# How to Test Order Status Updates

## Prerequisites
- Server running on port 8081
- Two browser windows (or tabs with incognito mode)

## Test Steps

### 1. Create an Order (as Customer)
```
1. Open http://localhost:8081 in Browser A
2. Login as customer (create account or use existing)
3. Add items to cart
4. Go to checkout
5. Complete payment (test M-Pesa)
6. Note the order ID
7. Go to My Orders to see the order (status will be "PENDING")
```

### 2. Update Order Status (as Admin)
```
1. Open http://localhost:8081/admin.html in Browser B
2. Login as admin: mikebarack5525@gmail.com
3. Go to Orders tab
4. Find the order you created
5. Click the "Change Status" dropdown
6. Select "Processing"
7. Confirm the success alert
8. Watch the table refresh automatically
9. Status badge changes to PROCESSING (blue)
```

### 3. Verify Customer Sees Update
```
1. Go back to Browser A (customer)
2. Refresh the page or navigate away and back to My Orders
3. Find the same order
4. Verify status shows "PROCESSING" with blue badge
```

### 4. Test All Statuses
Repeat steps 2-3 with different statuses:
- pending (Yellow)
- processing (Blue)
- shipped (Gray)
- delivered (Green)
- cancelled (Red)

## Expected Results

### Admin Dashboard
- Dropdown appears in Action column for each order
- Selecting status shows alert: "✅ Order [ID] status updated to [STATUS]"
- Table refreshes immediately
- Status badge updates with correct color

### Customer Order Page
- Status displays correctly
- Color badge matches selected status
- Works on both desktop and mobile

## Troubleshooting

### Dropdown Not Appearing
- Check browser console (F12) for JavaScript errors
- Verify admin.js loaded: Look for order table in DOM
- Check that orders are loading (should see at least 1 order)

### Getting 403 Error
- Token refresh not working
- Solution: Check Firebase auth in admin.js
- Verify currentUser is set before calling API

### Status Not Updating
- Check browser console for error messages
- Verify API endpoint: `/api/orders/{orderId}/status`
- Check server logs for backend errors

### Customer Not Seeing Update
- Verify customer is logged in with correct account
- Refresh page (may be cached)
- Check that order belongs to logged-in customer
- Verify status field exists in Firestore document

## Quick Debug Commands (Browser Console)

```javascript
// Check admin authentication
console.log('Current user:', currentUser?.email)

// Test the API endpoint
await fetch('/api/orders/ORDER_ID/status', {
    method: 'PATCH',
    headers: {
        'Authorization': `Bearer ${await currentUser.getIdToken(true)}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'shipped' })
}).then(r => r.json()).then(console.log)

// View orders in admin
console.log('Loading orders...')
await loadOrdersFromAdmin()
```

## Expected Behavior Summary

✅ Admin can select status from dropdown
✅ Status updates persist to Firestore
✅ Success alert shows confirmation
✅ Table refreshes automatically
✅ Customer sees updated status immediately (after refresh)
✅ Status badges are color-coded
✅ All status transitions work (pending → processing → shipped → delivered → cancelled)
✅ Invalid statuses rejected by API
✅ No 403 errors (token refresh working)
✅ Mobile responsive on all pages

## Performance Notes
- Status update takes 1-2 seconds (Firebase write + table refresh)
- No data loss or conflicts
- Multiple admins can update different orders simultaneously
- Customer page updates immediately on refresh
