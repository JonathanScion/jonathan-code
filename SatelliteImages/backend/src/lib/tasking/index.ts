/**
 * Automated Tasking Recommendations
 * Provides optimal collection timing, cloud-free windows, and priority scoring
 */

import { getWeatherData, type WeatherData } from '../nasa/power';
import { getSatellitePasses, type SatellitePass, type PassPrediction } from '../nasa/n2yo';

export interface CollectionWindow {
  startTime: string;
  endTime: string;
  satellite: string;
  score: number; // 0-100
  cloudCoverage: number; // Predicted %
  maxElevation: number; // Satellite elevation angle
  sunElevation: number; // Sun angle (optical only)
  factors: {
    name: string;
    value: number;
    weight: number;
    description: string;
  }[];
  recommended: boolean;
}

export interface TaskingRecommendation {
  location: { lat: number; lon: number };
  analysisDate: string;
  optimalWindows: CollectionWindow[];
  nextBestWindow: CollectionWindow | null;
  cloudForecast: {
    date: string;
    expectedCoverage: number;
    confidence: number;
  }[];
  satelliteSchedule: {
    satellite: string;
    nextPass: string;
    frequency: string; // e.g., "Daily", "Every 2-3 days"
  }[];
  priorities: {
    urgencyScore: number; // 0-100
    factors: string[];
    recommendedAction: string;
  };
}

export interface TaskingCriteria {
  maxCloudCoverage?: number; // Default 20%
  minElevation?: number; // Default 30°
  preferredSatellites?: string[];
  timeOfDay?: 'morning' | 'midday' | 'afternoon' | 'any';
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  sensorType?: 'optical' | 'sar' | 'any'; // SAR works through clouds
}

// Satellite metadata for tasking
const SATELLITE_INFO: Record<string, {
  type: 'optical' | 'sar';
  resolution: string;
  revisitDays: number;
  swathKm: number;
}> = {
  'Landsat 8': { type: 'optical', resolution: '30m', revisitDays: 16, swathKm: 185 },
  'Landsat 9': { type: 'optical', resolution: '30m', revisitDays: 16, swathKm: 185 },
  'Sentinel-2A': { type: 'optical', resolution: '10m', revisitDays: 5, swathKm: 290 },
  'Sentinel-2B': { type: 'optical', resolution: '10m', revisitDays: 5, swathKm: 290 },
  'Terra': { type: 'optical', resolution: '250m', revisitDays: 1, swathKm: 2330 },
  'Aqua': { type: 'optical', resolution: '250m', revisitDays: 1, swathKm: 2330 },
  'NOAA 20': { type: 'optical', resolution: '375m', revisitDays: 1, swathKm: 3000 },
  'Suomi NPP': { type: 'optical', resolution: '375m', revisitDays: 1, swathKm: 3000 },
  'Sentinel-1A': { type: 'sar', resolution: '10m', revisitDays: 6, swathKm: 250 },
  'Sentinel-1B': { type: 'sar', resolution: '10m', revisitDays: 6, swathKm: 250 },
};

/**
 * Get optimal collection windows for a location
 */
export async function getOptimalCollectionWindows(
  lat: number,
  lon: number,
  criteria: TaskingCriteria = {},
  n2yoApiKey?: string
): Promise<TaskingRecommendation> {
  const {
    maxCloudCoverage = 20,
    minElevation = 30,
    preferredSatellites,
    timeOfDay = 'any',
    urgency = 'medium',
    sensorType = 'any',
  } = criteria;

  // Get weather forecast (next 7 days)
  const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const weather = await getWeatherData(
    lat,
    lon,
    new Date().toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  );

  // Get satellite pass predictions
  let passes: PassPrediction | null = null;
  if (n2yoApiKey) {
    try {
      passes = await getSatellitePasses(n2yoApiKey, lat, lon, 0, preferredSatellites, 7);
    } catch (err) {
      console.warn('Failed to get satellite passes:', err);
    }
  }

  // Generate collection windows
  const windows: CollectionWindow[] = [];

  // If we have satellite passes, create windows for each
  if (passes?.passes) {
    for (const pass of passes.passes) {
      const passDate = new Date(pass.startTime);
      const dateStr = passDate.toISOString().split('T')[0];

      // Find weather for this date
      const dayWeather = weather.data.find(d => d.date === dateStr);
      const cloudCoverage = dayWeather?.cloudCover ?? 50;

      // Check if satellite type matches criteria
      const satInfo = SATELLITE_INFO[pass.satellite];
      if (sensorType !== 'any' && satInfo && satInfo.type !== sensorType) {
        continue;
      }

      // Calculate window score
      const factors = calculateWindowFactors(
        pass,
        cloudCoverage,
        dayWeather,
        minElevation,
        maxCloudCoverage,
        timeOfDay,
        urgency
      );

      const score = factors.reduce((sum, f) => sum + f.value * f.weight, 0) /
                    factors.reduce((sum, f) => sum + f.weight, 0);

      windows.push({
        startTime: pass.startTime,
        endTime: pass.endTime,
        satellite: pass.satellite,
        score: Math.round(score),
        cloudCoverage,
        maxElevation: pass.maxElevation,
        sunElevation: calculateSunElevation(lat, lon, passDate),
        factors,
        recommended: score >= 70 && cloudCoverage <= maxCloudCoverage,
      });
    }
  }

  // Sort by score
  windows.sort((a, b) => b.score - a.score);

  // Generate cloud forecast
  const cloudForecast = weather.data.slice(0, 7).map(day => ({
    date: day.date,
    expectedCoverage: day.cloudCover ?? 50,
    confidence: 80 - (weather.data.indexOf(day) * 10), // Confidence decreases over time
  }));

  // Generate satellite schedule summary
  const satelliteSchedule = Object.entries(SATELLITE_INFO)
    .filter(([_, info]) => sensorType === 'any' || info.type === sensorType)
    .map(([name, info]) => ({
      satellite: name,
      nextPass: passes?.passes.find(p => p.satellite === name)?.startTime || 'Unknown',
      frequency: info.revisitDays === 1 ? 'Daily' : `Every ${info.revisitDays} days`,
    }));

  // Calculate priorities
  const priorities = calculatePriorities(windows, cloudForecast, urgency);

  return {
    location: { lat, lon },
    analysisDate: new Date().toISOString(),
    optimalWindows: windows.slice(0, 10),
    nextBestWindow: windows.find(w => w.recommended) || windows[0] || null,
    cloudForecast,
    satelliteSchedule: satelliteSchedule.slice(0, 6),
    priorities,
  };
}

/**
 * Calculate scoring factors for a collection window
 */
function calculateWindowFactors(
  pass: SatellitePass,
  cloudCoverage: number,
  weather: WeatherData | undefined,
  minElevation: number,
  maxCloud: number,
  timeOfDay: string,
  urgency: string
): CollectionWindow['factors'] {
  const factors: CollectionWindow['factors'] = [];

  // Cloud coverage factor (most important for optical)
  const cloudScore = cloudCoverage <= maxCloud
    ? 100 - (cloudCoverage / maxCloud) * 30
    : Math.max(0, 70 - (cloudCoverage - maxCloud) * 2);
  factors.push({
    name: 'Cloud Coverage',
    value: cloudScore,
    weight: 0.35,
    description: `${cloudCoverage}% cloud coverage ${cloudCoverage <= maxCloud ? '(acceptable)' : '(exceeds threshold)'}`,
  });

  // Elevation factor
  const elevScore = pass.maxElevation >= minElevation
    ? 70 + (pass.maxElevation - minElevation) * 0.5
    : (pass.maxElevation / minElevation) * 70;
  factors.push({
    name: 'Satellite Elevation',
    value: Math.min(100, elevScore),
    weight: 0.25,
    description: `${pass.maxElevation}° max elevation ${pass.maxElevation >= minElevation ? '(good)' : '(low)'}`,
  });

  // Time of day factor
  const passHour = new Date(pass.startTime).getHours();
  let timeScore = 70;
  if (timeOfDay === 'morning' && passHour >= 6 && passHour <= 10) timeScore = 100;
  else if (timeOfDay === 'midday' && passHour >= 10 && passHour <= 14) timeScore = 100;
  else if (timeOfDay === 'afternoon' && passHour >= 14 && passHour <= 18) timeScore = 100;
  else if (timeOfDay === 'any') timeScore = 80;
  factors.push({
    name: 'Time of Day',
    value: timeScore,
    weight: 0.15,
    description: `Pass at ${passHour}:00 local time`,
  });

  // Weather stability factor
  const precipScore = weather && weather.precipitation < 1 ? 100 :
                      weather && weather.precipitation < 5 ? 70 : 40;
  factors.push({
    name: 'Weather Stability',
    value: precipScore,
    weight: 0.15,
    description: weather ? `${weather.precipitation}mm precipitation expected` : 'No weather data',
  });

  // Urgency bonus
  const urgencyBonus = urgency === 'critical' ? 20 :
                       urgency === 'high' ? 10 :
                       urgency === 'medium' ? 0 : -5;
  factors.push({
    name: 'Urgency Factor',
    value: 70 + urgencyBonus,
    weight: 0.10,
    description: `${urgency} priority task`,
  });

  return factors;
}

/**
 * Calculate sun elevation angle (simplified)
 */
function calculateSunElevation(lat: number, lon: number, date: Date): number {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const hour = date.getHours() + date.getMinutes() / 60;

  // Simplified calculation
  const declination = 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * Math.PI / 180);
  const hourAngle = 15 * (hour - 12);
  const latRad = lat * Math.PI / 180;
  const declRad = declination * Math.PI / 180;
  const hourRad = hourAngle * Math.PI / 180;

  const elevation = Math.asin(
    Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourRad)
  ) * 180 / Math.PI;

  return Math.round(Math.max(0, elevation));
}

/**
 * Calculate task priorities
 */
function calculatePriorities(
  windows: CollectionWindow[],
  cloudForecast: { date: string; expectedCoverage: number }[],
  urgency: string
): TaskingRecommendation['priorities'] {
  const factors: string[] = [];
  let urgencyScore = 50;

  // Base urgency
  if (urgency === 'critical') {
    urgencyScore = 100;
    factors.push('Critical priority task - immediate collection needed');
  } else if (urgency === 'high') {
    urgencyScore = 80;
    factors.push('High priority - collect within 24-48 hours');
  } else if (urgency === 'low') {
    urgencyScore = 30;
    factors.push('Low priority - flexible collection window');
  }

  // Weather window closing?
  const goodDays = cloudForecast.filter(d => d.expectedCoverage < 30).length;
  if (goodDays <= 1) {
    urgencyScore += 20;
    factors.push('Limited clear weather windows available');
  } else if (goodDays >= 5) {
    factors.push('Multiple clear weather opportunities expected');
  }

  // Available windows
  const recommendedWindows = windows.filter(w => w.recommended).length;
  if (recommendedWindows === 0) {
    urgencyScore += 10;
    factors.push('No optimal windows currently available - consider SAR');
  } else if (recommendedWindows >= 3) {
    factors.push(`${recommendedWindows} good collection opportunities identified`);
  }

  // Generate recommendation
  let recommendedAction: string;
  if (urgencyScore >= 90) {
    recommendedAction = 'Immediate tasking recommended - use next available window';
  } else if (urgencyScore >= 70) {
    recommendedAction = 'Task within 24-48 hours for best conditions';
  } else if (urgencyScore >= 50) {
    recommendedAction = 'Schedule for optimal window within the week';
  } else {
    recommendedAction = 'Flexible scheduling - wait for ideal conditions';
  }

  return {
    urgencyScore: Math.min(100, urgencyScore),
    factors,
    recommendedAction,
  };
}

/**
 * Find cloud-free collection windows
 */
export async function findCloudFreeWindows(
  lat: number,
  lon: number,
  maxCloudCoverage: number = 15,
  daysAhead: number = 7
): Promise<{
  windows: { date: string; cloudCoverage: number; suitable: boolean }[];
  nextClearDay: string | null;
  avgCloudCoverage: number;
}> {
  const endDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const weather = await getWeatherData(
    lat,
    lon,
    new Date().toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  );

  const windows = weather.data.map(day => ({
    date: day.date,
    cloudCoverage: day.cloudCover ?? 50,
    suitable: (day.cloudCover ?? 50) <= maxCloudCoverage,
  }));

  const nextClearDay = windows.find(w => w.suitable)?.date || null;
  const avgCloudCoverage = Math.round(
    windows.reduce((sum, w) => sum + w.cloudCoverage, 0) / windows.length
  );

  return {
    windows,
    nextClearDay,
    avgCloudCoverage,
  };
}

/**
 * Score a collection request based on multiple criteria
 */
export function scoreCollectionRequest(
  cloudCoverage: number,
  elevation: number,
  timeUntilPass: number, // hours
  urgency: 'low' | 'medium' | 'high' | 'critical'
): {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendation: string;
} {
  let score = 100;

  // Cloud penalty
  if (cloudCoverage > 20) score -= (cloudCoverage - 20) * 1.5;
  if (cloudCoverage > 50) score -= (cloudCoverage - 50) * 1;

  // Elevation bonus/penalty
  if (elevation >= 60) score += 10;
  else if (elevation < 30) score -= (30 - elevation) * 0.5;

  // Time factor
  if (timeUntilPass < 2) score += 5; // Imminent
  else if (timeUntilPass > 72) score -= 10; // Far out

  // Urgency adjustment
  if (urgency === 'critical' && timeUntilPass > 24) score -= 15;
  else if (urgency === 'low') score += 5;

  score = Math.max(0, Math.min(100, score));

  const grade: 'A' | 'B' | 'C' | 'D' | 'F' =
    score >= 90 ? 'A' :
    score >= 75 ? 'B' :
    score >= 60 ? 'C' :
    score >= 40 ? 'D' : 'F';

  const recommendation =
    grade === 'A' ? 'Excellent conditions - proceed with collection' :
    grade === 'B' ? 'Good conditions - collection recommended' :
    grade === 'C' ? 'Acceptable conditions - consider waiting for better window' :
    grade === 'D' ? 'Poor conditions - recommend delaying if possible' :
    'Unsuitable conditions - do not proceed';

  return { score: Math.round(score), grade, recommendation };
}
