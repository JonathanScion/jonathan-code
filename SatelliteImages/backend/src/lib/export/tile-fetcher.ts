/**
 * Parallel tile downloader with concurrency limiting and retries.
 */
import axios from 'axios';

export interface TileResult {
  x: number;
  y: number;
  buffer: Buffer | null;
}

interface FetchJob {
  url: string;
  x: number;
  y: number;
}

const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

/**
 * Fetch tiles in parallel with a concurrency limit.
 * Returns results ordered by row then column.
 */
export async function fetchTiles(
  jobs: FetchJob[],
  concurrency = 6
): Promise<TileResult[]> {
  const results: TileResult[] = [];
  let idx = 0;

  async function worker() {
    while (idx < jobs.length) {
      const job = jobs[idx++];
      const buf = await fetchWithRetry(job.url, MAX_RETRIES);
      results.push({ x: job.x, y: job.y, buffer: buf });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

async function fetchWithRetry(url: string, retries: number): Promise<Buffer | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: TIMEOUT_MS,
        headers: {
          'User-Agent': 'SatelliteImages-GeoTIFF-Export/1.0',
        },
      });
      return Buffer.from(resp.data);
    } catch (err) {
      if (attempt === retries) {
        // Return null for failed tiles – caller will fill with transparent/black
        return null;
      }
      // Brief pause before retry
      await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  return null;
}
