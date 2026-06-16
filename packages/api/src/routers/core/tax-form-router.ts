import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { assertUsExpansionEnabled } from '../../middleware/require-us-expansion-flag';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';

// ---------------------------------------------------------------------------
// Staff read/track surface for US W-form submissions.
//
// Staff get status + treaty claim + expiry and may request/remind a form — but
// NEVER an on-behalf signing path (only the portal beneficial-owner self-cert
// creates a signed record). The full SSN never leaves this boundary: the
// snapshot JSON is not projected and the full-SSN reveal stays on
// `contractor.revealSsn` (contractorPii:read). Form read/track reuses the
// existing `contractor:read` permission — no new permission is introduced
// (the duplicated-owner RBAC pitfall).
//
// The router is conditionally spread into appRouter behind `module.us-expansion`
// (root.ts), and each procedure re-evaluates the flag per request for
// defense-in-depth.
// ---------------------------------------------------------------------------

export const taxFormRouter = router({
  /**
   * Staff list of contractor W-form submissions — status/track only, no PII.
   * Scoped to the staff tenant org; optionally narrowed to one contractor.
   */
  listFormSubmissions: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(z.object({ contractorId: z.string().min(1).optional() }))
    .query(async ({ ctx, input }) => {
      assertUsExpansionEnabled(ctx.organizationId, ctx.region);

      return ctx.db.taxFormSubmission.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(input.contractorId ? { contractorId: input.contractorId } : {}),
        },
        select: {
          id: true,
          contractorId: true,
          formType: true,
          status: true,
          treatyArticle: true,
          treatyRate: true,
          contractorResidency: true,
          signerName: true,
          signedAt: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 200,
      });
    }),

  /**
   * Staff flags a contractor to provide / refresh a W-form. Records an auditable
   * request event; the notification delivery itself is deferred. No signed
   * record is created — staff cannot self-certify on the contractor's behalf.
   */
  requestTaxForm: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(
      z.object({
        contractorId: z.string().min(1),
        formType: z.enum(['W9', 'W8BEN', 'W8BENE']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertUsExpansionEnabled(ctx.organizationId, ctx.region);

      const contractor = await ctx.db.contractor.findUnique({
        where: { id: input.contractorId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!contractor) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.CONTRACTOR_NOT_FOUND });
      }

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        // tenantProcedure guarantees ctx.user — never coalesce to an
        // undefined actor on an authenticated, permission-gated mutation.
        actorId: ctx.user.id,
        action: 'tax.form.requested',
        resourceType: 'CONTRACTOR',
        resourceId: contractor.id,
        metadata: { formType: input.formType },
      });

      return { contractorId: contractor.id, formType: input.formType, requested: true };
    }),
});
