import { canStartDeprovisioning } from '@contractor-ops/idp-saga';
import { getIdpAuditLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  DEPROVISIONING_ASSIGNMENT_NOT_FOUND,
  DEPROVISIONING_COOLDOWN_ACTIVE,
  DEPROVISIONING_NO_EXTERNAL_USER,
  DEPROVISIONING_STEP_NOT_FOUND,
} from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { tenantProcedure } from '../../middleware/tenant';

const auditLog = getIdpAuditLogger();

// Phase 76 ships only Google Workspace as a real Deprovisionable adapter (Plan 76-09).
// Phases 77-78 add Slack/Entra/Okta/GitHub — each gets two steps (suspend + revoke).
const PROVIDERS_FOR_RUN = ['GOOGLE_WORKSPACE'] as const;
const STEP_KINDS = ['SUSPEND_ACCOUNT', 'REVOKE_ALL_SESSIONS'] as const;

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
        DEPROVISIONING_ASSIGNMENT_NOT_FOUND,
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

  /**
   * Phase 76 D-03 — start a deprovisioning run.
   *
   * Re-runs the cooldown gate server-side (UI cannot bypass), then in ONE transaction
   * inserts the run + N steps (provider × stepKind) and flips status to IN_PROGRESS.
   * After commit, fans out N INDEPENDENT QStash jobs (no Promise.allSettled — Pitfall 10).
   * Idempotent via the unique idempotencyKey: a P2002 collision returns the existing run.
   */
  startDeprovisioningRun: tenantProcedure
    .input(
      z.object({
        assignmentId: z.string().min(1),
        idempotencyKey: z.string().min(8).max(128),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const assignment = await findOrThrow(
        () =>
          ctx.db.contractorAssignment.findFirst({
            where: { id: input.assignmentId, organizationId: ctx.organizationId },
            select: {
              id: true,
              status: true,
              endedAt: true,
              contractorId: true,
              contractor: { select: { id: true, countryCode: true, email: true } },
            },
          }),
        DEPROVISIONING_ASSIGNMENT_NOT_FOUND,
      );

      const decision = canStartDeprovisioning({
        endedAt: assignment.endedAt ?? null,
        jurisdictionTz: COUNTRY_TZ[assignment.contractor.countryCode] ?? DEFAULT_JURISDICTION_TZ,
        status: assignment.status,
      });
      if (!decision.allowed) {
        // Structured cooldown detail (reason + earliestDate) is in the audit log and the
        // getDeprovisioningEligibility query; the message is an i18n error key.
        throw new TRPCError({ code: 'FORBIDDEN', message: DEPROVISIONING_COOLDOWN_ACTIVE });
      }

      const externalUserId = assignment.contractor.email;
      if (!externalUserId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: DEPROVISIONING_NO_EXTERNAL_USER,
        });
      }

      try {
        const run = await ctx.db.$transaction(async tx => {
          const created = await tx.deprovisioningRun.create({
            data: {
              organizationId: ctx.organizationId,
              contractorId: assignment.contractorId,
              assignmentId: assignment.id,
              triggeredByUserId: ctx.user.id,
              idempotencyKey: input.idempotencyKey,
              status: 'PENDING',
              steps: {
                create: PROVIDERS_FOR_RUN.flatMap(provider =>
                  STEP_KINDS.map(stepKind => ({
                    organizationId: ctx.organizationId,
                    provider,
                    stepKind,
                    externalUserId,
                  })),
                ),
              },
            },
            select: {
              id: true,
              steps: { select: { id: true, provider: true, stepKind: true, externalUserId: true } },
            },
          });
          await tx.deprovisioningRun.update({
            where: { id: created.id },
            data: { status: 'IN_PROGRESS' },
          });
          return created;
        });

        // Fan-out AFTER commit — independent QStash jobs (no aggregation). Dynamic
        // import keeps Upstash env out of module-load for tooling/tests.
        const [{ getQStashClient }, { getServerEnv }] = await Promise.all([
          import('@contractor-ops/integrations/services/qstash-client'),
          import('@contractor-ops/validators'),
        ]);
        const stepUrl = `${getServerEnv().API_URL}/idp-deprovisioning/_step-runner`;
        for (const step of run.steps) {
          await getQStashClient().publishJSON({
            url: stepUrl,
            body: {
              runId: run.id,
              stepId: step.id,
              organizationId: ctx.organizationId,
              provider: step.provider,
              stepKind: step.stepKind,
              externalUserId: step.externalUserId,
            },
            retries: 3,
            timeout: '60s',
            deduplicationId: `${run.id}:${step.id}:0`,
          });
        }

        auditLog.info(
          {
            auditEvent: 'deprovision_run_started',
            organizationId: ctx.organizationId,
            userId: ctx.user.id,
            runId: run.id,
          },
          'Deprovisioning run started',
        );
        return { runId: run.id, idempotent: false };
      } catch (err) {
        if (err && typeof err === 'object' && (err as { code?: string }).code === 'P2002') {
          const existing = await ctx.db.deprovisioningRun.findUniqueOrThrow({
            where: { idempotencyKey: input.idempotencyKey },
            select: { id: true },
          });
          return { runId: existing.id, idempotent: true };
        }
        throw err;
      }
    }),

  /**
   * Phase 76 D-04 — manual per-step retry. Idempotent precondition (mirrors v5
   * recreateDraftAfterDrift): only a FAILED step can be retried. Optimistic-concurrency
   * updateMany guards against double-clicks. Enqueues a fresh QStash job with a NEW
   * deduplicationId so a duplicate delivery is dropped while a genuine retry runs.
   */
  retryDeprovisioningStep: tenantProcedure
    .input(z.object({ stepId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const step = await findOrThrow(
        () =>
          ctx.db.deprovisioningStep.findFirst({
            where: { id: input.stepId, run: { organizationId: ctx.organizationId } },
            select: {
              id: true,
              runId: true,
              status: true,
              attempts: true,
              provider: true,
              stepKind: true,
              externalUserId: true,
            },
          }),
        DEPROVISIONING_STEP_NOT_FOUND,
      );

      if (step.status !== 'FAILED') {
        return { noop: true, reason: 'step not in FAILED state' };
      }

      const nextAttempt = step.attempts + 1;

      const updated = await ctx.db.deprovisioningStep.updateMany({
        where: { id: step.id, status: 'FAILED' },
        data: { status: 'PENDING', attempts: 0, lastErrorMessage: null },
      });
      if (updated.count === 0) {
        return { noop: true, reason: 'step state changed concurrently' };
      }

      const [{ getQStashClient }, { getServerEnv }] = await Promise.all([
        import('@contractor-ops/integrations/services/qstash-client'),
        import('@contractor-ops/validators'),
      ]);
      await getQStashClient().publishJSON({
        url: `${getServerEnv().API_URL}/idp-deprovisioning/_step-runner`,
        body: {
          runId: step.runId,
          stepId: step.id,
          organizationId: ctx.organizationId,
          provider: step.provider,
          stepKind: step.stepKind,
          externalUserId: step.externalUserId,
        },
        retries: 3,
        timeout: '60s',
        deduplicationId: `${step.runId}:${step.id}:${nextAttempt}`,
      });

      auditLog.info(
        {
          auditEvent: 'deprovision_step_retried',
          organizationId: ctx.organizationId,
          userId: ctx.user.id,
          runId: step.runId,
          stepId: step.id,
          stepKind: step.stepKind,
          provider: step.provider,
        },
        'Deprovisioning step manually retried',
      );

      return { ok: true };
    }),
});
