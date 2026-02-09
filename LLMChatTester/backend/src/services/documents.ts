import { extractText as extractPdfText } from 'unpdf';
import mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Registry paths
const REGISTRY_PATH = path.join(__dirname, '../../data/documents.json');
const COLLECTIONS_PATH = path.join(__dirname, '../../data/collections.json');

// Default collection for backwards compatibility
export const DEFAULT_COLLECTION_ID = 'default';

export interface Collection {
  id: string;
  name: string;
  createdAt: number;
}

export interface DocumentInfo {
  id: string;
  collectionId: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  chunkCount: number;
  uploadedAt: number;
}

export interface TextChunk {
  text: string;
  chunkIndex: number;
}

// Chunking configuration
const CHUNK_SIZE = 1000; // characters
const CHUNK_OVERLAP = 200; // characters

export async function extractText(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  const ext = path.extname(filename).toLowerCase();

  if (mimeType === 'application/pdf' || ext === '.pdf') {
    const { text } = await extractPdfText(buffer);
    return text;
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown' ||
    ext === '.txt' ||
    ext === '.md'
  ) {
    return buffer.toString('utf-8');
  }

  throw new Error(`Unsupported file type: ${mimeType || ext}`);
}

export function chunkText(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];

  // Clean the text
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleanedText.length <= CHUNK_SIZE) {
    return [{ text: cleanedText, chunkIndex: 0 }];
  }

  let start = 0;
  let chunkIndex = 0;

  while (start < cleanedText.length) {
    let end = start + CHUNK_SIZE;

    // Don't cut in the middle of a word
    if (end < cleanedText.length) {
      // Try to find a good break point (sentence end, paragraph, or space)
      const searchStart = Math.max(start + CHUNK_SIZE - 100, start);
      const searchText = cleanedText.slice(searchStart, end + 50);

      // Prefer paragraph breaks
      const paragraphBreak = searchText.lastIndexOf('\n\n');
      if (paragraphBreak > 50) {
        end = searchStart + paragraphBreak + 2;
      } else {
        // Try sentence end
        const sentenceEnd = searchText.search(/[.!?]\s/);
        if (sentenceEnd > 50) {
          end = searchStart + sentenceEnd + 2;
        } else {
          // Fall back to space
          const spaceIndex = searchText.lastIndexOf(' ');
          if (spaceIndex > 50) {
            end = searchStart + spaceIndex + 1;
          }
        }
      }
    }

    const chunkText = cleanedText.slice(start, end).trim();
    if (chunkText.length > 0) {
      chunks.push({ text: chunkText, chunkIndex });
      chunkIndex++;
    }

    // Move start with overlap
    start = end - CHUNK_OVERLAP;
    if (start >= cleanedText.length - CHUNK_OVERLAP) {
      break;
    }
  }

  return chunks;
}

// Document registry functions
async function ensureDataDir(): Promise<void> {
  const dataDir = path.dirname(REGISTRY_PATH);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

export async function loadDocumentRegistry(): Promise<DocumentInfo[]> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(REGISTRY_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveDocumentRegistry(documents: DocumentInfo[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(documents, null, 2));
}

export async function addDocument(doc: DocumentInfo): Promise<void> {
  const documents = await loadDocumentRegistry();
  documents.push(doc);
  await saveDocumentRegistry(documents);
}

export async function removeDocument(documentId: string): Promise<boolean> {
  const documents = await loadDocumentRegistry();
  const index = documents.findIndex((d) => d.id === documentId);
  if (index === -1) {
    return false;
  }
  documents.splice(index, 1);
  await saveDocumentRegistry(documents);
  return true;
}

export async function getDocument(documentId: string): Promise<DocumentInfo | null> {
  const documents = await loadDocumentRegistry();
  return documents.find((d) => d.id === documentId) || null;
}

export function generateDocumentId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Collection registry functions
export async function loadCollections(): Promise<Collection[]> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(COLLECTIONS_PATH, 'utf-8');
    const collections = JSON.parse(data) as Collection[];
    // Ensure default collection exists
    if (!collections.find(c => c.id === DEFAULT_COLLECTION_ID)) {
      collections.unshift({ id: DEFAULT_COLLECTION_ID, name: 'Default', createdAt: 0 });
    }
    return collections;
  } catch {
    // Return default collection if file doesn't exist
    return [{ id: DEFAULT_COLLECTION_ID, name: 'Default', createdAt: 0 }];
  }
}

export async function saveCollections(collections: Collection[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(COLLECTIONS_PATH, JSON.stringify(collections, null, 2));
}

export async function createCollection(name: string): Promise<Collection> {
  const collections = await loadCollections();
  const newCollection: Collection = {
    id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name,
    createdAt: Date.now(),
  };
  collections.push(newCollection);
  await saveCollections(collections);
  return newCollection;
}

export async function renameCollection(collectionId: string, newName: string): Promise<boolean> {
  if (collectionId === DEFAULT_COLLECTION_ID) {
    return false; // Can't rename default collection
  }
  const collections = await loadCollections();
  const collection = collections.find(c => c.id === collectionId);
  if (!collection) {
    return false;
  }
  collection.name = newName;
  await saveCollections(collections);
  return true;
}

export async function deleteCollection(collectionId: string): Promise<boolean> {
  if (collectionId === DEFAULT_COLLECTION_ID) {
    return false; // Can't delete default collection
  }
  const collections = await loadCollections();
  const index = collections.findIndex(c => c.id === collectionId);
  if (index === -1) {
    return false;
  }
  collections.splice(index, 1);
  await saveCollections(collections);
  return true;
}

export async function getCollection(collectionId: string): Promise<Collection | null> {
  const collections = await loadCollections();
  return collections.find(c => c.id === collectionId) || null;
}

export async function getDocumentsByCollection(collectionId: string): Promise<DocumentInfo[]> {
  const documents = await loadDocumentRegistry();
  return documents.filter(d => d.collectionId === collectionId);
}
