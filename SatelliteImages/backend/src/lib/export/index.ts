/**
 * GeoTIFF export orchestrator.
 * Takes map view parameters, fetches tiles, composites layers, and outputs a GeoTIFF.
 */
import type { MapExportRequest } from '@shared/types';
import {
  boundsToTileRange,
  getCropRegion,
  getTileSize,
  getLayerMaxZoom,
  gibsTileUrl4326,
  gibsTileUrl3857,
  osmTileUrl,
  blueMarbleTileUrl,
  type Bounds,
} from './tile-math';
import { fetchTiles } from './tile-fetcher';
import { stitchTiles, compositeLayers, cropToRegion } from './tile-stitcher';
import { createGeoTIFF } from './geotiff-writer';

const MAX_CANVAS_DIM = 8192;

export async function exportGeoTIFF(request: MapExportRequest): Promise<Buffer> {
  const crs = request.projectionMode === 'nasaMode' ? 'EPSG:4326' as const : 'EPSG:3857' as const;
  const tileSize = getTileSize(crs);
  const bounds: Bounds = request.bounds;

  // Clamp zoom to maximum available for layers
  let zoom = request.zoom;
  for (const layer of request.layers) {
    const maxZ = getLayerMaxZoom(layer.id, crs);
    zoom = Math.min(zoom, maxZ);
  }
  // Ensure zoom is at least 1
  zoom = Math.max(1, zoom);

  const tileRange = boundsToTileRange(bounds, zoom, crs);

  // Guard against canvas too large
  const cols = tileRange.maxX - tileRange.minX + 1;
  const rows = tileRange.maxY - tileRange.minY + 1;
  const canvasW = cols * tileSize;
  const canvasH = rows * tileSize;

  if (canvasW > MAX_CANVAS_DIM || canvasH > MAX_CANVAS_DIM) {
    throw new Error(
      `Export area too large at zoom ${zoom} (${canvasW}x${canvasH}px). ` +
      `Zoom out or select a smaller area. Max: ${MAX_CANVAS_DIM}x${MAX_CANVAS_DIM}px.`
    );
  }

  const crop = getCropRegion(bounds, tileRange, zoom, crs, tileSize);

  if (crop.width <= 0 || crop.height <= 0) {
    throw new Error('Invalid export bounds – cropped region has zero dimensions.');
  }

  // Build all layer images to composite
  const layerBuffers: { buffer: Buffer; opacity: number }[] = [];

  // 1. Base layer
  if (request.includeBaseLayer) {
    const baseJobs = [];
    for (let y = tileRange.minY; y <= tileRange.maxY; y++) {
      for (let x = tileRange.minX; x <= tileRange.maxX; x++) {
        const url = crs === 'EPSG:4326'
          ? blueMarbleTileUrl(zoom, y, x)
          : osmTileUrl(zoom, y, x);
        baseJobs.push({ url, x, y });
      }
    }

    const baseTiles = await fetchTiles(baseJobs, 6);
    const basePng = await stitchTiles(baseTiles, tileRange, tileSize);
    layerBuffers.push({ buffer: basePng, opacity: 1 });
  }

  // 2. Overlay layers (in order provided – bottom to top)
  for (const layer of request.layers) {
    const layerZoom = Math.min(zoom, getLayerMaxZoom(layer.id, crs));
    const layerTileRange = boundsToTileRange(bounds, layerZoom, crs);
    const layerTileSize = tileSize;

    const jobs = [];
    for (let y = layerTileRange.minY; y <= layerTileRange.maxY; y++) {
      for (let x = layerTileRange.minX; x <= layerTileRange.maxX; x++) {
        const url = crs === 'EPSG:4326'
          ? gibsTileUrl4326(layer.id, layer.date, layerZoom, y, x)
          : gibsTileUrl3857(layer.id, layer.date, layerZoom, y, x);
        jobs.push({ url, x, y });
      }
    }

    const tiles = await fetchTiles(jobs, 6);
    const layerPng = await stitchTiles(tiles, layerTileRange, layerTileSize);

    // If overlay was fetched at a different zoom, resize to match the main canvas
    const layerCols = layerTileRange.maxX - layerTileRange.minX + 1;
    const layerRows = layerTileRange.maxY - layerTileRange.minY + 1;
    const layerW = layerCols * layerTileSize;
    const layerH = layerRows * layerTileSize;

    let finalLayerPng = layerPng;
    if (layerW !== canvasW || layerH !== canvasH) {
      // Need to resize to match the main canvas
      const sharp = (await import('sharp')).default;
      finalLayerPng = await sharp(layerPng)
        .resize(canvasW, canvasH, { fit: 'fill' })
        .png()
        .toBuffer();
    }

    layerBuffers.push({ buffer: finalLayerPng, opacity: layer.opacity });
  }

  if (layerBuffers.length === 0) {
    throw new Error('No layers to export. Enable at least one layer or include the base layer.');
  }

  // Composite all layers
  const compositedPng = await compositeLayers(layerBuffers, canvasW, canvasH);

  // Crop to exact bounds
  const stitched = await cropToRegion(compositedPng, crop);

  // Create GeoTIFF
  const geotiffBuffer = await createGeoTIFF(
    stitched.buffer,
    stitched.width,
    stitched.height,
    stitched.channels,
    bounds,
    crs
  );

  return geotiffBuffer;
}
