# Lambda Deployment Troubleshooting Guide

This document covers recurring CORS and Lambda deployment issues that have been encountered multiple times.

## Symptoms

When Lambda functions fail, you'll see these symptoms:

1. **Browser Console Errors:**
   ```
   Access to XMLHttpRequest at 'https://[...].execute-api.us-east-1.amazonaws.com/demo/requests?'
   from origin 'http://[...].s3-website-us-east-1.amazonaws.com' has been blocked by CORS policy:
   No 'Access-Control-Allow-Origin' header is present on the requested resource.
   ```

2. **HTTP Status Codes:**
   - `502 Bad Gateway` - Lambda function crashed
   - `500 Internal Server Error` - Lambda function error

3. **API Gateway Behavior:**
   - Even though CORS headers are defined in `backend/src/lib/response.ts`, they don't appear in the response
   - This is because **Lambda never executes successfully to return those headers**

## Root Causes

There are THREE distinct problems that all cause the same CORS error symptoms:

### Problem 1: Wrong Handler Paths

**Issue:** Lambda functions point to non-existent handler paths after deployment.

**How It Happens:**
- TypeScript compiles to `dist/backend/src/handlers/` and `dist/shared/src/`
- The deployment package structure is:
  ```
  lambda-deployment.zip
  ├── backend/
  │   └── src/
  │       └── handlers/
  │           ├── requests.js
  │           ├── images.js
  │           └── ...
  ├── shared/
  │   └── src/
  │       └── types.js
  └── node_modules/
  ```
- But Lambda configuration might point to:
  - `dist/handlers/requests.listRequests` ❌
  - `dist/backend/src/handlers/requests.listRequests` ❌
  - `backend/src/handlers/requests.js` ❌ (missing function name)

**Correct Handler Format:**
```
backend/src/handlers/requests.listRequests
backend/src/handlers/requests.createRequest
backend/src/handlers/images.searchImages
```

**How to Check:**
```bash
# List all Lambda functions and their handlers
for func in satellite-platform-*-demo; do
  echo "=== $func ==="
  aws lambda get-function-configuration --function-name $func --query 'Handler' --output text
done
```

**How to Fix:**
```bash
aws lambda update-function-configuration \
  --function-name satellite-platform-list-requests-demo \
  --handler backend/src/handlers/requests.listRequests
```

### Problem 2: Missing node_modules

**Issue:** Deployment package doesn't include dependencies, causing `Cannot find module` errors.

**How It Happens:**
- The project uses npm workspaces
- `backend/node_modules` only contains workspace links (28KB), not actual packages
- Running `cp -r node_modules dist-package/` copies the tiny workspace folder, not the real dependencies

**How to Check:**
```bash
# Check Lambda package size - should be ~28MB, not 21KB
aws lambda get-function-configuration \
  --function-name satellite-platform-list-requests-demo \
  --query 'CodeSize' --output text

# Check CloudWatch logs for "Cannot find module" errors
aws logs tail /aws/lambda/satellite-platform-list-requests-demo --since 5m --format short
```

**Symptoms in Logs:**
```
Error: Cannot find module 'uuid'
Error: Cannot find module '@aws-sdk/client-dynamodb'
```

**How to Fix:**

Option A - Copy from a working Lambda:
```bash
cd backend

# Download a working Lambda function
aws lambda get-function --function-name satellite-platform-upload-demo \
  --query 'Code.Location' --output text | xargs curl -o working-lambda.zip

# Extract it
powershell -Command "Expand-Archive -Path working-lambda.zip -DestinationPath working-lambda -Force"

# Copy its node_modules
powershell -Command "Copy-Item -Path 'working-lambda\node_modules' -Destination 'dist-package\node_modules' -Recurse -Force"
```

Option B - Install production dependencies:
```bash
cd backend
npm install --omit=dev
# Then copy node_modules to dist-package
```

### Problem 3: Unresolved TypeScript Path Aliases

**Issue:** Compiled JavaScript still contains TypeScript path aliases like `@shared/types` instead of relative paths.

**How It Happens:**
- TypeScript compiles `.ts` to `.js` but doesn't resolve path aliases by default
- `tsc-alias` package is needed to convert:
  - `require("@shared/types")` → `require("../../../shared/src/types")`
- If `tsc-alias` doesn't run, Lambda can't find the modules

**How to Check:**
```bash
# Check compiled JavaScript for unresolved aliases
grep "@shared" backend/dist/backend/src/handlers/requests.js
# Should return nothing if aliases are resolved
```

**Symptoms in Logs:**
```
Error: Cannot find module '@shared/types'
Require stack:
- /var/task/backend/src/handlers/requests.js
```

**How to Fix:**
```bash
cd backend

# Install dependencies (includes tsc-alias)
npm install

# Build with alias resolution
npm run build  # Runs: tsc && tsc-alias

# Verify aliases are resolved
grep "@shared" dist/backend/src/handlers/requests.js
# Should return nothing
```

## Complete Deployment Process

Follow these steps EVERY TIME you deploy Lambda functions:

### 1. Build Shared Types
```bash
cd shared
npm run build
cd ..
```

### 2. Build Backend with Alias Resolution
```bash
cd backend

# Install dependencies if needed
npm install

# Build TypeScript with path alias resolution
npm run build  # This runs: tsc && tsc-alias

# Verify no unresolved aliases
grep -r "@shared" dist/backend/src/handlers/
# Should return nothing

cd ..
```

### 3. Package Lambda Deployment

```bash
cd backend

# Clean previous build
rm -rf dist-package lambda-deployment.zip

# Create package directory
mkdir dist-package

# Copy compiled code (already includes backend/ and shared/)
cp -r dist/backend dist-package/
cp -r dist/shared dist-package/

# Copy node_modules (use one of these methods):

# Method A: From working Lambda
aws lambda get-function --function-name satellite-platform-create-request-demo \
  --query 'Code.Location' --output text | xargs curl -o working-lambda.zip
powershell -Command "Expand-Archive -Path working-lambda.zip -DestinationPath working-lambda -Force"
powershell -Command "Copy-Item -Path 'working-lambda\node_modules' -Destination 'dist-package\node_modules' -Recurse -Force"

# Method B: Fresh install (slower, but more reliable)
npm install --omit=dev
powershell -Command "Copy-Item -Path 'node_modules' -Destination 'dist-package\node_modules' -Recurse -Force"

# Verify size (should be ~150MB before compression)
du -sh dist-package
# Expected: 150M-200M

# Create zip file
cd dist-package
powershell -Command "Compress-Archive -Path * -DestinationPath ../lambda-deployment.zip -Force"
cd ..

# Verify zip size (should be ~28MB)
ls -lh lambda-deployment.zip
# Expected: 27M-30M
```

### 4. Upload to S3
```bash
aws s3 cp backend/lambda-deployment.zip s3://satellite-platform-images-demo/lambda-deployment.zip
```

### 5. Update Lambda Functions

```bash
# Update all request-related functions
for func in satellite-platform-create-request-demo \
            satellite-platform-list-requests-demo \
            satellite-platform-get-request-demo \
            satellite-platform-update-request-demo \
            satellite-platform-delete-request-demo \
            satellite-platform-cancel-request-demo; do
  echo "Updating $func..."

  # Update code
  aws lambda update-function-code \
    --function-name $func \
    --s3-bucket satellite-platform-images-demo \
    --s3-key lambda-deployment.zip

  # Wait for code update to complete
  sleep 3

  # Update handler path (if needed)
  aws lambda update-function-configuration \
    --function-name $func \
    --handler backend/src/handlers/requests.$(echo $func | sed 's/satellite-platform-//' | sed 's/-request-demo//' | sed 's/list/listRequests/' | sed 's/create/createRequest/' | sed 's/get/getRequest/' | sed 's/update/updateRequest/' | sed 's/delete/deleteRequest/' | sed 's/cancel/cancelRequest/')
done

# Update image-related functions
for func in satellite-platform-search-images-demo \
            satellite-platform-get-image-demo \
            satellite-platform-update-image-demo \
            satellite-platform-delete-image-demo; do
  echo "Updating $func..."

  aws lambda update-function-code \
    --function-name $func \
    --s3-bucket satellite-platform-images-demo \
    --s3-key lambda-deployment.zip

  sleep 3

  # Update handler if needed
done
```

### 6. Verify Deployment

```bash
# Check all functions have correct size and handler
for func in satellite-platform-*-demo; do
  echo "=== $func ==="
  aws lambda get-function-configuration --function-name $func \
    --query '[Handler, CodeSize, LastUpdateStatus]' --output text
done

# Expected:
# - CodeSize: ~28,000,000 bytes (28MB)
# - Handler: backend/src/handlers/[module].[function]
# - LastUpdateStatus: Successful

# Check logs for errors
aws logs tail /aws/lambda/satellite-platform-list-requests-demo --since 2m --format short

# Test API endpoint
curl -s "https://w38o94xq85.execute-api.us-east-1.amazonaws.com/demo/requests?" | jq .

# Verify CORS headers
curl -v "https://w38o94xq85.execute-api.us-east-1.amazonaws.com/demo/requests?" 2>&1 | grep -i "access-control"
# Should see:
# < access-control-allow-origin: *
# < access-control-allow-methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
```

## Quick Diagnostic Script

Save this as `check-lambda-deployment.sh`:

```bash
#!/bin/bash

echo "=== Checking Lambda Deployment Status ==="

# Function to check
FUNC=${1:-satellite-platform-list-requests-demo}

echo -e "\n1. Function Configuration:"
aws lambda get-function-configuration --function-name $FUNC \
  --query '{Handler: Handler, CodeSize: CodeSize, Status: LastUpdateStatus}' \
  --output table

echo -e "\n2. Recent Logs (last 2 minutes):"
aws logs tail /aws/lambda/$FUNC --since 2m --format short | tail -20

echo -e "\n3. Testing API endpoint:"
curl -s "https://w38o94xq85.execute-api.us-east-1.amazonaws.com/demo/requests?" | jq '.success, .data | length'

echo -e "\n4. CORS Headers:"
curl -v "https://w38o94xq85.execute-api.us-east-1.amazonaws.com/demo/requests?" 2>&1 | grep -i "access-control"

echo -e "\n=== Diagnostics Complete ==="
```

Usage:
```bash
chmod +x check-lambda-deployment.sh
./check-lambda-deployment.sh satellite-platform-list-requests-demo
```

## Common Mistakes to Avoid

1. ❌ **Forgetting to run `tsc-alias`** after TypeScript compilation
   - Always use `npm run build`, not just `tsc`

2. ❌ **Copying `backend/node_modules` directly** in workspace setup
   - Use a working Lambda's node_modules or fresh install

3. ❌ **Not verifying package size** before upload
   - dist-package should be ~150MB
   - lambda-deployment.zip should be ~28MB
   - Deployed Lambda should show ~28,000,000 bytes

4. ❌ **Using wrong handler paths** in Lambda configuration
   - Correct: `backend/src/handlers/requests.listRequests`
   - Wrong: `dist/handlers/requests.listRequests`
   - Wrong: `backend/src/handlers/requests.js`

5. ❌ **Not checking CloudWatch logs** when debugging
   - Logs show the exact error (module not found, wrong handler, etc.)
   - CORS errors in browser don't tell you what's actually wrong

## Why CORS Errors are Misleading

**Important:** CORS errors in the browser are a SYMPTOM, not the ROOT CAUSE.

When you see:
```
Access to XMLHttpRequest blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present
```

This means:
1. ✅ API Gateway received the request
2. ✅ API Gateway invoked the Lambda function
3. ❌ Lambda function crashed/failed before returning headers
4. ❌ API Gateway returns Lambda's error without CORS headers
5. ❌ Browser blocks the response and shows CORS error

**The actual errors are in CloudWatch Logs:**
- "Cannot find module 'uuid'" → Missing node_modules
- "Cannot find module '@shared/types'" → Unresolved path aliases
- "Handler not found" → Wrong handler path

**Always check CloudWatch logs first!**

## Prevention

1. **Update DEPLOYMENT.md** to include all three checks
2. **Create a deployment script** that automates verification
3. **Test locally** before deploying when possible
4. **Keep a "golden" working Lambda** to copy node_modules from
5. **Run the diagnostic script** after every deployment

## Related Files

- `backend/tsconfig.json` - TypeScript path alias configuration
- `backend/package.json` - Build script with tsc-alias
- `backend/src/lib/response.ts` - CORS headers definition
- `DEPLOYMENT.md` - General deployment guide
- `LESSONS-LEARNED.md` - Other deployment lessons
