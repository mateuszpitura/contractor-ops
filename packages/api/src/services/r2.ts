// Legacy single-bucket API — new code should use regional-storage.ts for
// region-aware bucket selection. These functions fall back to R2_BUCKET_NAME
// or R2_BUCKET_NAME_EU for backward compatibility.

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ---------------------------------------------------------------------------
// R2 client singleton
// ---------------------------------------------------------------------------

let r2Client: S3Client | null = null;

export function createR2Client(): S3Client {
  if (!r2Client) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return r2Client;
}

// ---------------------------------------------------------------------------
// Bucket resolution (backward compatible)
// ---------------------------------------------------------------------------

function getDefaultBucket(): string {
  return (
    process.env.R2_BUCKET_NAME ?? process.env.R2_BUCKET_NAME_EU ?? 'contractor-ops-documents-eu'
  );
}

// ---------------------------------------------------------------------------
// Storage key generation
// ---------------------------------------------------------------------------

/**
 * Allowed file extensions for document uploads.
 * Restricts storage keys to known-safe document types.
 */
const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'txt',
  'rtf',
  'odt',
  'ods',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'tiff',
  'tif',
  'bmp',
  'xml',
  'json',
  'zip',
  'eml',
]);

/**
 * Sanitize and validate a file extension extracted from user input.
 * Strips path traversal characters and rejects unknown extensions.
 * Returns the cleaned extension or empty string if invalid.
 */
function sanitizeExtension(raw: string): string {
  // Strip path traversal sequences and special characters
  const cleaned = raw
    .replace(/[/\\]/g, '') // remove slashes and backslashes
    .replace(/\.\./g, '') // remove parent directory traversal
    .replace(/[^a-zA-Z0-9]/g, '') // keep only alphanumeric
    .toLowerCase();

  if (!(cleaned && ALLOWED_EXTENSIONS.has(cleaned))) {
    return '';
  }

  return cleaned;
}

/**
 * Generates a deterministic storage key for a document.
 * Format: `orgs/{orgId}/documents/{docId}.{ext}`
 *
 * The extension is extracted from the user-provided filename, sanitized
 * to prevent path traversal, and validated against an allowlist.
 */
export function generateStorageKey(orgId: string, docId: string, filename: string): string {
  const rawExt = filename.split('.').pop() ?? '';
  const ext = sanitizeExtension(rawExt);
  return `orgs/${orgId}/documents/${docId}${ext ? `.${ext}` : ''}`;
}

// ---------------------------------------------------------------------------
// Presigned URL generation
// ---------------------------------------------------------------------------

/**
 * Creates a presigned PUT URL for uploading a file to R2.
 * Default expiry: 5 minutes.
 */
export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 300,
): Promise<string> {
  const client = createR2Client();
  const command = new PutObjectCommand({
    Bucket: getDefaultBucket(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Creates a presigned GET URL for downloading a file from R2.
 * Default expiry: 15 minutes.
 */
export async function createPresignedDownloadUrl(key: string, expiresIn = 900): Promise<string> {
  const client = createR2Client();
  const command = new GetObjectCommand({
    Bucket: getDefaultBucket(),
    Key: key,
    ResponseContentDisposition: 'attachment',
  });
  return getSignedUrl(client, command, { expiresIn });
}

// ---------------------------------------------------------------------------
// Object operations
// ---------------------------------------------------------------------------

/**
 * Retrieves object metadata (HEAD) from R2.
 * Useful for verifying upload completion and reading ContentLength.
 */
export async function headObject(key: string) {
  const client = createR2Client();
  const command = new HeadObjectCommand({
    Bucket: getDefaultBucket(),
    Key: key,
  });
  return client.send(command);
}

/**
 * Deletes an object from R2.
 */
export async function deleteObject(key: string) {
  const client = createR2Client();
  const command = new DeleteObjectCommand({
    Bucket: getDefaultBucket(),
    Key: key,
  });
  return client.send(command);
}
