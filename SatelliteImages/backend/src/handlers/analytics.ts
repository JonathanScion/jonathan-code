import { APIGatewayProxyHandler } from 'aws-lambda';
import { scanItems, TABLES } from '../lib/dynamodb';
import { success, error } from '../lib/response';
import type { UserStatistics, SatelliteImage } from '@shared/types';

export const getStatistics: APIGatewayProxyHandler = async () => {
  try {
    const images = await scanItems(TABLES.IMAGES) as SatelliteImage[];

    // Calculate statistics
    const totalImages = images.length;
    const totalStorage = images.reduce((sum, img) => sum + img.fileSize, 0);

    // Calculate coverage area (sum of all bounding boxes)
    const coverageArea = images.reduce((sum, img) => {
      if (!img.bounds) return sum;
      const latDiff = Math.abs(img.bounds.north - img.bounds.south);
      const lonDiff = Math.abs(img.bounds.east - img.bounds.west);
      const area = latDiff * lonDiff * 111 * 111; // Approximate km²
      return sum + area;
    }, 0);

    // Uploads by month
    const uploadsByMonth: { [month: string]: number } = {};
    images.forEach(img => {
      const month = new Date(img.uploadedAt).toISOString().slice(0, 7); // YYYY-MM
      uploadsByMonth[month] = (uploadsByMonth[month] || 0) + 1;
    });

    // Images by tag
    const imagesByTag: { [tag: string]: number } = {};
    images.forEach(img => {
      if (img.tags) {
        img.tags.forEach(tag => {
          imagesByTag[tag] = (imagesByTag[tag] || 0) + 1;
        });
      }
    });

    // Images by satellite
    const imagesBySatellite: { [satellite: string]: number } = {};
    images.forEach(img => {
      if (img.satelliteName) {
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

    return success(statistics);
  } catch (err: any) {
    console.error('Error getting statistics:', err);
    return error(err.message);
  }
};
