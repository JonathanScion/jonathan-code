import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { ArrowRight } from 'lucide-react';
import { imagesApi } from '@/lib/api';
import { uploadProgressAtom, UploadProgress as UploadProgressType } from '@/lib/store';
import { UploadZone } from '@/components/UploadZone';
import { UploadProgress } from '@/components/UploadProgress';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { extractGeoTIFFMetadata } from '@/lib/utils';

export function UploadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useAtom(uploadProgressAtom);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Update progress to uploading
      setUploadProgress(prev =>
        prev.map(up =>
          up.file === file ? { ...up, status: 'uploading' as const, progress: 0 } : up
        )
      );

      // Extract metadata from GeoTIFF (if available)
      const metadata = await extractGeoTIFFMetadata(file);

      // Request upload URL with metadata
      const uploadResponse = await imagesApi.requestUpload({
        filename: file.name,
        contentType: file.type || 'image/tiff',
        fileSize: file.size,
        ...metadata,
      });

      // Upload to S3
      await imagesApi.uploadToS3(uploadResponse.uploadUrl, file, (progress) => {
        setUploadProgress(prev =>
          prev.map(up =>
            up.file === file ? { ...up, progress } : up
          )
        );
      });

      // Update to processing
      setUploadProgress(prev =>
        prev.map(up =>
          up.file === file ? { ...up, status: 'processing' as const } : up
        )
      );

      // Confirm upload
      const image = await imagesApi.confirmUpload(uploadResponse.imageId);

      // Update to complete
      setUploadProgress(prev =>
        prev.map(up =>
          up.file === file
            ? { ...up, status: 'complete' as const, imageId: image.id }
            : up
        )
      );

      return image;
    },
    onSuccess: () => {
      // Invalidate images query to refresh gallery
      queryClient.invalidateQueries({ queryKey: ['images'] });
    },
    onError: (error: any, file: File) => {
      setUploadProgress(prev =>
        prev.map(up =>
          up.file === file
            ? { ...up, status: 'error' as const, error: error.message }
            : up
        )
      );
    },
  });

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);

    // Initialize upload progress
    const newUploads: UploadProgressType[] = files.map(file => ({
      file,
      progress: 0,
      status: 'pending',
    }));

    setUploadProgress(newUploads);
  };

  const handleStartUpload = async () => {
    for (const file of selectedFiles) {
      await uploadMutation.mutateAsync(file);
    }

    // Navigate to gallery after completion
    setTimeout(() => {
      navigate('/gallery');
    }, 2000);
  };

  const hasCompletedUploads = uploadProgress.some(up => up.status === 'complete');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-dark mb-2">Upload Satellite Images</h1>
          <p className="text-dark-light">
            Upload TIFF or GeoTIFF files. Metadata will be extracted automatically.
          </p>
        </div>

        {/* Upload Zone */}
        <div className="mb-8">
          <UploadZone onFilesSelected={handleFilesSelected} />
        </div>

        {/* Selected Files */}
        {selectedFiles.length > 0 && uploadProgress.every(up => up.status === 'pending') && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>
                {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} ready to upload
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 mb-4">
                {selectedFiles.map((file, index) => (
                  <li key={index} className="text-sm text-dark-light flex justify-between">
                    <span>{file.name}</span>
                    <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </li>
                ))}
              </ul>

              <Button onClick={handleStartUpload} size="lg" className="w-full">
                Start Upload
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Information Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Supported Formats</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-dark-light">
                <li>• TIFF (.tif, .tiff)</li>
                <li>• GeoTIFF (with embedded geospatial metadata)</li>
                <li>• Max file size: 500 MB</li>
                <li>• Multiple bands supported</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What Happens Next?</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-dark-light">
                <li>✓ Files uploaded to secure S3 storage</li>
                <li>✓ Metadata automatically extracted</li>
                <li>✓ Thumbnails generated</li>
                <li>✓ Geographic coordinates indexed</li>
                <li>✓ Ready for search and analysis</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Upload Progress (Fixed position) */}
        <UploadProgress uploads={uploadProgress} />

        {/* Success message */}
        {hasCompletedUploads && (
          <div className="mt-8 text-center">
            <Button onClick={() => navigate('/gallery')} size="lg">
              View in Gallery
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
