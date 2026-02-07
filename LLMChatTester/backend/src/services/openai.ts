import OpenAI from 'openai';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface OpenAIParams {
  prompt: string;
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

export async function queryChatGPT(params: OpenAIParams): Promise<string> {
  const {
    prompt,
    model = 'gpt-4o',
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
    
    // Add current prompt
    allMessages.push({ role: 'user', content: prompt });

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

    return response.choices[0]?.message?.content || 'No response';
  } catch (error) {
    const err = error as Error;
    throw new Error(`OpenAI API error: ${err.message}`);
  }
}

export async function* streamChatGPT(params: OpenAIParams): AsyncGenerator<string, void, unknown> {
  const {
    prompt,
    model = 'gpt-4o',
    temperature = 0.7,
    maxTokens = 1024,
    topP,
    frequencyPenalty,
    presencePenalty,
    seed,
    systemPrompt,
    messages = [],
  } = params;

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
  
  // Add current prompt
  allMessages.push({ role: 'user', content: prompt });

  const requestParams: OpenAI.ChatCompletionCreateParams = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: allMessages,
    stream: true,
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
      yield content;
    }
  }
}
