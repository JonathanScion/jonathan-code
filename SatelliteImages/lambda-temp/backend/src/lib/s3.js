"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUCKET = exports.s3Client = void 0;
exports.getUploadUrl = getUploadUrl;
exports.getDownloadUrl = getDownloadUrl;
exports.deleteObject = deleteObject;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
exports.s3Client = new client_s3_1.S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
exports.BUCKET = process.env.IMAGES_BUCKET || 'satellite-images-bucket';
async function getUploadUrl(key, contentType) {
    const command = new client_s3_1.PutObjectCommand({
        Bucket: exports.BUCKET,
        Key: key,
        ContentType: contentType,
    });
    return (0, s3_request_presigner_1.getSignedUrl)(exports.s3Client, command, { expiresIn: 3600 }); // 1 hour
}
async function getDownloadUrl(key) {
    const command = new client_s3_1.GetObjectCommand({
        Bucket: exports.BUCKET,
        Key: key,
    });
    return (0, s3_request_presigner_1.getSignedUrl)(exports.s3Client, command, { expiresIn: 3600 }); // 1 hour
}
async function deleteObject(key) {
    const command = new client_s3_1.DeleteObjectCommand({
        Bucket: exports.BUCKET,
        Key: key,
    });
    await exports.s3Client.send(command);
}
