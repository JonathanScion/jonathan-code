/**
 * Tile coordinate math for GIBS (EPSG:4326 & EPSG:3857) and OSM tiles.
 */

export interface TileRange {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

type CRS = 'EPSG:4326' | 'EPSG:3857';

// --- EPSG:3857 (Slippy map / OSM / GIBS GoogleMapsCompatible) ---

function lon2tile3857(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * Math.pow(2, zoom);
}

function lat2tile3857(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom);
}

// --- EPSG:4326 (GIBS geographic, 512px tiles) ---
// GIBS EPSG:4326 tile grid:
//   resolution = 0.5625 / 2^z  deg/px
//   tile size = 512 px
//   tile span = 0.5625 / 2^z * 512 = 288 / 2^z degrees per tile
//   origin = (-180, 90)  (top-left)
//   At zoom 0: 2 tiles across (lon), 1 tile tall (lat) – world is 360x180

function lon2tile4326(lon: number, zoom: number): number {
  const tileSpan = 288 / Math.pow(2, zoom);
  return (lon + 180) / tileSpan;
}

function lat2tile4326(lat: number, zoom: number): number {
  const tileSpan = 288 / Math.pow(2, zoom);
  // Origin at top-left (90°N), Y increases downward
  return (90 - lat) / tileSpan;
}

export function boundsToTileRange(bounds: Bounds, zoom: number, crs: CRS): TileRange {
  if (crs === 'EPSG:3857') {
    return {
      minX: Math.floor(lon2tile3857(bounds.west, zoom)),
      maxX: Math.floor(lon2tile3857(bounds.east, zoom)),
      minY: Math.floor(lat2tile3857(bounds.north, zoom)),
      maxY: Math.floor(lat2tile3857(bounds.south, zoom)),
    };
  }

  // EPSG:4326
  return {
    minX: Math.floor(lon2tile4326(bounds.west, zoom)),
    maxX: Math.floor(lon2tile4326(bounds.east, zoom)),
    minY: Math.floor(lat2tile4326(bounds.north, zoom)),
    maxY: Math.floor(lat2tile4326(bounds.south, zoom)),
  };
}

export function getCropRegion(bounds: Bounds, tileRange: TileRange, zoom: number, crs: CRS, tileSize: number): CropRegion {
  if (crs === 'EPSG:3857') {
    const xOffset = (lon2tile3857(bounds.west, zoom) - tileRange.minX) * tileSize;
    const yOffset = (lat2tile3857(bounds.north, zoom) - tileRange.minY) * tileSize;
    const xEnd = (lon2tile3857(bounds.east, zoom) - tileRange.minX) * tileSize;
    const yEnd = (lat2tile3857(bounds.south, zoom) - tileRange.minY) * tileSize;
    return {
      x: Math.round(xOffset),
      y: Math.round(yOffset),
      width: Math.round(xEnd - xOffset),
      height: Math.round(yEnd - yOffset),
    };
  }

  // EPSG:4326
  const xOffset = (lon2tile4326(bounds.west, zoom) - tileRange.minX) * tileSize;
  const yOffset = (lat2tile4326(bounds.north, zoom) - tileRange.minY) * tileSize;
  const xEnd = (lon2tile4326(bounds.east, zoom) - tileRange.minX) * tileSize;
  const yEnd = (lat2tile4326(bounds.south, zoom) - tileRange.minY) * tileSize;
  return {
    x: Math.round(xOffset),
    y: Math.round(yOffset),
    width: Math.round(xEnd - xOffset),
    height: Math.round(yEnd - yOffset),
  };
}

// --- Tile URL builders ---

export function gibsTileUrl4326(layerId: string, date: string, z: number, y: number, x: number): string {
  // Look up the tile matrix set and format from known layers
  const info = GIBS_LAYER_INFO[layerId] || { tileMatrixSet: '250m', format: 'jpg' };
  return `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${layerId}/default/${date}/${info.tileMatrixSet}/${z}/${y}/${x}.${info.format}`;
}

export function gibsTileUrl3857(layerId: string, date: string, z: number, y: number, x: number): string {
  const info = GIBS_LAYER_INFO_3857[layerId] || { tileMatrixSet: 'GoogleMapsCompatible_Level9', format: 'jpg' };
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layerId}/default/${date}/${info.tileMatrixSet}/${z}/${y}/${x}.${info.format}`;
}

export function osmTileUrl(z: number, y: number, x: number): string {
  const s = ['a', 'b', 'c'][Math.abs(x + y) % 3];
  return `https://${s}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

export function blueMarbleTileUrl(z: number, y: number, x: number): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_ShadedRelief_Bathymetry/default/500m/${z}/${y}/${x}.jpeg`;
}

// Tile metadata mirroring the frontend MapViewer definitions
const GIBS_LAYER_INFO: Record<string, { tileMatrixSet: string; format: string; maxZoom: number }> = {
  'MODIS_Terra_CorrectedReflectance_TrueColor': { tileMatrixSet: '250m', format: 'jpg', maxZoom: 8 },
  'MODIS_Aqua_CorrectedReflectance_TrueColor': { tileMatrixSet: '250m', format: 'jpg', maxZoom: 8 },
  'VIIRS_NOAA20_CorrectedReflectance_TrueColor': { tileMatrixSet: '250m', format: 'jpg', maxZoom: 8 },
  'VIIRS_SNPP_CorrectedReflectance_TrueColor': { tileMatrixSet: '250m', format: 'jpg', maxZoom: 8 },
  'MODIS_Terra_L3_NDVI_Monthly': { tileMatrixSet: '1km', format: 'png', maxZoom: 6 },
  'MODIS_Terra_Land_Surface_Temp_Day': { tileMatrixSet: '1km', format: 'png', maxZoom: 6 },
  'MODIS_Combined_MAIAC_L2G_AerosolOpticalDepth': { tileMatrixSet: '1km', format: 'png', maxZoom: 6 },
  'MODIS_Terra_Cloud_Top_Temp_Day': { tileMatrixSet: '2km', format: 'png', maxZoom: 5 },
};

const GIBS_LAYER_INFO_3857: Record<string, { tileMatrixSet: string; format: string; maxZoom: number }> = {
  'MODIS_Terra_CorrectedReflectance_TrueColor': { tileMatrixSet: 'GoogleMapsCompatible_Level9', format: 'jpg', maxZoom: 9 },
  'MODIS_Aqua_CorrectedReflectance_TrueColor': { tileMatrixSet: 'GoogleMapsCompatible_Level9', format: 'jpg', maxZoom: 9 },
  'VIIRS_NOAA20_CorrectedReflectance_TrueColor': { tileMatrixSet: 'GoogleMapsCompatible_Level9', format: 'jpg', maxZoom: 9 },
  'VIIRS_SNPP_CorrectedReflectance_TrueColor': { tileMatrixSet: 'GoogleMapsCompatible_Level9', format: 'jpg', maxZoom: 9 },
  'MODIS_Terra_Land_Surface_Temp_Day': { tileMatrixSet: 'GoogleMapsCompatible_Level7', format: 'png', maxZoom: 7 },
};

export function getLayerMaxZoom(layerId: string, crs: CRS): number {
  const info = crs === 'EPSG:4326' ? GIBS_LAYER_INFO[layerId] : GIBS_LAYER_INFO_3857[layerId];
  return info?.maxZoom ?? 8;
}

export function getTileSize(crs: CRS): number {
  return crs === 'EPSG:4326' ? 512 : 256;
}
