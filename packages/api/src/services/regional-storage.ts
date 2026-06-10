/**
 * Region-aware R2 storage service.
 *
 * Routes file operations to the correct R2 bucket based on the organization's
 * data region. Uses the tenant context to auto-resolve region when not
 * explicitly provided.
 *
 * New code should use these functions instead of the legacy single-bucket
 * functions in r2.ts.
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { DataRegion } from '@contractor-ops/db';
import { tenantStore } from '@contractor-ops/db';
import type { ServerEnv } from '@contractor-ops/validators';
import { getServerEnv } from '@contractor-ops/validators';
import { createR2Client } from './r2';

// ---------------------------------------------------------------------------
// Region → bucket (validated env)
// ---------------------------------------------------------------------------

// `Record<DataRegion>` is a compile-time lockstep: adding a region to the
// shared `DataRegion` union forces a matching bucket resolver here. EU/ME have
// defaults in the env schema so they never throw; US is optional (no default)
// and lazy-throws on access, mirroring the `DATABASE_URL_US` posture.
const REGION_BUCKET_MAP: Record<DataRegion, (env: ServerEnv) => string> = {
  EU: env => env.R2_BUCKET_NAME_EU,
  ME: env => env.R2_BUCKET_NAME_ME,
  US: env => {
    if (!env.R2_BUCKET_NAME_US) {
      throw new Error('R2_BUCKET_NAME_US is not configured for US-region storage');
    }
    return env.R2_BUCKET_NAME_US;
  },
};

/**
 * Returns the R2 bucket name for the given data region.
 *
 * @throws If region is not supported
 */
export function getRegionalBucket(region: string): string {
  const pick = REGION_BUCKET_MAP[region as DataRegion];
  if (!pick) {
    throw new Error(
      `Unsupported storage region: ${region}. Supported: ${Object.keys(REGION_BUCKET_MAP).join(', ')}`,
    );
  }
  return pick(getServerEnv());
}

// ---------------------------------------------------------------------------
// Region resolution
// ---------------------------------------------------------------------------

function resolveRegion(explicitRegion?: string): string {
  if (explicitRegion) return explicitRegion;
  const ctx = tenantStore.getStore();
  if (!ctx?.region) {
    throw new Error('No region in tenant context and no explicit region provided');
  }
  return ctx.region;
}

// ---------------------------------------------------------------------------
// Regional presigned URL generation
// ---------------------------------------------------------------------------

/**
 * Creates a presigned PUT URL for uploading a file to the regional R2 bucket.
 * Default expiry: 5 minutes.
 *
 * When `maxBytes` is supplied, the URL is signed with
 * `ContentLength` so R2 rejects oversize PUTs at the edge before any bytes
 * land in our bucket.
 *
 * @param region - Explicit region override. If omitted, resolves from tenant context.
 */
export async function createRegionalPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 300,
  region?: string,
  maxBytes?: number,
): Promise<string> {
  const bucket = getRegionalBucket(resolveRegion(region));
  const client = createR2Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ...(maxBytes === undefined ? {} : { ContentLength: maxBytes }),
  });
  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Creates a presigned GET URL for downloading a file from the regional R2 bucket.
 * Default expiry: 15 minutes.
 *
 * @param region - Explicit region override. If omitted, resolves from tenant context.
 */
export async function createRegionalPresignedDownloadUrl(
  key: string,
  expiresIn = 900,
  region?: string,
): Promise<string> {
  const bucket = getRegionalBucket(resolveRegion(region));
  const client = createR2Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: 'attachment',
  });
  return getSignedUrl(client, command, { expiresIn });
}

// ---------------------------------------------------------------------------
// Regional object operations
// ---------------------------------------------------------------------------

/**
 * Retrieves object metadata (HEAD) from the regional R2 bucket.
 */
export async function headRegionalObject(key: string, region?: string) {
  const bucket = getRegionalBucket(resolveRegion(region));
  const client = createR2Client();
  const command = new HeadObjectCommand({ Bucket: bucket, Key: key });
  return client.send(command);
}

/**
 * Deletes an object from the regional R2 bucket.
 */
export async function deleteRegionalObject(key: string, region?: string) {
  const bucket = getRegionalBucket(resolveRegion(region));
  const client = createR2Client();
  const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
  return client.send(command);
}
