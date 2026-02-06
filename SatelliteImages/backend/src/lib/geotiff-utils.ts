import { fromFile } from 'geotiff';
import * as fs from 'fs';
import proj4 from 'proj4';

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

// Register common projections that proj4 doesn't have built-in
// These cover the most common national grids
const PROJ4_DEFINITIONS: Record<number, string> = {
  // Israeli Grids
  6991: '+proj=tmerc +lat_0=31.7343936111111 +lon_0=35.2045169444444 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +units=m +no_defs',
  2039: '+proj=tmerc +lat_0=31.7343936111111 +lon_0=35.2045169444444 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +units=m +no_defs',
  6984: '+proj=tmerc +lat_0=31.7343936111111 +lon_0=35.2045169444444 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +units=m +no_defs',

  // British National Grid
  27700: '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +units=m +no_defs',

  // France Lambert 93
  2154: '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +units=m +no_defs',

  // Netherlands RD New
  28992: '+proj=sterea +lat_0=52.1561605555556 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +units=m +no_defs',

  // Germany Gauss-Krüger zones
  31466: '+proj=tmerc +lat_0=0 +lon_0=6 +k=1 +x_0=2500000 +y_0=0 +ellps=bessel +units=m +no_defs',
  31467: '+proj=tmerc +lat_0=0 +lon_0=9 +k=1 +x_0=3500000 +y_0=0 +ellps=bessel +units=m +no_defs',
  31468: '+proj=tmerc +lat_0=0 +lon_0=12 +k=1 +x_0=4500000 +y_0=0 +ellps=bessel +units=m +no_defs',
  31469: '+proj=tmerc +lat_0=0 +lon_0=15 +k=1 +x_0=5500000 +y_0=0 +ellps=bessel +units=m +no_defs',

  // Switzerland
  2056: '+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +units=m +no_defs',

  // Spain
  25830: '+proj=utm +zone=30 +ellps=GRS80 +units=m +no_defs',

  // Australia MGA zones
  28349: '+proj=utm +zone=49 +south +ellps=GRS80 +units=m +no_defs',
  28350: '+proj=utm +zone=50 +south +ellps=GRS80 +units=m +no_defs',
  28351: '+proj=utm +zone=51 +south +ellps=GRS80 +units=m +no_defs',
  28352: '+proj=utm +zone=52 +south +ellps=GRS80 +units=m +no_defs',
  28353: '+proj=utm +zone=53 +south +ellps=GRS80 +units=m +no_defs',
  28354: '+proj=utm +zone=54 +south +ellps=GRS80 +units=m +no_defs',
  28355: '+proj=utm +zone=55 +south +ellps=GRS80 +units=m +no_defs',
  28356: '+proj=utm +zone=56 +south +ellps=GRS80 +units=m +no_defs',

  // Japan Plane Rectangular (common zones)
  2451: '+proj=tmerc +lat_0=36 +lon_0=139.833333333333 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',
  6677: '+proj=tmerc +lat_0=36 +lon_0=139.833333333333 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',

  // Web Mercator
  3857: '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +no_defs',
};

// Register UTM zones dynamically
function getUTMProj4(zone: number, isNorth: boolean): string {
  return `+proj=utm +zone=${zone} ${isNorth ? '' : '+south '}+ellps=WGS84 +datum=WGS84 +units=m +no_defs`;
}

/**
 * Get proj4 definition for an EPSG code
 */
async function getProj4Definition(epsgCode: number): Promise<string | null> {
  // Check our built-in definitions first
  if (PROJ4_DEFINITIONS[epsgCode]) {
    return PROJ4_DEFINITIONS[epsgCode];
  }

  // Handle UTM zones (EPSG 326XX for north, 327XX for south)
  if (epsgCode >= 32601 && epsgCode <= 32660) {
    return getUTMProj4(epsgCode - 32600, true);
  }
  if (epsgCode >= 32701 && epsgCode <= 32760) {
    return getUTMProj4(epsgCode - 32700, false);
  }

  // Try to fetch from epsg.io for unknown codes
  try {
    console.log(`Fetching proj4 definition for EPSG:${epsgCode} from epsg.io...`);
    const response = await fetch(`https://epsg.io/${epsgCode}.proj4`);
    if (response.ok) {
      const proj4String = await response.text();
      if (proj4String && proj4String.startsWith('+proj')) {
        console.log(`Got proj4 definition: ${proj4String.substring(0, 50)}...`);
        return proj4String.trim();
      }
    }
  } catch (err) {
    console.log(`Could not fetch proj4 definition for EPSG:${epsgCode}:`, err);
  }

  return null;
}

/**
 * Transform coordinates from source CRS to WGS84
 */
function transformToWGS84(x: number, y: number, sourceProj4: string): { lat: number; lon: number } {
  const WGS84 = '+proj=longlat +datum=WGS84 +no_defs';
  const result = proj4(sourceProj4, WGS84, [x, y]);
  return { lon: result[0], lat: result[1] };
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
        // Coordinates are in a projected CRS - need to transform
        console.log('Coordinates in projected CRS, attempting transformation with proj4...');

        let proj4Def: string | null = null;
        let epsgCode: number | null = null;

        // Try to get EPSG code from GeoKeys
        try {
          const geoKeys = image.getGeoKeys();
          console.log('GeoKeys:', JSON.stringify(geoKeys, null, 2));

          if (geoKeys?.ProjectedCSTypeGeoKey) {
            epsgCode = geoKeys.ProjectedCSTypeGeoKey;
            console.log('Found EPSG code:', epsgCode);
            proj4Def = await getProj4Definition(epsgCode);
          } else if (geoKeys?.GeographicTypeGeoKey) {
            // It's a geographic CRS, not projected
            const geoCode = geoKeys.GeographicTypeGeoKey;
            console.log('Geographic CRS code:', geoCode);
            // If it's WGS84 (4326) or similar, coordinates should already be lat/lon
            // But they weren't in valid range, so something is off
          }
        } catch (geoKeyErr) {
          console.log('Could not read GeoKeys:', geoKeyErr);
        }

        // Transform if we have a proj4 definition
        if (proj4Def) {
          try {
            console.log('Transforming with proj4...');
            const sw = transformToWGS84(minX, minY, proj4Def);
            const ne = transformToWGS84(maxX, maxY, proj4Def);

            console.log('Transformed SW corner:', sw);
            console.log('Transformed NE corner:', ne);

            // Validate transformation results
            if (sw.lat >= -90 && sw.lat <= 90 && sw.lon >= -180 && sw.lon <= 180 &&
                ne.lat >= -90 && ne.lat <= 90 && ne.lon >= -180 && ne.lon <= 180) {
              bounds = {
                south: Math.min(sw.lat, ne.lat),
                north: Math.max(sw.lat, ne.lat),
                west: Math.min(sw.lon, ne.lon),
                east: Math.max(sw.lon, ne.lon),
              };
              centerPoint = {
                lat: (bounds.south + bounds.north) / 2,
                lon: (bounds.west + bounds.east) / 2,
              };
              console.log('Final bounds:', bounds);
              console.log('Final center point:', centerPoint);
            } else {
              console.error('Transformation produced invalid coordinates:', { sw, ne });
            }
          } catch (transformErr) {
            console.error('Coordinate transformation failed:', transformErr);
          }
        } else {
          console.log(`No proj4 definition available for EPSG:${epsgCode || 'unknown'}`);
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
