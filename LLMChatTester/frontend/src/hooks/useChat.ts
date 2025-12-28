import { useState, useCallback } from 'react';
import { ChatParams, ChatResponse, DEFAULT_PARAMS } from '../types';

export function useChat() {
  const [params, setParams] = useState<ChatParams>(DEFAULT_PARAMS);
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendPrompt = useCallback(async (prompt: string) => {
    setIsLoading(true);
    setError(null);
    setResponse(null);

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
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error: ${res.status}`);
      }

      const data: ChatResponse = await res.json();
      setResponse(data);
    } catch (err) {
      const error = err as Error;
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  return {
    params,
    setParams,
    response,
    isLoading,
    error,
    sendPrompt,
  };
}
