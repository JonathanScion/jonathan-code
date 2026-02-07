// Common types
export type LLMProvider = 'claude' | 'openai' | 'gemini';

// Prompt template types
export interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  category?: string;
  createdAt: number;
}

// RAG types
export interface DocumentInfo {
  id: string;
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

export interface Message {
  role: 'user' | 'assistant';
  content: string;
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

// Combined chat params
export interface ChatParams {
  sharedSystemPrompt: string;
  useSharedSystemPrompt: boolean;
  claude: ClaudeParams;
  openai: OpenAIParams;
  gemini: GeminiParams;
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

export interface StreamingState {
  claude: string;
  openai: string;
  gemini: string;
}

export interface StreamingStatus {
  claude: 'idle' | 'streaming' | 'done' | 'error';
  openai: 'idle' | 'streaming' | 'done' | 'error';
  gemini: 'idle' | 'streaming' | 'done' | 'error';
}

export interface ChatResponse {
  claude: LLMResponse;
  openai: LLMResponse;
  gemini: LLMResponse;
}

// Rating types
export interface ResponseRating {
  stars: number; // 0-5, 0 means not rated
  isWinner: boolean;
  notes: string;
}

export interface TurnRatings {
  claude: ResponseRating;
  openai: ResponseRating;
  gemini: ResponseRating;
}

export const DEFAULT_RATING: ResponseRating = {
  stars: 0,
  isWinner: false,
  notes: '',
};

export const DEFAULT_TURN_RATINGS: TurnRatings = {
  claude: { ...DEFAULT_RATING },
  openai: { ...DEFAULT_RATING },
  gemini: { ...DEFAULT_RATING },
};

export interface ConversationTurn {
  userMessage: string;
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
};

export const MODEL_OPTIONS = {
  claude: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
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
};

export function calculateCost(model: string, usage?: TokenUsage): number {
  if (!usage) return 0;
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}
