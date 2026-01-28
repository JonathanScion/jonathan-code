import { fileURLToPath } from 'url'; import { dirname } from 'path'; const __filename = fileURLToPath(import.meta.url); const __dirname = dirname(__filename);

// dist/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path3 from "path";
import { v4 as uuidv4 } from "uuid";

// dist/lib/database.js
import { Pool } from "pg";
var pool = new Pool(process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
} : {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "satellite_images",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres"
});
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS images (
        id UUID PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        filename VARCHAR(500) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size BIGINT NOT NULL,
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        captured_at TIMESTAMP WITH TIME ZONE,

        -- Geographic metadata
        bounds_north DOUBLE PRECISION,
        bounds_south DOUBLE PRECISION,
        bounds_east DOUBLE PRECISION,
        bounds_west DOUBLE PRECISION,
        center_lat DOUBLE PRECISION,
        center_lon DOUBLE PRECISION,
        projection VARCHAR(100),

        -- Technical metadata
        resolution DOUBLE PRECISION,
        width INTEGER,
        height INTEGER,
        bands INTEGER,
        bit_depth INTEGER,

        -- Satellite information
        satellite_name VARCHAR(100),
        sensor_type VARCHAR(100),
        cloud_coverage DOUBLE PRECISION,

        -- User metadata
        title VARCHAR(255),
        description TEXT,
        tags TEXT[], -- PostgreSQL array
        collection_ids UUID[],

        -- Processing
        thumbnail_path VARCHAR(500),
        preview_path VARCHAR(500),
        status VARCHAR(20) DEFAULT 'UPLOADING',

        -- Annotations and analysis stored as JSONB
        annotations JSONB,
        analysis JSONB,

        -- NASA enrichment data
        nasa_enrichment JSONB
      );

      CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);
      CREATE INDEX IF NOT EXISTS idx_images_uploaded_at ON images(uploaded_at DESC);
      CREATE INDEX IF NOT EXISTS idx_images_status ON images(status);

      CREATE TABLE IF NOT EXISTS collections (
        id UUID PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        image_ids UUID[],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        is_public BOOLEAN DEFAULT FALSE,
        share_token VARCHAR(100)
      );

      CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);

      CREATE TABLE IF NOT EXISTS requests (
        id UUID PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,

        -- Location details
        target_lat DOUBLE PRECISION NOT NULL,
        target_lon DOUBLE PRECISION NOT NULL,
        target_bounds_north DOUBLE PRECISION,
        target_bounds_south DOUBLE PRECISION,
        target_bounds_east DOUBLE PRECISION,
        target_bounds_west DOUBLE PRECISION,
        location_name VARCHAR(255),

        -- Scheduling details
        requested_start_date DATE NOT NULL,
        requested_end_date DATE NOT NULL,
        scheduled_date DATE,
        completed_date DATE,

        -- Request metadata
        priority VARCHAR(20) DEFAULT 'MEDIUM',
        status VARCHAR(20) DEFAULT 'PENDING',
        title VARCHAR(255) NOT NULL,
        description TEXT,

        -- Technical requirements
        min_resolution DOUBLE PRECISION,
        max_cloud_coverage DOUBLE PRECISION,
        preferred_satellites TEXT[],

        -- Recurrence
        is_recurring BOOLEAN DEFAULT FALSE,
        recurrence_pattern VARCHAR(20),

        -- Results
        captured_image_ids UUID[],

        -- Timestamps
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        -- Notes
        notes TEXT,
        cancel_reason TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
    `);
    console.log("Database tables initialized successfully");
  } finally {
    client.release();
  }
}
function rowToImage(row) {
  if (!row)
    return null;
  return {
    id: row.id,
    userId: row.user_id,
    filename: row.filename,
    originalFilename: row.original_filename,
    s3Key: row.file_path,
    // Keep for compatibility with frontend
    s3Bucket: "local",
    // Keep for compatibility
    filePath: row.file_path,
    fileSize: parseInt(row.file_size),
    uploadedAt: row.uploaded_at?.toISOString(),
    capturedAt: row.captured_at?.toISOString(),
    bounds: row.bounds_north !== null ? {
      north: row.bounds_north,
      south: row.bounds_south,
      east: row.bounds_east,
      west: row.bounds_west
    } : void 0,
    centerPoint: row.center_lat !== null ? {
      lat: row.center_lat,
      lon: row.center_lon
    } : void 0,
    projection: row.projection,
    resolution: row.resolution,
    width: row.width,
    height: row.height,
    bands: row.bands,
    bitDepth: row.bit_depth,
    satelliteName: row.satellite_name,
    sensorType: row.sensor_type,
    cloudCoverage: row.cloud_coverage,
    title: row.title,
    description: row.description,
    tags: row.tags,
    collectionIds: row.collection_ids,
    thumbnailUrl: row.thumbnail_path,
    previewUrl: row.preview_path,
    status: row.status,
    annotations: row.annotations,
    analysis: row.analysis,
    nasaEnrichment: row.nasa_enrichment
  };
}
function rowToCollection(row) {
  if (!row)
    return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    imageIds: row.image_ids || [],
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
    isPublic: row.is_public,
    shareToken: row.share_token
  };
}

// dist/lib/storage.js
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
var mkdir2 = promisify(fs.mkdir);
var unlink2 = promisify(fs.unlink);
var stat2 = promisify(fs.stat);
var STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), "uploads");
var BASE_PATH = process.env.BASE_PATH || "";
async function ensureStorageDir() {
  try {
    await mkdir2(STORAGE_DIR, { recursive: true });
    await mkdir2(path.join(STORAGE_DIR, "images"), { recursive: true });
    await mkdir2(path.join(STORAGE_DIR, "thumbnails"), { recursive: true });
  } catch (err) {
    if (err.code !== "EEXIST")
      throw err;
  }
}
function getFilePath(key) {
  return path.join(STORAGE_DIR, key);
}
function generateUploadPath(imageId, filename) {
  return path.join("images", imageId, filename);
}
function getDownloadUrl(key) {
  return `${BASE_PATH}/files/${key.replace(/\\/g, "/")}`;
}
async function deleteFile(key) {
  const filePath = getFilePath(key);
  try {
    await unlink2(filePath);
    const parentDir = path.dirname(filePath);
    const files = fs.readdirSync(parentDir);
    if (files.length === 0) {
      fs.rmdirSync(parentDir);
    }
  } catch (err) {
    if (err.code !== "ENOENT")
      throw err;
  }
}

// dist/lib/nasa/cmr.js
import axios from "axios";
var CMR_BASE_URL = "https://cmr.earthdata.nasa.gov/search";
var COLLECTION_IDS = {
  LANDSAT_8: ["C2021957657-LPCLOUD", "C1711961296-LPCLOUD"],
  LANDSAT_9: ["C2021957295-LPCLOUD"],
  MODIS_TERRA: ["C1711961296-LPCLOUD", "C194001210-LPDAAC_ECS"],
  MODIS_AQUA: ["C194001241-LPDAAC_ECS"],
  SENTINEL_2: ["C1711924822-LPCLOUD"],
  VIIRS: ["C1711961296-LPCLOUD"]
};
async function searchCMR(params) {
  const { bbox, startDate, endDate, satellite, pageSize = 20, page = 1 } = params;
  const bboxStr = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
  const queryParams = {
    bounding_box: bboxStr,
    page_size: pageSize.toString(),
    page_num: page.toString(),
    sort_key: "-start_date"
    // Newest first
  };
  if (startDate || endDate) {
    const formatDate2 = (d) => {
      const date = new Date(d);
      return date.toISOString().replace(/\.\d{3}Z$/, "Z");
    };
    const start2 = startDate ? formatDate2(startDate) : "2000-01-01T00:00:00Z";
    const end = endDate ? formatDate2(endDate) : formatDate2((/* @__PURE__ */ new Date()).toISOString());
    queryParams.temporal = `${start2},${end}`;
  }
  let collectionIds;
  if (satellite && COLLECTION_IDS[satellite]) {
    collectionIds = COLLECTION_IDS[satellite];
  } else {
    collectionIds = [
      ...COLLECTION_IDS.LANDSAT_8,
      ...COLLECTION_IDS.LANDSAT_9,
      ...COLLECTION_IDS.SENTINEL_2
    ];
  }
  try {
    const params2 = {
      ...queryParams,
      collection_concept_id: collectionIds
    };
    const response = await axios.get(`${CMR_BASE_URL}/granules.json`, {
      params: params2,
      paramsSerializer: {
        indexes: null
        // Serialize arrays as repeated params: ?key=val1&key=val2
      },
      headers: {
        Accept: "application/json"
      }
    });
    const data = response.data;
    const feed = data.feed || {};
    const entries = feed.entry || [];
    const total = parseInt(feed.hits || "0", 10);
    const granules = entries.map((entry) => {
      let granuleBbox = bbox;
      if (entry.boxes && entry.boxes.length > 0) {
        const box = entry.boxes[0].split(" ").map(Number);
        granuleBbox = {
          south: box[0],
          west: box[1],
          north: box[2],
          east: box[3]
        };
      }
      const links = entry.links || [];
      const browseLink = links.find((l) => l.rel?.includes("browse") || l.title?.includes("Browse"));
      const downloadLink = links.find((l) => l.rel?.includes("data") || l.href?.includes("download"));
      return {
        id: entry.id,
        title: entry.title,
        collectionId: entry.collection_concept_id,
        satellite: extractSatellite(entry.title, entry.collection_concept_id),
        sensor: entry.platforms?.[0]?.instruments?.[0]?.short_name || "Unknown",
        startDate: entry.time_start,
        endDate: entry.time_end,
        bbox: granuleBbox,
        browseUrl: browseLink?.href,
        downloadUrl: downloadLink?.href,
        cloudCover: entry.cloud_cover ? parseFloat(entry.cloud_cover) : void 0,
        size: entry.granule_size ? parseFloat(entry.granule_size) : void 0
      };
    });
    return {
      granules,
      total,
      page,
      pageSize
    };
  } catch (error2) {
    const errorDetails = error2.response?.data?.errors || error2.response?.data || error2.message;
    console.error("CMR search error:", errorDetails);
    throw new Error(`CMR search failed: ${JSON.stringify(errorDetails)}`);
  }
}
function extractSatellite(title, collectionId) {
  const titleLower = title.toLowerCase();
  if (titleLower.includes("landsat 9") || collectionId.includes("L9"))
    return "Landsat 9";
  if (titleLower.includes("landsat 8") || collectionId.includes("L8"))
    return "Landsat 8";
  if (titleLower.includes("sentinel-2") || titleLower.includes("sentinel2"))
    return "Sentinel-2";
  if (titleLower.includes("modis") && titleLower.includes("terra"))
    return "MODIS Terra";
  if (titleLower.includes("modis") && titleLower.includes("aqua"))
    return "MODIS Aqua";
  if (titleLower.includes("viirs"))
    return "VIIRS";
  if (titleLower.includes("modis"))
    return "MODIS";
  return "Unknown";
}

// dist/lib/nasa/gibs.js
var GIBS_BASE_URL = "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best";
var GIBS_LAYERS = [
  // === TRUE COLOR LAYERS (work in both modes) ===
  {
    id: "MODIS_Terra_CorrectedReflectance_TrueColor",
    name: "MODIS Terra True Color",
    description: "Daily true color imagery from MODIS Terra",
    category: "trueColor",
    format: "jpg",
    tileMatrixSet: "250m",
    hasTime: true,
    startDate: "2000-02-24"
  },
  {
    id: "MODIS_Aqua_CorrectedReflectance_TrueColor",
    name: "MODIS Aqua True Color",
    description: "Daily true color imagery from MODIS Aqua",
    category: "trueColor",
    format: "jpg",
    tileMatrixSet: "250m",
    hasTime: true,
    startDate: "2002-07-04"
  },
  {
    id: "VIIRS_NOAA20_CorrectedReflectance_TrueColor",
    name: "VIIRS NOAA-20 True Color",
    description: "Daily true color from VIIRS NOAA-20 (higher resolution)",
    category: "trueColor",
    format: "jpg",
    tileMatrixSet: "250m",
    hasTime: true,
    startDate: "2018-01-01"
  },
  {
    id: "VIIRS_SNPP_CorrectedReflectance_TrueColor",
    name: "VIIRS SNPP True Color",
    description: "Daily true color from VIIRS Suomi NPP",
    category: "trueColor",
    format: "jpg",
    tileMatrixSet: "250m",
    hasTime: true,
    startDate: "2015-11-24"
  },
  // === VEGETATION LAYERS (NASA Mode only - EPSG:4326) ===
  {
    id: "MODIS_Terra_NDVI_8Day",
    name: "NDVI Vegetation",
    description: "8-day NDVI vegetation index (NASA Mode only)",
    category: "vegetation",
    format: "png",
    tileMatrixSet: "1km",
    hasTime: true,
    startDate: "2000-02-18",
    requiresNasaMode: true
  },
  // === THERMAL LAYERS (work in both modes) ===
  {
    id: "MODIS_Terra_Land_Surface_Temp_Day",
    name: "Surface Temperature (Day)",
    description: "Daytime land surface temperature",
    category: "thermal",
    format: "png",
    tileMatrixSet: "1km",
    hasTime: true,
    startDate: "2000-02-24"
  },
  // === FIRE DETECTION LAYERS (NASA Mode only - EPSG:4326) ===
  {
    id: "MODIS_Terra_Thermal_Anomalies_All",
    name: "MODIS Terra Fire Detection",
    description: "Fire and thermal anomaly detections from Terra (NASA Mode only)",
    category: "thermal",
    format: "png",
    tileMatrixSet: "1km",
    hasTime: true,
    startDate: "2000-02-24",
    requiresNasaMode: true
  },
  {
    id: "MODIS_Aqua_Thermal_Anomalies_All",
    name: "MODIS Aqua Fire Detection",
    description: "Fire and thermal anomaly detections from Aqua (NASA Mode only)",
    category: "thermal",
    format: "png",
    tileMatrixSet: "1km",
    hasTime: true,
    startDate: "2002-07-04",
    requiresNasaMode: true
  },
  {
    id: "VIIRS_NOAA20_Thermal_Anomalies_375m_All",
    name: "VIIRS NOAA-20 Fire Detection",
    description: "High-resolution fire detection from VIIRS (NASA Mode only)",
    category: "thermal",
    format: "png",
    tileMatrixSet: "250m",
    hasTime: true,
    startDate: "2018-01-01",
    requiresNasaMode: true
  },
  {
    id: "VIIRS_SNPP_Thermal_Anomalies_375m_All",
    name: "VIIRS SNPP Fire Detection",
    description: "High-resolution fire detection from VIIRS Suomi NPP (NASA Mode only)",
    category: "thermal",
    format: "png",
    tileMatrixSet: "250m",
    hasTime: true,
    startDate: "2012-01-19",
    requiresNasaMode: true
  },
  // === ATMOSPHERE LAYERS (NASA Mode only - EPSG:4326) ===
  {
    id: "MODIS_Terra_Aerosol_Optical_Depth",
    name: "Aerosol Optical Depth",
    description: "Atmospheric aerosol concentration (NASA Mode only)",
    category: "atmosphere",
    format: "png",
    tileMatrixSet: "2km",
    hasTime: true,
    startDate: "2000-02-24",
    requiresNasaMode: true
  },
  {
    id: "MODIS_Terra_Cloud_Top_Temp_Day",
    name: "Cloud Top Temperature",
    description: "Temperature of cloud tops (NASA Mode only)",
    category: "atmosphere",
    format: "png",
    tileMatrixSet: "2km",
    hasTime: true,
    startDate: "2000-02-24",
    requiresNasaMode: true
  }
];
function getGIBSLayers() {
  return GIBS_LAYERS;
}
function getGIBSTileUrl(layerId, date) {
  const layer = GIBS_LAYERS.find((l) => l.id === layerId);
  if (!layer) {
    throw new Error(`Unknown GIBS layer: ${layerId}`);
  }
  const tileDate = date || getYesterday();
  const url = `${GIBS_BASE_URL}/${layerId}/default/${tileDate}/${layer.tileMatrixSet}/{z}/{y}/{x}.${layer.format}`;
  return url;
}
function getYesterday() {
  const date = /* @__PURE__ */ new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().split("T")[0];
}
function getLeafletLayerConfig(layerId, date) {
  const layer = GIBS_LAYERS.find((l) => l.id === layerId);
  if (!layer) {
    throw new Error(`Unknown GIBS layer: ${layerId}`);
  }
  return {
    url: getGIBSTileUrl(layerId, date),
    options: {
      tileSize: 256,
      minZoom: 1,
      maxZoom: 9,
      attribution: "NASA GIBS",
      bounds: [[-90, -180], [90, 180]]
    }
  };
}

// dist/lib/nasa/firms.js
import axios2 from "axios";
var FIRMS_BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api";
async function getFireData(apiKey, bbox, days = 1, source = "VIIRS_NOAA20_NRT") {
  if (!apiKey) {
    throw new Error("NASA FIRMS API key is required");
  }
  const validDays = Math.max(1, Math.min(10, days));
  const bboxStr = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
  try {
    const url = `${FIRMS_BASE_URL}/area/csv/${apiKey}/${source}/${bboxStr}/${validDays}`;
    const response = await axios2.get(url, {
      headers: {
        Accept: "text/csv"
      }
    });
    const fires = parseCSV(response.data);
    const endDate = /* @__PURE__ */ new Date();
    const startDate = /* @__PURE__ */ new Date();
    startDate.setDate(startDate.getDate() - validDays);
    return {
      fires,
      total: fires.length,
      source,
      bbox,
      dateRange: {
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0]
      }
    };
  } catch (error2) {
    if (error2.response?.status === 429) {
      throw new Error("FIRMS rate limit exceeded. Please wait and try again.");
    }
    console.error("FIRMS API error:", error2.message);
    throw new Error(`FIRMS API error: ${error2.message}`);
  }
}
async function hasRecentFires(apiKey, lat, lon, radiusKm = 50, days = 7) {
  const radiusDeg = radiusKm / 111;
  const bbox = {
    north: lat + radiusDeg,
    south: lat - radiusDeg,
    east: lon + radiusDeg,
    west: lon - radiusDeg
  };
  const result = await getFireData(apiKey, bbox, days);
  if (result.fires.length === 0) {
    return { hasFires: false, count: 0 };
  }
  let nearestKm = Infinity;
  for (const fire of result.fires) {
    const distance = haversineDistance(lat, lon, fire.latitude, fire.longitude);
    if (distance < nearestKm) {
      nearestKm = distance;
    }
  }
  return {
    hasFires: true,
    count: result.fires.length,
    nearestKm: Math.round(nearestKm * 10) / 10
  };
}
function calculateFireRisk(fireCount, nearestKm) {
  if (fireCount === 0)
    return "none";
  if (nearestKm !== void 0 && nearestKm < 10)
    return "extreme";
  if (nearestKm !== void 0 && nearestKm < 25)
    return "high";
  if (fireCount > 50)
    return "high";
  if (fireCount > 10)
    return "moderate";
  return "low";
}
function parseCSV(csvData) {
  const lines = csvData.trim().split("\n");
  if (lines.length < 2)
    return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const fires = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    if (values.length < headers.length)
      continue;
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim();
    });
    try {
      fires.push({
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        brightness: parseFloat(row.bright_ti4 || row.brightness),
        scan: parseFloat(row.scan || "0"),
        track: parseFloat(row.track || "0"),
        acqDate: row.acq_date,
        acqTime: row.acq_time,
        satellite: row.satellite || "Unknown",
        confidence: parseFloat(row.confidence || "0"),
        version: row.version || "",
        brightT31: row.bright_ti5 ? parseFloat(row.bright_ti5) : void 0,
        frp: parseFloat(row.frp || "0"),
        dayNight: row.daynight || "D"
      });
    } catch (e) {
    }
  }
  return fires;
}
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function toRad(deg) {
  return deg * (Math.PI / 180);
}

// dist/lib/nasa/power.js
import axios3 from "axios";
var POWER_BASE_URL = "https://power.larc.nasa.gov/api/temporal";
var PARAMETERS = [
  "T2M",
  // Temperature at 2 meters (C)
  "T2M_MIN",
  // Min temperature
  "T2M_MAX",
  // Max temperature
  "RH2M",
  // Relative humidity at 2 meters (%)
  "PRECTOTCORR",
  // Precipitation (mm)
  "WS2M",
  // Wind speed at 2 meters (m/s)
  "ALLSKY_SFC_SW_DWN",
  // Solar radiation (W/m²)
  "CLOUD_AMT"
  // Cloud amount (%)
];
async function getWeatherData(lat, lon, startDate, endDate) {
  const end = endDate || formatDate(/* @__PURE__ */ new Date());
  const start2 = startDate || formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3));
  try {
    const response = await axios3.get(`${POWER_BASE_URL}/daily/point`, {
      params: {
        parameters: PARAMETERS.join(","),
        community: "RE",
        // Renewable Energy
        longitude: lon,
        latitude: lat,
        start: start2.replace(/-/g, ""),
        end: end.replace(/-/g, ""),
        format: "JSON"
      },
      timeout: 3e4
      // POWER API can be slow
    });
    const data = response.data;
    const properties = data.properties?.parameter || {};
    const dates = Object.keys(properties.T2M || {}).filter((d) => d !== "units");
    const weatherData = [];
    for (const date of dates) {
      const temp = properties.T2M?.[date];
      if (temp === void 0 || temp === -999)
        continue;
      weatherData.push({
        date: formatDateFromPower(date),
        temperature: round(temp),
        temperatureMin: round(properties.T2M_MIN?.[date] ?? temp),
        temperatureMax: round(properties.T2M_MAX?.[date] ?? temp),
        humidity: round(properties.RH2M?.[date] ?? 0),
        precipitation: round(properties.PRECTOTCORR?.[date] ?? 0, 1),
        windSpeed: round(properties.WS2M?.[date] ?? 0, 1),
        solarRadiation: round(properties.ALLSKY_SFC_SW_DWN?.[date] ?? 0),
        cloudCover: properties.CLOUD_AMT?.[date] !== -999 ? round(properties.CLOUD_AMT[date]) : void 0
      });
    }
    weatherData.sort((a, b) => b.date.localeCompare(a.date));
    const avgTemp = average(weatherData.map((d) => d.temperature));
    const avgHumidity = average(weatherData.map((d) => d.humidity));
    const totalPrecip = weatherData.reduce((sum, d) => sum + d.precipitation, 0);
    return {
      location: { lat, lon },
      period: { start: start2, end },
      current: weatherData[0] || createEmptyWeather(end),
      average: {
        temperature: avgTemp,
        humidity: avgHumidity,
        precipitation: round(totalPrecip, 1)
      },
      data: weatherData
    };
  } catch (error2) {
    console.error("POWER API error:", error2.message);
    throw new Error(`POWER API error: ${error2.message}`);
  }
}
async function getWeatherForDate(lat, lon, date) {
  const formattedDate = date.replace(/-/g, "");
  try {
    const response = await axios3.get(`${POWER_BASE_URL}/daily/point`, {
      params: {
        parameters: PARAMETERS.join(","),
        community: "RE",
        longitude: lon,
        latitude: lat,
        start: formattedDate,
        end: formattedDate,
        format: "JSON"
      },
      timeout: 3e4
    });
    const data = response.data;
    const properties = data.properties?.parameter || {};
    const temp = properties.T2M?.[formattedDate];
    if (temp === void 0 || temp === -999) {
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
      cloudCover: properties.CLOUD_AMT?.[formattedDate] !== -999 ? round(properties.CLOUD_AMT[formattedDate]) : void 0
    };
  } catch (error2) {
    console.error("POWER API error:", error2.message);
    return createEmptyWeather(date);
  }
}
async function getClimateSummary(lat, lon) {
  try {
    const response = await axios3.get(`${POWER_BASE_URL}/climatology/point`, {
      params: {
        parameters: "T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN",
        community: "RE",
        longitude: lon,
        latitude: lat,
        format: "JSON"
      },
      timeout: 3e4
    });
    const data = response.data;
    const params = data.properties?.parameter || {};
    return {
      annualAvgTemp: round(params.T2M?.ANN ?? 0),
      annualPrecip: round(params.PRECTOTCORR?.ANN ?? 0),
      annualSolarRad: round(params.ALLSKY_SFC_SW_DWN?.ANN ?? 0)
    };
  } catch (error2) {
    console.error("POWER climatology error:", error2.message);
    return {
      annualAvgTemp: 0,
      annualPrecip: 0,
      annualSolarRad: 0
    };
  }
}
function formatDate(date) {
  return date.toISOString().split("T")[0];
}
function formatDateFromPower(powerDate) {
  return `${powerDate.slice(0, 4)}-${powerDate.slice(4, 6)}-${powerDate.slice(6, 8)}`;
}
function round(value, decimals = 0) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
function average(values) {
  if (values.length === 0)
    return 0;
  return round(values.reduce((a, b) => a + b, 0) / values.length, 1);
}
function createEmptyWeather(date) {
  return {
    date,
    temperature: 0,
    temperatureMin: 0,
    temperatureMax: 0,
    humidity: 0,
    precipitation: 0,
    windSpeed: 0,
    solarRadiation: 0
  };
}

// dist/lib/nasa/n2yo.js
import axios4 from "axios";
var N2YO_BASE_URL = "https://api.n2yo.com/rest/v1/satellite";
var SATELLITE_NORAD_IDS = {
  "Landsat 8": 39084,
  "Landsat 9": 49260,
  "Sentinel-2A": 40697,
  "Sentinel-2B": 42063,
  "Terra (MODIS)": 25994,
  "Aqua (MODIS)": 27424,
  "Suomi NPP (VIIRS)": 37849,
  "NOAA-20 (VIIRS)": 43013,
  "NOAA-21 (VIIRS)": 54234,
  "ISS": 25544
  // For reference
};
async function getSatellitePasses(apiKey, lat, lon, alt = 0, satellites, days = 5) {
  if (!apiKey) {
    throw new Error("N2YO API key is required");
  }
  const validDays = Math.max(1, Math.min(10, days));
  const allPasses = [];
  const satsToCheck = satellites || Object.keys(SATELLITE_NORAD_IDS);
  for (const satName of satsToCheck) {
    const noradId = SATELLITE_NORAD_IDS[satName];
    if (!noradId)
      continue;
    try {
      const url = `${N2YO_BASE_URL}/radiopasses/${noradId}/${lat}/${lon}/${alt}/${validDays}/0`;
      const response = await axios4.get(url, {
        params: { apiKey },
        timeout: 1e4
      });
      const data = response.data;
      const passes = data.passes || [];
      for (const pass of passes) {
        allPasses.push({
          satellite: satName,
          noradId,
          startTime: new Date(pass.startUTC * 1e3),
          endTime: new Date(pass.endUTC * 1e3),
          maxElevation: pass.maxEl || 0,
          startAzimuth: pass.startAz || 0,
          endAzimuth: pass.endAz || 0,
          duration: pass.endUTC - pass.startUTC || 0,
          magnitude: pass.mag
        });
      }
      await sleep(100);
    } catch (error2) {
      console.warn(`Failed to get passes for ${satName}:`, error2.message);
    }
  }
  allPasses.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  return {
    location: { lat, lon, alt },
    passes: allPasses,
    queriedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function sleep(ms) {
  return new Promise((resolve2) => setTimeout(resolve2, ms));
}

// dist/lib/nasa/index.js
async function enrichImageWithNasaData(lat, lon, captureDate, firmsApiKey, n2yoApiKey) {
  const enrichment = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    fireRisk: { level: "none", nearbyFires: 0 }
  };
  const radiusDeg = 50 / 111;
  const bbox = {
    north: lat + radiusDeg,
    south: lat - radiusDeg,
    east: lon + radiusDeg,
    west: lon - radiusDeg
  };
  const promises = [];
  enrichment.ndvi = {
    available: true,
    layerUrl: getGIBSTileUrl("MODIS_Terra_NDVI_8Day", captureDate)
  };
  if (firmsApiKey) {
    promises.push(hasRecentFires(firmsApiKey, lat, lon, 50, 7).then((result) => {
      enrichment.fireRisk = {
        level: calculateFireRisk(result.count, result.nearestKm),
        nearbyFires: result.count,
        nearestKm: result.nearestKm
      };
    }).catch((err) => {
      console.warn("Fire data enrichment failed:", err.message);
    }));
  }
  promises.push(getWeatherForDate(lat, lon, captureDate).then((weather) => {
    enrichment.weather = weather;
  }).catch((err) => {
    console.warn("Weather enrichment failed:", err.message);
  }));
  promises.push(searchCMR({
    bbox,
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString(),
    endDate: (/* @__PURE__ */ new Date()).toISOString(),
    pageSize: 100
  }).then((result) => {
    const satellites = [...new Set(result.granules.map((g) => g.satellite))];
    enrichment.nasaCoverage = {
      total: result.total,
      satellites
    };
  }).catch((err) => {
    console.warn("NASA coverage enrichment failed:", err.message);
  }));
  if (n2yoApiKey) {
    promises.push(getSatellitePasses(n2yoApiKey, lat, lon, 0, void 0, 3).then((result) => {
      if (result.passes.length > 0) {
        const next = result.passes[0];
        enrichment.nextPass = {
          satellite: next.satellite,
          time: next.startTime.toISOString(),
          elevation: next.maxElevation
        };
      }
    }).catch((err) => {
      console.warn("Satellite pass enrichment failed:", err.message);
    }));
  }
  await Promise.all(promises);
  return enrichment;
}

// dist/lib/analysis/claude-analysis.js
import Anthropic from "@anthropic-ai/sdk";
import * as fs2 from "fs";
import * as path2 from "path";
import sharp from "sharp";
function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }
  return new Anthropic({ apiKey });
}
async function imageToBase64(imagePath) {
  const absolutePath = path2.isAbsolute(imagePath) ? imagePath : path2.resolve(imagePath);
  if (!fs2.existsSync(absolutePath)) {
    throw new Error(`Image file not found: ${absolutePath}`);
  }
  const ext = path2.extname(imagePath).toLowerCase();
  if (ext === ".tif" || ext === ".tiff") {
    console.log("Converting TIF to PNG for Claude API...");
    try {
      const pngBuffer = await sharp(absolutePath, { limitInputPixels: false }).resize(2e3, 2e3, { fit: "inside", withoutEnlargement: true }).png({ quality: 90 }).toBuffer();
      console.log(`Converted TIF to PNG: ${(pngBuffer.length / 1024 / 1024).toFixed(2)} MB`);
      return {
        data: pngBuffer.toString("base64"),
        mediaType: "image/png"
      };
    } catch (err) {
      console.error("TIF conversion error:", err.message);
      throw new Error(`Failed to convert TIF image: ${err.message}`);
    }
  }
  const fileBuffer = fs2.readFileSync(absolutePath);
  const base64Data = fileBuffer.toString("base64");
  const mediaTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp"
  };
  const mediaType = mediaTypes[ext] || "image/jpeg";
  return { data: base64Data, mediaType };
}
async function analyzeImage(imagePath, analysisType = "general", additionalContext) {
  const client = getClient();
  const { data: imageData, mediaType } = await imageToBase64(imagePath);
  const prompts = {
    general: `You are an expert satellite imagery analyst. Analyze this satellite image and provide:
1. A brief summary of what you observe
2. Key findings with confidence levels (0-100%)
3. Any notable features, structures, or patterns
4. Actionable recommendations based on your analysis

Format your response as JSON with this structure:
{
  "summary": "Brief overview of the image",
  "confidence": 85,
  "findings": [
    {"category": "Infrastructure", "description": "...", "confidence": 90},
    {"category": "Vegetation", "description": "...", "confidence": 85}
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`,
    disaster: `You are an expert disaster assessment analyst specializing in satellite imagery. Analyze this image for signs of:
- Active fires or burn scars
- Flooding or water damage
- Storm damage (debris, structural damage)
- Drought conditions
- Landslides or erosion

Provide your assessment in JSON format:
{
  "summary": "Brief disaster assessment",
  "confidence": 85,
  "disasterType": "fire|flood|storm|earthquake|drought|none",
  "severity": "none|low|moderate|high|extreme",
  "urgency": "none|low|medium|high|critical",
  "affectedArea": "Estimated area description",
  "findings": [
    {"category": "Fire Detection", "description": "...", "confidence": 90, "severity": "high", "location": "Northwest quadrant"}
  ],
  "recommendations": ["Immediate action 1", "Monitoring suggestion 2"]
}`,
    landuse: `You are an expert land use classification analyst. Analyze this satellite image and classify the land cover types visible.

Identify percentages of:
- Urban/Built-up areas
- Agricultural land (crops, fields)
- Forest/Dense vegetation
- Water bodies
- Barren/Bare land
- Wetlands
- Grassland/Shrubland
- Snow/Ice

Provide your classification in JSON format:
{
  "summary": "Overview of land use patterns",
  "confidence": 85,
  "dominantType": "agricultural",
  "classifications": [
    {"type": "urban", "percentage": 15, "confidence": 90},
    {"type": "agricultural", "percentage": 45, "confidence": 85},
    {"type": "forest", "percentage": 25, "confidence": 80},
    {"type": "water", "percentage": 10, "confidence": 95},
    {"type": "barren", "percentage": 5, "confidence": 75}
  ],
  "findings": [
    {"category": "Urban Development", "description": "...", "confidence": 88}
  ],
  "recommendations": ["Land use observation 1", "Monitoring suggestion 2"]
}`
  };
  const systemPrompt = additionalContext ? `${prompts[analysisType]}

Additional context: ${additionalContext}` : prompts[analysisType];
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageData
              }
            },
            {
              type: "text",
              text: systemPrompt
            }
          ]
        }
      ]
    });
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }
    const rawText = textContent.text;
    let jsonText = rawText;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }
    const parsed = JSON.parse(jsonText);
    return {
      analysisType,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      summary: parsed.summary || "Analysis complete",
      confidence: parsed.confidence || 75,
      findings: parsed.findings || [],
      recommendations: parsed.recommendations || [],
      rawAnalysis: rawText,
      ...parsed
      // Include any type-specific fields (disasterType, classifications, etc.)
    };
  } catch (error2) {
    console.error("Claude analysis error:", error2);
    throw new Error(`AI analysis failed: ${error2.message}`);
  }
}
async function detectChanges(imagePath1, imagePath2, context) {
  const client = getClient();
  const [image1, image2] = await Promise.all([
    imageToBase64(imagePath1),
    imageToBase64(imagePath2)
  ]);
  const dateContext = context?.date1 && context?.date2 ? `
Image 1 was captured on ${context.date1}. Image 2 was captured on ${context.date2}.` : "";
  const prompt = `You are an expert satellite imagery change detection analyst. Compare these two satellite images of the same location and identify:

1. Significant changes between the images
2. New construction or development
3. Vegetation changes (growth, clearing, damage)
4. Water level changes
5. Any signs of damage or disaster
6. Infrastructure changes${dateContext}

Provide your analysis in JSON format:
{
  "summary": "Overview of changes detected",
  "confidence": 85,
  "findings": [
    {"category": "Construction", "description": "New building detected in northeast", "confidence": 90, "severity": "low"},
    {"category": "Vegetation", "description": "Forest clearing of approximately 2 hectares", "confidence": 85, "severity": "medium"}
  ],
  "recommendations": ["Monitor continued development", "Investigate vegetation loss"]
}`;
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Image 1 (Before):"
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: image1.mediaType,
                data: image1.data
              }
            },
            {
              type: "text",
              text: "Image 2 (After):"
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: image2.mediaType,
                data: image2.data
              }
            },
            {
              type: "text",
              text: prompt
            }
          ]
        }
      ]
    });
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }
    const rawText = textContent.text;
    let jsonText = rawText;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }
    const parsed = JSON.parse(jsonText);
    return {
      analysisType: "change",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      summary: parsed.summary || "Change detection complete",
      confidence: parsed.confidence || 75,
      findings: parsed.findings || [],
      recommendations: parsed.recommendations || [],
      rawAnalysis: rawText
    };
  } catch (error2) {
    console.error("Claude change detection error:", error2);
    throw new Error(`Change detection failed: ${error2.message}`);
  }
}

// dist/lib/disasters/usgs.js
import axios5 from "axios";
var USGS_BASE_URL = "https://earthquake.usgs.gov/fdsnws/event/1";
function parseEarthquake(feature) {
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
    alert: properties.alert
  };
}
async function getRecentEarthquakes(minMagnitude = 2.5, days = 7, limit = 100) {
  const endtime = (/* @__PURE__ */ new Date()).toISOString();
  const starttime = new Date(Date.now() - days * 24 * 60 * 60 * 1e3).toISOString();
  const params = new URLSearchParams({
    format: "geojson",
    starttime,
    endtime,
    minmagnitude: minMagnitude.toString(),
    limit: limit.toString(),
    orderby: "time"
  });
  const response = await axios5.get(`${USGS_BASE_URL}/query?${params}`);
  return response.data.features.map(parseEarthquake);
}
async function getEarthquakesInBbox(bbox, days = 7, minMagnitude = 2.5, limit = 100) {
  const endtime = (/* @__PURE__ */ new Date()).toISOString();
  const starttime = new Date(Date.now() - days * 24 * 60 * 60 * 1e3).toISOString();
  const params = new URLSearchParams({
    format: "geojson",
    starttime,
    endtime,
    minmagnitude: minMagnitude.toString(),
    minlatitude: bbox.south.toString(),
    maxlatitude: bbox.north.toString(),
    minlongitude: bbox.west.toString(),
    maxlongitude: bbox.east.toString(),
    limit: limit.toString(),
    orderby: "time"
  });
  const response = await axios5.get(`${USGS_BASE_URL}/query?${params}`);
  return response.data.features.map(parseEarthquake);
}
async function getEarthquakeStats(days = 7) {
  const earthquakes = await getRecentEarthquakes(0, days, 500);
  const byMagnitude = [
    { range: "0-2.5", count: earthquakes.filter((e) => e.magnitude < 2.5).length },
    { range: "2.5-4.5", count: earthquakes.filter((e) => e.magnitude >= 2.5 && e.magnitude < 4.5).length },
    { range: "4.5-6", count: earthquakes.filter((e) => e.magnitude >= 4.5 && e.magnitude < 6).length },
    { range: "6+", count: earthquakes.filter((e) => e.magnitude >= 6).length }
  ];
  return {
    total: earthquakes.length,
    byMagnitude,
    significant: earthquakes.filter((e) => e.magnitude >= 4.5).length,
    withTsunami: earthquakes.filter((e) => e.tsunami).length
  };
}

// dist/lib/disasters/gdacs.js
import axios6 from "axios";
var GDACS_API_URL = "https://www.gdacs.org/gdacsapi/api/events";
var HAZARD_NAMES = {
  EQ: "Earthquake",
  TC: "Tropical Cyclone",
  FL: "Flood",
  VO: "Volcano",
  DR: "Drought",
  WF: "Wildfire"
};
function parseGDACSEvent(event) {
  return {
    id: `gdacs-${event.eventtype}-${event.eventid}`,
    title: event.name || event.description,
    description: event.description,
    hazardType: event.eventtype,
    hazardName: HAZARD_NAMES[event.eventtype] || event.eventtype,
    alertLevel: event.alertlevel,
    severity: event.alertscore || 0,
    country: event.country,
    latitude: event.latitude,
    longitude: event.longitude,
    startDate: event.fromdate,
    endDate: event.todate,
    url: event.url?.report || event.url?.details || "",
    population: event.population?.exposed,
    episodeId: event.episodeid?.toString()
  };
}
async function getActiveAlerts(limit = 100) {
  try {
    const response = await axios6.get(`${GDACS_API_URL}/geteventlist/ALL`, {
      timeout: 1e4
    });
    if (!response.data.features) {
      return [];
    }
    return response.data.features.slice(0, limit).map((f) => parseGDACSEvent(f.properties));
  } catch (error2) {
    console.error("GDACS API error:", error2.message);
    return [];
  }
}
async function getAlertsByType(hazardType, limit = 50) {
  try {
    const response = await axios6.get(`${GDACS_API_URL}/geteventlist/${hazardType}`, {
      timeout: 1e4
    });
    if (!response.data.features) {
      return [];
    }
    return response.data.features.slice(0, limit).map((f) => parseGDACSEvent(f.properties));
  } catch (error2) {
    console.error(`GDACS ${hazardType} API error:`, error2.message);
    return [];
  }
}
async function getFloodAlerts(limit = 50) {
  const alerts = await getAlertsByType("FL", limit);
  return alerts;
}
async function getCycloneAlerts(limit = 50) {
  return getAlertsByType("TC", limit);
}
async function getDisasterStats() {
  const alerts = await getActiveAlerts(500);
  const byTypeMap = {};
  const byLevelMap = {};
  alerts.forEach((alert) => {
    byTypeMap[alert.hazardType] = (byTypeMap[alert.hazardType] || 0) + 1;
    byLevelMap[alert.alertLevel] = (byLevelMap[alert.alertLevel] || 0) + 1;
  });
  const byType = Object.entries(byTypeMap).map(([type, count]) => ({
    type,
    name: HAZARD_NAMES[type] || type,
    count
  }));
  const byAlertLevel = Object.entries(byLevelMap).map(([level, count]) => ({
    level,
    count
  }));
  return {
    total: alerts.length,
    byType,
    byAlertLevel,
    red: byLevelMap["Red"] || 0,
    orange: byLevelMap["Orange"] || 0
  };
}

// dist/lib/disasters/index.js
function earthquakeToHazardPoint(eq) {
  let severity = "low";
  if (eq.magnitude >= 6)
    severity = "extreme";
  else if (eq.magnitude >= 5)
    severity = "high";
  else if (eq.magnitude >= 4)
    severity = "moderate";
  return {
    id: eq.id,
    type: "earthquake",
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
      tsunami: eq.tsunami
    }
  };
}
function gdacsAlertToHazardPoint(alert) {
  const typeMap = {
    EQ: "earthquake",
    TC: "cyclone",
    FL: "flood",
    VO: "volcano",
    DR: "other",
    WF: "wildfire"
  };
  let severity = "low";
  if (alert.alertLevel === "Red")
    severity = "extreme";
  else if (alert.alertLevel === "Orange")
    severity = "high";
  else if (alert.severity > 1)
    severity = "moderate";
  return {
    id: alert.id,
    type: typeMap[alert.hazardType] || "other",
    title: alert.title,
    latitude: alert.latitude,
    longitude: alert.longitude,
    severity,
    timestamp: alert.startDate,
    details: {
      alertLevel: alert.alertLevel,
      country: alert.country,
      url: alert.url,
      population: alert.population
    }
  };
}
async function getDisasterSummary(fireCounts = 0) {
  const [earthquakes, gdacsAlerts, gdacsStats] = await Promise.all([
    getRecentEarthquakes(2.5, 7, 100).catch(() => []),
    getActiveAlerts(100).catch(() => []),
    getDisasterStats().catch(() => ({ total: 0, byType: [], byAlertLevel: [], red: 0, orange: 0 }))
  ]);
  const floodCount = gdacsAlerts.filter((a) => a.hazardType === "FL").length;
  const cycloneCount = gdacsAlerts.filter((a) => a.hazardType === "TC").length;
  const volcanoCount = gdacsAlerts.filter((a) => a.hazardType === "VO").length;
  const significantEarthquakes = earthquakes.filter((eq) => eq.magnitude >= 4.5).slice(0, 5).map(earthquakeToHazardPoint);
  const significantAlerts = gdacsAlerts.filter((a) => a.alertLevel === "Red" || a.alertLevel === "Orange").slice(0, 5).map(gdacsAlertToHazardPoint);
  const recentSignificant = [...significantEarthquakes, ...significantAlerts].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);
  return {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    counts: {
      earthquakes: earthquakes.length,
      fires: fireCounts,
      floods: floodCount,
      cyclones: cycloneCount,
      volcanoes: volcanoCount,
      total: earthquakes.length + fireCounts + floodCount + cycloneCount + volcanoCount
    },
    recentSignificant,
    alerts: {
      red: gdacsStats.red,
      orange: gdacsStats.orange
    }
  };
}
async function getAllHazards(options = {}) {
  const { includeEarthquakes = true, includeGDACS = true, minMagnitude = 2.5, days = 7 } = options;
  const hazards = [];
  if (includeEarthquakes) {
    try {
      const earthquakes = await getRecentEarthquakes(minMagnitude, days, 200);
      hazards.push(...earthquakes.map(earthquakeToHazardPoint));
    } catch (error2) {
      console.error("Failed to fetch earthquakes:", error2);
    }
  }
  if (includeGDACS) {
    try {
      const alerts = await getActiveAlerts(200);
      const nonEqAlerts = alerts.filter((a) => a.hazardType !== "EQ");
      hazards.push(...nonEqAlerts.map(gdacsAlertToHazardPoint));
    } catch (error2) {
      console.error("Failed to fetch GDACS alerts:", error2);
    }
  }
  return hazards.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// dist/lib/fusion/timeline-fusion.js
function createBboxFromPoint(lat, lon, radiusKm = 50) {
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
  return {
    north: lat + latDelta,
    south: lat - latDelta,
    east: lon + lonDelta,
    west: lon - lonDelta
  };
}
async function generateTimeline(lat, lon, startDate, endDate, sources = ["satellite", "weather", "fire", "pass", "earthquake"], options) {
  const bbox = createBboxFromPoint(lat, lon);
  const entries = [];
  const promises = [];
  if (sources.includes("satellite")) {
    promises.push(searchCMR({ bbox, startDate, endDate, pageSize: 20 }).then((result) => {
      result.granules.forEach((granule) => {
        entries.push({
          id: `sat-${granule.id}`,
          timestamp: granule.startDate,
          source: "satellite",
          title: `${granule.satellite} Capture`,
          description: `${granule.sensor} imagery captured`,
          icon: "satellite",
          data: {
            satellite: granule.satellite,
            sensor: granule.sensor,
            browseUrl: granule.browseUrl,
            downloadUrl: granule.downloadUrl,
            cloudCover: granule.cloudCover
          }
        });
      });
    }).catch((err) => console.error("CMR fetch error:", err)));
  }
  if (sources.includes("weather")) {
    promises.push(getWeatherData(lat, lon, startDate, endDate).then((weather) => {
      weather.data?.forEach((day) => {
        let severity;
        let description = "";
        if (day.temperature > 35) {
          severity = "high";
          description = `High temperature: ${day.temperature}\xB0C`;
        } else if (day.temperature < 0) {
          severity = "medium";
          description = `Freezing temperature: ${day.temperature}\xB0C`;
        } else if (day.precipitation > 20) {
          severity = "medium";
          description = `Heavy precipitation: ${day.precipitation}mm`;
        }
        if (severity) {
          entries.push({
            id: `weather-${day.date}`,
            timestamp: day.date,
            source: "weather",
            title: "Weather Alert",
            description,
            icon: "cloud",
            severity,
            data: day
          });
        }
      });
    }).catch((err) => console.error("Weather fetch error:", err)));
  }
  if (sources.includes("fire") && options?.firmsApiKey) {
    const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1e3 * 60 * 60 * 24));
    promises.push(getFireData(options.firmsApiKey, bbox, Math.min(daysDiff, 10)).then((fireData) => {
      fireData.fires.forEach((fire, idx) => {
        let severity = "low";
        if (fire.confidence > 80)
          severity = "high";
        else if (fire.confidence > 50)
          severity = "medium";
        entries.push({
          id: `fire-${idx}-${fire.acqDate}`,
          timestamp: `${fire.acqDate}T${fire.acqTime || "12:00:00"}`,
          source: "fire",
          title: "Fire Detection",
          description: `${fire.satellite} detected fire (confidence: ${fire.confidence}%)`,
          icon: "flame",
          severity,
          data: {
            latitude: fire.latitude,
            longitude: fire.longitude,
            brightness: fire.brightness,
            satellite: fire.satellite,
            confidence: fire.confidence,
            frp: fire.frp
          }
        });
      });
    }).catch((err) => console.error("FIRMS fetch error:", err)));
  }
  if (sources.includes("pass") && options?.n2yoApiKey) {
    promises.push(getSatellitePasses(options.n2yoApiKey, lat, lon, 0, void 0, 10).then((passData) => {
      passData.passes.forEach((pass, idx) => {
        entries.push({
          id: `pass-${idx}-${pass.satellite}`,
          timestamp: pass.startTime instanceof Date ? pass.startTime.toISOString() : String(pass.startTime),
          source: "pass",
          title: `${pass.satellite} Pass`,
          description: `Max elevation: ${pass.maxElevation}\xB0, Duration: ${Math.round(pass.duration / 60)}min`,
          icon: "rocket",
          data: {
            satellite: pass.satellite,
            maxElevation: pass.maxElevation,
            duration: pass.duration,
            startAzimuth: pass.startAzimuth,
            endAzimuth: pass.endAzimuth
          }
        });
      });
    }).catch((err) => console.error("N2YO fetch error:", err)));
  }
  if (sources.includes("earthquake")) {
    const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1e3 * 60 * 60 * 24));
    promises.push(getEarthquakesInBbox(bbox, daysDiff, 2.5, 50).then((earthquakes) => {
      earthquakes.forEach((eq) => {
        let severity = "low";
        if (eq.magnitude >= 6)
          severity = "critical";
        else if (eq.magnitude >= 5)
          severity = "high";
        else if (eq.magnitude >= 4)
          severity = "medium";
        entries.push({
          id: `eq-${eq.id}`,
          timestamp: eq.time,
          source: "earthquake",
          title: `M${eq.magnitude.toFixed(1)} Earthquake`,
          description: eq.place,
          icon: "mountain",
          severity,
          data: {
            magnitude: eq.magnitude,
            depth: eq.depth,
            place: eq.place,
            url: eq.url,
            tsunami: eq.tsunami
          }
        });
      });
    }).catch((err) => console.error("Earthquake fetch error:", err)));
  }
  await Promise.all(promises);
  entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return {
    entries,
    dateRange: { start: startDate, end: endDate },
    sources,
    location: { lat, lon }
  };
}
async function generateIntelReport(lat, lon, captureDate, options) {
  const endDate = captureDate ? captureDate.split("T")[0] : (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const startDateObj = new Date(endDate);
  startDateObj.setDate(startDateObj.getDate() - 30);
  const startDate = startDateObj.toISOString().split("T")[0];
  const timeline = await generateTimeline(lat, lon, startDate, endDate, void 0, options);
  let riskLevel = "low";
  const criticalEvents = timeline.entries.filter((e) => e.severity === "critical" || e.severity === "high");
  if (criticalEvents.length > 5)
    riskLevel = "critical";
  else if (criticalEvents.length > 2)
    riskLevel = "high";
  else if (criticalEvents.length > 0)
    riskLevel = "moderate";
  const sourceCount = {};
  timeline.entries.forEach((e) => {
    sourceCount[e.source] = (sourceCount[e.source] || 0) + 1;
  });
  const sections = [];
  const satEntries = timeline.entries.filter((e) => e.source === "satellite");
  if (satEntries.length > 0) {
    const satellites = [...new Set(satEntries.map((e) => e.data.satellite))];
    sections.push({
      title: "Satellite Coverage",
      content: `${satEntries.length} satellite captures from ${satellites.join(", ")} in the analysis period.`,
      data: { count: satEntries.length, satellites }
    });
  }
  const fireEntries = timeline.entries.filter((e) => e.source === "fire");
  if (fireEntries.length > 0) {
    const highConfidence = fireEntries.filter((e) => e.data.confidence > 80).length;
    sections.push({
      title: "Fire Activity",
      content: `${fireEntries.length} fire detections in the area. ${highConfidence} were high confidence detections.`,
      data: { total: fireEntries.length, highConfidence }
    });
  } else {
    sections.push({
      title: "Fire Activity",
      content: "No fire detections in the analysis period.",
      data: { total: 0 }
    });
  }
  const eqEntries = timeline.entries.filter((e) => e.source === "earthquake");
  if (eqEntries.length > 0) {
    const maxMag = Math.max(...eqEntries.map((e) => e.data.magnitude));
    sections.push({
      title: "Seismic Activity",
      content: `${eqEntries.length} earthquakes detected. Maximum magnitude: ${maxMag.toFixed(1)}.`,
      data: { count: eqEntries.length, maxMagnitude: maxMag }
    });
  }
  const weatherEntries = timeline.entries.filter((e) => e.source === "weather");
  if (weatherEntries.length > 0) {
    sections.push({
      title: "Weather Alerts",
      content: `${weatherEntries.length} significant weather events recorded.`,
      data: { count: weatherEntries.length }
    });
  }
  const passEntries = timeline.entries.filter((e) => e.source === "pass");
  const futurePasses = passEntries.filter((e) => new Date(e.timestamp) > /* @__PURE__ */ new Date());
  if (futurePasses.length > 0) {
    const nextPass = futurePasses[0];
    sections.push({
      title: "Next Satellite Pass",
      content: `${nextPass.data.satellite} will pass at ${nextPass.data.maxElevation}\xB0 elevation.`,
      data: nextPass.data
    });
  }
  const recommendations = [];
  if (fireEntries.length > 0) {
    recommendations.push("Monitor fire activity using VIIRS thermal anomaly layers");
    recommendations.push("Consider high-resolution imagery to assess affected areas");
  }
  if (eqEntries.some((e) => e.data.magnitude >= 4)) {
    recommendations.push("Review before/after imagery for structural damage assessment");
  }
  if (satEntries.length < 5) {
    recommendations.push("Request additional satellite tasking for better temporal coverage");
  }
  if (weatherEntries.some((e) => e.description.includes("precipitation"))) {
    recommendations.push("Consider flood risk assessment using SAR imagery");
  }
  if (recommendations.length === 0) {
    recommendations.push("Continue routine monitoring");
    recommendations.push("Schedule periodic imagery updates");
  }
  const summary = `Intelligence report for location (${lat.toFixed(4)}, ${lon.toFixed(4)}) covering ${startDate} to ${endDate}. ${timeline.entries.length} total events detected across ${Object.keys(sourceCount).length} data sources. Overall risk level: ${riskLevel.toUpperCase()}.`;
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    location: { lat, lon },
    dateRange: { start: startDate, end: endDate },
    summary,
    sections,
    recommendations,
    riskLevel,
    timeline: timeline.entries
  };
}

// dist/lib/geotiff-utils.js
import { fromFile } from "geotiff";
import * as fs3 from "fs";
function utmToLatLon(easting, northing, zone, isNorthernHemisphere) {
  const k0 = 0.9996;
  const a = 6378137;
  const e = 0.081819191;
  const e1sq = 6739497e-9;
  const e2 = e * e;
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const x = easting - 5e5;
  const y = isNorthernHemisphere ? northing : northing - 1e7;
  const lonOrigin = (zone - 1) * 6 - 180 + 3;
  const M = y / k0;
  const mu = M / (a * (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 = mu + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu) + 151 * Math.pow(e1, 3) / 96 * Math.sin(6 * mu);
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1));
  const T1 = Math.tan(phi1) * Math.tan(phi1);
  const C1 = e1sq * Math.cos(phi1) * Math.cos(phi1);
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5);
  const D = x / (N1 * k0);
  const lat = phi1 - N1 * Math.tan(phi1) / R1 * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e1sq) * Math.pow(D, 4) / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * e1sq - 3 * C1 * C1) * Math.pow(D, 6) / 720);
  const lon = (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * e1sq + 24 * T1 * T1) * Math.pow(D, 5) / 120) / Math.cos(phi1);
  const latDeg = lat * 180 / Math.PI;
  const lonDeg = lonOrigin + lon * 180 / Math.PI;
  return { lat: latDeg, lon: lonDeg };
}
function guessUTMZone(easting, northing) {
  const isNorth = northing > 0;
  if (northing >= 37e5 && northing <= 39e5) {
    return { zone: 11, isNorth: true };
  } else if (northing >= 22e5 && northing <= 24e5) {
    return { zone: 4, isNorth: true };
  } else if (northing >= 43e5 && northing <= 45e5) {
    return { zone: 30, isNorth: true };
  }
  return { zone: 11, isNorth: true };
}
async function extractLocalGeoTIFFMetadata(filePath) {
  try {
    if (!fs3.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    console.log("Reading GeoTIFF:", filePath);
    const tiff = await fromFile(filePath);
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const samplesPerPixel = image.getSamplesPerPixel();
    const bitsPerSample = image.getBitsPerSample()[0] || 8;
    console.log(`Image dimensions: ${width}x${height}, bands: ${samplesPerPixel}, bits: ${bitsPerSample}`);
    const bbox = image.getBoundingBox();
    let centerPoint;
    let bounds;
    if (bbox && bbox.length === 4) {
      const [minX, minY, maxX, maxY] = bbox;
      console.log("Raw bounding box:", { minX, minY, maxX, maxY });
      const isValidLatLon = minY >= -90 && minY <= 90 && maxY >= -90 && maxY <= 90 && minX >= -180 && minX <= 180 && maxX >= -180 && maxX <= 180;
      if (isValidLatLon) {
        console.log("Coordinates already in lat/lon format");
        bounds = { north: maxY, south: minY, east: maxX, west: minX };
        centerPoint = {
          lat: (maxY + minY) / 2,
          lon: (maxX + minX) / 2
        };
      } else {
        console.log("Coordinates appear to be in projected CRS, attempting transformation...");
        let utmZone = null;
        let isNorthernHemisphere = true;
        try {
          const geoKeys = image.getGeoKeys();
          console.log("GeoKeys:", JSON.stringify(geoKeys, null, 2));
          if (geoKeys?.ProjectedCSTypeGeoKey) {
            const epsgCode = geoKeys.ProjectedCSTypeGeoKey;
            console.log("Found EPSG code:", epsgCode);
            if (epsgCode >= 32601 && epsgCode <= 32660) {
              utmZone = epsgCode - 32600;
              isNorthernHemisphere = true;
              console.log(`Detected UTM Zone ${utmZone}N from EPSG`);
            } else if (epsgCode >= 32701 && epsgCode <= 32760) {
              utmZone = epsgCode - 32700;
              isNorthernHemisphere = false;
              console.log(`Detected UTM Zone ${utmZone}S from EPSG`);
            }
          }
        } catch (geoKeyErr) {
          console.log("Could not read GeoKeys:", geoKeyErr);
        }
        if (!utmZone) {
          const guessed = guessUTMZone(minX, minY);
          if (guessed) {
            utmZone = guessed.zone;
            isNorthernHemisphere = guessed.isNorth;
            console.log(`Guessed UTM Zone ${utmZone}${isNorthernHemisphere ? "N" : "S"} from coordinates`);
          }
        }
        if (utmZone) {
          try {
            const sw = utmToLatLon(minX, minY, utmZone, isNorthernHemisphere);
            const ne = utmToLatLon(maxX, maxY, utmZone, isNorthernHemisphere);
            console.log("Transformed SW corner:", sw);
            console.log("Transformed NE corner:", ne);
            if (sw.lat >= -90 && sw.lat <= 90 && sw.lon >= -180 && sw.lon <= 180 && ne.lat >= -90 && ne.lat <= 90 && ne.lon >= -180 && ne.lon <= 180) {
              bounds = {
                south: sw.lat,
                west: sw.lon,
                north: ne.lat,
                east: ne.lon
              };
              centerPoint = {
                lat: (sw.lat + ne.lat) / 2,
                lon: (sw.lon + ne.lon) / 2
              };
              console.log("Final bounds:", bounds);
              console.log("Final center point:", centerPoint);
            } else {
              console.error("Transformation produced invalid coordinates");
            }
          } catch (transformErr) {
            console.error("Coordinate transformation failed:", transformErr);
          }
        }
      }
    } else {
      console.log("No bounding box found in GeoTIFF");
    }
    return {
      width,
      height,
      bands: samplesPerPixel,
      bitDepth: bitsPerSample,
      centerPoint,
      bounds
    };
  } catch (error2) {
    console.error("Error extracting local GeoTIFF metadata:", error2);
    throw new Error(`Failed to extract GeoTIFF metadata: ${error2 instanceof Error ? error2.message : "Unknown error"}`);
  }
}

// dist/lib/agriculture/index.js
var NDVI_THRESHOLDS = {
  barren: { min: -1, max: 0.1 },
  sparse: { min: 0.1, max: 0.2 },
  moderatelyHealthy: { min: 0.2, max: 0.4 },
  healthy: { min: 0.4, max: 0.6 },
  veryHealthy: { min: 0.6, max: 1 }
};
var CROP_PROFILES = {
  wheat: {
    name: "Wheat",
    optimalNDVI: { min: 0.4, max: 0.8 },
    optimalTemp: { min: 10, max: 25 },
    waterNeed: "moderate",
    // mm per growing season: 450-650
    growingSeasonMonths: [3, 4, 5, 6, 7]
    // March-July (Northern Hemisphere)
  },
  corn: {
    name: "Corn/Maize",
    optimalNDVI: { min: 0.5, max: 0.9 },
    optimalTemp: { min: 18, max: 32 },
    waterNeed: "high",
    // mm per growing season: 500-800
    growingSeasonMonths: [5, 6, 7, 8, 9]
    // May-September
  },
  rice: {
    name: "Rice",
    optimalNDVI: { min: 0.4, max: 0.8 },
    optimalTemp: { min: 20, max: 35 },
    waterNeed: "very high",
    // mm per growing season: 900-2000
    growingSeasonMonths: [4, 5, 6, 7, 8, 9]
    // April-September
  },
  soybean: {
    name: "Soybean",
    optimalNDVI: { min: 0.4, max: 0.85 },
    optimalTemp: { min: 15, max: 30 },
    waterNeed: "moderate",
    // mm per growing season: 450-700
    growingSeasonMonths: [5, 6, 7, 8, 9]
    // May-September
  },
  cotton: {
    name: "Cotton",
    optimalNDVI: { min: 0.3, max: 0.7 },
    optimalTemp: { min: 20, max: 35 },
    waterNeed: "moderate",
    // mm per growing season: 700-1300
    growingSeasonMonths: [4, 5, 6, 7, 8, 9, 10]
    // April-October
  },
  generic: {
    name: "Generic Crops",
    optimalNDVI: { min: 0.3, max: 0.8 },
    optimalTemp: { min: 15, max: 30 },
    waterNeed: "moderate",
    growingSeasonMonths: [3, 4, 5, 6, 7, 8, 9]
  }
};
async function analyzeAgriculture(lat, lon, ndviValue, cropType = "generic", historicalNDVI) {
  const endDate = /* @__PURE__ */ new Date();
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
  const weather = await getWeatherData(lat, lon, startDate.toISOString().split("T")[0], endDate.toISOString().split("T")[0]);
  const climate = await getClimateSummary(lat, lon);
  const profile = CROP_PROFILES[cropType] || CROP_PROFILES.generic;
  const droughtIndex = calculateDroughtIndex(weather.data, climate.annualPrecip / 12);
  const cropHealth = calculateCropHealth(ndviValue, weather, profile, historicalNDVI);
  const yieldPrediction = predictYield(cropHealth, droughtIndex, weather, profile);
  const gdd = calculateGrowingDegreeDays(weather.data, profile);
  const recommendations = generateRecommendations(cropHealth, droughtIndex, weather, profile);
  const alerts = generateAlerts(weather, droughtIndex, cropHealth);
  let seasonalComparison;
  if (ndviValue !== void 0 && historicalNDVI && historicalNDVI.length > 0) {
    const avgHistorical = historicalNDVI.reduce((a, b) => a + b, 0) / historicalNDVI.length;
    seasonalComparison = {
      currentNDVI: ndviValue,
      historicalAvgNDVI: Math.round(avgHistorical * 1e3) / 1e3,
      deviation: Math.round((ndviValue - avgHistorical) * 1e3) / 1e3
    };
  }
  return {
    location: { lat, lon },
    analysisDate: (/* @__PURE__ */ new Date()).toISOString(),
    cropType: profile.name,
    cropHealth,
    droughtIndex,
    yieldPrediction,
    weatherSummary: {
      avgTemp: weather.average.temperature,
      totalPrecip: weather.average.precipitation,
      avgHumidity: weather.average.humidity,
      growingDegreeDays: gdd
    },
    recommendations,
    alerts,
    seasonalComparison
  };
}
function calculateDroughtIndex(weatherData, normalMonthlyPrecip) {
  const totalPrecip = weatherData.reduce((sum, d) => sum + d.precipitation, 0);
  const expectedPrecip = normalMonthlyPrecip;
  const deficit = expectedPrecip - totalPrecip;
  let daysWithoutRain = 0;
  for (const day of weatherData) {
    if (day.precipitation < 1) {
      daysWithoutRain++;
    } else {
      break;
    }
  }
  const precipRatio = totalPrecip / Math.max(expectedPrecip, 1);
  const avgTemp = weatherData.reduce((sum, d) => sum + d.temperature, 0) / weatherData.length;
  const tempFactor = avgTemp > 30 ? -0.5 : avgTemp > 25 ? -0.2 : 0;
  let value = (precipRatio - 1) * 4 + tempFactor;
  value = Math.max(-4, Math.min(4, value));
  let level;
  let soilMoisture;
  if (value >= 0) {
    level = "none";
    soilMoisture = value > 1 ? "high" : "adequate";
  } else if (value > -1) {
    level = "abnormally_dry";
    soilMoisture = "moderate";
  } else if (value > -2) {
    level = "moderate";
    soilMoisture = "low";
  } else if (value > -3) {
    level = "severe";
    soilMoisture = "low";
  } else if (value > -3.5) {
    level = "extreme";
    soilMoisture = "very_low";
  } else {
    level = "exceptional";
    soilMoisture = "very_low";
  }
  return {
    level,
    value: Math.round(value * 100) / 100,
    precipitationDeficit: Math.round(Math.max(0, deficit) * 10) / 10,
    daysWithoutRain,
    soilMoistureEstimate: soilMoisture
  };
}
function calculateCropHealth(ndviValue, weather, profile, historicalNDVI) {
  let ndviScore = 50;
  if (ndviValue !== void 0) {
    const { min, max } = profile.optimalNDVI;
    if (ndviValue >= min && ndviValue <= max) {
      const midpoint = (min + max) / 2;
      const range = max - min;
      ndviScore = 70 + 30 * (1 - Math.abs(ndviValue - midpoint) / (range / 2));
    } else if (ndviValue < min) {
      ndviScore = Math.max(0, ndviValue / min * 70);
    } else {
      ndviScore = 70;
    }
  }
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
  const avgHumidity = weather.average.humidity;
  const totalPrecip = weather.data.reduce((sum, d) => sum + d.precipitation, 0);
  const moistureScore = Math.min(100, avgHumidity / 60 * 50 + totalPrecip / 50 * 50);
  const overall = Math.round(ndviScore * 0.5 + tempScore * 0.25 + moistureScore * 0.25);
  let category;
  if (overall >= 80)
    category = "excellent";
  else if (overall >= 65)
    category = "good";
  else if (overall >= 50)
    category = "fair";
  else if (overall >= 30)
    category = "poor";
  else
    category = "critical";
  let trend = "stable";
  if (historicalNDVI && historicalNDVI.length >= 2 && ndviValue !== void 0) {
    const recentAvg = historicalNDVI.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, historicalNDVI.length);
    if (ndviValue > recentAvg + 0.05)
      trend = "improving";
    else if (ndviValue < recentAvg - 0.05)
      trend = "declining";
  }
  return {
    overall,
    ndviScore: Math.round(ndviScore),
    moistureScore: Math.round(moistureScore),
    temperatureScore: Math.round(tempScore),
    category,
    trend
  };
}
function calculateGrowingDegreeDays(weatherData, profile) {
  const baseTemp = profile.optimalTemp.min - 5;
  return Math.round(weatherData.reduce((gdd, day) => {
    const avgDayTemp = (day.temperatureMax + day.temperatureMin) / 2;
    const contribution = Math.max(0, avgDayTemp - baseTemp);
    return gdd + contribution;
  }, 0));
}
function predictYield(cropHealth, drought, weather, profile) {
  const factors = [];
  let yieldPercent = 100;
  if (cropHealth.ndviScore >= 70) {
    factors.push({
      name: "Vegetation Health",
      impact: "positive",
      description: "Strong vegetation index indicates healthy crop development"
    });
    yieldPercent += (cropHealth.ndviScore - 70) * 0.3;
  } else if (cropHealth.ndviScore < 50) {
    factors.push({
      name: "Vegetation Health",
      impact: "negative",
      description: "Low vegetation index suggests stressed or underdeveloped crops"
    });
    yieldPercent -= (50 - cropHealth.ndviScore) * 0.5;
  } else {
    factors.push({
      name: "Vegetation Health",
      impact: "neutral",
      description: "Moderate vegetation development"
    });
  }
  if (drought.level === "none") {
    factors.push({
      name: "Water Availability",
      impact: "positive",
      description: "Adequate soil moisture for crop growth"
    });
  } else if (drought.level === "abnormally_dry" || drought.level === "moderate") {
    factors.push({
      name: "Water Stress",
      impact: "negative",
      description: `${drought.level.replace("_", " ")} conditions may reduce yield`
    });
    yieldPercent -= drought.level === "moderate" ? 15 : 8;
  } else {
    factors.push({
      name: "Severe Drought",
      impact: "negative",
      description: `${drought.level.replace("_", " ")} drought significantly threatens yield`
    });
    yieldPercent -= drought.level === "severe" ? 30 : drought.level === "extreme" ? 50 : 70;
  }
  const avgTemp = weather.average.temperature;
  if (avgTemp > profile.optimalTemp.max + 5) {
    factors.push({
      name: "Heat Stress",
      impact: "negative",
      description: "Excessive heat may damage crops and reduce yield"
    });
    yieldPercent -= (avgTemp - profile.optimalTemp.max) * 3;
  } else if (avgTemp < profile.optimalTemp.min - 5) {
    factors.push({
      name: "Cold Stress",
      impact: "negative",
      description: "Low temperatures may slow growth or cause frost damage"
    });
    yieldPercent -= (profile.optimalTemp.min - avgTemp) * 3;
  }
  yieldPercent = Math.max(0, Math.min(120, yieldPercent));
  const confidence = Math.min(85, 50 + weather.data.length * 1.5);
  let riskLevel;
  if (yieldPercent >= 80)
    riskLevel = "low";
  else if (yieldPercent >= 60)
    riskLevel = "moderate";
  else if (yieldPercent >= 40)
    riskLevel = "high";
  else
    riskLevel = "critical";
  return {
    estimatedYieldPercent: Math.round(yieldPercent),
    confidence: Math.round(confidence),
    factors,
    riskLevel
  };
}
function generateRecommendations(health, drought, weather, profile) {
  const recommendations = [];
  if (drought.level !== "none") {
    if (drought.level === "exceptional" || drought.level === "extreme") {
      recommendations.push("URGENT: Implement emergency irrigation immediately to prevent crop loss");
    } else if (drought.level === "severe") {
      recommendations.push("Increase irrigation frequency and consider deficit irrigation strategies");
    } else {
      recommendations.push("Monitor soil moisture levels closely and adjust irrigation schedule");
    }
  }
  if (health.category === "critical" || health.category === "poor") {
    recommendations.push("Conduct field inspection to identify cause of crop stress");
    recommendations.push("Consider soil testing for nutrient deficiencies");
  }
  if (health.trend === "declining") {
    recommendations.push("Investigate recent changes in field conditions - vegetation health is declining");
  }
  const avgTemp = weather.average.temperature;
  if (avgTemp > profile.optimalTemp.max) {
    recommendations.push("Consider shade structures or increased irrigation to combat heat stress");
  } else if (avgTemp < profile.optimalTemp.min) {
    recommendations.push("Monitor for frost conditions and prepare protective measures");
  }
  if (recommendations.length === 0) {
    recommendations.push("Conditions are favorable - maintain current management practices");
    recommendations.push("Continue regular field monitoring to track crop development");
  }
  if (health.ndviScore < 40) {
    recommendations.push("Low vegetation index detected - verify crop emergence and stand density");
  }
  return recommendations;
}
function generateAlerts(weather, drought, health) {
  const alerts = [];
  if (drought.level === "exceptional" || drought.level === "extreme") {
    alerts.push({
      type: "drought",
      severity: "high",
      message: `${drought.level.replace("_", " ").toUpperCase()} drought conditions detected. Immediate action required.`
    });
  } else if (drought.level === "severe") {
    alerts.push({
      type: "drought",
      severity: "medium",
      message: "Severe drought conditions may significantly impact crop yield."
    });
  }
  const minTemp = Math.min(...weather.data.map((d) => d.temperatureMin));
  if (minTemp <= 2) {
    alerts.push({
      type: "frost",
      severity: minTemp <= 0 ? "high" : "medium",
      message: `Frost risk detected. Minimum temperature: ${minTemp}\xB0C`
    });
  }
  const maxTemp = Math.max(...weather.data.map((d) => d.temperatureMax));
  if (maxTemp >= 38) {
    alerts.push({
      type: "heat",
      severity: maxTemp >= 42 ? "high" : "medium",
      message: `Extreme heat detected. Maximum temperature: ${maxTemp}\xB0C`
    });
  }
  const totalPrecip = weather.data.reduce((sum, d) => sum + d.precipitation, 0);
  if (totalPrecip > 150) {
    alerts.push({
      type: "excess_rain",
      severity: totalPrecip > 250 ? "high" : "medium",
      message: `High precipitation (${Math.round(totalPrecip)}mm in 30 days) may cause waterlogging or disease.`
    });
  }
  if (weather.average.temperature > 20 && weather.data.some((d) => d.humidity > 80)) {
    alerts.push({
      type: "pest_risk",
      severity: "low",
      message: "Warm, humid conditions increase pest and disease risk. Monitor fields closely."
    });
  }
  return alerts;
}
function classifyNDVI(ndviValue) {
  if (ndviValue < NDVI_THRESHOLDS.barren.max) {
    return { category: "Barren/Water", description: "No vegetation detected", color: "#8B4513" };
  } else if (ndviValue < NDVI_THRESHOLDS.sparse.max) {
    return { category: "Sparse", description: "Very limited vegetation", color: "#DAA520" };
  } else if (ndviValue < NDVI_THRESHOLDS.moderatelyHealthy.max) {
    return { category: "Moderate", description: "Developing vegetation", color: "#9ACD32" };
  } else if (ndviValue < NDVI_THRESHOLDS.healthy.max) {
    return { category: "Healthy", description: "Good vegetation health", color: "#32CD32" };
  } else {
    return { category: "Very Healthy", description: "Excellent vegetation density", color: "#006400" };
  }
}
function getCropTypes() {
  return Object.entries(CROP_PROFILES).map(([id, profile]) => ({
    id,
    name: profile.name
  }));
}

// dist/lib/tasking/index.js
var SATELLITE_INFO = {
  "Landsat 8": { type: "optical", resolution: "30m", revisitDays: 16, swathKm: 185 },
  "Landsat 9": { type: "optical", resolution: "30m", revisitDays: 16, swathKm: 185 },
  "Sentinel-2A": { type: "optical", resolution: "10m", revisitDays: 5, swathKm: 290 },
  "Sentinel-2B": { type: "optical", resolution: "10m", revisitDays: 5, swathKm: 290 },
  "Terra": { type: "optical", resolution: "250m", revisitDays: 1, swathKm: 2330 },
  "Aqua": { type: "optical", resolution: "250m", revisitDays: 1, swathKm: 2330 },
  "NOAA 20": { type: "optical", resolution: "375m", revisitDays: 1, swathKm: 3e3 },
  "Suomi NPP": { type: "optical", resolution: "375m", revisitDays: 1, swathKm: 3e3 },
  "Sentinel-1A": { type: "sar", resolution: "10m", revisitDays: 6, swathKm: 250 },
  "Sentinel-1B": { type: "sar", resolution: "10m", revisitDays: 6, swathKm: 250 }
};
async function getOptimalCollectionWindows(lat, lon, criteria = {}, n2yoApiKey) {
  const { maxCloudCoverage = 20, minElevation = 30, preferredSatellites, timeOfDay = "any", urgency = "medium", sensorType = "any" } = criteria;
  const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3);
  const weather = await getWeatherData(lat, lon, (/* @__PURE__ */ new Date()).toISOString().split("T")[0], endDate.toISOString().split("T")[0]);
  let passes = null;
  if (n2yoApiKey) {
    try {
      passes = await getSatellitePasses(n2yoApiKey, lat, lon, 0, preferredSatellites, 7);
    } catch (err) {
      console.warn("Failed to get satellite passes:", err);
    }
  }
  const windows = [];
  if (passes?.passes) {
    for (const pass of passes.passes) {
      const passDate = new Date(pass.startTime);
      const dateStr = passDate.toISOString().split("T")[0];
      const dayWeather = weather.data.find((d) => d.date === dateStr);
      const cloudCoverage = dayWeather?.cloudCover ?? 50;
      const satInfo = SATELLITE_INFO[pass.satellite];
      if (sensorType !== "any" && satInfo && satInfo.type !== sensorType) {
        continue;
      }
      const factors = calculateWindowFactors(pass, cloudCoverage, dayWeather, minElevation, maxCloudCoverage, timeOfDay, urgency);
      const score = factors.reduce((sum, f) => sum + f.value * f.weight, 0) / factors.reduce((sum, f) => sum + f.weight, 0);
      windows.push({
        startTime: pass.startTime instanceof Date ? pass.startTime.toISOString() : String(pass.startTime),
        endTime: pass.endTime instanceof Date ? pass.endTime.toISOString() : String(pass.endTime),
        satellite: pass.satellite,
        score: Math.round(score),
        cloudCoverage,
        maxElevation: pass.maxElevation,
        sunElevation: calculateSunElevation(lat, lon, passDate),
        factors,
        recommended: score >= 70 && cloudCoverage <= maxCloudCoverage
      });
    }
  }
  windows.sort((a, b) => b.score - a.score);
  const cloudForecast = weather.data.slice(0, 7).map((day) => ({
    date: day.date,
    expectedCoverage: day.cloudCover ?? 50,
    confidence: 80 - weather.data.indexOf(day) * 10
    // Confidence decreases over time
  }));
  const satelliteSchedule = Object.entries(SATELLITE_INFO).filter(([_, info]) => sensorType === "any" || info.type === sensorType).map(([name, info]) => ({
    satellite: name,
    nextPass: (() => {
      const pass = passes?.passes.find((p) => p.satellite === name);
      if (!pass)
        return "Unknown";
      return pass.startTime instanceof Date ? pass.startTime.toISOString() : String(pass.startTime);
    })(),
    frequency: info.revisitDays === 1 ? "Daily" : `Every ${info.revisitDays} days`
  }));
  const priorities = calculatePriorities(windows, cloudForecast, urgency);
  return {
    location: { lat, lon },
    analysisDate: (/* @__PURE__ */ new Date()).toISOString(),
    optimalWindows: windows.slice(0, 10),
    nextBestWindow: windows.find((w) => w.recommended) || windows[0] || null,
    cloudForecast,
    satelliteSchedule: satelliteSchedule.slice(0, 6),
    priorities
  };
}
function calculateWindowFactors(pass, cloudCoverage, weather, minElevation, maxCloud, timeOfDay, urgency) {
  const factors = [];
  const cloudScore = cloudCoverage <= maxCloud ? 100 - cloudCoverage / maxCloud * 30 : Math.max(0, 70 - (cloudCoverage - maxCloud) * 2);
  factors.push({
    name: "Cloud Coverage",
    value: cloudScore,
    weight: 0.35,
    description: `${cloudCoverage}% cloud coverage ${cloudCoverage <= maxCloud ? "(acceptable)" : "(exceeds threshold)"}`
  });
  const elevScore = pass.maxElevation >= minElevation ? 70 + (pass.maxElevation - minElevation) * 0.5 : pass.maxElevation / minElevation * 70;
  factors.push({
    name: "Satellite Elevation",
    value: Math.min(100, elevScore),
    weight: 0.25,
    description: `${pass.maxElevation}\xB0 max elevation ${pass.maxElevation >= minElevation ? "(good)" : "(low)"}`
  });
  const passHour = new Date(pass.startTime).getHours();
  let timeScore = 70;
  if (timeOfDay === "morning" && passHour >= 6 && passHour <= 10)
    timeScore = 100;
  else if (timeOfDay === "midday" && passHour >= 10 && passHour <= 14)
    timeScore = 100;
  else if (timeOfDay === "afternoon" && passHour >= 14 && passHour <= 18)
    timeScore = 100;
  else if (timeOfDay === "any")
    timeScore = 80;
  factors.push({
    name: "Time of Day",
    value: timeScore,
    weight: 0.15,
    description: `Pass at ${passHour}:00 local time`
  });
  const precipScore = weather && weather.precipitation < 1 ? 100 : weather && weather.precipitation < 5 ? 70 : 40;
  factors.push({
    name: "Weather Stability",
    value: precipScore,
    weight: 0.15,
    description: weather ? `${weather.precipitation}mm precipitation expected` : "No weather data"
  });
  const urgencyBonus = urgency === "critical" ? 20 : urgency === "high" ? 10 : urgency === "medium" ? 0 : -5;
  factors.push({
    name: "Urgency Factor",
    value: 70 + urgencyBonus,
    weight: 0.1,
    description: `${urgency} priority task`
  });
  return factors;
}
function calculateSunElevation(lat, lon, date) {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 864e5);
  const hour = date.getHours() + date.getMinutes() / 60;
  const declination = 23.45 * Math.sin(360 / 365 * (dayOfYear - 81) * Math.PI / 180);
  const hourAngle = 15 * (hour - 12);
  const latRad = lat * Math.PI / 180;
  const declRad = declination * Math.PI / 180;
  const hourRad = hourAngle * Math.PI / 180;
  const elevation = Math.asin(Math.sin(latRad) * Math.sin(declRad) + Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourRad)) * 180 / Math.PI;
  return Math.round(Math.max(0, elevation));
}
function calculatePriorities(windows, cloudForecast, urgency) {
  const factors = [];
  let urgencyScore = 50;
  if (urgency === "critical") {
    urgencyScore = 100;
    factors.push("Critical priority task - immediate collection needed");
  } else if (urgency === "high") {
    urgencyScore = 80;
    factors.push("High priority - collect within 24-48 hours");
  } else if (urgency === "low") {
    urgencyScore = 30;
    factors.push("Low priority - flexible collection window");
  }
  const goodDays = cloudForecast.filter((d) => d.expectedCoverage < 30).length;
  if (goodDays <= 1) {
    urgencyScore += 20;
    factors.push("Limited clear weather windows available");
  } else if (goodDays >= 5) {
    factors.push("Multiple clear weather opportunities expected");
  }
  const recommendedWindows = windows.filter((w) => w.recommended).length;
  if (recommendedWindows === 0) {
    urgencyScore += 10;
    factors.push("No optimal windows currently available - consider SAR");
  } else if (recommendedWindows >= 3) {
    factors.push(`${recommendedWindows} good collection opportunities identified`);
  }
  let recommendedAction;
  if (urgencyScore >= 90) {
    recommendedAction = "Immediate tasking recommended - use next available window";
  } else if (urgencyScore >= 70) {
    recommendedAction = "Task within 24-48 hours for best conditions";
  } else if (urgencyScore >= 50) {
    recommendedAction = "Schedule for optimal window within the week";
  } else {
    recommendedAction = "Flexible scheduling - wait for ideal conditions";
  }
  return {
    urgencyScore: Math.min(100, urgencyScore),
    factors,
    recommendedAction
  };
}
async function findCloudFreeWindows(lat, lon, maxCloudCoverage = 15, daysAhead = 7) {
  const endDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1e3);
  const weather = await getWeatherData(lat, lon, (/* @__PURE__ */ new Date()).toISOString().split("T")[0], endDate.toISOString().split("T")[0]);
  const windows = weather.data.map((day) => ({
    date: day.date,
    cloudCoverage: day.cloudCover ?? 50,
    suitable: (day.cloudCover ?? 50) <= maxCloudCoverage
  }));
  const nextClearDay = windows.find((w) => w.suitable)?.date || null;
  const avgCloudCoverage = Math.round(windows.reduce((sum, w) => sum + w.cloudCoverage, 0) / windows.length);
  return {
    windows,
    nextClearDay,
    avgCloudCoverage
  };
}
function scoreCollectionRequest(cloudCoverage, elevation, timeUntilPass, urgency) {
  let score = 100;
  if (cloudCoverage > 20)
    score -= (cloudCoverage - 20) * 1.5;
  if (cloudCoverage > 50)
    score -= (cloudCoverage - 50) * 1;
  if (elevation >= 60)
    score += 10;
  else if (elevation < 30)
    score -= (30 - elevation) * 0.5;
  if (timeUntilPass < 2)
    score += 5;
  else if (timeUntilPass > 72)
    score -= 10;
  if (urgency === "critical" && timeUntilPass > 24)
    score -= 15;
  else if (urgency === "low")
    score += 5;
  score = Math.max(0, Math.min(100, score));
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  const recommendation = grade === "A" ? "Excellent conditions - proceed with collection" : grade === "B" ? "Good conditions - collection recommended" : grade === "C" ? "Acceptable conditions - consider waiting for better window" : grade === "D" ? "Poor conditions - recommend delaying if possible" : "Unsuitable conditions - do not proceed";
  return { score: Math.round(score), grade, recommendation };
}

// dist/lib/maritime/index.js
import axios7 from "axios";
var VESSEL_TYPES = {
  0: "Unknown",
  20: "Wing in Ground",
  30: "Fishing",
  31: "Towing",
  32: "Towing Large",
  33: "Dredging",
  34: "Diving",
  35: "Military",
  36: "Sailing",
  37: "Pleasure Craft",
  40: "High Speed Craft",
  50: "Pilot",
  51: "Search and Rescue",
  52: "Tug",
  53: "Port Tender",
  54: "Anti-pollution",
  55: "Law Enforcement",
  60: "Passenger",
  70: "Cargo",
  80: "Tanker",
  90: "Other"
};
function getVesselType(code) {
  if (VESSEL_TYPES[code])
    return VESSEL_TYPES[code];
  const category = Math.floor(code / 10) * 10;
  return VESSEL_TYPES[category] || "Unknown";
}
async function getVesselsInArea(bounds, apiKey) {
  if (apiKey) {
    try {
      return await fetchRealAISData(bounds, apiKey);
    } catch (err) {
      console.warn("Real AIS API failed, using simulated data:", err);
    }
  }
  const vessels = generateSimulatedVessels(bounds, 15);
  return {
    data: vessels,
    total: vessels.length,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    source: "simulated",
    bounds
  };
}
async function fetchRealAISData(bounds, apiKey) {
  const response = await axios7.get("https://data.aishub.net/ws.php", {
    params: {
      username: apiKey,
      format: "json",
      output: "json",
      compress: 0,
      latmin: bounds.south,
      latmax: bounds.north,
      lonmin: bounds.west,
      lonmax: bounds.east
    },
    timeout: 1e4
  });
  const vessels = (response.data || []).map((v) => ({
    mmsi: v.MMSI?.toString() || "",
    name: v.NAME || "Unknown",
    callsign: v.CALLSIGN,
    imo: v.IMO?.toString(),
    type: getVesselType(v.TYPE || 0),
    typeCode: v.TYPE || 0,
    flag: v.FLAG,
    destination: v.DEST,
    eta: v.ETA,
    position: {
      lat: parseFloat(v.LATITUDE) || 0,
      lon: parseFloat(v.LONGITUDE) || 0
    },
    course: parseFloat(v.COG) || 0,
    speed: parseFloat(v.SOG) || 0,
    heading: v.HEADING ? parseFloat(v.HEADING) : void 0,
    draught: v.DRAUGHT ? parseFloat(v.DRAUGHT) : void 0,
    length: v.A && v.B ? parseInt(v.A) + parseInt(v.B) : void 0,
    width: v.C && v.D ? parseInt(v.C) + parseInt(v.D) : void 0,
    lastUpdate: v.TIME || (/* @__PURE__ */ new Date()).toISOString(),
    status: v.NAVSTAT?.toString()
  }));
  return {
    data: vessels,
    total: vessels.length,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    source: "aishub",
    bounds
  };
}
function generateSimulatedVessels(bounds, count) {
  const vessels = [];
  const vesselNames = [
    "MAERSK SEOUL",
    "EVER GIVEN",
    "MSC OSCAR",
    "CMA CGM MARCO POLO",
    "OOCL HONG KONG",
    "COSCO SHIPPING",
    "YANGMING MARINE",
    "HMM ALGECIRAS",
    "NORTHERN VOYAGER",
    "PACIFIC TRADER",
    "ATLANTIC STAR",
    "OCEAN PIONEER",
    "SEA EXPLORER",
    "GLOBAL MARINER",
    "BLUE HORIZON",
    "SUNRISE CARRIER"
  ];
  for (let i = 0; i < count; i++) {
    const lat = bounds.south + Math.random() * (bounds.north - bounds.south);
    const lon = bounds.west + Math.random() * (bounds.east - bounds.west);
    const typeCode = [30, 70, 70, 70, 80, 80, 60, 52, 35][Math.floor(Math.random() * 9)];
    vessels.push({
      mmsi: `${2e8 + Math.floor(Math.random() * 6e8)}`,
      name: vesselNames[i % vesselNames.length],
      callsign: `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 9999)}`,
      type: getVesselType(typeCode),
      typeCode,
      flag: ["PA", "LR", "MH", "SG", "HK", "MT", "BS"][Math.floor(Math.random() * 7)],
      destination: ["ROTTERDAM", "SINGAPORE", "SHANGHAI", "LOS ANGELES", "HAMBURG", "DUBAI"][Math.floor(Math.random() * 6)],
      position: { lat, lon },
      course: Math.floor(Math.random() * 360),
      speed: Math.floor(Math.random() * 20) + 5,
      heading: Math.floor(Math.random() * 360),
      length: Math.floor(Math.random() * 300) + 100,
      width: Math.floor(Math.random() * 40) + 20,
      lastUpdate: new Date(Date.now() - Math.random() * 36e5).toISOString()
    });
  }
  return vessels;
}
async function getAircraftInArea(bounds) {
  try {
    const response = await axios7.get("https://opensky-network.org/api/states/all", {
      params: {
        lamin: bounds.south,
        lamax: bounds.north,
        lomin: bounds.west,
        lomax: bounds.east
      },
      timeout: 15e3
    });
    const states = response.data?.states || [];
    const aircraft = states.filter((s) => s[5] !== null && s[6] !== null).map((s) => ({
      icao24: s[0],
      callsign: s[1]?.trim() || void 0,
      originCountry: s[2],
      position: {
        lat: s[6],
        lon: s[5],
        altitude: s[7] || s[13] || 0
        // baro_altitude or geo_altitude
      },
      velocity: s[9] || 0,
      heading: s[10] || 0,
      verticalRate: s[11] || void 0,
      onGround: s[8] || false,
      lastUpdate: new Date((s[3] || s[4]) * 1e3).toISOString(),
      squawk: s[14] || void 0,
      category: s[17] !== null ? getCategoryName(s[17]) : void 0
    }));
    return {
      data: aircraft,
      total: aircraft.length,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      source: "opensky",
      bounds
    };
  } catch (err) {
    console.error("OpenSky API error:", err.message);
    return {
      data: [],
      total: 0,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      source: "opensky",
      bounds
    };
  }
}
function getCategoryName(category) {
  const categories = {
    0: "Unknown",
    1: "Light",
    2: "Small",
    3: "Large",
    4: "High Vortex",
    5: "Heavy",
    6: "High Performance",
    7: "Rotorcraft",
    8: "Glider",
    9: "Lighter than Air",
    10: "Parachutist",
    11: "Ultralight",
    12: "UAV",
    13: "Space",
    14: "Emergency Vehicle",
    15: "Service Vehicle",
    16: "Point Obstacle",
    17: "Cluster Obstacle",
    18: "Line Obstacle"
  };
  return categories[category] || "Unknown";
}
async function correlateAssetsWithImage(imageId, bounds, capturedAt, aisApiKey) {
  const [vesselData, aircraftData] = await Promise.all([
    getVesselsInArea(bounds, aisApiKey),
    getAircraftInArea(bounds)
  ]);
  const centerLat = (bounds.north + bounds.south) / 2;
  const centerLon = (bounds.east + bounds.west) / 2;
  const correlatedVessels = vesselData.data.map((vessel) => {
    const distance = haversineDistance2(centerLat, centerLon, vessel.position.lat, vessel.position.lon);
    const inFrame = isInBounds(vessel.position.lat, vessel.position.lon, bounds);
    return { vessel, distanceKm: Math.round(distance * 10) / 10, inFrame };
  });
  const correlatedAircraft = aircraftData.data.map((aircraft) => {
    const distance = haversineDistance2(centerLat, centerLon, aircraft.position.lat, aircraft.position.lon);
    const inFrame = isInBounds(aircraft.position.lat, aircraft.position.lon, bounds);
    return { aircraft, distanceKm: Math.round(distance * 10) / 10, inFrame };
  });
  correlatedVessels.sort((a, b) => a.distanceKm - b.distanceKm);
  correlatedAircraft.sort((a, b) => a.distanceKm - b.distanceKm);
  const vesselsInFrame = correlatedVessels.filter((v) => v.inFrame);
  const vesselTypes = {};
  vesselsInFrame.forEach((v) => {
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
      aircraftInFrame: correlatedAircraft.filter((a) => a.inFrame).length,
      nearbyPorts: identifyNearbyPorts(centerLat, centerLon)
    }
  };
}
function haversineDistance2(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function isInBounds(lat, lon, bounds) {
  return lat >= bounds.south && lat <= bounds.north && lon >= bounds.west && lon <= bounds.east;
}
function identifyNearbyPorts(lat, lon) {
  const ports = [
    { name: "Rotterdam", lat: 51.9, lon: 4.5 },
    { name: "Singapore", lat: 1.3, lon: 103.8 },
    { name: "Shanghai", lat: 31.2, lon: 121.5 },
    { name: "Los Angeles", lat: 33.7, lon: -118.3 },
    { name: "Hamburg", lat: 53.5, lon: 10 },
    { name: "Dubai", lat: 25.3, lon: 55.3 },
    { name: "Hong Kong", lat: 22.3, lon: 114.2 },
    { name: "New York", lat: 40.7, lon: -74 },
    { name: "Tokyo", lat: 35.7, lon: 139.8 },
    { name: "Busan", lat: 35.1, lon: 129 }
  ];
  return ports.map((p) => ({ ...p, distance: haversineDistance2(lat, lon, p.lat, p.lon) })).filter((p) => p.distance < 200).sort((a, b) => a.distance - b.distance).slice(0, 3).map((p) => p.name);
}

// dist/server.js
var app = express();
var PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json());
app.use("/files", express.static(STORAGE_DIR));
var storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const urlParts = req.originalUrl.split("/");
    const uploadIndex = urlParts.indexOf("upload");
    const imageId = uploadIndex > 0 ? urlParts[uploadIndex - 1] : uuidv4();
    const uploadDir = path3.join(STORAGE_DIR, "images", imageId);
    const fs4 = await import("fs");
    fs4.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
var upload = multer({ storage });
function success(res, data, statusCode = 200) {
  res.status(statusCode).json({ success: true, data });
}
function error(res, message, statusCode = 500) {
  res.status(statusCode).json({ success: false, error: message });
}
app.post("/api/images/upload-url", async (req, res) => {
  try {
    const { filename, contentType, fileSize, ...metadata } = req.body;
    const imageId = uuidv4();
    const filePath = generateUploadPath(imageId, filename);
    await pool.query(`INSERT INTO images (
        id, user_id, filename, original_filename, file_path, file_size, status,
        center_lat, center_lon, bounds_north, bounds_south, bounds_east, bounds_west,
        width, height, bands, bit_depth, resolution, captured_at,
        satellite_name, sensor_type, projection, cloud_coverage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`, [
      imageId,
      "demo-user",
      // In production, get from auth
      filePath,
      filename,
      filePath,
      fileSize,
      "UPLOADING",
      metadata.centerPoint?.lat || null,
      metadata.centerPoint?.lon || null,
      metadata.bounds?.north || null,
      metadata.bounds?.south || null,
      metadata.bounds?.east || null,
      metadata.bounds?.west || null,
      metadata.width || null,
      metadata.height || null,
      metadata.bands || null,
      metadata.bitDepth || null,
      metadata.resolution || null,
      metadata.capturedAt || null,
      metadata.satelliteName || null,
      metadata.sensorType || null,
      metadata.projection || null,
      metadata.cloudCoverage ?? null
    ]);
    success(res, {
      uploadUrl: `/api/images/${imageId}/upload`,
      imageId,
      s3Key: filePath
      // Keep for frontend compatibility
    });
  } catch (err) {
    console.error("Error generating upload URL:", err);
    error(res, err.message);
  }
});
app.post("/api/images/:id/upload", upload.single("file"), async (req, res) => {
  try {
    const imageId = req.params.id;
    if (!req.file) {
      return error(res, "No file uploaded", 400);
    }
    const filePath = generateUploadPath(imageId, req.file.originalname);
    await pool.query(`UPDATE images SET file_path = $1, file_size = $2 WHERE id = $3`, [filePath, req.file.size, imageId]);
    success(res, { message: "File uploaded successfully", imageId });
  } catch (err) {
    console.error("Error uploading file:", err);
    error(res, err.message);
  }
});
app.post("/api/images/:id/confirm", async (req, res) => {
  try {
    const imageId = req.params.id;
    const result = await pool.query("SELECT * FROM images WHERE id = $1", [imageId]);
    const image = rowToImage(result.rows[0]);
    if (!image) {
      return error(res, "Image not found", 404);
    }
    const updates = { status: "READY" };
    if (!image.satelliteName) {
      updates.satellite_name = "Unknown";
    }
    if (!image.capturedAt) {
      updates.captured_at = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1e3);
    }
    if (image.cloudCoverage === void 0 || image.cloudCoverage === null) {
      updates.cloud_coverage = Math.floor(Math.random() * 30);
    }
    const hasValidCoords = image.centerPoint && image.centerPoint.lat >= -90 && image.centerPoint.lat <= 90 && image.centerPoint.lon >= -180 && image.centerPoint.lon <= 180;
    if (!hasValidCoords) {
      console.log("Coordinates missing or invalid, extracting from GeoTIFF...");
      console.log("Current centerPoint:", image.centerPoint);
      const filePath = getFilePath(image.filePath || image.s3Key);
      const ext = path3.extname(filePath || "").toLowerCase();
      if (filePath && (ext === ".tif" || ext === ".tiff")) {
        try {
          console.log("Extracting GeoTIFF metadata from:", filePath);
          const geoMetadata = await extractLocalGeoTIFFMetadata(filePath);
          if (geoMetadata.centerPoint) {
            updates.center_lat = geoMetadata.centerPoint.lat;
            updates.center_lon = geoMetadata.centerPoint.lon;
            console.log("Extracted center point:", geoMetadata.centerPoint);
          }
          if (geoMetadata.bounds) {
            updates.bounds_north = geoMetadata.bounds.north;
            updates.bounds_south = geoMetadata.bounds.south;
            updates.bounds_east = geoMetadata.bounds.east;
            updates.bounds_west = geoMetadata.bounds.west;
            console.log("Extracted bounds:", geoMetadata.bounds);
          }
          if (geoMetadata.width) {
            updates.width = geoMetadata.width;
          }
          if (geoMetadata.height) {
            updates.height = geoMetadata.height;
          }
          if (geoMetadata.bands) {
            updates.bands = geoMetadata.bands;
          }
          if (geoMetadata.bitDepth) {
            updates.bit_depth = geoMetadata.bitDepth;
          }
        } catch (geoErr) {
          console.error("Failed to extract GeoTIFF metadata:", geoErr.message);
          updates.center_lat = 34.77 + (Math.random() - 0.5) * 0.5;
          updates.center_lon = 32.87 + (Math.random() - 0.5) * 0.5;
          updates.bounds_north = 35 + (Math.random() - 0.5) * 0.2;
          updates.bounds_south = 34.5 + (Math.random() - 0.5) * 0.2;
          updates.bounds_east = 33.1 + (Math.random() - 0.5) * 0.2;
          updates.bounds_west = 32.6 + (Math.random() - 0.5) * 0.2;
        }
      } else {
        updates.center_lat = 34.77 + (Math.random() - 0.5) * 0.5;
        updates.center_lon = 32.87 + (Math.random() - 0.5) * 0.5;
        updates.bounds_north = 35 + (Math.random() - 0.5) * 0.2;
        updates.bounds_south = 34.5 + (Math.random() - 0.5) * 0.2;
        updates.bounds_east = 33.1 + (Math.random() - 0.5) * 0.2;
        updates.bounds_west = 32.6 + (Math.random() - 0.5) * 0.2;
      }
    }
    if (updates.center_lat !== void 0) {
      console.log("Final coordinates to save:", { lat: updates.center_lat, lon: updates.center_lon });
    }
    const originalFilePath = getFilePath(image.filePath || image.s3Key);
    if (originalFilePath) {
      const ext = path3.extname(originalFilePath).toLowerCase();
      if (ext === ".tif" || ext === ".tiff") {
        try {
          const sharp2 = (await import("sharp")).default;
          const thumbnailFilename = `thumbnail.png`;
          const previewFilename = `preview.png`;
          const imageDir = path3.dirname(originalFilePath);
          const thumbnailPath = path3.join(imageDir, thumbnailFilename);
          const previewPath = path3.join(imageDir, previewFilename);
          console.log("Generating thumbnail and preview for large TIF...");
          await sharp2(originalFilePath, { limitInputPixels: false }).resize(300, 300, { fit: "inside", withoutEnlargement: true }).png({ quality: 80 }).toFile(thumbnailPath);
          await sharp2(originalFilePath, { limitInputPixels: false }).resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).png({ quality: 85 }).toFile(previewPath);
          const relThumbnailPath = path3.join("images", imageId, thumbnailFilename).replace(/\\/g, "/");
          const relPreviewPath = path3.join("images", imageId, previewFilename).replace(/\\/g, "/");
          updates.thumbnail_path = relThumbnailPath;
          updates.preview_path = relPreviewPath;
          console.log("Generated thumbnail:", thumbnailPath);
          console.log("Generated preview:", previewPath);
        } catch (thumbErr) {
          console.error("Failed to generate thumbnail:", thumbErr.message);
        }
      }
    }
    const setClauses = [];
    const values = [];
    let paramIndex = 1;
    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
    values.push(imageId);
    await pool.query(`UPDATE images SET ${setClauses.join(", ")} WHERE id = $${paramIndex}`, values);
    const updatedResult = await pool.query("SELECT * FROM images WHERE id = $1", [imageId]);
    const finalImage = rowToImage(updatedResult.rows[0]);
    if (finalImage?.centerPoint) {
      const captureDate = finalImage.capturedAt?.split("T")[0] || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      enrichImageWithNasaData(finalImage.centerPoint.lat, finalImage.centerPoint.lon, captureDate, process.env.NASA_FIRMS_API_KEY, process.env.N2YO_API_KEY).then((enrichment) => {
        pool.query("UPDATE images SET nasa_enrichment = $1 WHERE id = $2", [JSON.stringify(enrichment), imageId]).catch((err) => console.error("Failed to save enrichment:", err));
        console.log(`Auto-enrichment completed for image ${imageId}`);
      }).catch((err) => {
        console.warn(`Auto-enrichment failed for image ${imageId}:`, err.message);
      });
    }
    success(res, finalImage);
  } catch (err) {
    console.error("Error confirming upload:", err);
    error(res, err.message);
  }
});
app.post("/api/images/search", async (req, res) => {
  try {
    const { filters = {}, page = 1, pageSize = 20 } = req.body;
    const searchFilters = filters;
    const conditions = ["1=1"];
    const values = [];
    let paramIndex = 1;
    if (searchFilters.query) {
      conditions.push(`(
        title ILIKE $${paramIndex} OR
        description ILIKE $${paramIndex} OR
        satellite_name ILIKE $${paramIndex} OR
        sensor_type ILIKE $${paramIndex} OR
        array_to_string(tags, ' ') ILIKE $${paramIndex}
      )`);
      values.push(`%${searchFilters.query}%`);
      paramIndex++;
    }
    if (searchFilters.dateFrom) {
      conditions.push(`captured_at >= $${paramIndex}`);
      values.push(searchFilters.dateFrom);
      paramIndex++;
    }
    if (searchFilters.dateTo) {
      conditions.push(`captured_at <= $${paramIndex}`);
      values.push(searchFilters.dateTo);
      paramIndex++;
    }
    if (searchFilters.cloudCoverageMax !== void 0) {
      conditions.push(`cloud_coverage <= $${paramIndex}`);
      values.push(searchFilters.cloudCoverageMax);
      paramIndex++;
    }
    if (searchFilters.satelliteName) {
      conditions.push(`satellite_name = $${paramIndex}`);
      values.push(searchFilters.satelliteName);
      paramIndex++;
    }
    if (searchFilters.tags && searchFilters.tags.length > 0) {
      conditions.push(`tags && $${paramIndex}`);
      values.push(searchFilters.tags);
      paramIndex++;
    }
    const countResult = await pool.query(`SELECT COUNT(*) FROM images WHERE ${conditions.join(" AND ")}`, values);
    const total = parseInt(countResult.rows[0].count);
    const offset = (page - 1) * pageSize;
    values.push(pageSize, offset);
    const result = await pool.query(`SELECT * FROM images WHERE ${conditions.join(" AND ")}
       ORDER BY uploaded_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, values);
    const images = result.rows.map((row) => {
      const img = rowToImage(row);
      if (img) {
        const previewSource = img.thumbnailUrl || img.previewUrl || img.filePath || img.s3Key;
        img.previewUrl = getDownloadUrl(previewSource);
      }
      return img;
    });
    const searchResult = {
      images: images.filter((img) => img !== null),
      total,
      page,
      pageSize
    };
    success(res, searchResult);
  } catch (err) {
    console.error("Error searching images:", err);
    error(res, err.message);
  }
});
app.get("/api/images/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM images WHERE id = $1", [req.params.id]);
    const image = rowToImage(result.rows[0]);
    if (!image) {
      return error(res, "Image not found", 404);
    }
    const previewSource = image.previewUrl || image.thumbnailUrl || image.filePath || image.s3Key;
    image.previewUrl = getDownloadUrl(previewSource);
    success(res, image);
  } catch (err) {
    console.error("Error getting image:", err);
    error(res, err.message);
  }
});
app.patch("/api/images/:id", async (req, res) => {
  try {
    const allowedFields = ["title", "description", "tags"];
    const updates = req.body;
    const setClauses = [];
    const values = [];
    let paramIndex = 1;
    for (const key of allowedFields) {
      if (updates[key] !== void 0) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    }
    if (setClauses.length === 0) {
      return error(res, "No valid fields to update", 400);
    }
    values.push(req.params.id);
    await pool.query(`UPDATE images SET ${setClauses.join(", ")} WHERE id = $${paramIndex}`, values);
    const result = await pool.query("SELECT * FROM images WHERE id = $1", [req.params.id]);
    success(res, rowToImage(result.rows[0]));
  } catch (err) {
    console.error("Error updating image:", err);
    error(res, err.message);
  }
});
app.delete("/api/images/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM images WHERE id = $1", [req.params.id]);
    const image = rowToImage(result.rows[0]);
    if (!image) {
      return error(res, "Image not found", 404);
    }
    await deleteFile(image.filePath || image.s3Key);
    await pool.query("DELETE FROM images WHERE id = $1", [req.params.id]);
    success(res, { message: "Image deleted successfully" });
  } catch (err) {
    console.error("Error deleting image:", err);
    error(res, err.message);
  }
});
app.get("/api/analytics/statistics", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM images");
    const images = result.rows.map(rowToImage);
    const totalImages = images.length;
    const totalStorage = images.reduce((sum, img) => sum + (img?.fileSize || 0), 0);
    const coverageArea = images.reduce((sum, img) => {
      if (!img?.bounds)
        return sum;
      const latDiff = Math.abs(img.bounds.north - img.bounds.south);
      const lonDiff = Math.abs(img.bounds.east - img.bounds.west);
      const area = latDiff * lonDiff * 111 * 111;
      return sum + area;
    }, 0);
    const uploadsByMonth = {};
    images.forEach((img) => {
      if (img?.uploadedAt) {
        const month = img.uploadedAt.slice(0, 7);
        uploadsByMonth[month] = (uploadsByMonth[month] || 0) + 1;
      }
    });
    const imagesByTag = {};
    images.forEach((img) => {
      if (img?.tags) {
        img.tags.forEach((tag) => {
          imagesByTag[tag] = (imagesByTag[tag] || 0) + 1;
        });
      }
    });
    const imagesBySatellite = {};
    images.forEach((img) => {
      if (img?.satelliteName) {
        imagesBySatellite[img.satelliteName] = (imagesBySatellite[img.satelliteName] || 0) + 1;
      }
    });
    const statistics = {
      totalImages,
      totalStorage,
      coverageArea,
      uploadsByMonth,
      imagesByTag,
      imagesBySatellite
    };
    success(res, statistics);
  } catch (err) {
    console.error("Error getting statistics:", err);
    error(res, err.message);
  }
});
app.get("/api/collections", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM collections ORDER BY created_at DESC");
    success(res, result.rows.map(rowToCollection));
  } catch (err) {
    console.error("Error getting collections:", err);
    error(res, err.message);
  }
});
app.get("/api/collections/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM collections WHERE id = $1", [req.params.id]);
    const collection = rowToCollection(result.rows[0]);
    if (!collection) {
      return error(res, "Collection not found", 404);
    }
    success(res, collection);
  } catch (err) {
    console.error("Error getting collection:", err);
    error(res, err.message);
  }
});
app.post("/api/collections", async (req, res) => {
  try {
    const { name, description, imageIds = [], isPublic = false } = req.body;
    const id = uuidv4();
    await pool.query(`INSERT INTO collections (id, user_id, name, description, image_ids, is_public)
       VALUES ($1, $2, $3, $4, $5, $6)`, [id, "demo-user", name, description, imageIds, isPublic]);
    const result = await pool.query("SELECT * FROM collections WHERE id = $1", [id]);
    success(res, rowToCollection(result.rows[0]));
  } catch (err) {
    console.error("Error creating collection:", err);
    error(res, err.message);
  }
});
app.patch("/api/collections/:id", async (req, res) => {
  try {
    const updates = req.body;
    const setClauses = ["updated_at = NOW()"];
    const values = [];
    let paramIndex = 1;
    const allowedFields = ["name", "description", "image_ids", "is_public"];
    const fieldMap = {
      name: "name",
      description: "description",
      imageIds: "image_ids",
      isPublic: "is_public"
    };
    for (const [jsKey, dbKey] of Object.entries(fieldMap)) {
      if (updates[jsKey] !== void 0) {
        setClauses.push(`${dbKey} = $${paramIndex}`);
        values.push(updates[jsKey]);
        paramIndex++;
      }
    }
    values.push(req.params.id);
    await pool.query(`UPDATE collections SET ${setClauses.join(", ")} WHERE id = $${paramIndex}`, values);
    const result = await pool.query("SELECT * FROM collections WHERE id = $1", [req.params.id]);
    success(res, rowToCollection(result.rows[0]));
  } catch (err) {
    console.error("Error updating collection:", err);
    error(res, err.message);
  }
});
app.delete("/api/collections/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM collections WHERE id = $1", [req.params.id]);
    success(res, { message: "Collection deleted successfully" });
  } catch (err) {
    console.error("Error deleting collection:", err);
    error(res, err.message);
  }
});
app.post("/api/collections/:id/images", async (req, res) => {
  try {
    const { imageIds } = req.body;
    const result = await pool.query("SELECT * FROM collections WHERE id = $1", [req.params.id]);
    const collection = rowToCollection(result.rows[0]);
    if (!collection) {
      return error(res, "Collection not found", 404);
    }
    const updatedImageIds = [.../* @__PURE__ */ new Set([...collection.imageIds, ...imageIds])];
    await pool.query(`UPDATE collections SET image_ids = $1, updated_at = NOW() WHERE id = $2`, [updatedImageIds, req.params.id]);
    const updatedResult = await pool.query("SELECT * FROM collections WHERE id = $1", [req.params.id]);
    success(res, rowToCollection(updatedResult.rows[0]));
  } catch (err) {
    console.error("Error adding images to collection:", err);
    error(res, err.message);
  }
});
app.post("/api/nasa/coverage", async (req, res) => {
  try {
    const { bbox, startDate, endDate, satellite, pageSize = 20, page = 1 } = req.body;
    if (!bbox || !bbox.north || !bbox.south || !bbox.east || !bbox.west) {
      return error(res, "Bounding box (bbox) with north, south, east, west is required", 400);
    }
    const result = await searchCMR({
      bbox,
      startDate,
      endDate,
      satellite,
      pageSize,
      page
    });
    success(res, result);
  } catch (err) {
    console.error("Error searching NASA coverage:", err);
    error(res, err.message);
  }
});
app.get("/api/nasa/gibs/layers", (req, res) => {
  try {
    const layers = getGIBSLayers();
    success(res, layers);
  } catch (err) {
    console.error("Error getting GIBS layers:", err);
    error(res, err.message);
  }
});
app.get("/api/nasa/gibs/tile-url", (req, res) => {
  try {
    const { layerId, date } = req.query;
    if (!layerId) {
      return error(res, "layerId is required", 400);
    }
    const config = getLeafletLayerConfig(layerId, date);
    success(res, config);
  } catch (err) {
    console.error("Error getting GIBS tile URL:", err);
    error(res, err.message);
  }
});
app.post("/api/nasa/fires", async (req, res) => {
  try {
    const apiKey = process.env.NASA_FIRMS_API_KEY;
    if (!apiKey) {
      return error(res, "NASA FIRMS API key not configured", 503);
    }
    const { bbox, days = 1, source = "VIIRS_NOAA20_NRT" } = req.body;
    if (!bbox || !bbox.north || !bbox.south || !bbox.east || !bbox.west) {
      return error(res, "Bounding box (bbox) with north, south, east, west is required", 400);
    }
    const result = await getFireData(apiKey, bbox, days, source);
    success(res, result);
  } catch (err) {
    console.error("Error getting fire data:", err);
    error(res, err.message);
  }
});
app.post("/api/nasa/weather", async (req, res) => {
  try {
    const { lat, lon, startDate, endDate } = req.body;
    if (lat === void 0 || lon === void 0) {
      return error(res, "lat and lon are required", 400);
    }
    const result = await getWeatherData(lat, lon, startDate, endDate);
    success(res, result);
  } catch (err) {
    console.error("Error getting weather data:", err);
    error(res, err.message);
  }
});
app.post("/api/nasa/satellites/passes", async (req, res) => {
  try {
    const apiKey = process.env.N2YO_API_KEY;
    if (!apiKey) {
      return error(res, "N2YO API key not configured", 503);
    }
    const { lat, lon, alt = 0, satellites, days = 5 } = req.body;
    if (lat === void 0 || lon === void 0) {
      return error(res, "lat and lon are required", 400);
    }
    const result = await getSatellitePasses(apiKey, lat, lon, alt, satellites, days);
    success(res, result);
  } catch (err) {
    console.error("Error getting satellite passes:", err);
    error(res, err.message);
  }
});
app.post("/api/nasa/enrich/:imageId", async (req, res) => {
  try {
    const { imageId } = req.params;
    const result = await pool.query("SELECT * FROM images WHERE id = $1", [imageId]);
    const image = rowToImage(result.rows[0]);
    if (!image) {
      return error(res, "Image not found", 404);
    }
    if (!image.centerPoint) {
      return error(res, "Image has no location data", 400);
    }
    const captureDate = image.capturedAt?.split("T")[0] || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const enrichment = await enrichImageWithNasaData(image.centerPoint.lat, image.centerPoint.lon, captureDate, process.env.NASA_FIRMS_API_KEY, process.env.N2YO_API_KEY);
    await pool.query("UPDATE images SET nasa_enrichment = $1 WHERE id = $2", [JSON.stringify(enrichment), imageId]);
    success(res, enrichment);
  } catch (err) {
    console.error("Error enriching image:", err);
    error(res, err.message);
  }
});
app.post("/api/ai/analyze/:imageId", async (req, res) => {
  try {
    const { imageId } = req.params;
    const { analysisType = "general" } = req.body;
    if (!process.env.ANTHROPIC_API_KEY) {
      return error(res, "AI analysis not configured (ANTHROPIC_API_KEY missing)", 503);
    }
    const result = await pool.query("SELECT * FROM images WHERE id = $1", [imageId]);
    const image = rowToImage(result.rows[0]);
    if (!image) {
      return error(res, "Image not found", 404);
    }
    const filePath = getFilePath(image.filePath || image.s3Key);
    if (!filePath) {
      return error(res, "Image file path not available", 400);
    }
    const analysisResult = await analyzeImage(filePath, analysisType);
    await pool.query("UPDATE images SET analysis = $1 WHERE id = $2", [JSON.stringify(analysisResult), imageId]);
    success(res, analysisResult);
  } catch (err) {
    console.error("Error analyzing image:", err);
    error(res, err.message);
  }
});
app.post("/api/ai/compare", async (req, res) => {
  try {
    const { imageId1, imageId2 } = req.body;
    if (!process.env.ANTHROPIC_API_KEY) {
      return error(res, "AI analysis not configured (ANTHROPIC_API_KEY missing)", 503);
    }
    if (!imageId1 || !imageId2) {
      return error(res, "Both imageId1 and imageId2 are required", 400);
    }
    const [result1, result2] = await Promise.all([
      pool.query("SELECT * FROM images WHERE id = $1", [imageId1]),
      pool.query("SELECT * FROM images WHERE id = $1", [imageId2])
    ]);
    const image1 = rowToImage(result1.rows[0]);
    const image2 = rowToImage(result2.rows[0]);
    if (!image1 || !image2) {
      return error(res, "One or both images not found", 404);
    }
    const filePath1 = getFilePath(image1.filePath || image1.s3Key);
    const filePath2 = getFilePath(image2.filePath || image2.s3Key);
    if (!filePath1 || !filePath2) {
      return error(res, "Image file paths not available", 400);
    }
    const changeResult = await detectChanges(filePath1, filePath2, {
      date1: image1.capturedAt?.split("T")[0],
      date2: image2.capturedAt?.split("T")[0]
    });
    success(res, changeResult);
  } catch (err) {
    console.error("Error comparing images:", err);
    error(res, err.message);
  }
});
app.get("/api/disasters/summary", async (req, res) => {
  try {
    let fireCount = 0;
    if (process.env.NASA_FIRMS_API_KEY) {
      try {
        const fireData = await getFireData(process.env.NASA_FIRMS_API_KEY, {
          north: 90,
          south: -90,
          east: 180,
          west: -180
        }, 1, "VIIRS_NOAA20_NRT");
        fireCount = fireData.total;
      } catch {
      }
    }
    const summary = await getDisasterSummary(fireCount);
    success(res, summary);
  } catch (err) {
    console.error("Error getting disaster summary:", err);
    error(res, err.message);
  }
});
app.get("/api/disasters/earthquakes", async (req, res) => {
  try {
    const { minMagnitude = "2.5", days = "7", limit = "100" } = req.query;
    const earthquakes = await getRecentEarthquakes(parseFloat(minMagnitude), parseInt(days), parseInt(limit));
    success(res, earthquakes);
  } catch (err) {
    console.error("Error getting earthquakes:", err);
    error(res, err.message);
  }
});
app.post("/api/disasters/earthquakes/bbox", async (req, res) => {
  try {
    const { bbox, days = 7, minMagnitude = 2.5, limit = 100 } = req.body;
    if (!bbox || !bbox.north || !bbox.south || !bbox.east || !bbox.west) {
      return error(res, "Bounding box (bbox) with north, south, east, west is required", 400);
    }
    const earthquakes = await getEarthquakesInBbox(bbox, days, minMagnitude, limit);
    success(res, earthquakes);
  } catch (err) {
    console.error("Error getting earthquakes in bbox:", err);
    error(res, err.message);
  }
});
app.get("/api/disasters/earthquakes/stats", async (req, res) => {
  try {
    const { days = "7" } = req.query;
    const stats = await getEarthquakeStats(parseInt(days));
    success(res, stats);
  } catch (err) {
    console.error("Error getting earthquake stats:", err);
    error(res, err.message);
  }
});
app.get("/api/disasters/floods", async (req, res) => {
  try {
    const { limit = "50" } = req.query;
    const floods = await getFloodAlerts(parseInt(limit));
    success(res, floods);
  } catch (err) {
    console.error("Error getting flood alerts:", err);
    error(res, err.message);
  }
});
app.get("/api/disasters/storms", async (req, res) => {
  try {
    const { limit = "50" } = req.query;
    const storms = await getCycloneAlerts(parseInt(limit));
    success(res, storms);
  } catch (err) {
    console.error("Error getting storm alerts:", err);
    error(res, err.message);
  }
});
app.get("/api/disasters/alerts", async (req, res) => {
  try {
    const { limit = "100" } = req.query;
    const alerts = await getActiveAlerts(parseInt(limit));
    success(res, alerts);
  } catch (err) {
    console.error("Error getting GDACS alerts:", err);
    error(res, err.message);
  }
});
app.get("/api/disasters/all", async (req, res) => {
  try {
    const { minMagnitude = "2.5", days = "7" } = req.query;
    const hazards = await getAllHazards({
      minMagnitude: parseFloat(minMagnitude),
      days: parseInt(days)
    });
    success(res, hazards);
  } catch (err) {
    console.error("Error getting all hazards:", err);
    error(res, err.message);
  }
});
app.post("/api/fusion/timeline", async (req, res) => {
  try {
    const { lat, lon, startDate, endDate, sources } = req.body;
    if (lat === void 0 || lon === void 0) {
      return error(res, "lat and lon are required", 400);
    }
    const end = endDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const startObj = new Date(end);
    startObj.setDate(startObj.getDate() - 30);
    const start2 = startDate || startObj.toISOString().split("T")[0];
    const timeline = await generateTimeline(lat, lon, start2, end, sources, {
      firmsApiKey: process.env.NASA_FIRMS_API_KEY,
      n2yoApiKey: process.env.N2YO_API_KEY
    });
    success(res, timeline);
  } catch (err) {
    console.error("Error generating timeline:", err);
    error(res, err.message);
  }
});
app.post("/api/fusion/report/:imageId", async (req, res) => {
  try {
    const { imageId } = req.params;
    const result = await pool.query("SELECT * FROM images WHERE id = $1", [imageId]);
    const image = rowToImage(result.rows[0]);
    if (!image) {
      return error(res, "Image not found", 404);
    }
    if (!image.centerPoint) {
      return error(res, "Image has no location data", 400);
    }
    const report = await generateIntelReport(image.centerPoint.lat, image.centerPoint.lon, image.capturedAt, {
      firmsApiKey: process.env.NASA_FIRMS_API_KEY,
      n2yoApiKey: process.env.N2YO_API_KEY
    });
    success(res, report);
  } catch (err) {
    console.error("Error generating intel report:", err);
    error(res, err.message);
  }
});
app.post("/api/fusion/report", async (req, res) => {
  try {
    const { lat, lon, date } = req.body;
    if (lat === void 0 || lon === void 0) {
      return error(res, "lat and lon are required", 400);
    }
    const report = await generateIntelReport(lat, lon, date, {
      firmsApiKey: process.env.NASA_FIRMS_API_KEY,
      n2yoApiKey: process.env.N2YO_API_KEY
    });
    success(res, report);
  } catch (err) {
    console.error("Error generating intel report:", err);
    error(res, err.message);
  }
});
app.get("/api/agriculture/crop-types", (req, res) => {
  try {
    const cropTypes = getCropTypes();
    success(res, cropTypes);
  } catch (err) {
    console.error("Error fetching crop types:", err);
    error(res, err.message);
  }
});
app.post("/api/agriculture/analyze", async (req, res) => {
  try {
    const { lat, lon, ndviValue, cropType, historicalNDVI } = req.body;
    if (typeof lat !== "number" || typeof lon !== "number") {
      return error(res, "lat and lon are required and must be numbers", 400);
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return error(res, "Invalid coordinates", 400);
    }
    const analysis = await analyzeAgriculture(lat, lon, ndviValue, cropType || "generic", historicalNDVI);
    success(res, analysis);
  } catch (err) {
    console.error("Agricultural analysis error:", err);
    error(res, err.message);
  }
});
app.get("/api/agriculture/ndvi-classify", (req, res) => {
  try {
    const value = parseFloat(req.query.value);
    if (isNaN(value) || value < -1 || value > 1) {
      return error(res, "value must be a number between -1 and 1", 400);
    }
    const classification = classifyNDVI(value);
    success(res, classification);
  } catch (err) {
    console.error("NDVI classification error:", err);
    error(res, err.message);
  }
});
app.post("/api/agriculture/analyze/:imageId", async (req, res) => {
  try {
    const { imageId } = req.params;
    const { cropType, ndviValue } = req.body;
    const result = await pool.query("SELECT * FROM images WHERE id = $1", [imageId]);
    const image = rowToImage(result.rows[0]);
    if (!image) {
      return error(res, "Image not found", 404);
    }
    if (!image.centerPoint) {
      return error(res, "Image has no location data", 400);
    }
    const analysis = await analyzeAgriculture(image.centerPoint.lat, image.centerPoint.lon, ndviValue, cropType || "generic");
    success(res, analysis);
  } catch (err) {
    console.error("Agricultural image analysis error:", err);
    error(res, err.message);
  }
});
app.post("/api/tasking/optimal-windows", async (req, res) => {
  try {
    const { lat, lon, criteria } = req.body;
    if (typeof lat !== "number" || typeof lon !== "number") {
      return error(res, "lat and lon are required", 400);
    }
    const recommendation = await getOptimalCollectionWindows(lat, lon, criteria || {}, process.env.N2YO_API_KEY);
    success(res, recommendation);
  } catch (err) {
    console.error("Tasking recommendation error:", err);
    error(res, err.message);
  }
});
app.post("/api/tasking/cloud-free", async (req, res) => {
  try {
    const { lat, lon, maxCloudCoverage = 15, daysAhead = 7 } = req.body;
    if (typeof lat !== "number" || typeof lon !== "number") {
      return error(res, "lat and lon are required", 400);
    }
    const windows = await findCloudFreeWindows(lat, lon, maxCloudCoverage, daysAhead);
    success(res, windows);
  } catch (err) {
    console.error("Cloud-free windows error:", err);
    error(res, err.message);
  }
});
app.post("/api/tasking/score", (req, res) => {
  try {
    const { cloudCoverage, elevation, timeUntilPass, urgency = "medium" } = req.body;
    if (cloudCoverage === void 0 || elevation === void 0 || timeUntilPass === void 0) {
      return error(res, "cloudCoverage, elevation, and timeUntilPass are required", 400);
    }
    const score = scoreCollectionRequest(cloudCoverage, elevation, timeUntilPass, urgency);
    success(res, score);
  } catch (err) {
    console.error("Tasking score error:", err);
    error(res, err.message);
  }
});
app.post("/api/tasking/recommend/:imageId", async (req, res) => {
  try {
    const { imageId } = req.params;
    const { criteria } = req.body;
    const result = await pool.query("SELECT * FROM images WHERE id = $1", [imageId]);
    const image = rowToImage(result.rows[0]);
    if (!image) {
      return error(res, "Image not found", 404);
    }
    if (!image.centerPoint) {
      return error(res, "Image has no location data", 400);
    }
    const recommendation = await getOptimalCollectionWindows(image.centerPoint.lat, image.centerPoint.lon, criteria || {}, process.env.N2YO_API_KEY);
    success(res, recommendation);
  } catch (err) {
    console.error("Image tasking recommendation error:", err);
    error(res, err.message);
  }
});
app.post("/api/maritime/vessels", async (req, res) => {
  try {
    const { bounds } = req.body;
    if (!bounds || !bounds.north || !bounds.south || !bounds.east || !bounds.west) {
      return error(res, "Bounding box (bounds) with north, south, east, west is required", 400);
    }
    const vessels = await getVesselsInArea(bounds, process.env.AIS_API_KEY);
    success(res, vessels);
  } catch (err) {
    console.error("Vessel tracking error:", err);
    error(res, err.message);
  }
});
app.post("/api/maritime/aircraft", async (req, res) => {
  try {
    const { bounds } = req.body;
    if (!bounds || !bounds.north || !bounds.south || !bounds.east || !bounds.west) {
      return error(res, "Bounding box (bounds) with north, south, east, west is required", 400);
    }
    const aircraft = await getAircraftInArea(bounds);
    success(res, aircraft);
  } catch (err) {
    console.error("Aircraft tracking error:", err);
    error(res, err.message);
  }
});
app.post("/api/maritime/correlate/:imageId", async (req, res) => {
  try {
    const { imageId } = req.params;
    const result = await pool.query("SELECT * FROM images WHERE id = $1", [imageId]);
    const image = rowToImage(result.rows[0]);
    if (!image) {
      return error(res, "Image not found", 404);
    }
    if (!image.bounds) {
      return error(res, "Image has no bounds data", 400);
    }
    const correlation = await correlateAssetsWithImage(imageId, image.bounds, image.capturedAt || (/* @__PURE__ */ new Date()).toISOString(), process.env.AIS_API_KEY);
    success(res, correlation);
  } catch (err) {
    console.error("Asset correlation error:", err);
    error(res, err.message);
  }
});
app.post("/api/maritime/all", async (req, res) => {
  try {
    const { bounds } = req.body;
    if (!bounds || !bounds.north || !bounds.south || !bounds.east || !bounds.west) {
      return error(res, "Bounding box (bounds) with north, south, east, west is required", 400);
    }
    const [vessels, aircraft] = await Promise.all([
      getVesselsInArea(bounds, process.env.AIS_API_KEY),
      getAircraftInArea(bounds)
    ]);
    success(res, {
      vessels,
      aircraft,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      bounds
    });
  } catch (err) {
    console.error("Asset tracking error:", err);
    error(res, err.message);
  }
});
app.get("/api/health", (req, res) => {
  success(res, { status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  error(res, "Internal server error");
});
if (process.env.NODE_ENV === "production") {
  const frontendPath = path3.join(__dirname, "../../frontend/dist");
  app.use(express.static(frontendPath));
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api") && !req.path.startsWith("/files")) {
      res.sendFile(path3.join(frontendPath, "index.html"));
    }
  });
  console.log(`Serving frontend from: ${frontendPath}`);
}
async function start() {
  try {
    await ensureStorageDir();
    console.log(`Storage directory: ${STORAGE_DIR}`);
    try {
      await initializeDatabase();
      console.log("Database initialized successfully");
    } catch (dbErr) {
      console.error("Database initialization failed (server will continue):", dbErr);
    }
    app.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`API available at http://localhost:${PORT}/api`);
      if (BASE_PATH) {
        console.log(`Base path: ${BASE_PATH}`);
      }
      if (process.env.NODE_ENV === "production") {
        console.log(`Frontend served at http://localhost:${PORT}`);
      }
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}
start();
