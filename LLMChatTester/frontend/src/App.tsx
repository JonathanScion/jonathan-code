import { useState } from 'react';
import { ChatInput } from './components/ChatInput';
import { ParameterControls } from './components/ParameterControls';
import { PromptTemplates } from './components/PromptTemplates';
import { DocumentManager } from './components/DocumentManager';
import { RatingControls, RatingStats } from './components/RatingControls';
import { useChat } from './hooks/useChat';
import { downloadJSON, downloadMarkdown } from './utils/export';
import type { LLMProvider } from './types';
import { DEFAULT_RATING, calculateCost } from './types';

const PROVIDER_CONFIG: Record<LLMProvider, { name: string; color: string }> = {
  claude: { name: 'Claude', color: 'bg-orange-600' },
  openai: { name: 'ChatGPT', color: 'bg-green-600' },
  gemini: { name: 'Gemini', color: 'bg-blue-600' },
};

function App() {
  const {
    params,
    setParams,
    history,
    isLoading,
    error,
    sendPromptStreaming,
    clearHistory,
    streamingText,
    streamingStatus,
    isStreaming,
    updateRating,
    ratingStats,
    useRag,
    setUseRag,
    lastRagResults,
  } = useChat();
  const [showParams, setShowParams] = useState(true);
  const [showTemplates, setShowTemplates] = useState(true);
  const [showDocuments, setShowDocuments] = useState(true);
  const [ragAvailable, setRagAvailable] = useState(false);
  const [promptValue, setPromptValue] = useState('');

  const isWorking = isLoading || isStreaming;

  const handleSelectTemplate = (prompt: string) => {
    setPromptValue(prompt);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-gray-100">LLM Chat Tester</h1>
            <RatingStats stats={ratingStats} />
          </div>
          <div className="flex gap-4 items-center">
            {/* RAG Toggle */}
            {ragAvailable && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useRag}
                  onChange={(e) => setUseRag(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-300">RAG</span>
              </label>
            )}
            {history.length > 0 && (
              <>
                <div className="flex gap-2">
                  <button
                    onClick={() => downloadJSON(history, params)}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    title="Export as JSON"
                  >
                    Export JSON
                  </button>
                  <button
                    onClick={() => downloadMarkdown(history, params)}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    title="Export as Markdown"
                  >
                    Export MD
                  </button>
                </div>
                <button
                  onClick={clearHistory}
                  className="text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear History
                </button>
              </>
            )}
            <button
              onClick={() => setShowDocuments(!showDocuments)}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              {showDocuments ? 'Hide' : 'Show'} Documents
            </button>
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              {showTemplates ? 'Hide' : 'Show'} Templates
            </button>
            <button
              onClick={() => setShowParams(!showParams)}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              {showParams ? 'Hide' : 'Show'} Parameters
            </button>
          </div>
        </div>
      </header>

      {/* Parameters Panel */}
      {showParams && (
        <ParameterControls params={params} onParamsChange={setParams} />
      )}

      {/* Prompt Templates */}
      {showTemplates && (
        <PromptTemplates
          onSelectTemplate={handleSelectTemplate}
          currentPrompt={promptValue}
        />
      )}

      {/* Document Manager */}
      {showDocuments && (
        <DocumentManager onRagStatusChange={setRagAvailable} />
      )}

      {/* RAG Context Display */}
      {useRag && lastRagResults.length > 0 && (
        <div className="bg-blue-900/20 border-b border-blue-700/50 px-4 py-2">
          <div className="max-w-7xl mx-auto">
            <div className="text-xs text-blue-300 mb-1">
              Retrieved {lastRagResults.length} relevant chunks:
            </div>
            <div className="flex flex-wrap gap-2">
              {lastRagResults.map((result, idx) => (
                <div
                  key={result.id}
                  className="text-xs px-2 py-1 bg-blue-900/40 rounded text-blue-200"
                  title={result.text}
                >
                  [{idx + 1}] {result.documentName} (score: {result.score.toFixed(3)})
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-700 px-4 py-2">
          <div className="max-w-7xl mx-auto text-red-300 text-sm">
            Error: {error}
          </div>
        </div>
      )}

      {/* Conversation History */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {history.length === 0 && !isWorking && (
            <div className="text-center text-gray-500 py-12">
              Start a conversation by typing a message below
            </div>
          )}

          {history.map((turn, index) => (
            <div key={turn.timestamp} className="space-y-3">
              {/* User Message */}
              <div className="flex justify-end">
                <div className="bg-gray-700 rounded-lg px-4 py-2 max-w-2xl">
                  <div className="text-xs text-gray-400 mb-1">You</div>
                  <div className="text-gray-100 whitespace-pre-wrap">{turn.userMessage}</div>
                </div>
              </div>

              {/* AI Responses */}
              <div className="grid grid-cols-3 gap-4">
                {(['claude', 'openai', 'gemini'] as LLMProvider[]).map((provider) => {
                  const config = PROVIDER_CONFIG[provider];
                  const response = turn.responses[provider];
                  const rating = turn.ratings?.[provider] || DEFAULT_RATING;
                  const hasWinner = turn.ratings
                    ? Object.values(turn.ratings).some((r) => r.isWinner)
                    : false;
                  const isWinnerDisabled = hasWinner && !rating.isWinner;

                  const model = params[provider].model;
                  const cost = calculateCost(model, response.usage);

                  return (
                    <div key={provider} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                      <div className={`${config.color} px-3 py-2`}>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-white text-sm">
                            {config.name}
                            {rating.isWinner && <span className="ml-1">🏆</span>}
                          </span>
                          <span className="text-xs text-white/75">
                            {(response.duration / 1000).toFixed(2)}s
                          </span>
                        </div>
                        {response.usage && (
                          <div className="flex justify-between items-center mt-1 text-xs text-white/60">
                            <span>
                              {response.usage.inputTokens} in / {response.usage.outputTokens} out
                            </span>
                            <span>${cost.toFixed(4)}</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3 text-sm">
                        {response.error ? (
                          <div className="text-red-400">{response.error}</div>
                        ) : (
                          <div className="text-gray-200 whitespace-pre-wrap">{response.response}</div>
                        )}
                        <RatingControls
                          rating={rating}
                          isWinnerDisabled={isWinnerDisabled}
                          onRatingChange={(newRating) => updateRating(index, provider, newRating)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {index < history.length - 1 && (
                <hr className="border-gray-700" />
              )}
            </div>
          ))}

          {/* Streaming State */}
          {isStreaming && (
            <div className="grid grid-cols-3 gap-4">
              {(['claude', 'openai', 'gemini'] as LLMProvider[]).map((provider) => {
                const config = PROVIDER_CONFIG[provider];
                const text = streamingText[provider];
                const status = streamingStatus[provider];
                return (
                  <div key={provider} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                    <div className={`${config.color} px-3 py-2 flex justify-between items-center`}>
                      <span className="font-semibold text-white text-sm">{config.name}</span>
                      {status === 'streaming' && (
                        <span className="text-xs text-white/75 animate-pulse">streaming...</span>
                      )}
                      {status === 'done' && (
                        <span className="text-xs text-white/75">done</span>
                      )}
                    </div>
                    <div className="p-3 text-sm min-h-[60px]">
                      {text ? (
                        <div className="text-gray-200 whitespace-pre-wrap">{text}</div>
                      ) : status === 'streaming' ? (
                        <div className="animate-pulse text-gray-400">Thinking...</div>
                      ) : status === 'error' ? (
                        <div className="text-red-400">Error occurred</div>
                      ) : null}
                      {status === 'streaming' && text && (
                        <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-0.5" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Loading State (for non-streaming) */}
          {isLoading && !isStreaming && (
            <div className="grid grid-cols-3 gap-4">
              {(['claude', 'openai', 'gemini'] as LLMProvider[]).map((provider) => {
                const config = PROVIDER_CONFIG[provider];
                return (
                  <div key={provider} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                    <div className={`${config.color} px-3 py-2`}>
                      <span className="font-semibold text-white text-sm">{config.name}</span>
                    </div>
                    <div className="p-3 text-sm">
                      <div className="animate-pulse text-gray-400">Thinking...</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput
        onSubmit={sendPromptStreaming}
        isLoading={isWorking}
        value={promptValue}
        onChange={setPromptValue}
      />
    </div>
  );
}

export default App;
