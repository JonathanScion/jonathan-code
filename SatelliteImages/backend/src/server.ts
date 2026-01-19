import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool, initializeDatabase, rowToImage, rowToCollection, rowToRequest } from './lib/database';
import { STORAGE_DIR, ensureStorageDir, getDownloadUrl, deleteFile, generateUploadPath, getFilePath } from './lib/storage';
import {
  searchCMR,
  getGIBSLayers,
  getGIBSTileUrl,
  getLeafletLayerConfig,
  getFireData,
  hasRecentFires,
  calculateFireRisk,
  getWeatherData,
  getWeatherForDate,
  getSatellitePasses,
  enrichImageWithNasaData,
} from './lib/nasa';
import { analyzeImage, detectDisasters, classifyLandUse, detectChanges } from './lib/analysis/claude-analysis';
import {
  getRecentEarthquakes,
  getEarthquakesInBbox,
  getEarthquakeStats,
  getActiveAlerts,
  getFloodAlerts,
  getCycloneAlerts,
  getDisasterSummary,
  getAllHazards,
} from './lib/disasters';
import { generateTimeline, generateIntelReport } from './lib/fusion';
import type { SatelliteImage, Collection, SearchFilters, SearchResult, UserStatistics, ImagingRequest } from '@shared/types';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use('/files', express.static(STORAGE_DIR));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Extract imageId from URL path (e.g., /api/images/:id/upload)
    const urlParts = req.originalUrl.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    const imageId = uploadIndex > 0 ? urlParts[uploadIndex - 1] : uuidv4();

    const uploadDir = path.join(STORAGE_DIR, 'images', imageId);
    const fs = await import('fs');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

// Response helpers
function success<T>(res: Response, data: T, statusCode = 200) {
  res.status(statusCode).json({ success: true, data });
}

function error(res: Response, message: string, statusCode = 500) {
  res.status(statusCode).json({ success: false, error: message });
}

// ============ IMAGE ROUTES ============

// Request upload (creates record, returns upload endpoint)
app.post('/api/images/upload-url', async (req: Request, res: Response) => {
  try {
    const { filename, contentType, fileSize, ...metadata } = req.body;

    const imageId = uuidv4();
    const filePath = generateUploadPath(imageId, filename);

    // Insert initial record
    await pool.query(
      `INSERT INTO images (
        id, user_id, filename, original_filename, file_path, file_size, status,
        center_lat, center_lon, bounds_north, bounds_south, bounds_east, bounds_west,
        width, height, bands, bit_depth, resolution, captured_at,
        satellite_name, sensor_type, projection, cloud_coverage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
      [
        imageId,
        'demo-user', // In production, get from auth
        filePath,
        filename,
        filePath,
        fileSize,
        'UPLOADING',
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
        metadata.cloudCoverage ?? null,
      ]
    );

    // Return upload URL - client will POST the file here
    success(res, {
      uploadUrl: `/api/images/${imageId}/upload`,
      imageId,
      s3Key: filePath, // Keep for frontend compatibility
    });
  } catch (err: any) {
    console.error('Error generating upload URL:', err);
    error(res, err.message);
  }
});

// Actual file upload endpoint
app.post('/api/images/:id/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const imageId = req.params.id;

    if (!req.file) {
      return error(res, 'No file uploaded', 400);
    }

    // Update file path in database
    const filePath = generateUploadPath(imageId, req.file.originalname);
    await pool.query(
      `UPDATE images SET file_path = $1, file_size = $2 WHERE id = $3`,
      [filePath, req.file.size, imageId]
    );

    success(res, { message: 'File uploaded successfully', imageId });
  } catch (err: any) {
    console.error('Error uploading file:', err);
    error(res, err.message);
  }
});

// Confirm upload (finalize and set READY status)
app.post('/api/images/:id/confirm', async (req: Request, res: Response) => {
  try {
    const imageId = req.params.id;

    const result = await pool.query('SELECT * FROM images WHERE id = $1', [imageId]);
    const image = rowToImage(result.rows[0]);

    if (!image) {
      return error(res, 'Image not found', 404);
    }

    // Prepare updates
    const updates: any = { status: 'READY' };

    if (!image.satelliteName) {
      updates.satellite_name = 'Unknown';
    }

    if (!image.capturedAt) {
      updates.captured_at = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    }

    if (image.cloudCoverage === undefined || image.cloudCoverage === null) {
      updates.cloud_coverage = Math.floor(Math.random() * 30);
    }

    if (!image.centerPoint || !image.bounds) {
      // Demo coordinates for Cyprus region
      updates.center_lat = 34.77 + (Math.random() - 0.5) * 0.5;
      updates.center_lon = 32.87 + (Math.random() - 0.5) * 0.5;
      updates.bounds_north = 35.0 + (Math.random() - 0.5) * 0.2;
      updates.bounds_south = 34.5 + (Math.random() - 0.5) * 0.2;
      updates.bounds_east = 33.1 + (Math.random() - 0.5) * 0.2;
      updates.bounds_west = 32.6 + (Math.random() - 0.5) * 0.2;
    }

    // Build dynamic UPDATE query
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
    values.push(imageId);

    await pool.query(
      `UPDATE images SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    const updatedResult = await pool.query('SELECT * FROM images WHERE id = $1', [imageId]);
    const finalImage = rowToImage(updatedResult.rows[0]);

    // Trigger auto-enrichment in background (don't await)
    if (finalImage?.centerPoint) {
      const captureDate = finalImage.capturedAt?.split('T')[0] || new Date().toISOString().split('T')[0];
      enrichImageWithNasaData(
        finalImage.centerPoint.lat,
        finalImage.centerPoint.lon,
        captureDate,
        process.env.NASA_FIRMS_API_KEY,
        process.env.N2YO_API_KEY
      )
        .then(enrichment => {
          pool.query(
            'UPDATE images SET nasa_enrichment = $1 WHERE id = $2',
            [JSON.stringify(enrichment), imageId]
          ).catch(err => console.error('Failed to save enrichment:', err));
          console.log(`Auto-enrichment completed for image ${imageId}`);
        })
        .catch(err => {
          console.warn(`Auto-enrichment failed for image ${imageId}:`, err.message);
        });
    }

    success(res, finalImage);
  } catch (err: any) {
    console.error('Error confirming upload:', err);
    error(res, err.message);
  }
});

// Search images
app.post('/api/images/search', async (req: Request, res: Response) => {
  try {
    const { filters = {}, page = 1, pageSize = 20 } = req.body;
    const searchFilters: SearchFilters = filters;

    // Build WHERE clause
    const conditions: string[] = ['1=1'];
    const values: any[] = [];
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

    if (searchFilters.cloudCoverageMax !== undefined) {
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

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM images WHERE ${conditions.join(' AND ')}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const offset = (page - 1) * pageSize;
    values.push(pageSize, offset);

    const result = await pool.query(
      `SELECT * FROM images WHERE ${conditions.join(' AND ')}
       ORDER BY uploaded_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      values
    );

    const images = result.rows.map((row: any) => {
      const img = rowToImage(row);
      // Add preview URL
      if (img) {
        img.previewUrl = getDownloadUrl(img.thumbnailUrl || img.filePath || img.s3Key);
      }
      return img;
    });

    const searchResult: SearchResult = {
      images,
      total,
      page,
      pageSize,
    };

    success(res, searchResult);
  } catch (err: any) {
    console.error('Error searching images:', err);
    error(res, err.message);
  }
});

// Get single image
app.get('/api/images/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM images WHERE id = $1', [req.params.id]);
    const image = rowToImage(result.rows[0]);

    if (!image) {
      return error(res, 'Image not found', 404);
    }

    // Add preview URL
    image.previewUrl = getDownloadUrl(image.thumbnailUrl || image.filePath || image.s3Key);

    success(res, image);
  } catch (err: any) {
    console.error('Error getting image:', err);
    error(res, err.message);
  }
});

// Update image
app.patch('/api/images/:id', async (req: Request, res: Response) => {
  try {
    const allowedFields = ['title', 'description', 'tags'];
    const updates = req.body;

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return error(res, 'No valid fields to update', 400);
    }

    values.push(req.params.id);

    await pool.query(
      `UPDATE images SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    const result = await pool.query('SELECT * FROM images WHERE id = $1', [req.params.id]);
    success(res, rowToImage(result.rows[0]));
  } catch (err: any) {
    console.error('Error updating image:', err);
    error(res, err.message);
  }
});

// Delete image
app.delete('/api/images/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM images WHERE id = $1', [req.params.id]);
    const image = rowToImage(result.rows[0]);

    if (!image) {
      return error(res, 'Image not found', 404);
    }

    // Delete file from storage
    await deleteFile(image.filePath || image.s3Key);

    // Delete from database
    await pool.query('DELETE FROM images WHERE id = $1', [req.params.id]);

    success(res, { message: 'Image deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting image:', err);
    error(res, err.message);
  }
});

// ============ ANALYTICS ROUTES ============

app.get('/api/analytics/statistics', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM images');
    const images = result.rows.map(rowToImage);

    const totalImages = images.length;
    const totalStorage = images.reduce((sum, img) => sum + (img?.fileSize || 0), 0);

    // Calculate coverage area
    const coverageArea = images.reduce((sum, img) => {
      if (!img?.bounds) return sum;
      const latDiff = Math.abs(img.bounds.north - img.bounds.south);
      const lonDiff = Math.abs(img.bounds.east - img.bounds.west);
      const area = latDiff * lonDiff * 111 * 111; // Approximate km²
      return sum + area;
    }, 0);

    // Uploads by month
    const uploadsByMonth: { [month: string]: number } = {};
    images.forEach(img => {
      if (img?.uploadedAt) {
        const month = img.uploadedAt.slice(0, 7);
        uploadsByMonth[month] = (uploadsByMonth[month] || 0) + 1;
      }
    });

    // Images by tag
    const imagesByTag: { [tag: string]: number } = {};
    images.forEach(img => {
      if (img?.tags) {
        img.tags.forEach(tag => {
          imagesByTag[tag] = (imagesByTag[tag] || 0) + 1;
        });
      }
    });

    // Images by satellite
    const imagesBySatellite: { [satellite: string]: number } = {};
    images.forEach(img => {
      if (img?.satelliteName) {
        imagesBySatellite[img.satelliteName] = (imagesBySatellite[img.satelliteName] || 0) + 1;
      }
    });

    const statistics: UserStatistics = {
      totalImages,
      totalStorage,
      coverageArea,
      uploadsByMonth,
      imagesByTag,
      imagesBySatellite,
    };

    success(res, statistics);
  } catch (err: any) {
    console.error('Error getting statistics:', err);
    error(res, err.message);
  }
});

// ============ COLLECTION ROUTES ============

app.get('/api/collections', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM collections ORDER BY created_at DESC');
    success(res, result.rows.map(rowToCollection));
  } catch (err: any) {
    console.error('Error getting collections:', err);
    error(res, err.message);
  }
});

app.get('/api/collections/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM collections WHERE id = $1', [req.params.id]);
    const collection = rowToCollection(result.rows[0]);

    if (!collection) {
      return error(res, 'Collection not found', 404);
    }

    success(res, collection);
  } catch (err: any) {
    console.error('Error getting collection:', err);
    error(res, err.message);
  }
});

app.post('/api/collections', async (req: Request, res: Response) => {
  try {
    const { name, description, imageIds = [], isPublic = false } = req.body;
    const id = uuidv4();

    await pool.query(
      `INSERT INTO collections (id, user_id, name, description, image_ids, is_public)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, 'demo-user', name, description, imageIds, isPublic]
    );

    const result = await pool.query('SELECT * FROM collections WHERE id = $1', [id]);
    success(res, rowToCollection(result.rows[0]));
  } catch (err: any) {
    console.error('Error creating collection:', err);
    error(res, err.message);
  }
});

app.patch('/api/collections/:id', async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = ['name', 'description', 'image_ids', 'is_public'];
    const fieldMap: { [key: string]: string } = {
      name: 'name',
      description: 'description',
      imageIds: 'image_ids',
      isPublic: 'is_public',
    };

    for (const [jsKey, dbKey] of Object.entries(fieldMap)) {
      if (updates[jsKey] !== undefined) {
        setClauses.push(`${dbKey} = $${paramIndex}`);
        values.push(updates[jsKey]);
        paramIndex++;
      }
    }

    values.push(req.params.id);

    await pool.query(
      `UPDATE collections SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    const result = await pool.query('SELECT * FROM collections WHERE id = $1', [req.params.id]);
    success(res, rowToCollection(result.rows[0]));
  } catch (err: any) {
    console.error('Error updating collection:', err);
    error(res, err.message);
  }
});

app.delete('/api/collections/:id', async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM collections WHERE id = $1', [req.params.id]);
    success(res, { message: 'Collection deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting collection:', err);
    error(res, err.message);
  }
});

app.post('/api/collections/:id/images', async (req: Request, res: Response) => {
  try {
    const { imageIds } = req.body;

    const result = await pool.query('SELECT * FROM collections WHERE id = $1', [req.params.id]);
    const collection = rowToCollection(result.rows[0]);

    if (!collection) {
      return error(res, 'Collection not found', 404);
    }

    const updatedImageIds = [...new Set([...collection.imageIds, ...imageIds])];

    await pool.query(
      `UPDATE collections SET image_ids = $1, updated_at = NOW() WHERE id = $2`,
      [updatedImageIds, req.params.id]
    );

    const updatedResult = await pool.query('SELECT * FROM collections WHERE id = $1', [req.params.id]);
    success(res, rowToCollection(updatedResult.rows[0]));
  } catch (err: any) {
    console.error('Error adding images to collection:', err);
    error(res, err.message);
  }
});

// ============ NASA INTEGRATION ROUTES ============

// Search NASA CMR for satellite imagery at a location
app.post('/api/nasa/coverage', async (req: Request, res: Response) => {
  try {
    const { bbox, startDate, endDate, satellite, pageSize = 20, page = 1 } = req.body;

    if (!bbox || !bbox.north || !bbox.south || !bbox.east || !bbox.west) {
      return error(res, 'Bounding box (bbox) with north, south, east, west is required', 400);
    }

    const result = await searchCMR({
      bbox,
      startDate,
      endDate,
      satellite,
      pageSize,
      page,
    });

    success(res, result);
  } catch (err: any) {
    console.error('Error searching NASA coverage:', err);
    error(res, err.message);
  }
});

// Get available GIBS layers
app.get('/api/nasa/gibs/layers', (req: Request, res: Response) => {
  try {
    const layers = getGIBSLayers();
    success(res, layers);
  } catch (err: any) {
    console.error('Error getting GIBS layers:', err);
    error(res, err.message);
  }
});

// Get GIBS tile URL for a specific layer and date
app.get('/api/nasa/gibs/tile-url', (req: Request, res: Response) => {
  try {
    const { layerId, date } = req.query;

    if (!layerId) {
      return error(res, 'layerId is required', 400);
    }

    const config = getLeafletLayerConfig(layerId as string, date as string | undefined);
    success(res, config);
  } catch (err: any) {
    console.error('Error getting GIBS tile URL:', err);
    error(res, err.message);
  }
});

// Get fire data from NASA FIRMS
app.post('/api/nasa/fires', async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.NASA_FIRMS_API_KEY;
    if (!apiKey) {
      return error(res, 'NASA FIRMS API key not configured', 503);
    }

    const { bbox, days = 1, source = 'VIIRS_NOAA20_NRT' } = req.body;

    if (!bbox || !bbox.north || !bbox.south || !bbox.east || !bbox.west) {
      return error(res, 'Bounding box (bbox) with north, south, east, west is required', 400);
    }

    const result = await getFireData(apiKey, bbox, days, source);
    success(res, result);
  } catch (err: any) {
    console.error('Error getting fire data:', err);
    error(res, err.message);
  }
});

// Get weather data from NASA POWER
app.post('/api/nasa/weather', async (req: Request, res: Response) => {
  try {
    const { lat, lon, startDate, endDate } = req.body;

    if (lat === undefined || lon === undefined) {
      return error(res, 'lat and lon are required', 400);
    }

    const result = await getWeatherData(lat, lon, startDate, endDate);
    success(res, result);
  } catch (err: any) {
    console.error('Error getting weather data:', err);
    error(res, err.message);
  }
});

// Get satellite pass predictions
app.post('/api/nasa/satellites/passes', async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.N2YO_API_KEY;
    if (!apiKey) {
      return error(res, 'N2YO API key not configured', 503);
    }

    const { lat, lon, alt = 0, satellites, days = 5 } = req.body;

    if (lat === undefined || lon === undefined) {
      return error(res, 'lat and lon are required', 400);
    }

    const result = await getSatellitePasses(apiKey, lat, lon, alt, satellites, days);
    success(res, result);
  } catch (err: any) {
    console.error('Error getting satellite passes:', err);
    error(res, err.message);
  }
});

// Enrich an image with NASA data
app.post('/api/nasa/enrich/:imageId', async (req: Request, res: Response) => {
  try {
    const { imageId } = req.params;

    // Get image from database
    const result = await pool.query('SELECT * FROM images WHERE id = $1', [imageId]);
    const image = rowToImage(result.rows[0]);

    if (!image) {
      return error(res, 'Image not found', 404);
    }

    if (!image.centerPoint) {
      return error(res, 'Image has no location data', 400);
    }

    const captureDate = image.capturedAt?.split('T')[0] || new Date().toISOString().split('T')[0];

    const enrichment = await enrichImageWithNasaData(
      image.centerPoint.lat,
      image.centerPoint.lon,
      captureDate,
      process.env.NASA_FIRMS_API_KEY,
      process.env.N2YO_API_KEY
    );

    // Store enrichment in database
    await pool.query(
      'UPDATE images SET nasa_enrichment = $1 WHERE id = $2',
      [JSON.stringify(enrichment), imageId]
    );

    success(res, enrichment);
  } catch (err: any) {
    console.error('Error enriching image:', err);
    error(res, err.message);
  }
});

// ============ AI ANALYSIS ROUTES ============

// Analyze an image using Claude AI
app.post('/api/ai/analyze/:imageId', async (req: Request, res: Response) => {
  try {
    const { imageId } = req.params;
    const { analysisType = 'general' } = req.body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return error(res, 'AI analysis not configured (ANTHROPIC_API_KEY missing)', 503);
    }

    // Get image from database
    const result = await pool.query('SELECT * FROM images WHERE id = $1', [imageId]);
    const image = rowToImage(result.rows[0]);

    if (!image) {
      return error(res, 'Image not found', 404);
    }

    // Get the actual file path
    const filePath = getFilePath(image.filePath || image.s3Key);

    if (!filePath) {
      return error(res, 'Image file path not available', 400);
    }

    // Run AI analysis
    const analysisResult = await analyzeImage(filePath, analysisType);

    // Store analysis result in database
    await pool.query(
      'UPDATE images SET analysis = $1 WHERE id = $2',
      [JSON.stringify(analysisResult), imageId]
    );

    success(res, analysisResult);
  } catch (err: any) {
    console.error('Error analyzing image:', err);
    error(res, err.message);
  }
});

// Change detection between two images
app.post('/api/ai/compare', async (req: Request, res: Response) => {
  try {
    const { imageId1, imageId2 } = req.body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return error(res, 'AI analysis not configured (ANTHROPIC_API_KEY missing)', 503);
    }

    if (!imageId1 || !imageId2) {
      return error(res, 'Both imageId1 and imageId2 are required', 400);
    }

    // Get both images from database
    const [result1, result2] = await Promise.all([
      pool.query('SELECT * FROM images WHERE id = $1', [imageId1]),
      pool.query('SELECT * FROM images WHERE id = $1', [imageId2]),
    ]);

    const image1 = rowToImage(result1.rows[0]);
    const image2 = rowToImage(result2.rows[0]);

    if (!image1 || !image2) {
      return error(res, 'One or both images not found', 404);
    }

    const filePath1 = getFilePath(image1.filePath || image1.s3Key);
    const filePath2 = getFilePath(image2.filePath || image2.s3Key);

    if (!filePath1 || !filePath2) {
      return error(res, 'Image file paths not available', 400);
    }

    // Run change detection
    const changeResult = await detectChanges(filePath1, filePath2, {
      date1: image1.capturedAt?.split('T')[0],
      date2: image2.capturedAt?.split('T')[0],
    });

    success(res, changeResult);
  } catch (err: any) {
    console.error('Error comparing images:', err);
    error(res, err.message);
  }
});

// ============ DISASTER MONITORING ROUTES ============

// Get disaster summary (global stats)
app.get('/api/disasters/summary', async (req: Request, res: Response) => {
  try {
    // Get fire count from FIRMS if API key available
    let fireCount = 0;
    if (process.env.NASA_FIRMS_API_KEY) {
      try {
        const fireData = await getFireData(process.env.NASA_FIRMS_API_KEY, {
          north: 90, south: -90, east: 180, west: -180
        }, 1, 'VIIRS_NOAA20_NRT');
        fireCount = fireData.total;
      } catch {
        // Ignore fire fetch errors for summary
      }
    }

    const summary = await getDisasterSummary(fireCount);
    success(res, summary);
  } catch (err: any) {
    console.error('Error getting disaster summary:', err);
    error(res, err.message);
  }
});

// Get recent earthquakes
app.get('/api/disasters/earthquakes', async (req: Request, res: Response) => {
  try {
    const { minMagnitude = '2.5', days = '7', limit = '100' } = req.query;
    const earthquakes = await getRecentEarthquakes(
      parseFloat(minMagnitude as string),
      parseInt(days as string),
      parseInt(limit as string)
    );
    success(res, earthquakes);
  } catch (err: any) {
    console.error('Error getting earthquakes:', err);
    error(res, err.message);
  }
});

// Get earthquakes in a bounding box
app.post('/api/disasters/earthquakes/bbox', async (req: Request, res: Response) => {
  try {
    const { bbox, days = 7, minMagnitude = 2.5, limit = 100 } = req.body;

    if (!bbox || !bbox.north || !bbox.south || !bbox.east || !bbox.west) {
      return error(res, 'Bounding box (bbox) with north, south, east, west is required', 400);
    }

    const earthquakes = await getEarthquakesInBbox(bbox, days, minMagnitude, limit);
    success(res, earthquakes);
  } catch (err: any) {
    console.error('Error getting earthquakes in bbox:', err);
    error(res, err.message);
  }
});

// Get earthquake statistics
app.get('/api/disasters/earthquakes/stats', async (req: Request, res: Response) => {
  try {
    const { days = '7' } = req.query;
    const stats = await getEarthquakeStats(parseInt(days as string));
    success(res, stats);
  } catch (err: any) {
    console.error('Error getting earthquake stats:', err);
    error(res, err.message);
  }
});

// Get flood alerts from GDACS
app.get('/api/disasters/floods', async (req: Request, res: Response) => {
  try {
    const { limit = '50' } = req.query;
    const floods = await getFloodAlerts(parseInt(limit as string));
    success(res, floods);
  } catch (err: any) {
    console.error('Error getting flood alerts:', err);
    error(res, err.message);
  }
});

// Get active storms/cyclones from GDACS
app.get('/api/disasters/storms', async (req: Request, res: Response) => {
  try {
    const { limit = '50' } = req.query;
    const storms = await getCycloneAlerts(parseInt(limit as string));
    success(res, storms);
  } catch (err: any) {
    console.error('Error getting storm alerts:', err);
    error(res, err.message);
  }
});

// Get all active GDACS alerts
app.get('/api/disasters/alerts', async (req: Request, res: Response) => {
  try {
    const { limit = '100' } = req.query;
    const alerts = await getActiveAlerts(parseInt(limit as string));
    success(res, alerts);
  } catch (err: any) {
    console.error('Error getting GDACS alerts:', err);
    error(res, err.message);
  }
});

// Get all hazards combined for map display
app.get('/api/disasters/all', async (req: Request, res: Response) => {
  try {
    const { minMagnitude = '2.5', days = '7' } = req.query;
    const hazards = await getAllHazards({
      minMagnitude: parseFloat(minMagnitude as string),
      days: parseInt(days as string),
    });
    success(res, hazards);
  } catch (err: any) {
    console.error('Error getting all hazards:', err);
    error(res, err.message);
  }
});

// ============ MULTI-SENSOR FUSION ROUTES ============

// Generate timeline for a location
app.post('/api/fusion/timeline', async (req: Request, res: Response) => {
  try {
    const { lat, lon, startDate, endDate, sources } = req.body;

    if (lat === undefined || lon === undefined) {
      return error(res, 'lat and lon are required', 400);
    }

    // Default date range: last 30 days
    const end = endDate || new Date().toISOString().split('T')[0];
    const startObj = new Date(end);
    startObj.setDate(startObj.getDate() - 30);
    const start = startDate || startObj.toISOString().split('T')[0];

    const timeline = await generateTimeline(lat, lon, start, end, sources, {
      firmsApiKey: process.env.NASA_FIRMS_API_KEY,
      n2yoApiKey: process.env.N2YO_API_KEY,
    });

    success(res, timeline);
  } catch (err: any) {
    console.error('Error generating timeline:', err);
    error(res, err.message);
  }
});

// Generate intelligence report for an image
app.post('/api/fusion/report/:imageId', async (req: Request, res: Response) => {
  try {
    const { imageId } = req.params;

    // Get image from database
    const result = await pool.query('SELECT * FROM images WHERE id = $1', [imageId]);
    const image = rowToImage(result.rows[0]);

    if (!image) {
      return error(res, 'Image not found', 404);
    }

    if (!image.centerPoint) {
      return error(res, 'Image has no location data', 400);
    }

    const report = await generateIntelReport(
      image.centerPoint.lat,
      image.centerPoint.lon,
      image.capturedAt,
      {
        firmsApiKey: process.env.NASA_FIRMS_API_KEY,
        n2yoApiKey: process.env.N2YO_API_KEY,
      }
    );

    success(res, report);
  } catch (err: any) {
    console.error('Error generating intel report:', err);
    error(res, err.message);
  }
});

// Generate intelligence report for a location (not tied to image)
app.post('/api/fusion/report', async (req: Request, res: Response) => {
  try {
    const { lat, lon, date } = req.body;

    if (lat === undefined || lon === undefined) {
      return error(res, 'lat and lon are required', 400);
    }

    const report = await generateIntelReport(lat, lon, date, {
      firmsApiKey: process.env.NASA_FIRMS_API_KEY,
      n2yoApiKey: process.env.N2YO_API_KEY,
    });

    success(res, report);
  } catch (err: any) {
    console.error('Error generating intel report:', err);
    error(res, err.message);
  }
});

// ============ HEALTH CHECK ============

app.get('/api/health', (req: Request, res: Response) => {
  success(res, { status: 'ok', timestamp: new Date().toISOString() });
});

// ============ ERROR HANDLER ============

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  error(res, 'Internal server error');
});

// ============ START SERVER ============

async function start() {
  try {
    // Initialize storage directory
    await ensureStorageDir();
    console.log(`Storage directory: ${STORAGE_DIR}`);

    // Initialize database
    await initializeDatabase();

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`API available at http://localhost:${PORT}/api`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
