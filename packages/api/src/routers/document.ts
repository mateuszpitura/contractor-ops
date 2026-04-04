import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@contractor-ops/db";
import {
  documentRequestUploadSchema,
  documentConfirmUploadSchema,
  documentLinkSchema,
  documentListSchema,
  documentVersionUploadSchema,
} from "@contractor-ops/validators";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";
import {
  createPresignedUploadUrl,
  createPresignedDownloadUrl,
  generateStorageKey,
  headObject,
  deleteObject,
} from "../services/r2.js";
import { isAllowedMimeType, validateMimeType } from "../services/mime-validator.js";
import { isClamAvailable, scanBuffer } from "../services/virus-scanner.js";
import { uploadRateLimitMiddleware } from "../middleware/upload-rate-limit.js";
import * as E from "../errors.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strips Prisma class prototype from query results, producing plain
 * JSON-serializable objects so that inferred tRPC router types do NOT
 * reference the generated Prisma client module (avoids TS2742).
 */
function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

/**
 * Async fire-and-forget: validates MIME type and scans for viruses.
 * Updates document virusScanStatus accordingly.
 * Never throws — all errors are caught and logged.
 */
async function scanAndUpdate(documentId: string, storageKey: string): Promise<void> {
  try {
    // Fetch first 4100 bytes for MIME validation (magic bytes are in the header)
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { createR2Client } = await import("../services/r2.js");
    const client = createR2Client();

    const getCmd = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: storageKey,
      Range: "bytes=0-4099",
    });

    const response = await client.send(getCmd);
    const bodyBytes = await response.Body?.transformToByteArray();

    if (!bodyBytes) {
      console.error("[document-scan] Could not read object body for:", storageKey);
      await prisma.document.update({
        where: { id: documentId },
        data: { virusScanStatus: "FAILED" },
      });
      return;
    }

    const buffer = Buffer.from(bodyBytes);

    // Step 1: MIME validation via magic bytes
    const mimeResult = await validateMimeType(buffer);
    if (!mimeResult.valid) {
      console.warn(
        `[document-scan] Invalid MIME type for ${documentId}: detected ${mimeResult.detectedMime ?? "unknown"}`,
      );
      await prisma.document.update({
        where: { id: documentId },
        data: { virusScanStatus: "FAILED" },
      });
      return;
    }

    // Step 2: Virus scan via ClamAV
    const clamReady = await isClamAvailable();
    if (!clamReady) {
      console.error("[document-scan] ClamAV not available — marking FAILED");
      await prisma.document.update({
        where: { id: documentId },
        data: { virusScanStatus: "FAILED" },
      });
      return;
    }

    const scanResult = await scanBuffer(buffer);
    if (scanResult.isClean) {
      await prisma.document.update({
        where: { id: documentId },
        data: { virusScanStatus: "CLEAN" },
      });
    } else {
      console.warn(
        `[document-scan] Virus detected in ${documentId}: ${scanResult.virusName ?? "unknown"}`,
      );
      await prisma.document.update({
        where: { id: documentId },
        data: { virusScanStatus: "INFECTED" },
      });
    }
  } catch (error) {
    console.error("[document-scan] Scan pipeline failed for:", documentId, error);
    await prisma.document
      .update({
        where: { id: documentId },
        data: { virusScanStatus: "FAILED" },
      })
      .catch((e) => console.error("[document-scan] Failed to update status:", e));
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
    .use(requirePermission({ document: ["create"] }))
    .use(uploadRateLimitMiddleware)
    .input(documentRequestUploadSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate MIME type before creating record
      if (!isAllowedMimeType(input.mimeType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: E.DOCUMENT_FILE_TYPE_NOT_ALLOWED,
        });
      }

      // Create Document record
      const doc = await prisma.document.create({
        data: {
          organizationId: ctx.organizationId,
          storageKey: "", // Placeholder — updated below
          originalFileName: input.filename,
          mimeType: input.mimeType,
          fileSizeBytes: input.fileSizeBytes,
          checksumSha256: "", // Placeholder until confirmUpload
          documentType: input.documentType,
          status: "ACTIVE",
          virusScanStatus: "PENDING",
          source: "USER_UPLOAD",
          uploadedByUserId: ctx.user!.id,
        },
      });

      // Generate and persist storage key
      const storageKey = generateStorageKey(ctx.organizationId, doc.id, input.filename);
      await prisma.document.update({
        where: { id: doc.id },
        data: { storageKey },
      });

      // Generate presigned upload URL (5-minute expiry)
      const uploadUrl = await createPresignedUploadUrl(storageKey, input.mimeType, 300);

      // Create entity link if provided
      if (input.entityType && input.entityId) {
        await prisma.documentLink.create({
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
   * Confirm that a file was uploaded to R2. Verifies the object exists
   * and triggers async virus scanning + MIME validation.
   */
  confirmUpload: tenantProcedure
    .use(requirePermission({ document: ["create"] }))
    .input(documentConfirmUploadSchema)
    .mutation(async ({ ctx, input }) => {
      const doc = await prisma.document.findFirst({
        where: {
          id: input.documentId,
          organizationId: ctx.organizationId,
        },
      });

      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.DOCUMENT_NOT_FOUND,
        });
      }

      // Verify object exists in R2
      let headResponse;
      try {
        headResponse = await headObject(doc.storageKey);
      } catch {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.DOCUMENT_NOT_IN_STORAGE,
        });
      }

      // Update file size from actual R2 object
      const updated = await prisma.document.update({
        where: { id: doc.id },
        data: {
          fileSizeBytes: headResponse.ContentLength ?? doc.fileSizeBytes,
        },
      });

      // Fire-and-forget async scan pipeline
      void scanAndUpdate(doc.id, doc.storageKey);

      return plain(updated);
    }),

  /**
   * Get a short-lived presigned download URL for a document.
   * Blocks downloads of infected files.
   */
  getDownloadUrl: tenantProcedure
    .use(requirePermission({ document: ["read"] }))
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const doc = await prisma.document.findFirst({
        where: {
          id: input.documentId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.DOCUMENT_NOT_FOUND,
        });
      }

      if (doc.virusScanStatus === "INFECTED") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: E.DOCUMENT_INFECTED,
        });
      }

      const url = await createPresignedDownloadUrl(doc.storageKey, 900);
      return { url, expiresIn: 900 };
    }),

  /**
   * List documents with pagination and filtering.
   * Supports filtering by entity link (contractor/contract), document type, and status.
   */
  list: tenantProcedure
    .use(requirePermission({ document: ["read"] }))
    .input(documentListSchema)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, entityType, entityId, documentType, status } = input;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      };

      // Filter by entity link (join through DocumentLink)
      if (entityType && entityId) {
        const linkedDocIds = await prisma.documentLink.findMany({
          where: {
            organizationId: ctx.organizationId,
            entityType,
            entityId,
          },
          select: { documentId: true },
        });
        where.id = { in: linkedDocIds.map((l) => l.documentId) };
      }

      if (documentType?.length) {
        where.documentType = { in: documentType };
      }

      if (status?.length) {
        where.status = { in: status };
      }

      const [documents, totalCount] = await Promise.all([
        prisma.document.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          include: {
            links: true,
          },
        }),
        prisma.document.count({ where }),
      ]);

      return { items: plain(documents), totalCount, page, pageSize };
    }),

  /**
   * Upload a new version of an existing document.
   * Marks the old document as SUPERSEDED and copies all entity links.
   */
  uploadNewVersion: tenantProcedure
    .use(requirePermission({ document: ["create"] }))
    .use(uploadRateLimitMiddleware)
    .input(documentVersionUploadSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate MIME type
      if (!isAllowedMimeType(input.mimeType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: E.DOCUMENT_FILE_TYPE_NOT_ALLOWED,
        });
      }

      const result = await prisma.$transaction(async (tx) => {
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
            code: "NOT_FOUND",
            message: E.DOCUMENT_NOT_FOUND,
          });
        }

        if (existing.status !== "ACTIVE") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: E.DOCUMENT_NOT_ACTIVE,
          });
        }

        // Mark existing document as SUPERSEDED
        await tx.document.update({
          where: { id: existing.id },
          data: { status: "SUPERSEDED" },
        });

        // Create new document record
        const newDoc = await tx.document.create({
          data: {
            organizationId: ctx.organizationId,
            storageKey: "", // Placeholder
            originalFileName: input.filename,
            mimeType: input.mimeType,
            fileSizeBytes: input.fileSizeBytes,
            checksumSha256: "",
            documentType: existing.documentType,
            status: "ACTIVE",
            visibility: existing.visibility,
            virusScanStatus: "PENDING",
            source: existing.source,
            uploadedByUserId: ctx.user!.id,
          },
        });

        // Generate storage key and update
        const storageKey = generateStorageKey(
          ctx.organizationId,
          newDoc.id,
          input.filename,
        );
        await tx.document.update({
          where: { id: newDoc.id },
          data: { storageKey },
        });

        // Copy all document links from old to new
        if (existing.links.length > 0) {
          await tx.documentLink.createMany({
            data: existing.links.map((link) => ({
              organizationId: ctx.organizationId,
              documentId: newDoc.id,
              entityType: link.entityType,
              entityId: link.entityId,
              linkRole: link.linkRole,
            })),
          });
        }

        // Generate presigned upload URL
        const uploadUrl = await createPresignedUploadUrl(
          storageKey,
          input.mimeType,
          300,
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
    .use(requirePermission({ document: ["read"] }))
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const doc = await prisma.document.findFirst({
        where: {
          id: input.documentId,
          organizationId: ctx.organizationId,
        },
        include: { links: true },
      });

      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.DOCUMENT_NOT_FOUND,
        });
      }

      if (doc.links.length === 0) {
        return plain([doc]);
      }

      // Find all documents linked to the same entity as this document
      const firstLink = doc.links[0]!;
      const relatedLinks = await prisma.documentLink.findMany({
        where: {
          organizationId: ctx.organizationId,
          entityType: firstLink.entityType,
          entityId: firstLink.entityId,
        },
        select: { documentId: true },
      });

      const relatedDocIds = [...new Set(relatedLinks.map((l) => l.documentId))];

      const documents = await prisma.document.findMany({
        where: {
          id: { in: relatedDocIds },
          organizationId: ctx.organizationId,
          documentType: doc.documentType, // Same type for version chain
        },
        orderBy: { createdAt: "desc" },
      });

      return plain(documents);
    }),

  /**
   * Soft-delete a document and clean up storage + links.
   */
  delete: tenantProcedure
    .use(requirePermission({ document: ["delete"] }))
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await prisma.document.findFirst({
        where: {
          id: input.documentId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.DOCUMENT_NOT_FOUND,
        });
      }

      // Soft-delete the document
      await prisma.document.update({
        where: { id: doc.id },
        data: { deletedAt: new Date() },
      });

      // Remove R2 object
      try {
        await deleteObject(doc.storageKey);
      } catch (error) {
        console.error("[document-delete] Failed to delete R2 object:", doc.storageKey, error);
      }

      // Remove associated document links
      await prisma.documentLink.deleteMany({
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
    .use(requirePermission({ document: ["create"] }))
    .input(documentLinkSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify document belongs to org
      const doc = await prisma.document.findFirst({
        where: {
          id: input.documentId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.DOCUMENT_NOT_FOUND,
        });
      }

      const link = await prisma.documentLink.create({
        data: {
          organizationId: ctx.organizationId,
          documentId: input.documentId,
          entityType: input.entityType,
          entityId: input.entityId,
          linkRole: input.linkRole,
        },
      });

      return plain(link);
    }),
});
