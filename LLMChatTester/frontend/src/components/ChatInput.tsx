import { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSubmit, isLoading }: ChatInputProps) {
  const [prompt, setPrompt] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (prompt.trim() && !isLoading) {
      onSubmit(prompt.trim());
      setPrompt('');
    }
  };

  return (
    <div className="w-full p-4 bg-gray-800 border-t border-gray-700">
      <div className="max-w-6xl mx-auto flex gap-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your prompt... (Press Enter to send, Shift+Enter for new line)"
          className="flex-1 p-3 bg-gray-700 text-gray-100 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
          rows={3}
          disabled={isLoading}
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading || !prompt.trim()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
