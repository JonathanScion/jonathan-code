"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmUpload = exports.requestUploadUrl = void 0;
const uuid_1 = require("uuid");
const s3_1 = require("../lib/s3");
const dynamodb_1 = require("../lib/dynamodb");
const response_1 = require("../lib/response");
const types_1 = require("@shared/types");
const requestUploadUrl = async (event) => {
    try {
        const request = JSON.parse(event.body || '{}');
        const imageId = (0, uuid_1.v4)();
        const s3Key = `images/${imageId}/${request.filename}`;
        // Generate presigned URL
        const uploadUrl = await (0, s3_1.getUploadUrl)(s3Key, request.contentType);
        // Create initial database entry with all extracted metadata
        const image = {
            id: imageId,
            userId: 'demo-user', // In production, get from auth
            filename: s3Key,
            originalFilename: request.filename,
            s3Key,
            s3Bucket: process.env.IMAGES_BUCKET || 'satellite-images-bucket',
            fileSize: request.fileSize,
            uploadedAt: new Date().toISOString(),
            status: types_1.ImageStatus.UPLOADING,
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
        await (0, dynamodb_1.putItem)(dynamodb_1.TABLES.IMAGES, image);
        const response = {
            uploadUrl,
            imageId,
            s3Key,
        };
        return (0, response_1.success)(response);
    }
    catch (err) {
        console.error('Error generating upload URL:', err);
        return (0, response_1.error)(err.message);
    }
};
exports.requestUploadUrl = requestUploadUrl;
const confirmUpload = async (event) => {
    try {
        const imageId = event.pathParameters?.id;
        if (!imageId) {
            return (0, response_1.error)('Image ID is required', 400);
        }
        const { getItem, updateItem } = await Promise.resolve().then(() => __importStar(require('../lib/dynamodb')));
        const image = await getItem(dynamodb_1.TABLES.IMAGES, { id: imageId });
        if (!image) {
            return (0, response_1.error)('Image not found', 404);
        }
        // Update status to READY
        const updates = {
            status: types_1.ImageStatus.READY,
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
        }
        else {
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
        const updatedImage = await updateItem(dynamodb_1.TABLES.IMAGES, { id: imageId }, updates);
        return (0, response_1.success)(updatedImage);
    }
    catch (err) {
        console.error('Error confirming upload:', err);
        return (0, response_1.error)(err.message);
    }
};
exports.confirmUpload = confirmUpload;
