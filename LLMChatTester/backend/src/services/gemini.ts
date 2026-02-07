import { GoogleGenerativeAI } from '@google/generative-ai';

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

export async function queryGemini(params: ChatParams): Promise<string> {
  const { prompt, model = 'gemini-2.5-flash', temperature = 0.7, maxTokens = 1024, messages = [] } = params;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
    const geminiModel = genAI.getGenerativeModel({
      model,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    });

    // Convert message history to Gemini format
    const history = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    // Start chat with history and send new message
    const chat = geminiModel.startChat({ history });
    const result = await chat.sendMessage(prompt);
    return result.response.text();
  } catch (error) {
    const err = error as Error;
    throw new Error(`Gemini API error: ${err.message}`);
  }
}
