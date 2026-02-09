import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, type ModelParams } from '@google/generative-ai';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ImageData {
  base64: string;
  mimeType: string;
  name: string;
}

type SafetyLevel = 'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE';

interface SafetySettings {
  harassment: SafetyLevel;
  hateSpeech: SafetyLevel;
  sexuallyExplicit: SafetyLevel;
  dangerousContent: SafetyLevel;
}

export interface GeminiParams {
  prompt: string;
  images?: ImageData[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topK?: number;
  topP?: number;
  stopSequences?: string[];
  safetySettings?: SafetySettings;
  systemPrompt?: string;
  messages?: Message[];
}

// Build parts array for multimodal messages
function buildMessageParts(prompt: string, images?: ImageData[]) {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  // Add images first
  if (images) {
    for (const img of images) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64,
        },
      });
    }
  }

  // Add text prompt
  if (prompt) {
    parts.push({ text: prompt });
  }

  return parts;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface GeminiResponse {
  text: string;
  usage: TokenUsage;
}

export interface StreamResult {
  type: 'chunk' | 'usage';
  data: string | TokenUsage;
}

function mapSafetyLevel(level: SafetyLevel): HarmBlockThreshold {
  switch (level) {
    case 'BLOCK_NONE':
      return HarmBlockThreshold.BLOCK_NONE;
    case 'BLOCK_ONLY_HIGH':
      return HarmBlockThreshold.BLOCK_ONLY_HIGH;
    case 'BLOCK_MEDIUM_AND_ABOVE':
      return HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE;
    case 'BLOCK_LOW_AND_ABOVE':
      return HarmBlockThreshold.BLOCK_LOW_AND_ABOVE;
    default:
      return HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE;
  }
}

function buildSafetySettings(settings?: SafetySettings) {
  if (!settings) return undefined;
  
  return [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: mapSafetyLevel(settings.harassment),
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: mapSafetyLevel(settings.hateSpeech),
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: mapSafetyLevel(settings.sexuallyExplicit),
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: mapSafetyLevel(settings.dangerousContent),
    },
  ];
}

export async function queryGemini(params: GeminiParams): Promise<GeminiResponse> {
  const {
    prompt,
    images,
    model = 'gemini-2.5-flash',
    temperature = 0.7,
    maxTokens = 1024,
    topK,
    topP,
    stopSequences,
    safetySettings,
    systemPrompt,
    messages = [],
  } = params;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

    const generationConfig: Record<string, unknown> = {
      temperature,
      maxOutputTokens: maxTokens,
    };

    if (topK !== undefined) {
      generationConfig.topK = topK;
    }
    if (topP !== undefined) {
      generationConfig.topP = topP;
    }
    if (stopSequences && stopSequences.length > 0) {
      generationConfig.stopSequences = stopSequences;
    }

    const modelConfig: ModelParams = {
      model,
      generationConfig,
      systemInstruction: systemPrompt,
      safetySettings: buildSafetySettings(safetySettings),
    };

    const geminiModel = genAI.getGenerativeModel(modelConfig);

    // Convert message history to Gemini format
    const history = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    // Start chat with history and send new message
    const chat = geminiModel.startChat({ history });
    const messageParts = buildMessageParts(prompt, images);
    const result = await chat.sendMessage(messageParts);
    const usageMetadata = result.response.usageMetadata;

    return {
      text: result.response.text(),
      usage: {
        inputTokens: usageMetadata?.promptTokenCount || 0,
        outputTokens: usageMetadata?.candidatesTokenCount || 0,
      },
    };
  } catch (error) {
    const err = error as Error;
    throw new Error(`Gemini API error: ${err.message}`);
  }
}

export async function* streamGemini(params: GeminiParams): AsyncGenerator<StreamResult, void, unknown> {
  const {
    prompt,
    images,
    model = 'gemini-2.5-flash',
    temperature = 0.7,
    maxTokens = 1024,
    topK,
    topP,
    stopSequences,
    safetySettings,
    systemPrompt,
    messages = [],
  } = params;

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

  const generationConfig: Record<string, unknown> = {
    temperature,
    maxOutputTokens: maxTokens,
  };

  if (topK !== undefined) {
    generationConfig.topK = topK;
  }
  if (topP !== undefined) {
    generationConfig.topP = topP;
  }
  if (stopSequences && stopSequences.length > 0) {
    generationConfig.stopSequences = stopSequences;
  }

  const modelConfig: ModelParams = {
    model,
    generationConfig,
    systemInstruction: systemPrompt,
    safetySettings: buildSafetySettings(safetySettings),
  };

  const geminiModel = genAI.getGenerativeModel(modelConfig);

  // Convert message history to Gemini format
  const history = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  // Start chat with history and send new message with streaming
  const chat = geminiModel.startChat({ history });
  const messageParts = buildMessageParts(prompt, images);
  const result = await chat.sendMessageStream(messageParts);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield { type: 'chunk', data: text };
    }
  }

  // Get usage from the aggregated response
  const response = await result.response;
  const usageMetadata = response.usageMetadata;
  yield {
    type: 'usage',
    data: {
      inputTokens: usageMetadata?.promptTokenCount || 0,
      outputTokens: usageMetadata?.candidatesTokenCount || 0,
    },
  };
}
