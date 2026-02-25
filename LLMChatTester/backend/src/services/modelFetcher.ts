import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// --- Types ---
type LLMProvider = 'claude' | 'openai' | 'gemini' | 'xai' | 'groq' | 'perplexity';

interface CacheEntry {
  models: string[];
  fetchedAt: number;
  isError: boolean;
}

// --- Cache ---
const cache = new Map<LLMProvider, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;       // 5 minutes
const ERROR_BACKOFF = 60 * 1000;        // 60 seconds

function getCached(provider: LLMProvider): string[] | null {
  const entry = cache.get(provider);
  if (!entry) return null;
  const ttl = entry.isError ? ERROR_BACKOFF : CACHE_TTL;
  if (Date.now() - entry.fetchedAt > ttl) return null;
  return entry.models;
}

function setCache(provider: LLMProvider, models: string[], isError = false) {
  cache.set(provider, { models, fetchedAt: Date.now(), isError });
}

// --- Sorting ---
// Preferred models appear first (in this order), then the rest reverse-alpha.
// This controls which model gets auto-selected as the default.
const PREFERRED_ORDER: Record<LLMProvider, string[]> = {
  claude: ['claude-sonnet-4-6', 'claude-sonnet-4-5-20250929', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o4-mini', 'o3-mini', 'gpt-4-turbo'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  xai: ['grok-4-0709', 'grok-3', 'grok-3-mini'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen/qwen3-32b'],
  perplexity: ['sonar', 'sonar-pro', 'sonar-reasoning', 'sonar-reasoning-pro', 'sonar-deep-research'],
};

function sortModels(provider: LLMProvider, models: string[]): string[] {
  const preferred = PREFERRED_ORDER[provider] || [];
  const preferredSet = new Set(preferred);
  const top = preferred.filter(m => models.includes(m));
  const rest = models
    .filter(m => !preferredSet.has(m))
    .sort()
    .reverse();
  return [...top, ...rest];
}

// --- Per-provider fetchers ---

async function fetchClaudeModels(): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const client = new Anthropic({ apiKey });
  const response = await client.models.list({ limit: 100 });
  const models = response.data.map((m: { id: string }) => m.id);
  return sortModels('claude', models);
}

async function fetchOpenAIModels(): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const client = new OpenAI({ apiKey });
  const response = await client.models.list();
  const allModels = [];
  for await (const model of response) {
    allModels.push(model.id);
  }

  // Only include chat-completion-compatible text models
  const includePatterns = [/^gpt-[345]/, /^gpt-4o/, /^o[134]-/];
  const excludePatterns = [
    /instruct/i, /realtime/i, /audio/i, /embedding/i,
    /dall-e/i, /whisper/i, /tts/i, /babbage/i, /davinci/i,
    /image/i, /sora/i, /codex/i, /search/i, /transcribe/i,
    /deep-research/i, /moderation/i, /diarize/i,
  ];

  const filtered = allModels
    .filter(id => includePatterns.some(p => p.test(id)))
    .filter(id => !excludePatterns.some(p => p.test(id)));
  return sortModels('openai', filtered);
}

interface GeminiModel {
  name: string;
  supportedGenerationMethods?: string[];
}

async function fetchGeminiModels(): Promise<string[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return [];

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gemini list models: ${res.status}`);
  const data = await res.json() as { models: GeminiModel[] };

  // Only keep gemini-* text chat models
  const excludePatterns = [
    /embedding/i, /aqa/i, /bison/i,
    /image/i, /tts/i, /robotics/i, /computer-use/i,
    /gemma/i, /nano-/i, /deep-research/i, /customtools/i,
  ];

  const filtered = data.models
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => m.name.replace('models/', ''))
    .filter(id => id.startsWith('gemini-'))
    .filter(id => !excludePatterns.some(p => p.test(id)));
  return sortModels('gemini', filtered);
}

async function fetchXAIModels(): Promise<string[]> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return [];

  const client = new OpenAI({ apiKey, baseURL: 'https://api.x.ai/v1' });
  const response = await client.models.list();
  const allModels = [];
  for await (const model of response) {
    allModels.push(model.id);
  }

  // Only keep grok text chat models, exclude image/video/vision
  const excludePatterns = [/embedding/i, /image/i, /imagine/i, /vision/i, /video/i];

  const filtered = allModels
    .filter(id => id.startsWith('grok-'))
    .filter(id => !excludePatterns.some(p => p.test(id)));
  return sortModels('xai', filtered);
}

async function fetchGroqModels(): Promise<string[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return [];

  const client = new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' });
  const response = await client.models.list();
  const allModels = [];
  for await (const model of response) {
    allModels.push(model.id);
  }

  // Include known chat model families, exclude non-chat models
  const includePatterns = [
    /^llama-/, /^meta-llama\/llama-4/,
    /^mixtral-/, /^gemma-/,
    /^deepseek-/, /^qwen/,
    /^moonshotai\/kimi/,
    /^openai\/gpt-oss-(?!safeguard)/,
  ];
  const excludePatterns = [/whisper/i, /distil/i, /guard/i, /orpheus/i, /compound/i, /allam/i];

  const filtered = allModels
    .filter(id => includePatterns.some(p => p.test(id)))
    .filter(id => !excludePatterns.some(p => p.test(id)));
  return sortModels('groq', filtered);
}

// Perplexity doesn't support models.list() — returns 404.
// Hardcoded list is the only option. This is the one exception.
async function fetchPerplexityModels(): Promise<string[]> {
  return ['sonar-deep-research', 'sonar-reasoning-pro', 'sonar-reasoning', 'sonar-pro', 'sonar'];
}

// --- Provider map ---
const fetchers: Record<LLMProvider, () => Promise<string[]>> = {
  claude: fetchClaudeModels,
  openai: fetchOpenAIModels,
  gemini: fetchGeminiModels,
  xai: fetchXAIModels,
  groq: fetchGroqModels,
  perplexity: fetchPerplexityModels,
};

const apiKeyEnvVars: Record<LLMProvider, string> = {
  claude: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GOOGLE_AI_API_KEY',
  xai: 'XAI_API_KEY',
  groq: 'GROQ_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
};

// --- Pricing per 1M tokens (USD) ---
// Maintained here so the frontend has zero hardcoded model names.
// Unknown models simply show $0 cost on the frontend.
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Claude
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-sonnet-4-5-20250929': { input: 3, output: 15 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-opus-4-20250514': { input: 15, output: 75 },
  'claude-opus-4-1-20250805': { input: 15, output: 75 },
  'claude-opus-4-5-20251101': { input: 15, output: 75 },
  'claude-opus-4-6': { input: 15, output: 75 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-4': { input: 30, output: 60 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'o1': { input: 15, output: 60 },
  'o3': { input: 10, output: 40 },
  'o3-mini': { input: 1.1, output: 4.4 },
  'o4-mini': { input: 1.1, output: 4.4 },
  // Gemini
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.3 },
  // xAI (Grok)
  'grok-3': { input: 3, output: 15 },
  'grok-3-mini': { input: 0.3, output: 0.5 },
  'grok-4-0709': { input: 3, output: 15 },
  // Groq (Llama)
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  'mixtral-8x7b-32768': { input: 0.24, output: 0.24 },
  // Perplexity
  'sonar': { input: 1, output: 1 },
  'sonar-pro': { input: 3, output: 15 },
  'sonar-reasoning': { input: 1, output: 5 },
  'sonar-reasoning-pro': { input: 2, output: 8 },
  'sonar-deep-research': { input: 2, output: 8 },
};

// --- Public API ---

export async function getAllModels(): Promise<Record<string, string[]>> {
  const providers = Object.keys(fetchers) as LLMProvider[];
  const results: Record<string, string[]> = {};

  await Promise.all(
    providers.map(async (provider) => {
      // Skip providers without API keys (except perplexity which is hardcoded)
      if (provider !== 'perplexity' && !process.env[apiKeyEnvVars[provider]]) {
        results[provider] = [];
        return;
      }

      // Check cache first
      const cached = getCached(provider);
      if (cached !== null) {
        results[provider] = cached;
        return;
      }

      // Fetch fresh
      try {
        const models = await fetchers[provider]();
        setCache(provider, models);
        results[provider] = models;
      } catch (err) {
        console.error(`Failed to fetch models for ${provider}:`, err instanceof Error ? err.message : err);
        setCache(provider, [], true);
        results[provider] = [];
      }
    })
  );

  return results;
}
