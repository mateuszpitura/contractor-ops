import type { Prisma } from '@contractor-ops/db';
import {
  entityIdSchema,
  publicApiClassificationListInputSchema,
} from '@contractor-ops/validators/public-api';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { cursorClause, paginateByLastKeptUndefined } from '../../lib/pagination';
import { publicOrderBy } from '../../lib/public-cursor';
import { apiKeyTenantProcedure } from '../../middleware/api-key-auth';
import { requirePermission } from '../../middleware/rbac';

// Classifications are READ-ONLY over the public API. The raw `answers`/`outcome`
// JSON (the determination content) is intentionally NOT exposed — only the
// status/country/timestamps — per the classification-liability posture.
const classificationSelect = {
  id: true,
  countryCode: true,
  status: true,
  policyRuleSetVersion: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClassificationAssessmentSelect;

export const publicClassificationRouter = router({
  list: apiKeyTenantProcedure
    .use(requirePermission({ classification: ['read'] }))
    .input(publicApiClassificationListInputSchema)
    .query(async ({ ctx, input }) => {
      const where: Prisma.ClassificationAssessmentWhereInput = {
        organizationId: ctx.organizationId,
      };
      if (input.filter?.status)
        where.status = input.filter.status as Prisma.ClassificationAssessmentWhereInput['status'];
      if (input.filter?.countryCode) where.countryCode = input.filter.countryCode;

      const rows = await ctx.db.classificationAssessment.findMany({
        where,
        orderBy: publicOrderBy(input.sort),
        select: classificationSelect,
        ...cursorClause({ cursor: input.cursor, limit: input.limit }),
      });
      return paginateByLastKeptUndefined(rows, { cursor: input.cursor, limit: input.limit });
    }),

  getById: apiKeyTenantProcedure
    .use(requirePermission({ classification: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      const assessment = await ctx.db.classificationAssessment.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        select: classificationSelect,
      });
      if (!assessment)
        throw new TRPCError({ code: 'NOT_FOUND', message: E.CLASSIFICATION_ASSESSMENT_NOT_FOUND });
      return assessment;
    }),
});
