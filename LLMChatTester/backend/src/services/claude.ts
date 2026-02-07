import Anthropic from '@anthropic-ai/sdk';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatParams {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  messages?: Message[];
}

export async function queryClaude(params: ChatParams): Promise<string> {
  const { prompt, model = 'claude-sonnet-4-20250514', temperature = 0.7, maxTokens = 1024, messages = [] } = params;

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    // Build full message history with current prompt
    const allMessages = [
      ...messages,
      { role: 'user' as const, content: prompt },
    ];

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: allMessages,
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock ? textBlock.text : 'No response';
  } catch (error) {
    const err = error as Error;
    throw new Error(`Claude API error: ${err.message}`);
  }
}
