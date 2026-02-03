# Admin Setup Guide

## Making a User an Admin

To enable a user to access the order management system, they need to be marked as admin in Firebase.

### Step 1: Get User ID
1. Have the user log in to your app
2. Open browser DevTools (F12)
3. Go to Console tab
4. Type: `localStorage.getItem('userId')`
5. Copy the user ID that appears

### Step 2: Add Admin Role to Firebase
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (ithumba-materials)
3. Go to **Firestore Database**
4. Click on **Collections**
5. Find the **users** collection
6. Find the user document with the ID from Step 1
7. Click to edit it
8. Add a new field:
   - Field name: `role`
   - Value: `admin`
   - Type: String
9. Click Save

### Step 3: Test Access
1. Log in as that user
2. Go to: http://localhost:8082/admin
3. You should see the **📋 Orders** tab
4. Click it to access order management

## Admin Permissions

Users with `role: "admin"` can:
- ✅ View all orders
- ✅ Search and filter orders
- ✅ View order details
- ✅ Update order status
- ✅ Add tracking numbers
- ✅ Add order notes
- ✅ Create new orders
- ✅ Mark orders as paid (override)

Users without admin role:
- ❌ Cannot access order management
- ✅ Can still place orders normally
- ✅ Can view their own orders in profile

## Quick Admin Actions

### From Orders List
1. **View** - Click View button to see full order details
2. **Edit** - Click Edit to update status/tracking
3. **Mark Paid** - Click Edit, check "Mark as Paid", Save

### Create New Order
1. Click **Create Order** tab
2. Enter customer details
3. Add items (click "+ Add Item" for multiple)
4. Optionally check "Mark as Paid"
5. Click **Create Order**

### Update Order Status
1. Click **Edit** on an order
2. Change status from dropdown
3. Optionally add tracking number or notes
4. Click **Save Changes**

## Troubleshooting

### "Admin access required" error
- Make sure your user has `role: "admin"` in Firestore
- Log out and back in
- Clear browser cache

### Orders not loading
- Check server is running: http://localhost:8082/api/products
- Make sure you have authentication token
- Check browser console for errors

### Can't create orders
- Make sure at least 1 item is added
- Customer name is required
- Check for validation errors in browser console

## Multiple Admins

You can make multiple users admins by repeating the process for each user:
1. Get their user ID
2. Add `role: "admin"` to their user document in Firebase
