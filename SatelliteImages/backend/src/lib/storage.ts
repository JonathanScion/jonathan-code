import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

// Base directory for storing uploaded files
export const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), 'uploads');

// Ensure storage directory exists
export async function ensureStorageDir(): Promise<void> {
  try {
    await mkdir(STORAGE_DIR, { recursive: true });
    await mkdir(path.join(STORAGE_DIR, 'images'), { recursive: true });
    await mkdir(path.join(STORAGE_DIR, 'thumbnails'), { recursive: true });
  } catch (err: any) {
    if (err.code !== 'EEXIST') throw err;
  }
}

// Get the full path for a file
export function getFilePath(key: string): string {
  return path.join(STORAGE_DIR, key);
}

// Get relative path from storage directory
export function getRelativePath(fullPath: string): string {
  return path.relative(STORAGE_DIR, fullPath);
}

// Generate upload path for an image
export function generateUploadPath(imageId: string, filename: string): string {
  return path.join('images', imageId, filename);
}

// Get download URL (for local development, returns a path that Express will serve)
export function getDownloadUrl(key: string): string {
  // Return a URL path that will be served by Express static middleware
  return `/files/${key.replace(/\\/g, '/')}`;
}

// Delete a file
export async function deleteFile(key: string): Promise<void> {
  const filePath = getFilePath(key);
  try {
    await unlink(filePath);

    // Try to remove parent directory if empty
    const parentDir = path.dirname(filePath);
    const files = fs.readdirSync(parentDir);
    if (files.length === 0) {
      fs.rmdirSync(parentDir);
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
  }
}

// Check if file exists
export async function fileExists(key: string): Promise<boolean> {
  try {
    await stat(getFilePath(key));
    return true;
  } catch {
    return false;
  }
}

// Get file size
export async function getFileSize(key: string): Promise<number> {
  const stats = await stat(getFilePath(key));
  return stats.size;
}
