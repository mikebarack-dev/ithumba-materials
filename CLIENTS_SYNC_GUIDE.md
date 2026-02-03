# Client Account Linking System

## Overview
The system now properly links customer accounts to a `clients` collection in Firestore. This ensures the admin dashboard shows only **actual customer accounts**, not all Firebase Auth users.

## How It Works

### 1. **New Client Creation**
When a user signs up, two things happen:
- Account is created in Firebase Auth
- Client profile is automatically created in the `clients` collection

### 2. **Client Profile Updates**
Client profiles are updated with:
- **On Order Creation**: `totalOrders` and `totalSpent` incremented
- **On Message Sent**: `messageCount` incremented, `lastActive` updated
- **On Login**: `lastActive` timestamp updated

### 3. **Account Linking**
Existing accounts (created before this system) can be linked via the sync endpoint.

## API Endpoints

### Sync Existing Accounts
```bash
POST /api/clients/sync
```
Creates client profiles for all Firebase Auth users that don't have one yet.

**Response:**
```json
{
  "success": true,
  "message": "Sync complete: X new clients created, Y already existed",
  "syncedCount": 10,
  "skippedCount": 5,
  "totalProcessed": 15
}
```

### Get All Linked Clients
```bash
GET /api/clients
```
Returns only clients that have a profile in the `clients` collection.

### Update Client Activity
```bash
POST /api/clients/:uid/activity
```
Updates a client's `lastActive` timestamp.

## To Sync Existing Accounts

### Via Browser Console:
```javascript
fetch('http://localhost:8082/api/clients/sync', {
  method: 'POST'
})
.then(r => r.json())
.then(d => console.log(d))
```

### Via cURL:
```bash
curl -X POST http://localhost:8082/api/clients/sync
```

### Via PowerShell:
```powershell
Invoke-WebRequest -Uri 'http://localhost:8082/api/clients/sync' -Method POST
```

## Database Structure

### `clients` Collection
```
clients/
  {uid}/
    uid: string
    email: string
    displayName: string
    phoneNumber: string
    photoURL: string
    createdAt: timestamp (when account was created)
    lastActive: timestamp (last activity)
    status: string ('active', 'inactive')
    totalOrders: number
    totalSpent: number
    messageCount: number
```

## Benefits
✅ Admin dashboard shows only **actual customers**
✅ Accurate client count (not inflated by test accounts)
✅ Automatic activity tracking
✅ Easy to distinguish active vs inactive customers
✅ Proper customer metrics for reports

## Admin Dashboard Changes
- Shows count from `clients` collection (accurate linked accounts)
- Filters out unlinked Firebase Auth users
- Displays only customers with client profiles
