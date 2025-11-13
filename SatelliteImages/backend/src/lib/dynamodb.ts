import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
export const docClient = DynamoDBDocumentClient.from(client);

export const TABLES = {
  IMAGES: process.env.IMAGES_TABLE || 'satellite-images',
  COLLECTIONS: process.env.COLLECTIONS_TABLE || 'satellite-collections',
  REQUESTS: process.env.REQUESTS_TABLE || 'satellite-requests',
};

export async function putItem(tableName: string, item: any) {
  const command = new PutCommand({
    TableName: tableName,
    Item: item,
  });
  return docClient.send(command);
}

export async function getItem(tableName: string, key: any) {
  const command = new GetCommand({
    TableName: tableName,
    Key: key,
  });
  const response = await docClient.send(command);
  return response.Item;
}

export async function updateItem(tableName: string, key: any, updates: any) {
  const updateExpression = Object.keys(updates)
    .map((key, i) => `#${key} = :${key}`)
    .join(', ');

  const expressionAttributeNames = Object.keys(updates).reduce((acc, key) => {
    acc[`#${key}`] = key;
    return acc;
  }, {} as any);

  const expressionAttributeValues = Object.keys(updates).reduce((acc, key) => {
    acc[`:${key}`] = updates[key];
    return acc;
  }, {} as any);

  const command = new UpdateCommand({
    TableName: tableName,
    Key: key,
    UpdateExpression: `SET ${updateExpression}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  });

  const response = await docClient.send(command);
  return response.Attributes;
}

export async function deleteItem(tableName: string, key: any) {
  const command = new DeleteCommand({
    TableName: tableName,
    Key: key,
  });
  return docClient.send(command);
}

export async function queryItems(tableName: string, keyCondition: any) {
  const command = new QueryCommand({
    TableName: tableName,
    ...keyCondition,
  });
  const response = await docClient.send(command);
  return response.Items || [];
}

export async function scanItems(tableName: string, filters?: any) {
  const command = new ScanCommand({
    TableName: tableName,
    ...filters,
  });
  const response = await docClient.send(command);
  return response.Items || [];
}
