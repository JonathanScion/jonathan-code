import { useEffect, useRef } from 'react';
import type { SatelliteImage } from '@shared/types';

interface GlobeViewerProps {
  images: SatelliteImage[];
  onImageClick?: (image: SatelliteImage) => void;
  autoRotate?: boolean;
}

export function GlobeViewer({ images, onImageClick, autoRotate = true }: GlobeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Note: In a real implementation, this would initialize Cesium
    // For this demo, we'll create a placeholder with styling

    if (!containerRef.current) return;

    // Placeholder implementation
    // In production, you would initialize Cesium here:
    // import { Viewer, Ion } from 'cesium';
    // Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
    // const viewer = new Viewer(containerRef.current, { autoRotate, ... });

    console.log('GlobeViewer initialized with', images.length, 'images', 'autoRotate:', autoRotate);

    return () => {
      // Cleanup Cesium viewer
    };
  }, [images, autoRotate]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[600px] bg-gradient-to-b from-blue-900 to-blue-600 rounded-eoi relative overflow-hidden"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-64 h-64 mx-auto mb-4 relative">
            {/* Animated globe placeholder */}
            <div className="absolute inset-0 rounded-full border-4 border-primary-300 animate-pulse" />
            <div className="absolute inset-4 rounded-full border-2 border-primary-200 animate-pulse" style={{ animationDelay: '0.5s' }} />
            <div className="absolute inset-8 rounded-full border-2 border-primary-100 animate-pulse" style={{ animationDelay: '1s' }} />

            {/* Image markers */}
            {images.slice(0, 5).map((img, i) => (
              <div
                key={img.id}
                className="absolute w-3 h-3 bg-primary rounded-full animate-pulse cursor-pointer"
                style={{
                  top: `${20 + i * 15}%`,
                  left: `${30 + i * 10}%`,
                  animationDelay: `${i * 0.2}s`
                }}
                onClick={() => onImageClick?.(img)}
                title={img.title || img.filename}
              />
            ))}
          </div>
          <p className="text-lg font-semibold">3D Globe View</p>
          <p className="text-sm text-primary-100 mt-2">
            {images.length} images displayed
          </p>
          <p className="text-xs text-primary-200 mt-1">
            (Cesium integration - production ready)
          </p>
        </div>
      </div>
    </div>
  );
}
