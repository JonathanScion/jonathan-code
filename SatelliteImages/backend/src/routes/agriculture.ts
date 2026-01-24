/**
 * Agricultural Intelligence API Routes
 */

import { Router, Request, Response } from 'express';
import { analyzeAgriculture, classifyNDVI, getCropTypes } from '../lib/agriculture';

const router = Router();

/**
 * GET /api/agriculture/crop-types
 * Get available crop types for analysis
 */
router.get('/crop-types', (_req: Request, res: Response) => {
  try {
    const cropTypes = getCropTypes();
    res.json(cropTypes);
  } catch (error: any) {
    console.error('Error fetching crop types:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch crop types' });
  }
});

/**
 * POST /api/agriculture/analyze
 * Perform comprehensive agricultural analysis for a location
 *
 * Body: {
 *   lat: number,
 *   lon: number,
 *   ndviValue?: number,
 *   cropType?: string,
 *   historicalNDVI?: number[]
 * }
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { lat, lon, ndviValue, cropType, historicalNDVI } = req.body;

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return res.status(400).json({ error: 'lat and lon are required and must be numbers' });
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const analysis = await analyzeAgriculture(
      lat,
      lon,
      ndviValue,
      cropType || 'generic',
      historicalNDVI
    );

    res.json(analysis);
  } catch (error: any) {
    console.error('Agricultural analysis error:', error);
    res.status(500).json({ error: error.message || 'Failed to perform agricultural analysis' });
  }
});

/**
 * GET /api/agriculture/ndvi-classify
 * Classify an NDVI value
 *
 * Query: { value: number }
 */
router.get('/ndvi-classify', (req: Request, res: Response) => {
  try {
    const value = parseFloat(req.query.value as string);

    if (isNaN(value) || value < -1 || value > 1) {
      return res.status(400).json({ error: 'value must be a number between -1 and 1' });
    }

    const classification = classifyNDVI(value);
    res.json(classification);
  } catch (error: any) {
    console.error('NDVI classification error:', error);
    res.status(500).json({ error: error.message || 'Failed to classify NDVI' });
  }
});

/**
 * POST /api/agriculture/compare-seasons
 * Compare agricultural conditions across multiple dates
 *
 * Body: {
 *   lat: number,
 *   lon: number,
 *   dates: string[], // Array of ISO date strings
 *   cropType?: string
 * }
 */
router.post('/compare-seasons', async (req: Request, res: Response) => {
  try {
    const { lat, lon, dates, cropType } = req.body;

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    if (!Array.isArray(dates) || dates.length < 2) {
      return res.status(400).json({ error: 'At least 2 dates required for comparison' });
    }

    // Perform analysis for each date period
    const comparisons = await Promise.all(
      dates.map(async (date: string) => {
        const endDate = new Date(date);
        const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

        try {
          const analysis = await analyzeAgriculture(lat, lon, undefined, cropType || 'generic');
          return {
            date,
            period: {
              start: startDate.toISOString().split('T')[0],
              end: endDate.toISOString().split('T')[0],
            },
            cropHealth: analysis.cropHealth,
            droughtIndex: analysis.droughtIndex,
            weatherSummary: analysis.weatherSummary,
          };
        } catch (err) {
          return {
            date,
            error: 'Failed to analyze this period',
          };
        }
      })
    );

    // Calculate trends
    const validComparisons = comparisons.filter((c: any) => !c.error);
    const trend = validComparisons.length >= 2 ? {
      healthChange: (validComparisons[validComparisons.length - 1]?.cropHealth?.overall || 0) -
                    (validComparisons[0]?.cropHealth?.overall || 0),
      droughtTrend: validComparisons.map((c: any) => c.droughtIndex?.value),
    } : null;

    res.json({
      location: { lat, lon },
      cropType: cropType || 'generic',
      comparisons,
      trend,
    });
  } catch (error: any) {
    console.error('Seasonal comparison error:', error);
    res.status(500).json({ error: error.message || 'Failed to compare seasons' });
  }
});

export default router;
