import { useState, useCallback, useRef } from 'react';
import type { ChatParams, ChatResponse, ConversationTurn, Message, StreamingState, StreamingStatus, LLMProvider } from '../types';
import { DEFAULT_PARAMS } from '../types';

const INITIAL_STREAMING_STATE: StreamingState = { claude: '', openai: '', gemini: '' };
const INITIAL_STREAMING_STATUS: StreamingStatus = { claude: 'idle', openai: 'idle', gemini: 'idle' };

export function useChat() {
  const [params, setParams] = useState<ChatParams>(DEFAULT_PARAMS);
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<StreamingState>(INITIAL_STREAMING_STATE);
  const [streamingStatus, setStreamingStatus] = useState<StreamingStatus>(INITIAL_STREAMING_STATUS);
  const [isStreaming, setIsStreaming] = useState(false);
  const durationsRef = useRef<Record<LLMProvider, number>>({ claude: 0, openai: 0, gemini: 0 });
  const streamingTextRef = useRef<StreamingState>(INITIAL_STREAMING_STATE);

  // Build message history for each provider
  const buildMessageHistory = useCallback((provider: LLMProvider): Message[] => {
    const messages: Message[] = [];
    for (const turn of history) {
      messages.push({ role: 'user', content: turn.userMessage });
      const response = turn.responses[provider];
      if (response.response) {
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

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          claude: { ...params.claude, systemPrompt: getSystemPrompt(params.claude.systemPrompt) },
          openai: { ...params.openai, systemPrompt: getSystemPrompt(params.openai.systemPrompt) },
          gemini: { ...params.gemini, systemPrompt: getSystemPrompt(params.gemini.systemPrompt) },
          history: {
            claude: buildMessageHistory('claude'),
            openai: buildMessageHistory('openai'),
            gemini: buildMessageHistory('gemini'),
          },
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

  const sendPromptStreaming = useCallback(async (prompt: string) => {
    setIsStreaming(true);
    setError(null);
    setStreamingText(INITIAL_STREAMING_STATE);
    setStreamingStatus({ claude: 'streaming', openai: 'streaming', gemini: 'streaming' });
    streamingTextRef.current = INITIAL_STREAMING_STATE;
    durationsRef.current = { claude: 0, openai: 0, gemini: 0 };

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          claude: { ...params.claude, systemPrompt: getSystemPrompt(params.claude.systemPrompt) },
          openai: { ...params.openai, systemPrompt: getSystemPrompt(params.openai.systemPrompt) },
          gemini: { ...params.gemini, systemPrompt: getSystemPrompt(params.gemini.systemPrompt) },
          history: {
            claude: buildMessageHistory('claude'),
            openai: buildMessageHistory('openai'),
            gemini: buildMessageHistory('gemini'),
          },
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
              const { provider, type, data: content } = parsed as {
                provider: LLMProvider;
                type: 'chunk' | 'done' | 'error';
                data: string;
              };

              if (type === 'chunk') {
                streamingTextRef.current = {
                  ...streamingTextRef.current,
                  [provider]: streamingTextRef.current[provider] + content,
                };
                setStreamingText({ ...streamingTextRef.current });
              } else if (type === 'done') {
                durationsRef.current[provider] = parseInt(content, 10);
                setStreamingStatus(prev => ({ ...prev, [provider]: 'done' }));
              } else if (type === 'error') {
                setStreamingStatus(prev => ({ ...prev, [provider]: 'error' }));
                streamingTextRef.current = {
                  ...streamingTextRef.current,
                  [provider]: `Error: ${content}`,
                };
                setStreamingText({ ...streamingTextRef.current });
              }
            } catch {
              // Ignore parse errors for malformed chunks
            }
          }
        }
      }

      // Add completed responses to history
      const finalResponses: ChatResponse = {
        claude: {
          response: streamingTextRef.current.claude || null,
          error: null,
          duration: durationsRef.current.claude,
        },
        openai: {
          response: streamingTextRef.current.openai || null,
          error: null,
          duration: durationsRef.current.openai,
        },
        gemini: {
          response: streamingTextRef.current.gemini || null,
          error: null,
          duration: durationsRef.current.gemini,
        },
      };

      setHistory(prev => [...prev, {
        userMessage: prompt,
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
  }, [params, buildMessageHistory, getSystemPrompt]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

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
  };
}
