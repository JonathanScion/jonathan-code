import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import passport from 'passport';
import { chatRouter } from './routes/chat.js';
import { ragRouter } from './routes/rag.js';
import { authRouter, initPassport } from './routes/auth.js';
import { initPinecone } from './services/pinecone.js';
import { initEmbeddings } from './services/embeddings.js';
import { initDatabase, isDatabaseEnabled } from './db/index.js';
import { getAllModels, MODEL_PRICING } from './services/modelFetcher.js';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from multiple locations
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

// Initialize services
initDatabase();
initPinecone();
initEmbeddings();

// Initialize auth (only if database is enabled)
if (isDatabaseEnabled()) {
  initPassport();
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased for image uploads
app.use(passport.initialize());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: isDatabaseEnabled(),
  });
});

// Provider availability - which API keys are configured
app.get('/api/providers', (_req, res) => {
  res.json({
    claude: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GOOGLE_AI_API_KEY,
    xai: !!process.env.XAI_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
    perplexity: !!process.env.PERPLEXITY_API_KEY,
  });
});

// Provider models - live model lists from each provider API
app.get('/api/providers/models', async (_req, res) => {
  try {
    const models = await getAllModels();
    res.json({ models, pricing: MODEL_PRICING });
  } catch (err) {
    console.error('Failed to fetch models:', err);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/rag', ragRouter);

// Serve static files from public directory (for production)
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Don't catch API routes
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
