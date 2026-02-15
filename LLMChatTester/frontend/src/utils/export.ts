import JSZip from 'jszip';
import type { ConversationTurn, ChatParams, LLMProvider } from '../types';
import { calculateCost, ALL_PROVIDERS, PROVIDER_INFO, MODEL_PRICING } from '../types';

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

function calculateStats(history: ConversationTurn[], params: ChatParams) {
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
        stats.totalCost += calculateCost(params[provider].model, response.usage);
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

export function exportToJSON(history: ConversationTurn[], params: ChatParams): string {
  const data: ExportData = {
    exportedAt: new Date().toISOString(),
    params,
    history,
    stats: calculateStats(history, params),
  };
  return JSON.stringify(data, null, 2);
}

export function exportToMarkdown(history: ConversationTurn[], params: ChatParams): string {
  const stats = calculateStats(history, params);
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
        const cost = calculateCost(params[provider].model, response.usage);
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

export function downloadJSON(history: ConversationTurn[], params: ChatParams) {
  const content = exportToJSON(history, params);
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  downloadFile(content, `llm-chat-${timestamp}.json`, 'application/json');
}

export function downloadMarkdown(history: ConversationTurn[], params: ChatParams) {
  const content = exportToMarkdown(history, params);
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  downloadFile(content, `llm-chat-${timestamp}.md`, 'text/markdown');
}

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
): string {
  const { provider: winner, hasRatings } = determineWinner(ratingStats, params.enabledProviders);
  const info = PROVIDER_INFO[winner];
  const winnerParams = params[winner];
  const lines: string[] = [];

  lines.push('# Agent Specification');
  lines.push('');

  // Provider section
  lines.push('## Provider');
  lines.push(`- Provider: ${info.name}`);
  lines.push(`- Model: ${winnerParams.model}`);
  lines.push(`- API Key Env Var: ${info.apiKeyEnv}`);
  if (!hasRatings) {
    lines.push(`- *Note: No ratings recorded. Using first enabled provider.*`);
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
  const pricing = MODEL_PRICING[winnerParams.model];
  if (pricing) {
    lines.push('## Cost Estimate');
    lines.push(`- Input: $${pricing.input.toFixed(2)} per 1M tokens`);
    lines.push(`- Output: $${pricing.output.toFixed(2)} per 1M tokens`);
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadAgentSpec(
  params: ChatParams,
  history: ConversationTurn[],
  ratingStats: RatingStatsMap,
  ragInfo?: RagInfo,
) {
  const content = exportAgentSpec(params, history, ratingStats, ragInfo);
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
) {
  const specContent = exportAgentSpec(params, history, ratingStats, ragInfo);

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
