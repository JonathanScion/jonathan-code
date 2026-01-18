# Satellite Imagery Management Platform

A satellite imagery management and cataloging system built with React, TypeScript, Express, and PostgreSQL.

## Features

- **Drag-and-drop upload** for TIFF/GeoTIFF files
- **Interactive maps** with Leaflet
- **3D globe visualization** (Cesium-ready)
- **Advanced search** and filtering
- **Analytics dashboard** with charts
- **Collections** for organizing images
- **Image comparison** side-by-side
- **Geospatial metadata** extraction
- **Tagging system** for categorization

## Prerequisites

- **Node.js** 18+
- **PostgreSQL** 14+
- **npm** or **yarn**

## Quick Start

### 1. Set up PostgreSQL

Create a database for the application:

```sql
CREATE DATABASE satellite_images;
```

### 2. Install Dependencies

```bash
npm run install:all
```

### 3. Configure Environment

Copy the example environment files and update them:

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your PostgreSQL credentials

# Frontend (optional - defaults work for local development)
cp frontend/.env.example frontend/.env
```

**Backend `.env` configuration:**
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=satellite_images
DB_USER=postgres
DB_PASSWORD=your_password
PORT=3001
STORAGE_DIR=./uploads
```

### 4. Build Shared Types

```bash
npm run build:shared
```

### 5. Start Development Servers

Run both frontend and backend:

```bash
npm run dev
```

Or run them separately:

```bash
# Terminal 1 - Backend (http://localhost:3001)
npm run dev:backend

# Terminal 2 - Frontend (http://localhost:5173)
npm run dev:frontend
```

The database tables will be created automatically on first backend startup.

## Project Structure

```
satellite-imagery-platform/
├── frontend/              # React application
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # Page components
│   │   ├── lib/          # Utilities, API, state
│   │   └── main.tsx      # Entry point
│   └── package.json
│
├── backend/              # Express server
│   ├── src/
│   │   ├── lib/          # Database, storage utilities
│   │   └── server.ts     # Express server
│   └── package.json
│
├── shared/               # Shared TypeScript types
│   └── src/
│       └── types.ts
│
└── package.json          # Root workspace config
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/images/upload-url` | Request upload (creates record) |
| POST | `/api/images/:id/upload` | Upload file |
| POST | `/api/images/:id/confirm` | Confirm upload |
| POST | `/api/images/search` | Search images |
| GET | `/api/images/:id` | Get image details |
| PATCH | `/api/images/:id` | Update image metadata |
| DELETE | `/api/images/:id` | Delete image |
| GET | `/api/analytics/statistics` | Get statistics |
| GET | `/api/collections` | List collections |
| POST | `/api/collections` | Create collection |
| GET | `/api/collections/:id` | Get collection |
| PATCH | `/api/collections/:id` | Update collection |
| DELETE | `/api/collections/:id` | Delete collection |
| POST | `/api/collections/:id/images` | Add images to collection |

## Technologies

### Frontend
- React 18, TypeScript, Vite
- Tailwind CSS
- TanStack Query (server state)
- Jotai (client state)
- Leaflet (2D maps)
- Cesium (3D globe)
- Recharts (charts)

### Backend
- Express.js
- PostgreSQL with `pg`
- Multer (file uploads)
- Sharp (image processing)
- GeoTIFF.js (metadata extraction)

## Development

### Build for Production

```bash
npm run build
```

### Run Production Server

```bash
npm run start:backend
```

## Database Schema

The application uses three main tables:

- **images** - Satellite image metadata
- **collections** - Image groupings
- **requests** - Imaging requests (future feature)

Tables are created automatically on server startup.

## File Storage

Uploaded files are stored locally in the `backend/uploads/` directory:

```
uploads/
├── images/
│   └── {image-id}/
│       └── {filename}
└── thumbnails/
```

## License

MIT License
