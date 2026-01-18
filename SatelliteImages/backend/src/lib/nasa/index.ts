/**
 * NASA API Integration Module
 *
 * Provides access to multiple NASA data sources for satellite imagery enrichment:
 * - CMR (Common Metadata Repository): Search for satellite imagery
 * - GIBS (Global Imagery Browse Services): Map tile layers
 * - FIRMS (Fire Information): Active fire data
 * - POWER: Meteorological/weather data
 * - N2YO: Satellite pass predictions
 */

export * from './cmr';
export * from './gibs';
export * from './firms';
export * from './power';
export * from './n2yo';

import { searchCMR, CMRSearchParams, CMRSearchResult } from './cmr';
import { getGIBSLayers, getGIBSTileUrl, GIBSLayer } from './gibs';
import { getFireData, hasRecentFires, calculateFireRisk, FIRMSResult } from './firms';
import { getWeatherData, getWeatherForDate, WeatherData, WeatherSummary } from './power';
import { getSatellitePasses, getNextPass, PassPredictionResult, SatellitePass } from './n2yo';

export interface ImageEnrichment {
  timestamp: string;
  ndvi?: {
    available: boolean;
    layerUrl?: string;
  };
  fireRisk: {
    level: 'none' | 'low' | 'moderate' | 'high' | 'extreme';
    nearbyFires: number;
    nearestKm?: number;
  };
  weather?: WeatherData;
  nasaCoverage?: {
    total: number;
    satellites: string[];
  };
  nextPass?: {
    satellite: string;
    time: string;
    elevation: number;
  };
}

/**
 * Auto-enrich an image with NASA data
 * Called after upload confirmation
 */
export async function enrichImageWithNasaData(
  lat: number,
  lon: number,
  captureDate: string,
  firmsApiKey?: string,
  n2yoApiKey?: string
): Promise<ImageEnrichment> {
  const enrichment: ImageEnrichment = {
    timestamp: new Date().toISOString(),
    fireRisk: { level: 'none', nearbyFires: 0 },
  };

  // Create bounding box around point (approximately 50km radius)
  const radiusDeg = 50 / 111; // ~50km in degrees
  const bbox = {
    north: lat + radiusDeg,
    south: lat - radiusDeg,
    east: lon + radiusDeg,
    west: lon - radiusDeg,
  };

  // Run enrichments in parallel where possible
  const promises: Promise<void>[] = [];

  // 1. NDVI layer availability (GIBS - no API key needed)
  enrichment.ndvi = {
    available: true,
    layerUrl: getGIBSTileUrl('MODIS_Terra_NDVI_8Day', captureDate),
  };

  // 2. Fire risk (FIRMS - requires API key)
  if (firmsApiKey) {
    promises.push(
      hasRecentFires(firmsApiKey, lat, lon, 50, 7)
        .then(result => {
          enrichment.fireRisk = {
            level: calculateFireRisk(result.count, result.nearestKm),
            nearbyFires: result.count,
            nearestKm: result.nearestKm,
          };
        })
        .catch(err => {
          console.warn('Fire data enrichment failed:', err.message);
        })
    );
  }

  // 3. Weather data (POWER - no API key needed)
  promises.push(
    getWeatherForDate(lat, lon, captureDate)
      .then(weather => {
        enrichment.weather = weather;
      })
      .catch(err => {
        console.warn('Weather enrichment failed:', err.message);
      })
  );

  // 4. NASA coverage count (CMR - no API key needed)
  promises.push(
    searchCMR({
      bbox,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
      pageSize: 100,
    })
      .then(result => {
        const satellites = [...new Set(result.granules.map(g => g.satellite))];
        enrichment.nasaCoverage = {
          total: result.total,
          satellites,
        };
      })
      .catch(err => {
        console.warn('NASA coverage enrichment failed:', err.message);
      })
  );

  // 5. Next satellite pass (N2YO - requires API key)
  if (n2yoApiKey) {
    promises.push(
      getSatellitePasses(n2yoApiKey, lat, lon, 0, undefined, 3)
        .then(result => {
          if (result.passes.length > 0) {
            const next = result.passes[0];
            enrichment.nextPass = {
              satellite: next.satellite,
              time: next.startTime.toISOString(),
              elevation: next.maxElevation,
            };
          }
        })
        .catch(err => {
          console.warn('Satellite pass enrichment failed:', err.message);
        })
    );
  }

  // Wait for all enrichments to complete
  await Promise.all(promises);

  return enrichment;
}
