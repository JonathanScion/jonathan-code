import { fromUrl } from 'geotiff';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from './s3';

export interface GeoTIFFMetadata {
  width: number;
  height: number;
  bands: number;
  bitDepth: number;
  centerPoint?: {
    lat: number;
    lon: number;
  };
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

/**
 * Extract metadata from a GeoTIFF file stored in S3
 */
export async function extractGeoTIFFMetadata(
  bucket: string,
  key: string
): Promise<GeoTIFFMetadata> {
  try {
    // Generate a temporary presigned URL to read the file
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    // Load the GeoTIFF
    const tiff = await fromUrl(presignedUrl);
    const image = await tiff.getImage();

    // Get basic image properties
    const width = image.getWidth();
    const height = image.getHeight();
    const samplesPerPixel = image.getSamplesPerPixel();
    const bitsPerSample = image.getBitsPerSample()[0] || 8;

    // Get geographic bounds
    const bbox = image.getBoundingBox();
    let centerPoint: { lat: number; lon: number } | undefined;
    let bounds: { north: number; south: number; east: number; west: number } | undefined;

    if (bbox && bbox.length === 4) {
      // bbox format is [minX, minY, maxX, maxY] in the coordinate system of the image
      const [west, south, east, north] = bbox;

      // Check if coordinates are in a reasonable lat/lon range
      // Latitude: -90 to 90, Longitude: -180 to 180
      const isValidLatLon =
        south >= -90 && south <= 90 &&
        north >= -90 && north <= 90 &&
        west >= -180 && west <= 180 &&
        east >= -180 && east <= 180;

      if (isValidLatLon) {
        bounds = { north, south, east, west };
        centerPoint = {
          lat: (north + south) / 2,
          lon: (east + west) / 2,
        };
      } else {
        console.log('Coordinates appear to be in a projected coordinate system:', bbox);
        // TODO: In the future, we could add coordinate transformation here
        // For now, we'll leave centerPoint and bounds undefined if not in lat/lon
      }
    }

    return {
      width,
      height,
      bands: samplesPerPixel,
      bitDepth: bitsPerSample,
      centerPoint,
      bounds,
    };
  } catch (error) {
    console.error('Error extracting GeoTIFF metadata:', error);
    throw new Error(`Failed to extract GeoTIFF metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
