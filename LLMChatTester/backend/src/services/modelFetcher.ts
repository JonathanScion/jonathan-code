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

// --- Per-provider fetchers ---

async function fetchClaudeModels(): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const client = new Anthropic({ apiKey });
  const response = await client.models.list({ limit: 100 });
  const models = response.data
    .map((m: { id: string }) => m.id)
    .sort()
    .reverse();
  return models;
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

  const includePatterns = [/^gpt-4/, /^gpt-3\.5/, /^o1/, /^o3/, /^o4/, /^chatgpt-/];
  const excludePatterns = [/instruct/i, /realtime/i, /audio/i, /embedding/i, /dall-e/i, /whisper/i, /tts/i, /babbage/i, /davinci/i];

  return allModels
    .filter(id => includePatterns.some(p => p.test(id)))
    .filter(id => !excludePatterns.some(p => p.test(id)))
    .sort()
    .reverse();
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

  const excludePatterns = [/embedding/i, /aqa/i, /bison/i];

  return data.models
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => m.name.replace('models/', ''))
    .filter(id => !excludePatterns.some(p => p.test(id)))
    .sort()
    .reverse();
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

  const excludePatterns = [/embedding/i, /image/i];

  return allModels
    .filter(id => id.startsWith('grok-'))
    .filter(id => !excludePatterns.some(p => p.test(id)))
    .sort()
    .reverse();
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

  const includePatterns = [/^llama-/, /^mixtral-/, /^gemma-/, /^deepseek-/, /^qwen-/];
  const excludePatterns = [/whisper/i, /distil/i, /guard/i];

  return allModels
    .filter(id => includePatterns.some(p => p.test(id)))
    .filter(id => !excludePatterns.some(p => p.test(id)))
    .sort()
    .reverse();
}

async function fetchPerplexityModels(): Promise<string[]> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return [];

  const client = new OpenAI({ apiKey, baseURL: 'https://api.perplexity.ai' });
  const response = await client.models.list();
  const allModels = [];
  for await (const model of response) {
    allModels.push(model.id);
  }

  return allModels
    .filter(id => id.startsWith('sonar'))
    .sort()
    .reverse();
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
  'claude-3-5-haiku-20241022': { input: 1, output: 5 },
  'claude-3-opus-20240229': { input: 15, output: 75 },
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  // Gemini
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  // xAI (Grok)
  'grok-3-mini-beta': { input: 0.3, output: 0.5 },
  'grok-3-beta': { input: 3, output: 15 },
  'grok-2': { input: 2, output: 10 },
  // Groq (Llama)
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  'mixtral-8x7b-32768': { input: 0.24, output: 0.24 },
  // Perplexity
  'sonar': { input: 1, output: 1 },
  'sonar-pro': { input: 3, output: 15 },
  'sonar-reasoning': { input: 1, output: 5 },
};

// --- Public API ---

export async function getAllModels(): Promise<Record<string, string[]>> {
  const providers = Object.keys(fetchers) as LLMProvider[];
  const results: Record<string, string[]> = {};

  await Promise.all(
    providers.map(async (provider) => {
      // Skip providers without API keys
      if (!process.env[apiKeyEnvVars[provider]]) {
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
