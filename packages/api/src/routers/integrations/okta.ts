import type { Prisma } from '@contractor-ops/db';
import { getFlagSignoff } from '@contractor-ops/feature-flags';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { DEPROVISIONING_PROVIDER_SIGNOFF_PENDING } from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';

// Phase 78 IDP-06 — Okta per-provider connection-lifecycle router.
//
// The per-org ENABLE toggle is owned by `deprovisioning.enableProviderForOrg`
// (extended in 78-06); this router exposes the Okta-scoped status + a thin
// enable mutation delegating to the same Organization.settingsJson storage so
// the Settings UI (78-07) can drive a single provider card. `organizationId` is
// ALWAYS from the session context, NEVER from client input.

const PROVIDER = 'OKTA' as const;
const FLAG_KEY = 'module.idp-deprovisioning-okta';

/** Approved-or-local-bypass gate (mirrors deprovisioning.ts isProviderSignoffSatisfied). */
function isFlagSignoffSatisfied(): boolean {
  if (process.env.FLAG_SIGNOFF_BYPASS === 'local') return true;
  return getFlagSignoff(FLAG_KEY)?.status === 'APPROVED';
}

export const oktaRouter = router({
  /** Per-org Okta deprovisioning status: signoff approval + current enabled flag. */
  getStatus: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .query(async ({ ctx }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { settingsJson: true },
      });
      const settings = (org?.settingsJson as Record<string, unknown>) ?? {};
      const enabledMap = (settings.idpDeprovisioningEnabled as Record<string, boolean>) ?? {};
      return {
        provider: PROVIDER,
        flagApproved: isFlagSignoffSatisfied(),
        enabled: enabledMap[PROVIDER] === true,
      };
    }),

  /**
   * Enable/disable Okta deprovisioning for this org. GATE: refuses to enable
   * while the signoff flag is PENDING (unless FLAG_SIGNOFF_BYPASS=local).
   */
  setEnabled: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.enabled && !isFlagSignoffSatisfied()) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: DEPROVISIONING_PROVIDER_SIGNOFF_PENDING,
        });
      }
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { settingsJson: true },
      });
      const settings = (org?.settingsJson as Record<string, unknown>) ?? {};
      const current = (settings.idpDeprovisioningEnabled as Record<string, boolean>) ?? {};
      const next = {
        ...settings,
        idpDeprovisioningEnabled: { ...current, [PROVIDER]: input.enabled },
      };
      await ctx.db.organization.update({
        where: { id: ctx.organizationId },
        data: { settingsJson: next as Prisma.InputJsonValue },
      });

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user.id,
        action: input.enabled
          ? 'idp.okta.deprovisioning_enabled'
          : 'idp.okta.deprovisioning_disabled',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        metadata: { provider: PROVIDER, enabled: input.enabled },
      });

      return { ok: true, provider: PROVIDER, enabled: input.enabled };
    }),
});
