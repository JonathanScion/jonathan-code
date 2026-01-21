/**
 * Agricultural Intelligence Suite
 * Provides crop health analysis, drought monitoring, and yield predictions
 */

import { getWeatherData, getClimateSummary, type WeatherData } from '../nasa/power';

// NDVI value ranges for crop health classification
const NDVI_THRESHOLDS = {
  barren: { min: -1, max: 0.1 },
  sparse: { min: 0.1, max: 0.2 },
  moderatelyHealthy: { min: 0.2, max: 0.4 },
  healthy: { min: 0.4, max: 0.6 },
  veryHealthy: { min: 0.6, max: 1.0 },
};

// Crop types with their optimal conditions
const CROP_PROFILES: Record<string, CropProfile> = {
  wheat: {
    name: 'Wheat',
    optimalNDVI: { min: 0.4, max: 0.8 },
    optimalTemp: { min: 10, max: 25 },
    waterNeed: 'moderate', // mm per growing season: 450-650
    growingSeasonMonths: [3, 4, 5, 6, 7], // March-July (Northern Hemisphere)
  },
  corn: {
    name: 'Corn/Maize',
    optimalNDVI: { min: 0.5, max: 0.9 },
    optimalTemp: { min: 18, max: 32 },
    waterNeed: 'high', // mm per growing season: 500-800
    growingSeasonMonths: [5, 6, 7, 8, 9], // May-September
  },
  rice: {
    name: 'Rice',
    optimalNDVI: { min: 0.4, max: 0.8 },
    optimalTemp: { min: 20, max: 35 },
    waterNeed: 'very high', // mm per growing season: 900-2000
    growingSeasonMonths: [4, 5, 6, 7, 8, 9], // April-September
  },
  soybean: {
    name: 'Soybean',
    optimalNDVI: { min: 0.4, max: 0.85 },
    optimalTemp: { min: 15, max: 30 },
    waterNeed: 'moderate', // mm per growing season: 450-700
    growingSeasonMonths: [5, 6, 7, 8, 9], // May-September
  },
  cotton: {
    name: 'Cotton',
    optimalNDVI: { min: 0.3, max: 0.7 },
    optimalTemp: { min: 20, max: 35 },
    waterNeed: 'moderate', // mm per growing season: 700-1300
    growingSeasonMonths: [4, 5, 6, 7, 8, 9, 10], // April-October
  },
  generic: {
    name: 'Generic Crops',
    optimalNDVI: { min: 0.3, max: 0.8 },
    optimalTemp: { min: 15, max: 30 },
    waterNeed: 'moderate',
    growingSeasonMonths: [3, 4, 5, 6, 7, 8, 9],
  },
};

export interface CropProfile {
  name: string;
  optimalNDVI: { min: number; max: number };
  optimalTemp: { min: number; max: number };
  waterNeed: 'low' | 'moderate' | 'high' | 'very high';
  growingSeasonMonths: number[];
}

export interface CropHealthScore {
  overall: number; // 0-100
  ndviScore: number; // 0-100
  moistureScore: number; // 0-100
  temperatureScore: number; // 0-100
  category: 'critical' | 'poor' | 'fair' | 'good' | 'excellent';
  trend: 'declining' | 'stable' | 'improving';
}

export interface DroughtIndex {
  level: 'none' | 'abnormally_dry' | 'moderate' | 'severe' | 'extreme' | 'exceptional';
  value: number; // -4 to +4 (negative = drought, positive = wet)
  precipitationDeficit: number; // mm below normal
  daysWithoutRain: number;
  soilMoistureEstimate: 'very_low' | 'low' | 'moderate' | 'adequate' | 'high';
}

export interface YieldPrediction {
  estimatedYieldPercent: number; // % of optimal yield (0-100+)
  confidence: number; // 0-100
  factors: {
    name: string;
    impact: 'positive' | 'negative' | 'neutral';
    description: string;
  }[];
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
}

export interface AgriculturalAnalysis {
  location: { lat: number; lon: number };
  analysisDate: string;
  cropType: string;
  cropHealth: CropHealthScore;
  droughtIndex: DroughtIndex;
  yieldPrediction: YieldPrediction;
  weatherSummary: {
    avgTemp: number;
    totalPrecip: number;
    avgHumidity: number;
    growingDegreeDays: number;
  };
  recommendations: string[];
  alerts: {
    type: 'drought' | 'frost' | 'heat' | 'excess_rain' | 'pest_risk';
    severity: 'low' | 'medium' | 'high';
    message: string;
  }[];
  seasonalComparison?: {
    currentNDVI: number;
    historicalAvgNDVI: number;
    deviation: number;
  };
}

/**
 * Perform comprehensive agricultural analysis for a location
 */
export async function analyzeAgriculture(
  lat: number,
  lon: number,
  ndviValue?: number,
  cropType: string = 'generic',
  historicalNDVI?: number[]
): Promise<AgriculturalAnalysis> {
  // Get weather data for the last 30 days
  const endDate = new Date();
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const weather = await getWeatherData(
    lat,
    lon,
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  );

  const climate = await getClimateSummary(lat, lon);

  const profile = CROP_PROFILES[cropType] || CROP_PROFILES.generic;

  // Calculate metrics
  const droughtIndex = calculateDroughtIndex(weather.data, climate.annualPrecip / 12);
  const cropHealth = calculateCropHealth(ndviValue, weather, profile, historicalNDVI);
  const yieldPrediction = predictYield(cropHealth, droughtIndex, weather, profile);
  const gdd = calculateGrowingDegreeDays(weather.data, profile);

  // Generate recommendations
  const recommendations = generateRecommendations(cropHealth, droughtIndex, weather, profile);
  const alerts = generateAlerts(weather, droughtIndex, cropHealth);

  // Seasonal comparison
  let seasonalComparison;
  if (ndviValue !== undefined && historicalNDVI && historicalNDVI.length > 0) {
    const avgHistorical = historicalNDVI.reduce((a, b) => a + b, 0) / historicalNDVI.length;
    seasonalComparison = {
      currentNDVI: ndviValue,
      historicalAvgNDVI: Math.round(avgHistorical * 1000) / 1000,
      deviation: Math.round((ndviValue - avgHistorical) * 1000) / 1000,
    };
  }

  return {
    location: { lat, lon },
    analysisDate: new Date().toISOString(),
    cropType: profile.name,
    cropHealth,
    droughtIndex,
    yieldPrediction,
    weatherSummary: {
      avgTemp: weather.average.temperature,
      totalPrecip: weather.average.precipitation,
      avgHumidity: weather.average.humidity,
      growingDegreeDays: gdd,
    },
    recommendations,
    alerts,
    seasonalComparison,
  };
}

/**
 * Calculate drought index based on recent weather
 */
function calculateDroughtIndex(
  weatherData: WeatherData[],
  normalMonthlyPrecip: number
): DroughtIndex {
  const totalPrecip = weatherData.reduce((sum, d) => sum + d.precipitation, 0);
  const expectedPrecip = normalMonthlyPrecip; // Expected for 30 days
  const deficit = expectedPrecip - totalPrecip;

  // Count consecutive days without significant rain
  let daysWithoutRain = 0;
  for (const day of weatherData) {
    if (day.precipitation < 1) {
      daysWithoutRain++;
    } else {
      break;
    }
  }

  // Calculate drought severity value (-4 to +4)
  // Simplified Palmer-like index
  const precipRatio = totalPrecip / Math.max(expectedPrecip, 1);
  const avgTemp = weatherData.reduce((sum, d) => sum + d.temperature, 0) / weatherData.length;
  const tempFactor = avgTemp > 30 ? -0.5 : avgTemp > 25 ? -0.2 : 0;

  let value = (precipRatio - 1) * 4 + tempFactor;
  value = Math.max(-4, Math.min(4, value));

  // Determine drought level
  let level: DroughtIndex['level'];
  let soilMoisture: DroughtIndex['soilMoistureEstimate'];

  if (value >= 0) {
    level = 'none';
    soilMoisture = value > 1 ? 'high' : 'adequate';
  } else if (value > -1) {
    level = 'abnormally_dry';
    soilMoisture = 'moderate';
  } else if (value > -2) {
    level = 'moderate';
    soilMoisture = 'low';
  } else if (value > -3) {
    level = 'severe';
    soilMoisture = 'low';
  } else if (value > -3.5) {
    level = 'extreme';
    soilMoisture = 'very_low';
  } else {
    level = 'exceptional';
    soilMoisture = 'very_low';
  }

  return {
    level,
    value: Math.round(value * 100) / 100,
    precipitationDeficit: Math.round(Math.max(0, deficit) * 10) / 10,
    daysWithoutRain,
    soilMoistureEstimate: soilMoisture,
  };
}

/**
 * Calculate crop health score
 */
function calculateCropHealth(
  ndviValue: number | undefined,
  weather: { data: WeatherData[]; average: { temperature: number; humidity: number } },
  profile: CropProfile,
  historicalNDVI?: number[]
): CropHealthScore {
  // NDVI Score (0-100)
  let ndviScore = 50; // Default if no NDVI provided
  if (ndviValue !== undefined) {
    const { min, max } = profile.optimalNDVI;
    if (ndviValue >= min && ndviValue <= max) {
      // Within optimal range
      const midpoint = (min + max) / 2;
      const range = max - min;
      ndviScore = 70 + 30 * (1 - Math.abs(ndviValue - midpoint) / (range / 2));
    } else if (ndviValue < min) {
      ndviScore = Math.max(0, (ndviValue / min) * 70);
    } else {
      ndviScore = 70; // Above optimal is still good
    }
  }

  // Temperature Score (0-100)
  const avgTemp = weather.average.temperature;
  const { min: tempMin, max: tempMax } = profile.optimalTemp;
  let tempScore;
  if (avgTemp >= tempMin && avgTemp <= tempMax) {
    tempScore = 100;
  } else if (avgTemp < tempMin) {
    tempScore = Math.max(0, 100 - (tempMin - avgTemp) * 10);
  } else {
    tempScore = Math.max(0, 100 - (avgTemp - tempMax) * 10);
  }

  // Moisture Score (0-100) based on humidity and precipitation
  const avgHumidity = weather.average.humidity;
  const totalPrecip = weather.data.reduce((sum, d) => sum + d.precipitation, 0);
  const moistureScore = Math.min(100, (avgHumidity / 60) * 50 + (totalPrecip / 50) * 50);

  // Overall score (weighted average)
  const overall = Math.round(ndviScore * 0.5 + tempScore * 0.25 + moistureScore * 0.25);

  // Determine category
  let category: CropHealthScore['category'];
  if (overall >= 80) category = 'excellent';
  else if (overall >= 65) category = 'good';
  else if (overall >= 50) category = 'fair';
  else if (overall >= 30) category = 'poor';
  else category = 'critical';

  // Determine trend
  let trend: CropHealthScore['trend'] = 'stable';
  if (historicalNDVI && historicalNDVI.length >= 2 && ndviValue !== undefined) {
    const recentAvg = historicalNDVI.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, historicalNDVI.length);
    if (ndviValue > recentAvg + 0.05) trend = 'improving';
    else if (ndviValue < recentAvg - 0.05) trend = 'declining';
  }

  return {
    overall,
    ndviScore: Math.round(ndviScore),
    moistureScore: Math.round(moistureScore),
    temperatureScore: Math.round(tempScore),
    category,
    trend,
  };
}

/**
 * Calculate Growing Degree Days (GDD)
 */
function calculateGrowingDegreeDays(weatherData: WeatherData[], profile: CropProfile): number {
  const baseTemp = profile.optimalTemp.min - 5; // Base temperature for crop

  return Math.round(weatherData.reduce((gdd, day) => {
    const avgDayTemp = (day.temperatureMax + day.temperatureMin) / 2;
    const contribution = Math.max(0, avgDayTemp - baseTemp);
    return gdd + contribution;
  }, 0));
}

/**
 * Predict yield based on current conditions
 */
function predictYield(
  cropHealth: CropHealthScore,
  drought: DroughtIndex,
  weather: { data: WeatherData[]; average: { temperature: number } },
  profile: CropProfile
): YieldPrediction {
  const factors: YieldPrediction['factors'] = [];
  let yieldPercent = 100;

  // NDVI/vegetation health impact
  if (cropHealth.ndviScore >= 70) {
    factors.push({
      name: 'Vegetation Health',
      impact: 'positive',
      description: 'Strong vegetation index indicates healthy crop development',
    });
    yieldPercent += (cropHealth.ndviScore - 70) * 0.3;
  } else if (cropHealth.ndviScore < 50) {
    factors.push({
      name: 'Vegetation Health',
      impact: 'negative',
      description: 'Low vegetation index suggests stressed or underdeveloped crops',
    });
    yieldPercent -= (50 - cropHealth.ndviScore) * 0.5;
  } else {
    factors.push({
      name: 'Vegetation Health',
      impact: 'neutral',
      description: 'Moderate vegetation development',
    });
  }

  // Drought impact
  if (drought.level === 'none') {
    factors.push({
      name: 'Water Availability',
      impact: 'positive',
      description: 'Adequate soil moisture for crop growth',
    });
  } else if (drought.level === 'abnormally_dry' || drought.level === 'moderate') {
    factors.push({
      name: 'Water Stress',
      impact: 'negative',
      description: `${drought.level.replace('_', ' ')} conditions may reduce yield`,
    });
    yieldPercent -= drought.level === 'moderate' ? 15 : 8;
  } else {
    factors.push({
      name: 'Severe Drought',
      impact: 'negative',
      description: `${drought.level.replace('_', ' ')} drought significantly threatens yield`,
    });
    yieldPercent -= drought.level === 'severe' ? 30 : drought.level === 'extreme' ? 50 : 70;
  }

  // Temperature stress
  const avgTemp = weather.average.temperature;
  if (avgTemp > profile.optimalTemp.max + 5) {
    factors.push({
      name: 'Heat Stress',
      impact: 'negative',
      description: 'Excessive heat may damage crops and reduce yield',
    });
    yieldPercent -= (avgTemp - profile.optimalTemp.max) * 3;
  } else if (avgTemp < profile.optimalTemp.min - 5) {
    factors.push({
      name: 'Cold Stress',
      impact: 'negative',
      description: 'Low temperatures may slow growth or cause frost damage',
    });
    yieldPercent -= (profile.optimalTemp.min - avgTemp) * 3;
  }

  // Cap yield percent
  yieldPercent = Math.max(0, Math.min(120, yieldPercent));

  // Confidence based on data quality
  const confidence = Math.min(85, 50 + (weather.data.length * 1.5));

  // Risk level
  let riskLevel: YieldPrediction['riskLevel'];
  if (yieldPercent >= 80) riskLevel = 'low';
  else if (yieldPercent >= 60) riskLevel = 'moderate';
  else if (yieldPercent >= 40) riskLevel = 'high';
  else riskLevel = 'critical';

  return {
    estimatedYieldPercent: Math.round(yieldPercent),
    confidence: Math.round(confidence),
    factors,
    riskLevel,
  };
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(
  health: CropHealthScore,
  drought: DroughtIndex,
  weather: { average: { temperature: number; humidity: number } },
  profile: CropProfile
): string[] {
  const recommendations: string[] = [];

  // Irrigation recommendations
  if (drought.level !== 'none') {
    if (drought.level === 'exceptional' || drought.level === 'extreme') {
      recommendations.push('URGENT: Implement emergency irrigation immediately to prevent crop loss');
    } else if (drought.level === 'severe') {
      recommendations.push('Increase irrigation frequency and consider deficit irrigation strategies');
    } else {
      recommendations.push('Monitor soil moisture levels closely and adjust irrigation schedule');
    }
  }

  // Health-based recommendations
  if (health.category === 'critical' || health.category === 'poor') {
    recommendations.push('Conduct field inspection to identify cause of crop stress');
    recommendations.push('Consider soil testing for nutrient deficiencies');
  }

  if (health.trend === 'declining') {
    recommendations.push('Investigate recent changes in field conditions - vegetation health is declining');
  }

  // Temperature-based recommendations
  const avgTemp = weather.average.temperature;
  if (avgTemp > profile.optimalTemp.max) {
    recommendations.push('Consider shade structures or increased irrigation to combat heat stress');
  } else if (avgTemp < profile.optimalTemp.min) {
    recommendations.push('Monitor for frost conditions and prepare protective measures');
  }

  // General good practice recommendations
  if (recommendations.length === 0) {
    recommendations.push('Conditions are favorable - maintain current management practices');
    recommendations.push('Continue regular field monitoring to track crop development');
  }

  // NDVI-specific recommendations
  if (health.ndviScore < 40) {
    recommendations.push('Low vegetation index detected - verify crop emergence and stand density');
  }

  return recommendations;
}

/**
 * Generate alerts for critical conditions
 */
function generateAlerts(
  weather: { data: WeatherData[]; average: { temperature: number } },
  drought: DroughtIndex,
  health: CropHealthScore
): AgriculturalAnalysis['alerts'] {
  const alerts: AgriculturalAnalysis['alerts'] = [];

  // Drought alerts
  if (drought.level === 'exceptional' || drought.level === 'extreme') {
    alerts.push({
      type: 'drought',
      severity: 'high',
      message: `${drought.level.replace('_', ' ').toUpperCase()} drought conditions detected. Immediate action required.`,
    });
  } else if (drought.level === 'severe') {
    alerts.push({
      type: 'drought',
      severity: 'medium',
      message: 'Severe drought conditions may significantly impact crop yield.',
    });
  }

  // Frost alert
  const minTemp = Math.min(...weather.data.map(d => d.temperatureMin));
  if (minTemp <= 2) {
    alerts.push({
      type: 'frost',
      severity: minTemp <= 0 ? 'high' : 'medium',
      message: `Frost risk detected. Minimum temperature: ${minTemp}°C`,
    });
  }

  // Heat alert
  const maxTemp = Math.max(...weather.data.map(d => d.temperatureMax));
  if (maxTemp >= 38) {
    alerts.push({
      type: 'heat',
      severity: maxTemp >= 42 ? 'high' : 'medium',
      message: `Extreme heat detected. Maximum temperature: ${maxTemp}°C`,
    });
  }

  // Excess rain alert
  const totalPrecip = weather.data.reduce((sum, d) => sum + d.precipitation, 0);
  if (totalPrecip > 150) {
    alerts.push({
      type: 'excess_rain',
      severity: totalPrecip > 250 ? 'high' : 'medium',
      message: `High precipitation (${Math.round(totalPrecip)}mm in 30 days) may cause waterlogging or disease.`,
    });
  }

  // Pest risk (warm + humid conditions)
  if (weather.average.temperature > 20 && weather.data.some(d => d.humidity > 80)) {
    alerts.push({
      type: 'pest_risk',
      severity: 'low',
      message: 'Warm, humid conditions increase pest and disease risk. Monitor fields closely.',
    });
  }

  return alerts;
}

/**
 * Get NDVI health classification
 */
export function classifyNDVI(ndviValue: number): {
  category: string;
  description: string;
  color: string;
} {
  if (ndviValue < NDVI_THRESHOLDS.barren.max) {
    return { category: 'Barren/Water', description: 'No vegetation detected', color: '#8B4513' };
  } else if (ndviValue < NDVI_THRESHOLDS.sparse.max) {
    return { category: 'Sparse', description: 'Very limited vegetation', color: '#DAA520' };
  } else if (ndviValue < NDVI_THRESHOLDS.moderatelyHealthy.max) {
    return { category: 'Moderate', description: 'Developing vegetation', color: '#9ACD32' };
  } else if (ndviValue < NDVI_THRESHOLDS.healthy.max) {
    return { category: 'Healthy', description: 'Good vegetation health', color: '#32CD32' };
  } else {
    return { category: 'Very Healthy', description: 'Excellent vegetation density', color: '#006400' };
  }
}

/**
 * Get available crop types
 */
export function getCropTypes(): { id: string; name: string }[] {
  return Object.entries(CROP_PROFILES).map(([id, profile]) => ({
    id,
    name: profile.name,
  }));
}
