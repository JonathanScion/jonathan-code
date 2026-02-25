import JSZip from 'jszip';
import type { ConversationTurn, ChatParams, LLMProvider } from '../types';
import type { ModelPricingMap } from '../types';
import { calculateCost, ALL_PROVIDERS, PROVIDER_INFO } from '../types';

interface ExportData {
  exportedAt: string;
  params: ChatParams;
  history: ConversationTurn[];
  stats: {
    totalTurns: number;
    totalTokens: { input: number; output: number };
    totalCost: number;
    ratings: Record<string, { wins: number; avgStars: number }>;
  };
}

function calculateStats(history: ConversationTurn[], params: ChatParams, pricing: ModelPricingMap = {}) {
  const stats = {
    totalTurns: history.length,
    totalTokens: { input: 0, output: 0 },
    totalCost: 0,
    ratings: {} as Record<string, { wins: number; totalStars: number; count: number }>,
  };

  for (const p of ALL_PROVIDERS) {
    stats.ratings[p] = { wins: 0, totalStars: 0, count: 0 };
  }

  for (const turn of history) {
    for (const provider of ALL_PROVIDERS) {
      const response = turn.responses[provider];
      if (response?.usage) {
        stats.totalTokens.input += response.usage.inputTokens;
        stats.totalTokens.output += response.usage.outputTokens;
        stats.totalCost += calculateCost(params[provider].model, response.usage, pricing);
      }
      if (turn.ratings) {
        const rating = turn.ratings[provider];
        if (rating) {
          if (rating.isWinner) stats.ratings[provider].wins++;
          if (rating.stars > 0) {
            stats.ratings[provider].totalStars += rating.stars;
            stats.ratings[provider].count++;
          }
        }
      }
    }
  }

  const ratingsResult: Record<string, { wins: number; avgStars: number }> = {};
  for (const p of ALL_PROVIDERS) {
    ratingsResult[p] = {
      wins: stats.ratings[p].wins,
      avgStars: stats.ratings[p].count > 0
        ? stats.ratings[p].totalStars / stats.ratings[p].count
        : 0,
    };
  }

  return {
    totalTurns: stats.totalTurns,
    totalTokens: stats.totalTokens,
    totalCost: stats.totalCost,
    ratings: ratingsResult,
  };
}

export function exportToJSON(history: ConversationTurn[], params: ChatParams, pricing: ModelPricingMap = {}): string {
  const data: ExportData = {
    exportedAt: new Date().toISOString(),
    params,
    history,
    stats: calculateStats(history, params, pricing),
  };
  return JSON.stringify(data, null, 2);
}

export function exportToMarkdown(history: ConversationTurn[], params: ChatParams, pricing: ModelPricingMap = {}): string {
  const stats = calculateStats(history, params, pricing);
  const lines: string[] = [];

  // Header
  lines.push('# LLM Chat Tester - Conversation Export');
  lines.push('');
  lines.push(`**Exported:** ${new Date().toLocaleString()}`);
  lines.push('');

  // Summary stats
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total Turns:** ${stats.totalTurns}`);
  lines.push(`- **Total Tokens:** ${stats.totalTokens.input.toLocaleString()} input / ${stats.totalTokens.output.toLocaleString()} output`);
  lines.push(`- **Total Cost:** $${stats.totalCost.toFixed(4)}`);
  lines.push('');

  // Ratings summary - only show providers that had activity
  const activeProviders = ALL_PROVIDERS.filter(p =>
    stats.ratings[p].wins > 0 || stats.ratings[p].avgStars > 0
  );
  if (activeProviders.length > 0) {
    lines.push('### Ratings');
    lines.push('');
    lines.push('| Provider | Wins | Avg Stars |');
    lines.push('|----------|------|-----------|');
    for (const p of activeProviders) {
      const info = PROVIDER_INFO[p];
      lines.push(`| ${info.name} | ${stats.ratings[p].wins} | ${stats.ratings[p].avgStars.toFixed(1)} |`);
    }
    lines.push('');
  }

  // Model configuration
  lines.push('## Configuration');
  lines.push('');
  lines.push('| Provider | Model | Temperature |');
  lines.push('|----------|-------|-------------|');
  for (const p of params.enabledProviders) {
    const info = PROVIDER_INFO[p];
    lines.push(`| ${info.name} | ${params[p].model} | ${params[p].temperature} |`);
  }
  lines.push('');

  if (params.useSharedSystemPrompt && params.sharedSystemPrompt) {
    lines.push('### System Prompt');
    lines.push('');
    lines.push('```');
    lines.push(params.sharedSystemPrompt);
    lines.push('```');
    lines.push('');
  }

  // Conversation
  lines.push('## Conversation');
  lines.push('');

  for (let i = 0; i < history.length; i++) {
    const turn = history[i];
    const turnNum = i + 1;

    lines.push(`### Turn ${turnNum}`);
    lines.push('');
    lines.push('**User:**');
    lines.push('');
    lines.push('> ' + turn.userMessage.split('\n').join('\n> '));
    lines.push('');

    for (const provider of ALL_PROVIDERS) {
      const response = turn.responses[provider];
      if (!response || (!response.response && !response.error && response.duration === 0)) continue;

      const providerName = PROVIDER_INFO[provider].name;
      const rating = turn.ratings?.[provider];
      const isWinner = rating?.isWinner ? ' 🏆' : '';
      const stars = rating?.stars ? ` (${'★'.repeat(rating.stars)}${'☆'.repeat(5 - rating.stars)})` : '';

      lines.push(`#### ${providerName}${isWinner}${stars}`);
      lines.push('');

      if (response.error) {
        lines.push(`*Error: ${response.error}*`);
      } else {
        lines.push(response.response || '*No response*');
      }
      lines.push('');

      // Token/cost info
      if (response.usage) {
        const cost = calculateCost(params[provider].model, response.usage, pricing);
        lines.push(`*${response.usage.inputTokens} in / ${response.usage.outputTokens} out | $${cost.toFixed(4)} | ${(response.duration / 1000).toFixed(2)}s*`);
        lines.push('');
      }

      // Notes
      if (rating?.notes) {
        lines.push(`**Notes:** ${rating.notes}`);
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadJSON(history: ConversationTurn[], params: ChatParams, pricing: ModelPricingMap = {}) {
  const content = exportToJSON(history, params, pricing);
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  downloadFile(content, `llm-chat-${timestamp}.json`, 'application/json');
}

export function downloadMarkdown(history: ConversationTurn[], params: ChatParams, pricing: ModelPricingMap = {}) {
  const content = exportToMarkdown(history, params, pricing);
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  downloadFile(content, `llm-chat-${timestamp}.md`, 'text/markdown');
}

// --- Integration Notes (English-language, LLM-consumable) ---

const PROVIDER_NOTES: Record<LLMProvider, string[]> = {
  claude: [
    'Uses the Anthropic SDK (`@anthropic-ai/sdk`). The API key is auto-detected from the `ANTHROPIC_API_KEY` environment variable.',
    'System prompts are passed as a top-level `system` parameter, not as a message in the conversation history.',
    'Supports streaming via the `messages.stream()` method.',
  ],
  openai: [
    'Uses the OpenAI SDK (`openai`). The API key is auto-detected from the `OPENAI_API_KEY` environment variable.',
    'System prompts are passed as the first message with role `system`.',
    'Supports streaming by setting `stream: true` in the request.',
  ],
  gemini: [
    'Uses Google\'s Generative AI SDK (`@google/generative-ai`), which has a different API pattern from OpenAI.',
    'The API key must be passed to the `GoogleGenerativeAI` constructor; read it from the `GOOGLE_AI_API_KEY` environment variable.',
    'System prompts are set via `systemInstruction` in the model configuration, not as a message.',
    'Gemini 2.5 models are "thinking" models — internal reasoning tokens count against the `maxOutputTokens` budget. Set this value significantly higher than the expected visible output length (e.g., 8192+ instead of 1024).',
    'Supports streaming via `sendMessageStream()`.',
  ],
  xai: [
    'Uses the OpenAI SDK (`openai`) with a custom base URL (`https://api.x.ai/v1`). This is an OpenAI-compatible API.',
    'The API key must be explicitly provided when creating the client (it is not auto-detected). Read it from the `XAI_API_KEY` environment variable.',
    'System prompts are passed as the first message with role `system`, following the OpenAI convention.',
    'Supports streaming by setting `stream: true` in the request.',
  ],
  groq: [
    'Uses the OpenAI SDK (`openai`) with a custom base URL (`https://api.groq.com/openai/v1`). This is an OpenAI-compatible API.',
    'The API key must be explicitly provided when creating the client. Read it from the `GROQ_API_KEY` environment variable.',
    'Groq is optimized for fast inference — expect significantly lower latency than other providers.',
    'System prompts follow the OpenAI convention (first message with role `system`).',
    'Supports streaming by setting `stream: true` in the request.',
  ],
  perplexity: [
    'Uses the OpenAI SDK (`openai`) with a custom base URL (`https://api.perplexity.ai`). This is an OpenAI-compatible API.',
    'The API key must be explicitly provided when creating the client. Read it from the `PERPLEXITY_API_KEY` environment variable.',
    'Perplexity models perform live web searches as part of their response. Responses may include a `citations` array with source URLs — check for this in the API response and surface them to users if applicable.',
    'System prompts follow the OpenAI convention (first message with role `system`).',
    'Supports streaming by setting `stream: true` in the request.',
  ],
};

// --- Agent Spec Export ---

export interface RagInfo {
  collectionName: string;
  documents: { id: string; originalName: string }[];
  topK: number;
}

type RatingStatsMap = Record<LLMProvider, { wins: number; avgStars: number; totalRated: number }>;

function determineWinner(
  ratingStats: RatingStatsMap,
  enabledProviders: LLMProvider[],
): { provider: LLMProvider; hasRatings: boolean } {
  const candidates = enabledProviders.filter(p => ratingStats[p].wins > 0 || ratingStats[p].totalRated > 0);

  if (candidates.length === 0) {
    return { provider: enabledProviders[0], hasRatings: false };
  }

  // Sort by wins desc, then avgStars desc
  candidates.sort((a, b) => {
    const winDiff = ratingStats[b].wins - ratingStats[a].wins;
    if (winDiff !== 0) return winDiff;
    return ratingStats[b].avgStars - ratingStats[a].avgStars;
  });

  return { provider: candidates[0], hasRatings: true };
}

export function exportAgentSpec(
  params: ChatParams,
  history: ConversationTurn[],
  ratingStats: RatingStatsMap,
  ragInfo?: RagInfo,
  pricing: ModelPricingMap = {},
): string {
  const { provider: winner, hasRatings } = determineWinner(ratingStats, params.enabledProviders);
  const info = PROVIDER_INFO[winner];
  const winnerParams = params[winner];
  const lines: string[] = [];

  lines.push('# Agent Specification');
  lines.push('');
  lines.push('## How to Use This Spec');
  lines.push('This spec is an LLM-readable integration brief. It contains everything an AI coding assistant needs to build a working chatbot integration — provider, model, parameters, system prompt, behavioral examples, and provider-specific quirks. Don\'t implement it manually; give it to your LLM assistant and let it generate the right code for your architecture.');
  lines.push('');
  lines.push('**Setup by tool:**');
  lines.push('- **Claude Code:** Save this file in your repo (e.g., `docs/agent-spec.md`) and reference it in your `CLAUDE.md`. Then ask: *"Build a streaming chat endpoint using the provider spec in docs/agent-spec.md."*');
  lines.push('- **Cursor / GitHub Copilot:** Drop this file into your project directory so it\'s part of the codebase context. Reference it in your prompt or let the tool pick it up automatically.');
  lines.push('- **ChatGPT / Claude web:** Paste this file as the first message in a conversation, or add it to a project\'s custom instructions. Then describe your app\'s architecture and ask it to build the integration.');
  lines.push('');
  lines.push('The LLM will combine this spec with its knowledge of your codebase, framework, and current best practices to generate the correct integration code.');
  lines.push('');

  // Provider section
  lines.push('## Provider');
  lines.push(`- Provider: ${info.name}`);
  lines.push(`- Model: \`${winnerParams.model}\``);
  lines.push(`- SDK Package: \`${info.sdkPackage}\``);
  if (info.baseURL) {
    lines.push(`- API Base URL: \`${info.baseURL}\``);
  }
  lines.push(`- API Key Env Var: \`${info.apiKeyEnv}\``);
  lines.push('');

  // Selection Rationale
  lines.push('## Selection Rationale');
  const testedCount = params.enabledProviders.length;
  const turnCount = history.length;
  if (!hasRatings) {
    lines.push(`${testedCount} provider(s) were tested over ${turnCount} conversation turn(s). No ratings were recorded, so the first enabled provider was selected as the default.`);
  } else {
    const winnerStats = ratingStats[winner];
    const runnersUp = params.enabledProviders
      .filter(p => p !== winner)
      .map(p => ({ name: PROVIDER_INFO[p].name, ...ratingStats[p] }))
      .filter(r => r.wins > 0 || r.totalRated > 0);

    lines.push(`${testedCount} providers were compared over ${turnCount} conversation turn(s). **${info.name}** (${winnerParams.model}) was selected with ${winnerStats.wins} win(s) and an average rating of ${winnerStats.avgStars.toFixed(1)}/5 across ${winnerStats.totalRated} rated response(s).`);

    if (runnersUp.length > 0) {
      lines.push('');
      lines.push('Runners-up:');
      for (const r of runnersUp) {
        lines.push(`- ${r.name}: ${r.wins} win(s), ${r.avgStars.toFixed(1)}/5 avg (${r.totalRated} rated)`);
      }
    }
  }
  lines.push('');

  // System prompt
  const systemPrompt = params.useSharedSystemPrompt
    ? params.sharedSystemPrompt
    : winnerParams.systemPrompt;
  if (systemPrompt) {
    lines.push('## System Prompt');
    lines.push('```');
    lines.push(systemPrompt);
    lines.push('```');
    lines.push('');
  }

  // Parameters table
  lines.push('## Parameters');
  lines.push('| Parameter | Value |');
  lines.push('|-----------|-------|');
  lines.push(`| Temperature | ${winnerParams.temperature} |`);
  lines.push(`| Max Tokens | ${winnerParams.maxTokens} |`);

  if ('topP' in winnerParams && winnerParams.topP != null) {
    lines.push(`| Top P | ${winnerParams.topP} |`);
  }
  if ('topK' in winnerParams && winnerParams.topK != null) {
    lines.push(`| Top K | ${winnerParams.topK} |`);
  }
  if ('frequencyPenalty' in winnerParams && (winnerParams as any).frequencyPenalty != null) {
    lines.push(`| Frequency Penalty | ${(winnerParams as any).frequencyPenalty} |`);
  }
  if ('presencePenalty' in winnerParams && (winnerParams as any).presencePenalty != null) {
    lines.push(`| Presence Penalty | ${(winnerParams as any).presencePenalty} |`);
  }
  if ('responseFormat' in winnerParams && (winnerParams as any).responseFormat && (winnerParams as any).responseFormat !== 'text') {
    lines.push(`| Response Format | ${(winnerParams as any).responseFormat} |`);
  }
  if ('stopSequences' in winnerParams && (winnerParams as any).stopSequences?.length > 0) {
    lines.push(`| Stop Sequences | ${(winnerParams as any).stopSequences.join(', ')} |`);
  }
  if ('seed' in winnerParams && (winnerParams as any).seed != null) {
    lines.push(`| Seed | ${(winnerParams as any).seed} |`);
  }
  lines.push('');

  // Integration Notes
  lines.push('## Integration Notes');
  lines.push('This configuration was tested with streaming enabled. Streaming is recommended for responsive user-facing chat experiences.');
  lines.push('');
  const notes_list = PROVIDER_NOTES[winner];
  for (const note of notes_list) {
    lines.push(`- ${note}`);
  }
  lines.push('');

  // RAG Configuration
  if (ragInfo) {
    lines.push('## RAG Configuration');
    lines.push(`- Enabled: Yes`);
    lines.push(`- Collection: ${ragInfo.collectionName}`);
    lines.push(`- Top K: ${ragInfo.topK}`);
    if (ragInfo.documents.length > 0) {
      lines.push(`- Documents: ${ragInfo.documents.map(d => d.originalName).join(', ')}`);
    }
    lines.push('');
  }

  // Example Interactions: find turns where winner got highest stars, take top 5
  const ratedTurns: { turn: ConversationTurn; stars: number }[] = [];
  for (const turn of history) {
    if (!turn.ratings) continue;
    const rating = turn.ratings[winner];
    if (rating && rating.stars > 0 && turn.responses[winner]?.response) {
      ratedTurns.push({ turn, stars: rating.stars });
    }
  }
  ratedTurns.sort((a, b) => b.stars - a.stars);
  const topExamples = ratedTurns.slice(0, 5);

  if (topExamples.length > 0) {
    lines.push('## Example Interactions');
    lines.push('');
    topExamples.forEach((ex, i) => {
      const starStr = '\u2605'.repeat(ex.stars) + '\u2606'.repeat(5 - ex.stars);
      lines.push(`### Example ${i + 1} (${starStr})`);
      lines.push(`**User:** ${ex.turn.userMessage}`);
      lines.push('');
      lines.push(`**Assistant:** ${ex.turn.responses[winner].response}`);
      lines.push('');
    });
  }

  // Notes from ratings
  const notes: string[] = [];
  for (const turn of history) {
    if (!turn.ratings) continue;
    const rating = turn.ratings[winner];
    if (rating?.notes) {
      notes.push(rating.notes);
    }
  }
  if (notes.length > 0) {
    lines.push('## Notes from Testing');
    for (const note of notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }

  // Cost Estimate
  const modelPricing = pricing[winnerParams.model];
  if (modelPricing) {
    lines.push('## Cost Estimate');
    lines.push(`- Input: $${modelPricing.input.toFixed(2)} per 1M tokens`);
    lines.push(`- Output: $${modelPricing.output.toFixed(2)} per 1M tokens`);
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadAgentSpec(
  params: ChatParams,
  history: ConversationTurn[],
  ratingStats: RatingStatsMap,
  ragInfo?: RagInfo,
  pricing: ModelPricingMap = {},
) {
  const content = exportAgentSpec(params, history, ratingStats, ragInfo, pricing);
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  downloadFile(content, `agent-spec-${timestamp}.md`, 'text/markdown');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadAgentSpecZip(
  params: ChatParams,
  history: ConversationTurn[],
  ratingStats: RatingStatsMap,
  ragInfo: RagInfo,
  apiBase: string,
  authHeaders: Record<string, string>,
  pricing: ModelPricingMap = {},
) {
  const specContent = exportAgentSpec(params, history, ratingStats, ragInfo, pricing);

  const zip = new JSZip();
  zip.file('agent-spec.md', specContent);

  // Download each RAG document and add to zip
  const docsFolder = zip.folder('rag-documents');
  if (docsFolder && ragInfo.documents.length > 0) {
    const downloads = ragInfo.documents.map(async (doc) => {
      try {
        const res = await fetch(`${apiBase}/api/rag/documents/${doc.id}/download`, {
          headers: authHeaders,
        });
        if (!res.ok) return;
        const blob = await res.blob();
        docsFolder.file(doc.originalName, blob);
      } catch {
        // Skip documents that fail to download
      }
    });
    await Promise.all(downloads);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  downloadBlob(blob, `agent-spec-${timestamp}.zip`);
}
