import { fromFile } from 'geotiff';
import * as fs from 'fs';

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
 * Transform UTM coordinates to WGS84 lat/lon
 * Manual implementation to avoid proj4 import issues
 */
function utmToLatLon(easting: number, northing: number, zone: number, isNorthernHemisphere: boolean): { lat: number; lon: number } {
  // UTM to Lat/Lon conversion constants
  const k0 = 0.9996;
  const a = 6378137; // WGS84 semi-major axis
  const e = 0.081819191; // WGS84 eccentricity
  const e1sq = 0.006739497;
  const e2 = e * e;
  const e4 = e2 * e2;
  const e6 = e4 * e2;

  // Remove false easting and northing
  const x = easting - 500000;
  const y = isNorthernHemisphere ? northing : northing - 10000000;

  // Central meridian of the zone
  const lonOrigin = (zone - 1) * 6 - 180 + 3;

  const M = y / k0;
  const mu = M / (a * (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256));

  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

  const phi1 = mu + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu)
    + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu)
    + (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu);

  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1));
  const T1 = Math.tan(phi1) * Math.tan(phi1);
  const C1 = e1sq * Math.cos(phi1) * Math.cos(phi1);
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5);
  const D = x / (N1 * k0);

  const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (D * D / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e1sq) * Math.pow(D, 4) / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * e1sq - 3 * C1 * C1) * Math.pow(D, 6) / 720);

  const lon = (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * e1sq + 24 * T1 * T1) * Math.pow(D, 5) / 120) / Math.cos(phi1);

  // Convert to degrees
  const latDeg = lat * 180 / Math.PI;
  const lonDeg = lonOrigin + lon * 180 / Math.PI;

  return { lat: latDeg, lon: lonDeg };
}

/**
 * Guess UTM zone from coordinates
 * For demo purposes, we'll try common zones for the demo images
 */
function guessUTMZone(easting: number, northing: number): { zone: number; isNorth: boolean } | null {
  // Northing > 0 and reasonable range suggests northern hemisphere
  // Typical UTM northing for LA area (~34°N) is around 3.7-3.8 million meters
  // For Maui (~20°N) it's around 2.2 million meters
  // For Spain/Valencia (~39°N) it's around 4.3 million meters

  const isNorth = northing > 0;

  // Try to guess zone based on northing value
  if (northing >= 3700000 && northing <= 3900000) {
    // LA area - Zone 11
    return { zone: 11, isNorth: true };
  } else if (northing >= 2200000 && northing <= 2400000) {
    // Hawaii/Maui area - Zone 4
    return { zone: 4, isNorth: true };
  } else if (northing >= 4300000 && northing <= 4500000) {
    // Spain/Valencia area - Zone 30
    return { zone: 30, isNorth: true };
  }

  // Default to Zone 11 for LA demo
  return { zone: 11, isNorth: true };
}

/**
 * Extract metadata from a local GeoTIFF file
 */
export async function extractLocalGeoTIFFMetadata(
  filePath: string
): Promise<GeoTIFFMetadata> {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    console.log('Reading GeoTIFF:', filePath);

    // Load the GeoTIFF from local file
    const tiff = await fromFile(filePath);
    const image = await tiff.getImage();

    // Get basic image properties
    const width = image.getWidth();
    const height = image.getHeight();
    const samplesPerPixel = image.getSamplesPerPixel();
    const bitsPerSample = image.getBitsPerSample()[0] || 8;

    console.log(`Image dimensions: ${width}x${height}, bands: ${samplesPerPixel}, bits: ${bitsPerSample}`);

    // Get geographic bounds
    const bbox = image.getBoundingBox();
    let centerPoint: { lat: number; lon: number } | undefined;
    let bounds: { north: number; south: number; east: number; west: number } | undefined;

    if (bbox && bbox.length === 4) {
      const [minX, minY, maxX, maxY] = bbox;
      console.log('Raw bounding box:', { minX, minY, maxX, maxY });

      // Check if coordinates are already in lat/lon range
      const isValidLatLon =
        minY >= -90 && minY <= 90 &&
        maxY >= -90 && maxY <= 90 &&
        minX >= -180 && minX <= 180 &&
        maxX >= -180 && maxX <= 180;

      if (isValidLatLon) {
        console.log('Coordinates already in lat/lon format');
        bounds = { north: maxY, south: minY, east: maxX, west: minX };
        centerPoint = {
          lat: (maxY + minY) / 2,
          lon: (maxX + minX) / 2,
        };
      } else {
        // Coordinates are in a projected CRS (likely UTM)
        console.log('Coordinates appear to be in projected CRS, attempting transformation...');

        // Try to get UTM zone from GeoKeys
        let utmZone: number | null = null;
        let isNorthernHemisphere = true;

        try {
          const geoKeys = image.getGeoKeys();
          console.log('GeoKeys:', JSON.stringify(geoKeys, null, 2));

          if (geoKeys?.ProjectedCSTypeGeoKey) {
            const epsgCode = geoKeys.ProjectedCSTypeGeoKey;
            console.log('Found EPSG code:', epsgCode);

            // EPSG 326XX = UTM Northern Hemisphere
            // EPSG 327XX = UTM Southern Hemisphere
            if (epsgCode >= 32601 && epsgCode <= 32660) {
              utmZone = epsgCode - 32600;
              isNorthernHemisphere = true;
              console.log(`Detected UTM Zone ${utmZone}N from EPSG`);
            } else if (epsgCode >= 32701 && epsgCode <= 32760) {
              utmZone = epsgCode - 32700;
              isNorthernHemisphere = false;
              console.log(`Detected UTM Zone ${utmZone}S from EPSG`);
            }
          }
        } catch (geoKeyErr) {
          console.log('Could not read GeoKeys:', geoKeyErr);
        }

        // If no UTM zone from GeoKeys, try to guess
        if (!utmZone) {
          const guessed = guessUTMZone(minX, minY);
          if (guessed) {
            utmZone = guessed.zone;
            isNorthernHemisphere = guessed.isNorth;
            console.log(`Guessed UTM Zone ${utmZone}${isNorthernHemisphere ? 'N' : 'S'} from coordinates`);
          }
        }

        // Transform coordinates
        if (utmZone) {
          try {
            const sw = utmToLatLon(minX, minY, utmZone, isNorthernHemisphere);
            const ne = utmToLatLon(maxX, maxY, utmZone, isNorthernHemisphere);

            console.log('Transformed SW corner:', sw);
            console.log('Transformed NE corner:', ne);

            // Validate transformation results
            if (sw.lat >= -90 && sw.lat <= 90 && sw.lon >= -180 && sw.lon <= 180 &&
                ne.lat >= -90 && ne.lat <= 90 && ne.lon >= -180 && ne.lon <= 180) {
              bounds = {
                south: sw.lat,
                west: sw.lon,
                north: ne.lat,
                east: ne.lon,
              };
              centerPoint = {
                lat: (sw.lat + ne.lat) / 2,
                lon: (sw.lon + ne.lon) / 2,
              };
              console.log('Final bounds:', bounds);
              console.log('Final center point:', centerPoint);
            } else {
              console.error('Transformation produced invalid coordinates');
            }
          } catch (transformErr) {
            console.error('Coordinate transformation failed:', transformErr);
          }
        }
      }
    } else {
      console.log('No bounding box found in GeoTIFF');
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
    console.error('Error extracting local GeoTIFF metadata:', error);
    throw new Error(`Failed to extract GeoTIFF metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
