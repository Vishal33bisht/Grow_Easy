# GrowEasy Deployment Guide

Since we successfully pushed your codebase to [GitHub (Grow_Easy)](https://github.com/Vishal33bisht/Grow_Easy.git), you can set up automatic CI/CD deployments. Every time you push changes to GitHub, your sites will automatically update!

---

## 1. Deploy Frontend on Vercel (Free)

Vercel is the creator of Next.js and provides a generous, zero-config free tier.

### Step-by-Step:
1. Go to [Vercel](https://vercel.com/) and log in using your GitHub account.
2. Click the **"Add New"** button and select **"Project"**.
3. Select your repository: `Vishal33bisht/Grow_Easy` and click **"Import"**.
4. In the configuration window:
   * **Framework Preset**: Next.js
   * **Root Directory**: Click "Edit" and choose the `frontend` folder.
   * **Build & Development Settings**: Leave as default.
5. Under **Environment Variables**, add:
   * `NEXT_PUBLIC_API_URL` = `https://<your-backend-url>` (You will get this from the backend deployment below).
6. Click **"Deploy"**.

---

## 2. Deploy Backend

### Option A: Render (Free Tier Available)
Render is currently the most popular free-tier hosting provider for Node.js backends.

1. Go to [Render](https://render.com/) and sign in with GitHub.
2. Click **"New +"** and choose **"Web Service"**.
3. Select your `Grow_Easy` repository.
4. Set the following details:
   * **Name**: `grow-easy-backend`
   * **Root Directory**: `backend`
   * **Runtime**: `Node`
   * **Build Command**: `npm install && npm run build`
   * **Start Command**: `node dist/index.js`
   * **Instance Type**: Select **"Free"**.
5. Click **"Advanced"** and add your **Environment Variables**:
   * `PORT` = `10000`
   * `GEMINI_API_KEY` = `YOUR_GEMINI_API_KEY`
   * `ALLOWED_ORIGINS` = `https://<your-vercel-frontend-domain>.vercel.app` (your frontend domain on Vercel)
6. Click **"Deploy Web Service"**.

---

### Option B: Railway (Paid Tier / Credit card verification required)
*Note: Railway discontinued their free tier. To deploy on Railway, you must have an active subscription.*

1. Go to [Railway](https://railway.app/) and log in with GitHub.
2. Click **"New Project"** -> **"Deploy from GitHub repo"**.
3. Select your `Grow_Easy` repository.
4. Click **"Settings"** on the service and configure:
   * **Root Directory**: `/backend`
   * **Build Command**: `npm run build`
   * **Start Command**: `node dist/index.js`
5. Go to **"Variables"** and add:
   * `PORT` = `PORT`
   * `GEMINI_API_KEY` = `YOUR_GEMINI_API_KEY`
   * `ALLOWED_ORIGINS` = `https://<your-vercel-frontend-domain>.vercel.app`
6. Go to **"Settings"** -> **"Public Domain"** and click **"Generate Domain"** to get your backend URL.
