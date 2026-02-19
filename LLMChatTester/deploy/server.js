// Hostinger Entry Point - CommonJS wrapper for ES Module bundle
// Hostinger's lsnode.js uses require(), so this must be CommonJS

const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, 'logs');
const logFile = path.join(logDir, 'app.log');

try {
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
} catch (e) {}

function log(msg) {
  const line = '[' + new Date().toISOString() + '] ' + msg;
  console.log(msg);
  try { fs.appendFileSync(logFile, line + '\n'); } catch (e) {}
}

log('=== SERVER STARTING ===');
log('Node: ' + process.version);
log('CWD: ' + process.cwd());
log('Dir: ' + __dirname);

// Load .env
try {
  const dotenv = require('dotenv');
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    log('.env loaded');
  } else {
    log('.env not found at ' + envPath);
  }
} catch (err) {
  log('dotenv error: ' + err.message);
}

const PORT = process.env.PORT || 3001;
log('PORT: ' + PORT);

// Load ESM bundle
async function start() {
  try {
    log('Loading server.bundle.mjs...');
    await import('./server.bundle.mjs');
    log('=== SERVER RUNNING ===');
  } catch (err) {
    log('Bundle error: ' + err.message);
    log('Stack: ' + err.stack);

    // Fallback server for debugging
    const http = require('http');
    http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'fallback',
        error: err.message,
        stack: err.stack,
        nodeVersion: process.version,
        port: PORT
      }, null, 2));
    }).listen(PORT, '0.0.0.0', () => log('Fallback on port ' + PORT));
  }
}

start();
