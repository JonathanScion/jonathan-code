import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendRoot = path.join(__dirname, '..');
const projectRoot = path.join(backendRoot, '..');
const frontendDist = path.join(projectRoot, 'frontend', 'dist');
const deployDir = path.join(projectRoot, 'deploy');
const publicDir = path.join(deployDir, 'public');

// Clean and create deploy directory
if (fs.existsSync(deployDir)) {
  fs.rmSync(deployDir, { recursive: true });
}
fs.mkdirSync(deployDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

// Copy backend dist folder
const backendDist = path.join(backendRoot, 'dist');
copyDir(backendDist, path.join(deployDir, 'dist'));

// Copy frontend dist to public
copyDir(frontendDist, publicDir);

// Create production package.json
const pkg = JSON.parse(fs.readFileSync(path.join(backendRoot, 'package.json'), 'utf-8'));
const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  type: 'module',
  main: 'dist/index.js',
  scripts: {
    start: 'node dist/index.js'
  },
  dependencies: pkg.dependencies
};
fs.writeFileSync(path.join(deployDir, 'package.json'), JSON.stringify(prodPkg, null, 2));

// Create data directory for document registry
fs.mkdirSync(path.join(deployDir, 'data'), { recursive: true });

// Create .env.example
const envExample = `# API Keys - Add your keys here
ANTHROPIC_API_KEY=your_anthropic_key_here
OPENAI_API_KEY=your_openai_key_here
GOOGLE_AI_API_KEY=your_google_ai_key_here

# Pinecone (for RAG features)
PINECONE_API_KEY=your_pinecone_key_here
PINECONE_INDEX=llm-chat-tester

# Server port (optional, defaults to 3001)
PORT=3001
`;
fs.writeFileSync(path.join(deployDir, '.env.example'), envExample);

console.log('Deploy package created at:', deployDir);
console.log('');
console.log('To deploy to Hostinger:');
console.log('1. Upload the contents of the deploy folder');
console.log('2. Create a .env file with your API keys');
console.log('3. Run: npm install');
console.log('4. Run: npm start');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`Source directory not found: ${src}`);
    return;
  }

  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
