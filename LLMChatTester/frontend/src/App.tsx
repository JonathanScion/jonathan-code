import { useState } from 'react';
import { ChatInput } from './components/ChatInput';
import { ResponsePanel } from './components/ResponsePanel';
import { ParameterControls } from './components/ParameterControls';
import { useChat } from './hooks/useChat';

function App() {
  const { params, setParams, response, isLoading, error, sendPrompt } = useChat();
  const [showParams, setShowParams] = useState(true);

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-100">LLM Chat Tester</h1>
          <button
            onClick={() => setShowParams(!showParams)}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            {showParams ? 'Hide' : 'Show'} Parameters
          </button>
        </div>
      </header>

      {/* Parameters Panel */}
      {showParams && (
        <ParameterControls params={params} onParamsChange={setParams} />
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-700 px-4 py-2">
          <div className="max-w-6xl mx-auto text-red-300 text-sm">
            Error: {error}
          </div>
        </div>
      )}

      {/* Response Panels */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="max-w-6xl mx-auto h-full grid grid-cols-3 gap-4">
          <ResponsePanel
            title="Claude"
            response={response?.claude || null}
            isLoading={isLoading}
            color="bg-orange-600"
          />
          <ResponsePanel
            title="ChatGPT"
            response={response?.openai || null}
            isLoading={isLoading}
            color="bg-green-600"
          />
          <ResponsePanel
            title="Gemini"
            response={response?.gemini || null}
            isLoading={isLoading}
            color="bg-blue-600"
          />
        </div>
      </div>

      {/* Input */}
      <ChatInput onSubmit={sendPrompt} isLoading={isLoading} />
    </div>
  );
}

export default App;
