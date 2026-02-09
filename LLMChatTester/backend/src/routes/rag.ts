import { Router, Request, Response } from 'express';
import multer from 'multer';
import {
  extractText,
  chunkText,
  loadDocumentRegistry,
  saveDocumentRegistry,
  addDocument,
  removeDocument,
  generateDocumentId,
  loadCollections,
  createCollection,
  renameCollection,
  deleteCollection,
  getDocumentsByCollection,
  DEFAULT_COLLECTION_ID,
  type DocumentInfo,
  type Collection,
} from '../services/documents.js';
import { generateEmbeddings, generateEmbedding, isEmbeddingsEnabled } from '../services/embeddings.js';
import {
  upsertVectors,
  queryVectors,
  deleteByDocumentId,
  deleteByCollectionId,
  isPineconeEnabled,
  type VectorMetadata,
} from '../services/pinecone.js';

export const ragRouter = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
    ];
    const allowedExtensions = ['.pdf', '.docx', '.txt', '.md'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// Check if RAG is available
ragRouter.get('/status', (_req: Request, res: Response) => {
  res.json({
    enabled: isPineconeEnabled() && isEmbeddingsEnabled(),
    pinecone: isPineconeEnabled(),
    embeddings: isEmbeddingsEnabled(),
  });
});

// === Collection endpoints ===

// List all collections
ragRouter.get('/collections', async (_req: Request, res: Response) => {
  try {
    const collections = await loadCollections();
    res.json({ collections });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Create a collection
ragRouter.post('/collections', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Collection name is required' });
      return;
    }
    const collection = await createCollection(name.trim());
    res.json({ collection });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Rename a collection
ragRouter.put('/collections/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Collection name is required' });
      return;
    }
    const success = await renameCollection(id, name.trim());
    if (!success) {
      res.status(404).json({ error: 'Collection not found or cannot be renamed' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Delete a collection and all its documents
ragRouter.delete('/collections/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (id === DEFAULT_COLLECTION_ID) {
      res.status(400).json({ error: 'Cannot delete the default collection' });
      return;
    }

    if (isPineconeEnabled()) {
      // Delete all vectors in this collection from Pinecone
      await deleteByCollectionId(id);
    }

    // Remove documents from registry
    const documents = await loadDocumentRegistry();
    const remainingDocs = documents.filter(d => d.collectionId !== id);
    await saveDocumentRegistry(remainingDocs);

    // Delete the collection
    const success = await deleteCollection(id);
    if (!success) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// === Document endpoints ===

// List documents (optionally filtered by collection)
ragRouter.get('/documents', async (req: Request, res: Response) => {
  try {
    const { collectionId } = req.query;
    let documents: DocumentInfo[];

    if (collectionId && typeof collectionId === 'string') {
      documents = await getDocumentsByCollection(collectionId);
    } else {
      documents = await loadDocumentRegistry();
    }
    res.json({ documents });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Upload a document
ragRouter.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!isPineconeEnabled() || !isEmbeddingsEnabled()) {
      res.status(503).json({ error: 'RAG services not configured' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const file = req.file;
    const collectionId = (req.body.collectionId as string) || DEFAULT_COLLECTION_ID;
    const documentId = generateDocumentId();

    // Extract text from document
    const text = await extractText(file.buffer, file.mimetype, file.originalname);

    if (!text.trim()) {
      res.status(400).json({ error: 'Could not extract text from document' });
      return;
    }

    // Chunk the text
    const chunks = chunkText(text);

    // Generate embeddings for all chunks
    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await generateEmbeddings(chunkTexts);

    // Prepare vectors for Pinecone
    const vectors = chunks.map((chunk, idx) => ({
      id: `${documentId}_chunk_${chunk.chunkIndex}`,
      values: embeddings[idx],
      metadata: {
        documentId,
        documentName: file.originalname,
        collectionId,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
      } as VectorMetadata,
    }));

    // Upsert to Pinecone
    await upsertVectors(vectors);

    // Save document info
    const docInfo: DocumentInfo = {
      id: documentId,
      collectionId,
      name: file.originalname,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      chunkCount: chunks.length,
      uploadedAt: Date.now(),
    };
    await addDocument(docInfo);

    res.json({
      success: true,
      document: docInfo,
      message: `Document processed: ${chunks.length} chunks created`,
    });
  } catch (error) {
    const err = error as Error;
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a document
ragRouter.delete('/documents/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isPineconeEnabled()) {
      res.status(503).json({ error: 'RAG services not configured' });
      return;
    }

    // Delete from Pinecone
    await deleteByDocumentId(id);

    // Remove from registry
    const removed = await removeDocument(id);

    if (!removed) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Query for relevant context
ragRouter.post('/query', async (req: Request, res: Response) => {
  try {
    const { query, topK = 5, collectionId } = req.body;

    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    if (!isPineconeEnabled() || !isEmbeddingsEnabled()) {
      res.status(503).json({ error: 'RAG services not configured' });
      return;
    }

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    // Query Pinecone (with optional collection filter)
    const results = await queryVectors(queryEmbedding, topK, collectionId);

    res.json({ results });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Clear all documents
ragRouter.delete('/documents', async (_req: Request, res: Response) => {
  try {
    if (!isPineconeEnabled()) {
      res.status(503).json({ error: 'RAG services not configured' });
      return;
    }

    const documents = await loadDocumentRegistry();

    // Delete all documents from Pinecone
    for (const doc of documents) {
      await deleteByDocumentId(doc.id);
    }

    // Clear registry
    await saveDocumentRegistry([]);

    res.json({ success: true, message: `Deleted ${documents.length} documents` });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});
