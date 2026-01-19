/**
 * USGS Earthquake Data API
 * No API key required - public data
 * https://earthquake.usgs.gov/fdsnws/event/1/
 */

import axios from 'axios';

const USGS_BASE_URL = 'https://earthquake.usgs.gov/fdsnws/event/1';

export interface Earthquake {
  id: string;
  title: string;
  magnitude: number;
  place: string;
  time: string;
  updated: string;
  latitude: number;
  longitude: number;
  depth: number;
  url: string;
  felt?: number;
  tsunami: boolean;
  significance: number;
  type: string;
  alert?: 'green' | 'yellow' | 'orange' | 'red';
}

export interface EarthquakeQueryParams {
  starttime?: string;
  endtime?: string;
  minmagnitude?: number;
  maxmagnitude?: number;
  minlatitude?: number;
  maxlatitude?: number;
  minlongitude?: number;
  maxlongitude?: number;
  limit?: number;
  orderby?: 'time' | 'time-asc' | 'magnitude' | 'magnitude-asc';
}

interface USGSFeature {
  id: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    updated: number;
    url: string;
    felt?: number;
    tsunami: number;
    sig: number;
    type: string;
    title: string;
    alert?: string;
  };
  geometry: {
    coordinates: [number, number, number];
  };
}

interface USGSResponse {
  type: string;
  metadata: {
    generated: number;
    url: string;
    title: string;
    count: number;
  };
  features: USGSFeature[];
}

function parseEarthquake(feature: USGSFeature): Earthquake {
  const { properties, geometry, id } = feature;
  const [longitude, latitude, depth] = geometry.coordinates;

  return {
    id,
    title: properties.title,
    magnitude: properties.mag,
    place: properties.place,
    time: new Date(properties.time).toISOString(),
    updated: new Date(properties.updated).toISOString(),
    latitude,
    longitude,
    depth,
    url: properties.url,
    felt: properties.felt,
    tsunami: properties.tsunami === 1,
    significance: properties.sig,
    type: properties.type,
    alert: properties.alert as Earthquake['alert'],
  };
}

/**
 * Get recent earthquakes
 */
export async function getRecentEarthquakes(
  minMagnitude = 2.5,
  days = 7,
  limit = 100
): Promise<Earthquake[]> {
  const endtime = new Date().toISOString();
  const starttime = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    format: 'geojson',
    starttime,
    endtime,
    minmagnitude: minMagnitude.toString(),
    limit: limit.toString(),
    orderby: 'time',
  });

  const response = await axios.get<USGSResponse>(`${USGS_BASE_URL}/query?${params}`);
  return response.data.features.map(parseEarthquake);
}

/**
 * Get earthquakes in a bounding box
 */
export async function getEarthquakesInBbox(
  bbox: { north: number; south: number; east: number; west: number },
  days = 7,
  minMagnitude = 2.5,
  limit = 100
): Promise<Earthquake[]> {
  const endtime = new Date().toISOString();
  const starttime = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    format: 'geojson',
    starttime,
    endtime,
    minmagnitude: minMagnitude.toString(),
    minlatitude: bbox.south.toString(),
    maxlatitude: bbox.north.toString(),
    minlongitude: bbox.west.toString(),
    maxlongitude: bbox.east.toString(),
    limit: limit.toString(),
    orderby: 'time',
  });

  const response = await axios.get<USGSResponse>(`${USGS_BASE_URL}/query?${params}`);
  return response.data.features.map(parseEarthquake);
}

/**
 * Get significant earthquakes (magnitude 4.5+)
 */
export async function getSignificantEarthquakes(days = 30): Promise<Earthquake[]> {
  return getRecentEarthquakes(4.5, days, 100);
}

/**
 * Get earthquake by ID
 */
export async function getEarthquakeById(id: string): Promise<Earthquake | null> {
  try {
    const params = new URLSearchParams({
      format: 'geojson',
      eventid: id,
    });

    const response = await axios.get<USGSResponse>(`${USGS_BASE_URL}/query?${params}`);
    if (response.data.features.length === 0) return null;
    return parseEarthquake(response.data.features[0]);
  } catch {
    return null;
  }
}

/**
 * Get earthquake statistics
 */
export async function getEarthquakeStats(days = 7): Promise<{
  total: number;
  byMagnitude: { range: string; count: number }[];
  significant: number;
  withTsunami: number;
}> {
  const earthquakes = await getRecentEarthquakes(0, days, 500);

  const byMagnitude = [
    { range: '0-2.5', count: earthquakes.filter(e => e.magnitude < 2.5).length },
    { range: '2.5-4.5', count: earthquakes.filter(e => e.magnitude >= 2.5 && e.magnitude < 4.5).length },
    { range: '4.5-6', count: earthquakes.filter(e => e.magnitude >= 4.5 && e.magnitude < 6).length },
    { range: '6+', count: earthquakes.filter(e => e.magnitude >= 6).length },
  ];

  return {
    total: earthquakes.length,
    byMagnitude,
    significant: earthquakes.filter(e => e.magnitude >= 4.5).length,
    withTsunami: earthquakes.filter(e => e.tsunami).length,
  };
}
