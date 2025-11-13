import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function calculateBoundingBoxArea(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}): number {
  // Approximate area in square kilometers
  const R = 6371; // Earth's radius in km
  const latDiff = (bounds.north - bounds.south) * (Math.PI / 180);
  const lonDiff = (bounds.east - bounds.west) * (Math.PI / 180);
  const avgLat = ((bounds.north + bounds.south) / 2) * (Math.PI / 180);

  const area = R * R * Math.abs(latDiff * lonDiff * Math.cos(avgLat));
  return area;
}

export function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function downloadFile(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export interface GeoCoordinates {
  centerPoint: {
    lat: number;
    lon: number;
  };
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface GeoTIFFMetadata extends GeoCoordinates {
  width?: number;
  height?: number;
  bands?: number;
  bitDepth?: number;
  resolution?: number; // meters per pixel
  capturedAt?: string; // ISO date string
  satelliteName?: string;
  sensorType?: string;
  projection?: string;
  cloudCoverage?: number;
}

function detectSatelliteFromFilename(filename: string): { satelliteName?: string; sensorType?: string } {
  const name = filename.toUpperCase();

  // Sentinel-2
  if (name.includes('S2A') || name.includes('SENTINEL-2A') || name.includes('S2A_')) {
    return { satelliteName: 'Sentinel-2A', sensorType: 'MSI' };
  }
  if (name.includes('S2B') || name.includes('SENTINEL-2B') || name.includes('S2B_')) {
    return { satelliteName: 'Sentinel-2B', sensorType: 'MSI' };
  }
  if (name.includes('SENTINEL-2') || name.includes('S2_')) {
    return { satelliteName: 'Sentinel-2', sensorType: 'MSI' };
  }

  // Landsat
  if (name.includes('LC08') || name.includes('LANDSAT-8') || name.includes('L8_')) {
    return { satelliteName: 'Landsat-8', sensorType: 'OLI/TIRS' };
  }
  if (name.includes('LC09') || name.includes('LANDSAT-9') || name.includes('L9_')) {
    return { satelliteName: 'Landsat-9', sensorType: 'OLI-2/TIRS-2' };
  }
  if (name.includes('LE07') || name.includes('LANDSAT-7')) {
    return { satelliteName: 'Landsat-7', sensorType: 'ETM+' };
  }

  // MODIS
  if (name.includes('MOD') || name.includes('MYD') || name.includes('MODIS')) {
    return { satelliteName: 'MODIS', sensorType: 'MODIS' };
  }

  return {};
}

export async function extractGeoTIFFMetadata(file: File): Promise<GeoTIFFMetadata | null> {
  try {
    const { fromArrayBuffer } = await import('geotiff');

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Parse GeoTIFF
    const tiff = await fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();

    // Get bounding box [west, south, east, north]
    const bbox = image.getBoundingBox();

    if (!bbox || bbox.length !== 4) {
      console.warn('No valid bounding box found in GeoTIFF');
      return null;
    }

    const [west, south, east, north] = bbox;

    // Calculate center point
    const centerPoint = {
      lat: (north + south) / 2,
      lon: (east + west) / 2,
    };

    const bounds = {
      north,
      south,
      east,
      west,
    };

    // Extract image dimensions
    const width = image.getWidth();
    const height = image.getHeight();

    // Extract bands (samples per pixel)
    const bands = image.getSamplesPerPixel();

    // Extract bit depth - ensure we get a number, not an array
    const bitsPerSample = image.fileDirectory.BitsPerSample;
    let bitDepth: number | undefined;
    if (Array.isArray(bitsPerSample)) {
      bitDepth = typeof bitsPerSample[0] === 'number' ? bitsPerSample[0] : undefined;
    } else if (typeof bitsPerSample === 'number') {
      bitDepth = bitsPerSample;
    }

    // Calculate resolution (meters per pixel) from pixel scale
    const pixelScale = image.fileDirectory.ModelPixelScale;
    let resolution: number | undefined;
    if (pixelScale && Array.isArray(pixelScale) && pixelScale.length >= 2) {
      // Average of X and Y pixel scale
      resolution = Math.round((pixelScale[0] + pixelScale[1]) / 2);
    }

    // Extract capture date from TIFF DateTime tag
    let capturedAt: string | undefined;
    const dateTime = image.fileDirectory.DateTime;
    if (dateTime) {
      try {
        // TIFF DateTime format: "YYYY:MM:DD HH:MM:SS"
        const normalized = dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
        const date = new Date(normalized);
        if (!isNaN(date.getTime())) {
          capturedAt = date.toISOString();
        }
      } catch (e) {
        console.warn('Failed to parse DateTime tag:', dateTime);
      }
    }

    // Detect satellite from filename
    const { satelliteName, sensorType } = detectSatelliteFromFilename(file.name);

    // Get projection info
    let projection: string | undefined;
    const geoKeyDirectory = image.fileDirectory.GeoKeyDirectory;
    if (geoKeyDirectory) {
      // Try to extract EPSG code or projection name
      // This is simplified - real implementation would parse GeoKeys properly
      projection = 'Geographic'; // Default
    }

    const metadata: GeoTIFFMetadata = {
      centerPoint,
      bounds,
      width,
      height,
      bands,
      bitDepth,
      resolution,
      capturedAt,
      satelliteName,
      sensorType,
      projection,
    };

    console.log('Extracted GeoTIFF metadata:', metadata);

    return metadata;
  } catch (error) {
    console.error('Failed to extract GeoTIFF metadata:', error);
    return null;
  }
}

// Keep old function for backward compatibility
export async function extractGeoTIFFCoordinates(file: File): Promise<GeoCoordinates | null> {
  const metadata = await extractGeoTIFFMetadata(file);
  if (!metadata) return null;

  return {
    centerPoint: metadata.centerPoint,
    bounds: metadata.bounds,
  };
}
