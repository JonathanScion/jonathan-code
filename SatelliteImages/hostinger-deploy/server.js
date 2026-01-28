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
