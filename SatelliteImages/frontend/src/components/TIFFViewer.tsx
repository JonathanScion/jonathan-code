import { useEffect, useRef, useState } from 'react';
import { fromUrl } from 'geotiff';
import { Loader2, AlertCircle } from 'lucide-react';

interface TIFFViewerProps {
  url: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  maxDimension?: number; // Maximum width/height for thumbnails
}

export function TIFFViewer({
  url,
  width = '100%',
  height = 'auto',
  className = '',
  maxDimension
}: TIFFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let mounted = true;
    let abortController = new AbortController();
    let tempCanvas: HTMLCanvasElement | null = null;

    const loadAndRenderTiff = async () => {
      if (!canvasRef.current || !url) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch the TIFF file with abort signal
        const tiff = await fromUrl(url);

        if (!mounted || abortController.signal.aborted) return;

        const image = await tiff.getImage();

        if (!mounted || abortController.signal.aborted) return;

        const rasters = await image.readRasters();

        if (!mounted || abortController.signal.aborted) {
          // Clean up rasters if we're aborting
          return;
        }

        // Get image dimensions
        const imageWidth = image.getWidth();
        const imageHeight = image.getHeight();

        // Calculate canvas dimensions
        let canvasWidth = imageWidth;
        let canvasHeight = imageHeight;

        if (maxDimension) {
          const scale = Math.min(maxDimension / imageWidth, maxDimension / imageHeight);
          if (scale < 1) {
            canvasWidth = Math.floor(imageWidth * scale);
            canvasHeight = Math.floor(imageHeight * scale);
          }
        }

        setDimensions({ width: canvasWidth, height: canvasHeight });

        // Set canvas size
        const canvas = canvasRef.current;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }

        // Create ImageData
        const imageData = ctx.createImageData(imageWidth, imageHeight);
        const data = imageData.data;

        // Handle different band counts
        const numBands = rasters.length;
        const hasAlpha = numBands === 4;

        // Cast rasters to TypedArrays for proper indexing
        const band0 = rasters[0] as any;
        const band1 = numBands >= 2 ? (rasters[1] as any) : null;
        const band2 = numBands >= 3 ? (rasters[2] as any) : null;
        const band3 = numBands >= 4 ? (rasters[3] as any) : null;

        // Detect bit depth by finding max value in first band
        let maxValue = 0;
        const sampleSize = Math.min(1000, band0.length); // Sample first 1000 pixels
        for (let i = 0; i < sampleSize; i++) {
          if (band0[i] > maxValue) maxValue = band0[i];
        }

        // Determine normalization factor based on max value
        // If max is around 255, it's 8-bit. If around 65535, it's 16-bit
        const normalizationFactor = maxValue > 300 ? 65535 : 255;

        // Normalize and convert raster data to RGBA
        for (let i = 0; i < imageWidth * imageHeight; i++) {
          if (numBands >= 3 && band1 && band2) {
            // RGB or RGBA image
            const r = band0[i];
            const g = band1[i];
            const b = band2[i];
            const a = hasAlpha && band3 ? band3[i] : 255;

            // Normalize values based on detected bit depth
            data[i * 4] = Math.min(255, Math.round((r / normalizationFactor) * 255));
            data[i * 4 + 1] = Math.min(255, Math.round((g / normalizationFactor) * 255));
            data[i * 4 + 2] = Math.min(255, Math.round((b / normalizationFactor) * 255));
            data[i * 4 + 3] = hasAlpha ? Math.min(255, Math.round((a / normalizationFactor) * 255)) : 255;
          } else if (numBands === 1) {
            // Grayscale image
            const gray = Math.min(255, Math.round((band0[i] / normalizationFactor) * 255));
            data[i * 4] = gray;
            data[i * 4 + 1] = gray;
            data[i * 4 + 2] = gray;
            data[i * 4 + 3] = 255;
          }
        }

        // Put the image data on a temporary canvas at original size
        tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageWidth;
        tempCanvas.height = imageHeight;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) {
          throw new Error('Failed to get temporary canvas context');
        }
        tempCtx.putImageData(imageData, 0, 0);

        // Draw scaled image on the main canvas
        ctx.drawImage(tempCanvas, 0, 0, imageWidth, imageHeight, 0, 0, canvasWidth, canvasHeight);

        setLoading(false);
      } catch (err) {
        console.error('Error loading TIFF:', err);
        if (mounted && !abortController.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load TIFF image');
          setLoading(false);
        }
      }
    };

    loadAndRenderTiff();

    // CRITICAL: Clean up all resources to prevent memory leak
    return () => {
      mounted = false;
      abortController.abort();

      // Clear canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }

      // Remove temporary canvas from memory
      if (tempCanvas) {
        const ctx = tempCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        }
        tempCanvas.width = 0;
        tempCanvas.height = 0;
        tempCanvas = null;
      }
    };
  }, [url, maxDimension]);

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gray-100 ${className}`}
        style={{ width, height: height === 'auto' ? dimensions.height || 200 : height }}
      >
        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
        <p className="text-sm text-red-600 text-center px-4">Failed to load image</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width, height: height === 'auto' ? dimensions.height || 'auto' : height }}>
      {loading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-gray-100"
          style={{ minHeight: 200 }}
        >
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`${loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        style={{
          width: '100%',
          height: height === 'auto' ? 'auto' : '100%',
          objectFit: 'contain'
        }}
      />
    </div>
  );
}
