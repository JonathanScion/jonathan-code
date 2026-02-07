import { Router, Request, Response } from 'express';
import { queryClaude, streamClaude } from '../services/claude.js';
import { queryChatGPT, streamChatGPT } from '../services/openai.js';
import { queryGemini, streamGemini } from '../services/gemini.js';
import { generateEmbedding, isEmbeddingsEnabled } from '../services/embeddings.js';
import { queryVectors, isPineconeEnabled, type QueryResult } from '../services/pinecone.js';

export const chatRouter = Router();

// Helper to build context from RAG results
function buildRagContext(results: QueryResult[]): string {
  if (results.length === 0) return '';

  const contextParts = results.map((r, idx) =>
    `[Source ${idx + 1}: ${r.documentName}]\n${r.text}`
  );

  return `\n\n--- Relevant Context from Documents ---\n${contextParts.join('\n\n')}\n--- End Context ---\n\n`;
}

// Helper to inject RAG context into prompt
function injectRagContext(prompt: string, context: string): string {
  if (!context) return prompt;
  return `${context}Based on the above context (if relevant), please answer the following:\n\n${prompt}`;
}

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
  useRag?: boolean;
  ragTopK?: number;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

interface LLMResponse {
  response: string | null;
  error: string | null;
  duration: number;
  usage?: TokenUsage;
}

interface ServiceResponse {
  text: string;
  usage: TokenUsage;
}

chatRouter.post('/', async (req: Request, res: Response) => {
  const { prompt, claude = {}, openai = {}, gemini = {}, history, useRag = false, ragTopK = 5 } = req.body as ChatRequest;

  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  // Get RAG context if enabled
  let ragContext = '';
  let ragResults: QueryResult[] = [];
  if (useRag && isPineconeEnabled() && isEmbeddingsEnabled()) {
    try {
      const queryEmbedding = await generateEmbedding(prompt);
      ragResults = await queryVectors(queryEmbedding, ragTopK);
      ragContext = buildRagContext(ragResults);
    } catch (error) {
      console.error('RAG query error:', error);
    }
  }

  const augmentedPrompt = injectRagContext(prompt, ragContext);

  const executeWithTiming = async (
    fn: () => Promise<ServiceResponse>
  ): Promise<LLMResponse> => {
    const start = Date.now();
    try {
      const result = await fn();
      return {
        response: result.text,
        error: null,
        duration: Date.now() - start,
        usage: result.usage,
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
      () => queryClaude({ prompt: augmentedPrompt, ...claude, messages: history?.claude })
    ),
    executeWithTiming(
      () => queryChatGPT({ prompt: augmentedPrompt, ...openai, messages: history?.openai })
    ),
    executeWithTiming(
      () => queryGemini({ prompt: augmentedPrompt, ...gemini, messages: history?.gemini })
    ),
  ]);

  res.json({
    claude: claudeResult,
    openai: openaiResult,
    gemini: geminiResult,
    ragContext: useRag ? ragResults : undefined,
  });
});

// Streaming endpoint using Server-Sent Events
chatRouter.post('/stream', async (req: Request, res: Response) => {
  const { prompt, claude = {}, openai = {}, gemini = {}, history, useRag = false, ragTopK = 5 } = req.body as ChatRequest;

  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  // Get RAG context if enabled
  let ragContext = '';
  let ragResults: QueryResult[] = [];
  if (useRag && isPineconeEnabled() && isEmbeddingsEnabled()) {
    try {
      const queryEmbedding = await generateEmbedding(prompt);
      ragResults = await queryVectors(queryEmbedding, ragTopK);
      ragContext = buildRagContext(ragResults);
    } catch (error) {
      console.error('RAG query error:', error);
    }
  }

  const augmentedPrompt = injectRagContext(prompt, ragContext);

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send RAG context info first if available
  if (useRag && ragResults.length > 0) {
    res.write(`data: ${JSON.stringify({ type: 'rag', data: ragResults })}\n\n`);
  }

  interface StreamResult {
    type: 'chunk' | 'usage';
    data: string | TokenUsage;
  }

  const sendEvent = (provider: string, type: 'chunk' | 'done' | 'error' | 'usage', data: string | TokenUsage) => {
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
    streamFn: () => AsyncGenerator<StreamResult, void, unknown>
  ) => {
    try {
      for await (const result of streamFn()) {
        if (result.type === 'chunk') {
          sendEvent(name, 'chunk', result.data as string);
        } else if (result.type === 'usage') {
          sendEvent(name, 'usage', result.data as TokenUsage);
        }
      }
      const duration = Date.now() - startTimes[name];
      sendEvent(name, 'done', String(duration));
    } catch (error) {
      const err = error as Error;
      sendEvent(name, 'error', err.message);
    }
  };

  await Promise.all([
    streamProvider('claude', () => streamClaude({ prompt: augmentedPrompt, ...claude, messages: history?.claude })),
    streamProvider('openai', () => streamChatGPT({ prompt: augmentedPrompt, ...openai, messages: history?.openai })),
    streamProvider('gemini', () => streamGemini({ prompt: augmentedPrompt, ...gemini, messages: history?.gemini })),
  ]);

  res.write('data: [DONE]\n\n');
  res.end();
});
