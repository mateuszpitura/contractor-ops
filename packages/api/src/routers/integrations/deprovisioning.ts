import { canStartDeprovisioning } from '@contractor-ops/idp-saga';
import { getIdpAuditLogger } from '@contractor-ops/logger';
import { z } from 'zod';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { tenantProcedure } from '../../middleware/tenant';

const auditLog = getIdpAuditLogger();

/**
 * Resolve the contractor's jurisdiction TZ from its ISO-3166-1 alpha-2 country code.
 * The schema has no per-contractor jurisdictionTz column (the Phase 71 `expiryJurisdictionTz`
 * lives on ContractorComplianceItem), so the cooldown gate derives the boundary TZ from the
 * engagement country. Unknown countries fall back to the org-HQ default (Europe/Berlin),
 * which is conservative — the cooldown is computed for ALL valid IANA TZs identically.
 */
const COUNTRY_TZ: Record<string, string> = {
  DE: 'Europe/Berlin',
  GB: 'Europe/London',
  PL: 'Europe/Warsaw',
  SA: 'Asia/Riyadh',
  AE: 'Asia/Dubai',
};
const DEFAULT_JURISDICTION_TZ = 'Europe/Berlin';

export const deprovisioningRouter = router({
  /**
   * Phase 76 D-05/D-07 — Eligibility query.
   *
   * Single source of truth for the 14-day cooldown gate. Consumed by:
   *   - UI: deprovisioning-button disabled state + earliest-date tooltip
   *   - Server: the SAME `canStartDeprovisioning` helper from the
   *     `startDeprovisioningRun` mutation (Plan 76-06) — the UI cannot lie about gate state.
   *
   * Returns `{ allowed, earliestDate?, reason? }`. Emits a single audit-grade log entry
   * per call (SOC2 evidence: admin saw the cooldown state before/instead of deprovisioning).
   */
  getDeprovisioningEligibility: tenantProcedure
    .input(z.object({ assignmentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      // ctx.db is tenant-scoped (RLS); findOrThrow narrows to NOT_FOUND on cross-tenant access.
      const assignment = await findOrThrow(
        () =>
          ctx.db.contractorAssignment.findFirst({
            where: { id: input.assignmentId, organizationId: ctx.organizationId },
            select: {
              id: true,
              status: true,
              endedAt: true,
              contractor: { select: { id: true, countryCode: true } },
            },
          }),
        'Contractor assignment not found',
      );

      const jurisdictionTz =
        COUNTRY_TZ[assignment.contractor.countryCode] ?? DEFAULT_JURISDICTION_TZ;

      const decision = canStartDeprovisioning({
        endedAt: assignment.endedAt ?? null,
        jurisdictionTz,
        status: assignment.status,
      });

      auditLog.info(
        {
          auditEvent: 'deprovision_eligibility_checked',
          organizationId: ctx.organizationId,
          userId: ctx.user.id,
          actionResult: decision.allowed ? 'ALLOWED' : 'COOLDOWN_ACTIVE',
        },
        'Deprovisioning eligibility checked',
      );

      return decision;
    }),
});
