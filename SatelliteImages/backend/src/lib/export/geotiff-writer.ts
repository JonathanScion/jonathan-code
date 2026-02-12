/**
 * Creates a GeoTIFF with embedded geospatial metadata.
 *
 * geotiff v2 writeGeotiff quirks:
 *  - Flat array (typeof data[0] === 'number') → reads metadata.width/height
 *  - GeoKeys must be set as top-level metadata properties (e.g. GeographicTypeGeoKey)
 *    NOT inside a GeoKeyDirectory array — the library builds GeoKeyDirectory from them.
 *  - If GeographicTypeGeoKey / ProjectedCSTypeGeoKey are missing as properties,
 *    the library overwrites ModelTiepoint with globe defaults.
 */
import { writeArrayBuffer } from 'geotiff';
import proj4 from 'proj4';
import type { Bounds } from './tile-math';

export async function createGeoTIFF(
  pixelData: Buffer,
  width: number,
  height: number,
  channels: number,
  bounds: Bounds,
  crs: 'EPSG:4326' | 'EPSG:3857'
): Promise<Buffer> {
  if (!width || !height) {
    throw new Error(`Invalid image dimensions: ${width}x${height}`);
  }

  const totalPixels = width * height;
  const flatValues = new Array(totalPixels * channels);
  for (let i = 0; i < totalPixels; i++) {
    for (let b = 0; b < channels; b++) {
      flatValues[i * channels + b] = pixelData[i * channels + b];
    }
  }

  let metadata: Record<string, any>;

  if (crs === 'EPSG:4326') {
    const pixelScaleX = (bounds.east - bounds.west) / width;
    const pixelScaleY = (bounds.north - bounds.south) / height;

    metadata = {
      height,
      width,
      ModelTiepoint: [0, 0, 0, bounds.west, bounds.north, 0],
      ModelPixelScale: [pixelScaleX, pixelScaleY, 0],
      // GeoKeys as top-level properties — library builds GeoKeyDirectory from these
      GTModelTypeGeoKey: 2,        // ModelTypeGeographic
      GTRasterTypeGeoKey: 1,       // RasterPixelIsArea
      GeographicTypeGeoKey: 4326,
    };
  } else {
    const [westM, southM] = proj4('EPSG:4326', 'EPSG:3857', [bounds.west, bounds.south]);
    const [eastM, northM] = proj4('EPSG:4326', 'EPSG:3857', [bounds.east, bounds.north]);

    const pixelScaleX = (eastM - westM) / width;
    const pixelScaleY = (northM - southM) / height;

    metadata = {
      height,
      width,
      ModelTiepoint: [0, 0, 0, westM, northM, 0],
      ModelPixelScale: [pixelScaleX, pixelScaleY, 0],
      GTModelTypeGeoKey: 1,        // ModelTypeProjected
      GTRasterTypeGeoKey: 1,       // RasterPixelIsArea
      ProjectedCSTypeGeoKey: 3857,
    };
  }

  const arrayBuffer = await writeArrayBuffer(flatValues, metadata);
  return Buffer.from(arrayBuffer);
}
