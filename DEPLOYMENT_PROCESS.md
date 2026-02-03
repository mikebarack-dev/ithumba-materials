# Ithumba Materials - Complete Deployment Process

## Phase 1: Pre-Deployment Setup (Local Machine)

### Step 1: Verify All Dependencies
```bash
cd "c:\Users\ADMIN\Desktop\ithumba 1"
npm list
```
**Expected Output:** All packages installed without errors

### Step 2: Create Production Environment File
Create `.env` file in root directory:
```
# Server Configuration
PORT=8081
NODE_ENV=production

# Firebase
SERVICE_ACCOUNT_PATH=ithumba-materials-key.json

# CORS & Security
CORS_ORIGIN=https://yourdomain.com

# M-Pesa Payment Gateway
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=your_shortcode
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback

# Email Service
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

# Database
MONGO_URI=(optional, if using MongoDB for sessions)
```

### Step 3: Verify Firebase Key File
```bash
# Ensure ithumba-materials-key.json exists in root
ls -la ithumba-materials-key.json
```
**Action:** Copy your Firebase service account JSON to project root

### Step 4: Test Locally
```bash
npm start
```
**Expected:** Server runs on http://localhost:8081
- Check `logs/combined.log` for startup messages
- Browser console should show no errors
- Cart badge loads correctly
- Products display in grid layout

---

## Phase 2: Database Preparation

### Step 1: Backup Current Data (Optional)
```bash
# Export current Firestore data
node debug-categories.js
```
**Action:** Save output for backup reference

### Step 2: Verify Firestore Collections
Expected collections in Firestore:
```
✓ products (6+ products)
✓ users (user profiles)
✓ orders (order history)
✓ clients (customer info)
✓ transactions (payment logs)
```

### Step 3: Deploy Firestore Rules
In Firebase Console:
1. Go to Firestore Database → Rules
2. Copy content from `firestore.rules`
3. Paste and publish

**Rules checklist:**
- ✓ Users can only read their own data
- ✓ Public can read products
- ✓ Authenticated users can create orders
- ✓ Admins have full access

---

## Phase 3: Choose Deployment Platform

### Option A: AWS EC2 (Recommended for Scale)

#### Step 1: Create EC2 Instance
1. Launch Ubuntu 22.04 LTS instance
2. Instance type: t3.medium (1GB RAM minimum)
3. Storage: 20GB SSD
4. Security group: Allow ports 80, 443, 8081

#### Step 2: Connect to Server
```bash
ssh -i your-key.pem ubuntu@your-server-ip
```

#### Step 3: Install Dependencies
```bash
sudo apt update
sudo apt install nodejs npm curl git
node -v  # Verify: v18+
npm -v   # Verify: 9+
```

#### Step 4: Set Up Project
```bash
git clone https://github.com/yourusername/ithumba-materials.git
cd ithumba-materials
npm install
```

#### Step 5: Configure Environment
```bash
nano .env
# Paste production environment variables
# Ctrl+O → Enter → Ctrl+X
```

#### Step 6: Copy Firebase Key
```bash
scp -i your-key.pem ithumba-materials-key.json ubuntu@your-server-ip:/home/ubuntu/ithumba-materials/
```

#### Step 7: Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
cd /home/ubuntu/ithumba-materials
pm2 start server.js --name "ithumba-materials"
pm2 save
pm2 startup
```

#### Step 8: Install Nginx (Reverse Proxy)
```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/default
```

Add config:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Step 9: Enable SSL (HTTPS)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

#### Step 10: Start Services
```bash
sudo systemctl restart nginx
pm2 restart ithumba-materials
```

---

### Option B: DigitalOcean App Platform (Easiest)

#### Step 1: Create App
1. Go to DigitalOcean → App Platform
2. Connect GitHub repository
3. Select `ithumba-materials` repo

#### Step 2: Configure App
- **Framework:** Node.js
- **Build Command:** `npm install`
- **Run Command:** `npm start`
- **HTTP Port:** 8081

#### Step 3: Set Environment Variables
In DigitalOcean App settings:
```
PORT=8081
NODE_ENV=production
SERVICE_ACCOUNT_PATH=ithumba-materials-key.json
CORS_ORIGIN=https://yourdomain.ondigitalocean.app
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
# ... (all .env variables)
```

#### Step 4: Upload Firebase Key
1. In file manager, create root-level secrets
2. Upload `ithumba-materials-key.json`

#### Step 5: Deploy
- Click "Deploy" button
- Wait for build completion (2-5 minutes)
- Your app is live at: `https://yourdomain.ondigitalocean.app`

---

### Option C: Heroku (Free Alternative - Not Recommended for Production)

#### Step 1: Install Heroku CLI
```bash
curl https://cli.heroku.com/install.sh | sh
```

#### Step 2: Create Procfile
In project root:
```
web: node server.js
```

#### Step 3: Deploy
```bash
heroku login
heroku create your-app-name
git push heroku main
heroku config:set PORT=8081
heroku config:set NODE_ENV=production
# ... (set all .env variables)
```

#### Step 4: View Logs
```bash
heroku logs --tail
```

---

### Option D: Docker (Best for DevOps)

#### Step 1: Create Dockerfile
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8081
CMD ["npm", "start"]
```

#### Step 2: Create .dockerignore
```
node_modules
logs
.git
.env
```

#### Step 3: Build Image
```bash
docker build -t ithumba-materials:latest .
```

#### Step 4: Run Container
```bash
docker run -d \
  --name ithumba \
  -p 8081:8081 \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  ithumba-materials:latest
```

#### Step 5: Deploy to Docker Registry
```bash
docker login
docker tag ithumba-materials:latest yourusername/ithumba-materials:latest
docker push yourusername/ithumba-materials:latest
```

---

## Phase 4: Domain & DNS Configuration

### Step 1: Update DNS Records
In your domain registrar (GoDaddy, Namecheap, etc.):
```
Type: A Record
Name: @
Value: Your-Server-IP or Platform-IP
TTL: 3600

Type: CNAME Record
Name: www
Value: yourdomain.com
TTL: 3600
```

### Step 2: Update CORS Origin
```bash
# Edit .env
CORS_ORIGIN=https://yourdomain.com
```

### Step 3: Restart Server
```bash
pm2 restart ithumba-materials
# or
docker restart ithumba
```

---

## Phase 5: SSL/HTTPS Configuration

### For AWS EC2 + Nginx
```bash
sudo certbot renew --dry-run
sudo systemctl enable certbot.timer
```

### For DigitalOcean
- Automatic SSL provisioning (enabled by default)

### For Docker
```bash
docker run -it --rm \
  -v $(pwd)/etc/letsencrypt:/etc/letsencrypt \
  certbot/certbot certonly --standalone \
  -d yourdomain.com -d www.yourdomain.com
```

---

## Phase 6: Post-Deployment Verification

### Step 1: Server Health Check
```bash
curl https://yourdomain.com/api/products
```
**Expected:** JSON array of products

### Step 2: Authentication Test
1. Open https://yourdomain.com
2. Click Login
3. Create new account with test email
4. Verify email confirmation works
5. Login successfully
6. Check profile page loads

### Step 3: Shopping Flow Test
1. Browse category pages
2. Verify products display in grid
3. Add items to cart
4. Verify cart badge updates
5. Proceed to checkout
6. Complete M-Pesa payment
7. Verify order confirmation email

### Step 4: Admin Functions
1. Login as admin
2. Access admin dashboard
3. View orders
4. Update order status
5. Check logs for activity

### Step 5: Check Logs
```bash
# SSH into server
ssh ubuntu@your-server-ip

# View application logs
tail -f /home/ubuntu/ithumba-materials/logs/combined.log
tail -f /home/ubuntu/ithumba-materials/logs/error.log
tail -f /home/ubuntu/ithumba-materials/logs/payments.log

# Or with PM2
pm2 logs ithumba-materials
```

### Step 6: Performance Test
Use tools to verify:
- ✓ Page loads in < 3 seconds
- ✓ API responds in < 500ms
- ✓ No JavaScript errors in console
- ✓ Mobile responsive (test on phone)

---

## Phase 7: Monitoring & Maintenance

### Set Up Alerts
**Option 1: PM2 Plus**
```bash
pm2 plus
pm2 link <secret_key> <public_key>
```

**Option 2: CloudWatch (AWS)**
- Set CPU > 80% alert
- Set Memory > 90% alert
- Set Error Rate > 5% alert

**Option 3: Sentry (Error Tracking)**
```bash
npm install @sentry/node
# Add to server.js (see documentation)
```

### Daily Checks
```bash
# Check server status
pm2 status

# Check disk space
df -h

# Check memory usage
free -h

# Check running processes
ps aux | grep node
```

### Weekly Tasks
1. Review error logs
2. Check payment reconciliation
3. Verify email delivery
4. Monitor database size

### Monthly Tasks
1. Update dependencies: `npm update`
2. Security audit: `npm audit`
3. Database optimization
4. Performance review

---

## Phase 8: Rollback Procedure (If Issues)

### Step 1: Stop Current Version
```bash
pm2 stop ithumba-materials
```

### Step 2: Revert Code
```bash
git revert HEAD
npm install
```

### Step 3: Restart
```bash
pm2 start ithumba-materials
```

### Step 4: Verify
```bash
curl https://yourdomain.com/api/products
```

---

## Troubleshooting Guide

### Problem: Server Won't Start
```bash
# Check logs
pm2 logs ithumba-materials

# Common causes:
# 1. Missing .env file
# 2. Firebase key not found
# 3. Port already in use
# 4. Node version mismatch
```

### Problem: Products Not Loading
```bash
# Check Firestore connection
node -e "const db = require('./db'); console.log('Connected!');"

# Check category names match API
node debug-categories.js

# Check CORS configuration
curl -H "Origin: https://yourdomain.com" https://yourdomain.com/api/products
```

### Problem: Payments Not Working
```bash
# Check M-Pesa credentials in .env
# Verify callback URL is accessible
curl https://yourdomain.com/api/mpesa/callback

# Check payment logs
tail -f logs/payments.log
```

### Problem: Email Not Sending
```bash
# Verify SMTP credentials
# Gmail: Enable "Less secure app access" or use App Password
# Check email logs
grep -i "email" logs/error.log
```

---

## Security Checklist After Deployment

- [ ] Remove debug endpoints from production
- [ ] Enable HTTPS only (no HTTP)
- [ ] Update CORS to specific domain
- [ ] Disable directory listing
- [ ] Set secure headers (Helmet.js)
- [ ] Enable rate limiting
- [ ] Set up firewall rules
- [ ] Regular security updates
- [ ] Monitor suspicious activity
- [ ] Backup database weekly

---

## Summary: Complete Timeline

| Phase | Duration | Key Activities |
|-------|----------|-----------------|
| **Setup** | 30 min | Environment setup, dependencies |
| **Platform Choice** | 15 min | Select AWS/DigitalOcean/Docker |
| **Deployment** | 15-60 min | Deploy code, configure server |
| **DNS & SSL** | 30 min | Setup domain, enable HTTPS |
| **Testing** | 30 min | Verify all functionality |
| **Monitoring** | 15 min | Setup alerts and logging |
| **Total** | 2-3 hours | Complete deployment ready |

---

## Quick Start Commands

**AWS/DigitalOcean:**
```bash
git clone <repo>
cd ithumba-materials
npm install
nano .env (add variables)
scp ithumba-materials-key.json ubuntu@server:/app/
ssh ubuntu@server
pm2 start server.js
```

**Docker:**
```bash
docker build -t ithumba .
docker run -p 8081:8081 --env-file .env ithumba
```

**Heroku:**
```bash
heroku create
git push heroku main
heroku config:set NODE_ENV=production
```

---

**Ready to deploy? Follow the platform-specific steps above!**
