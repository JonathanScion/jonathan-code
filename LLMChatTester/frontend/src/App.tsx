import { useState } from 'react';
import { ChatInput } from './components/ChatInput';
import { ParameterControls } from './components/ParameterControls';
import { useChat } from './hooks/useChat';

function App() {
  const { params, setParams, history, isLoading, error, sendPrompt, clearHistory } = useChat();
  const [showParams, setShowParams] = useState(true);

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-100">LLM Chat Tester</h1>
          <div className="flex gap-4">
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                Clear History
              </button>
            )}
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
          {history.length === 0 && !isLoading && (
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
                {/* Claude */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                  <div className="bg-orange-600 px-3 py-2 flex justify-between items-center">
                    <span className="font-semibold text-white text-sm">Claude</span>
                    <span className="text-xs text-white/75">
                      {(turn.responses.claude.duration / 1000).toFixed(2)}s
                    </span>
                  </div>
                  <div className="p-3 text-sm">
                    {turn.responses.claude.error ? (
                      <div className="text-red-400">{turn.responses.claude.error}</div>
                    ) : (
                      <div className="text-gray-200 whitespace-pre-wrap">{turn.responses.claude.response}</div>
                    )}
                  </div>
                </div>

                {/* ChatGPT */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                  <div className="bg-green-600 px-3 py-2 flex justify-between items-center">
                    <span className="font-semibold text-white text-sm">ChatGPT</span>
                    <span className="text-xs text-white/75">
                      {(turn.responses.openai.duration / 1000).toFixed(2)}s
                    </span>
                  </div>
                  <div className="p-3 text-sm">
                    {turn.responses.openai.error ? (
                      <div className="text-red-400">{turn.responses.openai.error}</div>
                    ) : (
                      <div className="text-gray-200 whitespace-pre-wrap">{turn.responses.openai.response}</div>
                    )}
                  </div>
                </div>

                {/* Gemini */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                  <div className="bg-blue-600 px-3 py-2 flex justify-between items-center">
                    <span className="font-semibold text-white text-sm">Gemini</span>
                    <span className="text-xs text-white/75">
                      {(turn.responses.gemini.duration / 1000).toFixed(2)}s
                    </span>
                  </div>
                  <div className="p-3 text-sm">
                    {turn.responses.gemini.error ? (
                      <div className="text-red-400">{turn.responses.gemini.error}</div>
                    ) : (
                      <div className="text-gray-200 whitespace-pre-wrap">{turn.responses.gemini.response}</div>
                    )}
                  </div>
                </div>
              </div>

              {index < history.length - 1 && (
                <hr className="border-gray-700" />
              )}
            </div>
          ))}

          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-3 gap-4">
              {['Claude', 'ChatGPT', 'Gemini'].map((name, i) => (
                <div key={name} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                  <div className={`${['bg-orange-600', 'bg-green-600', 'bg-blue-600'][i]} px-3 py-2`}>
                    <span className="font-semibold text-white text-sm">{name}</span>
                  </div>
                  <div className="p-3 text-sm">
                    <div className="animate-pulse text-gray-400">Thinking...</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput onSubmit={sendPrompt} isLoading={isLoading} />
    </div>
  );
}

export default App;
