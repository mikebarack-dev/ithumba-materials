# Order Management System - Admin Panel

## Overview
A complete order management system has been added to your Ithumba admin panel with the following features:

## Features

### 1. **View All Orders**
   - See all customer orders in a paginated table
   - Filter by order status (Pending, Paid, Processing, Shipped, Delivered, Cancelled)
   - Search orders by ID, email, phone, or customer name
   - Real-time order statistics (total orders, revenue, average order value)
   - Quick view of order details

### 2. **Order Management**
   - **Update Order Status**: Change status at any point in the fulfillment cycle
   - **Add Tracking Number**: Track shipments with tracking numbers
   - **Add Notes**: Internal notes for staff about special instructions
   - **Admin Payment Override**: Manually mark orders as paid (for cash/offline payments)

### 3. **Create Orders as Admin**
   - Create new orders without requiring M-Pesa payment
   - Add multiple items with custom quantities
   - Specify customer details (name, email, phone)
   - Optionally mark as paid immediately (for cash/on-delivery sales)
   - Add special notes and instructions

### 4. **Order Statistics**
   - Total orders count
   - Orders by status
   - Total revenue collected
   - Average order value

## Access

Navigate to: **http://localhost:8082/admin**
Click the **📋 Orders** tab

## API Endpoints

All endpoints require Firebase authentication and admin role.

### Get All Orders
```
GET /api/admin/orders?status=paid&search=customer&page=1&limit=20
Headers: Authorization: Bearer {token}
```

### Get Single Order
```
GET /api/admin/orders/{orderId}
Headers: Authorization: Bearer {token}
```

### Update Order
```
PATCH /api/admin/orders/{orderId}
Headers: Authorization: Bearer {token}
Body: {
  "status": "shipped",
  "trackingNumber": "TRK123456",
  "notes": "Special delivery instructions"
}
```

### Mark Order as Paid (Admin Override)
```
POST /api/admin/orders/{orderId}/mark-paid
Headers: Authorization: Bearer {token}
Body: {
  "paymentMethod": "cash"
}
```

### Create Order as Admin
```
POST /api/admin/orders
Headers: Authorization: Bearer {token}
Body: {
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerPhone": "254712345678",
  "items": [
    {
      "name": "Product Name",
      "quantity": 2,
      "price": 1000
    }
  ],
  "notes": "Delivery instructions",
  "markAsPaid": true
}
```

### Get Order Statistics
```
GET /api/admin/orders/stats/summary
Headers: Authorization: Bearer {token}
```

## Files Created/Modified

### New Files:
- `/routes/admin-orders.js` - Backend API endpoints for order management
- `/public/admin-orders.html` - Standalone admin orders management interface

### Modified Files:
- `/server.js` - Added admin-orders route
- `/public/admin.html` - Added Orders tab

## Order Status Workflow

1. **Pending** - Order created, awaiting payment
2. **Paid** - Payment received (M-Pesa or admin override)
3. **Processing** - Order being prepared
4. **Shipped** - Order sent (can add tracking number)
5. **Delivered** - Order received by customer
6. **Cancelled** - Order cancelled

## Admin Requirements

To access order management, your user account must have:
- Firebase authentication
- `role: "admin"` in the users collection

To set up an admin user:
1. Go to Firebase Console
2. Navigate to Firestore Database
3. Find the `users` collection
4. Edit your user document and add: `role: "admin"`

## Features for Future Enhancement

- Email notifications when order status changes
- Export orders to CSV/Excel
- Print packing slips
- Bulk order import
- Customer communication history
- Inventory auto-deduction on order creation
- Multiple warehouse support
- Order split/merge
- Recurring orders

## Support

For issues or questions:
1. Check browser console for error messages
2. Check server logs for API errors
3. Verify user has admin role
4. Ensure Firebase authentication is working
