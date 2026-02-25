import OpenAI from 'openai';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ImageData {
  base64: string;
  mimeType: string;
  name: string;
}

export interface OpenAIParams {
  prompt: string;
  images?: ImageData[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  responseFormat?: 'text' | 'json_object';
  seed?: number;
  systemPrompt?: string;
  messages?: Message[];
}

// Build content for multimodal messages
function buildUserContent(prompt: string, images?: ImageData[]): OpenAI.ChatCompletionUserMessageParam['content'] {
  if (!images || images.length === 0) {
    return prompt;
  }

  const content: OpenAI.ChatCompletionContentPart[] = [];

  // Add images first
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
      },
    });
  }

  // Add text prompt
  if (prompt) {
    content.push({
      type: 'text',
      text: prompt,
    });
  }

  return content;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface OpenAIResponse {
  text: string;
  usage: TokenUsage;
}

export interface StreamResult {
  type: 'chunk' | 'usage';
  data: string | TokenUsage;
}

export async function queryChatGPT(params: OpenAIParams): Promise<OpenAIResponse> {
  const {
    prompt,
    images,
    model,
    temperature = 0.7,
    maxTokens = 1024,
    topP,
    frequencyPenalty,
    presencePenalty,
    responseFormat,
    seed,
    systemPrompt,
    messages = [],
  } = params;

  if (!model) throw new Error('OpenAI model not specified');

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    // Build messages array with optional system prompt
    const allMessages: OpenAI.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      allMessages.push({ role: 'system', content: systemPrompt });
    }

    // Add conversation history
    for (const msg of messages) {
      allMessages.push({ role: msg.role, content: msg.content });
    }

    // Add current prompt with optional images
    allMessages.push({ role: 'user', content: buildUserContent(prompt, images) });

    const requestParams: OpenAI.ChatCompletionCreateParams = {
      model,
      temperature,
      max_tokens: maxTokens,
      messages: allMessages,
    };

    // Add optional parameters
    if (topP !== undefined) {
      requestParams.top_p = topP;
    }
    if (frequencyPenalty !== undefined) {
      requestParams.frequency_penalty = frequencyPenalty;
    }
    if (presencePenalty !== undefined) {
      requestParams.presence_penalty = presencePenalty;
    }
    if (responseFormat === 'json_object') {
      requestParams.response_format = { type: 'json_object' };
    }
    if (seed !== undefined) {
      requestParams.seed = seed;
    }

    const response = await client.chat.completions.create(requestParams);

    return {
      text: response.choices[0]?.message?.content || 'No response',
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      },
    };
  } catch (error) {
    const err = error as Error;
    throw new Error(`OpenAI API error: ${err.message}`);
  }
}

export async function* streamChatGPT(params: OpenAIParams): AsyncGenerator<StreamResult, void, unknown> {
  const {
    prompt,
    images,
    model,
    temperature = 0.7,
    maxTokens = 1024,
    topP,
    frequencyPenalty,
    presencePenalty,
    seed,
    systemPrompt,
    messages = [],
  } = params;

  if (!model) throw new Error('OpenAI model not specified');

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Build messages array with optional system prompt
  const allMessages: OpenAI.ChatCompletionMessageParam[] = [];

  if (systemPrompt) {
    allMessages.push({ role: 'system', content: systemPrompt });
  }

  // Add conversation history
  for (const msg of messages) {
    allMessages.push({ role: msg.role, content: msg.content });
  }

  // Add current prompt with optional images
  allMessages.push({ role: 'user', content: buildUserContent(prompt, images) });

  const requestParams: OpenAI.ChatCompletionCreateParams = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: allMessages,
    stream: true,
    stream_options: { include_usage: true },
  };

  // Add optional parameters
  if (topP !== undefined) {
    requestParams.top_p = topP;
  }
  if (frequencyPenalty !== undefined) {
    requestParams.frequency_penalty = frequencyPenalty;
  }
  if (presencePenalty !== undefined) {
    requestParams.presence_penalty = presencePenalty;
  }
  if (seed !== undefined) {
    requestParams.seed = seed;
  }

  const stream = await client.chat.completions.create(requestParams);

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield { type: 'chunk', data: content };
    }
    // Check for usage in final chunk
    if (chunk.usage) {
      yield {
        type: 'usage',
        data: {
          inputTokens: chunk.usage.prompt_tokens || 0,
          outputTokens: chunk.usage.completion_tokens || 0,
        },
      };
    }
  }
}
