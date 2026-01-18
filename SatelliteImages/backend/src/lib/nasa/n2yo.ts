/**
 * N2YO Satellite Pass Prediction API Client
 * Get upcoming satellite passes for a location
 * Requires free API key from: https://www.n2yo.com/api/
 */

import axios from 'axios';

const N2YO_BASE_URL = 'https://api.n2yo.com/rest/v1/satellite';

// NORAD IDs for common imaging satellites
export const SATELLITE_NORAD_IDS: Record<string, number> = {
  'Landsat 8': 39084,
  'Landsat 9': 49260,
  'Sentinel-2A': 40697,
  'Sentinel-2B': 42063,
  'Terra (MODIS)': 25994,
  'Aqua (MODIS)': 27424,
  'Suomi NPP (VIIRS)': 37849,
  'NOAA-20 (VIIRS)': 43013,
  'NOAA-21 (VIIRS)': 54234,
  'ISS': 25544, // For reference
};

export interface SatellitePass {
  satellite: string;
  noradId: number;
  startTime: Date;
  endTime: Date;
  maxElevation: number;  // degrees above horizon
  startAzimuth: number;  // compass direction at start
  endAzimuth: number;
  duration: number;      // seconds
  magnitude?: number;    // brightness (if visual)
}

export interface SatellitePosition {
  satellite: string;
  noradId: number;
  latitude: number;
  longitude: number;
  altitude: number;  // km
  azimuth: number;
  elevation: number;
  timestamp: Date;
}

export interface PassPredictionResult {
  location: { lat: number; lon: number; alt: number };
  passes: SatellitePass[];
  queriedAt: string;
}

/**
 * Get upcoming satellite passes for a location
 * @param apiKey - N2YO API key
 * @param lat - Observer latitude
 * @param lon - Observer longitude
 * @param alt - Observer altitude in meters (0 for sea level)
 * @param satellites - Which satellites to check (defaults to all imaging satellites)
 * @param days - Days ahead to check (1-10)
 */
export async function getSatellitePasses(
  apiKey: string,
  lat: number,
  lon: number,
  alt: number = 0,
  satellites?: string[],
  days: number = 5
): Promise<PassPredictionResult> {
  if (!apiKey) {
    throw new Error('N2YO API key is required');
  }

  const validDays = Math.max(1, Math.min(10, days));
  const allPasses: SatellitePass[] = [];

  // Default to all imaging satellites
  const satsToCheck = satellites || Object.keys(SATELLITE_NORAD_IDS);

  // Query passes for each satellite
  for (const satName of satsToCheck) {
    const noradId = SATELLITE_NORAD_IDS[satName];
    if (!noradId) continue;

    try {
      // Use radio passes endpoint (doesn't require visibility, better for polar orbiting satellites)
      const url = `${N2YO_BASE_URL}/radiopasses/${noradId}/${lat}/${lon}/${alt}/${validDays}/0`;

      const response = await axios.get(url, {
        params: { apiKey },
        timeout: 10000,
      });

      const data = response.data;
      const passes = data.passes || [];

      for (const pass of passes) {
        allPasses.push({
          satellite: satName,
          noradId,
          startTime: new Date(pass.startUTC * 1000),
          endTime: new Date(pass.endUTC * 1000),
          maxElevation: pass.maxEl || 0,
          startAzimuth: pass.startAz || 0,
          endAzimuth: pass.endAz || 0,
          duration: (pass.endUTC - pass.startUTC) || 0,
          magnitude: pass.mag,
        });
      }

      // Small delay to respect rate limits
      await sleep(100);
    } catch (error: any) {
      console.warn(`Failed to get passes for ${satName}:`, error.message);
      // Continue with other satellites
    }
  }

  // Sort by start time
  allPasses.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return {
    location: { lat, lon, alt },
    passes: allPasses,
    queriedAt: new Date().toISOString(),
  };
}

/**
 * Get current position of a satellite
 */
export async function getSatellitePosition(
  apiKey: string,
  satellite: string,
  observerLat: number,
  observerLon: number,
  observerAlt: number = 0
): Promise<SatellitePosition | null> {
  if (!apiKey) {
    throw new Error('N2YO API key is required');
  }

  const noradId = SATELLITE_NORAD_IDS[satellite];
  if (!noradId) {
    throw new Error(`Unknown satellite: ${satellite}`);
  }

  try {
    const url = `${N2YO_BASE_URL}/positions/${noradId}/${observerLat}/${observerLon}/${observerAlt}/1`;

    const response = await axios.get(url, {
      params: { apiKey },
      timeout: 10000,
    });

    const data = response.data;
    const positions = data.positions || [];

    if (positions.length === 0) return null;

    const pos = positions[0];
    return {
      satellite,
      noradId,
      latitude: pos.satlatitude,
      longitude: pos.satlongitude,
      altitude: pos.sataltitude,
      azimuth: pos.azimuth,
      elevation: pos.elevation,
      timestamp: new Date(pos.timestamp * 1000),
    };
  } catch (error: any) {
    console.error('N2YO position error:', error.message);
    return null;
  }
}

/**
 * Get TLE (Two-Line Element) data for a satellite
 */
export async function getSatelliteTLE(
  apiKey: string,
  satellite: string
): Promise<{ line1: string; line2: string } | null> {
  if (!apiKey) {
    throw new Error('N2YO API key is required');
  }

  const noradId = SATELLITE_NORAD_IDS[satellite];
  if (!noradId) {
    throw new Error(`Unknown satellite: ${satellite}`);
  }

  try {
    const url = `${N2YO_BASE_URL}/tle/${noradId}`;

    const response = await axios.get(url, {
      params: { apiKey },
      timeout: 10000,
    });

    const data = response.data;
    return {
      line1: data.tle?.split('\r\n')?.[0] || '',
      line2: data.tle?.split('\r\n')?.[1] || '',
    };
  } catch (error: any) {
    console.error('N2YO TLE error:', error.message);
    return null;
  }
}

/**
 * Get next pass for a specific satellite
 */
export async function getNextPass(
  apiKey: string,
  satellite: string,
  lat: number,
  lon: number,
  alt: number = 0
): Promise<SatellitePass | null> {
  const result = await getSatellitePasses(apiKey, lat, lon, alt, [satellite], 5);
  return result.passes[0] || null;
}

/**
 * Format pass time for display
 */
export function formatPassTime(pass: SatellitePass): string {
  const now = new Date();
  const diffMs = pass.startTime.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 0) {
    return 'In progress';
  } else if (diffHours < 1) {
    const mins = Math.round(diffMs / (1000 * 60));
    return `In ${mins} minutes`;
  } else if (diffHours < 24) {
    const hours = Math.floor(diffHours);
    const mins = Math.round((diffHours - hours) * 60);
    return `In ${hours}h ${mins}m`;
  } else {
    const days = Math.floor(diffHours / 24);
    if (days === 1) {
      return `Tomorrow ${pass.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return pass.startTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) +
      ' ' + pass.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
