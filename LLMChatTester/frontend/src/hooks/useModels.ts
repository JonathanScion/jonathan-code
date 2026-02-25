import { useState, useEffect } from 'react';
import type { LLMProvider } from '../types';
import { ALL_PROVIDERS } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

export type ModelOptions = Record<LLMProvider, string[]>;
export type ModelPricing = Record<string, { input: number; output: number }>;

const EMPTY_OPTIONS: ModelOptions = Object.fromEntries(
  ALL_PROVIDERS.map(p => [p, [] as string[]])
) as ModelOptions;

export function useModels() {
  const [modelOptions, setModelOptions] = useState<ModelOptions>(EMPTY_OPTIONS);
  const [pricing, setPricing] = useState<ModelPricing>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/providers/models`)
      .then(res => res.ok ? res.json() : null)
      .then((data: { models: Partial<Record<LLMProvider, string[]>>; pricing: ModelPricing } | null) => {
        if (!data) return;
        if (data.models) {
          const result = { ...EMPTY_OPTIONS };
          for (const key of ALL_PROVIDERS) {
            if (data.models[key] && data.models[key]!.length > 0) {
              result[key] = data.models[key]!;
            }
          }
          setModelOptions(result);
        }
        if (data.pricing) {
          setPricing(data.pricing);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return { modelOptions, pricing, isLoading };
}
