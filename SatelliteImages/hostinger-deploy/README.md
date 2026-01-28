# Satellite Images Platform - Hostinger Deployment

This is a pre-built deployment package for Hostinger Node.js hosting.

## Setup Instructions

1. **Upload this zip file** to your Hostinger Node.js app

2. **Configure Environment Variables** in Hostinger's Node.js app settings:
   - `DATABASE_URL` - Your PostgreSQL connection string (required)
   - `PORT` - Usually set by Hostinger automatically
   - `NODE_ENV` - Set to `production`
   - `STORAGE_DIR` - Set to `./uploads`
   - `NASA_FIRMS_API_KEY` - Optional, for fire data
   - `N2YO_API_KEY` - Optional, for satellite tracking
   - `ANTHROPIC_API_KEY` - Optional, for AI analysis

3. **Set the Start Command** in Hostinger:
   - Start file: `dist/backend/src/server.js`
   - Or use npm start: `npm start`

4. **Database Setup**:
   The app uses PostgreSQL. You can use:
   - NeonDB (free tier available): https://neon.tech
   - Or any PostgreSQL provider

## Structure

- `dist/` - Compiled Node.js backend and React frontend
- `uploads/` - Directory for uploaded satellite images
- `package.json` - Dependencies and start script

## Notes

- The server will automatically create database tables on first run
- Uploaded images are stored in the `uploads/` directory
- The React frontend is served from the same server in production mode
