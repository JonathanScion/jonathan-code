"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteImage = exports.updateImage = exports.getImage = exports.searchImages = void 0;
const dynamodb_1 = require("../lib/dynamodb");
const s3_1 = require("../lib/s3");
const response_1 = require("../lib/response");
const searchImages = async (event) => {
    try {
        const body = JSON.parse(event.body || '{}');
        const filters = body.filters || {};
        const page = body.page || 1;
        const pageSize = body.pageSize || 20;
        // Get all images (in production, use proper filtering and pagination)
        const allImages = await (0, dynamodb_1.scanItems)(dynamodb_1.TABLES.IMAGES);
        // Filter images
        let filteredImages = allImages.filter((img) => {
            // Comprehensive text search across ALL fields
            if (filters.query) {
                const query = filters.query.toLowerCase();
                const searchableText = [
                    img.filename,
                    img.originalFilename,
                    img.title,
                    img.description,
                    img.satelliteName,
                    img.sensorType,
                    img.projection,
                    img.status,
                    img.tags?.join(' '),
                    img.cloudCoverage?.toString(),
                    img.centerPoint?.lat?.toString(),
                    img.centerPoint?.lon?.toString(),
                    img.bounds?.north?.toString(),
                    img.bounds?.south?.toString(),
                    img.bounds?.east?.toString(),
                    img.bounds?.west?.toString(),
                    img.capturedAt,
                    img.uploadedAt,
                    img.width?.toString(),
                    img.height?.toString(),
                    img.bands?.toString(),
                    img.bitDepth?.toString(),
                    img.resolution?.toString(),
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
        filteredImages.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
        // Paginate
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedImages = filteredImages.slice(startIndex, endIndex);
        // Add presigned URLs for preview
        const imagesWithUrls = await Promise.all(paginatedImages.map(async (img) => ({
            ...img,
            previewUrl: await (0, s3_1.getDownloadUrl)(img.thumbnailUrl || img.s3Key),
        })));
        const result = {
            images: imagesWithUrls,
            total: filteredImages.length,
            page,
            pageSize,
        };
        return (0, response_1.success)(result);
    }
    catch (err) {
        console.error('Error searching images:', err);
        return (0, response_1.error)(err.message);
    }
};
exports.searchImages = searchImages;
const getImage = async (event) => {
    try {
        const id = event.pathParameters?.id;
        if (!id) {
            return (0, response_1.error)('Image ID is required', 400);
        }
        const image = await (0, dynamodb_1.getItem)(dynamodb_1.TABLES.IMAGES, { id });
        if (!image) {
            return (0, response_1.error)('Image not found', 404);
        }
        // Add presigned URL for preview (prefer thumbnail over raw TIFF)
        const imageWithUrl = {
            ...image,
            previewUrl: await (0, s3_1.getDownloadUrl)(image.thumbnailUrl || image.s3Key),
        };
        return (0, response_1.success)(imageWithUrl);
    }
    catch (err) {
        console.error('Error getting image:', err);
        return (0, response_1.error)(err.message);
    }
};
exports.getImage = getImage;
const updateImage = async (event) => {
    try {
        const id = event.pathParameters?.id;
        if (!id) {
            return (0, response_1.error)('Image ID is required', 400);
        }
        const updates = JSON.parse(event.body || '{}');
        // Only allow certain fields to be updated
        const allowedFields = ['title', 'description', 'tags'];
        const filteredUpdates = Object.keys(updates)
            .filter(key => allowedFields.includes(key))
            .reduce((obj, key) => {
            obj[key] = updates[key];
            return obj;
        }, {});
        const updatedImage = await (0, dynamodb_1.updateItem)(dynamodb_1.TABLES.IMAGES, { id }, filteredUpdates);
        return (0, response_1.success)(updatedImage);
    }
    catch (err) {
        console.error('Error updating image:', err);
        return (0, response_1.error)(err.message);
    }
};
exports.updateImage = updateImage;
const deleteImage = async (event) => {
    try {
        const id = event.pathParameters?.id;
        if (!id) {
            return (0, response_1.error)('Image ID is required', 400);
        }
        const image = await (0, dynamodb_1.getItem)(dynamodb_1.TABLES.IMAGES, { id });
        if (!image) {
            return (0, response_1.error)('Image not found', 404);
        }
        // Delete from S3
        await (0, s3_1.deleteObject)(image.s3Key);
        // Delete from database
        await (0, dynamodb_1.deleteItem)(dynamodb_1.TABLES.IMAGES, { id });
        return (0, response_1.success)({ message: 'Image deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting image:', err);
        return (0, response_1.error)(err.message);
    }
};
exports.deleteImage = deleteImage;
