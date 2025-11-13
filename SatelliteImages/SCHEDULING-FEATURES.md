# Satellite Imaging Request Scheduling System

## Overview
This document outlines the features, capabilities, and limitations of the satellite imaging request scheduling system. The system is designed as a demo platform to showcase satellite tasking and scheduling capabilities.

---

## Phase 1: Request Management (IMPLEMENTED ✅)

### What It Does

#### Request Creation & Management
- **Create Imaging Requests**: Users can submit requests for satellite imaging of specific locations
  - Title and description
  - Target location with GPS coordinates (lat/lon)
  - Location name for easy reference
  - Date range for desired imaging window (start and end dates)
  - Priority levels: Low, Medium, High, Urgent
  - Technical requirements:
    - Minimum resolution (meters per pixel)
    - Maximum cloud coverage percentage
    - Preferred satellites (optional list)

#### Request Tracking
- **Status Management**: Requests progress through lifecycle states:
  - `PENDING` - Newly created, awaiting scheduling
  - `SCHEDULED` - Assigned to a satellite pass
  - `IN_PROGRESS` - Satellite is capturing imagery
  - `COMPLETED` - Imaging successful, images available
  - `FAILED` - Imaging attempt unsuccessful
  - `CANCELLED` - User cancelled the request

#### User Interface Features
- **Request List View**:
  - Display all imaging requests with visual status badges
  - Color-coded priority indicators
  - Location and date information at a glance
  - Real-time status updates

- **Filtering & Search**:
  - Filter by status (Pending, Scheduled, Completed, etc.)
  - Filter by priority level
  - Empty state when no requests exist

- **Request Actions**:
  - View detailed request information
  - Update request details (for pending requests)
  - Cancel pending requests with optional reason
  - Delete requests

#### Backend Infrastructure
- **RESTful API**: 6 Lambda functions providing full CRUD operations
  - `POST /requests` - Create new request
  - `GET /requests` - List all requests with optional filters
  - `GET /requests/{id}` - Get specific request details
  - `PATCH /requests/{id}` - Update request
  - `DELETE /requests/{id}` - Delete request
  - `POST /requests/{id}/cancel` - Cancel request

- **Data Storage**: DynamoDB table for persistent storage
- **CORS Support**: Full cross-origin support for web frontend
- **Error Handling**: Comprehensive validation and error responses

### What It Doesn't Do

#### Limitations (Phase 1)
- ❌ **No Actual Satellite Scheduling**: Requests are stored but not automatically scheduled to real satellites
- ❌ **No Orbital Calculations**: Doesn't calculate when satellites will actually pass over the requested location
- ❌ **No Conflict Detection**: Multiple requests for the same location/time aren't checked for conflicts
- ❌ **No Resource Management**: Doesn't account for satellite power, storage, or downlink capacity
- ❌ **No Weather Integration**: Doesn't consider weather forecasts or cloud coverage predictions
- ❌ **No Image Capture**: Doesn't actually trigger satellite imaging (demo only)
- ❌ **No Cost Estimation**: Doesn't calculate or track costs for imaging requests
- ❌ **No Multi-user Support**: Uses single demo user, no real authentication
- ❌ **No Notifications**: No email/SMS alerts when status changes

---

## Phase 2: Orbital Calculations (PLANNED - NOT IMPLEMENTED)

### What It Would Do

#### Satellite Pass Predictions
- **Calculate Overhead Passes**: Determine when satellites will be over requested locations
  - Use TLE (Two-Line Element) orbital data from CelesTrak/Space-Track
  - Calculate next 7-14 days of satellite passes
  - Filter by minimum elevation angle (>30° for good imaging)
  - Consider sun angle for optimal lighting

#### Visual Timeline
- **Pass Visualization**: Interactive timeline showing when satellites are available
  - Calendar view with satellite pass times
  - Elevation angle graphs
  - Sun position and lighting conditions
  - Best imaging windows highlighted

#### Automatic Scheduling Suggestions
- **Smart Recommendations**:
  - "Satellite XYZ will pass overhead on Nov 5 at 2:30 PM"
  - "Best imaging window: Nov 6, 10:15 AM - optimal sun angle"
  - Multiple satellite options ranked by quality

#### Implementation Details (Demo Version)
- Use `satellite.js` library for orbital mechanics
- Store TLE data for 3-5 demo satellites
- Calculate passes in browser (frontend) or Lambda (backend)
- Simple algorithm: find all passes >30° elevation within date range

### Complexity for Demo: **Easy to Medium**
- Estimated implementation time: 4-6 hours
- Leverages existing orbital mechanics libraries
- No need for real-time satellite tracking
- Focus on visualization and user experience

### What It Wouldn't Do (Even in Phase 2)
- ❌ **Real-time Satellite Positions**: Calculations done at request time, not continuous
- ❌ **Actual Satellite Tasking**: Doesn't communicate with real satellites
- ❌ **Cloud Prediction**: Uses requested max cloud coverage but doesn't predict actual clouds
- ❌ **Multi-satellite Coordination**: Doesn't optimize across multiple satellites
- ❌ **Downlink Window Calculations**: Doesn't calculate when data can be downloaded
- ❌ **Ground Station Scheduling**: Doesn't schedule ground station contacts

---

## Phase 3: Optimization & Automation (FUTURE)

### What It Would Do

#### Conflict Resolution
- Detect when multiple requests overlap in time/location
- Prioritize based on urgency, customer tier, or value
- Suggest alternative imaging windows

#### Resource Management
- Track satellite resources:
  - Onboard storage capacity
  - Power/battery levels
  - Fuel for maneuvering
  - Downlink bandwidth availability

#### Automated Scheduling
- Automatically assign requests to optimal satellite passes
- Balance workload across satellite constellation
- Maximize efficiency and throughput

#### Advanced Features
- Weather integration with forecast APIs
- Recurring imaging requests (daily, weekly, monthly)
- Multi-location imaging campaigns
- Cost optimization and budget tracking
- SLA (Service Level Agreement) management

### Complexity: **High**
- Estimated implementation time: Several weeks
- Requires complex optimization algorithms
- Integration with multiple external services
- Sophisticated resource management

---

## Current Architecture

### Technology Stack
- **Frontend**: React + TypeScript + Vite
- **UI Components**: Custom React components with Tailwind CSS
- **State Management**: React Query for server state
- **Backend**: AWS Lambda (Node.js 20.x)
- **Database**: DynamoDB
- **API**: AWS API Gateway (REST)
- **Storage**: S3 for frontend hosting

### API Endpoints
```
Base URL: https://w38o94xq85.execute-api.us-east-1.amazonaws.com/demo

GET    /requests           - List all requests (supports ?status=X&priority=Y)
POST   /requests           - Create new request
GET    /requests/{id}      - Get specific request
PATCH  /requests/{id}      - Update request
DELETE /requests/{id}      - Delete request
POST   /requests/{id}/cancel - Cancel request (body: { cancelReason?: string })
```

### Frontend URL
```
http://satellite-platform-frontend-demo.s3-website-us-east-1.amazonaws.com/scheduling
```

---

## Data Models

### ImagingRequest
```typescript
interface ImagingRequest {
  id: string;                          // Unique request ID
  userId: string;                      // User ID (currently demo-user)

  // Location Information
  targetLocation: GeoPoint;            // { lat: number, lon: number }
  targetBounds?: BoundingBox;          // { north, south, east, west }
  locationName?: string;               // Human-readable location name

  // Timing
  requestedStartDate: string;          // ISO 8601 datetime
  requestedEndDate: string;            // ISO 8601 datetime
  scheduledDate?: string;              // When satellite pass is scheduled
  completedDate?: string;              // When imaging was completed

  // Request Details
  title: string;                       // Request title
  description?: string;                // Detailed description
  priority: RequestPriority;           // LOW | MEDIUM | HIGH | URGENT
  status: RequestStatus;               // PENDING | SCHEDULED | IN_PROGRESS | COMPLETED | FAILED | CANCELLED

  // Technical Requirements
  minResolution?: number;              // Meters per pixel
  maxCloudCoverage?: number;           // Percentage (0-100)
  preferredSatellites?: string[];      // Array of satellite IDs/names

  // Recurring (for Phase 3)
  isRecurring?: boolean;               // Whether this repeats
  recurrencePattern?: string;          // daily | weekly | monthly

  // Results
  capturedImageIds?: string[];         // IDs of captured images

  // Metadata
  createdAt: string;                   // ISO 8601 datetime
  updatedAt: string;                   // ISO 8601 datetime
  notes?: string;                      // Additional notes
  cancelReason?: string;               // Reason for cancellation
}
```

---

## Demo Limitations

### What This System Is
✅ A demonstration platform for satellite tasking workflows
✅ A UI/UX prototype for satellite operators and customers
✅ A proof-of-concept for request management
✅ A foundation for adding real orbital mechanics

### What This System Is Not
❌ A production satellite tasking platform
❌ Connected to real satellites
❌ Performing actual orbital calculations (yet)
❌ Managing real satellite resources
❌ Handling real-world constraints (weather, conflicts, etc.)
❌ A billing/commerce platform
❌ Multi-tenant or enterprise-ready

---

## Future Enhancements (Beyond Phase 3)

### Enterprise Features
- Multi-tenancy with organization management
- Role-based access control (RBAC)
- API keys and authentication
- Billing and invoicing
- SLA management and guarantees

### Advanced Capabilities
- AI-powered optimal window selection
- Automated quality assessment of captured images
- Integration with satellite command & control systems
- Real-time satellite health monitoring
- Advanced analytics and reporting

### Integration Options
- Weather APIs (NOAA, OpenWeather)
- Ground station networks
- Image processing pipelines
- Customer notification systems (email, SMS, webhooks)
- Third-party satellite constellations

---

## Deployment

### Current Deployment
- Backend: 6 Lambda functions deployed via deployment scripts
- Frontend: Static React app hosted on S3
- Database: DynamoDB table `satellite-platform-requests-demo`
- API: API Gateway with CORS enabled

### Deployment Scripts
- `deploy-scheduling.ps1` (PowerShell for Windows)
- `deploy-scheduling.sh` (Bash for Linux/Mac/WSL)

See `SCHEDULING-DEPLOYMENT.md` for detailed deployment instructions.

---

## Development Roadmap

### ✅ Phase 1: Request Management (COMPLETE)
- [x] Request CRUD operations
- [x] Status and priority management
- [x] UI for creating and viewing requests
- [x] Filtering and search
- [x] Backend API with Lambda
- [x] Frontend deployment

### 🔄 Phase 2: Orbital Calculations (NEXT)
- [ ] TLE data integration
- [ ] Satellite pass calculations
- [ ] Timeline visualization
- [ ] Optimal window recommendations
- [ ] Multi-satellite comparison

### 📋 Phase 3: Optimization (FUTURE)
- [ ] Conflict detection
- [ ] Resource management
- [ ] Automated scheduling
- [ ] Weather integration
- [ ] Cost optimization

---

## Testing

### How to Test Phase 1
1. Navigate to the Scheduling page
2. Click "New Request"
3. Fill in the form:
   - Title: "Test Imaging Request"
   - Location: Any coordinates (try 34.05, -118.25 for Los Angeles)
   - Date Range: Next week
   - Priority: Medium
4. Submit and verify request appears in list
5. Test filtering by status and priority
6. Test cancel functionality
7. Test update functionality

---

## Support & Documentation
- Main deployment guide: `SCHEDULING-DEPLOYMENT.md`
- Architecture decisions: `LESSONS-LEARNED.md`
- API documentation: See API Endpoints section above
- Issues: Report via project issue tracker

---

**Last Updated**: November 2025
**Version**: 1.0.0 (Phase 1)
**Status**: Phase 1 Complete, Phase 2 Planned
