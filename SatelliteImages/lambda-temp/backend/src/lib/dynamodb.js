"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TABLES = exports.docClient = void 0;
exports.putItem = putItem;
exports.getItem = getItem;
exports.updateItem = updateItem;
exports.deleteItem = deleteItem;
exports.queryItems = queryItems;
exports.scanItems = scanItems;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client = new client_dynamodb_1.DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
exports.docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
exports.TABLES = {
    IMAGES: process.env.IMAGES_TABLE || 'satellite-images',
    COLLECTIONS: process.env.COLLECTIONS_TABLE || 'satellite-collections',
    REQUESTS: process.env.REQUESTS_TABLE || 'satellite-requests',
};
async function putItem(tableName, item) {
    const command = new lib_dynamodb_1.PutCommand({
        TableName: tableName,
        Item: item,
    });
    return exports.docClient.send(command);
}
async function getItem(tableName, key) {
    const command = new lib_dynamodb_1.GetCommand({
        TableName: tableName,
        Key: key,
    });
    const response = await exports.docClient.send(command);
    return response.Item;
}
async function updateItem(tableName, key, updates) {
    const updateExpression = Object.keys(updates)
        .map((key, i) => `#${key} = :${key}`)
        .join(', ');
    const expressionAttributeNames = Object.keys(updates).reduce((acc, key) => {
        acc[`#${key}`] = key;
        return acc;
    }, {});
    const expressionAttributeValues = Object.keys(updates).reduce((acc, key) => {
        acc[`:${key}`] = updates[key];
        return acc;
    }, {});
    const command = new lib_dynamodb_1.UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression: `SET ${updateExpression}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    });
    const response = await exports.docClient.send(command);
    return response.Attributes;
}
async function deleteItem(tableName, key) {
    const command = new lib_dynamodb_1.DeleteCommand({
        TableName: tableName,
        Key: key,
    });
    return exports.docClient.send(command);
}
async function queryItems(tableName, keyCondition) {
    const command = new lib_dynamodb_1.QueryCommand({
        TableName: tableName,
        ...keyCondition,
    });
    const response = await exports.docClient.send(command);
    return response.Items || [];
}
async function scanItems(tableName, filters) {
    const command = new lib_dynamodb_1.ScanCommand({
        TableName: tableName,
        ...filters,
    });
    const response = await exports.docClient.send(command);
    return response.Items || [];
}
