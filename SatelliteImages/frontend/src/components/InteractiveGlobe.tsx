import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Globe from 'react-globe.gl';
import { useQuery } from '@tanstack/react-query';
import type { SatelliteImage } from '@shared/types';
import { imagesApi } from '@/lib/api';

interface GlobeMarker {
  lat: number;
  lng: number;
  size: number;
  color: string;
  label: string;
  image: SatelliteImage;
}

export function InteractiveGlobe() {
  const globeEl = useRef<any>();
  const [markers, setMarkers] = useState<GlobeMarker[]>([]);
  const [selectedImage, setSelectedImage] = useState<SatelliteImage | null>(null);

  // Fetch all satellite images
  const { data: images } = useQuery<SatelliteImage[]>({
    queryKey: ['satellite-images-globe'],
    queryFn: async () => {
      const response = await imagesApi.search({});
      return response.images;
    },
  });

  // Convert images to globe markers
  useEffect(() => {
    if (images && images.length > 0) {
      const newMarkers: GlobeMarker[] = images
        .filter(img => img.centerPoint)
        .map(img => ({
          lat: img.centerPoint!.lat,
          lng: img.centerPoint!.lon,
          size: 0.5,
          color: getColorByStatus(img.status),
          label: img.title || img.filename,
          image: img,
        }));

      setMarkers(newMarkers);

      // Auto-rotate to first image location if available
      if (globeEl.current && newMarkers.length > 0) {
        globeEl.current.pointOfView({
          lat: newMarkers[0].lat,
          lng: newMarkers[0].lng,
          altitude: 2,
        }, 2000);
      }
    }
  }, [images]);

  // Auto-rotate globe
  useEffect(() => {
    if (globeEl.current) {
      const controls = globeEl.current.controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;
      }
    }
  }, []);

  const getColorByStatus = (status: string) => {
    switch (status) {
      case 'READY':
        return '#10b981'; // green
      case 'PROCESSING':
        return '#f59e0b'; // amber
      case 'ERROR':
        return '#ef4444'; // red
      default:
        return '#3b82f6'; // blue
    }
  };

  return (
    <div className="relative w-full h-full">
      <Globe
        ref={globeEl}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

        // Points for satellite images
        pointsData={markers}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointAltitude={0.01}
        pointRadius="size"
        pointLabel={(d: any) => {
          const marker = d as GlobeMarker;
          return `
            <div style="
              background: rgba(0, 0, 0, 0.8);
              padding: 8px 12px;
              border-radius: 8px;
              color: white;
              font-family: sans-serif;
              max-width: 200px;
            ">
              <div style="font-weight: bold; margin-bottom: 4px;">${marker.label}</div>
              <div style="font-size: 12px; opacity: 0.8;">
                ${marker.image.satelliteName || 'Unknown satellite'}<br/>
                ${new Date(marker.image.uploadedAt).toLocaleDateString()}
              </div>
            </div>
          `;
        }}
        onPointClick={(point: any) => {
          const marker = point as GlobeMarker;
          setSelectedImage(marker.image);

          // Animate to clicked point
          if (globeEl.current) {
            globeEl.current.pointOfView({
              lat: marker.lat,
              lng: marker.lng,
              altitude: 1.5,
            }, 1000);
          }
        }}

        // Rings animation for selected point
        ringsData={selectedImage ? [{
          lat: selectedImage.centerPoint!.lat,
          lng: selectedImage.centerPoint!.lon,
        }] : []}
        ringColor={() => '#3b82f6'}
        ringMaxRadius={5}
        ringPropagationSpeed={2}
        ringRepeatPeriod={1000}

        // Atmosphere
        atmosphereColor="#3b82f6"
        atmosphereAltitude={0.15}

        // Rendering settings
        width={800}
        height={600}
        animateIn={true}
      />

      {/* Image count badge */}
      {markers.length > 0 && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg px-4 py-2">
          <div className="text-sm text-dark-light">Satellite Images</div>
          <div className="text-2xl font-bold text-primary">{markers.length}</div>
        </div>
      )}

      {/* Selected image info panel */}
      {selectedImage && (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-xl p-4 max-w-md">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-bold text-dark">
              {selectedImage.title || selectedImage.filename}
            </h3>
            <button
              onClick={() => setSelectedImage(null)}
              className="text-dark-light hover:text-dark"
            >
              ✕
            </button>
          </div>
          {selectedImage.description && (
            <p className="text-sm text-dark-light mb-2">{selectedImage.description}</p>
          )}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-dark-light">Satellite</div>
              <div className="font-medium text-dark">
                {selectedImage.satelliteName || 'Unknown'}
              </div>
            </div>
            <div>
              <div className="text-dark-light">Uploaded</div>
              <div className="font-medium text-dark">
                {new Date(selectedImage.uploadedAt).toLocaleDateString()}
              </div>
            </div>
            {selectedImage.resolution && (
              <div>
                <div className="text-dark-light">Resolution</div>
                <div className="font-medium text-dark">{selectedImage.resolution} m/px</div>
              </div>
            )}
            {selectedImage.cloudCoverage !== undefined && (
              <div>
                <div className="text-dark-light">Cloud Coverage</div>
                <div className="font-medium text-dark">{selectedImage.cloudCoverage}%</div>
              </div>
            )}
          </div>
          <Link
            to={`/image/${selectedImage.id}`}
            className="mt-4 block w-full bg-primary text-white text-center py-2 px-4 rounded-eoi hover:bg-primary-600 transition-colors font-medium"
          >
            View Details →
          </Link>
        </div>
      )}

      {/* Loading state */}
      {!images && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
          <div className="text-white text-lg">Loading satellite data...</div>
        </div>
      )}

      {/* No images message */}
      {images && images.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
            <h3 className="text-xl font-bold text-dark mb-2">No Images Yet</h3>
            <p className="text-dark-light">
              Upload satellite images with GPS coordinates to see them on the globe!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
