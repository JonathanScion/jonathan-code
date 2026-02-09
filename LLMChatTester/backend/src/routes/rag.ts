import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { eq, and } from 'drizzle-orm';
import { getDb, collections, documents, isDatabaseEnabled } from '../db/index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/requireAuth.js';
import { extractText, chunkText, generateDocumentId } from '../services/documents.js';
import { generateEmbeddings, generateEmbedding, isEmbeddingsEnabled } from '../services/embeddings.js';
import {
  upsertVectors,
  queryVectors,
  deleteByDocumentId,
  deleteByCollectionId,
  isPineconeEnabled,
  type VectorMetadata,
} from '../services/pinecone.js';
import { saveFile, deleteFile, getFile } from '../services/fileStorage.js';

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
    enabled: isPineconeEnabled() && isEmbeddingsEnabled() && isDatabaseEnabled(),
    pinecone: isPineconeEnabled(),
    embeddings: isEmbeddingsEnabled(),
    database: isDatabaseEnabled(),
  });
});

// All other routes require authentication
ragRouter.use(requireAuth);

// === Collection endpoints ===

// List all collections for the user
ragRouter.get('/collections', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.userId;
    const db = getDb();

    const userCollections = await db.query.collections.findMany({
      where: eq(collections.userId, userId),
      orderBy: (collections, { asc }) => [asc(collections.createdAt)],
    });

    res.json({ collections: userCollections });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Create a collection
ragRouter.post('/collections', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.userId;
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Collection name is required' });
      return;
    }

    const db = getDb();
    const [newCollection] = await db
      .insert(collections)
      .values({
        userId,
        name: name.trim(),
      })
      .returning();

    res.json({ collection: newCollection });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Rename a collection
ragRouter.put('/collections/:id', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.userId;
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Collection name is required' });
      return;
    }

    const db = getDb();
    const result = await db
      .update(collections)
      .set({ name: name.trim() })
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }

    res.json({ success: true, collection: result[0] });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Delete a collection and all its documents
ragRouter.delete('/collections/:id', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.userId;
    const { id } = req.params;

    const db = getDb();

    // Get all documents in this collection to delete their files
    const collectionDocs = await db.query.documents.findMany({
      where: and(eq(documents.collectionId, id), eq(documents.userId, userId)),
    });

    // Delete vectors from Pinecone
    if (isPineconeEnabled()) {
      await deleteByCollectionId(userId, id);
    }

    // Delete files from disk
    for (const doc of collectionDocs) {
      await deleteFile(doc.filePath);
    }

    // Delete collection (cascade will delete documents)
    const result = await db
      .delete(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .returning();

    if (result.length === 0) {
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
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.userId;
    const { collectionId } = req.query;

    const db = getDb();
    let userDocuments;

    if (collectionId && typeof collectionId === 'string') {
      userDocuments = await db.query.documents.findMany({
        where: and(eq(documents.userId, userId), eq(documents.collectionId, collectionId)),
        orderBy: (documents, { desc }) => [desc(documents.uploadedAt)],
      });
    } else {
      userDocuments = await db.query.documents.findMany({
        where: eq(documents.userId, userId),
        orderBy: (documents, { desc }) => [desc(documents.uploadedAt)],
      });
    }

    res.json({ documents: userDocuments });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Upload a document
ragRouter.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.userId;

    if (!isPineconeEnabled() || !isEmbeddingsEnabled()) {
      res.status(503).json({ error: 'RAG services not configured' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const file = req.file;
    const collectionId = req.body.collectionId as string;

    if (!collectionId) {
      res.status(400).json({ error: 'Collection ID is required' });
      return;
    }

    const db = getDb();

    // Verify collection belongs to user
    const collection = await db.query.collections.findFirst({
      where: and(eq(collections.id, collectionId), eq(collections.userId, userId)),
    });

    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }

    // Check document count limit (100 per user)
    const docCount = await db.query.documents.findMany({
      where: eq(documents.userId, userId),
    });
    if (docCount.length >= 100) {
      res.status(400).json({ error: 'Document limit reached (100 documents max)' });
      return;
    }

    const documentId = generateDocumentId();

    // Extract text from document
    const text = await extractText(file.buffer, file.mimetype, file.originalname);

    if (!text.trim()) {
      res.status(400).json({ error: 'Could not extract text from document' });
      return;
    }

    // Save file to disk
    const filePath = await saveFile(userId, documentId, file.buffer, file.originalname);

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

    // Upsert to Pinecone (user-scoped namespace)
    await upsertVectors(userId, vectors);

    // Save document info to database
    const [newDocument] = await db
      .insert(documents)
      .values({
        id: documentId,
        userId,
        collectionId,
        name: file.originalname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        chunkCount: chunks.length,
        filePath,
      })
      .returning();

    res.json({
      success: true,
      document: newDocument,
      message: `Document processed: ${chunks.length} chunks created`,
    });
  } catch (error) {
    const err = error as Error;
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Download a document
ragRouter.get('/documents/:id/download', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.userId;
    const { id } = req.params;

    const db = getDb();
    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, id), eq(documents.userId, userId)),
    });

    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const fileBuffer = await getFile(doc.filePath);
    const ext = path.extname(doc.originalName);

    res.setHeader('Content-Disposition', `attachment; filename="${doc.originalName}"`);
    res.setHeader('Content-Type', doc.mimeType);
    res.send(fileBuffer);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Delete a document
ragRouter.delete('/documents/:id', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.userId;
    const { id } = req.params;

    if (!isPineconeEnabled()) {
      res.status(503).json({ error: 'RAG services not configured' });
      return;
    }

    const db = getDb();

    // Get document
    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, id), eq(documents.userId, userId)),
    });

    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Delete from Pinecone (user-scoped)
    await deleteByDocumentId(userId, id);

    // Delete file from disk
    await deleteFile(doc.filePath);

    // Delete from database
    await db.delete(documents).where(eq(documents.id, id));

    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Query for relevant context
ragRouter.post('/query', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.userId;
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

    // Query Pinecone (user-scoped namespace with optional collection filter)
    const results = await queryVectors(userId, queryEmbedding, topK, collectionId);

    res.json({ results });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});
