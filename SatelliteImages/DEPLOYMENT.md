# Deploying SatelliteImages API to Hostinger

This guide covers deploying the Node.js backend API to Hostinger.

**API Domain**: `satelliteimages-api.jonathanscode.io`

---

## Critical Lessons Learned

### 1. Hostinger uses CommonJS to load your app

Hostinger's Node.js launcher (`/usr/local/lsws/fcgi-bin/lsnode.js`) uses `require()`:
```javascript
var app = require(startupFile);  // CommonJS only!
```

- **DO NOT** put `"type": "module"` in package.json
- **DO NOT** use `import` statements in server.js
- **DO** use `require()` in server.js
- **DO** use dynamic `import()` to load ES Module bundles from CommonJS

### 2. ES Modules don't have `__dirname`

ES Modules don't have `__dirname` or `__filename`. A polyfill is needed:
```javascript
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

**Problem**: TypeScript may strip this polyfill during compilation.

**Solution**: Inject via esbuild `--banner` flag (see build script below).

### 3. geotiff requires ES Modules

The `geotiff` v2.x package depends on `quick-lru` which is ESM-only. You CANNOT `require()` it.

**Solution**: Bundle backend as ES Module (`.mjs`) and load via dynamic `import()` from CommonJS wrapper.

### 4. Hostinger has no runtime console logs

Hostinger does not show `console.log` output. For debugging:
- Check `stderr.log` in File Manager for startup crashes
- Use file-based logging (write to `logs/app.log`)
- The fallback server returns error details as JSON

### 5. Environment variables via .env

Include `.env` file in the zip at root level. Load with `dotenv` package.

### 6. Cross-domain file serving (PUBLIC_API_URL)

When frontend and API are on different domains (e.g., `satelliteimages.jonathanscode.io` vs
`satelliteimages-api.jonathanscode.io`), download URLs must be absolute, not relative.

The backend's `getDownloadUrl()` returns `/files/images/{uuid}/{file}` by default. The frontend
renders `<img src="/files/...">` which resolves against the frontend domain - but files are on the
API server.

**Solution**: Set `PUBLIC_API_URL` in the API's `.env`:
```
PUBLIC_API_URL=https://satelliteimages-api.jonathanscode.io
```
This makes `getDownloadUrl()` return `https://satelliteimages-api.jonathanscode.io/files/...`.

---

## Zip Structure

```
hostinger-backend.zip/
+-- server.js           <- CommonJS entry point (Hostinger loads this via require)
+-- server.bundle.mjs   <- ES Module bundle (loaded via dynamic import)
+-- package.json        <- NO "type": "module"
+-- .env                <- Environment variables at root
+-- logs/               <- For file-based debug logging
+-- uploads/            <- For file uploads
```

---

## Step-by-Step Deployment

### Step 1: Build the Backend

```bash
cd backend && npm run build
```

Build script in `backend/package.json`:
```
tsc && tsc-alias && esbuild dist/server.js --bundle --platform=node --format=esm
  --outfile=dist/server.bundle.js --packages=external
  --banner:js="import { fileURLToPath } from 'url'; import { dirname } from 'path';
  const __filename = fileURLToPath(import.meta.url); const __dirname = dirname(__filename);"
```

Key flags:
- `--format=esm` - Output as ES Module
- `--packages=external` - Keep node_modules external (avoids "Dynamic require of fs" error)
- `--banner:js=...` - Injects __dirname polyfill at top of bundle

### Step 2: Copy bundle and create zip

```bash
# Copy bundle as .mjs (tells Node it's ES Module)
cp backend/dist/server.bundle.js hostinger-deploy/server.bundle.mjs

# Create zip (PowerShell on Windows)
powershell Compress-Archive -Path hostinger-deploy/server.js, hostinger-deploy/server.bundle.mjs, hostinger-deploy/package.json, hostinger-deploy/.env, hostinger-deploy/logs, hostinger-deploy/uploads -DestinationPath hostinger-backend.zip -Force
```

### Step 3: Upload to Hostinger

1. Go to Hostinger > Websites > your-domain > Advanced > Node.js
2. Upload `hostinger-backend.zip`
3. Settings:
   - **Framework**: Express
   - **Node version**: 18.x
   - **Entry point**: server.js
   - **Start command**: npm start

### Step 4: Check for errors

If you get 503:
1. Check `stderr.log` via File Manager for startup crashes
2. Check `logs/app.log` for runtime errors
3. Visit the URL directly - fallback server returns error JSON

---

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `ERR_REQUIRE_ESM` | `"type": "module"` in package.json | Remove it; server.js must be CommonJS |
| `__dirname is not defined` | ES Modules lack `__dirname` | Add polyfill via esbuild `--banner` |
| `Dynamic require of "fs"` | esbuild bundled Node builtins | Use `--packages=external` flag |
| `require() of quick-lru` | geotiff needs ESM | Bundle as `.mjs`, load via `import()` |
| 503 with no info | Server crashed silently | Check `stderr.log` in File Manager |
| Image preview 404 | `getDownloadUrl` returns relative path | Set `PUBLIC_API_URL` in `.env` |

---

## File Locations

| File | Purpose |
|------|---------|
| `hostinger-deploy/server.js` | CommonJS entry point |
| `hostinger-deploy/server.bundle.mjs` | Bundled ES Module backend |
| `hostinger-deploy/package.json` | Dependencies (no "type": "module") |
| `hostinger-deploy/.env` | Environment variables |
| `hostinger-backend.zip` | Upload this to Hostinger |
| `backend/package.json` | Build script with esbuild + banner |
