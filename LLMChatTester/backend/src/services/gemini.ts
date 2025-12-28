import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ChatParams {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function queryGemini(params: ChatParams): Promise<string> {
  const { prompt, model = 'gemini-1.5-pro', temperature = 0.7, maxTokens = 1024 } = params;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
    const geminiModel = genAI.getGenerativeModel({
      model,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    });

    const result = await geminiModel.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    const err = error as Error;
    throw new Error(`Gemini API error: ${err.message}`);
  }
}
