# 🚀 Deployment Guide - IPL Auction Game

## Deploy to Render.com (Recommended - Free)

### Prerequisites

- GitHub account
- Render.com account (free signup at https://render.com)
- Your code pushed to GitHub

### Step-by-Step Instructions

#### 1. Push Your Code to GitHub

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit your changes
git commit -m "Initial commit - IPL Auction Game"

# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to GitHub
git push -u origin main
```

#### 2. Deploy on Render

**Option A: Using render.yaml (Automatic - Recommended)**

1. Go to https://render.com and sign in
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub account if not already connected
4. Select your repository (`AUCTION-GAME`)
5. Render will detect the `render.yaml` file automatically
6. Click **"Apply"**

Render will create two services:

- `auction-game-backend` (Backend API)
- `auction-game-frontend` (Frontend React App)

**Option B: Manual Setup**

If automatic setup doesn't work:

**For Backend:**

1. Go to Render Dashboard
2. Click **"New +"** → **"Web Service"**
3. Connect your repository
4. Configure:
   - **Name**: `auction-game-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: `Free`
5. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = (leave empty for now, we'll add it after frontend is deployed)
6. Click **"Create Web Service"**
7. Wait for deployment (5-10 minutes)
8. Copy the backend URL (e.g., `https://auction-game-backend.onrender.com`)

**For Frontend:**

1. Click **"New +"** → **"Static Site"**
2. Connect your repository
3. Configure:
   - **Name**: `auction-game-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`
4. Add Environment Variables:
   - `REACT_APP_SOCKET_URL` = (paste your backend URL from step 8 above)
5. Add Rewrite Rule:
   - **Source**: `/*`
   - **Destination**: `/index.html`
6. Click **"Create Static Site"**
7. Wait for deployment (3-5 minutes)
8. Copy the frontend URL (e.g., `https://auction-game-frontend.onrender.com`)

#### 3. Configure Environment Variables

**Important**: After both services are deployed:

1. Go to your **Backend** service on Render
2. Click **"Environment"** in the left sidebar
3. Add/Update the `FRONTEND_URL` variable:
   - Set it to your frontend URL (e.g., `https://auction-game-frontend.onrender.com`)
4. Click **"Save Changes"** (this will trigger a redeploy)

#### 4. Test Your Deployment

1. Open your frontend URL in a browser
2. Create a room as an auctioneer
3. Open the same URL in another browser/incognito window
4. Join the room with the Room ID
5. Start the auction!

### 🎮 Share With Friends

Once deployed, just share your frontend URL with friends:

```
https://your-app-name.onrender.com
```

They can join rooms using the Room ID!

---

## Alternative Deployment Options

### Deploy to Vercel + Render

**Frontend on Vercel:**

1. Install Vercel CLI: `npm install -g vercel`
2. Go to frontend folder: `cd frontend`
3. Run: `vercel`
4. Follow prompts
5. Set environment variable: `REACT_APP_SOCKET_URL=your-backend-url`

**Backend on Render:** Follow backend steps above

### Deploy to Netlify + Railway

**Frontend on Netlify:**

1. Go to https://netlify.com
2. Drag and drop your `frontend/build` folder (after running `npm run build`)
3. Set environment variable: `REACT_APP_SOCKET_URL=your-backend-url`

**Backend on Railway:**

1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Select backend folder
4. Set start command: `node server.js`

---

## Troubleshooting

### Frontend can't connect to backend

- Check that `REACT_APP_SOCKET_URL` in frontend points to your backend URL
- Make sure backend's `FRONTEND_URL` environment variable is set to your frontend URL
- Check browser console for CORS errors

### Room not found errors

- Restart both services
- Clear browser cache
- Make sure backend is running (check health endpoint: `backend-url/health`)

### Free tier limitations (Render)

- Services may sleep after 15 minutes of inactivity
- First request after sleep will be slow (30-60 seconds)
- Upgrade to paid tier for always-on service

---

## Important Notes

⚠️ **Free Tier Considerations:**

- Render free tier services sleep after 15 minutes of inactivity
- First load will be slower (spinup time)
- Consider upgrading for always-on availability

🔒 **Security:**

- Room IDs are randomly generated
- No authentication - anyone with room ID can join
- Don't use for sensitive data

📱 **Mobile:**

- Works on mobile browsers
- Share the link via WhatsApp, Telegram, etc.

---

## Need Help?

If you encounter issues:

1. Check Render logs (Dashboard → Your Service → Logs)
2. Verify all environment variables are set correctly
3. Make sure you pushed latest code to GitHub
4. Check that both services are "Live" on Render

Enjoy your IPL Auction with friends! 🏏🎉
