import { authApi } from '@contractor-ops/auth';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { KLEINUNTERNEHMER_DE_ONLY } from '../../errors';
import { router } from '../../init';
import { auditedMutation, auditMutationCtx } from '../../lib/audited-mutation';
import { isDemoOrg } from '../../lib/demo';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';

export const organizationRouter = router({
  /**
   * Get the current active organization details.
   * Requires authenticated user with an active organization.
   *
   * NOTE — historical `create` and `update` procedures were removed because
   * the web client invokes Better Auth's `authClient.organization.{create,update}`
   * directly (see register-form.tsx, org-switcher.tsx). Keeping duplicate
   * tRPC wrappers would have produced two divergent code paths for the same
   * Better Auth call, with no consumer.
   */
  getCurrent: tenantProcedure.query(async ({ ctx }) => {
    const org = await authApi.getFullOrganization({
      headers: ctx.headers,
      query: { organizationId: ctx.organizationId },
    });

    // `isDemo` drives the web-vite DEMO banner. Env-controlled signal only
    // (DEMO_MODE / DEMO_ORG_IDS) — never read from mutable metadata.profile.
    // Returns full-org-or-null (unchanged contract) with `isDemo` attached when
    // an active org is present; a null org has no banner to drive anyway.
    return org ? { ...org, isDemo: isDemoOrg(ctx.organizationId) } : null;
  }),

  // ---------------------------------------------------------------------------
  // Kleinunternehmerregelung toggle (DE-only)
  // ---------------------------------------------------------------------------
  //
  // Flipping this flag has material invoice-generation consequences
  // (forced `KU` rate on all lines, suppressed VAT breakdown, `§ 19 UStG`
  // footer notice). The UI wraps this mutation in an AlertDialog.
  //
  // Country gate: DE only. UK / other-country orgs attempting to call this
  // receive FORBIDDEN — Kleinunternehmerregelung is a German-law construct
  // with no analogue in other jurisdictions.
  // ---------------------------------------------------------------------------
  setKleinunternehmer: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
        select: { countryCode: true, isKleinunternehmer: true },
      });
      if (org.countryCode !== 'DE') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: KLEINUNTERNEHMER_DE_ONLY,
        });
      }

      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'ORGANIZATION_KLEINUNTERNEHMER_TOGGLE',
          resourceType: 'ORGANIZATION',
          resourceId: ctx.organizationId,
          oldValues: { isKleinunternehmer: org.isKleinunternehmer },
          newValues: { isKleinunternehmer: input.enabled },
        },
        async tx => {
          const updated = await tx.organization.update({
            where: { id: ctx.organizationId },
            data: { isKleinunternehmer: input.enabled },
            select: { isKleinunternehmer: true },
          });
          return { isKleinunternehmer: updated.isKleinunternehmer };
        },
      );
    }),
});
