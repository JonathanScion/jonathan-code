import type { ConversationTurn, LLMProvider, ChatParams } from '../types';
import { calculateCost } from '../types';

interface ExportData {
  exportedAt: string;
  params: ChatParams;
  history: ConversationTurn[];
  stats: {
    totalTurns: number;
    totalTokens: { input: number; output: number };
    totalCost: number;
    ratings: {
      claude: { wins: number; avgStars: number };
      openai: { wins: number; avgStars: number };
      gemini: { wins: number; avgStars: number };
    };
  };
}

function calculateStats(history: ConversationTurn[], params: ChatParams) {
  const stats = {
    totalTurns: history.length,
    totalTokens: { input: 0, output: 0 },
    totalCost: 0,
    ratings: {
      claude: { wins: 0, totalStars: 0, count: 0 },
      openai: { wins: 0, totalStars: 0, count: 0 },
      gemini: { wins: 0, totalStars: 0, count: 0 },
    },
  };

  for (const turn of history) {
    for (const provider of ['claude', 'openai', 'gemini'] as LLMProvider[]) {
      const response = turn.responses[provider];
      if (response.usage) {
        stats.totalTokens.input += response.usage.inputTokens;
        stats.totalTokens.output += response.usage.outputTokens;
        stats.totalCost += calculateCost(params[provider].model, response.usage);
      }
      if (turn.ratings) {
        const rating = turn.ratings[provider];
        if (rating.isWinner) stats.ratings[provider].wins++;
        if (rating.stars > 0) {
          stats.ratings[provider].totalStars += rating.stars;
          stats.ratings[provider].count++;
        }
      }
    }
  }

  return {
    totalTurns: stats.totalTurns,
    totalTokens: stats.totalTokens,
    totalCost: stats.totalCost,
    ratings: {
      claude: {
        wins: stats.ratings.claude.wins,
        avgStars: stats.ratings.claude.count > 0
          ? stats.ratings.claude.totalStars / stats.ratings.claude.count
          : 0,
      },
      openai: {
        wins: stats.ratings.openai.wins,
        avgStars: stats.ratings.openai.count > 0
          ? stats.ratings.openai.totalStars / stats.ratings.openai.count
          : 0,
      },
      gemini: {
        wins: stats.ratings.gemini.wins,
        avgStars: stats.ratings.gemini.count > 0
          ? stats.ratings.gemini.totalStars / stats.ratings.gemini.count
          : 0,
      },
    },
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

  // Ratings summary
  if (stats.ratings.claude.wins > 0 || stats.ratings.openai.wins > 0 || stats.ratings.gemini.wins > 0) {
    lines.push('### Ratings');
    lines.push('');
    lines.push('| Provider | Wins | Avg Stars |');
    lines.push('|----------|------|-----------|');
    lines.push(`| Claude | ${stats.ratings.claude.wins} | ${stats.ratings.claude.avgStars.toFixed(1)} |`);
    lines.push(`| ChatGPT | ${stats.ratings.openai.wins} | ${stats.ratings.openai.avgStars.toFixed(1)} |`);
    lines.push(`| Gemini | ${stats.ratings.gemini.wins} | ${stats.ratings.gemini.avgStars.toFixed(1)} |`);
    lines.push('');
  }

  // Model configuration
  lines.push('## Configuration');
  lines.push('');
  lines.push('| Provider | Model | Temperature |');
  lines.push('|----------|-------|-------------|');
  lines.push(`| Claude | ${params.claude.model} | ${params.claude.temperature} |`);
  lines.push(`| ChatGPT | ${params.openai.model} | ${params.openai.temperature} |`);
  lines.push(`| Gemini | ${params.gemini.model} | ${params.gemini.temperature} |`);
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

    for (const provider of ['claude', 'openai', 'gemini'] as LLMProvider[]) {
      const response = turn.responses[provider];
      const providerName = provider === 'openai' ? 'ChatGPT' : provider.charAt(0).toUpperCase() + provider.slice(1);
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
