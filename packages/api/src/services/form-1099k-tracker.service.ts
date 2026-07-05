// ---------------------------------------------------------------------------
// Form 1099-K informational threshold tracker.
// ---------------------------------------------------------------------------
//
// A periodic scan sums each US contractor's cumulative settled USD payouts and
// transaction count for the current tax year, then transitions an informational
// band (SAFE -> APPROACHING -> OVER) against the tax-year-keyed reporting
// threshold. Runs from
// apps/cron-worker/src/jobs/handlers/form-1099k-tracker.ts on a daily cadence.
//
// Threshold semantics (OBBBA restored the pre-ARPA figures):
//   - $20,000 gross AND 200 transactions — a payee only meets the federal
//     1099-K reporting threshold when BOTH dimensions are crossed, so OVER
//     requires both the amount and the count to be at/above their thresholds.
//   - The stale ARPA $600 figure is never used; the threshold is read per tax
//     year from Tax1099KThreshold, never hard-coded.
//   - APPROACHING is a proximity band: either dimension at/above the proximity
//     factor of its threshold (but not yet fully OVER).
//
// This tracker is purely informational. The platform is not the settlement
// entity (TPSO) for these payouts and never files a 1099-K, generates a form,
// or transmits anything to the IRS — the scan only writes band state and fires
// a proactive heads-up so a contractor is not surprised by a threshold. The
// figures are adviser-verify before any production reliance.

import { prisma, prismaRaw } from '@contractor-ops/db';
import { pLimit } from '@contractor-ops/integrations/services/concurrency';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import type { NotificationType } from '@contractor-ops/validators';
import type { NotificationEvent } from './notification-service';
import { enqueueNotificationDispatch } from './outbox';
import { resolveRbacRecipients } from './rbac-recipients';

const log = createCronLogger('form-1099k-tracker');

// ---------------------------------------------------------------------------
// Band model
// ---------------------------------------------------------------------------

export type Form1099KBand = 'SAFE' | 'APPROACHING' | 'OVER';

/**
 * Tax-year-keyed reporting threshold. Sourced from Tax1099KThreshold so the
 * figures move with IRS guidance per tax year rather than a code constant.
 */
export interface Form1099KThresholdConfig {
  taxYear: number;
  amountThresholdMinor: number;
  transactionCountThreshold: number;
}

/** Cumulative tax-year totals for one contractor. */
export interface Form1099KTotals {
  cumulativePayoutMinor: number;
  transactionCount: number;
}

/**
 * Proximity fraction at which a dimension enters the APPROACHING band. A
 * contractor whose payout or transaction count reaches 80% of either threshold
 * gets an early heads-up before the full reporting threshold is met.
 */
export const APPROACHING_FACTOR = 0.8;

/** Re-fire cadence for a sustained non-safe band — mirrors the §2 SGB VI scan. */
export const REMINDER_CADENCE_DAYS = 30;

export function bandIndex1099K(band: Form1099KBand): number {
  switch (band) {
    case 'SAFE':
      return 0;
    case 'APPROACHING':
      return 1;
    case 'OVER':
      return 2;
  }
}

function safeRatio(value: number, threshold: number): number {
  if (!Number.isFinite(value) || value < 0 || threshold <= 0) return 0;
  return value / threshold;
}

/**
 * Classifies cumulative totals into an informational band against the
 * tax-year-keyed threshold. OVER requires BOTH the gross-amount and the
 * transaction-count thresholds to be crossed (the federal 1099-K rule);
 * APPROACHING fires when either dimension nears its threshold.
 */
export function bandFor1099K(
  totals: Form1099KTotals,
  config: Form1099KThresholdConfig,
): Form1099KBand {
  const amountRatio = safeRatio(totals.cumulativePayoutMinor, config.amountThresholdMinor);
  const countRatio = safeRatio(totals.transactionCount, config.transactionCountThreshold);

  if (amountRatio >= 1 && countRatio >= 1) {
    return 'OVER';
  }
  if (Math.max(amountRatio, countRatio) >= APPROACHING_FACTOR) {
    return 'APPROACHING';
  }
  return 'SAFE';
}

// ---------------------------------------------------------------------------
// Band-state transition (pure)
// ---------------------------------------------------------------------------

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export type TrackerTransitionReason = 'cross-up' | 'cross-down' | 'reminder' | 'no-change';

export interface TrackerTransitionResult {
  emitted: boolean;
  reason: TrackerTransitionReason;
}

/**
 * Decides whether a proactive heads-up should fire for a band transition. An
 * up-crossing always fires; a sustained non-safe band re-fires only once the
 * reminder cadence has elapsed (lastReminderAt dedup); a down-crossing resolves
 * silently (cumulative totals only rise within a tax year, so this is a data
 * correction rather than a payee event).
 */
export function updateTrackerBandState(
  previous: { currentBand: Form1099KBand; lastReminderAt: Date | null },
  nextBand: Form1099KBand,
  now: Date,
): TrackerTransitionResult {
  const prevIdx = bandIndex1099K(previous.currentBand);
  const nextIdx = bandIndex1099K(nextBand);

  if (nextIdx > prevIdx) {
    return { emitted: true, reason: 'cross-up' };
  }
  if (nextIdx < prevIdx) {
    return { emitted: false, reason: 'cross-down' };
  }
  if (nextBand !== 'SAFE') {
    if (
      !previous.lastReminderAt ||
      daysBetween(previous.lastReminderAt, now) >= REMINDER_CADENCE_DAYS
    ) {
      return { emitted: true, reason: 'reminder' };
    }
  }
  return { emitted: false, reason: 'no-change' };
}

// ---------------------------------------------------------------------------
// Tax-year config + payout aggregation
// ---------------------------------------------------------------------------

function taxYearFor(now: Date): number {
  return now.getUTCFullYear();
}

async function loadThresholdConfig(taxYear: number): Promise<Form1099KThresholdConfig | null> {
  const row = await prismaRaw.tax1099KThreshold.findUnique({
    where: { taxYear },
    select: { taxYear: true, amountThresholdMinor: true, transactionCountThreshold: true },
  });
  if (!row) return null;
  return {
    taxYear: row.taxYear,
    amountThresholdMinor: row.amountThresholdMinor,
    transactionCountThreshold: row.transactionCountThreshold,
  };
}

interface ContractorPayoutTotals {
  contractorId: string;
  organizationId: string;
  cumulativePayoutMinor: number;
  transactionCount: number;
}

/**
 * Aggregates settled USD payouts per contractor for the tax year. Only PAID,
 * USD-denominated payment-run items whose run completed inside the calendar tax
 * year count — the same settled-payment source the 1042-S box figures use, so a
 * client can never assert the figure. Runs cross-org (no tenant frame) but only
 * returns per-contractor scalars, never row-level cross-org data.
 */
async function aggregateTaxYearPayouts(taxYear: number): Promise<ContractorPayoutTotals[]> {
  const from = new Date(Date.UTC(taxYear, 0, 1));
  const to = new Date(Date.UTC(taxYear + 1, 0, 1));

  const groups = await prismaRaw.paymentRunItem.groupBy({
    by: ['contractorId', 'organizationId'],
    where: {
      status: 'PAID',
      currency: 'USD',
      paymentRun: { completedAt: { gte: from, lt: to } },
    },
    _sum: { amountMinor: true },
    _count: { _all: true },
  });

  return groups.map(group => ({
    contractorId: group.contractorId,
    organizationId: group.organizationId,
    cumulativePayoutMinor: group._sum.amountMinor ?? 0,
    transactionCount: group._count._all,
  }));
}

// ---------------------------------------------------------------------------
// Notification copy
// ---------------------------------------------------------------------------

const NOTIFICATION_TYPE_BY_BAND: Record<'APPROACHING' | 'OVER', NotificationType> = {
  APPROACHING: 'tax.form_1099k_approaching',
  OVER: 'tax.form_1099k_over',
};

function buildHeadsUpCopy(
  band: 'APPROACHING' | 'OVER',
  displayName: string,
  taxYear: number,
): { title: string; body: string } {
  if (band === 'OVER') {
    return {
      title: `1099-K reporting threshold reached: ${displayName}`,
      body: `${displayName}'s ${taxYear} USD payouts have crossed the $20,000 and 200-transaction 1099-K reporting threshold. This is an informational heads-up only — we do not file a 1099-K on your behalf; confirm any reporting obligation with your tax adviser.`,
    };
  }
  return {
    title: `Approaching the 1099-K reporting threshold: ${displayName}`,
    body: `${displayName}'s ${taxYear} USD payouts are nearing the $20,000 / 200-transaction 1099-K reporting threshold. This is an informational heads-up only — we do not file a 1099-K on your behalf.`,
  };
}

// ---------------------------------------------------------------------------
// State write + orchestrator
// ---------------------------------------------------------------------------

export interface Form1099KScanResult {
  scanned: number;
  crossings: number;
  notificationsDispatched: number;
}

interface ContractorNameById {
  displayName: string;
}

async function processContractor(
  totals: ContractorPayoutTotals,
  config: Form1099KThresholdConfig,
  now: Date,
): Promise<{ crossed: boolean; dispatched: boolean }> {
  const nextBand = bandFor1099K(
    {
      cumulativePayoutMinor: totals.cumulativePayoutMinor,
      transactionCount: totals.transactionCount,
    },
    config,
  );

  const existing = await prismaRaw.form1099KTrackerState.findUnique({
    where: { contractorId_taxYear: { contractorId: totals.contractorId, taxYear: config.taxYear } },
    select: { currentBand: true, lastReminderAt: true, lastCrossedAt: true },
  });

  const previousBand: Form1099KBand = existing?.currentBand ?? 'SAFE';
  const { emitted, reason } = updateTrackerBandState(
    { currentBand: previousBand, lastReminderAt: existing?.lastReminderAt ?? null },
    nextBand,
    now,
  );

  const bandChanged = nextBand !== previousBand;
  const stateData = {
    organizationId: totals.organizationId,
    currentBand: nextBand,
    cumulativePayoutMinor: totals.cumulativePayoutMinor,
    transactionCount: totals.transactionCount,
    lastScannedAt: now,
    lastCrossedAt: bandChanged ? now : (existing?.lastCrossedAt ?? null),
    lastReminderAt: emitted ? now : (existing?.lastReminderAt ?? null),
  };

  // Resolve recipients + build the heads-up event first (reads only) so the
  // enqueue can ride inside the same tx as the tracker-state upsert.
  let headsUpEvent: NotificationEvent | null = null;
  if (emitted && nextBand !== 'SAFE') {
    const recipients = await resolveRbacRecipients(totals.organizationId, 'contractor:read');
    if (recipients.length > 0) {
      const contractor = (await prismaRaw.contractor.findUnique({
        where: { id: totals.contractorId },
        select: { displayName: true },
      })) as ContractorNameById | null;
      const displayName = contractor?.displayName ?? totals.contractorId;
      const { title, body } = buildHeadsUpCopy(nextBand, displayName, config.taxYear);

      headsUpEvent = {
        organizationId: totals.organizationId,
        type: NOTIFICATION_TYPE_BY_BAND[nextBand],
        recipientUserIds: recipients,
        title,
        body,
        entityType: 'CONTRACTOR',
        entityId: totals.contractorId,
        metadata: {
          band: nextBand,
          taxYear: config.taxYear,
          cumulativePayoutMinor: totals.cumulativePayoutMinor,
          transactionCount: totals.transactionCount,
          reason,
          informationalOnly: true,
        },
      };
    }
  }

  // Upsert the band state and (when a heads-up fired) enqueue the notification
  // atomically. The outbox row commits iff the upsert commits, so a crash can no
  // longer bump lastReminderAt to "notified" while dropping the notice — closing
  // a silent 30-day gap. No dedupKey: the state machine (lastReminderAt +
  // cadence) already gates emission, and each emit deserves its own durable row.
  await prismaRaw.$transaction(async tx => {
    await tx.form1099KTrackerState.upsert({
      where: {
        contractorId_taxYear: { contractorId: totals.contractorId, taxYear: config.taxYear },
      },
      create: {
        contractorId: totals.contractorId,
        taxYear: config.taxYear,
        ...stateData,
      },
      update: stateData,
    });

    if (headsUpEvent) {
      await enqueueNotificationDispatch({ tx, event: headsUpEvent });
    }
  });

  return {
    crossed: reason === 'cross-up' || reason === 'cross-down',
    dispatched: headsUpEvent !== null,
  };
}

/**
 * Periodic informational 1099-K scan. Reads the tax-year-keyed threshold, sums
 * settled USD payouts per contractor, transitions band state, and fires a
 * proactive heads-up on an up-crossing. Never files a 1099-K.
 */
export async function runForm1099KTrackerScan(
  now: Date = new Date(),
): Promise<Form1099KScanResult> {
  const taxYear = taxYearFor(now);
  const config = await loadThresholdConfig(taxYear);
  if (!config) {
    log.warn(
      { taxYear },
      'form-1099k-tracker skipped: no Tax1099KThreshold config for tax year (threshold is never a constant)',
    );
    return { scanned: 0, crossings: 0, notificationsDispatched: 0 };
  }

  const payouts = await aggregateTaxYearPayouts(taxYear);

  const SCAN_FANOUT_CONCURRENCY = 10;
  const limit = pLimit(SCAN_FANOUT_CONCURRENCY);
  const counters = { scanned: 0, crossings: 0, notificationsDispatched: 0 };

  await Promise.all(
    payouts.map(totals =>
      limit(async () => {
        counters.scanned++;
        try {
          const { crossed, dispatched } = await processContractor(totals, config, now);
          if (crossed) counters.crossings++;
          if (dispatched) counters.notificationsDispatched++;
        } catch (err) {
          log.error(
            { err, contractorId: totals.contractorId, organizationId: totals.organizationId },
            'form-1099k-tracker scan failed for contractor',
          );
        }
      }),
    ),
  );

  metrics.gauge('cron.form_1099k_tracker.scanned', counters.scanned);
  metrics.gauge('cron.form_1099k_tracker.crossings', counters.crossings);
  metrics.gauge('cron.form_1099k_tracker.notifications', counters.notificationsDispatched);

  log.info(
    { taxYear, ...counters },
    'form-1099k-tracker scan complete (informational only — no 1099-K filed)',
  );

  return { ...counters };
}

// Re-export prisma bindings so tests can stub via the same module path.
// biome-ignore lint/style/useNamingConvention: test-internals export uses double-underscore prefix
export const __deps = { prisma, prismaRaw, resolveRbacRecipients };
