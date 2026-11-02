# Website Audit

A production MERN web application that retrieves verified business websites using either **SerpApi (Google Maps engine)** or **Google Places API (New)**, audits each website in the background via an in-process queue (concurrency: 2), and displays an interactive results table with advanced filtering for copyright year freshness, website developer/agency attribution, and broken links / SSL issues.

---

## Deployment (Render + Vercel + MongoDB Atlas)

This monorepo is architected for zero-downtime, independent deployments:
- **Client**: Hosted on **Vercel** as a **Vite SPA** (`client/vercel.json` provides SPA routing rewrites and immutable asset caching).
- **Server**: Hosted on **Render** as a Node.js Web Service using `render.yaml` Blueprint, running on port `0.0.0.0:$PORT` with graceful shutdown and rate limit proxy trust.
- **Database**: **MongoDB Atlas** M0/Serverless cluster.

---

### Step 1: Set Up MongoDB Atlas
1. Sign in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free shared cluster (e.g. `M0 Sandbox`).
3. **Database Access**: Create a Database User with password authentication (e.g. `sitecheck_user`) and give them read/write permissions.
4. **Network Access**: Add IP Access `0.0.0.0/0` (Allow Access from Anywhere) so Render's cloud servers can connect.
5. **Connection String**: Click **Connect** -> **Drivers** (Node.js) and copy your URI:
   ```
   mongodb+srv://<username>:<password>@cluster0.mongodb.net/website-audit?retryWrites=true&w=majority
   ```
   *(Replace `<username>` and `<password>` with your database user credentials; URL-encode any special characters in the password).*

---

### Step 2: Deploy Backend to Render
1. Push your repository to GitHub / GitLab.
2. In [Render Dashboard](https://dashboard.render.com/):
   - **Option A (Blueprint)**: Click **New** -> **Blueprint**, connect your repository, and Render will automatically detect [`render.yaml`](render.yaml).
   - **Option B (Manual Web Service)**: Click **New** -> **Web Service**, connect your repository, and set:
     - **Name**: `sitecheck-api`
     - **Root Directory**: `server`
     - **Runtime**: `Node`
     - **Build Command**: `npm ci`
     - **Start Command**: `npm start`
     - **Plan**: `Free`
     - **Health Check Path**: `/api/health`
3. Configure Environment Variables on Render:
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: `mongodb+srv://<user>:<password>@cluster0.mongodb.net/website-audit?retryWrites=true&w=majority`
   - `SEARCH_PROVIDER`: `serpapi` (or `places`)
   - `SERPAPI_KEY`: `<your-serpapi-key>` (if using serpapi)
   - `GOOGLE_PLACES_API_KEY`: `<your-google-places-key>` (if using places)
   - `APP_ACCESS_KEY`: `<your-random-secret-key>` *(Optional: prevents public visitors from consuming your search API quota)*
   - `CLIENT_ORIGIN`: Leave blank or set temporarily to `http://localhost:3000` until Vercel URL is generated.
4. Deploy the service. Note down your backend URL (e.g. `https://sitecheck-api.onrender.com`).
5. Verify health: visit `https://sitecheck-api.onrender.com/api/health` in your browser. It should return:
   ```json
   { "status": "ok", "service": "website-audit-api", "db": "up", "uptime": 12 }
   ```

---

### Step 3: Deploy Frontend to Vercel
1. In [Vercel Dashboard](https://vercel.com/dashboard), click **Add New...** -> **Project**.
2. Select your repository.
3. In Project Settings:
   - **Framework Preset**: **Vite**
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. In **Environment Variables**:
   - `VITE_API_BASE`: `https://sitecheck-api.onrender.com` *(Your Render backend URL with NO trailing slash)*
5. Click **Deploy**. Note down your Vercel URL (e.g. `https://sitecheck-audit.vercel.app`).

---

### Step 4: Link CORS on Render & Redeploy
1. Return to your Render Web Service dashboard -> **Environment**.
2. Set `CLIENT_ORIGIN` to your exact Vercel URL (no trailing slash):
   ```
   CLIENT_ORIGIN=https://sitecheck-audit.vercel.app
   ```
3. Click **Save Changes** (Render will redeploy).
4. Open your Vercel app in your browser — your deployment is live, connected, and secure!

---

### Deployment Troubleshooting Guide

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **CORS Error (`CORS origin rejected`)** | Origin sent from Vercel does not match `CLIENT_ORIGIN` on Render. | Verify `CLIENT_ORIGIN` in Render Environment matches your exact Vercel URL (e.g. `https://sitecheck.vercel.app`) with `https://` protocol and **no trailing slash** `/`. |
| **401 Unauthorized (`Access key required or invalid`)** | `APP_ACCESS_KEY` is configured on Render to protect search quota, but key was omitted or wrong. | Enter the exact secret string defined in `APP_ACCESS_KEY` into the client's "Access Key Required" prompt. The key is stored in your browser session. |
| **Mongo Timeout (`serverSelectionTimeoutMS`)** | Render cannot reach MongoDB Atlas cluster. | 1. In MongoDB Atlas, go to **Network Access** and ensure `0.0.0.0/0` is added to the IP Access List.<br>2. Confirm the username/password in `MONGODB_URI` are correct. If your password has `@` or `:`, URL-encode them. |
| **Render Cold Start Delay (50–60s)** | Free tier Render instances spin down after 15 minutes of inactivity. | The first request after inactivity takes ~50s while Render spins up the container. Subsequent requests run at full speed. |

---

## Local Development & Configuration

### Environment Variables

See [`server/.env.example`](server/.env.example) and [`client/.env.example`](client/.env.example) for reference.

#### Server (`server/.env`):
```env
# Port for Express API server (Render provides this dynamically, defaults to 5000)
PORT=5000

# Application environment mode
NODE_ENV=development

# MongoDB connection URI (Atlas or local)
MONGODB_URI=mongodb://127.0.0.1:27017/website-audit

# Active Search Provider: "serpapi" or "places"
SEARCH_PROVIDER=serpapi

# SerpApi API key for Google searches (required when SEARCH_PROVIDER=serpapi)
SERPAPI_KEY=your_serpapi_key_here

# Google Places API key (required when SEARCH_PROVIDER=places)
GOOGLE_PLACES_API_KEY=

# Comma-separated allowed frontend origins for CORS (e.g. your Vercel URL)
CLIENT_ORIGIN=http://localhost:3000,http://localhost:5173

# Optional secret access key (if set, clients must pass x-access-key)
APP_ACCESS_KEY=

# Allow crawling private RFC1918 IPs (only for local tests; forced to false in production)
ALLOW_PRIVATE=false
```

#### Client (`client/.env`):
```env
# Backend API URL (leave empty in local dev to use Vite proxy)
VITE_API_BASE=
```

---

## Running the Application Locally

### 1. Install Dependencies
```powershell
npm run install:all
```

### 2. Run Tests
```powershell
npm test
```
*Passes all 39 tests with 0 failures.*

### 3. Start Development Servers
```powershell
npm run dev
```
- Client runs on **http://localhost:3000**
- Server runs on **http://localhost:5000**
- Health check available at **http://localhost:5000/api/health**
