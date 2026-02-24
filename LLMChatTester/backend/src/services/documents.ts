import { extractText as extractPdfText } from 'unpdf';
import mammoth from 'mammoth';
import path from 'path';
import { randomUUID } from 'crypto';

// Types
export interface TextChunk {
  text: string;
  chunkIndex: number;
}

// Chunking configuration
const CHUNK_SIZE = 1000; // characters
const CHUNK_OVERLAP = 200; // characters

// Extract text from various document types
export async function extractText(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  const ext = path.extname(filename).toLowerCase();

  if (mimeType === 'application/pdf' || ext === '.pdf') {
    const { text } = await extractPdfText(buffer);
    // unpdf returns text as string[] (array of pages), join them
    return Array.isArray(text) ? text.join('\n') : text;
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown' ||
    ext === '.txt' ||
    ext === '.md'
  ) {
    return buffer.toString('utf-8');
  }

  throw new Error(`Unsupported file type: ${mimeType || ext}`);
}

// Chunk text into overlapping segments
export function chunkText(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];

  // Clean the text
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleanedText.length <= CHUNK_SIZE) {
    return [{ text: cleanedText, chunkIndex: 0 }];
  }

  let start = 0;
  let chunkIndex = 0;

  while (start < cleanedText.length) {
    let end = start + CHUNK_SIZE;

    // Don't cut in the middle of a word
    if (end < cleanedText.length) {
      // Try to find a good break point (sentence end, paragraph, or space)
      const searchStart = Math.max(start + CHUNK_SIZE - 100, start);
      const searchText = cleanedText.slice(searchStart, end + 50);

      // Prefer paragraph breaks
      const paragraphBreak = searchText.lastIndexOf('\n\n');
      if (paragraphBreak > 50) {
        end = searchStart + paragraphBreak + 2;
      } else {
        // Try sentence end
        const sentenceEnd = searchText.search(/[.!?]\s/);
        if (sentenceEnd > 50) {
          end = searchStart + sentenceEnd + 2;
        } else {
          // Fall back to space
          const spaceIndex = searchText.lastIndexOf(' ');
          if (spaceIndex > 50) {
            end = searchStart + spaceIndex + 1;
          }
        }
      }
    }

    const chunkText = cleanedText.slice(start, end).trim();
    if (chunkText.length > 0) {
      chunks.push({ text: chunkText, chunkIndex });
      chunkIndex++;
    }

    // Move start with overlap
    start = end - CHUNK_OVERLAP;
    if (start >= cleanedText.length - CHUNK_OVERLAP) {
      break;
    }
  }

  return chunks;
}

// Generate a unique document ID (UUID for PostgreSQL compatibility)
export function generateDocumentId(): string {
  return randomUUID();
}
