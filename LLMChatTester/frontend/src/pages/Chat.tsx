import { useState, useEffect, useCallback } from 'react';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../contexts/AuthContext';
import { ParameterControls } from '../components/ParameterControls';
import { PromptTemplates } from '../components/PromptTemplates';
import { DocumentManager } from '../components/DocumentManager';
import { ChatInput } from '../components/ChatInput';
import { RatingControls, RatingStats } from '../components/RatingControls';
import type { LLMProvider, LLMResponse, ResponseRating, RagResult } from '../types';
import { DEFAULT_RATING, calculateCost } from '../types';

// Response panel with streaming support
interface StreamingResponsePanelProps {
  title: string;
  model: string;
  response: LLMResponse | null;
  streamingText: string;
  status: 'idle' | 'streaming' | 'done' | 'error';
  color: string;
  rating?: ResponseRating;
  hasWinner?: boolean;
  onRatingChange?: (rating: ResponseRating) => void;
}

function StreamingResponsePanel({
  title,
  model,
  response,
  streamingText,
  status,
  color,
  rating,
  hasWinner,
  onRatingChange,
}: StreamingResponsePanelProps) {
  const [copied, setCopied] = useState(false);

  const displayText = status === 'streaming' ? streamingText : response?.response || '';
  const isError = status === 'error' || response?.error;
  const errorText = response?.error || (status === 'error' ? streamingText : '');

  const handleCopy = async () => {
    if (displayText) {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const cost = response?.usage ? calculateCost(model, response.usage) : 0;

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className={`px-4 py-3 ${color} font-semibold text-white flex justify-between items-center`}>
        <span>{title}</span>
        <div className="flex items-center gap-3 text-xs opacity-75">
          {response?.usage && (
            <span title={`Input: ${response.usage.inputTokens}, Output: ${response.usage.outputTokens}`}>
              {response.usage.inputTokens + response.usage.outputTokens} tokens
              {cost > 0 && ` ($${cost.toFixed(4)})`}
            </span>
          )}
          {response?.duration && (
            <span>{(response.duration / 1000).toFixed(2)}s</span>
          )}
          {status === 'streaming' && (
            <span className="animate-pulse">Streaming...</span>
          )}
        </div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto relative group">
        {status === 'idle' && !response ? (
          <div className="text-gray-500 italic">Response will appear here...</div>
        ) : isError ? (
          <div className="text-red-400 whitespace-pre-wrap">{errorText}</div>
        ) : (
          <>
            <div className="text-gray-200 whitespace-pre-wrap">{displayText}</div>
            {displayText && (
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-600"
                title="Copy to clipboard"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
          </>
        )}
      </div>
      {onRatingChange && rating && response?.response && (
        <div className="px-4 pb-3">
          <RatingControls
            rating={rating}
            isWinnerDisabled={hasWinner && !rating.isWinner}
            onRatingChange={onRatingChange}
          />
        </div>
      )}
    </div>
  );
}

// RAG Results display
function RagResultsDisplay({ results }: { results: RagResult[] }) {
  const [expanded, setExpanded] = useState(false);

  if (results.length === 0) return null;

  return (
    <div className="mb-4 p-3 bg-gray-750 rounded border border-gray-600">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
      >
        <span className="text-blue-400">RAG Context</span>
        <span className="text-xs text-gray-500">({results.length} chunks retrieved)</span>
        <span className="text-xs">{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
          {results.map((result, idx) => (
            <div key={result.id} className="p-2 bg-gray-700 rounded text-xs">
              <div className="flex justify-between text-gray-400 mb-1">
                <span>{result.documentName}</span>
                <span>Score: {result.score.toFixed(3)}</span>
              </div>
              <div className="text-gray-300 line-clamp-3">{result.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// User menu dropdown
function UserMenu() {
  const { user, logout, deleteAccount } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? All your data will be permanently removed.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAccount();
    } catch (err) {
      alert('Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-gray-700 transition-colors"
      >
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs">
            {user?.name?.[0] || user?.email?.[0] || '?'}
          </div>
        )}
        <span className="text-sm text-gray-300 hidden sm:inline">{user?.name || user?.email}</span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20">
            <div className="px-4 py-3 border-b border-gray-700">
              <div className="text-sm font-medium text-gray-200">{user?.name}</div>
              <div className="text-xs text-gray-400 truncate">{user?.email}</div>
            </div>
            <div className="py-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Sign out
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete account'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Chat() {
  const {
    params,
    setParams,
    history,
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
    ragCollectionId,
    setRagCollectionId,
    lastRagResults,
  } = useChat();

  const [prompt, setPrompt] = useState('');
  const [showParams, setShowParams] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K = Clear history
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (confirm('Clear conversation history?')) {
          clearHistory();
        }
      }
      // Ctrl/Cmd + P = Toggle parameters
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setShowParams((prev) => !prev);
      }
      // Escape = Clear input
      if (e.key === 'Escape') {
        setPrompt('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearHistory]);

  // Theme toggle effect
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const handleSend = useCallback((text: string, images?: { base64: string; mimeType: string; name: string }[]) => {
    if (text.trim() || (images && images.length > 0)) {
      sendPromptStreaming(text, images);
    }
  }, [sendPromptStreaming]);

  const handleRagStatusChange = useCallback((enabled: boolean) => {
    setRagEnabled(enabled);
  }, []);

  const handleCollectionChange = useCallback((collectionId: string | null) => {
    setRagCollectionId(collectionId);
  }, [setRagCollectionId]);

  const handleTemplateSelect = useCallback((templatePrompt: string) => {
    setPrompt(templatePrompt);
  }, []);

  // Check if any turn has a winner
  const getTurnHasWinner = (turnIndex: number): boolean => {
    const turn = history[turnIndex];
    if (!turn?.ratings) return false;
    return turn.ratings.claude.isWinner || turn.ratings.openai.isWinner || turn.ratings.gemini.isWinner;
  };

  const providers: { key: LLMProvider; title: string; color: string; model: string }[] = [
    { key: 'claude', title: 'Claude', color: 'bg-orange-600', model: params.claude.model },
    { key: 'openai', title: 'ChatGPT', color: 'bg-green-600', model: params.openai.model },
    { key: 'gemini', title: 'Gemini', color: 'bg-blue-600', model: params.gemini.model },
  ];

  return (
    <div className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-100 text-gray-900'}`}>
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">LLM Chat Tester</h1>
            <RatingStats stats={ratingStats} />
          </div>
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-gray-400 hover:text-gray-200 transition-colors"
              title={isDarkMode ? 'Light mode' : 'Dark mode'}
            >
              {isDarkMode ? '🌙' : '☀️'}
            </button>
            {/* Toggle buttons */}
            <button
              onClick={() => setShowParams(!showParams)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                showParams ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Parameters
            </button>
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                showTemplates ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Templates
            </button>
            {ragEnabled && (
              <>
                <button
                  onClick={() => setShowDocuments(!showDocuments)}
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    showDocuments ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Documents
                </button>
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={useRag}
                    onChange={(e) => setUseRag(e.target.checked)}
                    className="rounded"
                  />
                  Use RAG
                </label>
              </>
            )}
            <button
              onClick={() => {
                if (confirm('Clear conversation history?')) {
                  clearHistory();
                }
              }}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-500 transition-colors"
            >
              Clear
            </button>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Parameter Controls */}
      {showParams && (
        <ParameterControls params={params} onParamsChange={setParams} />
      )}

      {/* Templates */}
      {showTemplates && (
        <PromptTemplates onSelectTemplate={handleTemplateSelect} currentPrompt={prompt} />
      )}

      {/* Document Manager */}
      {showDocuments && ragEnabled && (
        <DocumentManager
          onRagStatusChange={handleRagStatusChange}
          onCollectionChange={handleCollectionChange}
          selectedCollectionId={ragCollectionId}
        />
      )}

      {/* Check RAG status silently */}
      {!showDocuments && (
        <div className="hidden">
          <DocumentManager onRagStatusChange={handleRagStatusChange} />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Conversation history */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto space-y-6">
            {error && (
              <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
                {error}
              </div>
            )}

            {history.length === 0 && !isStreaming && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg mb-2">Start a conversation with all three LLMs</p>
                <p className="text-sm">Enter a prompt below to compare responses from Claude, ChatGPT, and Gemini</p>
              </div>
            )}

            {history.map((turn, turnIndex) => (
              <div key={turn.timestamp} className="space-y-4">
                {/* User message */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-medium">
                    U
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="text-gray-200 whitespace-pre-wrap">{turn.userMessage}</div>
                      {turn.images && turn.images.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {turn.images.map((img, idx) => (
                            <img
                              key={idx}
                              src={`data:${img.mimeType};base64,${img.base64}`}
                              alt={img.name}
                              className="h-16 w-16 object-cover rounded border border-gray-600"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* RAG results for this turn (if it's the last one and we have results) */}
                {turnIndex === history.length - 1 && lastRagResults.length > 0 && (
                  <RagResultsDisplay results={lastRagResults} />
                )}

                {/* Provider responses */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {providers.map(({ key, title, color, model }) => (
                    <StreamingResponsePanel
                      key={key}
                      title={title}
                      model={model}
                      response={turn.responses[key]}
                      streamingText=""
                      status="done"
                      color={color}
                      rating={turn.ratings?.[key] || DEFAULT_RATING}
                      hasWinner={getTurnHasWinner(turnIndex)}
                      onRatingChange={(rating) => updateRating(turnIndex, key, rating)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Streaming responses */}
            {isStreaming && (
              <div className="space-y-4">
                {/* Current prompt shown while streaming */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-medium">
                    U
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="text-gray-200 whitespace-pre-wrap animate-pulse">
                        Sending...
                      </div>
                    </div>
                  </div>
                </div>

                {/* RAG results while streaming */}
                {lastRagResults.length > 0 && (
                  <RagResultsDisplay results={lastRagResults} />
                )}

                {/* Streaming panels */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {providers.map(({ key, title, color, model }) => (
                    <StreamingResponsePanel
                      key={key}
                      title={title}
                      model={model}
                      response={null}
                      streamingText={streamingText[key]}
                      status={streamingStatus[key]}
                      color={color}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input area */}
        <ChatInput
          onSubmit={handleSend}
          isLoading={isStreaming}
          value={prompt}
          onChange={setPrompt}
        />
      </main>

      {/* Keyboard shortcuts hint */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 text-center text-xs text-gray-500">
        <span className="hidden sm:inline">
          <kbd className="px-1 bg-gray-700 rounded">Ctrl+K</kbd> Clear history |{' '}
          <kbd className="px-1 bg-gray-700 rounded">Ctrl+P</kbd> Toggle parameters |{' '}
          <kbd className="px-1 bg-gray-700 rounded">Enter</kbd> Send |{' '}
          <kbd className="px-1 bg-gray-700 rounded">Shift+Enter</kbd> New line |{' '}
          <kbd className="px-1 bg-gray-700 rounded">Esc</kbd> Clear input
        </span>
      </div>
    </div>
  );
}
