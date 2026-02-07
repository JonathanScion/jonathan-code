import { useState, useCallback } from 'react';
import type { ChatParams, ChatResponse, ConversationTurn, Message } from '../types';
import { DEFAULT_PARAMS } from '../types';

export function useChat() {
  const [params, setParams] = useState<ChatParams>(DEFAULT_PARAMS);
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build message history for each provider
  const buildMessageHistory = useCallback((provider: 'claude' | 'openai' | 'gemini'): Message[] => {
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
          claude: params.claude,
          openai: params.openai,
          gemini: params.gemini,
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
  }, [params, buildMessageHistory]);

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
    clearHistory,
  };
}
