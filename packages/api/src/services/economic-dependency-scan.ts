// ---------------------------------------------------------------------------
// Economic-dependency daily scan orchestrator.
// ---------------------------------------------------------------------------
//
// Fires early-warning notifications when a German contractor's platform
// billing share crosses §2 SGB VI thresholds (70% warning, 83.33% critical)
// over a rolling 12-month window. Runs from
// apps/cron-worker/src/jobs/handlers/classification-economic-dependency.ts
// once per day (0 2 * * * UTC).
//
// Legal thresholds (§2 SGB VI DRV):
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
//     data — mitigates information disclosure across org boundaries.
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
// The orchestrator iterates DE ACTIVE contractor assignments and, per
// assignment, writes EconomicDependencyAlertState and enqueues the heads-up
// into the transactional outbox in one $transaction, so the notice is durably
// scheduled iff the band-state upsert commits (drain delivers exactly-once).

import { prisma, prismaRaw } from '@contractor-ops/db';
import { pLimit } from '@contractor-ops/integrations/services/concurrency';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import { enqueueNotificationOutboxEvent } from './outbox';
import { resolveRbacRecipients } from './rbac-recipients';

const log = createCronLogger('classification-economic-dependency');

// ---------------------------------------------------------------------------
// Thresholds — §2 SGB VI
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
/** Notification type for an active (non-resolved) band — warning or critical. */
function activeBandEmittedType(band: Band): EmittedType {
  return band === 'CRITICAL'
    ? 'classification.economic_dependency_critical'
    : 'classification.economic_dependency_warning';
}

/**
 * Map a band transition to the notification (if any) it should fire: up-cross
 * always fires, down-cross fires "resolved", and a same non-safe band re-fires
 * on the reminder cadence.
 */
function computeBandTransition(
  previousBand: Band,
  nextBand: Band,
  lastReminderAt: Date | null,
  now: Date,
): { emittedType: EmittedType; reason: UpdateBandStateResult['reason'] } {
  const prev = bandIndex(previousBand);
  const next = bandIndex(nextBand);

  if (next > prev) {
    // Up-crossing — always fire.
    return { emittedType: activeBandEmittedType(nextBand), reason: 'cross-up' };
  }
  if (next < prev) {
    // Improvement — fire "resolved" (warning→safe, critical→warning, critical→safe).
    return { emittedType: 'resolved', reason: 'cross-down' };
  }
  if (nextBand !== 'SAFE') {
    // Same non-safe band — re-fire every REMINDER_CADENCE_DAYS.
    if (!lastReminderAt || daysBetween(lastReminderAt, now) >= REMINDER_CADENCE_DAYS) {
      return { emittedType: activeBandEmittedType(nextBand), reason: 'reminder' };
    }
  }
  return { emittedType: null, reason: 'no-change' };
}

export async function updateBandState(
  assignment: { id: string; organizationId: string },
  share: number,
  now: Date,
  client: Pick<typeof prismaRaw, 'economicDependencyAlertState'> = prismaRaw,
): Promise<UpdateBandStateResult> {
  const nextBand = bandFor(share);

  // `client` defaults to prismaRaw (no tenant frame — organizationId is set
  // explicitly in both branches); the orchestrator passes an interactive `tx`
  // so the upsert commits atomically with the outbox enqueue.
  // PHASE-60-CROSS-ORG-AGGREGATE: cron context has no tenant frame.
  const existing = await client.economicDependencyAlertState.findUnique({
    where: { contractorAssignmentId: assignment.id },
  });

  const previousBand: Band = existing?.currentBand ?? 'SAFE';
  const next = bandIndex(nextBand);
  const prev = bandIndex(previousBand);

  const { emittedType, reason } = computeBandTransition(
    previousBand,
    nextBand,
    existing?.lastReminderAt ?? null,
    now,
  );

  const data = {
    organizationId: assignment.organizationId,
    currentBand: nextBand,
    lastBillingShare: Number(share.toFixed(4)),
    lastScannedAt: now,
    lastCrossedAt: next === prev ? (existing?.lastCrossedAt ?? null) : now,
    lastReminderAt: emittedType ? now : (existing?.lastReminderAt ?? null),
  };

  await client.economicDependencyAlertState.upsert({
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

/**
 * Build the jurisdiction-specific (§2 SGB VI) notification copy for an emitted
 * economic-dependency band event. A "resolved" event dispatches under the
 * warning type so it threads onto the same notification channel.
 */
function buildEconomicDependencyNotification(
  emittedType: NonNullable<EmittedType>,
  displayName: string,
  percent: string,
): {
  title: string;
  body: string;
  type:
    | 'classification.economic_dependency_warning'
    | 'classification.economic_dependency_critical';
} {
  if (emittedType === 'resolved') {
    return {
      title: `Economic dependency resolved: ${displayName}`,
      body: `Billing share has returned to ${percent}% — below §2 SGB VI risk thresholds.`,
      type: 'classification.economic_dependency_warning',
    };
  }
  if (emittedType === 'classification.economic_dependency_critical') {
    return {
      title: `Critical economic dependency: ${displayName}`,
      body: `Billing share is ${percent}% — above the 83.33% §2 SGB VI threshold for arbeitnehmerähnliche Selbständige. Review the engagement.`,
      type: emittedType,
    };
  }
  return {
    title: `Economic-dependency warning: ${displayName}`,
    body: `Billing share is ${percent}% from your organisation over the last 12 months — above the 70% §2 SGB VI warning threshold.`,
    type: emittedType,
  };
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

  // Bound the cross-tenant scan fan-out at SCAN_FANOUT_CONCURRENCY (10) so a
  // 1000-assignment scan completes in ~100 RTTs instead of 1000 while not
  // saturating Prisma / Resend / Slack.
  //
  // Uses `p-limit` so every assignment slot starts as soon as a previous one
  // finishes (vs chunked sequential await, which waits for the slowest call
  // in each batch). Avoids head-of-line blocking on each chunk boundary when
  // a single computeBillingShare is slow.
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

          // Upsert the alert state and (when a band event fires) enqueue the
          // heads-up atomically. The outbox row commits iff the alert-state
          // upsert commits, so a crash can no longer set lastReminderAt to
          // "notified" while dropping the notice; the drain delivers it
          // exactly-once. No dedupKey — the state machine (lastReminderAt +
          // cadence) already gates emission and each emit deserves its own row.
          await prismaRaw.$transaction(async tx => {
            const result = await updateBandState(assignment, share, now, tx);

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
                const { title, body, type } = buildEconomicDependencyNotification(
                  result.emittedType,
                  assignment.contractor.displayName,
                  percent,
                );

                await enqueueNotificationOutboxEvent({
                  tx,
                  event: {
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
                  },
                });
                dispatchedCounter.value++;
              }
            }
          });
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
export const __deps = { prisma, prismaRaw, resolveRbacRecipients };
