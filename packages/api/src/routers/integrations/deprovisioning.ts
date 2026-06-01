import type { Prisma } from '@contractor-ops/db';
import { getFlagSignoff } from '@contractor-ops/feature-flags';
import { canStartDeprovisioning, MAX_ATTEMPTS, recomputeRunStatus } from '@contractor-ops/idp-saga';
import { getIdpAuditLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  DEPROVISIONING_ASSIGNMENT_NOT_FOUND,
  DEPROVISIONING_COOLDOWN_ACTIVE,
  DEPROVISIONING_INTEGRATION_NOT_CONFIGURED,
  DEPROVISIONING_NO_EXTERNAL_USER,
  DEPROVISIONING_PROVIDER_SIGNOFF_PENDING,
  DEPROVISIONING_STEP_NOT_FOUND,
  DEPROVISIONING_STEP_NOT_OVERRIDABLE,
} from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { CacheKeys, invalidateByPrefix } from '../../services/cache';
import { getImpactPreview } from '../../services/idp-impact-preview';

const auditLog = getIdpAuditLogger();

// Phase 77 D-15 / Phase 78 D-12 — single source-of-truth for the five
// Deprovisionable providers. Derive the TS type from the schema so the tuple,
// the Zod enum, and the type alias can never drift apart. The key strings mirror
// the saga DeprovisioningProvider enum (ENTRA — NOT ENTRA_ID).
export const DEPROVISIONING_TOGGLE_PROVIDERS = [
  'GOOGLE_WORKSPACE',
  'SLACK',
  'ENTRA',
  'OKTA',
  'GITHUB',
] as const;

const deprovisioningProviderSchema = z.enum(DEPROVISIONING_TOGGLE_PROVIDERS);

export type DeprovisioningToggleProvider = z.infer<typeof deprovisioningProviderSchema>;

const PROVIDER_FLAG_KEY: Record<DeprovisioningToggleProvider, string> = {
  GOOGLE_WORKSPACE: 'module.idp-deprovisioning-gws',
  SLACK: 'module.idp-deprovisioning-slack',
  ENTRA: 'module.idp-deprovisioning-entra',
  OKTA: 'module.idp-deprovisioning-okta',
  GITHUB: 'module.idp-deprovisioning-github',
};

/** A provider may be enabled only when its signoff flag is APPROVED (or local bypass). */
export function isProviderSignoffSatisfied(provider: DeprovisioningToggleProvider): boolean {
  if (process.env.FLAG_SIGNOFF_BYPASS === 'local') return true;
  return getFlagSignoff(PROVIDER_FLAG_KEY[provider])?.status === 'APPROVED';
}

const MANUAL_OVERRIDE_CATEGORIES = [
  'verified_via_vendor_console',
  'user_already_inactive',
  'provider_endpoint_deprecated',
  'transient_provider_issue_resolved',
  'other',
] as const;

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
          // Composite unique — must filter by organizationId to avoid returning a different
          // tenant's run when the key collides across orgs (WR-1 fix).
          const existing = await ctx.db.deprovisioningRun.findUniqueOrThrow({
            where: {
              organizationId_idempotencyKey: {
                organizationId: ctx.organizationId,
                idempotencyKey: input.idempotencyKey,
              },
            },
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

      // `nextAttempt` is used only for the QStash deduplicationId to ensure the
      // re-enqueued job has a different id from the original enqueue (which used
      // `:${originalAttempts}`). The row resets to attempts:0 deliberately — a
      // manual retry grants a fresh MAX_ATTEMPTS budget; the dedup id only needs
      // per-enqueue uniqueness, not a match to the actual attempt counter.
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

  /**
   * Phase 77 — read a deprovisioning run with its steps (saga run view, 77-05).
   * Org-scoped; surfaces the per-step status (incl. LIKELY_GONE-equivalent
   * SUCCEEDED + MANUAL_COMPLETED), errorClass, attempts, and manual-override
   * metadata so the UI can render the override badge + the per-failed-step button.
   */
  getDeprovisioningRun: tenantProcedure
    .use(requirePermission({ integration: ['read'] }))
    .input(z.object({ runId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return findOrThrow(
        () =>
          ctx.db.deprovisioningRun.findFirst({
            where: { id: input.runId, organizationId: ctx.organizationId },
            select: {
              id: true,
              status: true,
              startedAt: true,
              finishedAt: true,
              steps: {
                select: {
                  id: true,
                  provider: true,
                  stepKind: true,
                  status: true,
                  attempts: true,
                  errorClass: true,
                  lastErrorMessage: true,
                  manualOverrideCategory: true,
                  manualOverrideNote: true,
                  manualOverriddenByUserId: true,
                  manualOverriddenAt: true,
                  finishedAt: true,
                },
                orderBy: [{ provider: 'asc' }, { stepKind: 'asc' }],
              },
            },
          }),
        DEPROVISIONING_STEP_NOT_FOUND,
      );
    }),

  /**
   * Phase 77 D-01/D-02/D-03 — pre-flight impact preview for an assignment + provider.
   * Cache-fronted (5 min) in getImpactPreview; forceRefresh bypasses. On adapter
   * failure returns a structured outcome the admin-choice flow renders. When the admin
   * proceeds without a preview, an `idp.preview.failed_proceed` audit line is emitted.
   */
  describeImpact: tenantProcedure
    .use(requirePermission({ integration: ['read'] }))
    .input(
      z.object({
        assignmentId: z.string().min(1),
        provider: z.enum(['GOOGLE_WORKSPACE', 'SLACK']),
        forceRefresh: z.boolean().optional(),
        proceedWithoutPreview: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const assignment = await findOrThrow(
        () =>
          ctx.db.contractorAssignment.findFirst({
            where: { id: input.assignmentId, organizationId: ctx.organizationId },
            select: { id: true, contractor: { select: { email: true } } },
          }),
        DEPROVISIONING_ASSIGNMENT_NOT_FOUND,
      );
      const externalUserId = assignment.contractor.email;
      if (!externalUserId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: DEPROVISIONING_NO_EXTERNAL_USER,
        });
      }

      const result = await getImpactPreview({
        db: ctx.db as unknown as Parameters<typeof getImpactPreview>[0]['db'],
        organizationId: ctx.organizationId,
        provider: input.provider,
        externalUserId,
        forceRefresh: input.forceRefresh,
      });

      if (!result.ok && input.proceedWithoutPreview) {
        auditLog.info(
          {
            auditEvent: 'idp.preview.failed_proceed',
            organizationId: ctx.organizationId,
            userId: ctx.user.id,
            provider: input.provider,
            externalUserId,
            actionResult: result.kind,
          },
          'Admin proceeded without an impact preview',
        );
      }

      return result;
    }),

  /**
   * Phase 77 D-12/D-13 — mark a terminally-failed step MANUAL_COMPLETED with an
   * audited written reason. Mirrors Phase 74 overrideBlockingTask: owner/admin only,
   * single $transaction (columns + status + AuditLog + recomputeRunStatus). The free-text
   * note is stored in the column only — never logged raw.
   */
  overrideStepFailure: tenantProcedure
    .use(requirePermission({ idp: ['override_step_failure'] }))
    .input(
      z.object({
        stepId: z.string().min(1),
        category: z.enum(MANUAL_OVERRIDE_CATEGORIES),
        note: z.string().min(20).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const step = await findOrThrow(
        () =>
          ctx.db.deprovisioningStep.findFirst({
            where: { id: input.stepId, run: { organizationId: ctx.organizationId } },
            select: { id: true, runId: true, status: true, attempts: true, provider: true },
          }),
        DEPROVISIONING_STEP_NOT_FOUND,
      );

      if (!(step.status === 'FAILED' && step.attempts >= MAX_ATTEMPTS)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: DEPROVISIONING_STEP_NOT_OVERRIDABLE,
        });
      }

      const runStatus = await ctx.db.$transaction(async tx => {
        await tx.deprovisioningStep.update({
          where: { id: step.id },
          data: {
            status: 'MANUAL_COMPLETED',
            manualOverrideCategory: input.category,
            manualOverrideNote: input.note,
            manualOverriddenByUserId: ctx.user.id,
            manualOverriddenAt: new Date(),
          },
        });
        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user.id,
          action: 'idp.deprovisioning.step.manual_completed',
          resourceType: 'WORKFLOW_TASK_RUN',
          resourceId: step.id,
          // manualOverrideNote is DELIBERATELY excluded — it lives only in the column.
          newValues: {
            runId: step.runId,
            provider: step.provider,
            category: input.category,
            overriddenByUserId: ctx.user.id,
          },
          tx: tx as unknown as Parameters<typeof writeAuditLog>[0]['tx'],
        });
        return recomputeRunStatus(
          tx as unknown as Parameters<typeof recomputeRunStatus>[0],
          step.runId,
        );
      });

      // D-12 — when the run reaches terminal status the parent offboarding
      // ACCESS_REVOKE task auto-completes; capture it as a separate audit entry.
      if (runStatus === 'COMPLETED' || runStatus === 'PARTIAL_FAILURE') {
        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user.id,
          action: 'idp.deprovisioning.run.completed_via_override',
          resourceType: 'WORKFLOW_RUN',
          resourceId: step.runId,
          newValues: { runStatus, triggeredByStepId: step.id },
        });
      }

      return { ok: true, runStatus };
    }),

  /**
   * Phase 77 D-14 — Slack org-grid OAuth connect entry point. Returns the local
   * API-host OAuth start URL for the org-grid flow (mirrors getOAuthUrlGeneric's
   * indirect F-SEC-05 pattern: the /api/oauth/slack-org-grid/start route mints the
   * single-use OAuthChallenge + cookie, then 302s to Slack with the org-level
   * scopes from getOrgGridOAuthConfig). The callback creates a distinct
   * SLACK_ORG_GRID connection (marked via configJson.connectionSubKind) and probes
   * Enterprise-Grid availability into scopeCapabilities.unavailableReason.
   */
  connectSlackOrgGrid: tenantProcedure
    .use(requirePermission({ integration: ['update'] }))
    .query(async () => {
      const [{ getServerEnv }] = await Promise.all([import('@contractor-ops/validators')]);
      const apiUrl = getServerEnv().API_URL;
      if (!apiUrl) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: DEPROVISIONING_INTEGRATION_NOT_CONFIGURED,
        });
      }
      return { url: `${apiUrl}/api/oauth/slack-org-grid/start` };
    }),

  /**
   * Phase 77 D-15 — per-provider toggle-table state for the settings UI: each
   * supported provider's connection status, signoff-flag approval, and current
   * per-org enabled flag. Drives the enable table (disabled when flag != APPROVED).
   */
  getProviderToggleState: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .query(async ({ ctx }) => {
      const [org, connections] = await Promise.all([
        ctx.db.organization.findUnique({
          where: { id: ctx.organizationId },
          select: { settingsJson: true },
        }),
        ctx.db.integrationConnection.findMany({
          where: {
            organizationId: ctx.organizationId,
            // Only GWS/SLACK/GITHUB exist in the IntegrationProvider enum; ENTRA
            // and OKTA have no IntegrationConnection row yet (no enum value), so
            // their `connected` state is derived from the per-org settings only.
            provider: { in: ['GOOGLE_WORKSPACE', 'SLACK', 'GITHUB'] },
            status: 'CONNECTED',
          },
          select: { provider: true, configJson: true },
        }),
      ]);
      const settings = (org?.settingsJson as Record<string, unknown>) ?? {};
      const enabledMap = (settings.idpDeprovisioningEnabled as Record<string, boolean>) ?? {};

      const providers = DEPROVISIONING_TOGGLE_PROVIDERS.map(provider => ({
        provider,
        connected:
          provider === 'SLACK'
            ? connections.some(
                c =>
                  c.provider === 'SLACK' &&
                  !!c.configJson &&
                  typeof c.configJson === 'object' &&
                  (c.configJson as { connectionSubKind?: unknown }).connectionSubKind ===
                    'SLACK_ORG_GRID',
              )
            : provider === 'GOOGLE_WORKSPACE' || provider === 'GITHUB'
              ? connections.some(c => c.provider === provider)
              : false,
        flagApproved: isProviderSignoffSatisfied(provider),
        enabled: enabledMap[provider] === true,
      }));

      return { providers };
    }),

  /**
   * Phase 77 D-15 — per-provider per-org enable toggle. Refuses to enable a provider
   * whose signoff flag is still PENDING (unless FLAG_SIGNOFF_BYPASS=local). GWS and
   * Slack are independent. Persisted in Organization.settingsJson.idpDeprovisioningEnabled.
   */
  enableProviderForOrg: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(
      z.object({
        provider: deprovisioningProviderSchema,
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.enabled && !isProviderSignoffSatisfied(input.provider)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: DEPROVISIONING_PROVIDER_SIGNOFF_PENDING,
        });
      }

      await ctx.db.$transaction(async tx => {
        const org = await tx.organization.findUnique({
          where: { id: ctx.organizationId },
          select: { settingsJson: true },
        });
        const settings = (org?.settingsJson as Record<string, unknown>) ?? {};
        const current = (settings.idpDeprovisioningEnabled as Record<string, boolean>) ?? {};
        const next = {
          ...settings,
          idpDeprovisioningEnabled: { ...current, [input.provider]: input.enabled },
        };
        await tx.organization.update({
          where: { id: ctx.organizationId },
          data: { settingsJson: next as Prisma.InputJsonValue },
        });
      });
      void invalidateByPrefix(CacheKeys.settingsPrefix(ctx.organizationId));

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user.id,
        action: input.enabled
          ? `idp.${input.provider.toLowerCase()}.deprovisioning_enabled`
          : `idp.${input.provider.toLowerCase()}.deprovisioning_disabled`,
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        metadata: { provider: input.provider, enabled: input.enabled },
      });

      return { ok: true, provider: input.provider, enabled: input.enabled };
    }),
});
