// Hostinger Entry Point - CommonJS wrapper for ES Module bundle
// Hostinger's lsnode.js uses require(), so this must be CommonJS

const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, 'logs');
const logFile = path.join(logDir, 'app.log');

// Ensure logs directory exists
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch (e) {
  // Can't create dir, will try to log anyway
}

function log(message) {
  const timestamp = new Date().toISOString();
  const line = '[' + timestamp + '] ' + message + '\n';
  console.log(message);
  try {
    fs.appendFileSync(logFile, line);
  } catch (e) {
    // Ignore file write errors
  }
}

function logError(label, err) {
  log('ERROR - ' + label);
  log('  Name: ' + err.name);
  log('  Message: ' + err.message);
  log('  Stack: ' + err.stack);
}

// Start logging
log('========================================');
log('=== SERVER STARTING (CommonJS Entry) ===');
log('Node version: ' + process.version);
log('Current directory: ' + process.cwd());
log('__dirname: ' + __dirname);
log('PORT env: ' + process.env.PORT);

const PORT = process.env.PORT || 3000;
log('Using PORT: ' + PORT);

// Step 1: Load .env file
let envLoaded = false;
try {
  log('Loading dotenv...');
  const dotenv = require('dotenv');

  const envPath = path.join(__dirname, '.env');
  log('Looking for .env at: ' + envPath);
  log('.env exists: ' + fs.existsSync(envPath));

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    log('.env file size: ' + envContent.length + ' bytes');
  }

  const result = dotenv.config({ path: envPath });

  if (result.error) {
    log('dotenv error: ' + result.error.message);
  } else {
    envLoaded = true;
    log('dotenv loaded successfully');
    log('Parsed keys: ' + Object.keys(result.parsed || {}).join(', '));
  }

  log('DATABASE_URL set: ' + !!process.env.DATABASE_URL);
  log('NODE_ENV: ' + process.env.NODE_ENV);
  log('ANTHROPIC_API_KEY set: ' + !!process.env.ANTHROPIC_API_KEY);
  log('NASA_FIRMS_API_KEY set: ' + !!process.env.NASA_FIRMS_API_KEY);
  log('N2YO_API_KEY set: ' + !!process.env.N2YO_API_KEY);

} catch (err) {
  logError('dotenv load failed', err);
}

// Step 1b: Load config.js as fallback if env vars are still missing
if (!process.env.DATABASE_URL) {
  try {
    log('DATABASE_URL not set, loading config.js fallback...');
    const configPath = path.join(__dirname, 'config.js');
    log('Looking for config.js at: ' + configPath);

    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf8');
      // Parse the exported config object from the ES module file
      const match = configContent.match(/DATABASE_URL:\s*['"]([^'"]+)['"]/);
      if (match) process.env.DATABASE_URL = match[1];

      const nodeEnvMatch = configContent.match(/NODE_ENV:\s*['"]([^'"]+)['"]/);
      if (nodeEnvMatch) process.env.NODE_ENV = nodeEnvMatch[1];

      const nasaMatch = configContent.match(/NASA_FIRMS_API_KEY:\s*['"]([^'"]+)['"]/);
      if (nasaMatch) process.env.NASA_FIRMS_API_KEY = nasaMatch[1];

      const n2yoMatch = configContent.match(/N2YO_API_KEY:\s*['"]([^'"]+)['"]/);
      if (n2yoMatch) process.env.N2YO_API_KEY = n2yoMatch[1];

      const anthropicMatch = configContent.match(/ANTHROPIC_API_KEY:\s*['"]([^'"]+)['"]/);
      if (anthropicMatch) process.env.ANTHROPIC_API_KEY = anthropicMatch[1];

      const publicApiMatch = configContent.match(/PUBLIC_API_URL:\s*['"]([^'"]+)['"]/);
      if (publicApiMatch) process.env.PUBLIC_API_URL = publicApiMatch[1];

      log('config.js parsed - DATABASE_URL set: ' + !!process.env.DATABASE_URL);
      log('config.js parsed - ANTHROPIC_API_KEY set: ' + !!process.env.ANTHROPIC_API_KEY);
      log('config.js parsed - PUBLIC_API_URL: ' + (process.env.PUBLIC_API_URL || '(not set)'));
    } else {
      log('config.js not found at ' + configPath);
    }
  } catch (configErr) {
    logError('config.js load failed', configErr);
  }
}

// Step 2: Dynamically import the ES Module bundle
let bundleLoaded = false;

async function loadBundle() {
  try {
    log('Loading server.bundle.mjs via dynamic import...');
    await import('./server.bundle.mjs');
    bundleLoaded = true;
    log('Server bundle loaded successfully');
    log('=== FULL SERVER SHOULD BE RUNNING ===');
  } catch (err) {
    logError('Bundle load failed', err);

    // Step 3: Start minimal fallback server
    log('Starting fallback HTTP server...');

    try {
      const http = require('http');

      const server = http.createServer((req, res) => {
        log('Request: ' + req.method + ' ' + req.url);

        // CORS headers on fallback server so errors are visible in browser
        const origin = req.headers.origin || '*';
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Filename');
        res.setHeader('Access-Control-Allow-Credentials', 'true');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'fallback',
          envLoaded: envLoaded,
          bundleLoaded: bundleLoaded,
          error: err.message,
          errorStack: err.stack,
          nodeVersion: process.version,
          port: PORT,
          cwd: process.cwd(),
          dirname: __dirname,
          envVars: {
            DATABASE_URL_SET: !!process.env.DATABASE_URL,
            NODE_ENV: process.env.NODE_ENV,
            ANTHROPIC_API_KEY_SET: !!process.env.ANTHROPIC_API_KEY
          }
        }, null, 2));
      });

      server.listen(PORT, '0.0.0.0', function() {
        log('Fallback server listening on 0.0.0.0:' + PORT);
      });

      server.on('error', function(e) {
        logError('Server error', e);
      });

    } catch (httpErr) {
      logError('HTTP module failed', httpErr);
    }
  }
}

loadBundle();

log('=== END OF SERVER.JS ===');
