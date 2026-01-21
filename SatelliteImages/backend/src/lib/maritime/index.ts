/**
 * Maritime and Asset Tracking
 * Provides ship tracking (AIS), aircraft tracking (ADS-B), and correlation with imagery
 */

import axios from 'axios';

// ============ TYPES ============

export interface Vessel {
  mmsi: string; // Maritime Mobile Service Identity
  name: string;
  callsign?: string;
  imo?: string;
  type: string;
  typeCode: number;
  flag?: string;
  destination?: string;
  eta?: string;
  position: {
    lat: number;
    lon: number;
  };
  course: number; // Degrees
  speed: number; // Knots
  heading?: number;
  draught?: number;
  length?: number;
  width?: number;
  lastUpdate: string;
  status?: string;
}

export interface Aircraft {
  icao24: string; // ICAO 24-bit address
  callsign?: string;
  originCountry: string;
  position: {
    lat: number;
    lon: number;
    altitude: number; // meters
  };
  velocity: number; // m/s
  heading: number; // Degrees
  verticalRate?: number; // m/s
  onGround: boolean;
  lastUpdate: string;
  squawk?: string;
  category?: string;
}

export interface MaritimeArea {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface TrackingResult<T> {
  data: T[];
  total: number;
  timestamp: string;
  source: string;
  bounds: MaritimeArea;
}

export interface AssetCorrelation {
  imageId: string;
  imageBounds: MaritimeArea;
  capturedAt: string;
  vessels: {
    vessel: Vessel;
    distanceKm: number;
    inFrame: boolean;
  }[];
  aircraft: {
    aircraft: Aircraft;
    distanceKm: number;
    inFrame: boolean;
  }[];
  summary: {
    vesselsInFrame: number;
    vesselTypes: Record<string, number>;
    aircraftInFrame: number;
    nearbyPorts: string[];
  };
}

// ============ VESSEL TYPE CODES ============

const VESSEL_TYPES: Record<number, string> = {
  0: 'Unknown',
  20: 'Wing in Ground',
  30: 'Fishing',
  31: 'Towing',
  32: 'Towing Large',
  33: 'Dredging',
  34: 'Diving',
  35: 'Military',
  36: 'Sailing',
  37: 'Pleasure Craft',
  40: 'High Speed Craft',
  50: 'Pilot',
  51: 'Search and Rescue',
  52: 'Tug',
  53: 'Port Tender',
  54: 'Anti-pollution',
  55: 'Law Enforcement',
  60: 'Passenger',
  70: 'Cargo',
  80: 'Tanker',
  90: 'Other',
};

function getVesselType(code: number): string {
  // Check exact match first
  if (VESSEL_TYPES[code]) return VESSEL_TYPES[code];
  // Check category (first digit * 10)
  const category = Math.floor(code / 10) * 10;
  return VESSEL_TYPES[category] || 'Unknown';
}

// ============ AIS DATA (MarineTraffic/AISHub Alternative) ============

// Using free AIS data sources
// Option 1: AISHub (requires registration, free tier)
// Option 2: VesselFinder API (limited free tier)
// For demo, we'll use a simulated data source with realistic patterns

/**
 * Get vessels in a bounding box
 * In production, this would call AISHub, MarineTraffic, or similar API
 */
export async function getVesselsInArea(
  bounds: MaritimeArea,
  apiKey?: string
): Promise<TrackingResult<Vessel>> {
  // If API key provided, try real API
  if (apiKey) {
    try {
      return await fetchRealAISData(bounds, apiKey);
    } catch (err) {
      console.warn('Real AIS API failed, using simulated data:', err);
    }
  }

  // Generate simulated realistic vessel data
  const vessels = generateSimulatedVessels(bounds, 15);

  return {
    data: vessels,
    total: vessels.length,
    timestamp: new Date().toISOString(),
    source: 'simulated',
    bounds,
  };
}

/**
 * Fetch real AIS data from API (AISHub format)
 */
async function fetchRealAISData(
  bounds: MaritimeArea,
  apiKey: string
): Promise<TrackingResult<Vessel>> {
  // AISHub API format
  const response = await axios.get('https://data.aishub.net/ws.php', {
    params: {
      username: apiKey,
      format: 'json',
      output: 'json',
      compress: 0,
      latmin: bounds.south,
      latmax: bounds.north,
      lonmin: bounds.west,
      lonmax: bounds.east,
    },
    timeout: 10000,
  });

  const vessels: Vessel[] = (response.data || []).map((v: any) => ({
    mmsi: v.MMSI?.toString() || '',
    name: v.NAME || 'Unknown',
    callsign: v.CALLSIGN,
    imo: v.IMO?.toString(),
    type: getVesselType(v.TYPE || 0),
    typeCode: v.TYPE || 0,
    flag: v.FLAG,
    destination: v.DEST,
    eta: v.ETA,
    position: {
      lat: parseFloat(v.LATITUDE) || 0,
      lon: parseFloat(v.LONGITUDE) || 0,
    },
    course: parseFloat(v.COG) || 0,
    speed: parseFloat(v.SOG) || 0,
    heading: v.HEADING ? parseFloat(v.HEADING) : undefined,
    draught: v.DRAUGHT ? parseFloat(v.DRAUGHT) : undefined,
    length: v.A && v.B ? parseInt(v.A) + parseInt(v.B) : undefined,
    width: v.C && v.D ? parseInt(v.C) + parseInt(v.D) : undefined,
    lastUpdate: v.TIME || new Date().toISOString(),
    status: v.NAVSTAT?.toString(),
  }));

  return {
    data: vessels,
    total: vessels.length,
    timestamp: new Date().toISOString(),
    source: 'aishub',
    bounds,
  };
}

/**
 * Generate simulated vessel data for demo
 */
function generateSimulatedVessels(bounds: MaritimeArea, count: number): Vessel[] {
  const vessels: Vessel[] = [];
  const vesselNames = [
    'MAERSK SEOUL', 'EVER GIVEN', 'MSC OSCAR', 'CMA CGM MARCO POLO',
    'OOCL HONG KONG', 'COSCO SHIPPING', 'YANGMING MARINE', 'HMM ALGECIRAS',
    'NORTHERN VOYAGER', 'PACIFIC TRADER', 'ATLANTIC STAR', 'OCEAN PIONEER',
    'SEA EXPLORER', 'GLOBAL MARINER', 'BLUE HORIZON', 'SUNRISE CARRIER'
  ];

  for (let i = 0; i < count; i++) {
    const lat = bounds.south + Math.random() * (bounds.north - bounds.south);
    const lon = bounds.west + Math.random() * (bounds.east - bounds.west);
    const typeCode = [30, 70, 70, 70, 80, 80, 60, 52, 35][Math.floor(Math.random() * 9)];

    vessels.push({
      mmsi: `${200000000 + Math.floor(Math.random() * 600000000)}`,
      name: vesselNames[i % vesselNames.length],
      callsign: `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 9999)}`,
      type: getVesselType(typeCode),
      typeCode,
      flag: ['PA', 'LR', 'MH', 'SG', 'HK', 'MT', 'BS'][Math.floor(Math.random() * 7)],
      destination: ['ROTTERDAM', 'SINGAPORE', 'SHANGHAI', 'LOS ANGELES', 'HAMBURG', 'DUBAI'][Math.floor(Math.random() * 6)],
      position: { lat, lon },
      course: Math.floor(Math.random() * 360),
      speed: Math.floor(Math.random() * 20) + 5,
      heading: Math.floor(Math.random() * 360),
      length: Math.floor(Math.random() * 300) + 100,
      width: Math.floor(Math.random() * 40) + 20,
      lastUpdate: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    });
  }

  return vessels;
}

// ============ AIRCRAFT DATA (OpenSky Network) ============

/**
 * Get aircraft in a bounding box using OpenSky Network (free, no API key needed)
 */
export async function getAircraftInArea(
  bounds: MaritimeArea
): Promise<TrackingResult<Aircraft>> {
  try {
    // OpenSky Network API (free, anonymous access)
    const response = await axios.get('https://opensky-network.org/api/states/all', {
      params: {
        lamin: bounds.south,
        lamax: bounds.north,
        lomin: bounds.west,
        lomax: bounds.east,
      },
      timeout: 15000,
    });

    const states = response.data?.states || [];

    const aircraft: Aircraft[] = states
      .filter((s: any[]) => s[5] !== null && s[6] !== null) // Filter out aircraft without position
      .map((s: any[]) => ({
        icao24: s[0],
        callsign: s[1]?.trim() || undefined,
        originCountry: s[2],
        position: {
          lat: s[6],
          lon: s[5],
          altitude: s[7] || s[13] || 0, // baro_altitude or geo_altitude
        },
        velocity: s[9] || 0,
        heading: s[10] || 0,
        verticalRate: s[11] || undefined,
        onGround: s[8] || false,
        lastUpdate: new Date((s[3] || s[4]) * 1000).toISOString(),
        squawk: s[14] || undefined,
        category: s[17] !== null ? getCategoryName(s[17]) : undefined,
      }));

    return {
      data: aircraft,
      total: aircraft.length,
      timestamp: new Date().toISOString(),
      source: 'opensky',
      bounds,
    };
  } catch (err: any) {
    console.error('OpenSky API error:', err.message);

    // Return empty result on error
    return {
      data: [],
      total: 0,
      timestamp: new Date().toISOString(),
      source: 'opensky',
      bounds,
    };
  }
}

function getCategoryName(category: number): string {
  const categories: Record<number, string> = {
    0: 'Unknown',
    1: 'Light',
    2: 'Small',
    3: 'Large',
    4: 'High Vortex',
    5: 'Heavy',
    6: 'High Performance',
    7: 'Rotorcraft',
    8: 'Glider',
    9: 'Lighter than Air',
    10: 'Parachutist',
    11: 'Ultralight',
    12: 'UAV',
    13: 'Space',
    14: 'Emergency Vehicle',
    15: 'Service Vehicle',
    16: 'Point Obstacle',
    17: 'Cluster Obstacle',
    18: 'Line Obstacle',
  };
  return categories[category] || 'Unknown';
}

// ============ CORRELATION WITH IMAGERY ============

/**
 * Correlate vessels and aircraft with a satellite image
 */
export async function correlateAssetsWithImage(
  imageId: string,
  bounds: MaritimeArea,
  capturedAt: string,
  aisApiKey?: string
): Promise<AssetCorrelation> {
  // Get current vessel and aircraft positions
  // Note: For historical correlation, you'd need archived AIS data
  const [vesselData, aircraftData] = await Promise.all([
    getVesselsInArea(bounds, aisApiKey),
    getAircraftInArea(bounds),
  ]);

  // Calculate center of image bounds
  const centerLat = (bounds.north + bounds.south) / 2;
  const centerLon = (bounds.east + bounds.west) / 2;

  // Correlate vessels
  const correlatedVessels = vesselData.data.map(vessel => {
    const distance = haversineDistance(
      centerLat, centerLon,
      vessel.position.lat, vessel.position.lon
    );
    const inFrame = isInBounds(vessel.position.lat, vessel.position.lon, bounds);

    return { vessel, distanceKm: Math.round(distance * 10) / 10, inFrame };
  });

  // Correlate aircraft
  const correlatedAircraft = aircraftData.data.map(aircraft => {
    const distance = haversineDistance(
      centerLat, centerLon,
      aircraft.position.lat, aircraft.position.lon
    );
    const inFrame = isInBounds(aircraft.position.lat, aircraft.position.lon, bounds);

    return { aircraft, distanceKm: Math.round(distance * 10) / 10, inFrame };
  });

  // Sort by distance
  correlatedVessels.sort((a, b) => a.distanceKm - b.distanceKm);
  correlatedAircraft.sort((a, b) => a.distanceKm - b.distanceKm);

  // Generate summary
  const vesselsInFrame = correlatedVessels.filter(v => v.inFrame);
  const vesselTypes: Record<string, number> = {};
  vesselsInFrame.forEach(v => {
    vesselTypes[v.vessel.type] = (vesselTypes[v.vessel.type] || 0) + 1;
  });

  return {
    imageId,
    imageBounds: bounds,
    capturedAt,
    vessels: correlatedVessels.slice(0, 20),
    aircraft: correlatedAircraft.slice(0, 20),
    summary: {
      vesselsInFrame: vesselsInFrame.length,
      vesselTypes,
      aircraftInFrame: correlatedAircraft.filter(a => a.inFrame).length,
      nearbyPorts: identifyNearbyPorts(centerLat, centerLon),
    },
  };
}

/**
 * Calculate distance between two points using Haversine formula
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isInBounds(lat: number, lon: number, bounds: MaritimeArea): boolean {
  return lat >= bounds.south && lat <= bounds.north &&
         lon >= bounds.west && lon <= bounds.east;
}

/**
 * Identify nearby major ports (simplified)
 */
function identifyNearbyPorts(lat: number, lon: number): string[] {
  const ports = [
    { name: 'Rotterdam', lat: 51.9, lon: 4.5 },
    { name: 'Singapore', lat: 1.3, lon: 103.8 },
    { name: 'Shanghai', lat: 31.2, lon: 121.5 },
    { name: 'Los Angeles', lat: 33.7, lon: -118.3 },
    { name: 'Hamburg', lat: 53.5, lon: 10.0 },
    { name: 'Dubai', lat: 25.3, lon: 55.3 },
    { name: 'Hong Kong', lat: 22.3, lon: 114.2 },
    { name: 'New York', lat: 40.7, lon: -74.0 },
    { name: 'Tokyo', lat: 35.7, lon: 139.8 },
    { name: 'Busan', lat: 35.1, lon: 129.0 },
  ];

  return ports
    .map(p => ({ ...p, distance: haversineDistance(lat, lon, p.lat, p.lon) }))
    .filter(p => p.distance < 200) // Within 200km
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3)
    .map(p => p.name);
}

/**
 * Get vessel details by MMSI
 */
export async function getVesselByMMSI(mmsi: string, apiKey?: string): Promise<Vessel | null> {
  // In production, would call VesselFinder or similar API
  // For demo, return simulated data
  return {
    mmsi,
    name: 'DEMO VESSEL',
    type: 'Cargo',
    typeCode: 70,
    position: { lat: 0, lon: 0 },
    course: 0,
    speed: 0,
    lastUpdate: new Date().toISOString(),
  };
}

/**
 * Get aircraft details by ICAO24
 */
export async function getAircraftByICAO(icao24: string): Promise<Aircraft | null> {
  try {
    const response = await axios.get(`https://opensky-network.org/api/states/all`, {
      params: { icao24 },
      timeout: 10000,
    });

    const state = response.data?.states?.[0];
    if (!state) return null;

    return {
      icao24: state[0],
      callsign: state[1]?.trim() || undefined,
      originCountry: state[2],
      position: {
        lat: state[6],
        lon: state[5],
        altitude: state[7] || 0,
      },
      velocity: state[9] || 0,
      heading: state[10] || 0,
      verticalRate: state[11] || undefined,
      onGround: state[8] || false,
      lastUpdate: new Date(state[3] * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}
