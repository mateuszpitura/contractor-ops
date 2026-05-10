/**
 * F-SEC-01: Server-derived pending-upload table.
 *
 * Replaces the previously-vulnerable pattern where the client sent
 * `storageKey` as part of `submitInvoice` / `confirmUpload` — letting an
 * authenticated portal contractor exfiltrate any other tenant's R2 path by
 * forging a foreign key (CRITICAL cross-tenant document leak).
 *
 * Flow:
 *   1. Client requests an upload URL.
 *   2. Server generates a UUID `documentId`, derives the canonical
 *      `storageKey` via {@link generateStorageKey} (which always prefixes
 *      `orgs/{organizationId}/...`), persists a `PendingUpload` row with a
 *      15-minute expiry, and signs a presigned PUT URL bound to that key.
 *   3. Server returns ONLY `{ documentId, presignedPutUrl, expiresAt }` —
 *      never the storage key.
 *   4. Client uploads the bytes to R2.
 *   5. Client calls `submitInvoice` (or `confirmUpload`) passing only
 *      `documentId`. The server consumes the row atomically, recovers the
 *      trusted server-stored `storageKey`, and creates the `Document` row.
 *
 * Atomicity: `consumePendingUpload` uses `updateMany` to flip `consumedAt`
 * in a single statement filtered on (id, organizationId, consumedAt:null,
 * expiresAt:gt:now). Result count > 0 ⇒ this caller won the race; otherwise
 * the row was already consumed, expired, or belongs to another org.
 */

import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { generateStorageKey } from './r2.js';
import { createRegionalPresignedUploadUrl } from './regional-storage.js';

/** 15-minute upload window — matches the magic-link token expiry. */
const PENDING_UPLOAD_EXPIRY_MS = 15 * 60 * 1000;

/** Presigned PUT URL TTL (seconds). Default mirrors the `r2.ts` 5-minute. */
const PRESIGNED_PUT_TTL_SECONDS = 300;

export type PendingUploadPurpose =
  | 'PORTAL_INVOICE_SUBMIT'
  | 'PORTAL_DOC_VERSION'
  | 'CORE_DOC_REQUEST_UPLOAD'
  | 'CORE_DOC_VERSION_UPLOAD';

/**
 * Minimal shape of the Prisma client surface we need.
 *
 * The Prisma extended client has a complex generic type that doesn't reduce
 * to a plain record at structural-typing time, so we widen via `unknown` and
 * then narrow inside the helpers. Callers should pass the regional
 * tenant-scoped client (e.g. `ctx.db`) so `organizationId` gets auto-injected
 * into every query.
 */
interface PendingUploadRow {
  id: string;
  organizationId: string;
  documentId: string;
  storageKey: string;
  mimeType: string;
  fileSizeBytesMax: number | null;
  purpose: string;
  consumedAt: Date | null;
  expiresAt: Date;
}

interface PendingUploadDelegate {
  create: (args: { data: Record<string, unknown> }) => Promise<PendingUploadRow>;
  updateMany: (args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<{ count: number }>;
  // Use findFirst (not findUnique) — the tenant-scoped Prisma extension
  // injects `organizationId` into every `where`, which would break
  // findUnique (Prisma requires the where clause to match a unique key
  // exactly, and there's no `(documentId, organizationId)` composite).
  findFirst: (args: { where: { documentId: string } }) => Promise<PendingUploadRow | null>;
  deleteMany: (args: { where: Record<string, unknown> }) => Promise<{ count: number }>;
}

export type PendingUploadDb = {
  pendingUpload: PendingUploadDelegate;
};

/** Cast helper — narrows the Prisma extended client to our minimal shape. */
function delegate(db: unknown): PendingUploadDelegate {
  return (db as { pendingUpload: PendingUploadDelegate }).pendingUpload;
}

export interface CreatePendingUploadInput {
  /** Regional tenant-scoped Prisma client (e.g. `ctx.db`). */
  db: unknown;
  organizationId: string;
  purpose: PendingUploadPurpose;
  filename: string;
  mimeType: string;
  fileSizeBytesMax?: number;
  createdByUserId?: string | null;
  /** Pre-generated UUID — supply if a row already exists or for tests. */
  documentId?: string;
  /** Override presigned-PUT TTL (seconds). */
  presignedTtlSeconds?: number;
}

export interface CreatePendingUploadResult {
  documentId: string;
  presignedPutUrl: string;
  expiresAt: Date;
}

/**
 * Generate a server-side document UUID + storage key, persist a
 * `PendingUpload` row, and return the presigned PUT URL the client should
 * use. The storage key is NEVER returned — the only handle the client gets
 * is `documentId`.
 */
export async function createPendingUpload(
  input: CreatePendingUploadInput,
): Promise<CreatePendingUploadResult> {
  const documentId = input.documentId ?? randomUUID();
  const storageKey = generateStorageKey(input.organizationId, documentId, input.filename);
  const expiresAt = new Date(Date.now() + PENDING_UPLOAD_EXPIRY_MS);

  await delegate(input.db).create({
    data: {
      organizationId: input.organizationId,
      documentId,
      storageKey,
      mimeType: input.mimeType,
      fileSizeBytesMax: input.fileSizeBytesMax ?? null,
      purpose: input.purpose,
      createdByUserId: input.createdByUserId ?? null,
      expiresAt,
    },
  });

  const presignedPutUrl = await createRegionalPresignedUploadUrl(
    storageKey,
    input.mimeType,
    input.presignedTtlSeconds ?? PRESIGNED_PUT_TTL_SECONDS,
  );

  return { documentId, presignedPutUrl, expiresAt };
}

export interface ConsumePendingUploadInput {
  /** Regional tenant-scoped Prisma client (e.g. `ctx.db`). */
  db: unknown;
  organizationId: string;
  documentId: string;
  /** Optional purpose check — reject if the row was minted for a different flow. */
  expectedPurpose?: PendingUploadPurpose;
}

export interface ConsumedPendingUpload {
  documentId: string;
  storageKey: string;
  mimeType: string;
  fileSizeBytesMax: number | null;
  purpose: string;
}

/**
 * Atomically consume a `PendingUpload` row. Throws TRPC `BAD_REQUEST` if
 * the row is missing, expired, already consumed, or belongs to a different
 * org / different purpose.
 *
 * The atomic `updateMany` ensures only one caller can flip `consumedAt`
 * even if `submitInvoice` is called twice concurrently for the same
 * `documentId` — the second caller's count will be 0 and we throw.
 */
export async function consumePendingUpload(
  input: ConsumePendingUploadInput,
): Promise<ConsumedPendingUpload> {
  const now = new Date();

  const pendingUpload = delegate(input.db);

  // Atomic claim: only succeeds if not yet consumed and not expired and
  // tenant matches.
  const result = await pendingUpload.updateMany({
    where: {
      documentId: input.documentId,
      organizationId: input.organizationId,
      consumedAt: null,
      expiresAt: { gt: now },
      ...(input.expectedPurpose ? { purpose: input.expectedPurpose } : {}),
    },
    data: { consumedAt: now },
  });

  if (result.count === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'PENDING_UPLOAD_INVALID',
    });
  }

  // Re-read to return the trusted server-side fields. `findFirst` (not
  // `findUnique`) because the tenant extension injects `organizationId` into
  // the where clause and `(documentId, organizationId)` isn't a unique key.
  const row = await pendingUpload.findFirst({
    where: { documentId: input.documentId },
  });

  // Defensive — shouldn't happen because we just successfully updated it.
  if (!row || row.organizationId !== input.organizationId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'PENDING_UPLOAD_INVALID',
    });
  }

  return {
    documentId: row.documentId,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    fileSizeBytesMax: row.fileSizeBytesMax,
    purpose: row.purpose,
  };
}

/**
 * Hygiene helper — delete expired pending uploads. Called from the data-purge
 * cron schedule to keep the table from growing unbounded with abandoned flows
 * (browsers that never came back to call `submitInvoice` / `confirmUpload`).
 *
 * Safe to run concurrently because it only targets rows whose `expiresAt` is
 * already in the past — by definition they cannot be consumed any more, so
 * we are not racing a legitimate consumer.
 *
 * IMPORTANT: pass the GLOBAL prisma client here, not a tenant-scoped one —
 * this purge cuts across organizations, and the tenant extension would inject
 * an `organizationId` filter that nukes the cross-tenant sweep.
 */
export async function purgeExpiredPendingUploads(db: unknown): Promise<number> {
  const result = await delegate(db).deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
