"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatistics = void 0;
const dynamodb_1 = require("../lib/dynamodb");
const response_1 = require("../lib/response");
const getStatistics = async () => {
    try {
        const images = await (0, dynamodb_1.scanItems)(dynamodb_1.TABLES.IMAGES);
        // Calculate statistics
        const totalImages = images.length;
        const totalStorage = images.reduce((sum, img) => sum + img.fileSize, 0);
        // Calculate coverage area (sum of all bounding boxes)
        const coverageArea = images.reduce((sum, img) => {
            if (!img.bounds)
                return sum;
            const latDiff = Math.abs(img.bounds.north - img.bounds.south);
            const lonDiff = Math.abs(img.bounds.east - img.bounds.west);
            const area = latDiff * lonDiff * 111 * 111; // Approximate km²
            return sum + area;
        }, 0);
        // Uploads by month
        const uploadsByMonth = {};
        images.forEach(img => {
            const month = new Date(img.uploadedAt).toISOString().slice(0, 7); // YYYY-MM
            uploadsByMonth[month] = (uploadsByMonth[month] || 0) + 1;
        });
        // Images by tag
        const imagesByTag = {};
        images.forEach(img => {
            if (img.tags) {
                img.tags.forEach(tag => {
                    imagesByTag[tag] = (imagesByTag[tag] || 0) + 1;
                });
            }
        });
        // Images by satellite
        const imagesBySatellite = {};
        images.forEach(img => {
            if (img.satelliteName) {
                imagesBySatellite[img.satelliteName] = (imagesBySatellite[img.satelliteName] || 0) + 1;
            }
        });
        const statistics = {
            totalImages,
            totalStorage,
            coverageArea,
            uploadsByMonth,
            imagesByTag,
            imagesBySatellite,
        };
        return (0, response_1.success)(statistics);
    }
    catch (err) {
        console.error('Error getting statistics:', err);
        return (0, response_1.error)(err.message);
    }
};
exports.getStatistics = getStatistics;
