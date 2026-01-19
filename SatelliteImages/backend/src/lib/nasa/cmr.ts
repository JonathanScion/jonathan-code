/**
 * NASA CMR (Common Metadata Repository) API Client
 * Search for satellite imagery by location and date
 * No API key required
 */

import axios from 'axios';

const CMR_BASE_URL = 'https://cmr.earthdata.nasa.gov/search';

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface CMRSearchParams {
  bbox: BoundingBox;
  startDate?: string; // ISO date
  endDate?: string;   // ISO date
  satellite?: string; // e.g., 'LANDSAT_8', 'MODIS', 'SENTINEL-2'
  pageSize?: number;
  page?: number;
}

export interface CMRGranule {
  id: string;
  title: string;
  collectionId: string;
  satellite: string;
  sensor: string;
  startDate: string;
  endDate: string;
  bbox: BoundingBox;
  browseUrl?: string;
  downloadUrl?: string;
  cloudCover?: number;
  size?: number;
}

export interface CMRSearchResult {
  granules: CMRGranule[];
  total: number;
  page: number;
  pageSize: number;
}

// Common collection concept IDs for major satellites
const COLLECTION_IDS: Record<string, string[]> = {
  LANDSAT_8: ['C2021957657-LPCLOUD', 'C1711961296-LPCLOUD'],
  LANDSAT_9: ['C2021957295-LPCLOUD'],
  MODIS_TERRA: ['C1711961296-LPCLOUD', 'C194001210-LPDAAC_ECS'],
  MODIS_AQUA: ['C194001241-LPDAAC_ECS'],
  SENTINEL_2: ['C1711924822-LPCLOUD'],
  VIIRS: ['C1711961296-LPCLOUD'],
};

/**
 * Search NASA CMR for satellite imagery granules
 */
export async function searchCMR(params: CMRSearchParams): Promise<CMRSearchResult> {
  const { bbox, startDate, endDate, satellite, pageSize = 20, page = 1 } = params;

  // Build bounding box string: west,south,east,north
  const bboxStr = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;

  // Build query parameters
  const queryParams: Record<string, string> = {
    bounding_box: bboxStr,
    page_size: pageSize.toString(),
    page_num: page.toString(),
    sort_key: '-start_date', // Newest first
  };

  // Add temporal range if provided
  if (startDate || endDate) {
    // CMR expects ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ
    const formatDate = (d: string) => {
      const date = new Date(d);
      return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
    };
    const start = startDate ? formatDate(startDate) : '2000-01-01T00:00:00Z';
    const end = endDate ? formatDate(endDate) : formatDate(new Date().toISOString());
    queryParams.temporal = `${start},${end}`;
  }

  // CMR requires collection filtering - can't search all collections at once
  // Use specified satellite collections or default to common ones
  let collectionIds: string[];
  if (satellite && COLLECTION_IDS[satellite]) {
    collectionIds = COLLECTION_IDS[satellite];
  } else {
    // Default: search Landsat 8/9, Sentinel-2, and MODIS
    collectionIds = [
      ...COLLECTION_IDS.LANDSAT_8,
      ...COLLECTION_IDS.LANDSAT_9,
      ...COLLECTION_IDS.SENTINEL_2,
    ];
  }

  try {
    const params: Record<string, any> = {
      ...queryParams,
      collection_concept_id: collectionIds,
    };

    const response = await axios.get(`${CMR_BASE_URL}/granules.json`, {
      params,
      paramsSerializer: {
        indexes: null, // Serialize arrays as repeated params: ?key=val1&key=val2
      },
      headers: {
        Accept: 'application/json',
      },
    });

    const data = response.data;
    const feed = data.feed || {};
    const entries = feed.entry || [];
    const total = parseInt(feed.hits || '0', 10);

    const granules: CMRGranule[] = entries.map((entry: any) => {
      // Parse bounding box from polygons or boxes
      let granuleBbox: BoundingBox = bbox;
      if (entry.boxes && entry.boxes.length > 0) {
        const box = entry.boxes[0].split(' ').map(Number);
        granuleBbox = {
          south: box[0],
          west: box[1],
          north: box[2],
          east: box[3],
        };
      }

      // Find browse and download URLs
      const links = entry.links || [];
      const browseLink = links.find((l: any) => l.rel?.includes('browse') || l.title?.includes('Browse'));
      const downloadLink = links.find((l: any) => l.rel?.includes('data') || l.href?.includes('download'));

      return {
        id: entry.id,
        title: entry.title,
        collectionId: entry.collection_concept_id,
        satellite: extractSatellite(entry.title, entry.collection_concept_id),
        sensor: entry.platforms?.[0]?.instruments?.[0]?.short_name || 'Unknown',
        startDate: entry.time_start,
        endDate: entry.time_end,
        bbox: granuleBbox,
        browseUrl: browseLink?.href,
        downloadUrl: downloadLink?.href,
        cloudCover: entry.cloud_cover ? parseFloat(entry.cloud_cover) : undefined,
        size: entry.granule_size ? parseFloat(entry.granule_size) : undefined,
      };
    });

    return {
      granules,
      total,
      page,
      pageSize,
    };
  } catch (error: any) {
    const errorDetails = error.response?.data?.errors || error.response?.data || error.message;
    console.error('CMR search error:', errorDetails);
    throw new Error(`CMR search failed: ${JSON.stringify(errorDetails)}`);
  }
}

/**
 * Get available satellites/collections for a location
 */
export async function getAvailableCollections(bbox: BoundingBox): Promise<string[]> {
  try {
    const bboxStr = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;

    const response = await axios.get(`${CMR_BASE_URL}/collections.json`, {
      params: {
        bounding_box: bboxStr,
        has_granules: 'true',
        page_size: 50,
        include_facets: 'v2',
      },
      headers: {
        Accept: 'application/json',
      },
    });

    const entries = response.data.feed?.entry || [];
    return entries.map((e: any) => e.short_name || e.title).filter(Boolean);
  } catch (error: any) {
    console.error('CMR collections error:', error.message);
    return [];
  }
}

function extractSatellite(title: string, collectionId: string): string {
  const titleLower = title.toLowerCase();
  if (titleLower.includes('landsat 9') || collectionId.includes('L9')) return 'Landsat 9';
  if (titleLower.includes('landsat 8') || collectionId.includes('L8')) return 'Landsat 8';
  if (titleLower.includes('sentinel-2') || titleLower.includes('sentinel2')) return 'Sentinel-2';
  if (titleLower.includes('modis') && titleLower.includes('terra')) return 'MODIS Terra';
  if (titleLower.includes('modis') && titleLower.includes('aqua')) return 'MODIS Aqua';
  if (titleLower.includes('viirs')) return 'VIIRS';
  if (titleLower.includes('modis')) return 'MODIS';
  return 'Unknown';
}
