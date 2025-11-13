import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { SatelliteImage } from '@shared/types';

// Fix Leaflet marker icon paths for Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapViewerProps {
  images: SatelliteImage[];
  onImageClick?: (image: SatelliteImage) => void;
  selectedImage?: SatelliteImage;
  height?: string;
}

export function MapViewer({ images, onImageClick, selectedImage, height = '500px' }: MapViewerProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current).setView([0, 0], 2);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapRef.current);
    }

    // Clear existing markers
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        mapRef.current!.removeLayer(layer);
      }
    });

    // Add markers for images with location data
    const bounds: L.LatLngBoundsLiteral = [];

    images.forEach((image) => {
      if (image.centerPoint) {
        const marker = L.marker([image.centerPoint.lat, image.centerPoint.lon]);

        marker.bindPopup(`
          <div class="p-2">
            <h3 class="font-semibold text-sm mb-1">${image.title || image.filename}</h3>
            ${image.thumbnailUrl ? `<img src="${image.thumbnailUrl}" alt="${image.filename}" class="w-32 h-32 object-cover rounded mb-2" />` : ''}
            <p class="text-xs text-gray-600">${image.capturedAt ? new Date(image.capturedAt).toLocaleDateString() : 'Date unknown'}</p>
          </div>
        `);

        marker.on('click', () => {
          onImageClick?.(image);
        });

        marker.addTo(mapRef.current!);
        bounds.push([image.centerPoint.lat, image.centerPoint.lon]);

        // Draw bounding box if available
        if (image.bounds) {
          const rectangle = L.rectangle([
            [image.bounds.south, image.bounds.west],
            [image.bounds.north, image.bounds.east]
          ], {
            color: '#2ea3f2',
            weight: 2,
            fillOpacity: 0.1
          });

          rectangle.addTo(mapRef.current!);
        }
      }
    });

    // Fit map to markers
    if (bounds.length > 0) {
      mapRef.current.fitBounds(bounds);
    }

    // CRITICAL: Destroy map on unmount to prevent memory leak
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [images, onImageClick]);

  // Highlight selected image
  useEffect(() => {
    if (selectedImage?.centerPoint && mapRef.current) {
      mapRef.current.setView(
        [selectedImage.centerPoint.lat, selectedImage.centerPoint.lon],
        6,
        { animate: true }
      );
    }
  }, [selectedImage]);

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="w-full rounded-eoi shadow-eoi"
    />
  );
}
