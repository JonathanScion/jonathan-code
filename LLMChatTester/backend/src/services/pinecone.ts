import { Pinecone } from '@pinecone-database/pinecone';

export interface VectorMetadata {
  documentId: string;
  documentName: string;
  collectionId: string;
  chunkIndex: number;
  text: string;
  [key: string]: string | number; // Index signature for RecordMetadata compatibility
}

export interface QueryResult {
  id: string;
  score: number;
  text: string;
  documentName: string;
  documentId: string;
  collectionId: string;
  chunkIndex: number;
}

let pineconeClient: Pinecone | null = null;
let indexName: string | null = null;

export function initPinecone() {
  if (!process.env.PINECONE_API_KEY) {
    console.warn('PINECONE_API_KEY not set - RAG features will be disabled');
    return;
  }

  pineconeClient = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  indexName = process.env.PINECONE_INDEX || 'llm-chat-tester';
  console.log(`Pinecone initialized with index: ${indexName}`);
}

function getIndex() {
  if (!pineconeClient || !indexName) {
    throw new Error('Pinecone not initialized');
  }
  return pineconeClient.index<VectorMetadata>(indexName);
}

export function isPineconeEnabled(): boolean {
  return pineconeClient !== null && indexName !== null;
}

export async function upsertVectors(
  vectors: { id: string; values: number[]; metadata: VectorMetadata }[]
): Promise<void> {
  const index = getIndex();

  // Pinecone recommends batches of 100
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await index.upsert({
      records: batch.map(v => ({
        id: v.id,
        values: v.values,
        metadata: v.metadata,
      })),
    });
  }
}

export async function queryVectors(
  queryVector: number[],
  topK: number = 5,
  collectionId?: string
): Promise<QueryResult[]> {
  const index = getIndex();

  const queryParams: {
    vector: number[];
    topK: number;
    includeMetadata: boolean;
    filter?: Record<string, unknown>;
  } = {
    vector: queryVector,
    topK,
    includeMetadata: true,
  };

  // Filter by collection if specified
  if (collectionId) {
    queryParams.filter = { collectionId: { $eq: collectionId } };
  }

  const results = await index.query(queryParams);

  return (results.matches || []).map((match) => ({
    id: match.id,
    score: match.score || 0,
    text: match.metadata?.text || '',
    documentName: match.metadata?.documentName || '',
    documentId: match.metadata?.documentId || '',
    collectionId: match.metadata?.collectionId || '',
    chunkIndex: match.metadata?.chunkIndex || 0,
  }));
}

export async function deleteByDocumentId(documentId: string): Promise<void> {
  const index = getIndex();

  // Delete all vectors with this documentId
  await index.deleteMany({
    filter: { documentId: { $eq: documentId } },
  });
}

export async function deleteByCollectionId(collectionId: string): Promise<void> {
  const index = getIndex();

  // Delete all vectors in this collection
  await index.deleteMany({
    filter: { collectionId: { $eq: collectionId } },
  });
}

export async function listDocuments(): Promise<{ id: string; name: string; chunkCount: number }[]> {
  const index = getIndex();

  // Pinecone doesn't have a direct "list all" - we need to query with a dummy vector
  // This is a limitation; for a production app, you'd store document metadata separately
  // For now, we'll maintain a local document registry

  // This function will be supplemented by local storage
  return [];
}

export async function getIndexStats() {
  const index = getIndex();
  const stats = await index.describeIndexStats();
  return stats;
}
