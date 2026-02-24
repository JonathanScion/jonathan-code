import { useState, useCallback, useRef, useMemo } from 'react';
import type { ChatParams, ChatResponse, ConversationTurn, Message, StreamingState, StreamingStatus, LLMProvider, TurnRatings, ResponseRating, TokenUsage, RagResult, ImageData } from '../types';
import { DEFAULT_PARAMS, DEFAULT_TURN_RATINGS, DEFAULT_RATING, ALL_PROVIDERS, makeProviderRecord } from '../types';

type UsageState = Record<LLMProvider, TokenUsage | undefined>;

const INITIAL_STREAMING_STATE: StreamingState = makeProviderRecord(() => '');
const INITIAL_STREAMING_STATUS: StreamingStatus = makeProviderRecord(() => 'idle' as const);

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

// Helper to get auth headers
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useChat() {
  const [params, setParams] = useState<ChatParams>(DEFAULT_PARAMS);
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<StreamingState>(INITIAL_STREAMING_STATE);
  const [streamingStatus, setStreamingStatus] = useState<StreamingStatus>(INITIAL_STREAMING_STATUS);
  const [isStreaming, setIsStreaming] = useState(false);
  const [useRag, setUseRag] = useState(false);
  const [ragCollectionId, setRagCollectionId] = useState<string | null>(null);
  const [lastRagResults, setLastRagResults] = useState<RagResult[]>([]);
  const durationsRef = useRef<Record<LLMProvider, number>>(makeProviderRecord(() => 0));
  const streamingTextRef = useRef<StreamingState>(INITIAL_STREAMING_STATE);
  const usageRef = useRef<UsageState>(makeProviderRecord(() => undefined));

  // Build message history for each provider
  const buildMessageHistory = useCallback((provider: LLMProvider): Message[] => {
    const messages: Message[] = [];
    for (const turn of history) {
      messages.push({ role: 'user', content: turn.userMessage });
      const response = turn.responses[provider];
      if (response?.response) {
        messages.push({ role: 'assistant', content: response.response });
      }
    }
    return messages;
  }, [history]);

  // Get system prompt for a provider (shared or individual)
  const getSystemPrompt = useCallback((providerPrompt?: string) => {
    if (params.useSharedSystemPrompt && params.sharedSystemPrompt) {
      return params.sharedSystemPrompt;
    }
    return providerPrompt;
  }, [params.useSharedSystemPrompt, params.sharedSystemPrompt]);

  const sendPrompt = useCallback(async (prompt: string) => {
    setIsLoading(true);
    setError(null);

    // Build provider params and history dynamically
    const providerBody: Record<string, any> = {};
    const historyBody: Record<string, Message[]> = {};
    for (const p of params.enabledProviders) {
      const pParams = params[p];
      providerBody[p] = { ...pParams, systemPrompt: getSystemPrompt(pParams.systemPrompt) };
      historyBody[p] = buildMessageHistory(p);
    }

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          prompt,
          enabledProviders: params.enabledProviders,
          ...providerBody,
          history: historyBody,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error: ${res.status}`);
      }

      const data: ChatResponse = await res.json();

      // Add to history
      setHistory(prev => [...prev, {
        userMessage: prompt,
        responses: data,
        timestamp: Date.now(),
      }]);
    } catch (err) {
      const error = err as Error;
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [params, buildMessageHistory, getSystemPrompt]);

  const sendPromptStreaming = useCallback(async (prompt: string, images?: ImageData[]) => {
    setIsStreaming(true);
    setError(null);
    setStreamingText(INITIAL_STREAMING_STATE);
    // Mark enabled providers as streaming, rest idle
    const initStatus = makeProviderRecord(() => 'idle' as const);
    for (const p of params.enabledProviders) {
      (initStatus as any)[p] = 'streaming';
    }
    setStreamingStatus(initStatus);
    setLastRagResults([]);
    streamingTextRef.current = makeProviderRecord(() => '');
    durationsRef.current = makeProviderRecord(() => 0);
    usageRef.current = makeProviderRecord(() => undefined);

    // Build provider params and history dynamically
    const providerBody: Record<string, any> = {};
    const historyBody: Record<string, Message[]> = {};
    for (const p of params.enabledProviders) {
      const pParams = params[p];
      providerBody[p] = { ...pParams, systemPrompt: getSystemPrompt(pParams.systemPrompt) };
      historyBody[p] = buildMessageHistory(p);
    }

    try {
      const res = await fetch(`${API_BASE}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          prompt,
          images,
          enabledProviders: params.enabledProviders,
          ...providerBody,
          history: historyBody,
          useRag,
          ragTopK: 5,
          ragCollectionId,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              // Handle RAG results
              if (parsed.type === 'rag') {
                setLastRagResults(parsed.data as RagResult[]);
                continue;
              }

              const { provider, type, data: content } = parsed as {
                provider: LLMProvider;
                type: 'chunk' | 'done' | 'error' | 'usage';
                data: string | TokenUsage;
              };

              if (type === 'chunk') {
                streamingTextRef.current = {
                  ...streamingTextRef.current,
                  [provider]: streamingTextRef.current[provider] + (content as string),
                };
                setStreamingText({ ...streamingTextRef.current });
              } else if (type === 'usage') {
                usageRef.current[provider] = content as TokenUsage;
              } else if (type === 'done') {
                durationsRef.current[provider] = parseInt(content as string, 10);
                setStreamingStatus(prev => ({ ...prev, [provider]: 'done' }));
              } else if (type === 'error') {
                setStreamingStatus(prev => ({ ...prev, [provider]: 'error' }));
                streamingTextRef.current = {
                  ...streamingTextRef.current,
                  [provider]: `Error: ${content as string}`,
                };
                setStreamingText({ ...streamingTextRef.current });
              }
            } catch {
              // Ignore parse errors for malformed chunks
            }
          }
        }
      }

      // Build finalResponses dynamically for all providers
      const finalResponses = {} as ChatResponse;
      for (const p of ALL_PROVIDERS) {
        finalResponses[p] = {
          response: streamingTextRef.current[p] || null,
          error: null,
          duration: durationsRef.current[p],
          usage: usageRef.current[p],
        };
      }

      setHistory(prev => [...prev, {
        userMessage: prompt,
        images,
        responses: finalResponses,
        timestamp: Date.now(),
      }]);

    } catch (err) {
      const error = err as Error;
      setError(error.message);
    } finally {
      setIsStreaming(false);
      setStreamingText(INITIAL_STREAMING_STATE);
      setStreamingStatus(INITIAL_STREAMING_STATUS);
    }
  }, [params, buildMessageHistory, getSystemPrompt, useRag, ragCollectionId]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  // Update rating for a specific turn and provider
  const updateRating = useCallback((
    turnIndex: number,
    provider: LLMProvider,
    rating: ResponseRating
  ) => {
    setHistory(prev => {
      const newHistory = [...prev];
      const turn = newHistory[turnIndex];
      if (!turn) return prev;

      // Initialize ratings if not present
      const currentRatings = turn.ratings || { ...DEFAULT_TURN_RATINGS };

      // If setting this as winner, clear other winners for this turn
      let updatedRatings: TurnRatings;
      if (rating.isWinner) {
        updatedRatings = makeProviderRecord(() => ({ ...DEFAULT_RATING }));
        for (const p of ALL_PROVIDERS) {
          updatedRatings[p] = { ...currentRatings[p], isWinner: p === provider && rating.isWinner };
        }
        updatedRatings[provider] = rating;
      } else {
        updatedRatings = {
          ...currentRatings,
          [provider]: rating,
        };
      }

      newHistory[turnIndex] = {
        ...turn,
        ratings: updatedRatings,
      };

      return newHistory;
    });
  }, []);

  // Calculate rating stats from history
  const ratingStats = useMemo(() => {
    const stats = makeProviderRecord(() => ({ wins: 0, totalStars: 0, totalRated: 0 }));

    for (const turn of history) {
      if (!turn.ratings) continue;

      for (const provider of ALL_PROVIDERS) {
        const rating = turn.ratings[provider];
        if (!rating) continue;
        if (rating.isWinner) {
          stats[provider].wins++;
        }
        if (rating.stars > 0) {
          stats[provider].totalStars += rating.stars;
          stats[provider].totalRated++;
        }
      }
    }

    const result = makeProviderRecord(() => ({ wins: 0, avgStars: 0, totalRated: 0 }));
    for (const p of ALL_PROVIDERS) {
      result[p] = {
        wins: stats[p].wins,
        avgStars: stats[p].totalRated > 0 ? stats[p].totalStars / stats[p].totalRated : 0,
        totalRated: stats[p].totalRated,
      };
    }
    return result;
  }, [history]);

  return {
    params,
    setParams,
    history,
    isLoading,
    error,
    sendPrompt,
    sendPromptStreaming,
    clearHistory,
    streamingText,
    streamingStatus,
    isStreaming,
    updateRating,
    ratingStats,
    useRag,
    setUseRag,
    ragCollectionId,
    setRagCollectionId,
    lastRagResults,
  };
}
