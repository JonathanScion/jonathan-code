import { APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getItem, putItem, updateItem, deleteItem, scanItems, TABLES } from '../lib/dynamodb';
import { success, error } from '../lib/response';
import type { Collection } from '@shared/types';

export const getAllCollections: APIGatewayProxyHandler = async () => {
  try {
    const collections = await scanItems(TABLES.COLLECTIONS);
    return success(collections);
  } catch (err: any) {
    console.error('Error getting collections:', err);
    return error(err.message);
  }
};

export const getCollection: APIGatewayProxyHandler = async (event) => {
  try {
    const id = event.pathParameters?.id;

    if (!id) {
      return error('Collection ID is required', 400);
    }

    const collection = await getItem(TABLES.COLLECTIONS, { id });

    if (!collection) {
      return error('Collection not found', 404);
    }

    return success(collection);
  } catch (err: any) {
    console.error('Error getting collection:', err);
    return error(err.message);
  }
};

export const createCollection: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');

    const collection: Collection = {
      id: uuidv4(),
      userId: 'demo-user', // In production, get from auth
      name: body.name,
      description: body.description,
      imageIds: body.imageIds || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPublic: body.isPublic || false,
    };

    await putItem(TABLES.COLLECTIONS, collection);

    return success(collection);
  } catch (err: any) {
    console.error('Error creating collection:', err);
    return error(err.message);
  }
};

export const updateCollection: APIGatewayProxyHandler = async (event) => {
  try {
    const id = event.pathParameters?.id;

    if (!id) {
      return error('Collection ID is required', 400);
    }

    const updates = JSON.parse(event.body || '{}');
    updates.updatedAt = new Date().toISOString();

    const updatedCollection = await updateItem(TABLES.COLLECTIONS, { id }, updates);

    return success(updatedCollection);
  } catch (err: any) {
    console.error('Error updating collection:', err);
    return error(err.message);
  }
};

export const deleteCollection: APIGatewayProxyHandler = async (event) => {
  try {
    const id = event.pathParameters?.id;

    if (!id) {
      return error('Collection ID is required', 400);
    }

    await deleteItem(TABLES.COLLECTIONS, { id });

    return success({ message: 'Collection deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting collection:', err);
    return error(err.message);
  }
};

export const addImagesToCollection: APIGatewayProxyHandler = async (event) => {
  try {
    const id = event.pathParameters?.id;

    if (!id) {
      return error('Collection ID is required', 400);
    }

    const { imageIds } = JSON.parse(event.body || '{}');

    const collection = await getItem(TABLES.COLLECTIONS, { id });

    if (!collection) {
      return error('Collection not found', 404);
    }

    const updatedImageIds = [...new Set([...collection.imageIds, ...imageIds])];

    const updatedCollection = await updateItem(
      TABLES.COLLECTIONS,
      { id },
      {
        imageIds: updatedImageIds,
        updatedAt: new Date().toISOString(),
      }
    );

    return success(updatedCollection);
  } catch (err: any) {
    console.error('Error adding images to collection:', err);
    return error(err.message);
  }
};
