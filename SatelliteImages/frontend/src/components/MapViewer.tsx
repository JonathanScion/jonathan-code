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

export type ProjectionMode = 'streetMap' | 'nasaMode';

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
  projectionMode?: ProjectionMode;
}

// GIBS layer metadata for EPSG:3857 (Web Mercator / Street Map mode)
// Note: NDVI and some other layers are NOT available in EPSG:3857, only in NASA mode (EPSG:4326)
const GIBS_LAYERS_3857: Record<string, { tileMatrixSet: string; format: string; maxZoom: number }> = {
  'MODIS_Terra_CorrectedReflectance_TrueColor': { tileMatrixSet: 'GoogleMapsCompatible_Level9', format: 'jpg', maxZoom: 9 },
  'MODIS_Aqua_CorrectedReflectance_TrueColor': { tileMatrixSet: 'GoogleMapsCompatible_Level9', format: 'jpg', maxZoom: 9 },
  'VIIRS_NOAA20_CorrectedReflectance_TrueColor': { tileMatrixSet: 'GoogleMapsCompatible_Level9', format: 'jpg', maxZoom: 9 },
  'VIIRS_SNPP_CorrectedReflectance_TrueColor': { tileMatrixSet: 'GoogleMapsCompatible_Level9', format: 'jpg', maxZoom: 9 },
  'MODIS_Terra_Land_Surface_Temp_Day': { tileMatrixSet: 'GoogleMapsCompatible_Level7', format: 'png', maxZoom: 7 },
};

// GIBS layer metadata for EPSG:4326 (Geographic / NASA mode) - ALL layers available
const GIBS_LAYERS_4326: Record<string, { tileMatrixSet: string; format: string; maxZoom: number }> = {
  'MODIS_Terra_CorrectedReflectance_TrueColor': { tileMatrixSet: '250m', format: 'jpg', maxZoom: 9 },
  'MODIS_Aqua_CorrectedReflectance_TrueColor': { tileMatrixSet: '250m', format: 'jpg', maxZoom: 9 },
  'VIIRS_NOAA20_CorrectedReflectance_TrueColor': { tileMatrixSet: '250m', format: 'jpg', maxZoom: 9 },
  'VIIRS_SNPP_CorrectedReflectance_TrueColor': { tileMatrixSet: '250m', format: 'jpg', maxZoom: 9 },
  'MODIS_Terra_NDVI_8Day': { tileMatrixSet: '1km', format: 'png', maxZoom: 6 },
  'MODIS_Terra_Land_Surface_Temp_Day': { tileMatrixSet: '1km', format: 'png', maxZoom: 7 },
  // Fire/thermal layers - only available in EPSG:4326!
  'MODIS_Terra_Thermal_Anomalies_All': { tileMatrixSet: '1km', format: 'png', maxZoom: 7 },
  'MODIS_Aqua_Thermal_Anomalies_All': { tileMatrixSet: '1km', format: 'png', maxZoom: 7 },
  'VIIRS_NOAA20_Thermal_Anomalies_375m_All': { tileMatrixSet: '250m', format: 'png', maxZoom: 8 },
  'VIIRS_SNPP_Thermal_Anomalies_375m_All': { tileMatrixSet: '250m', format: 'png', maxZoom: 8 },
  // Additional layers only in 4326
  'MODIS_Terra_Aerosol_Optical_Depth': { tileMatrixSet: '2km', format: 'png', maxZoom: 6 },
  'MODIS_Terra_Cloud_Top_Temp_Day': { tileMatrixSet: '2km', format: 'png', maxZoom: 6 },
};

// Validate and sanitize date for NASA GIBS requests
function getValidGibsDate(date: string): string {
  const fallbackDate = '2024-10-15'; // Known valid date with NASA data

  try {
    const requestedDate = new Date(date);
    const requestedYear = requestedDate.getFullYear();

    // If requested year is 2026 or later, NASA doesn't have this data yet
    if (requestedYear >= 2026) {
      return fallbackDate;
    }

    // If date is invalid, use fallback
    if (isNaN(requestedDate.getTime())) {
      return fallbackDate;
    }

    return date;
  } catch {
    return fallbackDate;
  }
}

function getGibsTileUrl(layerId: string, date: string, mode: ProjectionMode): { url: string; maxZoom: number } {
  const is4326 = mode === 'nasaMode';
  const baseUrl = is4326
    ? 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best'
    : 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';

  const layerInfo = is4326 ? GIBS_LAYERS_4326 : GIBS_LAYERS_3857;
  const info = layerInfo[layerId] || (is4326
    ? { tileMatrixSet: '250m', format: 'jpg', maxZoom: 9 }
    : { tileMatrixSet: 'GoogleMapsCompatible_Level9', format: 'jpg', maxZoom: 9 });

  // Validate the date to ensure NASA has data for it
  const validDate = getValidGibsDate(date);

  return {
    url: `${baseUrl}/${layerId}/default/${validDate}/${info.tileMatrixSet}/{z}/{y}/{x}.${info.format}`,
    maxZoom: info.maxZoom,
  };
}

function getYesterday(): string {
  const now = new Date();
  const fallbackDate = '2024-10-15'; // Known valid date with NASA data

  // If system year is 2026 or later, use fallback (likely incorrect system time)
  if (now.getFullYear() >= 2026) {
    return fallbackDate;
  }

  const date = new Date(now);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

// Custom CRS for GIBS EPSG:4326 tiles
// GIBS uses a specific tile matrix that differs from standard EPSG:4326
function createGibsCRS4326() {
  const resolutions = [
    0.5625,      // Level 0
    0.28125,     // Level 1
    0.140625,    // Level 2
    0.0703125,   // Level 3
    0.03515625,  // Level 4
    0.017578125, // Level 5
    0.0087890625, // Level 6
    0.00439453125, // Level 7
    0.002197265625, // Level 8
    0.0010986328125, // Level 9
  ];

  return L.CRS.EPSG4326;
}

export function MapViewer({
  images,
  onImageClick,
  selectedImage,
  height = '500px',
  gibsLayers = [],
  projectionMode = 'streetMap'
}: MapViewerProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gibsLayersRef = useRef<Map<string, L.TileLayer>>(new Map());
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const initialViewSet = useRef(false);
  const currentModeRef = useRef<ProjectionMode>(projectionMode);

  // Store the first image's bounds/center for initial view (avoid array reference issues)
  const firstImage = images[0];
  const firstImageBounds = firstImage?.bounds;
  const firstImageCenter = firstImage?.centerPoint;

  // Initialize or reinitialize map when projection mode changes
  useEffect(() => {
    if (!containerRef.current) return;

    // If map exists and mode changed, destroy it first
    if (mapRef.current && currentModeRef.current !== projectionMode) {
      mapRef.current.remove();
      mapRef.current = null;
      gibsLayersRef.current.clear();
      baseLayerRef.current = null;
      initialViewSet.current = false;
    }

    currentModeRef.current = projectionMode;

    // Don't recreate if already exists
    if (mapRef.current) return;

    const isNasaMode = projectionMode === 'nasaMode';

    // Create map with appropriate CRS
    const mapOptions: L.MapOptions = {
      maxZoom: isNasaMode ? 9 : 18,
      minZoom: 1,
    };

    if (isNasaMode) {
      mapOptions.crs = L.CRS.EPSG4326;
      mapOptions.maxBounds = [[-90, -180], [90, 180]];
    }

    mapRef.current = L.map(containerRef.current, mapOptions).setView([0, 0], 2);

    // Add appropriate base layer
    if (isNasaMode) {
      // Use NASA Blue Marble as base layer for EPSG:4326
      // Blue Marble is a static layer (no time dimension)
      baseLayerRef.current = L.tileLayer(
        'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_ShadedRelief_Bathymetry/default/EPSG4326_500m/{z}/{y}/{x}.jpeg',
        {
          attribution: 'NASA Blue Marble',
          maxZoom: 8,
          tileSize: 512,
          noWrap: true,
          bounds: [[-90, -180], [90, 180]],
        }
      );
    } else {
      // Use OpenStreetMap for EPSG:3857
      baseLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      });
    }
    baseLayerRef.current.addTo(mapRef.current);

    // Set initial view based on first image
    if (firstImageBounds) {
      mapRef.current.fitBounds([
        [firstImageBounds.south, firstImageBounds.west],
        [firstImageBounds.north, firstImageBounds.east]
      ], { maxZoom: 8, padding: [20, 20] });
      initialViewSet.current = true;
    } else if (firstImageCenter) {
      mapRef.current.setView([firstImageCenter.lat, firstImageCenter.lon], 6);
      initialViewSet.current = true;
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        gibsLayersRef.current.clear();
        baseLayerRef.current = null;
        initialViewSet.current = false;
      }
    };
  // Only depend on projectionMode and the actual bounds/center values, not the array reference
  }, [projectionMode, firstImageBounds, firstImageCenter]);

  // Handle GIBS layers - preserve view during layer operations
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Save current view to restore after layer changes
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();

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

      // Check if layer already exists
      const existingLayer = gibsLayersRef.current.get(config.id);
      if (existingLayer) {
        existingLayer.setOpacity(config.opacity ?? 0.7);
        return;
      }

      // Create new GIBS layer
      const { url: tileUrl, maxZoom } = getGibsTileUrl(config.id, date, projectionMode);

      const layerOptions: L.TileLayerOptions = {
        tileSize: projectionMode === 'nasaMode' ? 512 : 256,
        minZoom: 0,
        maxZoom: projectionMode === 'nasaMode' ? 9 : 18,
        maxNativeZoom: maxZoom,
        opacity: config.opacity ?? 0.7,
        attribution: 'NASA GIBS',
        crossOrigin: 'anonymous',
        errorTileUrl: '',
      };

      if (projectionMode === 'nasaMode') {
        layerOptions.noWrap = true;
      }

      const layer = L.tileLayer(tileUrl, layerOptions);

      layer.addTo(map);
      layer.bringToFront();
      gibsLayersRef.current.set(config.id, layer);
    });

    // Restore view if it was changed (belt and suspenders)
    if (initialViewSet.current) {
      const newCenter = map.getCenter();
      const newZoom = map.getZoom();
      if (newCenter.lat !== currentCenter.lat || newCenter.lng !== currentCenter.lng || newZoom !== currentZoom) {
        map.setView(currentCenter, currentZoom, { animate: false });
      }
    }
  }, [gibsLayers, projectionMode]);

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

    // Only fit bounds on FIRST load
    if (!initialViewSet.current && bounds.length > 0) {
      const firstImageWithBounds = images.find(img => img.bounds);
      if (firstImageWithBounds?.bounds) {
        const b = firstImageWithBounds.bounds;
        map.fitBounds([
          [b.south, b.west],
          [b.north, b.east]
        ], { maxZoom: 8, padding: [20, 20] });
      } else {
        map.fitBounds(bounds, { maxZoom: 8 });
      }
      initialViewSet.current = true;
    }
  }, [images, onImageClick]);

  // Highlight selected image
  useEffect(() => {
    if (!selectedImage?.centerPoint || !mapRef.current || initialViewSet.current) {
      return;
    }

    mapRef.current.setView(
      [selectedImage.centerPoint.lat, selectedImage.centerPoint.lon],
      6,
      { animate: true }
    );
    initialViewSet.current = true;
  }, [selectedImage]);

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="w-full rounded-eoi shadow-eoi"
    />
  );
}
