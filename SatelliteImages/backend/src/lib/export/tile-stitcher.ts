/**
 * Stitches tiles into a canvas and composites multiple layers using Sharp.
 */
import sharp from 'sharp';
import type { TileRange, CropRegion } from './tile-math';
import type { TileResult } from './tile-fetcher';

export interface StitchedImage {
  buffer: Buffer; // raw RGB(A) pixel data
  width: number;
  height: number;
  channels: 3 | 4;
}

/**
 * Stitch an array of tile results into a single image.
 */
export async function stitchTiles(
  tiles: TileResult[],
  tileRange: TileRange,
  tileSize: number
): Promise<Buffer> {
  const cols = tileRange.maxX - tileRange.minX + 1;
  const rows = tileRange.maxY - tileRange.minY + 1;
  const canvasW = cols * tileSize;
  const canvasH = rows * tileSize;

  // Build composite input array
  const composites: sharp.OverlayOptions[] = [];

  for (const tile of tiles) {
    if (!tile.buffer) continue;

    const left = (tile.x - tileRange.minX) * tileSize;
    const top = (tile.y - tileRange.minY) * tileSize;

    composites.push({
      input: tile.buffer,
      left,
      top,
    });
  }

  // Create transparent canvas and composite tiles onto it
  const canvas = sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).png();

  if (composites.length > 0) {
    return canvas.composite(composites).png().toBuffer();
  }

  return canvas.toBuffer();
}

/**
 * Composite multiple layer images (bottom-to-top) with opacity.
 * Each layer is a PNG buffer at the same dimensions.
 */
export async function compositeLayers(
  layers: { buffer: Buffer; opacity: number }[],
  width: number,
  height: number
): Promise<Buffer> {
  if (layers.length === 0) {
    throw new Error('No layers to composite');
  }

  if (layers.length === 1) {
    // Single layer – just apply opacity if needed
    const l = layers[0];
    if (l.opacity < 1) {
      return applyOpacity(l.buffer, l.opacity);
    }
    return l.buffer;
  }

  // Start with the bottom layer
  let result = layers[0].opacity < 1
    ? await applyOpacity(layers[0].buffer, layers[0].opacity)
    : layers[0].buffer;

  // Composite each subsequent layer on top
  for (let i = 1; i < layers.length; i++) {
    const overlay = layers[i].opacity < 1
      ? await applyOpacity(layers[i].buffer, layers[i].opacity)
      : layers[i].buffer;

    result = await sharp(result)
      .composite([{ input: overlay }])
      .png()
      .toBuffer();
  }

  return result;
}

/**
 * Crop the composited image to exact bounds.
 */
export async function cropToRegion(
  imageBuffer: Buffer,
  crop: CropRegion
): Promise<StitchedImage> {
  const cropped = sharp(imageBuffer)
    .extract({
      left: crop.x,
      top: crop.y,
      width: crop.width,
      height: crop.height,
    })
    .removeAlpha()
    .raw();

  const { data, info } = await cropped.toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    channels: info.channels as 3 | 4,
  };
}

async function applyOpacity(pngBuffer: Buffer, opacity: number): Promise<Buffer> {
  // Extract raw RGBA, multiply alpha channel, re-encode
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Multiply each alpha byte
  const factor = Math.round(opacity * 255);
  for (let i = 3; i < data.length; i += 4) {
    data[i] = Math.round((data[i] * factor) / 255);
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}
