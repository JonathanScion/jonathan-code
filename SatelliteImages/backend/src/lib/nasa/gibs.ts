/**
 * NASA GIBS (Global Imagery Browse Services) Helper
 * Generate tile URLs for map overlays
 * No API key required
 */

export interface GIBSLayer {
  id: string;
  name: string;
  description: string;
  category: 'trueColor' | 'vegetation' | 'thermal' | 'atmosphere' | 'other';
  format: 'jpg' | 'png';
  tileMatrixSet: string;
  hasTime: boolean;
  startDate?: string; // First available date
  requiresNasaMode?: boolean; // True if layer only works in EPSG:4326 (NASA Mode)
}

// GIBS WMTS base URL
const GIBS_BASE_URL = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best';

// Supported layers - includes both EPSG:3857 and EPSG:4326 only layers
// Layers with requiresNasaMode: true only work in NASA Mode (EPSG:4326)
export const GIBS_LAYERS: GIBSLayer[] = [
  // === TRUE COLOR LAYERS (work in both modes) ===
  {
    id: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    name: 'MODIS Terra True Color',
    description: 'Daily true color imagery from MODIS Terra',
    category: 'trueColor',
    format: 'jpg',
    tileMatrixSet: '250m',
    hasTime: true,
    startDate: '2000-02-24',
  },
  {
    id: 'MODIS_Aqua_CorrectedReflectance_TrueColor',
    name: 'MODIS Aqua True Color',
    description: 'Daily true color imagery from MODIS Aqua',
    category: 'trueColor',
    format: 'jpg',
    tileMatrixSet: '250m',
    hasTime: true,
    startDate: '2002-07-04',
  },
  {
    id: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
    name: 'VIIRS NOAA-20 True Color',
    description: 'Daily true color from VIIRS NOAA-20 (higher resolution)',
    category: 'trueColor',
    format: 'jpg',
    tileMatrixSet: '250m',
    hasTime: true,
    startDate: '2018-01-01',
  },
  {
    id: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    name: 'VIIRS SNPP True Color',
    description: 'Daily true color from VIIRS Suomi NPP',
    category: 'trueColor',
    format: 'jpg',
    tileMatrixSet: '250m',
    hasTime: true,
    startDate: '2015-11-24',
  },
  // === VEGETATION LAYERS (NASA Mode only - EPSG:4326) ===
  {
    id: 'MODIS_Terra_L3_NDVI_Monthly',
    name: 'NDVI Vegetation',
    description: 'Monthly NDVI vegetation index (NASA Mode only)',
    category: 'vegetation',
    format: 'png',
    tileMatrixSet: '1km',
    hasTime: true,
    startDate: '2000-03-01',
    requiresNasaMode: true,
  },
  // === THERMAL LAYERS (work in both modes) ===
  {
    id: 'MODIS_Terra_Land_Surface_Temp_Day',
    name: 'Surface Temperature (Day)',
    description: 'Daytime land surface temperature',
    category: 'thermal',
    format: 'png',
    tileMatrixSet: '1km',
    hasTime: true,
    startDate: '2000-02-24',
  },
  // NOTE: Fire detection layers (MODIS/VIIRS Thermal Anomalies) removed -
  // GIBS now serves these as .mvt vector tiles, not raster PNG.
  // Would need a vector tile renderer (e.g., leaflet.vectorgrid) to display them.
  // === ATMOSPHERE LAYERS (NASA Mode only - EPSG:4326) ===
  {
    id: 'MODIS_Combined_MAIAC_L2G_AerosolOpticalDepth',
    name: 'Aerosol Optical Depth',
    description: 'Atmospheric aerosol concentration (NASA Mode only)',
    category: 'atmosphere',
    format: 'png',
    tileMatrixSet: '1km',
    hasTime: true,
    startDate: '2000-02-24',
    requiresNasaMode: true,
  },
  {
    id: 'MODIS_Terra_Cloud_Top_Temp_Day',
    name: 'Cloud Top Temperature',
    description: 'Temperature of cloud tops (NASA Mode only)',
    category: 'atmosphere',
    format: 'png',
    tileMatrixSet: '2km',
    hasTime: true,
    startDate: '2000-02-24',
    requiresNasaMode: true,
  },
];

/**
 * Get all available GIBS layers
 */
export function getGIBSLayers(): GIBSLayer[] {
  return GIBS_LAYERS;
}

/**
 * Get layers by category
 */
export function getLayersByCategory(category: GIBSLayer['category']): GIBSLayer[] {
  return GIBS_LAYERS.filter(l => l.category === category);
}

/**
 * Generate WMTS tile URL template for Leaflet
 * Returns a URL template like: https://gibs.../layer/{Time}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpg
 */
export function getGIBSTileUrl(layerId: string, date?: string): string {
  const layer = GIBS_LAYERS.find(l => l.id === layerId);
  if (!layer) {
    throw new Error(`Unknown GIBS layer: ${layerId}`);
  }

  // Default to yesterday if no date provided (today's data may not be available yet)
  const tileDate = date || getYesterday();

  // WMTS REST URL pattern for Leaflet
  // Leaflet expects {z}/{y}/{x} which maps to TileMatrix/TileRow/TileCol
  const url = `${GIBS_BASE_URL}/${layerId}/default/${tileDate}/${layer.tileMatrixSet}/{z}/{y}/{x}.${layer.format}`;

  return url;
}

/**
 * Generate WMTS capabilities URL for a layer
 */
export function getWMTSCapabilitiesUrl(): string {
  return `${GIBS_BASE_URL}/1.0.0/WMTSCapabilities.xml`;
}

/**
 * Check if a date has data available for a layer
 */
export function isDateAvailable(layerId: string, date: string): boolean {
  const layer = GIBS_LAYERS.find(l => l.id === layerId);
  if (!layer || !layer.startDate) return false;

  const checkDate = new Date(date);
  const startDate = new Date(layer.startDate);
  const today = new Date();

  return checkDate >= startDate && checkDate <= today;
}

/**
 * Get available date range for a layer
 */
export function getDateRange(layerId: string): { start: string; end: string } | null {
  const layer = GIBS_LAYERS.find(l => l.id === layerId);
  if (!layer || !layer.startDate) return null;

  return {
    start: layer.startDate,
    end: getYesterday(), // Data up to yesterday is typically available
  };
}

function getYesterday(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

/**
 * Get Leaflet tile layer configuration
 */
export function getLeafletLayerConfig(layerId: string, date?: string) {
  const layer = GIBS_LAYERS.find(l => l.id === layerId);
  if (!layer) {
    throw new Error(`Unknown GIBS layer: ${layerId}`);
  }

  return {
    url: getGIBSTileUrl(layerId, date),
    options: {
      tileSize: 256,
      minZoom: 1,
      maxZoom: 9,
      attribution: 'NASA GIBS',
      bounds: [[-90, -180], [90, 180]],
    },
  };
}
