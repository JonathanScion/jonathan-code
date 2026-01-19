# Satellite Intelligence Platform - Demo Guide

A comprehensive walkthrough of all features for demonstration purposes.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Home Page](#1-home-page)
3. [Image Upload](#2-image-upload)
4. [Image Gallery](#3-image-gallery)
5. [Image Detail & Analysis](#4-image-detail--analysis)
6. [NASA Layers & Overlays](#5-nasa-layers--overlays)
7. [AI-Powered Analysis](#6-ai-powered-analysis)
8. [Multi-Sensor Fusion Timeline](#7-multi-sensor-fusion-timeline)
9. [Global Disaster Dashboard](#8-global-disaster-dashboard)
10. [Collections](#9-collections)
11. [Image Comparison](#10-image-comparison)
12. [Scheduling](#11-scheduling)
13. [Analytics Dashboard](#12-analytics-dashboard)

---

## Quick Start

### Prerequisites
```bash
cd SatelliteImages
npm install

# Ensure backend/.env has these keys:
# ANTHROPIC_API_KEY=sk-ant-...  (for AI analysis)
# NASA_FIRMS_API_KEY=...        (for fire data)
# N2YO_API_KEY=...              (for satellite passes)

# Start both frontend and backend together:
npm run dev
```

### Access
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api

---

## 1. Home Page

**Route:** `/`

### What to Show
- Welcome hero section with platform overview
- Quick stats showing total images, coverage area
- Recent uploads carousel
- Quick action buttons (Upload, Browse Gallery, View Analytics)

### Demo Script
> "Welcome to the Satellite Intelligence Platform. This is your central hub for managing and analyzing satellite imagery. You can see at a glance your total imagery collection, coverage statistics, and quick access to all major features."

---

## 2. Image Upload

**Route:** `/upload`

### What to Show
1. **Drag & Drop Zone** - Supports TIFF, GeoTIFF, and common image formats
2. **Metadata Extraction** - Automatic extraction of:
   - Geographic coordinates from GeoTIFF
   - Image dimensions and bands
   - Capture date (if embedded)
3. **Upload Progress** - Real-time progress indicator
4. **Auto-Enrichment** - After upload, automatic enrichment with NASA data

### Demo Script
> "Upload any satellite image by dragging it here or clicking to browse. The system automatically extracts geographic metadata from GeoTIFF files. Watch as it uploads and then automatically enriches the image with NASA data - fire risk assessment, weather conditions, and satellite coverage information."

### Technical Details
- Supports: TIFF, GeoTIFF, PNG, JPEG
- Max size: Configurable (default unlimited for local storage)
- Auto-generates preview thumbnails
- Extracts projection and coordinate reference system

---

## 3. Image Gallery

**Route:** `/gallery`

### What to Show
1. **Grid View** - Thumbnail gallery of all images
2. **Search Bar** - Full-text search across titles, descriptions, tags
3. **Filters:**
   - Date range picker
   - Cloud coverage slider (0-100%)
   - Satellite/sensor dropdown
   - Tags multi-select
4. **Sorting** - By date, name, cloud coverage
5. **Pagination** - Load more / infinite scroll

### Demo Script
> "The gallery provides a comprehensive view of your imagery collection. You can search by any keyword, filter by date range, cloud coverage percentage, or specific satellites. Each thumbnail shows key metadata at a glance."

### Filters Available
| Filter | Type | Description |
|--------|------|-------------|
| Query | Text | Search titles, descriptions, tags |
| Date From/To | Date | Filter by capture date range |
| Cloud Coverage | Slider | Maximum cloud coverage percentage |
| Satellite | Dropdown | Filter by satellite source |
| Tags | Multi-select | Filter by assigned tags |

---

## 4. Image Detail & Analysis

**Route:** `/image/:id`

### What to Show
1. **Image Viewer** - Full resolution TIFF/GeoTIFF viewer with:
   - Pan and zoom controls
   - Download button
2. **Metadata Panel:**
   - Capture date and upload date
   - Geographic coordinates (lat/lon)
   - Satellite and sensor information
   - Cloud coverage percentage
   - File size and dimensions
   - Resolution (m/pixel)
   - Number of bands and bit depth
3. **Tags** - Editable tag list
4. **Edit Modal** - Update title, description, tags
5. **Quick Actions:**
   - Add to Collection
   - Compare with Another Image
   - Share

### Demo Script
> "Clicking on any image opens the detailed view. Here you see the full-resolution image with all metadata. The sidebar shows technical specifications - this image was captured by [satellite name] on [date], covers coordinates [lat/lon], with [X]% cloud coverage."

---

## 5. NASA Layers & Overlays

**Location:** Image Detail Page → Right Sidebar → "NASA Layers" Panel

### What to Show

#### 5.1 Projection Mode Toggle
- **Street Map Mode** - OpenStreetMap base, Web Mercator (EPSG:3857)
- **NASA Mode** - Blue Marble base, Geographic (EPSG:4326)
  - Enables ALL NASA layers including fire detection

#### 5.2 Available Overlay Layers

| Layer | Category | Available In |
|-------|----------|--------------|
| MODIS Terra True Color | True Color | Both modes |
| MODIS Aqua True Color | True Color | Both modes |
| VIIRS NOAA-20 True Color | True Color | Both modes |
| VIIRS SNPP True Color | True Color | Both modes |
| NDVI Vegetation | Vegetation | Both modes |
| Surface Temperature | Thermal | Both modes |
| MODIS Terra Fire Detection | Thermal | NASA Mode only |
| MODIS Aqua Fire Detection | Thermal | NASA Mode only |
| VIIRS NOAA-20 Fire Detection | Thermal | NASA Mode only |
| VIIRS SNPP Fire Detection | Thermal | NASA Mode only |
| Aerosol Optical Depth | Atmosphere | NASA Mode only |
| Cloud Top Temperature | Atmosphere | NASA Mode only |

#### 5.3 Date Selector
- Change date to view historical imagery
- Syncs with NASA Timeline component

#### 5.4 NASA Coverage Search
- Shows available NASA imagery for the location
- Links to NASA Worldview for full access

#### 5.5 Auto-Enrichment Data
- **Fire Risk Level** - None/Low/Moderate/High/Extreme
- **Nearby Fires** - Count and distance to nearest
- **NDVI Availability** - Vegetation index layer status
- **NASA Coverage** - Number of available scenes

#### 5.6 Weather Data (NASA POWER)
- Temperature (current and range)
- Humidity percentage
- Precipitation (mm)
- Wind speed (m/s)

#### 5.7 Satellite Schedule (N2YO)
- Upcoming satellite passes over the location
- Pass time, max elevation, duration

### Demo Script
> "The NASA Layers panel is where the real intelligence begins. Switch to NASA Mode to unlock all available layers including fire detection. Let me enable the VIIRS Fire Detection layer... you can see active fire hotspots overlaid on the map. The date picker lets you view historical data - let's go back to [date] to see how conditions changed."

> "Below, the Auto-Enrichment shows this location has a [LEVEL] fire risk with [X] fires detected within 50km. Weather data from NASA POWER shows current conditions, and we can see the next satellite pass will be [satellite] in [time]."

---

## 6. AI-Powered Analysis

**Location:** Image Detail Page → Right Sidebar → "AI Analysis" Panel

### What to Show

#### 6.1 Analysis Types
1. **General Analysis**
   - Overall image assessment
   - Feature identification
   - Pattern recognition

2. **Disaster Detection**
   - Fire/burn scar detection
   - Flood/water damage
   - Storm damage
   - Drought conditions
   - Returns: disaster type, severity, urgency, affected area

3. **Land Use Classification**
   - Urban/Built-up
   - Agricultural
   - Forest
   - Water bodies
   - Barren land
   - Wetlands
   - Returns: percentage breakdown with confidence scores

#### 6.2 Results Display
- **Summary** - Brief overview of findings
- **Confidence Score** - Overall analysis confidence (0-100%)
- **Findings** - Detailed list with:
  - Category
  - Description
  - Individual confidence score
  - Severity level (if applicable)
  - Location within image
- **Recommendations** - Actionable next steps

### Demo Script
> "Now let's use AI to analyze this image. I'll select 'Disaster Detection' and click Analyze. The system is sending this image to Claude for analysis..."

> "The results show [summary]. Confidence is [X]%. The AI detected [findings] and recommends [recommendations]. This analysis is stored with the image for future reference."

### Technical Notes
- Powered by Claude (Anthropic)
- Requires `ANTHROPIC_API_KEY` in backend
- Results cached in database
- Supports JPEG, PNG, WebP, GIF input (TIFF converted automatically)

---

## 7. Multi-Sensor Fusion Timeline

**Location:** Image Detail Page → Right Sidebar → "Multi-Sensor Timeline" Panel

### What to Show

#### 7.1 Timeline Visualization
- Chronological events from multiple data sources
- Color-coded by source type
- Severity indicators for significant events

#### 7.2 Data Sources (Toggleable)
| Source | Icon | Data |
|--------|------|------|
| Satellite | 🛰️ | NASA CMR imagery captures |
| Weather | ☁️ | Significant weather events |
| Fire | 🔥 | FIRMS fire detections |
| Pass | 🚀 | Satellite pass predictions |
| Earthquake | ⛰️ | USGS seismic events |

#### 7.3 Intelligence Report Generation
Click "Generate Intelligence Report" to create comprehensive analysis:

**Report Sections:**
1. **Summary** - Overview of location and time period
2. **Risk Level** - LOW / MODERATE / HIGH / CRITICAL
3. **Satellite Coverage** - Available imagery summary
4. **Fire Activity** - Detection count and confidence
5. **Seismic Activity** - Earthquake summary
6. **Weather Alerts** - Significant weather events
7. **Next Satellite Pass** - Upcoming coverage opportunity
8. **Recommendations** - Actionable intelligence items

### Demo Script
> "The Multi-Sensor Fusion Timeline combines data from five different sources into a unified view. Watch as I toggle different sources on and off. The timeline shows satellite captures, weather events, fire detections, upcoming passes, and seismic activity all in chronological order."

> "Now let me generate an Intelligence Report. This synthesizes all available data into an actionable briefing... The report shows a [RISK LEVEL] risk level, with [key findings]. The recommendations section suggests [actions]."

---

## 8. Global Disaster Dashboard

**Route:** `/disasters`

### What to Show

#### 8.1 Statistics Cards
| Metric | Source | Update Frequency |
|--------|--------|------------------|
| Earthquakes | USGS | Real-time |
| Active Fires | NASA FIRMS | ~3 hours |
| Floods | GDACS | ~1 hour |
| Cyclones | GDACS | ~1 hour |
| Volcanoes | GDACS | ~1 hour |

#### 8.2 Alert Level Indicators
- **Red Alerts** - Critical events requiring immediate attention
- **Orange Alerts** - Significant events to monitor

#### 8.3 Interactive World Map
- Circle markers for each hazard
- Color-coded by hazard type:
  - Purple: Earthquakes
  - Red: Fires
  - Blue: Floods
  - Pink: Cyclones
  - Orange: Volcanoes
- Size indicates severity
- Click for popup with details

#### 8.4 Hazard Filters
- Filter by type (All, Earthquake, Fire, Flood, Cyclone, Volcano)
- Adjust magnitude threshold for earthquakes

#### 8.5 Significant Events Panel
- List of high-severity recent events
- Click to zoom map to location
- Links to external sources (USGS, GDACS)

#### 8.6 Selected Event Details
- Full event information
- Coordinates
- Magnitude/severity
- Timestamp
- External links

### Demo Script
> "The Global Disaster Dashboard provides real-time situational awareness. We're currently tracking [X] earthquakes, [Y] active fires, [Z] floods worldwide. The red and orange alert indicators show [N] events requiring attention."

> "On the map, each dot represents a hazard - purple for earthquakes, red for fires, blue for floods. Let me click on this earthquake in [location]... it was a magnitude [M] event at [time]. The link takes us directly to USGS for more details."

> "I can filter to show only fires... now you see the current global fire situation. This data comes from NASA FIRMS and updates every few hours."

### Data Sources
| Source | API | Data Provided |
|--------|-----|---------------|
| USGS | earthquake.usgs.gov | Real-time earthquakes |
| NASA FIRMS | firms.modaps.eosdis.nasa.gov | Active fire hotspots |
| GDACS | gdacs.org | Floods, cyclones, volcanoes |

---

## 9. Collections

**Route:** `/collections` and `/collection/:id`

### What to Show

#### 9.1 Collections List
- All user collections with thumbnails
- Image count per collection
- Creation date
- Public/private indicator

#### 9.2 Create Collection
- Name and description
- Select images to include
- Set visibility (public/private)

#### 9.3 Collection Detail
- Grid view of collection images
- Add/remove images
- Edit collection metadata
- Bulk operations

### Demo Script
> "Collections help organize your imagery by project, region, or any criteria. Let me create a new collection called 'California Fires 2024'... I'll add these relevant images. Collections can be shared with team members or kept private."

---

## 10. Image Comparison

**Route:** `/compare`

### What to Show

#### 10.1 Side-by-Side View
- Two images displayed simultaneously
- Synchronized pan and zoom
- Swipe slider for overlay comparison

#### 10.2 Image Selection
- Dropdown to select images
- Filter by date, location, satellite

#### 10.3 AI Change Detection
- Compare two images using AI
- Highlights changes between images:
  - New construction
  - Vegetation changes
  - Damage assessment
  - Infrastructure changes

### Demo Script
> "The comparison tool is essential for change detection. I'll select a before image from [date] and an after image from [date]. You can drag the slider to compare them visually. For AI-powered analysis, click 'Detect Changes' and the system will identify significant differences between the two images."

---

## 11. Scheduling

**Route:** `/scheduling`

### What to Show

#### 11.1 Imaging Requests
- Create new satellite imaging requests
- Specify target coordinates
- Set priority and deadline
- Choose preferred satellites/sensors

#### 11.2 Request Status Tracking
- Pending / Scheduled / Completed / Failed
- Estimated capture windows
- Actual capture confirmation

#### 11.3 Request Management
- Edit pending requests
- Cancel requests
- View request history

### Demo Script
> "When you need new imagery, create a tasking request here. Specify the target location, preferred time window, and any constraints like maximum cloud coverage. The system tracks your requests from submission through capture completion."

---

## 12. Analytics Dashboard

**Route:** `/analytics`

### What to Show

#### 12.1 Overview Statistics
- Total images in collection
- Total storage used
- Geographic coverage area (km²)

#### 12.2 Visualizations
- **Uploads by Month** - Bar chart showing upload trends
- **Images by Satellite** - Pie chart of satellite sources
- **Images by Tag** - Word cloud or bar chart
- **Coverage Map** - Heatmap of image locations

### Demo Script
> "The analytics dashboard gives you insights into your imagery collection. You have [X] images totaling [Y] GB, covering approximately [Z] square kilometers. The charts show your upload trends and the distribution across different satellites and categories."

---

## Feature Summary Table

| Feature | Route | Key Capabilities |
|---------|-------|------------------|
| Home | `/` | Dashboard overview, quick stats |
| Upload | `/upload` | Drag-drop, metadata extraction, auto-enrichment |
| Gallery | `/gallery` | Search, filter, sort, paginate |
| Image Detail | `/image/:id` | Full viewer, metadata, edit |
| NASA Layers | (in detail) | 12+ overlay layers, dual projection |
| AI Analysis | (in detail) | General, disaster, land use classification |
| Fusion Timeline | (in detail) | 5-source timeline, intelligence reports |
| Disasters | `/disasters` | Global hazard map, real-time alerts |
| Collections | `/collections` | Organize, share imagery |
| Compare | `/compare` | Side-by-side, AI change detection |
| Scheduling | `/scheduling` | Tasking requests, status tracking |
| Analytics | `/analytics` | Statistics, visualizations |

---

## API Keys Required

| Service | Environment Variable | Required For |
|---------|---------------------|--------------|
| Anthropic | `ANTHROPIC_API_KEY` | AI image analysis |
| NASA FIRMS | `NASA_FIRMS_API_KEY` | Fire data, auto-enrichment |
| N2YO | `N2YO_API_KEY` | Satellite pass predictions |

*Note: USGS, GDACS, NASA CMR, NASA POWER, and NASA GIBS are free and require no API keys.*

---

## Demo Tips

1. **Pre-upload sample images** - Have 5-10 satellite images ready with interesting features
2. **Choose dramatic examples** - Use images with visible fires, floods, or urban areas
3. **Pre-generate reports** - AI analysis and intel reports take a few seconds
4. **Check API keys** - Ensure all services are configured before demo
5. **Use NASA Mode** - Show fire detection layers for maximum impact
6. **Pick active disaster areas** - The disaster dashboard is most impressive when there's real activity

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| NASA layers not loading | Check date is not in future, try different layer |
| AI analysis failing | Verify ANTHROPIC_API_KEY is set |
| No fire data | Verify NASA_FIRMS_API_KEY is set |
| Map blank in NASA mode | Allow a moment for Blue Marble tiles to load |
| Disaster data empty | GDACS may be temporarily unavailable, USGS should always work |

---

*Last updated: January 2025*
