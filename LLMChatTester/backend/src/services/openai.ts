import OpenAI from 'openai';

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

export async function queryChatGPT(params: ChatParams): Promise<string> {
  const { prompt, model = 'gpt-4o', temperature = 0.7, maxTokens = 1024, messages = [] } = params;

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    // Build full message history with current prompt
    const allMessages = [
      ...messages,
      { role: 'user' as const, content: prompt },
    ];

    const response = await client.chat.completions.create({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: allMessages,
    });

    return response.choices[0]?.message?.content || 'No response';
  } catch (error) {
    const err = error as Error;
    throw new Error(`OpenAI API error: ${err.message}`);
  }
}
