import { useState, useEffect, useRef } from 'react';
import type { DocumentInfo, RagStatus } from '../types';

interface DocumentManagerProps {
  onRagStatusChange?: (enabled: boolean) => void;
}

export function DocumentManager({ onRagStatusChange }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [ragStatus, setRagStatus] = useState<RagStatus | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check RAG status on mount
  useEffect(() => {
    fetchRagStatus();
    fetchDocuments();
  }, []);

  const fetchRagStatus = async () => {
    try {
      const res = await fetch('/api/rag/status');
      const data = await res.json();
      setRagStatus(data);
      onRagStatusChange?.(data.enabled);
    } catch (err) {
      console.error('Failed to fetch RAG status:', err);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/rag/documents');
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`Uploading ${file.name} (${i + 1}/${files.length})...`);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/rag/upload', {
          method: 'POST',
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
      const res = await fetch(`/api/rag/documents/${docId}`, {
        method: 'DELETE',
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

  const handleClearAll = async () => {
    if (!confirm('Delete all documents? This cannot be undone.')) return;

    try {
      const res = await fetch('/api/rag/documents', {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Clear failed');
      }

      fetchDocuments();
    } catch (err) {
      const error = err as Error;
      setError(`Clear failed: ${error.message}`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString();
  };

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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">
            Document Store ({documents.length} documents)
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
            />
            <label
              htmlFor="doc-upload"
              className={`text-xs px-3 py-1.5 rounded cursor-pointer transition-colors ${
                isUploading
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              {isUploading ? uploadProgress : 'Upload Documents'}
            </label>
            {documents.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs px-3 py-1.5 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 transition-colors"
              >
                Clear All
              </button>
            )}
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
            No documents uploaded. Upload PDF, DOCX, TXT, or MD files to enable RAG.
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
