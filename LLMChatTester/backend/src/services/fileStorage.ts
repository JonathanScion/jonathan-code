import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base uploads directory
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../../data/uploads');

// Ensure directory exists
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

// Get user's upload directory
export function getUserUploadsDir(userId: string): string {
  return path.join(UPLOADS_DIR, userId);
}

// Save a file for a user
export async function saveFile(
  userId: string,
  documentId: string,
  buffer: Buffer,
  originalName: string
): Promise<string> {
  const userDir = getUserUploadsDir(userId);
  await ensureDir(userDir);

  // Get extension from original filename
  const ext = path.extname(originalName).toLowerCase();
  const fileName = `${documentId}${ext}`;
  const filePath = path.join(userDir, fileName);

  await fs.writeFile(filePath, buffer);
  return filePath;
}

// Get file buffer
export async function getFile(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}

// Delete a file
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore if file doesn't exist
  }
}

// Delete all files for a user
export async function deleteUserFiles(userId: string): Promise<void> {
  const userDir = getUserUploadsDir(userId);
  try {
    await fs.rm(userDir, { recursive: true, force: true });
  } catch {
    // Ignore if directory doesn't exist
  }
}

// Check if file exists
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Get file stats
export async function getFileStats(filePath: string): Promise<{ size: number; mtime: Date } | null> {
  try {
    const stats = await fs.stat(filePath);
    return { size: stats.size, mtime: stats.mtime };
  } catch {
    return null;
  }
}
