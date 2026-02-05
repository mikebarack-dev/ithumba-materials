# Firebase Key Setup for Render

## The Problem
The FIREBASE_KEY_JSON environment variable in Render is not being parsed correctly, causing Firebase authentication to fail.

## Quick Fix

### Step 1: Prepare the Key
Run this in your terminal:
```bash
cd "c:\Users\ADMIN\Desktop\ithumba 1"
type ithumba-materials-key.json
```

Copy the **entire output** (starting with `{` and ending with `}`)

### Step 2: Update Render
1. Go to https://dashboard.render.com
2. Click **ithumba-hardware** service
3. Click **Environment** tab
4. **Delete** the current `FIREBASE_KEY_JSON` value completely
5. **Paste** the key you copied from Step 1
6. Click **Save**
7. Click **Redeploy latest commit** and wait 3-5 minutes

### Step 3: Verify
Check the logs - you should see:
```
✅ Firebase Admin SDK initialized.
```

If you still see:
```
Firestore error fetching products: 16 UNAUTHENTICATED
```

Then try the **Alternative Approach** below.

## Alternative Approach: Use Base64 Encoding

If the above doesn't work, encode the key as base64:

1. Run this in your terminal:
```bash
node -e "const fs = require('fs'); const key = fs.readFileSync('ithumba-materials-key.json', 'utf8'); console.log(Buffer.from(key).toString('base64'));"
```

2. Copy the output (one long base64 string)

3. In Render Environment:
   - Delete `FIREBASE_KEY_JSON`
   - Add `FIREBASE_KEY_BASE64` and paste the base64 string
   - Save and Redeploy

4. Update server.js to decode it:
```javascript
if (process.env.FIREBASE_KEY_BASE64) {
    const keyJson = Buffer.from(process.env.FIREBASE_KEY_BASE64, 'base64').toString('utf8');
    serviceAccount = JSON.parse(keyJson);
} else if (process.env.FIREBASE_KEY_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_KEY_JSON);
}
```

## Debugging
If still not working, check:
1. Is the JSON file valid? `node -e "require('./ithumba-materials-key.json')"`
2. Are there special characters being escaped? Look for `\\n` instead of actual newlines
3. Is the entire JSON pasted (including `{` and `}`)?

