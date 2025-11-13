# Scheduling Feature Deployment Guide

## Overview
This deploys Phase 1 of the Satellite Imaging Request Scheduling system, which includes:
- Request management (create, list, view, update, delete, cancel)
- Priority and status tracking
- Location-based imaging requests
- Full CRUD API with Lambda functions
- Beautiful UI with filters and forms

## Prerequisites
- AWS CLI configured with appropriate credentials
- Node.js and npm installed
- `jq` installed (for bash script only)

## Quick Start

### Option 1: PowerShell (Recommended for Windows)

```powershell
# Run from the project root directory
.\deploy-scheduling.ps1
```

### Option 2: Bash (Git Bash, WSL, Linux, Mac)

```bash
# Make script executable
chmod +x deploy-scheduling.sh

# Run from the project root directory
./deploy-scheduling.sh
```

## What Gets Deployed

### Lambda Functions (6 new functions)
- `satellite-platform-create-request-demo` - Create new imaging requests
- `satellite-platform-list-requests-demo` - List all requests with filters
- `satellite-platform-get-request-demo` - Get a specific request
- `satellite-platform-update-request-demo` - Update request details
- `satellite-platform-delete-request-demo` - Delete a request
- `satellite-platform-cancel-request-demo` - Cancel a pending request

### API Gateway Routes
- `GET /requests` - List requests (with optional status/priority filters)
- `POST /requests` - Create new request
- `GET /requests/{id}` - Get specific request
- `PATCH /requests/{id}` - Update request
- `DELETE /requests/{id}` - Delete request
- `POST /requests/{id}/cancel` - Cancel request

### Frontend
- New "Scheduling" tab in navigation
- Request submission form with:
  - Title, description, location name
  - GPS coordinates (lat/lon)
  - Date range for imaging window
  - Priority levels (Low, Medium, High, Urgent)
  - Technical requirements (cloud coverage, resolution)
- Request list view with:
  - Status badges and icons
  - Priority indicators
  - Filtering by status and priority
  - Cancel functionality for pending requests
- Empty state when no requests exist

### DynamoDB Table
- `satellite-platform-requests-demo` (already created)

## After Deployment

### Access Your Scheduling System
**Frontend URL:**
```
http://satellite-platform-frontend-demo.s3-website-us-east-1.amazonaws.com/scheduling
```

**API Base URL:**
```
https://w38o94xq85.execute-api.us-east-1.amazonaws.com/demo
```

### Test the System

1. **Create a Request:**
   - Go to the Scheduling page
   - Click "New Request"
   - Fill in the form:
     - Title: "Test Imaging Request"
     - Location: Your coordinates
     - Date range: Next week
     - Priority: Medium
   - Click "Create Request"

2. **View Requests:**
   - All requests appear in the list
   - Use filters to narrow by status/priority

3. **Cancel a Request:**
   - Click "Cancel" on any pending request

## Deployment Time
Expected deployment time: **3-5 minutes**

## What Happens During Deployment

1. **Step 1:** Creates/updates 6 Lambda functions
2. **Step 2:** Sets up API Gateway routes and CORS
3. **Step 3:** Builds the frontend React app
4. **Step 4:** Deploys frontend to S3

## Troubleshooting

### Error: "Function already exists"
No problem - the script updates existing functions automatically.

### Error: "Resource not found"
The script creates missing API Gateway resources automatically.

### Error: "Access Denied"
Check your AWS credentials have the necessary permissions:
- Lambda: CreateFunction, UpdateFunctionCode, AddPermission
- API Gateway: CreateResource, PutMethod, PutIntegration, CreateDeployment
- S3: PutObject, DeleteObject (for frontend bucket)

### API Gateway Returns 403
Wait 30 seconds after deployment for API Gateway cache to clear, then try again.

## Next Steps (Future Phases)

### Phase 2 - Orbital Calculations
- Calculate satellite passes over requested locations
- Display timeline showing when satellites will be overhead
- Automatic scheduling based on orbital mechanics

### Phase 3 - Optimization & Automation
- Conflict detection when multiple requests overlap
- Resource allocation (storage, power, downlink windows)
- Automated scheduling optimization
- Weather integration
- Recurring imaging requests

## Files Modified

### Backend
- `backend/src/handlers/requests.ts` - Request CRUD handlers
- `backend/src/lib/dynamodb.ts` - Added REQUESTS table constant

### Shared Types
- `shared/src/types.ts` - Added ImagingRequest, RequestStatus, RequestPriority, etc.

### Frontend
- `frontend/src/pages/SchedulingPage.tsx` - Main scheduling UI
- `frontend/src/components/Header.tsx` - Added Scheduling nav item
- `frontend/src/App.tsx` - Added /scheduling route
- `frontend/src/lib/api.ts` - Added requestsApi functions

## Support
If you encounter issues, check:
1. AWS Console -> Lambda -> Functions (verify all 6 functions exist)
2. AWS Console -> API Gateway -> APIs -> w38o94xq85 (verify /requests routes)
3. AWS Console -> DynamoDB -> Tables (verify satellite-platform-requests-demo exists)
4. Browser console for any frontend errors

---

Built with Phase 1 requirements completed!
