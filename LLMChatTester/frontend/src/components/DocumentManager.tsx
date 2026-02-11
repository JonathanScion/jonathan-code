import { useState, useEffect, useRef } from 'react';
import type { DocumentInfo, RagStatus, Collection } from '../types';

interface DocumentManagerProps {
  onRagStatusChange?: (enabled: boolean) => void;
  onCollectionChange?: (collectionId: string | null) => void;
  selectedCollectionId?: string | null;
}

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

// Helper to get auth headers
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function DocumentManager({ onRagStatusChange, onCollectionChange, selectedCollectionId }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(selectedCollectionId || null);
  const [ragStatus, setRagStatus] = useState<RagStatus | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check RAG status on mount
  useEffect(() => {
    fetchRagStatus();
  }, []);

  // Fetch collections after RAG status is confirmed
  useEffect(() => {
    if (ragStatus?.enabled) {
      fetchCollections();
    }
  }, [ragStatus?.enabled]);

  // Fetch documents when active collection changes
  useEffect(() => {
    if (activeCollectionId) {
      fetchDocuments();
      onCollectionChange?.(activeCollectionId);
    }
  }, [activeCollectionId, onCollectionChange]);

  const fetchRagStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/rag/status`);
      const data = await res.json();
      setRagStatus(data);
      onRagStatusChange?.(data.enabled);
    } catch (err) {
      console.error('Failed to fetch RAG status:', err);
    }
  };

  const fetchCollections = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/rag/collections`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        if (res.status === 401) return; // Not authenticated yet
        throw new Error('Failed to fetch collections');
      }
      const data = await res.json();
      const cols = data.collections || [];
      setCollections(cols);
      // Set first collection as active if none selected
      if (!activeCollectionId && cols.length > 0) {
        setActiveCollectionId(cols[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch collections:', err);
    }
  };

  const fetchDocuments = async () => {
    if (!activeCollectionId) return;
    try {
      const res = await fetch(`${API_BASE}/api/rag/documents?collectionId=${activeCollectionId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        if (res.status === 401) return;
        throw new Error('Failed to fetch documents');
      }
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/rag/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ name: newCollectionName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create collection');
      }

      const data = await res.json();
      setCollections(prev => [...prev, data.collection]);
      setActiveCollectionId(data.collection.id);
      setNewCollectionName('');
      setIsCreatingCollection(false);
    } catch (err) {
      const error = err as Error;
      setError(`Create collection failed: ${error.message}`);
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm('Delete this collection and all its documents? This cannot be undone.')) return;

    try {
      const res = await fetch(`${API_BASE}/api/rag/collections/${collectionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }

      const remaining = collections.filter(c => c.id !== collectionId);
      setCollections(remaining);
      if (activeCollectionId === collectionId) {
        setActiveCollectionId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      const error = err as Error;
      setError(`Delete collection failed: ${error.message}`);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeCollectionId) return;

    setIsUploading(true);
    setError(null);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`Uploading ${file.name} (${i + 1}/${files.length})...`);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('collectionId', activeCollectionId);

        const res = await fetch(`${API_BASE}/api/rag/upload`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Upload failed');
        }
      } catch (err) {
        const error = err as Error;
        setError(`Failed to upload ${file.name}: ${error.message}`);
      }
    }

    setIsUploading(false);
    setUploadProgress('');
    fetchDocuments();

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/rag/documents/${docId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }

      fetchDocuments();
    } catch (err) {
      const error = err as Error;
      setError(`Delete failed: ${error.message}`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number | Date): string => {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
    return date.toLocaleDateString();
  };

  const activeCollection = collections.find(c => c.id === activeCollectionId);

  if (!ragStatus?.enabled) {
    return (
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-yellow-400 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>RAG not configured. Set PINECONE_API_KEY and PINECONE_INDEX in .env</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
      <div className="max-w-7xl mx-auto">
        {/* Collection selector row */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-gray-400">Collection:</span>
          <select
            value={activeCollectionId || ''}
            onChange={(e) => setActiveCollectionId(e.target.value || null)}
            className="text-xs px-2 py-1 bg-gray-700 text-gray-200 border border-gray-600 rounded focus:border-blue-500 focus:outline-none"
          >
            {collections.length === 0 && <option value="">No collections</option>}
            {collections.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name}
              </option>
            ))}
          </select>

          {isCreatingCollection ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="Collection name..."
                className="text-xs px-2 py-1 bg-gray-700 text-gray-200 border border-gray-600 rounded focus:border-blue-500 focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCollection();
                  if (e.key === 'Escape') setIsCreatingCollection(false);
                }}
              />
              <button
                onClick={handleCreateCollection}
                className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-500"
              >
                Create
              </button>
              <button
                onClick={() => setIsCreatingCollection(false)}
                className="text-xs px-2 py-1 bg-gray-600 text-gray-300 rounded hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCreatingCollection(true)}
              className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
              title="Create new collection"
            >
              + New
            </button>
          )}

          {activeCollectionId && collections.length > 1 && (
            <button
              onClick={() => handleDeleteCollection(activeCollectionId)}
              className="text-xs px-2 py-1 text-red-400 hover:text-red-300"
              title="Delete this collection"
            >
              Delete Collection
            </button>
          )}
        </div>

        {/* Documents row */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">
            {activeCollection?.name || 'Documents'} ({documents.length} documents)
          </h2>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md"
              onChange={handleFileSelect}
              className="hidden"
              id="doc-upload"
              disabled={!activeCollectionId}
            />
            <label
              htmlFor="doc-upload"
              className={`text-xs px-3 py-1.5 rounded cursor-pointer transition-colors ${
                isUploading || !activeCollectionId
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              {isUploading ? uploadProgress : 'Upload Documents'}
            </label>
          </div>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-400 hover:text-red-300"
            >
              Dismiss
            </button>
          </div>
        )}

        {documents.length === 0 ? (
          <p className="text-xs text-gray-500">
            {activeCollectionId
              ? 'No documents in this collection. Upload PDF, DOCX, TXT, or MD files.'
              : 'Create a collection to start uploading documents.'}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="group flex items-center gap-2 px-3 py-1.5 bg-gray-700 rounded text-xs"
              >
                <span className="text-gray-400">
                  {doc.mimeType.includes('pdf') ? '📄' : doc.mimeType.includes('word') ? '📝' : '📃'}
                </span>
                <span className="text-gray-200" title={doc.originalName}>
                  {doc.name.length > 25 ? doc.name.slice(0, 22) + '...' : doc.name}
                </span>
                <span className="text-gray-500">
                  {doc.chunkCount} chunks | {formatFileSize(doc.size)} | {formatDate(doc.uploadedAt)}
                </span>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-400 transition-opacity"
                  title="Delete document"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
