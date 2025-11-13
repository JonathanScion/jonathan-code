import { APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getUploadUrl } from '../lib/s3';
import { putItem, TABLES } from '../lib/dynamodb';
import { success, error } from '../lib/response';
import type { UploadRequest, UploadResponse, SatelliteImage } from '@shared/types';
import { ImageStatus } from '@shared/types';

export const requestUploadUrl: APIGatewayProxyHandler = async (event) => {
  try {
    const request: UploadRequest = JSON.parse(event.body || '{}');

    const imageId = uuidv4();
    const s3Key = `images/${imageId}/${request.filename}`;

    // Generate presigned URL
    const uploadUrl = await getUploadUrl(s3Key, request.contentType);

    // Create initial database entry with all extracted metadata
    const image: SatelliteImage = {
      id: imageId,
      userId: 'demo-user', // In production, get from auth
      filename: s3Key,
      originalFilename: request.filename,
      s3Key,
      s3Bucket: process.env.IMAGES_BUCKET || 'satellite-images-bucket',
      fileSize: request.fileSize,
      uploadedAt: new Date().toISOString(),
      status: ImageStatus.UPLOADING,
      // Include all metadata from frontend extraction if available
      ...(request.centerPoint && { centerPoint: request.centerPoint }),
      ...(request.bounds && { bounds: request.bounds }),
      ...(request.width && { width: request.width }),
      ...(request.height && { height: request.height }),
      ...(request.bands && { bands: request.bands }),
      ...(request.bitDepth && { bitDepth: request.bitDepth }),
      ...(request.resolution && { resolution: request.resolution }),
      ...(request.capturedAt && { capturedAt: request.capturedAt }),
      ...(request.satelliteName && { satelliteName: request.satelliteName }),
      ...(request.sensorType && { sensorType: request.sensorType }),
      ...(request.projection && { projection: request.projection }),
      ...(request.cloudCoverage !== undefined && { cloudCoverage: request.cloudCoverage }),
    };

    await putItem(TABLES.IMAGES, image);

    const response: UploadResponse = {
      uploadUrl,
      imageId,
      s3Key,
    };

    return success(response);
  } catch (err: any) {
    console.error('Error generating upload URL:', err);
    return error(err.message);
  }
};

export const confirmUpload: APIGatewayProxyHandler = async (event) => {
  try {
    const imageId = event.pathParameters?.id;

    if (!imageId) {
      return error('Image ID is required', 400);
    }

    const { getItem, updateItem } = await import('../lib/dynamodb');
    const image = await getItem(TABLES.IMAGES, { id: imageId }) as SatelliteImage;

    if (!image) {
      return error('Image not found', 404);
    }

    // Update status to READY
    const updates: any = {
      status: ImageStatus.READY,
    };

    // Use extracted metadata if available, otherwise use fallbacks
    if (!image.satelliteName) {
      updates.satelliteName = 'Unknown';
    }
    
    if (!image.capturedAt) {
      // Use a recent date as fallback
      updates.capturedAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    if (image.cloudCoverage === undefined) {
      // Random cloud coverage between 0-30% as fallback
      updates.cloudCoverage = Math.floor(Math.random() * 30);
    }

    // Only add demo coordinates if real ones weren't extracted from the file
    if (!image.centerPoint || !image.bounds) {
      console.log('No real coordinates found, using demo coordinates for Cyprus region');
      updates.centerPoint = {
        lat: 34.77 + (Math.random() - 0.5) * 0.5,
        lon: 32.87 + (Math.random() - 0.5) * 0.5,
      };
      updates.bounds = {
        north: 35.0 + (Math.random() - 0.5) * 0.2,
        south: 34.5 + (Math.random() - 0.5) * 0.2,
        east: 33.1 + (Math.random() - 0.5) * 0.2,
        west: 32.6 + (Math.random() - 0.5) * 0.2,
      };
    } else {
      console.log('Using real coordinates extracted from GeoTIFF:', image.centerPoint, image.bounds);
    }

    // Log what metadata we're using
    console.log('Image metadata:', {
      width: image.width,
      height: image.height,
      bands: image.bands,
      bitDepth: image.bitDepth,
      resolution: image.resolution,
      satelliteName: image.satelliteName || updates.satelliteName,
      sensorType: image.sensorType,
      capturedAt: image.capturedAt || updates.capturedAt,
      cloudCoverage: image.cloudCoverage ?? updates.cloudCoverage,
    });

    const updatedImage = await updateItem(TABLES.IMAGES, { id: imageId }, updates);

    return success(updatedImage);
  } catch (err: any) {
    console.error('Error confirming upload:', err);
    return error(err.message);
  }
};
