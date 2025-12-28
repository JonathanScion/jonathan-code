import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ChatParams {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function queryChatGPT(params: ChatParams): Promise<string> {
  const { prompt, model = 'gpt-4o', temperature = 0.7, maxTokens = 1024 } = params;

  try {
    const response = await client.chat.completions.create({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.choices[0]?.message?.content || 'No response';
  } catch (error) {
    const err = error as Error;
    throw new Error(`OpenAI API error: ${err.message}`);
  }
}
