import Anthropic from '@anthropic-ai/sdk';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeParams {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topK?: number;
  topP?: number;
  stopSequences?: string[];
  systemPrompt?: string;
  messages?: Message[];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ClaudeResponse {
  text: string;
  usage: TokenUsage;
}

export async function queryClaude(params: ClaudeParams): Promise<ClaudeResponse> {
  const {
    prompt,
    model = 'claude-sonnet-4-20250514',
    temperature = 0.7,
    maxTokens = 1024,
    topK,
    topP,
    stopSequences,
    systemPrompt,
    messages = [],
  } = params;

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    const allMessages = [
      ...messages,
      { role: 'user' as const, content: prompt },
    ];

    const requestParams: Anthropic.MessageCreateParams = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: allMessages,
    };

    // Add optional parameters
    if (systemPrompt) {
      requestParams.system = systemPrompt;
    }
    if (topK !== undefined) {
      requestParams.top_k = topK;
    }
    if (topP !== undefined) {
      requestParams.top_p = topP;
    }
    if (stopSequences && stopSequences.length > 0) {
      requestParams.stop_sequences = stopSequences;
    }

    const response = await client.messages.create(requestParams);

    const textBlock = response.content.find(block => block.type === 'text');
    return {
      text: textBlock ? textBlock.text : 'No response',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  } catch (error) {
    const err = error as Error;
    throw new Error(`Claude API error: ${err.message}`);
  }
}

export interface StreamResult {
  type: 'chunk' | 'usage';
  data: string | TokenUsage;
}

export async function* streamClaude(params: ClaudeParams): AsyncGenerator<StreamResult, void, unknown> {
  const {
    prompt,
    model = 'claude-sonnet-4-20250514',
    temperature = 0.7,
    maxTokens = 1024,
    topK,
    topP,
    stopSequences,
    systemPrompt,
    messages = [],
  } = params;

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const allMessages = [
    ...messages,
    { role: 'user' as const, content: prompt },
  ];

  const requestParams: Anthropic.MessageStreamParams = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: allMessages,
  };

  // Add optional parameters
  if (systemPrompt) {
    requestParams.system = systemPrompt;
  }
  if (topK !== undefined) {
    requestParams.top_k = topK;
  }
  if (topP !== undefined) {
    requestParams.top_p = topP;
  }
  if (stopSequences && stopSequences.length > 0) {
    requestParams.stop_sequences = stopSequences;
  }

  const stream = client.messages.stream(requestParams);

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield { type: 'chunk', data: event.delta.text };
    }
  }

  // Get final message for usage stats
  const finalMessage = await stream.finalMessage();
  yield {
    type: 'usage',
    data: {
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens,
    },
  };
}
