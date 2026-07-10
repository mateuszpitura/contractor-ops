// ---------------------------------------------------------------------------
// Contract lifecycle expiry scan.
// ---------------------------------------------------------------------------
//
// Daily sweep: ACTIVE contracts whose endDate falls within the expiring window
// transition to EXPIRING; ACTIVE/EXPIRING contracts past endDate transition to
// EXPIRED. Uses compare-and-swap updateMany + audit rows (SYSTEM actor).
//
// Mirrors the regional fan-out of data-purge / compliance-reminder-scan — the
// cron has no tenant frame, so each SUPPORTED_REGIONS pass uses getRegionalClient.

import type { DataRegion } from '@contractor-ops/db';
import { getRegionalClient, SUPPORTED_REGIONS } from '@contractor-ops/db';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';

import { writeAuditLog } from './audit-writer';

const log = createCronLogger('contract-expiry-scan');

/** Aligns with dashboard KPI / contractor insights expiring window. */
export const CONTRACT_EXPIRING_WINDOW_DAYS = 30;

type RegionalClient = ReturnType<typeof getRegionalClient>;

type ContractCandidate = {
  id: string;
  organizationId: string;
  title: string;
  status: 'ACTIVE' | 'EXPIRING';
  endDate: Date;
};

export interface ContractExpiryScanResult {
  regionsScanned: DataRegion[];
  regionsSkipped: DataRegion[];
  expired: number;
  expiring: number;
  errors: number;
}

/** Normalise an instant to the UTC calendar day of `@db.Date` comparisons. */
export function utcCalendarDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addUtcDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** True when endDate is strictly before today (endDate = today is still active). */
export function isContractEndDatePast(endDate: Date, today: Date): boolean {
  return endDate < today;
}

/** True when endDate is today or within the next `windowDays` calendar days. */
export function isContractEndDateWithinExpiringWindow(
  endDate: Date,
  today: Date,
  windowDays: number,
): boolean {
  const windowEnd = addUtcDays(today, windowDays);
  return endDate >= today && endDate <= windowEnd;
}

async function transitionContract(
  client: RegionalClient,
  region: DataRegion,
  contract: ContractCandidate,
  targetStatus: 'EXPIRING' | 'EXPIRED',
): Promise<boolean> {
  try {
    await client.$transaction(async tx => {
      const cas = await tx.contract.updateMany({
        where: { id: contract.id, status: contract.status },
        data: { status: targetStatus },
      });
      if (cas.count === 0) return;

      await writeAuditLog({
        organizationId: contract.organizationId,
        actorType: 'SYSTEM',
        action: 'STATUS_TRANSITION',
        resourceType: 'CONTRACT',
        resourceId: contract.id,
        resourceName: contract.title,
        oldValues: { status: contract.status },
        newValues: { status: targetStatus },
        metadata: {
          source: 'contract-expiry-scan',
          endDate: contract.endDate.toISOString().slice(0, 10),
        },
        tx,
        region,
      });
    });
    return true;
  } catch (err) {
    log.error(
      { err, contractId: contract.id, region, targetStatus },
      'contract expiry transition failed',
    );
    return false;
  }
}

async function scanRegion(
  client: RegionalClient,
  region: DataRegion,
  now: Date,
): Promise<{ expired: number; expiring: number; errors: number }> {
  const today = utcCalendarDay(now);
  const windowEnd = addUtcDays(today, CONTRACT_EXPIRING_WINDOW_DAYS);

  let expired = 0;
  let expiring = 0;
  let errors = 0;

  const expiredCandidates = await client.contract.findMany({
    where: {
      deletedAt: null,
      endDate: { lt: today },
      status: { in: ['ACTIVE', 'EXPIRING'] },
    },
    select: {
      id: true,
      organizationId: true,
      title: true,
      status: true,
      endDate: true,
    },
  });

  for (const contract of expiredCandidates) {
    if (!contract.endDate) continue;
    const row: ContractCandidate = {
      ...contract,
      status: contract.status as 'ACTIVE' | 'EXPIRING',
      endDate: contract.endDate,
    };
    const ok = await transitionContract(client, region, row, 'EXPIRED');
    if (ok) expired++;
    else errors++;
  }

  const expiringCandidates = await client.contract.findMany({
    where: {
      deletedAt: null,
      endDate: { gte: today, lte: windowEnd },
      status: 'ACTIVE',
    },
    select: {
      id: true,
      organizationId: true,
      title: true,
      status: true,
      endDate: true,
    },
  });

  for (const contract of expiringCandidates) {
    if (!contract.endDate) continue;
    const row: ContractCandidate = {
      ...contract,
      status: contract.status as 'ACTIVE' | 'EXPIRING',
      endDate: contract.endDate,
    };
    const ok = await transitionContract(client, region, row, 'EXPIRING');
    if (ok) expiring++;
    else errors++;
  }

  return { expired, expiring, errors };
}

export async function runContractExpiryScan(
  now: Date = new Date(),
): Promise<ContractExpiryScanResult> {
  const regionsScanned: DataRegion[] = [];
  const regionsSkipped: DataRegion[] = [];
  let expired = 0;
  let expiring = 0;
  let errors = 0;

  for (const region of SUPPORTED_REGIONS) {
    let client: RegionalClient;
    try {
      client = getRegionalClient(region);
    } catch {
      regionsSkipped.push(region);
      log.info({ region }, 'region has no configured database — contract expiry scan skipped');
      continue;
    }

    try {
      const regionResult = await scanRegion(client, region, now);
      expired += regionResult.expired;
      expiring += regionResult.expiring;
      errors += regionResult.errors;
      regionsScanned.push(region);
      log.info({ region, ...regionResult }, 'contract-expiry-scan region complete');
    } catch (err) {
      errors++;
      log.error({ err, region }, 'contract-expiry-scan region failed');
    }
  }

  metrics.gauge('cron.contract_expiry_scan.expired', expired);
  metrics.gauge('cron.contract_expiry_scan.expiring', expiring);
  metrics.gauge('cron.contract_expiry_scan.errors', errors);
  metrics.gauge('cron.contract_expiry_scan.regions', regionsScanned.length);

  return { regionsScanned, regionsSkipped, expired, expiring, errors };
}
