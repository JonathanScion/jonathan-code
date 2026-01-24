# Deploying SatelliteImages to Hostinger

This guide covers deploying the SatelliteImages platform to Hostinger Business Web Hosting with Node.js support.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    jonathanscode.io                      │
├─────────────────────────────────────────────────────────┤
│  Frontend (React)     │  Backend (Express API)          │
│  /                    │  /api/*                         │
│  Static files from    │  Node.js app                    │
│  frontend/dist        │  backend/dist/server.js         │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │    NeonDB       │
                    │  (PostgreSQL)   │
                    │  Already hosted │
                    └─────────────────┘
```

## Prerequisites

- Hostinger Business Web Hosting (with Node.js support)
- Domain: jonathanscode.io (or your domain)
- NeonDB database already configured (you have this)

---

## Step 1: Prepare the Code Locally

### 1.1 Update Frontend API URL

Edit `frontend/.env`:

```env
VITE_API_URL=https://jonathanscode.io/api
VITE_CESIUM_ION_TOKEN=your-cesium-ion-token
```

### 1.2 Build Both Projects

```bash
# From the project root
npm run build:shared
npm run build:backend
npm run build:frontend
```

### 1.3 Modify Backend to Serve Frontend (Recommended)

Add this to `backend/src/server.ts` before the `app.listen()` call to serve the frontend from the same Node.js app:

```typescript
// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));

  // Catch-all route for SPA - must be after API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/files')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    }
  });
}
```

Then rebuild the backend:
```bash
npm run build:backend
```

---

## Step 2: Create Node.js App in Hostinger hPanel

1. Log in to **hPanel** at hpanel.hostinger.com
2. Go to **Websites** → **Manage** for jonathanscode.io
3. Find **Node.js** under "Advanced" or "Web Apps"
4. Click **Create a new application**

### Configuration:

| Field | Value |
|-------|-------|
| **Node.js version** | 18.x or 20.x (LTS recommended) |
| **Application root** | `satellite-app` (or your preferred folder name) |
| **Application URL** | `jonathanscode.io` (root domain) |
| **Start file** | `backend/dist/server.js` |

5. Click **Create**

---

## Step 3: Upload Your Code

### Option A: Via File Manager

1. In hPanel, go to **Files** → **File Manager**
2. Navigate to `public_html/satellite-app/` (or your app root)
3. Upload these folders/files:
   ```
   backend/           (entire folder)
   frontend/dist/     (built frontend)
   shared/            (shared types)
   package.json       (root package.json)
   ```

### Option B: Via FTP/SFTP

1. Get FTP credentials from hPanel → **Files** → **FTP Accounts**
2. Connect using FileZilla or similar
3. Upload to your application root folder

### Folder Structure on Server:

```
satellite-app/
├── backend/
│   ├── dist/
│   │   └── server.js      ← Start file
│   ├── package.json
│   └── node_modules/      (created after npm install)
├── frontend/
│   └── dist/              ← Built frontend files
├── shared/
│   └── dist/
├── package.json
└── uploads/               ← Created automatically for file storage
```

---

## Step 4: Configure Environment Variables

In hPanel Node.js app settings, add these environment variables:

### Required Variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Enables production mode |
| `PORT` | (leave empty or set by Hostinger) | Hostinger sets this automatically |
| `DATABASE_URL` | `postgresql://neondb_owner:npg_xxx@ep-xxx.neon.tech/neondb?sslmode=require` | Your NeonDB connection string |
| `STORAGE_DIR` | `./uploads` | Where uploaded images are stored |

### Optional API Keys (for full functionality):

| Variable | Value | Description |
|----------|-------|-------------|
| `NASA_FIRMS_API_KEY` | Your FIRMS key | Fire detection data |
| `N2YO_API_KEY` | Your N2YO key | Satellite pass predictions |
| `ANTHROPIC_API_KEY` | Your Anthropic key | AI image analysis |

### How to Set in hPanel:

1. Go to **Websites** → **Manage** → **Node.js**
2. Click on your application
3. Find **Environment Variables** or **Configuration**
4. Add each variable

---

## Step 5: Install Dependencies and Start

### 5.1 Install Dependencies

In hPanel Node.js section:

1. Click **NPM Install** or **Run NPM Install** button
2. Wait for dependencies to install

Or via SSH (if available):
```bash
cd ~/public_html/satellite-app/backend
npm install --production
```

### 5.2 Start the Application

1. In hPanel Node.js section, click **Start** or **Restart**
2. Check the application status shows "Running"

### 5.3 Initialize the Database (First Time Only)

The database tables are created automatically on first startup. If you need to manually initialize:

Via SSH:
```bash
cd ~/public_html/satellite-app
node -e "require('./backend/dist/lib/database').initializeDatabase()"
```

---

## Step 6: Configure Domain Routing (if needed)

If you want the API on a subdomain like `api.jonathanscode.io`:

1. Go to **Domains** → **Subdomains**
2. Create subdomain `api`
3. Point it to your Node.js app
4. Update `frontend/.env` to use `https://api.jonathanscode.io/api`
5. Rebuild and re-upload frontend

---

## Step 7: Verify Deployment

### Test the API:
```
https://jonathanscode.io/api/health
```
Should return: `{ "status": "ok" }`

### Test the Frontend:
```
https://jonathanscode.io
```
Should load the SatelliteImages React application.

### Test Database Connection:
```
https://jonathanscode.io/api/images
```
Should return: `{ "data": { "images": [], "total": 0, ... } }`

---

## Troubleshooting

### App won't start
- Check the **Logs** in hPanel Node.js section
- Verify all environment variables are set
- Ensure `DATABASE_URL` is correct

### Database connection fails
- Verify NeonDB is active (check NeonDB dashboard)
- Confirm connection string includes `?sslmode=require`
- Check if NeonDB allows connections from Hostinger IPs

### Frontend shows blank page
- Check browser console for errors
- Verify `VITE_API_URL` was set correctly before build
- Ensure frontend/dist was uploaded

### File uploads fail
- Check `STORAGE_DIR` is writable
- Verify disk space quota in Hostinger

### CORS errors
- The backend already has CORS enabled
- If issues persist, check if the domain matches

---

## Maintenance

### Updating the Application

1. Make changes locally
2. Run `npm run build`
3. Upload changed files (usually `backend/dist` and/or `frontend/dist`)
4. Click **Restart** in hPanel

### Viewing Logs

- In hPanel → Node.js → your app → **Logs** or **Error Logs**

### Database Backups

NeonDB handles backups automatically. You can also:
- Export via NeonDB dashboard
- Use `pg_dump` if SSH access is available

---

## Security Checklist

- [ ] Remove API keys from any committed files
- [ ] Ensure `.env` files are in `.gitignore`
- [ ] Use HTTPS (Hostinger provides free SSL)
- [ ] Set `NODE_ENV=production`
- [ ] Consider rate limiting for production

---

## Quick Reference

| Component | Location |
|-----------|----------|
| Frontend URL | https://jonathanscode.io |
| API URL | https://jonathanscode.io/api |
| Database | NeonDB (external) |
| File Storage | ./uploads on Hostinger |
| Start File | backend/dist/server.js |
| Node Version | 18.x or 20.x |

---

## Need Help?

- Hostinger Support: support.hostinger.com
- NeonDB Docs: neon.tech/docs
- Node.js on Hostinger: support.hostinger.com/en/articles/6817577
