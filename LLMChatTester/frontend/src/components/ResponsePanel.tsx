import { LLMResponse } from '../types';

interface ResponsePanelProps {
  title: string;
  response: LLMResponse | null;
  isLoading: boolean;
  color: string;
}

export function ResponsePanel({ title, response, isLoading, color }: ResponsePanelProps) {
  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className={`px-4 py-3 ${color} font-semibold text-white flex justify-between items-center`}>
        <span>{title}</span>
        {response && (
          <span className="text-xs opacity-75">
            {(response.duration / 1000).toFixed(2)}s
          </span>
        )}
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-gray-400">Loading...</div>
          </div>
        ) : response ? (
          response.error ? (
            <div className="text-red-400 whitespace-pre-wrap">{response.error}</div>
          ) : (
            <div className="text-gray-200 whitespace-pre-wrap">{response.response}</div>
          )
        ) : (
          <div className="text-gray-500 italic">Response will appear here...</div>
        )}
      </div>
    </div>
  );
}
