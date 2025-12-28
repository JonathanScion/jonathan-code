export interface LLMParams {
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface ChatParams {
  claude: LLMParams;
  openai: LLMParams;
  gemini: LLMParams;
}

export interface LLMResponse {
  response: string | null;
  error: string | null;
  duration: number;
}

export interface ChatResponse {
  claude: LLMResponse;
  openai: LLMResponse;
  gemini: LLMResponse;
}

export type LLMProvider = 'claude' | 'openai' | 'gemini';

export const DEFAULT_PARAMS: ChatParams = {
  claude: {
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    maxTokens: 1024,
  },
  openai: {
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 1024,
  },
  gemini: {
    model: 'gemini-1.5-pro',
    temperature: 0.7,
    maxTokens: 1024,
  },
};

export const MODEL_OPTIONS = {
  claude: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'],
};
