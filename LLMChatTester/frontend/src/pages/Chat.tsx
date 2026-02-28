import { useState, useEffect, useCallback } from 'react';
import { useChat } from '../hooks/useChat';
import { useAuth, getAuthHeaders } from '../contexts/AuthContext';
import { ParameterControls } from '../components/ParameterControls';
import { PromptTemplates } from '../components/PromptTemplates';
import { DocumentManager } from '../components/DocumentManager';
import { ChatInput } from '../components/ChatInput';
import { RatingControls, RatingStats } from '../components/RatingControls';
import { downloadAgentSpec, downloadAgentSpecZip } from '../utils/export';
import type { RagInfo } from '../utils/export';
import type { LLMProvider, LLMResponse, ResponseRating, RagResult, Collection, DocumentInfo } from '../types';
import type { ModelPricingMap } from '../types';
import { DEFAULT_RATING, calculateCost, ALL_PROVIDERS, PROVIDER_INFO } from '../types';
import { useModels } from '../hooks/useModels';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

// Response panel with streaming support
interface StreamingResponsePanelProps {
  title: string;
  model: string;
  response: LLMResponse | null;
  streamingText: string;
  status: 'idle' | 'streaming' | 'done' | 'error';
  color: string;
  pricing: ModelPricingMap;
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
  pricing,
  rating,
  hasWinner,
  onRatingChange,
}: StreamingResponsePanelProps) {
  const [copied, setCopied] = useState(false);

  const displayText = response?.response || streamingText || '';
  const isError = status === 'error' || response?.error;
  const errorText = response?.error || (status === 'error' ? streamingText : '');

  const handleCopy = async () => {
    if (displayText) {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const cost = response?.usage ? calculateCost(model, response.usage, pricing) : 0;

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
          {results.map((result) => (
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

// Provider Toggle component
function ProviderToggle({
  enabledProviders,
  availableProviders,
  onToggle,
}: {
  enabledProviders: LLMProvider[];
  availableProviders: Record<LLMProvider, boolean>;
  onToggle: (provider: LLMProvider) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
      <span className="text-xs text-gray-400 mr-1">Providers:</span>
      {ALL_PROVIDERS.map((provider) => {
        const info = PROVIDER_INFO[provider];
        const isEnabled = enabledProviders.includes(provider);
        const hasKey = availableProviders[provider];

        return (
          <button
            key={provider}
            onClick={() => hasKey && onToggle(provider)}
            disabled={!hasKey}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              isEnabled
                ? `${info.color} text-white`
                : hasKey
                ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'
            } ${isEnabled ? '' : hasKey ? '' : 'line-through'}`}
            title={hasKey ? (isEnabled ? `Disable ${info.name}` : `Enable ${info.name}`) : `${info.name} (no API key)`}
          >
            {info.name}
            {!hasKey && <span className="ml-1 text-gray-600 no-underline">(no key)</span>}
          </button>
        );
      })}
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

// Export Spec button with dropdown for .md / .zip
function ExportSpecButton({
  disabled,
  ragEnabled,
  ragCollectionId,
  onExportMd,
  onExportZip,
}: {
  disabled: boolean;
  ragEnabled: boolean;
  ragCollectionId: string | null;
  onExportMd: () => void;
  onExportZip: (ragInfo: RagInfo) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportZip = async () => {
    setIsOpen(false);
    setIsExporting(true);
    try {
      // Fetch collection name and documents list
      const headers = getAuthHeaders();
      const collectionId = ragCollectionId;

      if (!collectionId) {
        await onExportZip({ collectionName: 'none', documents: [], topK: 5 });
        return;
      }

      const [collectionsRes, docsRes] = await Promise.all([
        fetch(`${API_BASE}/api/rag/collections`, { headers }),
        fetch(`${API_BASE}/api/rag/documents?collectionId=${collectionId}`, { headers }),
      ]);

      let collectionName = 'unknown';
      if (collectionsRes.ok) {
        const data = await collectionsRes.json();
        const cols: Collection[] = data.collections || data;
        const match = cols.find(c => c.id === collectionId);
        if (match) collectionName = match.name;
      }

      let documents: { id: string; originalName: string }[] = [];
      if (docsRes.ok) {
        const data = await docsRes.json();
        const docs: DocumentInfo[] = data.documents || data;
        documents = docs.map(d => ({ id: d.id, originalName: d.originalName }));
      }

      await onExportZip({ collectionName, documents, topK: 5 });
    } catch {
      // Silently handle errors — zip just won't include docs
      onExportMd();
    } finally {
      setIsExporting(false);
    }
  };

  if (!ragEnabled) {
    // No RAG — simple button, no dropdown
    return (
      <button
        onClick={onExportMd}
        disabled={disabled}
        className={`px-3 py-1.5 text-sm rounded transition-colors ${
          !disabled
            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            : 'bg-gray-800 text-gray-600 cursor-not-allowed'
        }`}
        title="Export winning provider config as agent spec"
      >
        Export Spec
      </button>
    );
  }

  // RAG enabled — dropdown with .md and .zip options
  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        className={`px-3 py-1.5 text-sm rounded transition-colors flex items-center gap-1 ${
          !disabled
            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            : 'bg-gray-800 text-gray-600 cursor-not-allowed'
        }`}
        title="Export winning provider config as agent spec"
      >
        {isExporting ? 'Exporting...' : 'Export Spec'}
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20">
            <button
              onClick={() => { setIsOpen(false); onExportMd(); }}
              className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 rounded-t-lg transition-colors"
            >
              Export .md
              <span className="block text-xs text-gray-500">Agent spec only</span>
            </button>
            <button
              onClick={handleExportZip}
              className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 rounded-b-lg transition-colors"
            >
              Export .zip
              <span className="block text-xs text-gray-500">Agent spec + RAG documents</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Dynamic grid class based on provider count
function getGridClass(count: number): string {
  if (count <= 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-1 lg:grid-cols-2';
  if (count === 3) return 'grid-cols-1 lg:grid-cols-3';
  return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
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

  const { modelOptions, pricing } = useModels();

  // Auto-select first (newest) model for each provider when live list arrives
  useEffect(() => {
    setParams(prev => {
      let changed = false;
      const next = { ...prev };
      for (const provider of ALL_PROVIDERS) {
        const models = modelOptions[provider];
        if (models.length > 0 && (!prev[provider].model || !models.includes(prev[provider].model))) {
          (next as any)[provider] = { ...prev[provider], model: models[0] };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [modelOptions, setParams]);

  const [prompt, setPrompt] = useState('');
  const [showParams, setShowParams] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [availableProviders, setAvailableProviders] = useState<Record<LLMProvider, boolean>>(() => {
    const rec = {} as Record<LLMProvider, boolean>;
    for (const p of ALL_PROVIDERS) rec[p] = true; // assume available until fetched
    return rec;
  });

  // Fetch available providers on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/providers`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setAvailableProviders(data);
      })
      .catch(() => {}); // silently ignore if backend unavailable
  }, []);

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

  const handleProviderToggle = useCallback((provider: LLMProvider) => {
    setParams(prev => {
      const current = prev.enabledProviders;
      const isEnabled = current.includes(provider);
      // Must keep at least 1 provider
      if (isEnabled && current.length <= 1) return prev;
      const next = isEnabled
        ? current.filter(p => p !== provider)
        : [...current, provider];
      return { ...prev, enabledProviders: next };
    });
  }, [setParams]);

  // Check if any turn has a winner
  const getTurnHasWinner = (turnIndex: number): boolean => {
    const turn = history[turnIndex];
    if (!turn?.ratings) return false;
    return ALL_PROVIDERS.some(p => turn.ratings![p]?.isWinner);
  };

  // Build active providers list from enabled + info
  const activeProviders = params.enabledProviders.map(key => ({
    key,
    title: PROVIDER_INFO[key].name,
    color: PROVIDER_INFO[key].color,
    model: params[key].model,
  }));

  const gridClass = getGridClass(activeProviders.length);

  return (
    <div className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-100 text-gray-900'}`}>
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">LLM Chat Tester</h1>
            <RatingStats stats={ratingStats} enabledProviders={params.enabledProviders} />
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
            <ExportSpecButton
              disabled={history.length === 0}
              ragEnabled={ragEnabled && useRag}
              ragCollectionId={ragCollectionId}
              onExportMd={() => downloadAgentSpec(params, history, ratingStats, undefined, pricing)}
              onExportZip={async (ragInfo) => {
                await downloadAgentSpecZip(
                  params, history, ratingStats, ragInfo,
                  API_BASE,
                  { ...getAuthHeaders() },
                  pricing,
                );
              }}
            />
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

      {/* Provider Toggle */}
      <ProviderToggle
        enabledProviders={params.enabledProviders}
        availableProviders={availableProviders}
        onToggle={handleProviderToggle}
      />

      {/* Parameter Controls */}
      {showParams && (
        <ParameterControls params={params} onParamsChange={setParams} modelOptions={modelOptions} />
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
                <p className="text-lg mb-2">Start a conversation with LLMs</p>
                <p className="text-sm">
                  Enter a prompt below to compare responses from{' '}
                  {activeProviders.map(p => p.title).join(', ')}
                </p>
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

                {/* Provider responses - show all that have data */}
                <div className={`grid ${gridClass} gap-4`}>
                  {activeProviders.map(({ key, title, color, model }) => {
                    const resp = turn.responses[key];
                    if (!resp || (!resp.response && !resp.error && resp.duration === 0)) return null;
                    return (
                      <StreamingResponsePanel
                        key={key}
                        title={title}
                        model={model}
                        response={resp}
                        streamingText=""
                        status="done"
                        color={color}
                        pricing={pricing}
                        rating={turn.ratings?.[key] || DEFAULT_RATING}
                        hasWinner={getTurnHasWinner(turnIndex)}
                        onRatingChange={(rating) => updateRating(turnIndex, key, rating)}
                      />
                    );
                  })}
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
                <div className={`grid ${gridClass} gap-4`} style={{ gridAutoRows: 'minmax(200px, auto)' }}>
                  {activeProviders.map(({ key, title, color, model }) => (
                    <StreamingResponsePanel
                      key={key}
                      title={title}
                      model={model}
                      response={null}
                      streamingText={streamingText[key]}
                      status={streamingStatus[key]}
                      color={color}
                      pricing={pricing}
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
