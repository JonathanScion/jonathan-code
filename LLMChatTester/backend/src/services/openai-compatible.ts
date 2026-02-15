import OpenAI from 'openai';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

interface ServiceResponse {
  text: string;
  usage: TokenUsage;
}

interface StreamResult {
  type: 'chunk' | 'usage';
  data: string | TokenUsage;
}

interface ProviderQueryParams {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  systemPrompt?: string;
  messages?: Message[];
}

interface ProviderConfig {
  name: string;
  apiKeyEnv: string;
  baseURL: string;
  defaultModel: string;
}

interface ProviderInstance {
  query: (params: ProviderQueryParams) => Promise<ServiceResponse>;
  stream: (params: ProviderQueryParams) => AsyncGenerator<StreamResult, void, unknown>;
}

function createOpenAICompatibleProvider(config: ProviderConfig): ProviderInstance {
  const { name, apiKeyEnv, baseURL, defaultModel } = config;

  async function query(params: ProviderQueryParams): Promise<ServiceResponse> {
    const {
      prompt,
      model = defaultModel,
      temperature = 0.7,
      maxTokens = 1024,
      topP,
      systemPrompt,
      messages = [],
    } = params;

    const apiKey = process.env[apiKeyEnv];
    if (!apiKey) {
      throw new Error(`${name} API key not configured (${apiKeyEnv})`);
    }

    const client = new OpenAI({ apiKey, baseURL });

    const allMessages: OpenAI.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      allMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      allMessages.push({ role: msg.role, content: msg.content });
    }

    allMessages.push({ role: 'user', content: prompt });

    const requestParams: OpenAI.ChatCompletionCreateParams = {
      model,
      temperature,
      max_tokens: maxTokens,
      messages: allMessages,
    };

    if (topP !== undefined) {
      requestParams.top_p = topP;
    }

    const response = await client.chat.completions.create(requestParams);

    let text = response.choices[0]?.message?.content || 'No response';

    // Perplexity: append citations if present
    const citations = (response as any).citations;
    if (citations && Array.isArray(citations) && citations.length > 0) {
      text += '\n\n**Sources:**\n' + citations.map((c: string, i: number) => `[${i + 1}] ${c}`).join('\n');
    }

    return {
      text,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      },
    };
  }

  async function* stream(params: ProviderQueryParams): AsyncGenerator<StreamResult, void, unknown> {
    const {
      prompt,
      model = defaultModel,
      temperature = 0.7,
      maxTokens = 1024,
      topP,
      systemPrompt,
      messages = [],
    } = params;

    const apiKey = process.env[apiKeyEnv];
    if (!apiKey) {
      throw new Error(`${name} API key not configured (${apiKeyEnv})`);
    }

    const client = new OpenAI({ apiKey, baseURL });

    const allMessages: OpenAI.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      allMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      allMessages.push({ role: msg.role, content: msg.content });
    }

    allMessages.push({ role: 'user', content: prompt });

    const requestParams: OpenAI.ChatCompletionCreateParams = {
      model,
      temperature,
      max_tokens: maxTokens,
      messages: allMessages,
      stream: true,
      stream_options: { include_usage: true },
    };

    if (topP !== undefined) {
      requestParams.top_p = topP;
    }

    const streamResponse = await client.chat.completions.create(requestParams);

    for await (const chunk of streamResponse) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield { type: 'chunk', data: content };
      }
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

  return { query, stream };
}

export const xaiProvider = createOpenAICompatibleProvider({
  name: 'xAI (Grok)',
  apiKeyEnv: 'XAI_API_KEY',
  baseURL: 'https://api.x.ai/v1',
  defaultModel: 'grok-3-mini-beta',
});

export const groqProvider = createOpenAICompatibleProvider({
  name: 'Groq (Llama)',
  apiKeyEnv: 'GROQ_API_KEY',
  baseURL: 'https://api.groq.com/openai/v1',
  defaultModel: 'llama-3.3-70b-versatile',
});

export const perplexityProvider = createOpenAICompatibleProvider({
  name: 'Perplexity',
  apiKeyEnv: 'PERPLEXITY_API_KEY',
  baseURL: 'https://api.perplexity.ai',
  defaultModel: 'sonar',
});
