import { Pinecone, Index } from '@pinecone-database/pinecone';

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

function getIndex(): Index<VectorMetadata> {
  if (!pineconeClient || !indexName) {
    throw new Error('Pinecone not initialized');
  }
  return pineconeClient.index<VectorMetadata>(indexName);
}

export function isPineconeEnabled(): boolean {
  return pineconeClient !== null && indexName !== null;
}

// Get user-specific namespace
export function getUserNamespace(userId: string): string {
  return `user-${userId}`;
}

// Upsert vectors for a specific user
export async function upsertVectors(
  userId: string,
  vectors: { id: string; values: number[]; metadata: VectorMetadata }[]
): Promise<void> {
  const index = getIndex();
  const namespace = getUserNamespace(userId);

  // Pinecone recommends batches of 100
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await index.namespace(namespace).upsert({
      records: batch.map((v) => ({
        id: v.id,
        values: v.values,
        metadata: v.metadata,
      })),
    });
  }
}

// Query vectors for a specific user
export async function queryVectors(
  userId: string,
  queryVector: number[],
  topK: number = 5,
  collectionId?: string
): Promise<QueryResult[]> {
  const index = getIndex();
  const namespace = getUserNamespace(userId);

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

  const results = await index.namespace(namespace).query(queryParams);

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

// Delete vectors by document ID for a specific user
export async function deleteByDocumentId(userId: string, documentId: string): Promise<void> {
  const index = getIndex();
  const namespace = getUserNamespace(userId);

  // Delete all vectors with this documentId
  await index.namespace(namespace).deleteMany({
    filter: { documentId: { $eq: documentId } },
  });
}

// Delete vectors by collection ID for a specific user
export async function deleteByCollectionId(userId: string, collectionId: string): Promise<void> {
  const index = getIndex();
  const namespace = getUserNamespace(userId);

  // Delete all vectors in this collection
  await index.namespace(namespace).deleteMany({
    filter: { collectionId: { $eq: collectionId } },
  });
}

// Delete all vectors for a user (used when deleting account)
export async function deleteUserNamespace(userId: string): Promise<void> {
  const index = getIndex();
  const namespace = getUserNamespace(userId);

  // Delete entire namespace
  await index.namespace(namespace).deleteAll();
}

export async function getIndexStats() {
  const index = getIndex();
  const stats = await index.describeIndexStats();
  return stats;
}
