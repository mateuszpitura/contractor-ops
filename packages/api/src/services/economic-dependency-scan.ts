// ---------------------------------------------------------------------------
// Phase 60 · CLASS-07 — economic-dependency daily scan orchestrator.
// ---------------------------------------------------------------------------
//
// Fires early-warning notifications when a German contractor's platform
// billing share crosses §2 SGB VI thresholds (70% warning, 83.33% critical)
// over a rolling 12-month window. Runs from
// apps/cron-worker/src/jobs/handlers/classification-economic-dependency.ts
// once per day (0 2 * * * UTC).
//
// Legal thresholds (locked — see 60-RESEARCH.md §DRV thresholds):
//   - 70.00% → warning band (early indicator of arbeitnehmerähnliche
//              Selbständige risk; Steuerberater should review).
//   - 83.33% (5/6) → critical band (DRV §2 Nr. 9 SGB VI — mandatory social
//              insurance inclusion risk).
//
// Kleinunternehmer status (§19 UStG) does NOT alter these thresholds — the
// billing share is computed on gross invoice totals irrespective of the VAT
// regime. A unit test asserts this non-interaction.
//
// Security contract:
//   - Numerator AND denominator use `prismaRaw` (non-tenant-scoped) because
//     the DRV denominator must aggregate across EVERY organisation the
//     contractor bills from, not just the current one. Every cross-org call
//     is tagged `// PHASE-60-CROSS-ORG-AGGREGATE` for audit grep.
//   - Aggregate returns scalars (BigInt/number), never per-row cross-org
//     data — Information Disclosure (T-60-03) mitigated.
//   - Recipient fan-out uses `resolveRbacRecipients` (contractor:read gate).
//
// State machine (research Pattern 3):
//   safe     → warning  : dispatch "warning", lastCrossedAt=now, lastReminderAt=now
//   warning  → critical : dispatch "critical", lastCrossedAt=now, lastReminderAt=now
//   safe     → critical : dispatch "critical" (skip warning if share jumped directly)
//   warning  → safe     : dispatch "resolved" (warning→safe)
//   critical → warning  : dispatch "resolved" (critical→warning; still non-safe but improved)
//   critical → safe     : dispatch "resolved"
//   same band (non-safe) + lastReminderAt ≥ 30d : re-fire reminder
//   same band (safe)    : no-op
//
// The orchestrator iterates DE ACTIVE contractor assignments and writes
// EconomicDependencyAlertState atomically with an upsert.

import { prisma, prismaRaw } from '@contractor-ops/db';
import { pLimit } from '@contractor-ops/integrations/services/concurrency';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import { dispatch } from './notification-service';
import { resolveRbacRecipients } from './rbac-recipients';

const log = createCronLogger('classification-economic-dependency');

// ---------------------------------------------------------------------------
// Thresholds — §2 SGB VI (LOCKED — see 60-RESEARCH.md)
// ---------------------------------------------------------------------------

export const WARNING_THRESHOLD = 0.7; // 70.00 %
export const CRITICAL_THRESHOLD = 5 / 6; // 83.333…  %  (5-of-6 billing rule)
export const REMINDER_CADENCE_DAYS = 30;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export type Band = 'SAFE' | 'WARNING' | 'CRITICAL';

export function bandFor(share: number): Band {
  if (!Number.isFinite(share) || share < 0) return 'SAFE';
  if (share >= CRITICAL_THRESHOLD) return 'CRITICAL';
  if (share >= WARNING_THRESHOLD) return 'WARNING';
  return 'SAFE';
}

export function bandIndex(b: Band): number {
  switch (b) {
    case 'SAFE':
      return 0;
    case 'WARNING':
      return 1;
    case 'CRITICAL':
      return 2;
  }
}

function twelveMonthsAgoFrom(now: Date): Date {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - 12);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

// ---------------------------------------------------------------------------
// Billing share
// ---------------------------------------------------------------------------

export interface BillingShare {
  numerator: number; // platform (currentOrgId) gross totals in minor units
  denominator: number; // cross-org gross totals in minor units
  share: number; // 0..1
}

/**
 * Computes the contractor's billing share from `currentOrgId` relative to
 * their total cross-org billing over the last 12 months (closed interval).
 *
 * Filters: status ≠ VOID, deletedAt = null. Uses authoritative `totalMinor`.
 */
export async function computeBillingShare(
  contractorId: string,
  currentOrgId: string,
  now: Date,
): Promise<BillingShare> {
  const windowStart = twelveMonthsAgoFrom(now);

  // Numerator — invoices for this contractor in the current org.
  // PHASE-60-CROSS-ORG-AGGREGATE: raw client used even for single-org read
  // because the cron has no tenant frame; scoped via explicit where filter.
  const numeratorAgg = await prismaRaw.invoice.aggregate({
    where: {
      contractorId,
      organizationId: currentOrgId,
      issueDate: { gte: windowStart, lte: now },
      status: { notIn: ['VOID'] },
      deletedAt: null,
    },
    _sum: { totalMinor: true },
  });

  // Denominator — invoices for this contractor across ALL orgs.
  // PHASE-60-CROSS-ORG-AGGREGATE: deliberately omits organizationId filter
  // so the DRV §2 SGB VI cross-client rule is evaluated correctly.
  const denominatorAgg = await prismaRaw.invoice.aggregate({
    where: {
      contractorId,
      issueDate: { gte: windowStart, lte: now },
      status: { notIn: ['VOID'] },
      deletedAt: null,
    },
    _sum: { totalMinor: true },
  });

  const numerator = Number(numeratorAgg._sum.totalMinor ?? 0);
  const denominator = Number(denominatorAgg._sum.totalMinor ?? 0);
  const share = denominator > 0 ? numerator / denominator : 0;

  return { numerator, denominator, share };
}

// ---------------------------------------------------------------------------
// Band-state update
// ---------------------------------------------------------------------------

export type EmittedType =
  | 'classification.economic_dependency_warning'
  | 'classification.economic_dependency_critical'
  | 'resolved'
  | null;

export interface UpdateBandStateResult {
  organizationId: string;
  previousBand: Band;
  currentBand: Band;
  emittedType: EmittedType;
  reason: 'cross-up' | 'cross-down' | 'reminder' | 'no-change';
}

/**
 * Transitions the per-assignment state row and reports what notification (if
 * any) should fire. Writes `EconomicDependencyAlertState` via upsert with the
 * tenant-scoped `prisma` binding — the state itself belongs to the org the
 * cron is iterating, so we pass organizationId explicitly to the upsert where
 * clause (cron runs without a tenant frame; we rely on the fact that
 * `EconomicDependencyAlertState` sits behind an @@unique on
 * `contractorAssignmentId` so the upsert key is sufficient on its own).
 */
export async function updateBandState(
  assignment: { id: string; organizationId: string },
  share: number,
  now: Date,
): Promise<UpdateBandStateResult> {
  const nextBand = bandFor(share);

  // Use prismaRaw because we need to upsert without a tenant frame;
  // organizationId is set explicitly in both branches.
  // PHASE-60-CROSS-ORG-AGGREGATE: cron context has no tenant frame.
  const existing = await prismaRaw.economicDependencyAlertState.findUnique({
    where: { contractorAssignmentId: assignment.id },
  });

  const previousBand: Band = existing?.currentBand ?? 'SAFE';

  let emittedType: EmittedType = null;
  let reason: UpdateBandStateResult['reason'] = 'no-change';
  const prev = bandIndex(previousBand);
  const next = bandIndex(nextBand);

  if (next > prev) {
    // Up-crossing — always fire.
    emittedType =
      nextBand === 'CRITICAL'
        ? 'classification.economic_dependency_critical'
        : 'classification.economic_dependency_warning';
    reason = 'cross-up';
  } else if (next < prev) {
    // Improvement — fire "resolved" (warning→safe, critical→warning, critical→safe).
    emittedType = 'resolved';
    reason = 'cross-down';
  } else if (next === prev && nextBand !== 'SAFE') {
    // Same non-safe band — re-fire every REMINDER_CADENCE_DAYS.
    const lastReminder = existing?.lastReminderAt ?? null;
    if (!lastReminder || daysBetween(lastReminder, now) >= REMINDER_CADENCE_DAYS) {
      emittedType =
        nextBand === 'CRITICAL'
          ? 'classification.economic_dependency_critical'
          : 'classification.economic_dependency_warning';
      reason = 'reminder';
    }
  }

  const data = {
    organizationId: assignment.organizationId,
    currentBand: nextBand,
    lastBillingShare: Number(share.toFixed(4)),
    lastScannedAt: now,
    lastCrossedAt: next === prev ? (existing?.lastCrossedAt ?? null) : now,
    lastReminderAt: emittedType ? now : (existing?.lastReminderAt ?? null),
  };

  await prismaRaw.economicDependencyAlertState.upsert({
    where: { contractorAssignmentId: assignment.id },
    create: {
      contractorAssignmentId: assignment.id,
      ...data,
    },
    update: data,
  });

  return {
    organizationId: assignment.organizationId,
    previousBand,
    currentBand: nextBand,
    emittedType,
    reason,
  };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

interface AssignmentRow {
  id: string;
  organizationId: string;
  contractorId: string;
  contractor: { displayName: string };
}

export interface ScanResult {
  scanned: number;
  crossings: number;
  notificationsDispatched: number;
}

export async function runEconomicDependencyScan(now: Date = new Date()): Promise<ScanResult> {
  let scanned = 0;
  let crossings = 0;
  let notificationsDispatched = 0;

  // PHASE-60-CROSS-ORG-AGGREGATE: DE-wide scan, no tenant frame.
  const assignments: AssignmentRow[] = await prismaRaw.contractorAssignment.findMany({
    where: {
      status: 'ACTIVE',
      contractor: { countryCode: 'DE' },
    },
    select: {
      id: true,
      organizationId: true,
      contractorId: true,
      contractor: { select: { displayName: true } },
    },
  });

  // F-ASYNC-09 / F-SCALE-05 / P2-B: bound the cross-tenant scan fan-out at
  // SCAN_FANOUT_CONCURRENCY (10) so a 1000-assignment scan completes in
  // ~100 RTTs instead of 1000 while not saturating Prisma / Resend / Slack.
  //
  // Replaces a previous `chunked + sequential await` shape with `p-limit`,
  // which lets every assignment slot start as soon as a previous one
  // finishes (the chunked version waited for the slowest call in each
  // batch before starting the next). When a single assignment's
  // computeBillingShare is slow, throughput improves by avoiding head-of-
  // line blocking on each chunk boundary.
  const SCAN_FANOUT_CONCURRENCY = 10;
  const limit = pLimit(SCAN_FANOUT_CONCURRENCY);
  const dispatchedCounter = { value: 0, crossings: 0, scanned: 0 };

  await Promise.all(
    assignments.map(assignment =>
      limit(async () => {
        dispatchedCounter.scanned++;
        try {
          const { share } = await computeBillingShare(
            assignment.contractorId,
            assignment.organizationId,
            now,
          );
          const result = await updateBandState(assignment, share, now);

          if (result.reason === 'cross-up' || result.reason === 'cross-down') {
            dispatchedCounter.crossings++;
          }

          if (result.emittedType) {
            const recipients = await resolveRbacRecipients(
              assignment.organizationId,
              'contractor:read',
            );

            if (recipients.length > 0) {
              const percent = (share * 100).toFixed(1);
              const title =
                result.emittedType === 'resolved'
                  ? `Economic dependency resolved: ${assignment.contractor.displayName}`
                  : result.emittedType === 'classification.economic_dependency_critical'
                    ? `Critical economic dependency: ${assignment.contractor.displayName}`
                    : `Economic-dependency warning: ${assignment.contractor.displayName}`;
              const body =
                result.emittedType === 'resolved'
                  ? `Billing share has returned to ${percent}% — below §2 SGB VI risk thresholds.`
                  : result.emittedType === 'classification.economic_dependency_critical'
                    ? `Billing share is ${percent}% — above the 83.33% §2 SGB VI threshold for arbeitnehmerähnliche Selbständige. Review the engagement.`
                    : `Billing share is ${percent}% from your organisation over the last 12 months — above the 70% §2 SGB VI warning threshold.`;

              const type =
                result.emittedType === 'resolved'
                  ? 'classification.economic_dependency_warning'
                  : result.emittedType;

              await dispatch({
                organizationId: assignment.organizationId,
                type,
                recipientUserIds: recipients,
                title,
                body,
                entityType: 'CONTRACTOR',
                entityId: assignment.id,
                metadata: {
                  billingShare: share,
                  band: result.currentBand,
                  reason: result.reason,
                },
              });
              dispatchedCounter.value++;
            }
          }
        } catch (err) {
          log.error(
            { err, assignmentId: assignment.id, organizationId: assignment.organizationId },
            'economic-dependency scan failed for assignment',
          );
        }
      }),
    ),
  );
  scanned = dispatchedCounter.scanned;
  crossings = dispatchedCounter.crossings;
  notificationsDispatched = dispatchedCounter.value;

  metrics.gauge('cron.classification_economic_dependency.scanned', scanned);
  metrics.gauge('cron.classification_economic_dependency.crossings', crossings);
  metrics.gauge('cron.classification_economic_dependency.notifications', notificationsDispatched);

  log.info(
    { scanned, crossings, notificationsDispatched },
    'classification-economic-dependency scan complete',
  );

  return { scanned, crossings, notificationsDispatched };
}

// Re-export prisma alias for tests that need to stub it via the same path.
// biome-ignore lint/style/useNamingConvention: test-internals export uses double-underscore prefix
export const __deps = { prisma, prismaRaw, dispatch, resolveRbacRecipients };
