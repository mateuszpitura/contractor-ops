// Daily working-time-limit batch scan — the rolling-window half of the WT
// alerting (the synchronous on-save check in wt-limit-check.ts cannot see the
// multi-week average). An architectural twin of compliance-reminder-scan:
//
//   - The cron has no tenant frame, so the scan fans out over SUPPORTED_REGIONS
//     and reads each region through its OWN getRegionalClient — an EU-only client
//     would silently exclude every UAE/KSA (ME) employee.
//   - Two-pass: collect per-worker rolling breaches, then dispatch ONE digest per
//     recipient per day, gated by claimCronNotificationDedup on a REGION-PREFIXED
//     key so a digest claim in one region can never suppress another region's.
//
// The digest throttle is deliberate: a per-breach notification would be
// fatigue-grade spam. Keep the digest layer.

import { mapCountryCodeToJurisdiction, resolveWtLimits } from '@contractor-ops/compliance-policy';
import type { Prisma } from '@contractor-ops/db';
import { getRegionalClient, SUPPORTED_REGIONS } from '@contractor-ops/db';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';

import { claimCronNotificationDedup } from './cron-dedup';
import { dispatch } from './notification-service';
import { resolveRbacRecipients } from './rbac-recipients';

const log = createCronLogger('wt-limit-scan');

const MS_PER_DAY = 86_400_000;
// The widest jurisdiction rolling window (DE = 24 weeks) bounds the single time
// query; each worker is then trimmed to their own jurisdiction's window.
const MAX_WINDOW_WEEKS = 24;

export interface WtScanResult {
  scanned: number;
  breaches: number;
  digests: number;
}

/**
 * Structural cron-context client — only the delegates the scan reads. Threaded
 * from the region fan-out (getRegionalClient) so the cross-org sweep never rides
 * a tenant-scoped client whose withTenantScope extension would under-filter it.
 */
export interface WtScanClient {
  employeeTimeRecord: {
    findMany: (args: Prisma.EmployeeTimeRecordFindManyArgs) => Promise<unknown>;
  };
  employeeProfile: {
    findMany: (args: Prisma.EmployeeProfileFindManyArgs) => Promise<unknown>;
  };
}

interface TimeRow {
  workerId: string;
  organizationId: string;
  workDate: Date;
  workedMinutes: number;
  wtOptOut: boolean;
}

interface WtBreach {
  workerId: string;
  organizationId: string;
  jurisdiction: string;
  avgWeeklyMinutes: number;
  limitMinutes: number;
  windowWeeks: number;
}

interface RecipientDigest {
  recipientUserId: string;
  organizationId: string;
  breaches: WtBreach[];
}

/**
 * Public cron entry — fans the scan out across SUPPORTED_REGIONS. A region whose
 * DATABASE_URL_<REGION> is unset is skipped with a Pino warn (never a throw), so
 * the other regions still run. Per-region results accumulate.
 */
export async function runWtLimitScan(now: Date = new Date()): Promise<WtScanResult> {
  const total: WtScanResult = { scanned: 0, breaches: 0, digests: 0 };

  for (const region of SUPPORTED_REGIONS) {
    let client: WtScanClient;
    try {
      client = getRegionalClient(region) as unknown as WtScanClient;
    } catch (err) {
      log.warn({ err, region }, 'wt-limit-scan: region client unavailable; skipping region');
      continue;
    }

    const result = await runWtLimitScanForClient(client, region, now);
    total.scanned += result.scanned;
    total.breaches += result.breaches;
    total.digests += result.digests;
  }

  metrics.gauge('cron.wt_limit.scanned', total.scanned);
  metrics.gauge('cron.wt_limit.breaches', total.breaches);
  metrics.gauge('cron.wt_limit.digests', total.digests);

  log.info({ ...total }, 'wt-limit-scan complete (all regions)');
  return total;
}

/**
 * Per-region worker — two-pass scan against ONE regional client. `region`
 * region-prefixes the digest dedup keys.
 */
export async function runWtLimitScanForClient(
  client: WtScanClient,
  region: string,
  now: Date = new Date(),
): Promise<WtScanResult> {
  try {
    const windowStart = new Date(now.getTime() - MAX_WINDOW_WEEKS * 7 * MS_PER_DAY);
    const rows = (await client.employeeTimeRecord.findMany({
      where: { workDate: { gte: windowStart, lte: now } },
      select: {
        workerId: true,
        organizationId: true,
        workDate: true,
        workedMinutes: true,
        wtOptOut: true,
      },
    })) as TimeRow[];

    if (rows.length === 0) {
      return { scanned: 0, breaches: 0, digests: 0 };
    }

    const workerIds = [...new Set(rows.map(r => r.workerId))];
    const profiles = (await client.employeeProfile.findMany({
      where: { workerId: { in: workerIds } },
      select: { workerId: true, countryCode: true },
    })) as { workerId: string; countryCode: string }[];
    const countryByWorker = new Map(profiles.map(p => [p.workerId, p.countryCode]));

    const rowsByWorker = new Map<string, TimeRow[]>();
    for (const row of rows) {
      const list = rowsByWorker.get(row.workerId);
      if (list) {
        list.push(row);
      } else {
        rowsByWorker.set(row.workerId, [row]);
      }
    }

    const breaches = collectBreaches(rowsByWorker, countryByWorker, now);
    const digests = await dispatchBreachDigests(region, breaches, now);

    log.info(
      { region, scanned: rowsByWorker.size, breaches: breaches.length, digests },
      'wt-limit-scan region complete',
    );
    return { scanned: rowsByWorker.size, breaches: breaches.length, digests };
  } catch (err) {
    log.error({ err, region }, 'wt-limit-scan region failed (per-region catch — zero counts)');
    return { scanned: 0, breaches: 0, digests: 0 };
  }
}

/**
 * Pass 1 — per worker, sum workedMinutes over that jurisdiction's rolling window
 * and flag a breach when the weekly AVERAGE exceeds the statutory cap. A UK
 * opt-out (weeklyOptOutAllowed + a wtOptOut record in the window) suppresses it.
 */
function collectBreaches(
  rowsByWorker: Map<string, TimeRow[]>,
  countryByWorker: Map<string, string>,
  now: Date,
): WtBreach[] {
  const breaches: WtBreach[] = [];

  for (const [workerId, workerRows] of rowsByWorker) {
    const countryCode = countryByWorker.get(workerId);
    if (!countryCode) continue;
    const jurisdiction = mapCountryCodeToJurisdiction(countryCode);
    if (!jurisdiction) continue;
    const rule = resolveWtLimits(jurisdiction);
    if (!rule) continue;

    const windowStart = now.getTime() - rule.weeklyWindowWeeks * 7 * MS_PER_DAY;
    const inWindow = workerRows.filter(r => r.workDate.getTime() >= windowStart);
    const first = inWindow[0];
    if (!first) continue;

    const totalMinutes = inWindow.reduce((sum, r) => sum + r.workedMinutes, 0);
    const avgWeeklyMinutes = totalMinutes / rule.weeklyWindowWeeks;
    const optedOut = rule.weeklyOptOutAllowed && inWindow.some(r => r.wtOptOut);

    if (!optedOut && avgWeeklyMinutes > rule.weeklyAvgMaxMinutes) {
      breaches.push({
        workerId,
        organizationId: first.organizationId,
        jurisdiction,
        avgWeeklyMinutes: Math.round(avgWeeklyMinutes),
        limitMinutes: rule.weeklyAvgMaxMinutes,
        windowWeeks: rule.weeklyWindowWeeks,
      });
    }
  }

  return breaches;
}

/**
 * Pass 2 — group breaches per recipient (org admins/HR via resolveRbacRecipients)
 * and dispatch ONE digest per recipient/day, gated by a region-prefixed dedup key.
 */
async function dispatchBreachDigests(
  region: string,
  breaches: WtBreach[],
  now: Date,
): Promise<number> {
  if (breaches.length === 0) return 0;

  const day = now.toISOString().slice(0, 10);
  const recipientsByOrg = new Map<string, string[]>();
  const groups = new Map<string, RecipientDigest>();

  for (const breach of breaches) {
    let recipients = recipientsByOrg.get(breach.organizationId);
    if (!recipients) {
      recipients = await resolveRbacRecipients(breach.organizationId, 'contractor:read');
      recipientsByOrg.set(breach.organizationId, recipients);
    }
    for (const recipientUserId of recipients) {
      let group = groups.get(recipientUserId);
      if (!group) {
        group = { recipientUserId, organizationId: breach.organizationId, breaches: [] };
        groups.set(recipientUserId, group);
      }
      group.breaches.push(breach);
    }
  }

  let digests = 0;
  for (const group of groups.values()) {
    try {
      const digestKey = `wt:${region}:${group.recipientUserId}:${day}`;
      const claimed = await claimCronNotificationDedup(digestKey);
      if (!claimed) continue;
      await dispatchWtDigest(group, day);
      digests++;
    } catch (err) {
      log.error({ err, recipientUserId: group.recipientUserId }, 'wt-limit digest dispatch failed');
    }
  }

  return digests;
}

/**
 * One digest listing this recipient's WT breaches for the day. Title/body are
 * dotted i18n keys resolved per-org-locale by the notification-service
 * resolveEventCopy step — never rendered strings here.
 */
async function dispatchWtDigest(group: RecipientDigest, day: string): Promise<void> {
  await dispatch({
    organizationId: group.organizationId,
    type: 'employee.wt_limit_breach',
    recipientUserIds: [group.recipientUserId],
    title: 'EmployeeTime.notifications.wtLimitDigest.title',
    body: 'EmployeeTime.notifications.wtLimitDigest.body',
    entityType: 'EMPLOYEE_TIME_RECORD',
    entityId: group.breaches[0]?.workerId ?? group.organizationId,
    metadata: {
      count: group.breaches.length,
      day,
      breaches: group.breaches.map(b => ({
        workerId: b.workerId,
        jurisdiction: b.jurisdiction,
        avgWeeklyMinutes: b.avgWeeklyMinutes,
        limitMinutes: b.limitMinutes,
        windowWeeks: b.windowWeeks,
      })),
    },
  });
}
