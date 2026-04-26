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
import { getServerEnv } from '@contractor-ops/validators';

// ---------------------------------------------------------------------------
// R2 client singleton
// ---------------------------------------------------------------------------

let r2Client: S3Client | null = null;

export function createR2Client(): S3Client {
  if (!r2Client) {
    const env = getServerEnv();
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return r2Client;
}

// ---------------------------------------------------------------------------
// Bucket resolution (backward compatible)
// ---------------------------------------------------------------------------

/**
 * Default R2 bucket for document object operations (Put/Get/Head/presigned URLs).
 */
export function getR2BucketName(): string {
  const env = getServerEnv();
  return env.R2_BUCKET_NAME ?? env.R2_BUCKET_NAME_EU;
}

function getDefaultBucket(): string {
  return getR2BucketName();
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
// Server-side object upload (no presigned URL)
// ---------------------------------------------------------------------------

/**
 * Upload a server-generated buffer to R2 and return a short-TTL signed
 * download URL. Used by workflows that render artifacts server-side
 * (WHT certificates, privacy-notice PDFs) and hand the caller a
 * time-limited download link instead of streaming the bytes back.
 *
 * `key` is trusted — callers must scope keys by organizationId to prevent
 * cross-tenant access (Phase 56 · D-09 + ASVS V4).
 */
export async function putObjectAndSignDownload(params: {
  key: string;
  body: Uint8Array | Buffer;
  contentType: string;
  downloadFilename?: string;
  ttlSeconds?: number;
}): Promise<{ signedUrl: string; expiresInSeconds: number }> {
  const client = createR2Client();
  const ttlSeconds = params.ttlSeconds ?? 300;

  await client.send(
    new PutObjectCommand({
      Bucket: getDefaultBucket(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );

  const disposition = params.downloadFilename
    ? `attachment; filename="${params.downloadFilename.replace(/"/g, '')}"`
    : 'attachment';
  const downloadCommand = new GetObjectCommand({
    Bucket: getDefaultBucket(),
    Key: params.key,
    ResponseContentDisposition: disposition,
  });
  const signedUrl = await getSignedUrl(client, downloadCommand, { expiresIn: ttlSeconds });
  return { signedUrl, expiresInSeconds: ttlSeconds };
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

/**
 * Upload a string body (e.g. serialized XML) to R2 at a caller-owned key.
 * Used by Phase 61's `finalizeEInvoice` to persist the canonical XRechnung
 * CII XML at a content-addressed key.  Caller MUST scope keys by
 * organizationId to prevent cross-tenant access (Phase 56 · D-09 + ASVS V4).
 */
export async function putObjectString(params: {
  key: string;
  body: string;
  contentType: string;
}): Promise<void> {
  const client = createR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getDefaultBucket(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );
}

/**
 * Read an R2 object into a UTF-8 string.  Consumed by Phase 61 `einvoice.send`
 * when it rehydrates the canonical XRechnung XML for transmission.
 *
 * `key` is trusted — callers MUST have verified the caller owns the
 * referenced lifecycle / document row before invoking this helper.
 */
export async function getObjectAsString(key: string): Promise<string> {
  const client = createR2Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: getDefaultBucket(),
      Key: key,
    }),
  );
  // AWS SDK v3's Body is a stream; transformToString is a built-in helper.
  const body = response.Body as
    | { transformToString(encoding?: string): Promise<string> }
    | undefined;
  if (!body || typeof body.transformToString !== 'function') {
    throw new Error(`R2 getObjectAsString(${key}): empty / unreadable body`);
  }
  return body.transformToString('utf-8');
}

/**
 * Sign a GET URL for an existing R2 object WITHOUT uploading anything.
 * Used by Phase 59 `classificationDocument.getDownloadUrl` query — the PDF bytes
 * were persisted by an earlier `generateSds` / `generateDrvDefenseBundle` mutation,
 * and subsequent downloads re-sign the same object so bytes never change (D-05).
 *
 * `key` is trusted — callers MUST scope by organizationId + verify the caller
 * owns the ClassificationDocument row before invoking this helper
 * (Phase 59 D-06 + ASVS V4).
 */
export async function signExistingDownload(
  key: string,
  ttlSeconds: number = 300,
  downloadFilename?: string,
): Promise<{ signedUrl: string; expiresInSeconds: number }> {
  const client = createR2Client();
  const disposition = downloadFilename
    ? `attachment; filename="${downloadFilename.replace(/"/g, '')}"`
    : 'attachment';
  const downloadCommand = new GetObjectCommand({
    Bucket: getDefaultBucket(),
    Key: key,
    ResponseContentDisposition: disposition,
  });
  const signedUrl = await getSignedUrl(client, downloadCommand, { expiresIn: ttlSeconds });
  return { signedUrl, expiresInSeconds: ttlSeconds };
}
