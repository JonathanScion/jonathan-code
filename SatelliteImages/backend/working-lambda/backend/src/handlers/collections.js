"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addImagesToCollection = exports.deleteCollection = exports.updateCollection = exports.createCollection = exports.getCollection = exports.getAllCollections = void 0;
const uuid_1 = require("uuid");
const dynamodb_1 = require("../lib/dynamodb");
const response_1 = require("../lib/response");
const getAllCollections = async () => {
    try {
        const collections = await (0, dynamodb_1.scanItems)(dynamodb_1.TABLES.COLLECTIONS);
        return (0, response_1.success)(collections);
    }
    catch (err) {
        console.error('Error getting collections:', err);
        return (0, response_1.error)(err.message);
    }
};
exports.getAllCollections = getAllCollections;
const getCollection = async (event) => {
    try {
        const id = event.pathParameters?.id;
        if (!id) {
            return (0, response_1.error)('Collection ID is required', 400);
        }
        const collection = await (0, dynamodb_1.getItem)(dynamodb_1.TABLES.COLLECTIONS, { id });
        if (!collection) {
            return (0, response_1.error)('Collection not found', 404);
        }
        return (0, response_1.success)(collection);
    }
    catch (err) {
        console.error('Error getting collection:', err);
        return (0, response_1.error)(err.message);
    }
};
exports.getCollection = getCollection;
const createCollection = async (event) => {
    try {
        const body = JSON.parse(event.body || '{}');
        const collection = {
            id: (0, uuid_1.v4)(),
            userId: 'demo-user', // In production, get from auth
            name: body.name,
            description: body.description,
            imageIds: body.imageIds || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPublic: body.isPublic || false,
        };
        await (0, dynamodb_1.putItem)(dynamodb_1.TABLES.COLLECTIONS, collection);
        return (0, response_1.success)(collection);
    }
    catch (err) {
        console.error('Error creating collection:', err);
        return (0, response_1.error)(err.message);
    }
};
exports.createCollection = createCollection;
const updateCollection = async (event) => {
    try {
        const id = event.pathParameters?.id;
        if (!id) {
            return (0, response_1.error)('Collection ID is required', 400);
        }
        const updates = JSON.parse(event.body || '{}');
        updates.updatedAt = new Date().toISOString();
        const updatedCollection = await (0, dynamodb_1.updateItem)(dynamodb_1.TABLES.COLLECTIONS, { id }, updates);
        return (0, response_1.success)(updatedCollection);
    }
    catch (err) {
        console.error('Error updating collection:', err);
        return (0, response_1.error)(err.message);
    }
};
exports.updateCollection = updateCollection;
const deleteCollection = async (event) => {
    try {
        const id = event.pathParameters?.id;
        if (!id) {
            return (0, response_1.error)('Collection ID is required', 400);
        }
        await (0, dynamodb_1.deleteItem)(dynamodb_1.TABLES.COLLECTIONS, { id });
        return (0, response_1.success)({ message: 'Collection deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting collection:', err);
        return (0, response_1.error)(err.message);
    }
};
exports.deleteCollection = deleteCollection;
const addImagesToCollection = async (event) => {
    try {
        const id = event.pathParameters?.id;
        if (!id) {
            return (0, response_1.error)('Collection ID is required', 400);
        }
        const { imageIds } = JSON.parse(event.body || '{}');
        const collection = await (0, dynamodb_1.getItem)(dynamodb_1.TABLES.COLLECTIONS, { id });
        if (!collection) {
            return (0, response_1.error)('Collection not found', 404);
        }
        const updatedImageIds = [...new Set([...collection.imageIds, ...imageIds])];
        const updatedCollection = await (0, dynamodb_1.updateItem)(dynamodb_1.TABLES.COLLECTIONS, { id }, {
            imageIds: updatedImageIds,
            updatedAt: new Date().toISOString(),
        });
        return (0, response_1.success)(updatedCollection);
    }
    catch (err) {
        console.error('Error adding images to collection:', err);
        return (0, response_1.error)(err.message);
    }
};
exports.addImagesToCollection = addImagesToCollection;
