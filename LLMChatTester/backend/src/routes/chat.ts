import { Router, Request, Response } from 'express';
import { queryClaude, streamClaude } from '../services/claude.js';
import { queryChatGPT, streamChatGPT } from '../services/openai.js';
import { queryGemini, streamGemini } from '../services/gemini.js';

export const chatRouter = Router();

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type SafetyLevel = 'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE';

interface SafetySettings {
  harassment: SafetyLevel;
  hateSpeech: SafetyLevel;
  sexuallyExplicit: SafetyLevel;
  dangerousContent: SafetyLevel;
}

interface ClaudeRequestParams {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topK?: number;
  topP?: number;
  stopSequences?: string[];
  systemPrompt?: string;
}

interface OpenAIRequestParams {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  responseFormat?: 'text' | 'json_object';
  seed?: number;
  systemPrompt?: string;
}

interface GeminiRequestParams {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topK?: number;
  topP?: number;
  stopSequences?: string[];
  safetySettings?: SafetySettings;
  systemPrompt?: string;
}

interface ChatRequest {
  prompt: string;
  claude?: ClaudeRequestParams;
  openai?: OpenAIRequestParams;
  gemini?: GeminiRequestParams;
  history?: {
    claude: Message[];
    openai: Message[];
    gemini: Message[];
  };
}

interface LLMResponse {
  response: string | null;
  error: string | null;
  duration: number;
}

chatRouter.post('/', async (req: Request, res: Response) => {
  const { prompt, claude = {}, openai = {}, gemini = {}, history } = req.body as ChatRequest;

  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  const executeWithTiming = async (
    fn: () => Promise<string>,
    name: string
  ): Promise<LLMResponse> => {
    const start = Date.now();
    try {
      const response = await fn();
      return {
        response,
        error: null,
        duration: Date.now() - start,
      };
    } catch (error) {
      const err = error as Error;
      return {
        response: null,
        error: err.message,
        duration: Date.now() - start,
      };
    }
  };

  const [claudeResult, openaiResult, geminiResult] = await Promise.all([
    executeWithTiming(
      () => queryClaude({ prompt, ...claude, messages: history?.claude }),
      'claude'
    ),
    executeWithTiming(
      () => queryChatGPT({ prompt, ...openai, messages: history?.openai }),
      'openai'
    ),
    executeWithTiming(
      () => queryGemini({ prompt, ...gemini, messages: history?.gemini }),
      'gemini'
    ),
  ]);

  res.json({
    claude: claudeResult,
    openai: openaiResult,
    gemini: geminiResult,
  });
});

// Streaming endpoint using Server-Sent Events
chatRouter.post('/stream', async (req: Request, res: Response) => {
  const { prompt, claude = {}, openai = {}, gemini = {}, history } = req.body as ChatRequest;

  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (provider: string, type: 'chunk' | 'done' | 'error', data: string) => {
    res.write(`data: ${JSON.stringify({ provider, type, data })}\n\n`);
  };

  const startTimes: Record<string, number> = {
    claude: Date.now(),
    openai: Date.now(),
    gemini: Date.now(),
  };

  // Stream from all providers concurrently
  const streamProvider = async (
    name: string,
    streamFn: () => AsyncGenerator<string, void, unknown>
  ) => {
    try {
      for await (const chunk of streamFn()) {
        sendEvent(name, 'chunk', chunk);
      }
      const duration = Date.now() - startTimes[name];
      sendEvent(name, 'done', String(duration));
    } catch (error) {
      const err = error as Error;
      sendEvent(name, 'error', err.message);
    }
  };

  await Promise.all([
    streamProvider('claude', () => streamClaude({ prompt, ...claude, messages: history?.claude })),
    streamProvider('openai', () => streamChatGPT({ prompt, ...openai, messages: history?.openai })),
    streamProvider('gemini', () => streamGemini({ prompt, ...gemini, messages: history?.gemini })),
  ]);

  res.write('data: [DONE]\n\n');
  res.end();
});
