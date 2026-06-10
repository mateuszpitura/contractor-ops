import type { Prisma } from '@contractor-ops/db';
import { entityIdSchema } from '@contractor-ops/validators';
import { publicApiDocumentListInputSchema } from '@contractor-ops/validators/public-api';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { apiKeyTenantProcedure } from '../../middleware/api-key-auth';
import { requirePermission } from '../../middleware/rbac';
import { createRegionalPresignedDownloadUrl } from '../../services/regional-storage';

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const listInput = publicApiDocumentListInputSchema;

// ---------------------------------------------------------------------------
// Public API document router
// ---------------------------------------------------------------------------

export const publicDocumentRouter = router({
  list: apiKeyTenantProcedure
    .use(requirePermission({ document: ['read'] }))
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, entityType, entityId, sortOrder } = input;

      const where: Prisma.DocumentWhereInput = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      };

      // Filter by entity link via Prisma relation filter (single query, uses JOIN)
      if (entityType && entityId) {
        where.links = {
          some: {
            organizationId: ctx.organizationId,
            entityType,
            entityId,
          },
        };
      }

      const [items, total] = await Promise.all([
        ctx.db.document.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: sortOrder },
          select: {
            id: true,
            originalFileName: true,
            mimeType: true,
            fileSizeBytes: true,
            documentType: true,
            status: true,
            virusScanStatus: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        ctx.db.document.count({ where }),
      ]);

      return { items, total, page, pageSize };
    }),

  getDownloadUrl: apiKeyTenantProcedure
    .use(requirePermission({ document: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      const doc = await ctx.db.document.findFirst({
        where: {
          id: input.id,
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

      // Block downloads for any non-CLEAN scan status.
      // PENDING and FAILED files must never be served to API consumers — only
      // CLEAN files are safe. INFECTED is reported separately for clarity.
      if (doc.virusScanStatus !== 'CLEAN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: doc.virusScanStatus === 'INFECTED' ? E.DOCUMENT_INFECTED : 'documentScanPending',
        });
      }

      const url = await createRegionalPresignedDownloadUrl(doc.storageKey, 900);
      return { url, expiresIn: 900 };
    }),
});
