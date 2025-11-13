import { APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { putItem, getItem, updateItem, deleteItem, scanItems, queryItems, TABLES } from '../lib/dynamodb';
import { success, error } from '../lib/response';
import type {
  ImagingRequest,
  CreateImagingRequestInput,
  UpdateImagingRequestInput,
  ImagingRequestFilters,
} from '@shared/types';
import { RequestStatus, RequestPriority } from '@shared/types';

// Create a new imaging request
export const createRequest: APIGatewayProxyHandler = async (event) => {
  try {
    const input: CreateImagingRequestInput = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!input.title || !input.targetLocation || !input.requestedStartDate || !input.requestedEndDate) {
      return error('Missing required fields: title, targetLocation, requestedStartDate, requestedEndDate', 400);
    }

    const now = new Date().toISOString();
    const request: ImagingRequest = {
      id: uuidv4(),
      userId: 'demo-user', // In production, get from auth
      ...input,
      status: RequestStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    };

    await putItem(TABLES.REQUESTS, request);

    return success(request);
  } catch (err: any) {
    console.error('Error creating imaging request:', err);
    return error(err.message);
  }
};

// Get all imaging requests with optional filters
export const listRequests: APIGatewayProxyHandler = async (event) => {
  try {
    const queryParams = event.queryStringParameters || {};
    const filters: ImagingRequestFilters = {
      query: queryParams.query,
      status: queryParams.status as any,
      priority: queryParams.priority as any,
      startDate: queryParams.startDate,
      endDate: queryParams.endDate,
    };

    // For now, use scan (in production, use GSI for better performance)
    const items = await scanItems(TABLES.REQUESTS);

    // Filter results based on query params
    let filteredItems = items.filter((item: any) => {
      // Text search on user-visible fields only: Location Name, GPS Coordinates, Requested Window, Priority
      if (filters.query) {
        const query = filters.query.toLowerCase();
        const searchableText = [
          item.locationName,
          item.targetLocation?.lat?.toString(),
          item.targetLocation?.lon?.toString(),
          item.requestedStartDate,
          item.requestedEndDate,
          item.priority,
        ]
          .filter(Boolean) // Remove undefined/null values
          .join(' ')
          .toLowerCase();

        if (!searchableText.includes(query)) {
          return false;
        }
      }

      if (filters.status && item.status !== filters.status) {
        return false;
      }

      if (filters.priority && item.priority !== filters.priority) {
        return false;
      }

      return true;
    });

    // Sort by createdAt descending (most recent first)
    filteredItems.sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return success(filteredItems);
  } catch (err: any) {
    console.error('Error listing imaging requests:', err);
    return error(err.message);
  }
};

// Get a single imaging request by ID
export const getRequest: APIGatewayProxyHandler = async (event) => {
  try {
    const requestId = event.pathParameters?.id;

    if (!requestId) {
      return error('Request ID is required', 400);
    }

    const request = await getItem(TABLES.REQUESTS, { id: requestId });

    if (!request) {
      return error('Imaging request not found', 404);
    }

    return success(request);
  } catch (err: any) {
    console.error('Error getting imaging request:', err);
    return error(err.message);
  }
};

// Update an imaging request
export const updateRequest: APIGatewayProxyHandler = async (event) => {
  try {
    const requestId = event.pathParameters?.id;

    if (!requestId) {
      return error('Request ID is required', 400);
    }

    const input: UpdateImagingRequestInput = JSON.parse(event.body || '{}');

    // Check if request exists
    const existingRequest = await getItem(TABLES.REQUESTS, { id: requestId });
    if (!existingRequest) {
      return error('Imaging request not found', 404);
    }

    // Update the request
    const updates = {
      ...input,
      updatedAt: new Date().toISOString(),
    };

    const updatedRequest = await updateItem(TABLES.REQUESTS, { id: requestId }, updates);

    return success(updatedRequest);
  } catch (err: any) {
    console.error('Error updating imaging request:', err);
    return error(err.message);
  }
};

// Delete an imaging request
export const deleteRequest: APIGatewayProxyHandler = async (event) => {
  try {
    const requestId = event.pathParameters?.id;

    if (!requestId) {
      return error('Request ID is required', 400);
    }

    // Check if request exists
    const existingRequest = await getItem(TABLES.REQUESTS, { id: requestId });
    if (!existingRequest) {
      return error('Imaging request not found', 404);
    }

    await deleteItem(TABLES.REQUESTS, { id: requestId });

    return success({ message: 'Imaging request deleted successfully', id: requestId });
  } catch (err: any) {
    console.error('Error deleting imaging request:', err);
    return error(err.message);
  }
};

// Cancel an imaging request
export const cancelRequest: APIGatewayProxyHandler = async (event) => {
  try {
    const requestId = event.pathParameters?.id;

    if (!requestId) {
      return error('Request ID is required', 400);
    }

    const { cancelReason } = JSON.parse(event.body || '{}');

    const updates = {
      status: RequestStatus.CANCELLED,
      cancelReason: cancelReason || 'Cancelled by user',
      updatedAt: new Date().toISOString(),
    };

    const updatedRequest = await updateItem(TABLES.REQUESTS, { id: requestId }, updates);

    return success(updatedRequest);
  } catch (err: any) {
    console.error('Error cancelling imaging request:', err);
    return error(err.message);
  }
};
