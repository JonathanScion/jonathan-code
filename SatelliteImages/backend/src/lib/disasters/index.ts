/**
 * Disasters Module - Combines all disaster data sources
 * - USGS Earthquakes
 * - NASA FIRMS (already implemented in nasa module)
 * - GDACS (floods, cyclones, volcanoes)
 */

export * from './usgs';
export * from './gdacs';

import { getRecentEarthquakes, getEarthquakeStats, type Earthquake } from './usgs';
import { getActiveAlerts, getDisasterStats as getGDACSStats, type DisasterAlert, type HazardType } from './gdacs';

export interface HazardPoint {
  id: string;
  type: 'earthquake' | 'fire' | 'flood' | 'cyclone' | 'volcano' | 'wildfire' | 'other';
  title: string;
  latitude: number;
  longitude: number;
  severity: 'low' | 'moderate' | 'high' | 'extreme';
  timestamp: string;
  details: {
    magnitude?: number;
    depth?: number;
    alertLevel?: string;
    country?: string;
    url?: string;
    [key: string]: any;
  };
}

export interface DisasterSummary {
  timestamp: string;
  counts: {
    earthquakes: number;
    fires: number;
    floods: number;
    cyclones: number;
    volcanoes: number;
    total: number;
  };
  recentSignificant: HazardPoint[];
  alerts: {
    red: number;
    orange: number;
  };
}

function earthquakeToHazardPoint(eq: Earthquake): HazardPoint {
  let severity: HazardPoint['severity'] = 'low';
  if (eq.magnitude >= 6) severity = 'extreme';
  else if (eq.magnitude >= 5) severity = 'high';
  else if (eq.magnitude >= 4) severity = 'moderate';

  return {
    id: eq.id,
    type: 'earthquake',
    title: eq.title,
    latitude: eq.latitude,
    longitude: eq.longitude,
    severity,
    timestamp: eq.time,
    details: {
      magnitude: eq.magnitude,
      depth: eq.depth,
      alertLevel: eq.alert,
      url: eq.url,
      tsunami: eq.tsunami,
    },
  };
}

function gdacsAlertToHazardPoint(alert: DisasterAlert): HazardPoint {
  const typeMap: Record<HazardType, HazardPoint['type']> = {
    EQ: 'earthquake',
    TC: 'cyclone',
    FL: 'flood',
    VO: 'volcano',
    DR: 'other',
    WF: 'wildfire',
  };

  let severity: HazardPoint['severity'] = 'low';
  if (alert.alertLevel === 'Red') severity = 'extreme';
  else if (alert.alertLevel === 'Orange') severity = 'high';
  else if (alert.severity > 1) severity = 'moderate';

  return {
    id: alert.id,
    type: typeMap[alert.hazardType] || 'other',
    title: alert.title,
    latitude: alert.latitude,
    longitude: alert.longitude,
    severity,
    timestamp: alert.startDate,
    details: {
      alertLevel: alert.alertLevel,
      country: alert.country,
      url: alert.url,
      population: alert.population,
    },
  };
}

/**
 * Get combined disaster summary from all sources
 */
export async function getDisasterSummary(fireCounts = 0): Promise<DisasterSummary> {
  const [earthquakes, gdacsAlerts, gdacsStats] = await Promise.all([
    getRecentEarthquakes(2.5, 7, 100).catch(() => [] as Earthquake[]),
    getActiveAlerts(100).catch(() => [] as DisasterAlert[]),
    getGDACSStats().catch(() => ({ total: 0, byType: [], byAlertLevel: [], red: 0, orange: 0 })),
  ]);

  // Count by type from GDACS
  const floodCount = gdacsAlerts.filter(a => a.hazardType === 'FL').length;
  const cycloneCount = gdacsAlerts.filter(a => a.hazardType === 'TC').length;
  const volcanoCount = gdacsAlerts.filter(a => a.hazardType === 'VO').length;

  // Get significant events for recent significant list
  const significantEarthquakes = earthquakes
    .filter(eq => eq.magnitude >= 4.5)
    .slice(0, 5)
    .map(earthquakeToHazardPoint);

  const significantAlerts = gdacsAlerts
    .filter(a => a.alertLevel === 'Red' || a.alertLevel === 'Orange')
    .slice(0, 5)
    .map(gdacsAlertToHazardPoint);

  const recentSignificant = [...significantEarthquakes, ...significantAlerts]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  return {
    timestamp: new Date().toISOString(),
    counts: {
      earthquakes: earthquakes.length,
      fires: fireCounts,
      floods: floodCount,
      cyclones: cycloneCount,
      volcanoes: volcanoCount,
      total: earthquakes.length + fireCounts + floodCount + cycloneCount + volcanoCount,
    },
    recentSignificant,
    alerts: {
      red: gdacsStats.red,
      orange: gdacsStats.orange,
    },
  };
}

/**
 * Get all hazards combined into a single array for map display
 */
export async function getAllHazards(
  options: {
    includeEarthquakes?: boolean;
    includeGDACS?: boolean;
    minMagnitude?: number;
    days?: number;
  } = {}
): Promise<HazardPoint[]> {
  const {
    includeEarthquakes = true,
    includeGDACS = true,
    minMagnitude = 2.5,
    days = 7,
  } = options;

  const hazards: HazardPoint[] = [];

  if (includeEarthquakes) {
    try {
      const earthquakes = await getRecentEarthquakes(minMagnitude, days, 200);
      hazards.push(...earthquakes.map(earthquakeToHazardPoint));
    } catch (error) {
      console.error('Failed to fetch earthquakes:', error);
    }
  }

  if (includeGDACS) {
    try {
      const alerts = await getActiveAlerts(200);
      // Filter out GDACS earthquakes since we get those from USGS
      const nonEqAlerts = alerts.filter(a => a.hazardType !== 'EQ');
      hazards.push(...nonEqAlerts.map(gdacsAlertToHazardPoint));
    } catch (error) {
      console.error('Failed to fetch GDACS alerts:', error);
    }
  }

  return hazards.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
