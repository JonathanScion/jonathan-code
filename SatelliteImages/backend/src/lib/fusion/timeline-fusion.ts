/**
 * Multi-Sensor Fusion Timeline Module
 * Combines data from multiple sources into a unified timeline
 */

import { searchCMR, getFireData, getWeatherData, getSatellitePasses } from '../nasa';
import { getEarthquakesInBbox } from '../disasters';

export type TimelineSource = 'satellite' | 'weather' | 'fire' | 'pass' | 'earthquake';

export interface TimelineEntry {
  id: string;
  timestamp: string;
  source: TimelineSource;
  title: string;
  description: string;
  icon: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  data: Record<string, any>;
}

export interface TimelineResult {
  entries: TimelineEntry[];
  dateRange: { start: string; end: string };
  sources: TimelineSource[];
  location?: { lat: number; lon: number };
}

export interface IntelligenceReport {
  generatedAt: string;
  location: { lat: number; lon: number };
  dateRange: { start: string; end: string };
  summary: string;
  sections: {
    title: string;
    content: string;
    data?: any;
  }[];
  recommendations: string[];
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  timeline: TimelineEntry[];
}

interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

function createBboxFromPoint(lat: number, lon: number, radiusKm: number = 50): BoundingBox {
  // Approximate degrees per km
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

  return {
    north: lat + latDelta,
    south: lat - latDelta,
    east: lon + lonDelta,
    west: lon - lonDelta,
  };
}

/**
 * Generate a unified timeline from multiple data sources
 */
export async function generateTimeline(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
  sources: TimelineSource[] = ['satellite', 'weather', 'fire', 'pass', 'earthquake'],
  options?: {
    firmsApiKey?: string;
    n2yoApiKey?: string;
  }
): Promise<TimelineResult> {
  const bbox = createBboxFromPoint(lat, lon);
  const entries: TimelineEntry[] = [];

  // Parallel fetch from all sources
  const promises: Promise<void>[] = [];

  // Satellite imagery from NASA CMR
  if (sources.includes('satellite')) {
    promises.push(
      searchCMR({ bbox, startDate, endDate, pageSize: 20 })
        .then(result => {
          result.granules.forEach(granule => {
            entries.push({
              id: `sat-${granule.id}`,
              timestamp: granule.startDate,
              source: 'satellite',
              title: `${granule.satellite} Capture`,
              description: `${granule.sensor} imagery captured`,
              icon: 'satellite',
              data: {
                satellite: granule.satellite,
                sensor: granule.sensor,
                browseUrl: granule.browseUrl,
                downloadUrl: granule.downloadUrl,
                cloudCover: granule.cloudCover,
              },
            });
          });
        })
        .catch(err => console.error('CMR fetch error:', err))
    );
  }

  // Weather data from NASA POWER
  if (sources.includes('weather')) {
    promises.push(
      getWeatherData(lat, lon, startDate, endDate)
        .then(weather => {
          weather.data?.forEach(day => {
            // Only add entries for significant weather
            let severity: TimelineEntry['severity'];
            let description = '';

            if (day.temperature > 35) {
              severity = 'high';
              description = `High temperature: ${day.temperature}°C`;
            } else if (day.temperature < 0) {
              severity = 'medium';
              description = `Freezing temperature: ${day.temperature}°C`;
            } else if (day.precipitation > 20) {
              severity = 'medium';
              description = `Heavy precipitation: ${day.precipitation}mm`;
            }

            if (severity) {
              entries.push({
                id: `weather-${day.date}`,
                timestamp: day.date,
                source: 'weather',
                title: 'Weather Alert',
                description,
                icon: 'cloud',
                severity,
                data: day,
              });
            }
          });
        })
        .catch(err => console.error('Weather fetch error:', err))
    );
  }

  // Fire data from NASA FIRMS
  if (sources.includes('fire') && options?.firmsApiKey) {
    const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    promises.push(
      getFireData(options.firmsApiKey, bbox, Math.min(daysDiff, 10))
        .then(fireData => {
          fireData.fires.forEach((fire, idx) => {
            let severity: TimelineEntry['severity'] = 'low';
            if (fire.confidence > 80) severity = 'high';
            else if (fire.confidence > 50) severity = 'medium';

            entries.push({
              id: `fire-${idx}-${fire.acqDate}`,
              timestamp: `${fire.acqDate}T${fire.acqTime || '12:00:00'}`,
              source: 'fire',
              title: 'Fire Detection',
              description: `${fire.satellite} detected fire (confidence: ${fire.confidence}%)`,
              icon: 'flame',
              severity,
              data: {
                latitude: fire.latitude,
                longitude: fire.longitude,
                brightness: fire.brightness,
                satellite: fire.satellite,
                confidence: fire.confidence,
                frp: fire.frp,
              },
            });
          });
        })
        .catch(err => console.error('FIRMS fetch error:', err))
    );
  }

  // Satellite passes from N2YO
  if (sources.includes('pass') && options?.n2yoApiKey) {
    promises.push(
      getSatellitePasses(options.n2yoApiKey, lat, lon, 0, undefined, 10)
        .then(passData => {
          passData.passes.forEach((pass, idx) => {
            entries.push({
              id: `pass-${idx}-${pass.satellite}`,
              timestamp: pass.startTime,
              source: 'pass',
              title: `${pass.satellite} Pass`,
              description: `Max elevation: ${pass.maxElevation}°, Duration: ${Math.round(pass.duration / 60)}min`,
              icon: 'rocket',
              data: {
                satellite: pass.satellite,
                maxElevation: pass.maxElevation,
                duration: pass.duration,
                startAzimuth: pass.startAzimuth,
                endAzimuth: pass.endAzimuth,
              },
            });
          });
        })
        .catch(err => console.error('N2YO fetch error:', err))
    );
  }

  // Earthquakes
  if (sources.includes('earthquake')) {
    const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    promises.push(
      getEarthquakesInBbox(bbox, daysDiff, 2.5, 50)
        .then(earthquakes => {
          earthquakes.forEach(eq => {
            let severity: TimelineEntry['severity'] = 'low';
            if (eq.magnitude >= 6) severity = 'critical';
            else if (eq.magnitude >= 5) severity = 'high';
            else if (eq.magnitude >= 4) severity = 'medium';

            entries.push({
              id: `eq-${eq.id}`,
              timestamp: eq.time,
              source: 'earthquake',
              title: `M${eq.magnitude.toFixed(1)} Earthquake`,
              description: eq.place,
              icon: 'mountain',
              severity,
              data: {
                magnitude: eq.magnitude,
                depth: eq.depth,
                place: eq.place,
                url: eq.url,
                tsunami: eq.tsunami,
              },
            });
          });
        })
        .catch(err => console.error('Earthquake fetch error:', err))
    );
  }

  // Wait for all fetches to complete
  await Promise.all(promises);

  // Sort entries by timestamp
  entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return {
    entries,
    dateRange: { start: startDate, end: endDate },
    sources,
    location: { lat, lon },
  };
}

/**
 * Generate an intelligence report for a location
 */
export async function generateIntelReport(
  lat: number,
  lon: number,
  captureDate?: string,
  options?: {
    firmsApiKey?: string;
    n2yoApiKey?: string;
  }
): Promise<IntelligenceReport> {
  // Default to 30 days before capture date
  const endDate = captureDate ? captureDate.split('T')[0] : new Date().toISOString().split('T')[0];
  const startDateObj = new Date(endDate);
  startDateObj.setDate(startDateObj.getDate() - 30);
  const startDate = startDateObj.toISOString().split('T')[0];

  // Get timeline data
  const timeline = await generateTimeline(lat, lon, startDate, endDate, undefined, options);

  // Analyze for risk level
  let riskLevel: IntelligenceReport['riskLevel'] = 'low';
  const criticalEvents = timeline.entries.filter(e => e.severity === 'critical' || e.severity === 'high');
  if (criticalEvents.length > 5) riskLevel = 'critical';
  else if (criticalEvents.length > 2) riskLevel = 'high';
  else if (criticalEvents.length > 0) riskLevel = 'moderate';

  // Count by source
  const sourceCount: Record<string, number> = {};
  timeline.entries.forEach(e => {
    sourceCount[e.source] = (sourceCount[e.source] || 0) + 1;
  });

  // Generate sections
  const sections: IntelligenceReport['sections'] = [];

  // Satellite Coverage Section
  const satEntries = timeline.entries.filter(e => e.source === 'satellite');
  if (satEntries.length > 0) {
    const satellites = [...new Set(satEntries.map(e => e.data.satellite))];
    sections.push({
      title: 'Satellite Coverage',
      content: `${satEntries.length} satellite captures from ${satellites.join(', ')} in the analysis period.`,
      data: { count: satEntries.length, satellites },
    });
  }

  // Fire Risk Section
  const fireEntries = timeline.entries.filter(e => e.source === 'fire');
  if (fireEntries.length > 0) {
    const highConfidence = fireEntries.filter(e => e.data.confidence > 80).length;
    sections.push({
      title: 'Fire Activity',
      content: `${fireEntries.length} fire detections in the area. ${highConfidence} were high confidence detections.`,
      data: { total: fireEntries.length, highConfidence },
    });
  } else {
    sections.push({
      title: 'Fire Activity',
      content: 'No fire detections in the analysis period.',
      data: { total: 0 },
    });
  }

  // Seismic Activity Section
  const eqEntries = timeline.entries.filter(e => e.source === 'earthquake');
  if (eqEntries.length > 0) {
    const maxMag = Math.max(...eqEntries.map(e => e.data.magnitude));
    sections.push({
      title: 'Seismic Activity',
      content: `${eqEntries.length} earthquakes detected. Maximum magnitude: ${maxMag.toFixed(1)}.`,
      data: { count: eqEntries.length, maxMagnitude: maxMag },
    });
  }

  // Weather Section
  const weatherEntries = timeline.entries.filter(e => e.source === 'weather');
  if (weatherEntries.length > 0) {
    sections.push({
      title: 'Weather Alerts',
      content: `${weatherEntries.length} significant weather events recorded.`,
      data: { count: weatherEntries.length },
    });
  }

  // Future Passes Section
  const passEntries = timeline.entries.filter(e => e.source === 'pass');
  const futurePasses = passEntries.filter(e => new Date(e.timestamp) > new Date());
  if (futurePasses.length > 0) {
    const nextPass = futurePasses[0];
    sections.push({
      title: 'Next Satellite Pass',
      content: `${nextPass.data.satellite} will pass at ${nextPass.data.maxElevation}° elevation.`,
      data: nextPass.data,
    });
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (fireEntries.length > 0) {
    recommendations.push('Monitor fire activity using VIIRS thermal anomaly layers');
    recommendations.push('Consider high-resolution imagery to assess affected areas');
  }

  if (eqEntries.some(e => e.data.magnitude >= 4)) {
    recommendations.push('Review before/after imagery for structural damage assessment');
  }

  if (satEntries.length < 5) {
    recommendations.push('Request additional satellite tasking for better temporal coverage');
  }

  if (weatherEntries.some(e => e.description.includes('precipitation'))) {
    recommendations.push('Consider flood risk assessment using SAR imagery');
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue routine monitoring');
    recommendations.push('Schedule periodic imagery updates');
  }

  // Generate summary
  const summary = `Intelligence report for location (${lat.toFixed(4)}, ${lon.toFixed(4)}) covering ${startDate} to ${endDate}. ` +
    `${timeline.entries.length} total events detected across ${Object.keys(sourceCount).length} data sources. ` +
    `Overall risk level: ${riskLevel.toUpperCase()}.`;

  return {
    generatedAt: new Date().toISOString(),
    location: { lat, lon },
    dateRange: { start: startDate, end: endDate },
    summary,
    sections,
    recommendations,
    riskLevel,
    timeline: timeline.entries,
  };
}
