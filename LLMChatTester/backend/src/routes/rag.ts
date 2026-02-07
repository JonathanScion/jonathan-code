import { Router, Request, Response } from 'express';
import multer from 'multer';
import {
  extractText,
  chunkText,
  loadDocumentRegistry,
  addDocument,
  removeDocument,
  generateDocumentId,
  type DocumentInfo,
} from '../services/documents.js';
import { generateEmbeddings, generateEmbedding, isEmbeddingsEnabled } from '../services/embeddings.js';
import {
  upsertVectors,
  queryVectors,
  deleteByDocumentId,
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

// List all documents
ragRouter.get('/documents', async (_req: Request, res: Response) => {
  try {
    const documents = await loadDocumentRegistry();
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
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
      } as VectorMetadata,
    }));

    // Upsert to Pinecone
    await upsertVectors(vectors);

    // Save document info
    const docInfo: DocumentInfo = {
      id: documentId,
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
    const { query, topK = 5 } = req.body;

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

    // Query Pinecone
    const results = await queryVectors(queryEmbedding, topK);

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
    const { saveDocumentRegistry } = await import('../services/documents.js');
    await saveDocumentRegistry([]);

    res.json({ success: true, message: `Deleted ${documents.length} documents` });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});
