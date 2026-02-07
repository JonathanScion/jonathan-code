import { Router, Request, Response } from 'express';
import { queryClaude } from '../services/claude.js';
import { queryChatGPT } from '../services/openai.js';
import { queryGemini } from '../services/gemini.js';

export const chatRouter = Router();

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  prompt: string;
  claude?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
  openai?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
  gemini?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
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
