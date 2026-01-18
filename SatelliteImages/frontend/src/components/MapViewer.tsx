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

// GIBS tile URL template
const GIBS_BASE_URL = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best';

export interface GIBSLayerConfig {
  id: string;
  date?: string;
  opacity?: number;
}

interface MapViewerProps {
  images: SatelliteImage[];
  onImageClick?: (image: SatelliteImage) => void;
  selectedImage?: SatelliteImage;
  height?: string;
  gibsLayers?: GIBSLayerConfig[];
}

// GIBS layer metadata for tile URL construction
const GIBS_LAYER_INFO: Record<string, { tileMatrixSet: string; format: string }> = {
  'MODIS_Terra_CorrectedReflectance_TrueColor': { tileMatrixSet: '250m', format: 'jpg' },
  'MODIS_Aqua_CorrectedReflectance_TrueColor': { tileMatrixSet: '250m', format: 'jpg' },
  'VIIRS_NOAA20_CorrectedReflectance_TrueColor': { tileMatrixSet: '250m', format: 'jpg' },
  'MODIS_Terra_NDVI_8Day': { tileMatrixSet: '250m', format: 'png' },
  'MODIS_Terra_Land_Surface_Temp_Day': { tileMatrixSet: '1km', format: 'png' },
  'VIIRS_NOAA20_Thermal_Anomalies_375m_All': { tileMatrixSet: '250m', format: 'png' },
  'MODIS_Terra_Aerosol_Optical_Depth': { tileMatrixSet: '2km', format: 'png' },
  'MODIS_Terra_Cloud_Top_Temp_Day': { tileMatrixSet: '2km', format: 'png' },
};

function getGibsTileUrl(layerId: string, date: string): string {
  const info = GIBS_LAYER_INFO[layerId] || { tileMatrixSet: '250m', format: 'jpg' };
  return `${GIBS_BASE_URL}/${layerId}/default/${date}/${info.tileMatrixSet}/{z}/{y}/{x}.${info.format}`;
}

export function MapViewer({ images, onImageClick, selectedImage, height = '500px', gibsLayers = [] }: MapViewerProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gibsLayersRef = useRef<Map<string, L.TileLayer>>(new Map());
  const baseLayerRef = useRef<L.TileLayer | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current).setView([0, 0], 2);

    baseLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
    baseLayerRef.current.addTo(mapRef.current);

    // CRITICAL: Destroy map on unmount to prevent memory leak
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        gibsLayersRef.current.clear();
        baseLayerRef.current = null;
      }
    };
  }, []);

  // Handle GIBS layers
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const currentLayerIds = new Set(gibsLayers.map(l => l.id));

    // Remove layers that are no longer enabled
    gibsLayersRef.current.forEach((layer, id) => {
      if (!currentLayerIds.has(id)) {
        map.removeLayer(layer);
        gibsLayersRef.current.delete(id);
      }
    });

    // Add or update enabled layers
    gibsLayers.forEach(config => {
      const date = config.date || getYesterday();
      const layerKey = `${config.id}_${date}`;

      // Check if layer already exists with same date
      const existingLayer = gibsLayersRef.current.get(config.id);
      if (existingLayer) {
        // Update opacity if needed
        existingLayer.setOpacity(config.opacity ?? 0.7);
        return;
      }

      // Create new GIBS layer
      const tileUrl = getGibsTileUrl(config.id, date);
      const layer = L.tileLayer(tileUrl, {
        tileSize: 256,
        bounds: [[-90, -180], [90, 180]],
        minZoom: 1,
        maxZoom: 9,
        opacity: config.opacity ?? 0.7,
        attribution: 'NASA GIBS',
      });

      layer.addTo(map);
      gibsLayersRef.current.set(config.id, layer);
    });
  }, [gibsLayers]);

  // Handle image markers and bounds
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Clear existing markers and rectangles (but keep tile layers)
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Rectangle) {
        map.removeLayer(layer);
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

        marker.addTo(map);
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

          rectangle.addTo(map);
        }
      }
    });

    // Fit map to markers
    if (bounds.length > 0) {
      map.fitBounds(bounds);
    }
  }, [images, onImageClick]);

  function getYesterday(): string {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }

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
