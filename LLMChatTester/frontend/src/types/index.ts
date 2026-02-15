// Common types
export type LLMProvider = 'claude' | 'openai' | 'gemini' | 'xai' | 'groq' | 'perplexity';

export const ALL_PROVIDERS: LLMProvider[] = ['claude', 'openai', 'gemini', 'xai', 'groq', 'perplexity'];

export interface ProviderMeta {
  name: string;
  color: string;        // Tailwind bg class e.g. 'bg-orange-600'
  textColor: string;    // Tailwind text class e.g. 'text-orange-400'
  apiKeyEnv: string;    // env var name checked on backend
}

export const PROVIDER_INFO: Record<LLMProvider, ProviderMeta> = {
  claude:     { name: 'Claude',      color: 'bg-orange-600',  textColor: 'text-orange-400', apiKeyEnv: 'ANTHROPIC_API_KEY' },
  openai:     { name: 'ChatGPT',     color: 'bg-green-600',   textColor: 'text-green-400',  apiKeyEnv: 'OPENAI_API_KEY' },
  gemini:     { name: 'Gemini',      color: 'bg-blue-600',    textColor: 'text-blue-400',   apiKeyEnv: 'GOOGLE_AI_API_KEY' },
  xai:        { name: 'Grok',        color: 'bg-gray-600',    textColor: 'text-gray-300',   apiKeyEnv: 'XAI_API_KEY' },
  groq:       { name: 'Llama (Groq)',color: 'bg-indigo-600',  textColor: 'text-indigo-400', apiKeyEnv: 'GROQ_API_KEY' },
  perplexity: { name: 'Perplexity',  color: 'bg-teal-600',    textColor: 'text-teal-400',   apiKeyEnv: 'PERPLEXITY_API_KEY' },
};

/** Create a Record keyed by every LLMProvider with the same initial value */
export function makeProviderRecord<T>(init: () => T): Record<LLMProvider, T> {
  const rec = {} as Record<LLMProvider, T>;
  for (const p of ALL_PROVIDERS) rec[p] = init();
  return rec;
}

// Prompt template types
export interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  category?: string;
  createdAt: number;
}

// RAG types
export interface Collection {
  id: string;
  name: string;
  createdAt: number;
}

export interface DocumentInfo {
  id: string;
  collectionId: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  chunkCount: number;
  uploadedAt: number;
}

export interface RagResult {
  id: string;
  score: number;
  text: string;
  documentName: string;
  documentId: string;
  chunkIndex: number;
}

export interface RagStatus {
  enabled: boolean;
  pinecone: boolean;
  embeddings: boolean;
}

// Image data for multimodal
export interface ImageData {
  base64: string;
  mimeType: string;
  name: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  images?: ImageData[];
}

// Provider-specific parameter types
export interface ClaudeParams {
  model: string;
  temperature: number;
  maxTokens: number;
  topK?: number;
  topP?: number;
  stopSequences?: string[];
  systemPrompt?: string;
}

export interface OpenAIParams {
  model: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  responseFormat?: 'text' | 'json_object';
  seed?: number;
  systemPrompt?: string;
}

export type GeminiSafetyLevel = 'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE';

export interface GeminiSafetySettings {
  harassment: GeminiSafetyLevel;
  hateSpeech: GeminiSafetyLevel;
  sexuallyExplicit: GeminiSafetyLevel;
  dangerousContent: GeminiSafetyLevel;
}

export interface GeminiParams {
  model: string;
  temperature: number;
  maxTokens: number;
  topK?: number;
  topP?: number;
  stopSequences?: string[];
  safetySettings?: GeminiSafetySettings;
  systemPrompt?: string;
}

// OpenAI-compatible provider params (xAI, Groq, Perplexity)
export interface OpenAICompatibleParams {
  model: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  topK?: number;
  systemPrompt?: string;
}

// Combined chat params
export interface ChatParams {
  sharedSystemPrompt: string;
  useSharedSystemPrompt: boolean;
  enabledProviders: LLMProvider[];
  claude: ClaudeParams;
  openai: OpenAIParams;
  gemini: GeminiParams;
  xai: OpenAICompatibleParams;
  groq: OpenAICompatibleParams;
  perplexity: OpenAICompatibleParams;
}

// Token usage types
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

// Response types
export interface LLMResponse {
  response: string | null;
  error: string | null;
  duration: number;
  usage?: TokenUsage;
}

export type StreamingState = Record<LLMProvider, string>;
export type StreamingStatus = Record<LLMProvider, 'idle' | 'streaming' | 'done' | 'error'>;
export type ChatResponse = Record<LLMProvider, LLMResponse>;

// Rating types
export interface ResponseRating {
  stars: number; // 0-5, 0 means not rated
  isWinner: boolean;
  notes: string;
}

export type TurnRatings = Record<LLMProvider, ResponseRating>;

export const DEFAULT_RATING: ResponseRating = {
  stars: 0,
  isWinner: false,
  notes: '',
};

export const DEFAULT_TURN_RATINGS: TurnRatings = makeProviderRecord(() => ({ ...DEFAULT_RATING }));

export interface ConversationTurn {
  userMessage: string;
  images?: ImageData[];
  responses: ChatResponse;
  timestamp: number;
  ratings?: TurnRatings;
}

// Default values
export const DEFAULT_GEMINI_SAFETY: GeminiSafetySettings = {
  harassment: 'BLOCK_MEDIUM_AND_ABOVE',
  hateSpeech: 'BLOCK_MEDIUM_AND_ABOVE',
  sexuallyExplicit: 'BLOCK_MEDIUM_AND_ABOVE',
  dangerousContent: 'BLOCK_MEDIUM_AND_ABOVE',
};

export const DEFAULT_PARAMS: ChatParams = {
  sharedSystemPrompt: '',
  useSharedSystemPrompt: true,
  enabledProviders: ['claude', 'openai', 'gemini'],
  claude: {
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    maxTokens: 1024,
    topK: undefined,
    topP: undefined,
    stopSequences: [],
    systemPrompt: '',
  },
  openai: {
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 1024,
    topP: undefined,
    frequencyPenalty: 0,
    presencePenalty: 0,
    responseFormat: 'text',
    seed: undefined,
    systemPrompt: '',
  },
  gemini: {
    model: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 1024,
    topK: undefined,
    topP: undefined,
    stopSequences: [],
    safetySettings: DEFAULT_GEMINI_SAFETY,
    systemPrompt: '',
  },
  xai: {
    model: 'grok-3-mini-beta',
    temperature: 0.7,
    maxTokens: 1024,
    topP: undefined,
    topK: undefined,
    systemPrompt: '',
  },
  groq: {
    model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
    maxTokens: 1024,
    topP: undefined,
    topK: undefined,
    systemPrompt: '',
  },
  perplexity: {
    model: 'sonar',
    temperature: 0.7,
    maxTokens: 1024,
    topP: undefined,
    topK: undefined,
    systemPrompt: '',
  },
};

export const MODEL_OPTIONS: Record<LLMProvider, string[]> = {
  claude: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  xai: ['grok-3-mini-beta', 'grok-3-beta', 'grok-2'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  perplexity: ['sonar', 'sonar-pro', 'sonar-reasoning'],
};

export const SAFETY_LEVEL_OPTIONS: GeminiSafetyLevel[] = [
  'BLOCK_NONE',
  'BLOCK_ONLY_HIGH',
  'BLOCK_MEDIUM_AND_ABOVE',
  'BLOCK_LOW_AND_ABOVE',
];

// Pricing per 1M tokens (USD)
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Claude models
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-3-5-haiku-20241022': { input: 1, output: 5 },
  'claude-3-opus-20240229': { input: 15, output: 75 },
  // OpenAI models
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  // Gemini models
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  // xAI (Grok) models
  'grok-3-mini-beta': { input: 0.3, output: 0.5 },
  'grok-3-beta': { input: 3, output: 15 },
  'grok-2': { input: 2, output: 10 },
  // Groq (Llama) models
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  'mixtral-8x7b-32768': { input: 0.24, output: 0.24 },
  // Perplexity models
  'sonar': { input: 1, output: 1 },
  'sonar-pro': { input: 3, output: 15 },
  'sonar-reasoning': { input: 1, output: 5 },
};

export function calculateCost(model: string, usage?: TokenUsage): number {
  if (!usage) return 0;
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}
