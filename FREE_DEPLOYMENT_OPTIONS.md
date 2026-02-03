# FREE Deployment Options for Ithumba Materials

**Note:** Heroku's free tier ended in November 2022. Here are the best FREE alternatives:

---

## 🏆 Option 1: RENDER (RECOMMENDED - Best Free Tier)

### Why Choose Render?
✅ Generous free tier  
✅ Automatic HTTPS  
✅ Easy GitHub integration  
✅ PostgreSQL database included  
✅ Up to 750 free compute hours/month  

### Deployment Steps

#### Step 1: Create Render Account
1. Go to https://render.com
2. Sign up with GitHub account
3. Authorize Render to access your repositories

#### Step 2: Push Code to GitHub
```bash
cd "c:\Users\ADMIN\Desktop\ithumba 1"
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/ithumba-materials.git
git branch -M main
git push -u origin main
```

#### Step 3: Create Render Service
1. Go to Render Dashboard
2. Click "New +"
3. Select "Web Service"
4. Connect your GitHub repository
5. Select `ithumba-materials` repo

#### Step 4: Configure Service
**Name:** `ithumba-materials`  
**Environment:** Node  
**Build Command:** `npm install`  
**Start Command:** `npm start`  
**Instance Type:** Free ($0/month)  

#### Step 5: Add Environment Variables
In Render Dashboard → Environment:
```
PORT=8081
NODE_ENV=production
SERVICE_ACCOUNT_PATH=ithumba-materials-key.json
CORS_ORIGIN=https://yourdomain.onrender.com
MPESA_CONSUMER_KEY=your_key
MPESA_CONSUMER_SECRET=your_secret
MPESA_SHORTCODE=your_shortcode
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://yourdomain.onrender.com/api/mpesa/callback
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

#### Step 6: Upload Firebase Key
1. Create `ithumba-materials-key.json` in project root
2. Push to GitHub
3. Render will automatically use it

#### Step 7: Deploy
1. Click "Create Web Service"
2. Wait for build completion (2-5 minutes)
3. Your app is live at: `https://yourdomain.onrender.com`

#### Step 8: Connect Your Domain (Optional)
1. In Render → Settings
2. Add Custom Domain
3. Update your domain DNS:
   - Point to Render's provided CNAME

**Total Cost: $0/month** ✅

---

## 🥈 Option 2: RAILWAY.APP (Also Excellent)

### Why Choose Railway?
✅ Free tier: $5 credit/month  
✅ Simple pricing (pay per resource)  
✅ Great documentation  
✅ PostgreSQL included free  
✅ Environment variable management  

### Deployment Steps

#### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub
3. Authorize Railway

#### Step 2: Create New Project
1. Click "Create New Project"
2. Select "Deploy from GitHub repo"
3. Select your `ithumba-materials` repo

#### Step 3: Configure Environment
Railway automatically detects `package.json`

Add environment variables:
```
PORT=8081
NODE_ENV=production
SERVICE_ACCOUNT_PATH=ithumba-materials-key.json
CORS_ORIGIN=${{ RAILWAY_PUBLIC_DOMAIN }}
MPESA_CONSUMER_KEY=xxx
MPESA_CONSUMER_SECRET=xxx
MPESA_SHORTCODE=xxx
MPESA_PASSKEY=xxx
MPESA_CALLBACK_URL=https://${{ RAILWAY_PUBLIC_DOMAIN }}/api/mpesa/callback
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

#### Step 4: Deploy
1. Click "Deploy"
2. Wait for build (1-3 minutes)
3. Get your URL: `https://yourdomain-railway.app`

**Total Cost: Free with $5/month credit** ✅

---

## 🥉 Option 3: GOOGLE CLOUD RUN (Pay-as-you-go Free)

### Why Choose Google Cloud Run?
✅ Truly serverless  
✅ Pay only for execution time  
✅ Free tier: 2 million requests/month  
✅ Auto-scaling  
✅ No cost when not in use  

### Deployment Steps

#### Step 1: Set Up Google Cloud
1. Go to https://cloud.google.com
2. Create new project
3. Enable Cloud Run API
4. Enable Firestore API

#### Step 2: Create Dockerfile
Create `Dockerfile` in project root:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8081
CMD ["npm", "start"]
```

#### Step 3: Create .gcloudignore
```
node_modules
logs
.git
.env.local
```

#### Step 4: Deploy with gcloud CLI
```bash
# Install Google Cloud SDK
# https://cloud.google.com/sdk/docs/install

gcloud init
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/ithumba-materials
gcloud run deploy ithumba-materials \
  --image gcr.io/YOUR_PROJECT_ID/ithumba-materials \
  --platform managed \
  --region us-central1 \
  --memory 512Mi \
  --set-env-vars PORT=8081,NODE_ENV=production,SERVICE_ACCOUNT_PATH=ithumba-materials-key.json
```

**Total Cost: Free up to 2M requests/month** ✅

---

## Comparison Table

| Feature | Render | Railway | Google Cloud Run |
|---------|--------|---------|------------------|
| **Cost** | Free | $5 credit/month | Pay-as-you-go |
| **Setup Time** | 5 min | 5 min | 15 min |
| **GitHub Sync** | ✅ Auto | ✅ Auto | Manual |
| **Free Tier** | Generous | Good | Excellent |
| **Scalability** | Good | Good | Excellent |
| **Support** | Good | Good | Excellent |

**Recommendation:** Start with **Render** (easiest and most generous free tier)

---

## Quick Deploy with Render (Fastest Path)

### Complete Step-by-Step

**Step 1: Prepare Your Code**
```bash
cd "c:\Users\ADMIN\Desktop\ithumba 1"
```

**Step 2: Initialize Git**
```bash
git init
git add .
git commit -m "Ithumba Materials - Ready for Deployment"
```

**Step 3: Create GitHub Repository**
1. Go to github.com
2. Create new repository: `ithumba-materials`
3. Copy the commands and run:
```bash
git remote add origin https://github.com/yourusername/ithumba-materials.git
git branch -M main
git push -u origin main
```

**Step 4: Go to Render**
1. Visit https://render.com
2. Sign up with GitHub (click GitHub button)
3. Authorize access to repositories

**Step 5: Create Web Service**
1. Dashboard → New → Web Service
2. Select `ithumba-materials` repository
3. Fill in:
   - **Name:** `ithumba-materials`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

**Step 6: Set Environment Variables**
Click "Advanced" → "Add Environment Variable" for each:

```
PORT=8081
NODE_ENV=production
SERVICE_ACCOUNT_PATH=ithumba-materials-key.json
CORS_ORIGIN=https://yourdomain.onrender.com
MPESA_CONSUMER_KEY=your_key
MPESA_CONSUMER_SECRET=your_secret
MPESA_SHORTCODE=your_shortcode
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://yourdomain.onrender.com/api/mpesa/callback
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

**Step 7: Deploy**
1. Click "Create Web Service"
2. Wait for build to complete
3. When complete, you'll see your live URL

**Step 8: Test Your App**
```bash
curl https://yourdomain.onrender.com/api/products
```

Expected response: JSON array of products

**Step 9: Add Custom Domain (Optional)**
1. Render Dashboard → Settings
2. Add Custom Domain
3. Update DNS at your domain registrar:
   - CNAME record pointing to Render URL

---

## Verify Deployment Success

### Test API
```bash
curl https://yourdomain.onrender.com/api/products
curl https://yourdomain.onrender.com/api/products?category=Paints%20%26%20Chemicals
```

### Test Frontend
1. Open https://yourdomain.onrender.com
2. Click on a category (e.g., Paints)
3. Verify products load in grid
4. Try adding to cart
5. Check cart badge updates

### Test Login
1. Click Login
2. Create new account
3. Verify email confirmation
4. Login again
5. Check profile page

### Test Payment (Optional)
1. Add items to cart
2. Go to checkout
3. Complete payment
4. Check email for receipt

---

## Troubleshooting

### Build Failed
**Check logs:**
1. Render Dashboard → Logs
2. Look for error messages
3. Common issues:
   - Missing `package.json` ❌
   - Firebase key not committed ❌
   - Wrong environment variables ❌

### App Crashes After Deploy
**Solution:**
```bash
# Push fix to GitHub
git add .
git commit -m "Fix crash"
git push origin main

# Render auto-redeploys
```

### Products Not Loading
**Check:**
1. Firebase credentials correct
2. Firestore collections exist
3. Category names match exactly
4. CORS_ORIGIN is correct

### Payment Not Working
**Check:**
1. M-Pesa credentials correct
2. MPESA_CALLBACK_URL uses deployed domain (not localhost)
3. M-Pesa account is active
4. Check logs: `/logs/payments.log`

---

## Limitations of Free Tier

**Render Free Tier:**
- ✅ Single instance
- ✅ 750 compute hours/month (enough for 24/7)
- ✅ 100GB bandwidth/month
- ⚠️ App spins down after 15 min of inactivity
- ⚠️ Restart takes 30 seconds on first request

**Solution:** Upgrade to Starter ($7/month) if needed

---

## Next Steps After Deployment

1. ✅ Test all functionality
2. ✅ Monitor logs for errors
3. ✅ Add custom domain (if you have one)
4. ✅ Enable SSL (automatic on Render)
5. ✅ Share with users: `https://yourdomain.onrender.com`

---

## Complete Timeline

| Step | Time | Action |
|------|------|--------|
| 1 | 2 min | Create GitHub repo, push code |
| 2 | 2 min | Create Render account |
| 3 | 3 min | Connect GitHub to Render |
| 4 | 5 min | Add environment variables |
| 5 | 3-5 min | Deploy and wait for build |
| 6 | 5 min | Test all functionality |
| **Total** | **20-25 min** | **Live on internet!** |

---

## Example: Your App is Now Live

After deployment, your app is accessible at:
- **Main URL:** `https://yourdomain.onrender.com`
- **API:** `https://yourdomain.onrender.com/api/products`
- **Admin:** `https://yourdomain.onrender.com/admin-dashboard.html`

Share this link with users immediately! 🚀

---

**Ready to deploy?** Start with Render - it's the fastest path to production!
