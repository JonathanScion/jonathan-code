import OpenAI from 'openai';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

let openaiClient: OpenAI | null = null;

export function initEmbeddings() {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not set - embeddings will be disabled');
    return;
  }

  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log(`Embeddings initialized with model: ${EMBEDDING_MODEL}`);
}

export function isEmbeddingsEnabled(): boolean {
  return openaiClient !== null;
}

export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized');
  }

  const response = await openaiClient.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });

  return response.data[0].embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized');
  }

  if (texts.length === 0) {
    return [];
  }

  // OpenAI supports batch embedding
  const response = await openaiClient.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });

  // Sort by index to ensure correct order
  const sorted = response.data.sort((a, b) => a.index - b.index);
  return sorted.map((item) => item.embedding);
}
