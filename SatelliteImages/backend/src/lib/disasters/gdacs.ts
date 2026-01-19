/**
 * GDACS (Global Disaster Alert and Coordination System) API
 * No API key required - public RSS/GeoRSS feeds
 * https://www.gdacs.org/
 */

import axios from 'axios';

const GDACS_RSS_URL = 'https://www.gdacs.org/xml/rss.xml';
const GDACS_API_URL = 'https://www.gdacs.org/gdacsapi/api/events';

export type HazardType = 'EQ' | 'TC' | 'FL' | 'VO' | 'DR' | 'WF';

export interface DisasterAlert {
  id: string;
  title: string;
  description: string;
  hazardType: HazardType;
  hazardName: string;
  alertLevel: 'Green' | 'Orange' | 'Red';
  severity: number;
  country: string;
  latitude: number;
  longitude: number;
  startDate: string;
  endDate?: string;
  url: string;
  population?: number;
  episodeId?: string;
}

export interface FloodAlert extends DisasterAlert {
  hazardType: 'FL';
  magnitude?: number;
  area?: number;
  deaths?: number;
  displaced?: number;
}

interface GDACSEvent {
  eventid: number;
  episodeid: number;
  eventtype: string;
  name: string;
  description: string;
  htmldescription: string;
  icon: string;
  iconclass: string;
  alertlevel: string;
  alertscore: number;
  country: string;
  fromdate: string;
  todate: string;
  latitude: number;
  longitude: number;
  url: {
    report: string;
    details: string;
    geometry: string;
  };
  population?: {
    exposed: number;
  };
  severitydata?: {
    severity: number;
    severityunit: string;
  };
}

interface GDACSResponse {
  features: {
    properties: GDACSEvent;
    geometry?: {
      type: string;
      coordinates: number[];
    };
  }[];
}

const HAZARD_NAMES: Record<HazardType, string> = {
  EQ: 'Earthquake',
  TC: 'Tropical Cyclone',
  FL: 'Flood',
  VO: 'Volcano',
  DR: 'Drought',
  WF: 'Wildfire',
};

function parseGDACSEvent(event: GDACSEvent): DisasterAlert {
  return {
    id: `gdacs-${event.eventtype}-${event.eventid}`,
    title: event.name || event.description,
    description: event.description,
    hazardType: event.eventtype as HazardType,
    hazardName: HAZARD_NAMES[event.eventtype as HazardType] || event.eventtype,
    alertLevel: event.alertlevel as 'Green' | 'Orange' | 'Red',
    severity: event.alertscore || 0,
    country: event.country,
    latitude: event.latitude,
    longitude: event.longitude,
    startDate: event.fromdate,
    endDate: event.todate,
    url: event.url?.report || event.url?.details || '',
    population: event.population?.exposed,
    episodeId: event.episodeid?.toString(),
  };
}

/**
 * Get all active disaster alerts from GDACS
 */
export async function getActiveAlerts(limit = 100): Promise<DisasterAlert[]> {
  try {
    // Get GeoJSON feed
    const response = await axios.get<GDACSResponse>(`${GDACS_API_URL}/geteventlist/ALL`, {
      timeout: 10000,
    });

    if (!response.data.features) {
      return [];
    }

    return response.data.features
      .slice(0, limit)
      .map(f => parseGDACSEvent(f.properties));
  } catch (error: any) {
    console.error('GDACS API error:', error.message);
    // Fallback: return empty array
    return [];
  }
}

/**
 * Get alerts by hazard type
 */
export async function getAlertsByType(
  hazardType: HazardType,
  limit = 50
): Promise<DisasterAlert[]> {
  try {
    const response = await axios.get<GDACSResponse>(`${GDACS_API_URL}/geteventlist/${hazardType}`, {
      timeout: 10000,
    });

    if (!response.data.features) {
      return [];
    }

    return response.data.features
      .slice(0, limit)
      .map(f => parseGDACSEvent(f.properties));
  } catch (error: any) {
    console.error(`GDACS ${hazardType} API error:`, error.message);
    return [];
  }
}

/**
 * Get flood alerts
 */
export async function getFloodAlerts(limit = 50): Promise<FloodAlert[]> {
  const alerts = await getAlertsByType('FL', limit);
  return alerts as FloodAlert[];
}

/**
 * Get tropical cyclone alerts
 */
export async function getCycloneAlerts(limit = 50): Promise<DisasterAlert[]> {
  return getAlertsByType('TC', limit);
}

/**
 * Get volcano alerts
 */
export async function getVolcanoAlerts(limit = 50): Promise<DisasterAlert[]> {
  return getAlertsByType('VO', limit);
}

/**
 * Get wildfire alerts
 */
export async function getWildfireAlerts(limit = 50): Promise<DisasterAlert[]> {
  return getAlertsByType('WF', limit);
}

/**
 * Get alerts in a bounding box
 */
export async function getAlertsInBbox(
  bbox: { north: number; south: number; east: number; west: number },
  hazardType?: HazardType
): Promise<DisasterAlert[]> {
  const alerts = hazardType
    ? await getAlertsByType(hazardType, 200)
    : await getActiveAlerts(200);

  return alerts.filter(alert => {
    return (
      alert.latitude >= bbox.south &&
      alert.latitude <= bbox.north &&
      alert.longitude >= bbox.west &&
      alert.longitude <= bbox.east
    );
  });
}

/**
 * Get disaster statistics
 */
export async function getDisasterStats(): Promise<{
  total: number;
  byType: { type: HazardType; name: string; count: number }[];
  byAlertLevel: { level: string; count: number }[];
  red: number;
  orange: number;
}> {
  const alerts = await getActiveAlerts(500);

  const byTypeMap: Record<string, number> = {};
  const byLevelMap: Record<string, number> = {};

  alerts.forEach(alert => {
    byTypeMap[alert.hazardType] = (byTypeMap[alert.hazardType] || 0) + 1;
    byLevelMap[alert.alertLevel] = (byLevelMap[alert.alertLevel] || 0) + 1;
  });

  const byType = Object.entries(byTypeMap).map(([type, count]) => ({
    type: type as HazardType,
    name: HAZARD_NAMES[type as HazardType] || type,
    count,
  }));

  const byAlertLevel = Object.entries(byLevelMap).map(([level, count]) => ({
    level,
    count,
  }));

  return {
    total: alerts.length,
    byType,
    byAlertLevel,
    red: byLevelMap['Red'] || 0,
    orange: byLevelMap['Orange'] || 0,
  };
}
