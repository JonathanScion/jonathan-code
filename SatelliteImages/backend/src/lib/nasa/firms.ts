/**
 * NASA FIRMS (Fire Information for Resource Management System) API Client
 * Get active fire/thermal anomaly data
 * Requires free API key from: https://firms.modaps.eosdis.nasa.gov/api/area/
 */

import axios from 'axios';

const FIRMS_BASE_URL = 'https://firms.modaps.eosdis.nasa.gov/api';

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface FirePoint {
  latitude: number;
  longitude: number;
  brightness: number;
  scan: number;
  track: number;
  acqDate: string;
  acqTime: string;
  satellite: string;
  confidence: number;
  version: string;
  brightT31?: number;
  frp: number; // Fire Radiative Power
  dayNight: 'D' | 'N';
}

export interface FIRMSResult {
  fires: FirePoint[];
  total: number;
  source: string;
  bbox: BoundingBox;
  dateRange: { start: string; end: string };
}

export type FIRMSSource =
  | 'MODIS_NRT'      // MODIS Near Real-Time
  | 'MODIS_SP'       // MODIS Standard Processing
  | 'VIIRS_NOAA20_NRT'
  | 'VIIRS_NOAA21_NRT'
  | 'VIIRS_SNPP_NRT'
  | 'LANDSAT_NRT';   // Highest resolution (30m)

/**
 * Get fire data for a bounding box
 * @param apiKey - NASA FIRMS API key
 * @param bbox - Bounding box coordinates
 * @param days - Number of days to look back (1-10)
 * @param source - Data source (MODIS, VIIRS, LANDSAT)
 */
export async function getFireData(
  apiKey: string,
  bbox: BoundingBox,
  days: number = 1,
  source: FIRMSSource = 'VIIRS_NOAA20_NRT'
): Promise<FIRMSResult> {
  if (!apiKey) {
    throw new Error('NASA FIRMS API key is required');
  }

  // Clamp days to valid range
  const validDays = Math.max(1, Math.min(10, days));

  // Format bbox: west,south,east,north
  const bboxStr = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;

  try {
    const url = `${FIRMS_BASE_URL}/area/csv/${apiKey}/${source}/${bboxStr}/${validDays}`;

    const response = await axios.get(url, {
      headers: {
        Accept: 'text/csv',
      },
    });

    const fires = parseCSV(response.data);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - validDays);

    return {
      fires,
      total: fires.length,
      source,
      bbox,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
    };
  } catch (error: any) {
    if (error.response?.status === 429) {
      throw new Error('FIRMS rate limit exceeded. Please wait and try again.');
    }
    console.error('FIRMS API error:', error.message);
    throw new Error(`FIRMS API error: ${error.message}`);
  }
}

/**
 * Check if location has recent fire activity
 */
export async function hasRecentFires(
  apiKey: string,
  lat: number,
  lon: number,
  radiusKm: number = 50,
  days: number = 7
): Promise<{ hasFires: boolean; count: number; nearestKm?: number }> {
  // Create a bounding box around the point
  // Rough approximation: 1 degree ≈ 111 km
  const radiusDeg = radiusKm / 111;
  const bbox: BoundingBox = {
    north: lat + radiusDeg,
    south: lat - radiusDeg,
    east: lon + radiusDeg,
    west: lon - radiusDeg,
  };

  const result = await getFireData(apiKey, bbox, days);

  if (result.fires.length === 0) {
    return { hasFires: false, count: 0 };
  }

  // Find nearest fire
  let nearestKm = Infinity;
  for (const fire of result.fires) {
    const distance = haversineDistance(lat, lon, fire.latitude, fire.longitude);
    if (distance < nearestKm) {
      nearestKm = distance;
    }
  }

  return {
    hasFires: true,
    count: result.fires.length,
    nearestKm: Math.round(nearestKm * 10) / 10,
  };
}

/**
 * Calculate fire risk level based on nearby fires
 */
export function calculateFireRisk(fireCount: number, nearestKm?: number): 'none' | 'low' | 'moderate' | 'high' | 'extreme' {
  if (fireCount === 0) return 'none';
  if (nearestKm !== undefined && nearestKm < 10) return 'extreme';
  if (nearestKm !== undefined && nearestKm < 25) return 'high';
  if (fireCount > 50) return 'high';
  if (fireCount > 10) return 'moderate';
  return 'low';
}

function parseCSV(csvData: string): FirePoint[] {
  const lines = csvData.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const fires: FirePoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length < headers.length) continue;

    const row: any = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim();
    });

    try {
      fires.push({
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        brightness: parseFloat(row.bright_ti4 || row.brightness),
        scan: parseFloat(row.scan || '0'),
        track: parseFloat(row.track || '0'),
        acqDate: row.acq_date,
        acqTime: row.acq_time,
        satellite: row.satellite || 'Unknown',
        confidence: parseFloat(row.confidence || '0'),
        version: row.version || '',
        brightT31: row.bright_ti5 ? parseFloat(row.bright_ti5) : undefined,
        frp: parseFloat(row.frp || '0'),
        dayNight: (row.daynight || 'D') as 'D' | 'N',
      });
    } catch (e) {
      // Skip malformed rows
    }
  }

  return fires;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
