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
// Per-content-type size caps (F-SEC-19)
// ---------------------------------------------------------------------------

/**
 * Maximum bytes allowed per MIME type. Enforced at three layers:
 *   1. `createPresignedUploadUrl` signs the URL with `ContentLength` so R2
 *      rejects oversize PUTs at the edge (no bytes ever land in our bucket).
 *   2. `confirmUpload` re-checks `headObject().ContentLength` against the
 *      cap and deletes the object on overrun (defends against an attacker
 *      who somehow bypasses #1 via a different upload path).
 *   3. `requestUpload` rejects when the client-declared `fileSizeBytes`
 *      already exceeds the cap before signing.
 *
 * Caps are intentionally generous; tighten per-tenant via Subscription tier
 * limits if/when storage cost becomes a binding constraint.
 */
export const MAX_BYTES_BY_MIME: Readonly<Record<string, number>> = Object.freeze({
  'application/pdf': 50 * 1024 * 1024, // 50 MB — invoices, contracts
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 25 * 1024 * 1024, // 25 MB — DOCX
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 25 * 1024 * 1024, // 25 MB — XLSX
  'image/png': 10 * 1024 * 1024, // 10 MB — receipts, scans
  'image/jpeg': 10 * 1024 * 1024, // 10 MB — receipts, scans
});

/** Generic upper bound for any other allowed MIME (must stay > all per-type
 *  caps to act as a safety net rather than a tightening overlay). */
export const MAX_BYTES_GENERIC = 100 * 1024 * 1024; // 100 MB

/**
 * Returns the byte cap for a given MIME type. Falls back to the generic cap
 * for unknown types — an attacker cannot widen the cap by sending an
 * obscure MIME because `isAllowedMimeType()` already restricts the input
 * set further upstream.
 */
export function maxBytesForMime(mimeType: string): number {
  return MAX_BYTES_BY_MIME[mimeType] ?? MAX_BYTES_GENERIC;
}

// ---------------------------------------------------------------------------
// Presigned URL generation
// ---------------------------------------------------------------------------

/**
 * Creates a presigned PUT URL for uploading a file to R2.
 * Default expiry: 5 minutes.
 *
 * F-SEC-19: passes `ContentLength` to the signed PUT so R2 rejects PUTs
 * whose body length doesn't match the signed value at the edge. Callers
 * MUST supply the maximum bytes the upload should allow; R2 will return
 * `XAmzContentLengthTooLong` (or similar) if the client tries to upload
 * more.
 */
export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 300,
  maxBytes?: number,
): Promise<string> {
  const client = createR2Client();
  const command = new PutObjectCommand({
    Bucket: getDefaultBucket(),
    Key: key,
    ContentType: contentType,
    ...(maxBytes !== undefined ? { ContentLength: maxBytes } : {}),
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

/**
 * Stream-upload an object to R2 using the AWS SDK lib-storage `Upload`
 * helper which auto-chunks the input into multipart parts. Used by the
 * async export framework (P2-F · F-SCALE-08) to pipe a CSV stream from a
 * Prisma cursor straight into R2 without buffering the entire result.
 *
 * `key` is trusted — callers must scope keys by `organizationId` to
 * prevent cross-tenant access (Phase 56 · D-09 + ASVS V4).
 *
 * Returns the `key` and `byteLength` of the uploaded object — caller is
 * responsible for persisting the key into the owning row (e.g.
 * `Export.fileR2Key`).
 */
export async function streamObjectUpload(params: {
  key: string;
  /**
   * Accepts the same body shapes as `PutObjectCommand`. The streaming
   * Node `Readable` produced by `streamCsvResponse` satisfies the SDK's
   * `StreamingBlobPayloadInputTypes` constraint via Node's `stream`
   * module.
   */
  body: import('@aws-sdk/client-s3').PutObjectCommandInput['Body'];
  contentType: string;
  contentDisposition?: string;
}): Promise<{ key: string; byteLength: number | null }> {
  const { Upload } = await import('@aws-sdk/lib-storage');
  const client = createR2Client();

  const upload = new Upload({
    client,
    params: {
      Bucket: getDefaultBucket(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      ContentDisposition: params.contentDisposition,
    },
    // 5 MiB part size is the R2 minimum; queueSize 4 balances throughput
    // against memory headroom on small worker instances.
    partSize: 5 * 1024 * 1024,
    queueSize: 4,
  });

  const result = await upload.done();
  // `Upload.done()` does not return ContentLength; we can HEAD afterwards
  // if a row needs the byte size, but returning null avoids the extra RTT
  // for the common case where the export row already tracks `rowCount`.
  return {
    key: result.Key ?? params.key,
    byteLength: null,
  };
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
