// Common types
export type LLMProvider = 'claude' | 'openai' | 'gemini';

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

// Response types
export interface LLMResponse {
  response: string | null;
  error: string | null;
  duration: number;
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

export interface ConversationTurn {
  userMessage: string;
  responses: ChatResponse;
  timestamp: number;
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
