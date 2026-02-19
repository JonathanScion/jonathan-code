import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendRoot = path.join(__dirname, '..');
const projectRoot = path.join(backendRoot, '..');
const deployDir = path.join(projectRoot, 'deploy');
const frontendDist = path.join(projectRoot, 'frontend', 'dist');
const publicDir = path.join(deployDir, 'public');

// Clean deploy directory (except .env)
if (fs.existsSync(deployDir)) {
  const envBackup = fs.existsSync(path.join(deployDir, '.env'))
    ? fs.readFileSync(path.join(deployDir, '.env'), 'utf-8')
    : null;
  fs.rmSync(deployDir, { recursive: true });
  fs.mkdirSync(deployDir, { recursive: true });
  if (envBackup) {
    fs.writeFileSync(path.join(deployDir, '.env'), envBackup);
  }
} else {
  fs.mkdirSync(deployDir, { recursive: true });
}

// 1. Bundle backend into single .mjs file
console.log('Bundling backend...');
await build({
  entryPoints: [path.join(backendRoot, 'src/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: path.join(deployDir, 'server.bundle.mjs'),
  packages: 'external',
  // Banner to fix __dirname for the bundle
  banner: {
    js: `
import { fileURLToPath as __bundle_fileURLToPath } from 'url';
import { dirname as __bundle_dirname, join as __bundle_join } from 'path';
const __bundle_filename = __bundle_fileURLToPath(import.meta.url);
const __bundle_dirname_val = __bundle_dirname(__bundle_filename);
`.trim()
  },
});
console.log('Bundle created: deploy/server.bundle.mjs');

// 2. Post-process bundle to fix paths
// In the deploy folder, public/ is a sibling of server.bundle.mjs
// The bundle's __dirname will be the deploy folder root, so "../public" needs to become "./public"
let bundleContent = fs.readFileSync(path.join(deployDir, 'server.bundle.mjs'), 'utf-8');

// Fix publicPath: ../public -> ./public (since bundle is at deploy root, not in dist/)
bundleContent = bundleContent.replace(
  /path\d*\.join\(__dirname\d*,\s*"\.\.\/public"\)/g,
  '__bundle_join(__bundle_dirname_val, "public")'
);

// Fix uploads dir path
bundleContent = bundleContent.replace(
  /path\d*\.join\(__dirname\d*,\s*"\.\.\/\.\.\/data\/uploads"\)/g,
  '__bundle_join(__bundle_dirname_val, "uploads")'
);

// Fix .env paths - the wrapper handles this, but make bundle paths correct too
bundleContent = bundleContent.replace(
  /path\d*\.join\(__dirname\d*,\s*"\.\.\/\.\.\/\.env"\)/g,
  '__bundle_join(__bundle_dirname_val, ".env")'
);
bundleContent = bundleContent.replace(
  /path\d*\.join\(__dirname\d*,\s*"\.\.\/\.env"\)/g,
  '__bundle_join(__bundle_dirname_val, ".env")'
);

fs.writeFileSync(path.join(deployDir, 'server.bundle.mjs'), bundleContent);
console.log('Bundle paths fixed for deploy folder layout');

// 3. Copy frontend dist to public/
console.log('Copying frontend to public/...');
if (fs.existsSync(frontendDist)) {
  copyDir(frontendDist, publicDir);
  console.log('Frontend copied to deploy/public/');
} else {
  console.warn('WARNING: frontend/dist not found - build frontend first!');
  fs.mkdirSync(publicDir, { recursive: true });
}

// 4. Create uploads directory
fs.mkdirSync(path.join(deployDir, 'uploads'), { recursive: true });

// 5. Create production package.json (NO "type": "module" - server.js is CJS)
const pkg = JSON.parse(fs.readFileSync(path.join(backendRoot, 'package.json'), 'utf-8'));
const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  main: 'server.js',
  engines: { node: '>=18.0.0' },
  scripts: {
    build: 'true',
    start: 'node server.js'
  },
  dependencies: pkg.dependencies
};
fs.writeFileSync(path.join(deployDir, 'package.json'), JSON.stringify(prodPkg, null, 2));
console.log('Production package.json created');

// 6. Create CommonJS server.js wrapper (Hostinger entry point)
const serverJs = `// Hostinger Entry Point - CommonJS wrapper for ES Module bundle
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
  try { fs.appendFileSync(logFile, line + '\\n'); } catch (e) {}
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
`;
fs.writeFileSync(path.join(deployDir, 'server.js'), serverJs);
console.log('CommonJS server.js wrapper created');

// 7. Create .env.example
const envExample = `# API Keys
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_AI_API_KEY=
XAI_API_KEY=
GROQ_API_KEY=
PERPLEXITY_API_KEY=

# Pinecone (RAG)
PINECONE_API_KEY=
PINECONE_INDEX=llm-chat-tester

# Server
PORT=3001

# Database (NeonDB)
DATABASE_URL=

# Auth
JWT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://llmtester-api.jonathanscode.io/api/auth/google/callback
FRONTEND_URL=https://llmtester.jonathanscode.io
`;
fs.writeFileSync(path.join(deployDir, '.env.example'), envExample);

console.log('');
console.log('=== Deploy package ready! ===');
console.log('To deploy: zip deploy/* -> hostinger-backend.zip -> upload to Hostinger');
console.log('Entry file: server.js');
console.log('Node version: 18.x');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
