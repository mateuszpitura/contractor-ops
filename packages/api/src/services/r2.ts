// Legacy single-bucket API — new code should use regional-storage.ts for
// region-aware bucket selection. These functions fall back to R2_BUCKET_NAME
// or R2_BUCKET_NAME_EU for backward compatibility.

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ---------------------------------------------------------------------------
// R2 client singleton
// ---------------------------------------------------------------------------

let r2Client: S3Client | null = null;

export function createR2Client(): S3Client {
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
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
    process.env.R2_BUCKET_NAME ??
    process.env.R2_BUCKET_NAME_EU ??
    "contractor-ops-documents-eu"
  );
}

// ---------------------------------------------------------------------------
// Storage key generation
// ---------------------------------------------------------------------------

/**
 * Generates a deterministic storage key for a document.
 * Format: `orgs/{orgId}/documents/{docId}.{ext}`
 */
export function generateStorageKey(
  orgId: string,
  docId: string,
  filename: string,
): string {
  const ext = filename.split(".").pop() ?? "";
  return `orgs/${orgId}/documents/${docId}${ext ? `.${ext}` : ""}`;
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
export async function createPresignedDownloadUrl(
  key: string,
  expiresIn = 900,
): Promise<string> {
  const client = createR2Client();
  const command = new GetObjectCommand({
    Bucket: getDefaultBucket(),
    Key: key,
    ResponseContentDisposition: "attachment",
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
