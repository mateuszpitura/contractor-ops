import type { Prisma } from '@contractor-ops/db';
import {
  entityIdSchema,
  publicApiComplianceDocumentListInputSchema,
} from '@contractor-ops/validators/public-api';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { cursorClause, paginateByLastKeptUndefined } from '../../lib/pagination';
import { publicOrderBy } from '../../lib/public-cursor';
import { apiKeyTenantProcedure } from '../../middleware/api-key-auth';
import { requirePermission } from '../../middleware/rbac';

// Compliance documents = generated classification documents (defense bundles,
// determination PDFs). Content is stored elsewhere; the read exposes metadata.
const complianceDocumentSelect = {
  id: true,
  classificationAssessmentId: true,
  kind: true,
  sha256Hash: true,
  generatedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClassificationDocumentSelect;

export const publicComplianceDocumentRouter = router({
  list: apiKeyTenantProcedure
    .use(requirePermission({ document: ['read'] }))
    .input(publicApiComplianceDocumentListInputSchema)
    .query(async ({ ctx, input }) => {
      const where: Prisma.ClassificationDocumentWhereInput = {
        organizationId: ctx.organizationId,
      };
      if (input.filter?.kind)
        where.kind = input.filter.kind as Prisma.ClassificationDocumentWhereInput['kind'];
      if (input.filter?.classificationAssessmentId)
        where.classificationAssessmentId = input.filter.classificationAssessmentId;

      const rows = await ctx.db.classificationDocument.findMany({
        where,
        orderBy: publicOrderBy(input.sort),
        select: complianceDocumentSelect,
        ...cursorClause({ cursor: input.cursor, limit: input.limit }),
      });
      return paginateByLastKeptUndefined(rows, { cursor: input.cursor, limit: input.limit });
    }),

  getById: apiKeyTenantProcedure
    .use(requirePermission({ document: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      const doc = await ctx.db.classificationDocument.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        select: complianceDocumentSelect,
      });
      if (!doc)
        throw new TRPCError({ code: 'NOT_FOUND', message: E.CLASSIFICATION_DOCUMENT_NOT_FOUND });
      return doc;
    }),
});
