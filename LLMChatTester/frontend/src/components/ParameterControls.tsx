import { useState } from 'react';
import type { ChatParams, ClaudeParams, OpenAIParams, GeminiParams, GeminiSafetyLevel } from '../types';
import { MODEL_OPTIONS, SAFETY_LEVEL_OPTIONS } from '../types';

interface ParameterControlsProps {
  params: ChatParams;
  onParamsChange: (params: ChatParams) => void;
}

interface AccordionProps {
  title: string;
  color: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Accordion({ title, color, isOpen, onToggle, children }: AccordionProps) {
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className={`w-full px-4 py-3 flex justify-between items-center ${color} text-white font-semibold`}
      >
        <span>{title}</span>
        <span className="text-lg">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <div className="p-4 bg-gray-800 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

function InputField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <InputField label={`${label}: ${value}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </InputField>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | undefined;
  min?: number;
  max?: number;
  placeholder?: string;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <InputField label={label}>
      <input
        type="number"
        min={min}
        max={max}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : undefined)}
        className="w-full p-2 bg-gray-700 text-gray-200 rounded border border-gray-600 text-sm"
      />
    </InputField>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <InputField label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 bg-gray-700 text-gray-200 rounded border border-gray-600 text-sm"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </InputField>
  );
}

function TextAreaField({
  label,
  value,
  placeholder,
  rows = 3,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  rows?: number;
  onChange: (v: string) => void;
}) {
  return (
    <InputField label={label}>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 bg-gray-700 text-gray-200 rounded border border-gray-600 text-sm resize-none"
      />
    </InputField>
  );
}

function StopSequencesField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState('');

  const addSequence = () => {
    if (input.trim() && !value.includes(input.trim())) {
      onChange([...value, input.trim()]);
      setInput('');
    }
  };

  const removeSequence = (seq: string) => {
    onChange(value.filter((s) => s !== seq));
  };

  return (
    <InputField label="Stop Sequences">
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            placeholder="Add stop sequence..."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSequence())}
            className="flex-1 p-2 bg-gray-700 text-gray-200 rounded border border-gray-600 text-sm"
          />
          <button
            onClick={addSequence}
            className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
          >
            Add
          </button>
        </div>
        {value.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {value.map((seq) => (
              <span
                key={seq}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-600 rounded text-sm"
              >
                <code>{seq}</code>
                <button
                  onClick={() => removeSequence(seq)}
                  className="text-red-400 hover:text-red-300"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </InputField>
  );
}

export function ParameterControls({ params, onParamsChange }: ParameterControlsProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    system: true,
    claude: false,
    openai: false,
    gemini: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const updateClaude = (updates: Partial<ClaudeParams>) => {
    onParamsChange({
      ...params,
      claude: { ...params.claude, ...updates },
    });
  };

  const updateOpenAI = (updates: Partial<OpenAIParams>) => {
    onParamsChange({
      ...params,
      openai: { ...params.openai, ...updates },
    });
  };

  const updateGemini = (updates: Partial<GeminiParams>) => {
    onParamsChange({
      ...params,
      gemini: { ...params.gemini, ...updates },
    });
  };

  return (
    <div className="p-4 bg-gray-900 border-b border-gray-700">
      <div className="max-w-4xl mx-auto space-y-3">
        <Accordion
          title="System Prompt"
          color="bg-purple-600"
          isOpen={openSections.system}
          onToggle={() => toggleSection('system')}
        >
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={params.useSharedSystemPrompt}
                onChange={(e) => onParamsChange({ ...params, useSharedSystemPrompt: e.target.checked })}
                className="rounded"
              />
              Use shared system prompt for all providers
            </label>
            {params.useSharedSystemPrompt && (
              <TextAreaField
                label="Shared System Prompt"
                value={params.sharedSystemPrompt}
                placeholder="Enter instructions for all AI models..."
                rows={4}
                onChange={(v) => onParamsChange({ ...params, sharedSystemPrompt: v })}
              />
            )}
            {!params.useSharedSystemPrompt && (
              <p className="text-sm text-gray-400 italic">
                Configure individual system prompts in each provider section below.
              </p>
            )}
          </div>
        </Accordion>

        <Accordion
          title="Claude"
          color="bg-orange-600"
          isOpen={openSections.claude}
          onToggle={() => toggleSection('claude')}
        >
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Model"
              value={params.claude.model}
              options={MODEL_OPTIONS.claude}
              onChange={(v) => updateClaude({ model: v })}
            />
            <NumberField
              label="Max Tokens"
              value={params.claude.maxTokens}
              min={1}
              max={8192}
              onChange={(v) => updateClaude({ maxTokens: v ?? 1024 })}
            />
            <SliderField
              label="Temperature"
              value={params.claude.temperature}
              min={0}
              max={1}
              step={0.1}
              onChange={(v) => updateClaude({ temperature: v })}
            />
            <NumberField
              label="Top K"
              value={params.claude.topK}
              min={1}
              placeholder="Default"
              onChange={(v) => updateClaude({ topK: v })}
            />
            <SliderField
              label="Top P"
              value={params.claude.topP ?? 1}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateClaude({ topP: v === 1 ? undefined : v })}
            />
          </div>
          <div className="mt-4">
            <StopSequencesField
              value={params.claude.stopSequences ?? []}
              onChange={(v) => updateClaude({ stopSequences: v })}
            />
          </div>
          {!params.useSharedSystemPrompt && (
            <div className="mt-4">
              <TextAreaField
                label="System Prompt (Claude)"
                value={params.claude.systemPrompt ?? ''}
                placeholder="Claude-specific instructions..."
                onChange={(v) => updateClaude({ systemPrompt: v })}
              />
            </div>
          )}
        </Accordion>

        <Accordion
          title="ChatGPT"
          color="bg-green-600"
          isOpen={openSections.openai}
          onToggle={() => toggleSection('openai')}
        >
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Model"
              value={params.openai.model}
              options={MODEL_OPTIONS.openai}
              onChange={(v) => updateOpenAI({ model: v })}
            />
            <NumberField
              label="Max Tokens"
              value={params.openai.maxTokens}
              min={1}
              max={8192}
              onChange={(v) => updateOpenAI({ maxTokens: v ?? 1024 })}
            />
            <SliderField
              label="Temperature"
              value={params.openai.temperature}
              min={0}
              max={2}
              step={0.1}
              onChange={(v) => updateOpenAI({ temperature: v })}
            />
            <SliderField
              label="Top P"
              value={params.openai.topP ?? 1}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateOpenAI({ topP: v === 1 ? undefined : v })}
            />
            <SliderField
              label="Frequency Penalty"
              value={params.openai.frequencyPenalty ?? 0}
              min={-2}
              max={2}
              step={0.1}
              onChange={(v) => updateOpenAI({ frequencyPenalty: v })}
            />
            <SliderField
              label="Presence Penalty"
              value={params.openai.presencePenalty ?? 0}
              min={-2}
              max={2}
              step={0.1}
              onChange={(v) => updateOpenAI({ presencePenalty: v })}
            />
            <SelectField
              label="Response Format"
              value={params.openai.responseFormat ?? 'text'}
              options={['text', 'json_object']}
              onChange={(v) => updateOpenAI({ responseFormat: v as 'text' | 'json_object' })}
            />
            <NumberField
              label="Seed"
              value={params.openai.seed}
              placeholder="Random"
              onChange={(v) => updateOpenAI({ seed: v })}
            />
          </div>
          {!params.useSharedSystemPrompt && (
            <div className="mt-4">
              <TextAreaField
                label="System Prompt (ChatGPT)"
                value={params.openai.systemPrompt ?? ''}
                placeholder="ChatGPT-specific instructions..."
                onChange={(v) => updateOpenAI({ systemPrompt: v })}
              />
            </div>
          )}
        </Accordion>

        <Accordion
          title="Gemini"
          color="bg-blue-600"
          isOpen={openSections.gemini}
          onToggle={() => toggleSection('gemini')}
        >
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Model"
              value={params.gemini.model}
              options={MODEL_OPTIONS.gemini}
              onChange={(v) => updateGemini({ model: v })}
            />
            <NumberField
              label="Max Tokens"
              value={params.gemini.maxTokens}
              min={1}
              max={8192}
              onChange={(v) => updateGemini({ maxTokens: v ?? 1024 })}
            />
            <SliderField
              label="Temperature"
              value={params.gemini.temperature}
              min={0}
              max={2}
              step={0.1}
              onChange={(v) => updateGemini({ temperature: v })}
            />
            <NumberField
              label="Top K"
              value={params.gemini.topK}
              min={1}
              placeholder="Default"
              onChange={(v) => updateGemini({ topK: v })}
            />
            <SliderField
              label="Top P"
              value={params.gemini.topP ?? 1}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateGemini({ topP: v === 1 ? undefined : v })}
            />
          </div>
          <div className="mt-4">
            <StopSequencesField
              value={params.gemini.stopSequences ?? []}
              onChange={(v) => updateGemini({ stopSequences: v })}
            />
          </div>

          <div className="mt-4">
            <p className="text-xs text-gray-400 mb-2">Safety Settings</p>
            <div className="grid grid-cols-2 gap-3">
              {(['harassment', 'hateSpeech', 'sexuallyExplicit', 'dangerousContent'] as const).map((category) => (
                <SelectField
                  key={category}
                  label={category.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                  value={params.gemini.safetySettings?.[category] ?? 'BLOCK_MEDIUM_AND_ABOVE'}
                  options={SAFETY_LEVEL_OPTIONS}
                  onChange={(v) => updateGemini({
                    safetySettings: {
                      ...params.gemini.safetySettings!,
                      [category]: v as GeminiSafetyLevel,
                    },
                  })}
                />
              ))}
            </div>
          </div>

          {!params.useSharedSystemPrompt && (
            <div className="mt-4">
              <TextAreaField
                label="System Prompt (Gemini)"
                value={params.gemini.systemPrompt ?? ''}
                placeholder="Gemini-specific instructions..."
                onChange={(v) => updateGemini({ systemPrompt: v })}
              />
            </div>
          )}
        </Accordion>
      </div>
    </div>
  );
}
