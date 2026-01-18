/**
 * NASA POWER (Prediction Of Worldwide Energy Resources) API Client
 * Get meteorological/weather data
 * No API key required
 */

import axios from 'axios';

const POWER_BASE_URL = 'https://power.larc.nasa.gov/api/temporal';

export interface WeatherData {
  date: string;
  temperature: number;      // Celsius
  temperatureMin: number;
  temperatureMax: number;
  humidity: number;         // Percentage
  precipitation: number;    // mm
  windSpeed: number;        // m/s
  solarRadiation: number;   // W/m²
  cloudCover?: number;      // Percentage
}

export interface WeatherSummary {
  location: { lat: number; lon: number };
  period: { start: string; end: string };
  current: WeatherData;
  average: {
    temperature: number;
    humidity: number;
    precipitation: number;
  };
  data: WeatherData[];
}

// Common parameters
const PARAMETERS = [
  'T2M',          // Temperature at 2 meters (C)
  'T2M_MIN',      // Min temperature
  'T2M_MAX',      // Max temperature
  'RH2M',         // Relative humidity at 2 meters (%)
  'PRECTOTCORR',  // Precipitation (mm)
  'WS2M',         // Wind speed at 2 meters (m/s)
  'ALLSKY_SFC_SW_DWN', // Solar radiation (W/m²)
  'CLOUD_AMT',    // Cloud amount (%)
];

/**
 * Get weather data for a location
 * @param lat - Latitude
 * @param lon - Longitude
 * @param startDate - Start date (YYYYMMDD)
 * @param endDate - End date (YYYYMMDD)
 */
export async function getWeatherData(
  lat: number,
  lon: number,
  startDate?: string,
  endDate?: string
): Promise<WeatherSummary> {
  // Default to last 7 days
  const end = endDate || formatDate(new Date());
  const start = startDate || formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

  try {
    const response = await axios.get(`${POWER_BASE_URL}/daily/point`, {
      params: {
        parameters: PARAMETERS.join(','),
        community: 'RE', // Renewable Energy
        longitude: lon,
        latitude: lat,
        start: start.replace(/-/g, ''),
        end: end.replace(/-/g, ''),
        format: 'JSON',
      },
      timeout: 30000, // POWER API can be slow
    });

    const data = response.data;
    const properties = data.properties?.parameter || {};

    // Parse daily data
    const dates = Object.keys(properties.T2M || {}).filter(d => d !== 'units');
    const weatherData: WeatherData[] = [];

    for (const date of dates) {
      const temp = properties.T2M?.[date];
      if (temp === undefined || temp === -999) continue; // Skip missing data

      weatherData.push({
        date: formatDateFromPower(date),
        temperature: round(temp),
        temperatureMin: round(properties.T2M_MIN?.[date] ?? temp),
        temperatureMax: round(properties.T2M_MAX?.[date] ?? temp),
        humidity: round(properties.RH2M?.[date] ?? 0),
        precipitation: round(properties.PRECTOTCORR?.[date] ?? 0, 1),
        windSpeed: round(properties.WS2M?.[date] ?? 0, 1),
        solarRadiation: round(properties.ALLSKY_SFC_SW_DWN?.[date] ?? 0),
        cloudCover: properties.CLOUD_AMT?.[date] !== -999
          ? round(properties.CLOUD_AMT[date])
          : undefined,
      });
    }

    // Sort by date descending
    weatherData.sort((a, b) => b.date.localeCompare(a.date));

    // Calculate averages
    const avgTemp = average(weatherData.map(d => d.temperature));
    const avgHumidity = average(weatherData.map(d => d.humidity));
    const totalPrecip = weatherData.reduce((sum, d) => sum + d.precipitation, 0);

    return {
      location: { lat, lon },
      period: { start, end },
      current: weatherData[0] || createEmptyWeather(end),
      average: {
        temperature: avgTemp,
        humidity: avgHumidity,
        precipitation: round(totalPrecip, 1),
      },
      data: weatherData,
    };
  } catch (error: any) {
    console.error('POWER API error:', error.message);
    throw new Error(`POWER API error: ${error.message}`);
  }
}

/**
 * Get weather for a specific date (for image enrichment)
 */
export async function getWeatherForDate(
  lat: number,
  lon: number,
  date: string
): Promise<WeatherData> {
  const formattedDate = date.replace(/-/g, '');

  try {
    const response = await axios.get(`${POWER_BASE_URL}/daily/point`, {
      params: {
        parameters: PARAMETERS.join(','),
        community: 'RE',
        longitude: lon,
        latitude: lat,
        start: formattedDate,
        end: formattedDate,
        format: 'JSON',
      },
      timeout: 30000,
    });

    const data = response.data;
    const properties = data.properties?.parameter || {};

    const temp = properties.T2M?.[formattedDate];
    if (temp === undefined || temp === -999) {
      return createEmptyWeather(date);
    }

    return {
      date,
      temperature: round(temp),
      temperatureMin: round(properties.T2M_MIN?.[formattedDate] ?? temp),
      temperatureMax: round(properties.T2M_MAX?.[formattedDate] ?? temp),
      humidity: round(properties.RH2M?.[formattedDate] ?? 0),
      precipitation: round(properties.PRECTOTCORR?.[formattedDate] ?? 0, 1),
      windSpeed: round(properties.WS2M?.[formattedDate] ?? 0, 1),
      solarRadiation: round(properties.ALLSKY_SFC_SW_DWN?.[formattedDate] ?? 0),
      cloudCover: properties.CLOUD_AMT?.[formattedDate] !== -999
        ? round(properties.CLOUD_AMT[formattedDate])
        : undefined,
    };
  } catch (error: any) {
    console.error('POWER API error:', error.message);
    return createEmptyWeather(date);
  }
}

/**
 * Get climate summary for a location (monthly averages)
 */
export async function getClimateSummary(lat: number, lon: number): Promise<{
  annualAvgTemp: number;
  annualPrecip: number;
  annualSolarRad: number;
}> {
  try {
    const response = await axios.get(`${POWER_BASE_URL}/climatology/point`, {
      params: {
        parameters: 'T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN',
        community: 'RE',
        longitude: lon,
        latitude: lat,
        format: 'JSON',
      },
      timeout: 30000,
    });

    const data = response.data;
    const params = data.properties?.parameter || {};

    return {
      annualAvgTemp: round(params.T2M?.ANN ?? 0),
      annualPrecip: round(params.PRECTOTCORR?.ANN ?? 0),
      annualSolarRad: round(params.ALLSKY_SFC_SW_DWN?.ANN ?? 0),
    };
  } catch (error: any) {
    console.error('POWER climatology error:', error.message);
    return {
      annualAvgTemp: 0,
      annualPrecip: 0,
      annualSolarRad: 0,
    };
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateFromPower(powerDate: string): string {
  // POWER uses YYYYMMDD format
  return `${powerDate.slice(0, 4)}-${powerDate.slice(4, 6)}-${powerDate.slice(6, 8)}`;
}

function round(value: number, decimals: number = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return round(values.reduce((a, b) => a + b, 0) / values.length, 1);
}

function createEmptyWeather(date: string): WeatherData {
  return {
    date,
    temperature: 0,
    temperatureMin: 0,
    temperatureMax: 0,
    humidity: 0,
    precipitation: 0,
    windSpeed: 0,
    solarRadiation: 0,
  };
}
