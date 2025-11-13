"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelRequest = exports.deleteRequest = exports.updateRequest = exports.getRequest = exports.listRequests = exports.createRequest = void 0;
const uuid_1 = require("uuid");
const dynamodb_1 = require("../lib/dynamodb");
const response_1 = require("../lib/response");
const types_1 = require("../../../shared/src/types");
// Create a new imaging request
const createRequest = async (event) => {
    try {
        const input = JSON.parse(event.body || '{}');
        // Validate required fields
        if (!input.title || !input.targetLocation || !input.requestedStartDate || !input.requestedEndDate) {
            return (0, response_1.error)('Missing required fields: title, targetLocation, requestedStartDate, requestedEndDate', 400);
        }
        const now = new Date().toISOString();
        const request = {
            id: (0, uuid_1.v4)(),
            userId: 'demo-user', // In production, get from auth
            ...input,
            status: types_1.RequestStatus.PENDING,
            createdAt: now,
            updatedAt: now,
        };
        await (0, dynamodb_1.putItem)(dynamodb_1.TABLES.REQUESTS, request);
        return (0, response_1.success)(request);
    }
    catch (err) {
        console.error('Error creating imaging request:', err);
        return (0, response_1.error)(err.message);
    }
};
exports.createRequest = createRequest;
// Get all imaging requests with optional filters
const listRequests = async (event) => {
    try {
        const queryParams = event.queryStringParameters || {};
        const filters = {
            query: queryParams.query,
            status: queryParams.status,
            priority: queryParams.priority,
            startDate: queryParams.startDate,
            endDate: queryParams.endDate,
        };
        // For now, use scan (in production, use GSI for better performance)
        const items = await (0, dynamodb_1.scanItems)(dynamodb_1.TABLES.REQUESTS);
        // Filter results based on query params
        let filteredItems = items.filter((item) => {
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
        filteredItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return (0, response_1.success)(filteredItems);
    }
    catch (err) {
        console.error('Error listing imaging requests:', err);
        return (0, response_1.error)(err.message);
    }
};
exports.listRequests = listRequests;
// Get a single imaging request by ID
const getRequest = async (event) => {
    try {
        const requestId = event.pathParameters?.id;
        if (!requestId) {
            return (0, response_1.error)('Request ID is required', 400);
        }
        const request = await (0, dynamodb_1.getItem)(dynamodb_1.TABLES.REQUESTS, { id: requestId });
        if (!request) {
            return (0, response_1.error)('Imaging request not found', 404);
        }
        return (0, response_1.success)(request);
    }
    catch (err) {
        console.error('Error getting imaging request:', err);
        return (0, response_1.error)(err.message);
    }
};
exports.getRequest = getRequest;
// Update an imaging request
const updateRequest = async (event) => {
    try {
        const requestId = event.pathParameters?.id;
        if (!requestId) {
            return (0, response_1.error)('Request ID is required', 400);
        }
        const input = JSON.parse(event.body || '{}');
        // Check if request exists
        const existingRequest = await (0, dynamodb_1.getItem)(dynamodb_1.TABLES.REQUESTS, { id: requestId });
        if (!existingRequest) {
            return (0, response_1.error)('Imaging request not found', 404);
        }
        // Update the request
        const updates = {
            ...input,
            updatedAt: new Date().toISOString(),
        };
        const updatedRequest = await (0, dynamodb_1.updateItem)(dynamodb_1.TABLES.REQUESTS, { id: requestId }, updates);
        return (0, response_1.success)(updatedRequest);
    }
    catch (err) {
        console.error('Error updating imaging request:', err);
        return (0, response_1.error)(err.message);
    }
};
exports.updateRequest = updateRequest;
// Delete an imaging request
const deleteRequest = async (event) => {
    try {
        const requestId = event.pathParameters?.id;
        if (!requestId) {
            return (0, response_1.error)('Request ID is required', 400);
        }
        // Check if request exists
        const existingRequest = await (0, dynamodb_1.getItem)(dynamodb_1.TABLES.REQUESTS, { id: requestId });
        if (!existingRequest) {
            return (0, response_1.error)('Imaging request not found', 404);
        }
        await (0, dynamodb_1.deleteItem)(dynamodb_1.TABLES.REQUESTS, { id: requestId });
        return (0, response_1.success)({ message: 'Imaging request deleted successfully', id: requestId });
    }
    catch (err) {
        console.error('Error deleting imaging request:', err);
        return (0, response_1.error)(err.message);
    }
};
exports.deleteRequest = deleteRequest;
// Cancel an imaging request
const cancelRequest = async (event) => {
    try {
        const requestId = event.pathParameters?.id;
        if (!requestId) {
            return (0, response_1.error)('Request ID is required', 400);
        }
        const { cancelReason } = JSON.parse(event.body || '{}');
        const updates = {
            status: types_1.RequestStatus.CANCELLED,
            cancelReason: cancelReason || 'Cancelled by user',
            updatedAt: new Date().toISOString(),
        };
        const updatedRequest = await (0, dynamodb_1.updateItem)(dynamodb_1.TABLES.REQUESTS, { id: requestId }, updates);
        return (0, response_1.success)(updatedRequest);
    }
    catch (err) {
        console.error('Error cancelling imaging request:', err);
        return (0, response_1.error)(err.message);
    }
};
exports.cancelRequest = cancelRequest;
