import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileImage, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
}

export function UploadZone({ onFilesSelected, maxFiles = 10, maxSize = 500 * 1024 * 1024 }: UploadZoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFilesSelected(acceptedFiles);
  }, [onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'image/tiff': ['.tif', '.tiff'],
      'image/geotiff': ['.tif', '.tiff'],
    },
    maxFiles,
    maxSize,
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-eoi p-12 text-center cursor-pointer
          transition-all duration-eoi
          ${isDragActive
            ? 'border-primary bg-primary-50 scale-105'
            : 'border-light-border hover:border-primary hover:bg-gray-50'
          }
        `}
        style={{
          transform: isDragActive ? 'scale(1.01)' : 'scale(1)',
          transition: 'transform 0.2s'
        }}
      >
        <input {...getInputProps()} />

        <motion.div
          animate={isDragActive ? { scale: 1.1 } : { scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          {isDragActive ? (
            <Upload className="w-16 h-16 mx-auto text-primary mb-4" />
          ) : (
            <FileImage className="w-16 h-16 mx-auto text-dark-light mb-4" />
          )}
        </motion.div>

        <h3 className="text-xl font-semibold text-dark mb-2">
          {isDragActive ? 'Drop files here' : 'Upload Satellite Images'}
        </h3>

        <p className="text-dark-light mb-4">
          Drag and drop TIFF/GeoTIFF files here, or click to browse
        </p>

        <div className="flex items-center justify-center space-x-4 text-sm text-dark-light">
          <span>Max {maxFiles} files</span>
          <span>•</span>
          <span>Up to {Math.round(maxSize / (1024 * 1024))}MB each</span>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Supported formats: .tif, .tiff, GeoTIFF
        </div>
      </div>

      {/* Errors */}
      {fileRejections.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 bg-red-50 border border-red-200 rounded-eoi"
        >
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900 mb-2">Upload Errors:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                {fileRejections.map(({ file, errors }) => (
                  <li key={file.name}>
                    <strong>{file.name}</strong>: {errors.map(e => e.message).join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
