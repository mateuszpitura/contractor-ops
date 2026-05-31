import type { Prisma } from '@contractor-ops/db';
import { getFlagSignoff } from '@contractor-ops/feature-flags';
import { z } from 'zod';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';

// Phase 78 IDP-05 — Microsoft Entra ID per-provider connection-lifecycle router.
//
// The per-org ENABLE toggle is owned by `deprovisioning.enableProviderForOrg`
// (Phase 77 D-15 shape, extended in 78-06 for all five providers); this router
// exposes the Entra-scoped status + a thin enable mutation that delegates to the
// same Organization.settingsJson.idpDeprovisioningEnabled storage so the Settings
// UI (78-07) can drive a single provider card. `organizationId` is ALWAYS derived
// from the session context, NEVER from client input (no tenant id in any schema).

const PROVIDER = 'ENTRA' as const;
const FLAG_KEY = 'module.idp-deprovisioning-entra';

/** Approved-or-local-bypass gate (mirrors deprovisioning.ts isProviderSignoffSatisfied). */
function isFlagSignoffSatisfied(): boolean {
  if (process.env.FLAG_SIGNOFF_BYPASS === 'local') return true;
  return getFlagSignoff(FLAG_KEY)?.status === 'APPROVED';
}

export const entraRouter = router({
  /** Per-org Entra deprovisioning status: signoff approval + current enabled flag. */
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
   * Enable/disable Entra deprovisioning for this org. GATE: refuses to enable
   * while the signoff flag is PENDING (unless FLAG_SIGNOFF_BYPASS=local).
   */
  setEnabled: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.enabled && !isFlagSignoffSatisfied()) {
        throw new Error('idp-deprovisioning-entra signoff is PENDING — cannot enable');
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
          ? 'idp.entra.deprovisioning_enabled'
          : 'idp.entra.deprovisioning_disabled',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        metadata: { provider: PROVIDER, enabled: input.enabled },
      });

      // Status only — never echo any credential/secret.
      return { ok: true, provider: PROVIDER, enabled: input.enabled };
    }),
});
