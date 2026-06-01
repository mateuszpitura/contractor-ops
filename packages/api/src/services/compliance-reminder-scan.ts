// ---------------------------------------------------------------------------
// Phase 72 · COMPL-03 — Compliance reminder cascade orchestrator.
// ---------------------------------------------------------------------------
//
// Fires expiry reminders at 90/60/30/15/7-day bands per ContractorComplianceItem,
// throttled to ONE digest notification per recipient per day. Piggybacks on the
// existing reminders cron — adds a call alongside the other reminder sub-jobs.
//
// Architectural twin: economic-dependency-scan.ts. Differences:
//   - Bands derived from monotonically-decreasing daysUntilExpiry (not a continuous variable)
//   - No 30-day re-fire cadence (each band IS the cadence — D60 IS the 30-day re-fire of D90)
//   - Renewal resets the row to NONE via the listener (D-06), not a "cross-down" path
//
// LESSON: v1.0 invoice-reminder cron lacked a per-recipient digest throttle and
// produced fatigue-grade spam (one notification per overdue invoice). The two-pass
// digest aggregation here is the explicit fix. Do NOT remove this digest layer
// "for simplicity" — that simplicity was already tried, and it failed.
//
// ---------------------------------------------------------------------------

// TZ boundary math lives in the package that owns the date-fns deps (Phase 71 D-07).
import { daysUntilExpiryInTz, jurisdictionDate } from '@contractor-ops/compliance-policy';
import type { Prisma } from '@contractor-ops/db';
import { prisma, prismaRaw } from '@contractor-ops/db';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';

import { normalizeLocale, resolveMessage } from '../i18n/email-i18n';
import { writeAuditLog } from './audit-writer';
import { getDocumentTypeLabelKey } from './compliance-payment-gate';
import { claimCronNotificationDedup } from './cron-dedup';
import { dispatch } from './notification-service';
import { resolveRbacRecipients } from './rbac-recipients';

const log = createCronLogger('compliance-reminder-scan');

// ---------------------------------------------------------------------------
// Pure helpers — band classification
// ---------------------------------------------------------------------------

export type ReminderBand = 'NONE' | 'D90' | 'D60' | 'D30' | 'D15' | 'D7' | 'EXPIRED';

export function bandFor(daysUntilExpiry: number): ReminderBand {
  if (!Number.isFinite(daysUntilExpiry)) return 'NONE';
  if (daysUntilExpiry < 0) return 'EXPIRED';
  if (daysUntilExpiry <= 7) return 'D7';
  if (daysUntilExpiry <= 15) return 'D15';
  if (daysUntilExpiry <= 30) return 'D30';
  if (daysUntilExpiry <= 60) return 'D60';
  if (daysUntilExpiry <= 90) return 'D90';
  return 'NONE';
}

export function bandIndex(b: ReminderBand): number {
  switch (b) {
    case 'NONE':
      return 0;
    case 'D90':
      return 1;
    case 'D60':
      return 2;
    case 'D30':
      return 3;
    case 'D15':
      return 4;
    case 'D7':
      return 5;
    case 'EXPIRED':
      return 6;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScanResult {
  scanned: number;
  fires: number; // per-band claims that succeeded
  digests: number; // per-recipient digest dispatches
}

interface ItemForScan {
  id: string;
  organizationId: string;
  contractorId: string;
  documentType: string; // DocumentType enum — there is no `name`-based reminder label on the item
  policyRuleId: string | null;
  expiresAt: Date | null;
  expiryJurisdictionTz: string | null;
}

interface PendingFire {
  itemId: string;
  organizationId: string;
  band: ReminderBand;
  expiresAt: Date;
  documentType: string;
  policyRuleId: string | null;
  contractorId: string;
  contractorDisplayName: string;
}

interface DigestGroup {
  recipientUserId: string;
  organizationId: string;
  jurisdictionDate: string;
  fires: PendingFire[];
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function runComplianceReminderScan(now: Date = new Date()): Promise<ScanResult> {
  try {
    const items: ItemForScan[] = await prismaRaw.contractorComplianceItem.findMany({
      where: {
        severity: 'BLOCKING',
        status: { in: ['PENDING', 'EXPIRED'] }, // skip MISSING (no expiresAt yet), WAIVED, SATISFIED
        expiresAt: { not: null },
        expiryJurisdictionTz: { not: null },
      },
      select: {
        id: true,
        organizationId: true,
        contractorId: true,
        documentType: true,
        policyRuleId: true,
        expiresAt: true,
        expiryJurisdictionTz: true,
      },
    });

    // Pass 1: collect band transitions per item, accumulate per-recipient groups.
    const { scanned, fires, recipientGroups } = await collectPendingFires(items, now);
    // Pass 2: dispatch ONE dedup-gated digest per recipient/day.
    const digests = await dispatchDigests(recipientGroups);

    metrics.gauge('cron.compliance_reminder.scanned', scanned);
    metrics.gauge('cron.compliance_reminder.fires', fires);
    metrics.gauge('cron.compliance_reminder.digests', digests);

    log.info({ scanned, fires, digests }, 'compliance-reminder-scan complete');
    return { scanned, fires, digests };
  } catch (err) {
    log.error({ err }, 'compliance-reminder-scan failed (top-level catch — returning zero counts)');
    return { scanned: 0, fires: 0, digests: 0 };
  }
}

/**
 * Pass 1 — per-item band processing + per-recipient grouping.
 * Per-item failures are logged and skipped; they never abort the whole scan.
 */
async function collectPendingFires(
  items: ItemForScan[],
  now: Date,
): Promise<{ scanned: number; fires: number; recipientGroups: Map<string, DigestGroup> }> {
  let scanned = 0;
  let fires = 0;
  const recipientGroups = new Map<string, DigestGroup>(); // key = `${userId}:${jurisdictionDate}`

  for (const item of items) {
    scanned++;
    try {
      const fire = await processItem(item, now);
      if (!fire) continue;
      fires++;
      // Resolve recipients in Pass 1 so we can group correctly in Pass 2.
      const recipients = await resolveRecipientsForItem(item);
      // biome-ignore lint/style/noNonNullAssertion: query filters out null expiryJurisdictionTz
      const date = jurisdictionDate(now, item.expiryJurisdictionTz!);
      for (const recipientUserId of recipients) {
        addFireToGroup(recipientGroups, recipientUserId, date, item.organizationId, fire);
      }
    } catch (err) {
      log.error({ err, itemId: item.id }, 'compliance-reminder per-item processing failed');
    }
  }

  return { scanned, fires, recipientGroups };
}

function addFireToGroup(
  recipientGroups: Map<string, DigestGroup>,
  recipientUserId: string,
  date: string,
  organizationId: string,
  fire: PendingFire,
): void {
  const key = `${recipientUserId}:${date}`;
  let group = recipientGroups.get(key);
  if (!group) {
    group = { recipientUserId, organizationId, jurisdictionDate: date, fires: [] };
    recipientGroups.set(key, group);
  }
  group.fires.push(fire);
}

/** Pass 2 — one dedup-gated digest per recipient/day. Returns dispatched count. */
async function dispatchDigests(recipientGroups: Map<string, DigestGroup>): Promise<number> {
  let digests = 0;
  for (const group of recipientGroups.values()) {
    try {
      const digestKey = `compl:digest:${group.recipientUserId}:${group.jurisdictionDate}`;
      const claimed = await claimCronNotificationDedup(digestKey);
      if (!claimed) continue; // already sent today
      await dispatchDigest(group);
      digests++;
    } catch (err) {
      log.error(
        { err, recipientUserId: group.recipientUserId },
        'compliance-reminder digest dispatch failed',
      );
    }
  }
  return digests;
}

/**
 * Per-item processing: compute next band, claim per-band dedup, persist with
 * optimistic concurrency, return PendingFire if we should add to the digest.
 */
async function processItem(item: ItemForScan, now: Date): Promise<PendingFire | null> {
  if (!(item.expiresAt && item.expiryJurisdictionTz)) return null;

  const days = daysUntilExpiryInTz(item.expiresAt, item.expiryJurisdictionTz, now);
  const nextBand = bandFor(days);
  if (nextBand === 'NONE') return null;

  // Read current state (or default to NONE).
  const existing = await prisma.contractorComplianceReminderState.findUnique({
    where: { itemId: item.id },
  });
  const knownVersion = existing?.version ?? 0;
  const lastFired = existing?.lastBandFired ?? null;

  // Only fire if the next band is forward of the last fired band.
  if (lastFired && bandIndex(nextBand) <= bandIndex(lastFired)) return null;

  // Per-band dedup claim (jurisdictionDate-scoped).
  const date = jurisdictionDate(now, item.expiryJurisdictionTz);
  const dedupKey = `compl:band:${item.id}:${nextBand}:${date}`;
  const claimed = await claimCronNotificationDedup(dedupKey);
  if (!claimed) return null;

  const persisted = await persistBandFire(item, nextBand, knownVersion, existing !== null, now);
  if (!persisted) return null;

  // Fetch contractor display name for the digest line.
  const contractor = await prisma.contractor.findUniqueOrThrow({
    where: { id: item.contractorId },
    select: { displayName: true },
  });

  return {
    itemId: item.id,
    organizationId: item.organizationId,
    band: nextBand,
    expiresAt: item.expiresAt,
    documentType: item.documentType,
    policyRuleId: item.policyRuleId,
    contractorId: item.contractorId,
    contractorDisplayName: contractor.displayName,
  };
}

/**
 * Persists the band fire with optimistic concurrency. Returns false (skip the
 * fire) when a renewal-reset raced with us — either updateMany matched zero rows
 * (version bumped between read and write) or the create lost to a P2002 from a
 * parallel listener. Both cases retry on the next cron tick.
 */
async function persistBandFire(
  item: ItemForScan,
  nextBand: ReminderBand,
  knownVersion: number,
  exists: boolean,
  now: Date,
): Promise<boolean> {
  if (exists) {
    const updated = await prisma.contractorComplianceReminderState.updateMany({
      where: { itemId: item.id, version: knownVersion },
      data: {
        currentBand: nextBand,
        lastBandFired: nextBand,
        lastBandFiredAt: now,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      log.warn(
        { itemId: item.id, knownVersion },
        'compliance-reminder cron lost optimistic-concurrency race; skipping fire',
      );
      return false;
    }
    return true;
  }

  // Race-tolerant create: if a parallel listener created the row, this throws P2002 — caught and skipped.
  try {
    await prisma.contractorComplianceReminderState.create({
      data: {
        itemId: item.id,
        organizationId: item.organizationId,
        currentBand: nextBand,
        lastBandFired: nextBand,
        lastBandFiredAt: now,
        version: 0,
      },
    });
    return true;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'P2002') {
      log.warn(
        { itemId: item.id },
        'compliance-reminder cron lost create race with listener; skipping fire',
      );
      return false;
    }
    throw err;
  }
}

/**
 * Recipients for a compliance item — platform admins resolved via
 * resolveRbacRecipients(orgId, 'contractor:read').
 *
 * NOTE: `resolveRbacRecipients` is typed to ContractorPermission and compliance
 * reads are gated behind contractor:read in this RBAC model, so we reuse that
 * gate (same one the economic-dependency twin uses).
 *
 * The contractor themselves is NOT a platform `User` in this data model (they
 * authenticate via PortalSession, not a User row), so they cannot be a
 * `dispatch` recipientUserId. The direct contractor-email reminder channel is
 * Phase 73 portal scope; Phase 72 dispatches the admin digest only.
 */
async function resolveRecipientsForItem(item: ItemForScan): Promise<string[]> {
  const adminRecipients = await resolveRbacRecipients(item.organizationId, 'contractor:read');
  return Array.from(new Set<string>(adminRecipients));
}

/**
 * Dispatch ONE digest notification listing all (doc, band, expiresAt) entries
 * for this recipient on this jurisdictionDate.
 *
 * Title and body are i18n-keyed so the notification-service resolveEventCopy
 * step localises them against the org's configured locale. Per-item document
 * labels are also resolved server-side (via resolveMessage) so the {items}
 * param carries locale-aware text rather than raw DocumentType enum values.
 */
async function dispatchDigest(group: DigestGroup): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: group.organizationId },
    select: { language: true },
  });
  const locale = normalizeLocale(org?.language ?? null);

  const lines = group.fires.map(f => {
    const labelKey = getDocumentTypeLabelKey(f.documentType, f.policyRuleId);
    const documentLabel = resolveMessage(labelKey, locale);
    const expiresAt = f.expiresAt.toISOString().slice(0, 10);
    return resolveMessage('Compliance.notifications.expiryDigest.item', locale, {
      contractorName: f.contractorDisplayName,
      documentLabel,
      band: f.band,
      expiresAt,
    });
  });

  await dispatch({
    organizationId: group.organizationId,
    type: 'compliance.expiry_digest',
    recipientUserIds: [group.recipientUserId],
    title: 'Compliance.notifications.expiryDigest.title',
    body: 'Compliance.notifications.expiryDigest.body',
    entityType: 'CONTRACTOR',
    entityId: group.fires[0]?.contractorId ?? group.organizationId,
    metadata: {
      count: group.fires.length,
      items: lines.join('\n'),
      jurisdictionDate: group.jurisdictionDate,
      fires: group.fires.map(f => ({
        itemId: f.itemId,
        band: f.band,
        documentType: f.documentType,
        expiresAt: f.expiresAt.toISOString(),
      })),
    },
  });
}

// ---------------------------------------------------------------------------
// Renewal-reset listener — invoked from classification on expires_at_changed (D-06)
// ---------------------------------------------------------------------------

export async function onComplianceItemExpiresAtChanged(
  tx: Prisma.TransactionClient,
  args: {
    itemId: string;
    organizationId: string;
    triggerEvent: 'expires_at_changed' | 'status_satisfied' | 'manual_admin_reset';
  },
): Promise<void> {
  const existing = await tx.contractorComplianceReminderState.findUnique({
    where: { itemId: args.itemId },
  });
  await tx.contractorComplianceReminderState.upsert({
    where: { itemId: args.itemId },
    update: {
      currentBand: 'NONE',
      lastBandFired: null,
      lastBandFiredAt: null,
      version: { increment: 1 },
    },
    create: {
      itemId: args.itemId,
      organizationId: args.organizationId,
      currentBand: 'NONE',
      version: 0,
    },
  });
  await writeAuditLog({
    organizationId: args.organizationId,
    actorType: 'SYSTEM',
    action: 'compliance.reminder.reset',
    resourceType: 'CONTRACTOR',
    resourceId: args.itemId,
    metadata: {
      previousBand: existing?.lastBandFired ?? null,
      triggerEvent: args.triggerEvent,
    },
    tx,
  });
}

// Test-deps export (twin pattern from economic-dependency-scan.ts).
// biome-ignore lint/style/useNamingConvention: test-internals export uses double-underscore prefix
export const __deps = {
  prisma,
  prismaRaw,
  dispatch,
  resolveRbacRecipients,
  claimCronNotificationDedup,
};
