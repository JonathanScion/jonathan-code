import { APIGatewayProxyHandler } from 'aws-lambda';
import { getItem, updateItem, deleteItem, scanItems, TABLES } from '../lib/dynamodb';
import { deleteObject, getDownloadUrl } from '../lib/s3';
import { success, error } from '../lib/response';
import type { SearchFilters, SearchResult, SatelliteImage } from '@shared/types';

export const searchImages: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const filters: SearchFilters = body.filters || {};
    const page = body.page || 1;
    const pageSize = body.pageSize || 20;

    // Get all images (in production, use proper filtering and pagination)
    const allImages = await scanItems(TABLES.IMAGES) as SatelliteImage[];

    // Filter images
    let filteredImages = allImages.filter((img) => {
      // Text search on user-visible, meaningful fields only
      if (filters.query) {
        const query = filters.query.toLowerCase();
        const searchableText = [
          img.title,
          img.description,
          img.satelliteName,
          img.sensorType,
          img.tags?.join(' '),
          img.cloudCoverage?.toString(),
          img.centerPoint?.lat?.toString(),
          img.centerPoint?.lon?.toString(),
          img.capturedAt, // Search on capture date, NOT upload date
        ]
          .filter(Boolean) // Remove undefined/null values
          .join(' ')
          .toLowerCase();

        if (!searchableText.includes(query)) {
          return false;
        }
      }

      if (filters.dateFrom && img.capturedAt && img.capturedAt < filters.dateFrom) {
        return false;
      }

      if (filters.dateTo && img.capturedAt && img.capturedAt > filters.dateTo) {
        return false;
      }

      if (filters.cloudCoverageMax !== undefined &&
          img.cloudCoverage !== undefined &&
          img.cloudCoverage > filters.cloudCoverageMax) {
        return false;
      }

      if (filters.satelliteName && img.satelliteName !== filters.satelliteName) {
        return false;
      }

      if (filters.tags && filters.tags.length > 0) {
        if (!img.tags || !filters.tags.some(tag => img.tags?.includes(tag))) {
          return false;
        }
      }

      return true;
    });

    // Sort by upload date (newest first)
    filteredImages.sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    // Paginate
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedImages = filteredImages.slice(startIndex, endIndex);

    // Add presigned URLs for preview
    const imagesWithUrls = await Promise.all(
      paginatedImages.map(async (img) => ({
        ...img,
        previewUrl: await getDownloadUrl(img.thumbnailUrl || img.s3Key),
      }))
    );

    const result: SearchResult = {
      images: imagesWithUrls,
      total: filteredImages.length,
      page,
      pageSize,
    };

    return success(result);
  } catch (err: any) {
    console.error('Error searching images:', err);
    return error(err.message);
  }
};

export const getImage: APIGatewayProxyHandler = async (event) => {
  try {
    const id = event.pathParameters?.id;

    if (!id) {
      return error('Image ID is required', 400);
    }

    const image = await getItem(TABLES.IMAGES, { id }) as SatelliteImage;

    if (!image) {
      return error('Image not found', 404);
    }

    // Add presigned URL for preview (prefer thumbnail over raw TIFF)
    const imageWithUrl = {
      ...image,
      previewUrl: await getDownloadUrl(image.thumbnailUrl || image.s3Key),
    };

    return success(imageWithUrl);
  } catch (err: any) {
    console.error('Error getting image:', err);
    return error(err.message);
  }
};

export const updateImage: APIGatewayProxyHandler = async (event) => {
  try {
    const id = event.pathParameters?.id;

    if (!id) {
      return error('Image ID is required', 400);
    }

    const updates = JSON.parse(event.body || '{}');

    // Only allow certain fields to be updated
    const allowedFields = ['title', 'description', 'tags'];
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {} as any);

    const updatedImage = await updateItem(TABLES.IMAGES, { id }, filteredUpdates);

    return success(updatedImage);
  } catch (err: any) {
    console.error('Error updating image:', err);
    return error(err.message);
  }
};

export const deleteImage: APIGatewayProxyHandler = async (event) => {
  try {
    const id = event.pathParameters?.id;

    if (!id) {
      return error('Image ID is required', 400);
    }

    const image = await getItem(TABLES.IMAGES, { id });

    if (!image) {
      return error('Image not found', 404);
    }

    // Delete from S3
    await deleteObject(image.s3Key);

    // Delete from database
    await deleteItem(TABLES.IMAGES, { id });

    return success({ message: 'Image deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting image:', err);
    return error(err.message);
  }
};
