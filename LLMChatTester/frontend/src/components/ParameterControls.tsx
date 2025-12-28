import { ChatParams, LLMProvider, MODEL_OPTIONS } from '../types';

interface ParameterControlsProps {
  params: ChatParams;
  onParamsChange: (params: ChatParams) => void;
}

interface ProviderControlsProps {
  provider: LLMProvider;
  label: string;
  color: string;
  params: ChatParams[LLMProvider];
  models: string[];
  onChange: (key: keyof ChatParams[LLMProvider], value: string | number) => void;
}

function ProviderControls({ provider, label, color, params, models, onChange }: ProviderControlsProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className={`font-semibold mb-3 ${color}`}>{label}</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Model</label>
          <select
            value={params.model}
            onChange={(e) => onChange('model', e.target.value)}
            className="w-full p-2 bg-gray-700 text-gray-200 rounded border border-gray-600 text-sm"
          >
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Temperature: {params.temperature.toFixed(1)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={params.temperature}
            onChange={(e) => onChange('temperature', parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Max Tokens</label>
          <input
            type="number"
            min="1"
            max="4096"
            value={params.maxTokens}
            onChange={(e) => onChange('maxTokens', parseInt(e.target.value) || 1024)}
            className="w-full p-2 bg-gray-700 text-gray-200 rounded border border-gray-600 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

export function ParameterControls({ params, onParamsChange }: ParameterControlsProps) {
  const handleChange = (provider: LLMProvider) => (
    key: keyof ChatParams[LLMProvider],
    value: string | number
  ) => {
    onParamsChange({
      ...params,
      [provider]: {
        ...params[provider],
        [key]: value,
      },
    });
  };

  return (
    <div className="p-4 bg-gray-900 border-b border-gray-700">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">API Parameters</h2>
        <div className="grid grid-cols-3 gap-4">
          <ProviderControls
            provider="claude"
            label="Claude"
            color="text-orange-400"
            params={params.claude}
            models={MODEL_OPTIONS.claude}
            onChange={handleChange('claude')}
          />
          <ProviderControls
            provider="openai"
            label="ChatGPT"
            color="text-green-400"
            params={params.openai}
            models={MODEL_OPTIONS.openai}
            onChange={handleChange('openai')}
          />
          <ProviderControls
            provider="gemini"
            label="Gemini"
            color="text-blue-400"
            params={params.gemini}
            models={MODEL_OPTIONS.gemini}
            onChange={handleChange('gemini')}
          />
        </div>
      </div>
    </div>
  );
}
