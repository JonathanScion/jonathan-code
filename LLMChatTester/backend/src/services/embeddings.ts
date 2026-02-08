const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 3072;
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

let apiKey: string | null = null;

export function initEmbeddings() {
  if (!process.env.GOOGLE_AI_API_KEY) {
    console.warn('GOOGLE_AI_API_KEY not set - embeddings will be disabled');
    return;
  }

  apiKey = process.env.GOOGLE_AI_API_KEY;
  console.log(`Embeddings initialized with model: ${EMBEDDING_MODEL}`);
}

export function isEmbeddingsEnabled(): boolean {
  return apiKey !== null;
}

export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!apiKey) {
    throw new Error('Google AI API key not initialized');
  }

  const url = `${API_BASE}/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.embedding.values;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!apiKey) {
    throw new Error('Google AI API key not initialized');
  }

  if (texts.length === 0) {
    return [];
  }

  // Process in parallel for speed
  const embeddings = await Promise.all(
    texts.map(text => generateEmbedding(text))
  );

  return embeddings;
}
