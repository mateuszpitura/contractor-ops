import type { HeadObjectCommandOutput } from '@aws-sdk/client-s3';
import type { Prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import {
  documentConfirmUploadSchema,
  documentLinkSchema,
  documentListSchema,
  documentRequestUploadSchema,
  documentVersionUploadSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors.js';
import { router } from '../../init.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantProcedure } from '../../middleware/tenant.js';
import { uploadRateLimitMiddleware } from '../../middleware/upload-rate-limit.js';
import { isAllowedMimeType, validateMimeType } from '../../services/mime-validator.js';
import { generateStorageKey, getR2BucketName, maxBytesForMime } from '../../services/r2.js';
import {
  createRegionalPresignedDownloadUrl,
  createRegionalPresignedUploadUrl,
  deleteRegionalObject,
  headRegionalObject,
} from '../../services/regional-storage.js';
import { isClamAvailable, scanBuffer } from '../../services/virus-scanner.js';

const log = createLogger({ service: 'document-router' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * F-SEC-18: synchronous magic-byte MIME sniff. Pulls the first 4 KB of the
 * stored object via a Range GET and runs `file-type` against it. Returns
 * the detected MIME, `null` if the bytes were unreadable / undetectable.
 *
 * This is the single-call helper used by `confirmUpload` to reject the
 * "PDF declared, HTML uploaded" attack synchronously (no waiting for the
 * async ClamAV pipeline). The same code path lives inside `scanAndUpdate`
 * for the async retry; both share the same 4 KB Range size so an attacker
 * can't tailor a payload that passes one but trips the other.
 */
async function sniffStoredMime(storageKey: string): Promise<string | null> {
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const { createR2Client } = await import('../../services/r2.js');
  const client = createR2Client();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: getR2BucketName(),
      Key: storageKey,
      Range: 'bytes=0-4099',
    }),
  );
  const bodyBytes = await response.Body?.transformToByteArray();
  if (!bodyBytes) return null;

  const { fileTypeFromBuffer } = await import('file-type');
  const result = await fileTypeFromBuffer(Buffer.from(bodyBytes));
  return result?.mime ?? null;
}

/**
 * Async fire-and-forget: validates MIME type and scans for viruses.
 * Updates document virusScanStatus accordingly.
 * Never throws — all errors are caught and logged.
 */
/** Prisma-like client for document updates (regional or global). */
type DocumentDb = {
  document: {
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
};

async function scanAndUpdate(
  db: DocumentDb,
  documentId: string,
  storageKey: string,
): Promise<void> {
  try {
    // Fetch first 4100 bytes for MIME validation (magic bytes are in the header)
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { createR2Client } = await import('../../services/r2.js');
    const client = createR2Client();

    const getCmd = new GetObjectCommand({
      Bucket: getR2BucketName(),
      Key: storageKey,
      Range: 'bytes=0-4099',
    });

    const response = await client.send(getCmd);
    const bodyBytes = await response.Body?.transformToByteArray();

    if (!bodyBytes) {
      log.error({ storageKey }, 'could not read object body');
      await db.document.update({
        where: { id: documentId },
        data: { virusScanStatus: 'FAILED' },
      });
      return;
    }

    const buffer = Buffer.from(bodyBytes);

    // Step 1: MIME validation via magic bytes
    const mimeResult = await validateMimeType(buffer);
    if (!mimeResult.valid) {
      log.warn(
        { documentId, detectedMime: mimeResult.detectedMime ?? 'unknown' },
        'invalid mime type',
      );
      await db.document.update({
        where: { id: documentId },
        data: { virusScanStatus: 'FAILED' },
      });
      return;
    }

    // Step 2: Virus scan via ClamAV
    const clamReady = await isClamAvailable();
    if (!clamReady) {
      log.error({}, 'clamav not available — marking failed');
      await db.document.update({
        where: { id: documentId },
        data: { virusScanStatus: 'FAILED' },
      });
      return;
    }

    const scanResult = await scanBuffer(buffer);
    if (scanResult.isClean) {
      await db.document.update({
        where: { id: documentId },
        data: { virusScanStatus: 'CLEAN' },
      });
    } else {
      log.warn({ documentId, virusName: scanResult.virusName ?? 'unknown' }, 'virus detected');
      await db.document.update({
        where: { id: documentId },
        data: { virusScanStatus: 'INFECTED' },
      });
    }
  } catch (error) {
    log.error({ err: error, documentId }, 'scan pipeline failed');
    await db.document
      .update({
        where: { id: documentId },
        data: { virusScanStatus: 'FAILED' },
      })
      .catch(e => log.error({ err: e }, 'failed to update status'));
  }
}

// ---------------------------------------------------------------------------
// Document router
// ---------------------------------------------------------------------------

export const documentRouter = router({
  /**
   * Request a presigned upload URL. Creates a Document record and returns
   * the upload URL + storage key for direct client-to-R2 upload.
   */
  requestUpload: tenantProcedure
    .use(requirePermission({ document: ['create'] }))
    .use(uploadRateLimitMiddleware)
    .input(documentRequestUploadSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate MIME type before creating record
      if (!isAllowedMimeType(input.mimeType)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.DOCUMENT_FILE_TYPE_NOT_ALLOWED,
        });
      }

      // F-SEC-19: short-circuit when the client-declared size already
      // exceeds the per-MIME cap. Avoids creating a stub Document row for
      // an upload that R2 would reject anyway.
      const cap = maxBytesForMime(input.mimeType);
      if (input.fileSizeBytes > cap) {
        throw new TRPCError({
          code: 'PAYLOAD_TOO_LARGE',
          message: E.DOCUMENT_FILE_TOO_LARGE,
        });
      }

      // Create Document record
      const doc = await ctx.db.document.create({
        data: {
          organizationId: ctx.organizationId,
          storageKey: '', // Placeholder — updated below
          originalFileName: input.filename,
          mimeType: input.mimeType,
          fileSizeBytes: input.fileSizeBytes,
          checksumSha256: '', // Placeholder until confirmUpload
          documentType: input.documentType,
          status: 'ACTIVE',
          virusScanStatus: 'PENDING',
          source: 'USER_UPLOAD',
          uploadedByUserId: ctx.user?.id,
        },
      });

      // Generate and persist storage key
      const storageKey = generateStorageKey(ctx.organizationId, doc.id, input.filename);
      await ctx.db.document.update({
        where: { id: doc.id },
        data: { storageKey },
      });

      // Generate presigned upload URL (5-minute expiry). F-SEC-19: thread
      // the per-MIME cap into the signed URL so R2 rejects oversize PUTs
      // at the edge.
      const uploadUrl = await createRegionalPresignedUploadUrl(
        storageKey,
        input.mimeType,
        300,
        undefined,
        cap,
      );

      // Create entity link if provided
      if (input.entityType && input.entityId) {
        await ctx.db.documentLink.create({
          data: {
            organizationId: ctx.organizationId,
            documentId: doc.id,
            entityType: input.entityType,
            entityId: input.entityId,
            linkRole: input.linkRole,
          },
        });
      }

      return { documentId: doc.id, uploadUrl, storageKey };
    }),

  /**
   * Confirm that a file was uploaded to R2. Verifies the object exists,
   * enforces the per-MIME byte cap (F-SEC-19), runs synchronous magic-byte
   * MIME sniffing against the declared mimeType (F-SEC-18), and only then
   * triggers the async virus-scan pipeline.
   *
   * On any guard failure the R2 object is deleted before the error so the
   * attacker can't retain a placeholder for later use.
   */
  confirmUpload: tenantProcedure
    .use(requirePermission({ document: ['create'] }))
    .input(documentConfirmUploadSchema)
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.db.document.findFirst({
        where: {
          id: input.documentId,
          organizationId: ctx.organizationId,
        },
      });

      if (!doc) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.DOCUMENT_NOT_FOUND,
        });
      }

      // Verify object exists in R2
      let headResponse: HeadObjectCommandOutput;
      try {
        headResponse = await headRegionalObject(doc.storageKey);
      } catch {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.DOCUMENT_NOT_IN_STORAGE,
        });
      }

      // F-SEC-19: re-verify size against the per-MIME cap. The presigned
      // PUT URL was already signed with ContentLength, but a future code
      // path that uses a different presigner might bypass that — this is
      // the second line of defence.
      const cap = maxBytesForMime(doc.mimeType);
      const actualBytes = headResponse.ContentLength ?? 0;
      if (actualBytes > cap) {
        log.warn(
          { documentId: doc.id, mimeType: doc.mimeType, actualBytes, cap },
          'confirmUpload rejected: oversize',
        );
        await deleteRegionalObject(doc.storageKey).catch(err =>
          log.error({ err, storageKey: doc.storageKey }, 'failed to delete oversize object'),
        );
        throw new TRPCError({
          code: 'PAYLOAD_TOO_LARGE',
          message: E.DOCUMENT_FILE_TOO_LARGE,
        });
      }

      // F-SEC-18: synchronous MIME sniff. Pulls the first 4 KB from R2 via
      // a Range GET, runs `file-type` against the magic bytes, and rejects
      // (+ deletes the object) if the detected MIME does not match the
      // declared `doc.mimeType`. Closes the "PDF declared, HTML uploaded"
      // gap that bypasses CSP via inline rendering paths.
      const sniffed = await sniffStoredMime(doc.storageKey).catch(err => {
        log.warn({ err, storageKey: doc.storageKey }, 'mime sniff failed');
        return null;
      });
      if (sniffed === null || sniffed !== doc.mimeType) {
        log.warn(
          { documentId: doc.id, declared: doc.mimeType, sniffed },
          'confirmUpload rejected: mime mismatch',
        );
        await deleteRegionalObject(doc.storageKey).catch(err =>
          log.error(
            { err, storageKey: doc.storageKey },
            'failed to delete mime-mismatched object',
          ),
        );
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.DOCUMENT_MIME_MISMATCH,
        });
      }

      // Update file size from actual R2 object
      const updated = await ctx.db.document.update({
        where: { id: doc.id },
        data: {
          fileSizeBytes: actualBytes || doc.fileSizeBytes,
        },
      });

      // Fire-and-forget async scan pipeline (ClamAV — slow path)
      void scanAndUpdate(ctx.db, doc.id, doc.storageKey);

      return updated;
    }),

  /**
   * Get a short-lived presigned download URL for a document.
   * Blocks downloads of infected files.
   */
  getDownloadUrl: tenantProcedure
    .use(requirePermission({ document: ['read'] }))
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const doc = await ctx.db.document.findFirst({
        where: {
          id: input.documentId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!doc) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.DOCUMENT_NOT_FOUND,
        });
      }

      // F-SEC-15: block downloads for any non-CLEAN scan status. The uploader
      // may download their own file while the scan is still pending/failed —
      // they already have the bytes locally. Everyone else is blocked until
      // the async ClamAV pipeline confirms the file is clean.
      if (doc.virusScanStatus !== 'CLEAN') {
        const isUploader = !!ctx.user?.id && doc.uploadedByUserId === ctx.user.id;
        if (!isUploader || doc.virusScanStatus === 'INFECTED') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message:
              doc.virusScanStatus === 'INFECTED' ? E.DOCUMENT_INFECTED : 'documentScanPending',
          });
        }
      }

      const url = await createRegionalPresignedDownloadUrl(doc.storageKey, 900);
      return { url, expiresIn: 900 };
    }),

  /**
   * List documents with pagination and filtering.
   * Supports filtering by entity link (contractor/contract), document type, and status.
   */
  list: tenantProcedure
    .use(requirePermission({ document: ['read'] }))
    .input(documentListSchema)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, entityType, entityId, documentType, status } = input;

      const where: Prisma.DocumentWhereInput = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      };

      // Filter by entity link (join through DocumentLink)
      if (entityType && entityId) {
        const linkedDocIds = await ctx.db.documentLink.findMany({
          where: {
            organizationId: ctx.organizationId,
            entityType,
            entityId,
          },
          select: { documentId: true },
        });
        where.id = { in: linkedDocIds.map(l => l.documentId) };
      }

      if (documentType?.length) {
        where.documentType = { in: documentType };
      }

      if (status?.length) {
        where.status = { in: status };
      }

      const [documents, totalCount] = await Promise.all([
        ctx.db.document.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            links: true,
          },
        }),
        ctx.db.document.count({ where }),
      ]);

      return { items: documents, totalCount, page, pageSize };
    }),

  /**
   * Upload a new version of an existing document.
   * Marks the old document as SUPERSEDED and copies all entity links.
   */
  uploadNewVersion: tenantProcedure
    .use(requirePermission({ document: ['create'] }))
    .use(uploadRateLimitMiddleware)
    .input(documentVersionUploadSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate MIME type
      if (!isAllowedMimeType(input.mimeType)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.DOCUMENT_FILE_TYPE_NOT_ALLOWED,
        });
      }

      // F-SEC-19: same per-MIME byte cap as requestUpload.
      const cap = maxBytesForMime(input.mimeType);
      if (input.fileSizeBytes > cap) {
        throw new TRPCError({
          code: 'PAYLOAD_TOO_LARGE',
          message: E.DOCUMENT_FILE_TOO_LARGE,
        });
      }

      const result = await ctx.db.$transaction(async tx => {
        // Find existing document
        const existing = await tx.document.findFirst({
          where: {
            id: input.existingDocumentId,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          include: { links: true },
        });

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.DOCUMENT_NOT_FOUND,
          });
        }

        if (existing.status !== 'ACTIVE') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.DOCUMENT_NOT_ACTIVE,
          });
        }

        // Mark existing document as SUPERSEDED
        await tx.document.update({
          where: { id: existing.id },
          data: { status: 'SUPERSEDED' },
        });

        // Create new document record
        const newDoc = await tx.document.create({
          data: {
            organizationId: ctx.organizationId,
            storageKey: '', // Placeholder
            originalFileName: input.filename,
            mimeType: input.mimeType,
            fileSizeBytes: input.fileSizeBytes,
            checksumSha256: '',
            documentType: existing.documentType,
            status: 'ACTIVE',
            visibility: existing.visibility,
            virusScanStatus: 'PENDING',
            source: existing.source,
            uploadedByUserId: ctx.user?.id,
          },
        });

        // Generate storage key and update
        const storageKey = generateStorageKey(ctx.organizationId, newDoc.id, input.filename);
        await tx.document.update({
          where: { id: newDoc.id },
          data: { storageKey },
        });

        // Copy all document links from old to new
        if (existing.links.length > 0) {
          await tx.documentLink.createMany({
            data: existing.links.map(link => ({
              organizationId: ctx.organizationId,
              documentId: newDoc.id,
              entityType: link.entityType,
              entityId: link.entityId,
              linkRole: link.linkRole,
            })),
          });
        }

        // Generate presigned upload URL with per-MIME size cap (F-SEC-19).
        const uploadUrl = await createRegionalPresignedUploadUrl(
          storageKey,
          input.mimeType,
          300,
          undefined,
          cap,
        );

        return { documentId: newDoc.id, uploadUrl, storageKey };
      });

      return result;
    }),

  /**
   * Get version history for a document by finding all documents
   * linked to the same entities.
   */
  getVersionHistory: tenantProcedure
    .use(requirePermission({ document: ['read'] }))
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const doc = await ctx.db.document.findFirst({
        where: {
          id: input.documentId,
          organizationId: ctx.organizationId,
        },
        include: { links: true },
      });

      if (!doc) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.DOCUMENT_NOT_FOUND,
        });
      }

      if (doc.links.length === 0) {
        return [doc];
      }

      // Find all documents linked to the same entity as this document
      const firstLink = doc.links[0];
      if (!firstLink) return [doc];
      const relatedLinks = await ctx.db.documentLink.findMany({
        where: {
          organizationId: ctx.organizationId,
          entityType: firstLink.entityType,
          entityId: firstLink.entityId,
        },
        select: { documentId: true },
      });

      const relatedDocIds = [...new Set(relatedLinks.map(l => l.documentId))];

      const documents = await ctx.db.document.findMany({
        where: {
          id: { in: relatedDocIds },
          organizationId: ctx.organizationId,
          documentType: doc.documentType, // Same type for version chain
        },
        orderBy: { createdAt: 'desc' },
      });

      return documents;
    }),

  /**
   * Soft-delete a document and clean up storage + links.
   */
  delete: tenantProcedure
    .use(requirePermission({ document: ['delete'] }))
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.db.document.findFirst({
        where: {
          id: input.documentId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!doc) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.DOCUMENT_NOT_FOUND,
        });
      }

      // Soft-delete the document
      await ctx.db.document.update({
        where: { id: doc.id },
        data: { deletedAt: new Date() },
      });

      // Remove R2 object
      try {
        await deleteRegionalObject(doc.storageKey);
      } catch (error) {
        log.error({ err: error, storageKey: doc.storageKey }, 'failed to delete r2 object');
      }

      // Remove associated document links
      await ctx.db.documentLink.deleteMany({
        where: {
          documentId: doc.id,
          organizationId: ctx.organizationId,
        },
      });

      return { success: true };
    }),

  /**
   * Link a document to a contractor or contract entity.
   */
  linkToEntity: tenantProcedure
    .use(requirePermission({ document: ['create'] }))
    .input(documentLinkSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify document belongs to org
      const doc = await ctx.db.document.findFirst({
        where: {
          id: input.documentId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!doc) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.DOCUMENT_NOT_FOUND,
        });
      }

      const link = await ctx.db.documentLink.create({
        data: {
          organizationId: ctx.organizationId,
          documentId: input.documentId,
          entityType: input.entityType,
          entityId: input.entityId,
          linkRole: input.linkRole,
        },
      });

      return link;
    }),
});
