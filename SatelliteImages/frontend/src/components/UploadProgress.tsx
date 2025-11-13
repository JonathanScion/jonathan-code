import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader, FileImage } from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import type { UploadProgress as UploadProgressType } from '@/lib/store';

interface UploadProgressProps {
  uploads: UploadProgressType[];
}

export function UploadProgress({ uploads }: UploadProgressProps) {
  if (uploads.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-4 right-4 w-96 bg-white rounded-eoi shadow-eoi-hover border border-light-border p-4 z-50"
    >
      <h3 className="font-semibold text-dark mb-3">
        Uploading {uploads.length} file{uploads.length > 1 ? 's' : ''}
      </h3>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {uploads.map((upload, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="border border-light-border rounded-eoi p-3"
          >
            <div className="flex items-start space-x-3">
              {/* Icon */}
              <div className="flex-shrink-0">
                {upload.status === 'complete' && (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                )}
                {upload.status === 'error' && (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                {(upload.status === 'uploading' || upload.status === 'processing') && (
                  <Loader className="w-5 h-5 text-primary animate-spin" />
                )}
                {upload.status === 'pending' && (
                  <FileImage className="w-5 h-5 text-dark-light" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-dark truncate">
                  {upload.file.name}
                </p>
                <p className="text-xs text-dark-light">
                  {formatBytes(upload.file.size)}
                </p>

                {/* Progress bar */}
                {upload.status === 'uploading' && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-dark-light mb-1">
                      <span>{upload.status}</span>
                      <span>{Math.round(upload.progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <motion.div
                        className="bg-primary h-1.5 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${upload.progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                )}

                {upload.status === 'processing' && (
                  <p className="text-xs text-primary mt-1">Processing metadata...</p>
                )}

                {upload.status === 'complete' && (
                  <p className="text-xs text-green-600 mt-1">Upload complete!</p>
                )}

                {upload.error && (
                  <p className="text-xs text-red-600 mt-1">{upload.error}</p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
