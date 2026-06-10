// ---------------------------------------------------------------------------
// Compliance reminder cascade orchestrator.
// ---------------------------------------------------------------------------
//
// Fires expiry reminders at 90/60/30/15/7-day bands per ContractorComplianceItem,
// throttled to ONE digest notification per recipient per day. Piggybacks on the
// existing reminders cron — adds a call alongside the other reminder sub-jobs.
//
// Architectural twin: economic-dependency-scan.ts. Differences:
//   - Bands derived from monotonically-decreasing daysUntilExpiry (not a continuous variable)
//   - No 30-day re-fire cadence (each band IS the cadence — D60 IS the 30-day re-fire of D90)
//   - Renewal resets the row to NONE via the listener, not a "cross-down" path
//
// LESSON: v1.0 invoice-reminder cron lacked a per-recipient digest throttle and
// produced fatigue-grade spam (one notification per overdue invoice). The two-pass
// digest aggregation here is the explicit fix. Do NOT remove this digest layer
// "for simplicity" — that simplicity was already tried, and it failed.
//
// ---------------------------------------------------------------------------

// TZ boundary math lives in the package that owns the date-fns deps.
import { daysUntilExpiryInTz, jurisdictionDate } from '@contractor-ops/compliance-policy';
import type { Prisma } from '@contractor-ops/db';
import { getRegionalClient, prisma, prismaRaw, SUPPORTED_REGIONS } from '@contractor-ops/db';
import { pLimit } from '@contractor-ops/integrations/services/concurrency';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';

import { normalizeLocale, resolveMessage } from '../i18n/email-i18n';
import { writeAuditLog } from './audit-writer';
import { getDocumentTypeLabelKey } from './compliance-payment-gate';
import { claimCronNotificationDedup } from './cron-dedup';
import { reEvaluateFreeZoneStatus } from './free-zone-compliance';
import { dispatch } from './notification-service';
import { resolveRbacRecipients } from './rbac-recipients';

const log = createCronLogger('compliance-reminder-scan');

// Bound cross-org scan fan-out (mirror of economic-dependency-scan.ts).
const SCAN_FANOUT_CONCURRENCY = 10;

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

/**
 * The cron has no tenant frame and must run once per data region against that
 * region's physical DB. `runComplianceReminderScan` fans out over
 * SUPPORTED_REGIONS, so the per-region worker receives an explicit Prisma
 * client (the regional writer) rather than closing over the EU-only
 * `prismaRaw`. Structural shape — only the cron-context delegates are needed.
 * Mirrors compliance-payment-gate.ts PaymentGateClient.
 */
export interface ReminderScanClient {
  contractorComplianceItem: {
    findMany: (args: Prisma.ContractorComplianceItemFindManyArgs) => Promise<unknown>;
    // The scan persists the free-zone PENDING→EXPIRED transition at the TZ
    // boundary (reEvaluateFreeZoneStatus). The cron has no tenant frame, so
    // this write goes through the regional client threaded from the fan-out.
    update: (args: Prisma.ContractorComplianceItemUpdateArgs) => Promise<unknown>;
  };
  contractorComplianceReminderState: {
    findUnique: (args: Prisma.ContractorComplianceReminderStateFindUniqueArgs) => Promise<unknown>;
    updateMany: (
      args: Prisma.ContractorComplianceReminderStateUpdateManyArgs,
    ) => Promise<{ count: number }>;
    create: (args: Prisma.ContractorComplianceReminderStateCreateArgs) => Promise<unknown>;
  };
  organization: {
    findUnique: (args: Prisma.OrganizationFindUniqueArgs) => Promise<unknown>;
  };
}

interface ItemForScan {
  id: string;
  organizationId: string;
  contractorId: string;
  documentType: string; // DocumentType enum — there is no `name`-based reminder label on the item
  policyRuleId: string | null;
  status: string; // needed for the free-zone PENDING→EXPIRED boundary flip
  expiresAt: Date | null;
  expiryJurisdictionTz: string | null;
  contractor: { displayName: string };
}

// Free-zone license items are written out-of-band and key the payment gate on
// status='EXPIRED'. The reminder scan is the cron-context pass that flips them
// PENDING→EXPIRED at the Asia/Dubai boundary (reEvaluateFreeZoneStatus),
// since there is no other tenant-frame-less sweep.
const FREE_ZONE_POLICY_PREFIX = 'uae.free_zone' as const;

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

/**
 * Public cron entry — fans the scan out across SUPPORTED_REGIONS.
 *
 * UAE/KSA orgs live in the ME physical DB; the cron has no tenant frame, so each
 * region is scanned with its OWN regional Prisma client (getRegionalClient). A
 * region whose DATABASE_URL_* env is unset is skipped with a Pino warn (no silent
 * catch) — the other regions still run. Per-region results are accumulated.
 *
 * Signature-compatible with the prior EU-only entry so the cron handler call site
 * (reminders/index.ts) stays `runComplianceReminderScan()`.
 */
export async function runComplianceReminderScan(now: Date = new Date()): Promise<ScanResult> {
  const total: ScanResult = { scanned: 0, fires: 0, digests: 0 };

  for (const region of SUPPORTED_REGIONS) {
    let client: ReminderScanClient;
    try {
      client = getRegionalClient(region) as unknown as ReminderScanClient;
    } catch (err) {
      // Unconfigured region (DATABASE_URL_<REGION> unset) — skip, do not abort the fan-out.
      log.warn(
        { err, region },
        'compliance-reminder-scan: region client unavailable; skipping region',
      );
      continue;
    }

    const result = await runComplianceReminderScanForClient(client, region, now);
    total.scanned += result.scanned;
    total.fires += result.fires;
    total.digests += result.digests;
  }

  metrics.gauge('cron.compliance_reminder.scanned', total.scanned);
  metrics.gauge('cron.compliance_reminder.fires', total.fires);
  metrics.gauge('cron.compliance_reminder.digests', total.digests);

  log.info({ ...total }, 'compliance-reminder-scan complete (all regions)');
  return total;
}

/**
 * Per-region worker — runs the two-pass scan against ONE regional client.
 * Every read/write goes through the supplied `client` (no module-level prismaRaw
 * close-over) so ME-region BLOCKING free-zone items enter the cascade.
 * The `region` label region-prefixes the dedup keys so a band/digest claim in one
 * region cannot suppress the same key in another.
 */
export async function runComplianceReminderScanForClient(
  client: ReminderScanClient,
  region: string,
  now: Date = new Date(),
): Promise<ScanResult> {
  try {
    // contractor.displayName is selected here to avoid a per-item N+1 lookup — mirrors
    // the economic-dependency-scan.ts twin (select contractor.displayName in the top query).
    const items = (await client.contractorComplianceItem.findMany({
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
        status: true,
        expiresAt: true,
        expiryJurisdictionTz: true,
        contractor: { select: { displayName: true } },
      },
    })) as ItemForScan[];

    // Flip free-zone PENDING items that have crossed their TZ boundary to
    // EXPIRED before the band pass, so the BLOCKING payment gate (which keys
    // on status='EXPIRED') arms for licenses that expire after they were
    // recorded. Idempotent + region-correct: the write rides the regional
    // client, and reEvaluateFreeZoneStatus no-ops for already-EXPIRED / non-PENDING rows.
    await flipExpiredFreeZoneItems(client, items, now);

    // Pass 1: collect band transitions per item, accumulate per-recipient groups.
    const { scanned, fires, recipientGroups } = await collectPendingFires(
      client,
      region,
      items,
      now,
    );
    // Pass 2: dispatch ONE dedup-gated digest per recipient/day.
    const digests = await dispatchDigests(client, region, recipientGroups);

    log.info({ region, scanned, fires, digests }, 'compliance-reminder-scan region complete');
    return { scanned, fires, digests };
  } catch (err) {
    log.error(
      { err, region },
      'compliance-reminder-scan region failed (per-region catch — returning zero counts)',
    );
    return { scanned: 0, fires: 0, digests: 0 };
  }
}

/**
 * Persists the free-zone PENDING→EXPIRED transition for items whose Asia/Dubai
 * expiry boundary has crossed. This arms the payment hard-block for a license
 * that expires after it was recorded: the gate keys on status='EXPIRED', and no
 * other cron-context (tenant-frame-less) pass flips the status. Delegates to the
 * idempotent, region-safe reEvaluateFreeZoneStatus and mutates the in-memory
 * `items` so the subsequent band pass sees the new status.
 *
 * Per-item failures are logged and skipped — one bad flip never aborts the scan.
 */
async function flipExpiredFreeZoneItems(
  client: ReminderScanClient,
  items: ItemForScan[],
  now: Date,
): Promise<void> {
  for (const item of items) {
    if (!item.policyRuleId?.startsWith(FREE_ZONE_POLICY_PREFIX)) continue;
    if (item.status !== 'PENDING') continue;
    try {
      const flipped = await reEvaluateFreeZoneStatus(
        client,
        {
          id: item.id,
          status: item.status,
          expiresAt: item.expiresAt,
          expiryJurisdictionTz: item.expiryJurisdictionTz,
        },
        now,
      );
      if (flipped === 'EXPIRED') {
        // Keep the in-memory row consistent for the band pass that follows.
        item.status = 'EXPIRED';
      }
    } catch (err) {
      log.error(
        { err, itemId: item.id },
        'compliance-reminder free-zone status re-evaluation failed; skipping item',
      );
    }
  }
}

/**
 * Pass 1 — per-item band processing + per-recipient grouping.
 *
 * Fan-out is bounded by pLimit(SCAN_FANOUT_CONCURRENCY) to avoid head-of-line
 * blocking on slow per-item DB writes at high BLOCKING-item volume — mirrors
 * the economic-dependency-scan.ts twin.
 *
 * Per-item failures are logged and skipped; they never abort the whole scan.
 */
async function collectPendingFires(
  client: ReminderScanClient,
  region: string,
  items: ItemForScan[],
  now: Date,
): Promise<{ scanned: number; fires: number; recipientGroups: Map<string, DigestGroup> }> {
  const limit = pLimit(SCAN_FANOUT_CONCURRENCY);
  const recipientGroups = new Map<string, DigestGroup>(); // key = `${userId}:${jurisdictionDate}`

  // Shared mutable counters — safe because pLimit serialises access at SCAN_FANOUT_CONCURRENCY.
  const counters = { scanned: 0, fires: 0 };

  await Promise.all(
    items.map(item =>
      limit(async () => {
        counters.scanned++;
        try {
          const fire = await processItem(client, region, item, now);
          if (!fire) return;
          counters.fires++;
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
      }),
    ),
  );

  return { scanned: counters.scanned, fires: counters.fires, recipientGroups };
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
async function dispatchDigests(
  client: ReminderScanClient,
  region: string,
  recipientGroups: Map<string, DigestGroup>,
): Promise<number> {
  let digests = 0;
  for (const group of recipientGroups.values()) {
    try {
      // Region-prefixed so a digest claim in one region cannot suppress the same
      // (recipient, date) digest in another region.
      const digestKey = `compl:digest:${region}:${group.recipientUserId}:${group.jurisdictionDate}`;
      const claimed = await claimCronNotificationDedup(digestKey);
      if (!claimed) continue; // already sent today
      await dispatchDigest(client, group);
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
 *
 * Reads/writes go through the regional `client` threaded from the fan-out — the
 * cron runs without a tenant frame, so a tenant-scoped client's withTenantScope
 * extension would silently under-filter the cross-org scan. The client is the
 * region's raw writer (getRegionalClient). Mirror of economic-dependency-scan.ts
 * idiom (tagged PHASE-60-CROSS-ORG-AGGREGATE there; same principle applies here).
 */
async function processItem(
  client: ReminderScanClient,
  region: string,
  item: ItemForScan,
  now: Date,
): Promise<PendingFire | null> {
  if (!(item.expiresAt && item.expiryJurisdictionTz)) return null;

  const days = daysUntilExpiryInTz(item.expiresAt, item.expiryJurisdictionTz, now);
  const nextBand = bandFor(days);
  if (nextBand === 'NONE') return null;

  // Read current state (or default to NONE) via the regional client (no tenant frame).
  const existing = (await client.contractorComplianceReminderState.findUnique({
    where: { itemId: item.id },
  })) as { version: number; lastBandFired: string | null } | null;
  const knownVersion = existing?.version ?? 0;
  const lastFired = existing?.lastBandFired ?? null;

  // Only fire if the next band is forward of the last fired band.
  if (lastFired && bandIndex(nextBand) <= bandIndex(lastFired as ReminderBand)) return null;

  // Per-band dedup claim (region- + jurisdictionDate-scoped). Region-prefixed so the
  // same (item, band, date) claim does not collide across regions.
  const date = jurisdictionDate(now, item.expiryJurisdictionTz);
  const dedupKey = `compl:band:${region}:${item.id}:${nextBand}:${date}`;
  const claimed = await claimCronNotificationDedup(dedupKey);
  if (!claimed) return null;

  const persisted = await persistBandFire(
    client,
    item,
    nextBand,
    knownVersion,
    existing !== null,
    now,
  );
  if (!persisted) return null;

  return {
    itemId: item.id,
    organizationId: item.organizationId,
    band: nextBand,
    expiresAt: item.expiresAt,
    documentType: item.documentType,
    policyRuleId: item.policyRuleId,
    contractorId: item.contractorId,
    // displayName was selected in the top-level query — no per-item contractor N+1.
    contractorDisplayName: item.contractor.displayName,
  };
}

/**
 * Persists the band fire with optimistic concurrency. Returns false (skip the
 * fire) when a renewal-reset raced with us — either updateMany matched zero rows
 * (version bumped between read and write) or the create lost to a P2002 from a
 * parallel listener. Both cases retry on the next cron tick.
 *
 * Regional client: cron context, no tenant frame — mirrors processItem above.
 */
async function persistBandFire(
  client: ReminderScanClient,
  item: ItemForScan,
  nextBand: ReminderBand,
  knownVersion: number,
  exists: boolean,
  now: Date,
): Promise<boolean> {
  if (exists) {
    const updated = await client.contractorComplianceReminderState.updateMany({
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
    await client.contractorComplianceReminderState.create({
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
 * gate (same one the economic-dependency twin uses). It returns a distinct set
 * already — no re-dedup needed here.
 *
 * The contractor themselves is NOT a platform `User` in this data model (they
 * authenticate via PortalSession, not a User row), so they cannot be a
 * `dispatch` recipientUserId. The direct contractor-email reminder channel is
 * portal scope; this function dispatches the admin digest only.
 */
async function resolveRecipientsForItem(item: ItemForScan): Promise<string[]> {
  return resolveRbacRecipients(item.organizationId, 'contractor:read');
}

/**
 * Dispatch ONE digest notification listing all (doc, band, expiresAt) entries
 * for this recipient on this jurisdictionDate.
 *
 * Title and body are i18n-keyed so the notification-service resolveEventCopy
 * step localises them against the org's configured locale. Per-item document
 * labels are also resolved server-side (via resolveMessage) so the {items}
 * param carries locale-aware text rather than raw DocumentType enum values.
 *
 * Regional client: org language lookup is a cross-org read in the cron context.
 */
async function dispatchDigest(client: ReminderScanClient, group: DigestGroup): Promise<void> {
  const org = (await client.organization.findUnique({
    where: { id: group.organizationId },
    select: { language: true },
  })) as { language: string | null } | null;
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
// Renewal-reset listener — invoked from classification on expires_at_changed
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
