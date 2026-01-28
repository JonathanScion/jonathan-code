// Minimal test server for Hostinger
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('=== Server Starting ===');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Root route
app.get('/', (req, res) => {
  res.send('SatelliteImages API is running! Try /api/health');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
