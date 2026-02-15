import { Router, Request, Response } from 'express';
import { queryClaude, streamClaude } from '../services/claude.js';
import { queryChatGPT, streamChatGPT } from '../services/openai.js';
import { queryGemini, streamGemini } from '../services/gemini.js';
import { xaiProvider, groqProvider, perplexityProvider } from '../services/openai-compatible.js';
import { generateEmbedding, isEmbeddingsEnabled } from '../services/embeddings.js';
import { queryVectors, isPineconeEnabled, type QueryResult } from '../services/pinecone.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/requireAuth.js';

export const chatRouter = Router();

// All chat routes require authentication
chatRouter.use(requireAuth);

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

interface ImageData {
  base64: string;
  mimeType: string;
  name: string;
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

interface OpenAICompatibleRequestParams {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  systemPrompt?: string;
}

type LLMProvider = 'claude' | 'openai' | 'gemini' | 'xai' | 'groq' | 'perplexity';

interface ChatRequest {
  prompt: string;
  images?: ImageData[];
  enabledProviders?: LLMProvider[];
  claude?: ClaudeRequestParams;
  openai?: OpenAIRequestParams;
  gemini?: GeminiRequestParams;
  xai?: OpenAICompatibleRequestParams;
  groq?: OpenAICompatibleRequestParams;
  perplexity?: OpenAICompatibleRequestParams;
  history?: Record<string, Message[]>;
  useRag?: boolean;
  ragTopK?: number;
  ragCollectionId?: string;
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

interface StreamResult {
  type: 'chunk' | 'usage';
  data: string | TokenUsage;
}

// Provider dispatch: maps provider key to query/stream functions
type ProviderQueryFn = (params: any) => Promise<ServiceResponse>;
type ProviderStreamFn = (params: any) => AsyncGenerator<StreamResult, void, unknown>;

interface ProviderDispatch {
  query: ProviderQueryFn;
  stream: ProviderStreamFn;
}

const PROVIDER_DISPATCH: Record<LLMProvider, ProviderDispatch> = {
  claude: { query: queryClaude, stream: streamClaude },
  openai: { query: queryChatGPT, stream: streamChatGPT },
  gemini: { query: queryGemini, stream: streamGemini },
  xai: { query: xaiProvider.query, stream: xaiProvider.stream },
  groq: { query: groqProvider.query, stream: groqProvider.stream },
  perplexity: { query: perplexityProvider.query, stream: perplexityProvider.stream },
};

const DEFAULT_ENABLED: LLMProvider[] = ['claude', 'openai', 'gemini'];

chatRouter.post('/', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.userId;
  const {
    prompt,
    enabledProviders = DEFAULT_ENABLED,
    claude = {}, openai = {}, gemini = {},
    xai = {}, groq = {}, perplexity = {},
    history,
    useRag = false, ragTopK = 5, ragCollectionId,
  } = req.body as ChatRequest;

  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  // Get RAG context if enabled (user-scoped)
  let ragContext = '';
  let ragResults: QueryResult[] = [];
  if (useRag && isPineconeEnabled() && isEmbeddingsEnabled()) {
    try {
      const queryEmbedding = await generateEmbedding(prompt);
      ragResults = await queryVectors(userId, queryEmbedding, ragTopK, ragCollectionId);
      ragContext = buildRagContext(ragResults);
    } catch (error) {
      console.error('RAG query error:', error);
    }
  }

  const augmentedPrompt = injectRagContext(prompt, ragContext);

  const providerParams: Record<string, any> = { claude, openai, gemini, xai, groq, perplexity };

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

  // Run all enabled providers in parallel
  const results: Record<string, LLMResponse> = {};
  const promises = enabledProviders.map(async (provider) => {
    const dispatch = PROVIDER_DISPATCH[provider];
    if (!dispatch) return;
    const params = providerParams[provider] || {};
    results[provider] = await executeWithTiming(
      () => dispatch.query({ prompt: augmentedPrompt, ...params, messages: history?.[provider] })
    );
  });

  await Promise.all(promises);

  // Fill in empty responses for disabled providers
  const allProviders: LLMProvider[] = ['claude', 'openai', 'gemini', 'xai', 'groq', 'perplexity'];
  for (const p of allProviders) {
    if (!results[p]) {
      results[p] = { response: null, error: null, duration: 0 };
    }
  }

  res.json({
    ...results,
    ragContext: useRag ? ragResults : undefined,
  });
});

// Streaming endpoint using Server-Sent Events
chatRouter.post('/stream', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.userId;
  const {
    prompt, images,
    enabledProviders = DEFAULT_ENABLED,
    claude = {}, openai = {}, gemini = {},
    xai = {}, groq = {}, perplexity = {},
    history,
    useRag = false, ragTopK = 5, ragCollectionId,
  } = req.body as ChatRequest;

  if (!prompt && (!images || images.length === 0)) {
    res.status(400).json({ error: 'Prompt or images are required' });
    return;
  }

  // Get RAG context if enabled (user-scoped)
  let ragContext = '';
  let ragResults: QueryResult[] = [];
  if (useRag && isPineconeEnabled() && isEmbeddingsEnabled()) {
    try {
      const queryEmbedding = await generateEmbedding(prompt);
      ragResults = await queryVectors(userId, queryEmbedding, ragTopK, ragCollectionId);
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

  const sendEvent = (provider: string, type: 'chunk' | 'done' | 'error' | 'usage', data: string | TokenUsage) => {
    res.write(`data: ${JSON.stringify({ provider, type, data })}\n\n`);
  };

  const providerParams: Record<string, any> = { claude, openai, gemini, xai, groq, perplexity };

  // Stream from all enabled providers concurrently
  const streamProvider = async (name: string) => {
    const dispatch = PROVIDER_DISPATCH[name as LLMProvider];
    if (!dispatch) return;
    const params = providerParams[name] || {};
    const startTime = Date.now();
    try {
      for await (const result of dispatch.stream({
        prompt: augmentedPrompt,
        images: (name === 'claude' || name === 'openai' || name === 'gemini') ? images : undefined,
        ...params,
        messages: history?.[name],
      })) {
        if (result.type === 'chunk') {
          sendEvent(name, 'chunk', result.data as string);
        } else if (result.type === 'usage') {
          sendEvent(name, 'usage', result.data as TokenUsage);
        }
      }
      const duration = Date.now() - startTime;
      sendEvent(name, 'done', String(duration));
    } catch (error) {
      const err = error as Error;
      sendEvent(name, 'error', err.message);
    }
  };

  await Promise.all(enabledProviders.map(p => streamProvider(p)));

  res.write('data: [DONE]\n\n');
  res.end();
});
