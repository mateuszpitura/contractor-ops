// Leave accrual orchestration — wires the leave-balance engine into production
// paths: employee onboarding, the daily cron sweep, and manual ledger adjustments.

import type { Jurisdiction } from '@contractor-ops/compliance-policy';
import { mapCountryCodeToJurisdiction } from '@contractor-ops/compliance-policy';
import type { Prisma } from '@contractor-ops/db';
import { getRegionalClient, SUPPORTED_REGIONS } from '@contractor-ops/db';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';

import type { TxClient } from './approval-engine';
import type { AccrueAnnualInput } from './leave-balance';
import { accrueAnnual, applyCarryover, recomputeBalanceCache } from './leave-balance';

const log = createCronLogger('leave-accrual');

/** Full completed years of service as of `asOf` (UTC calendar). */
export function computeTenureYears(hireDate: Date, asOf: Date): number {
  let years = asOf.getUTCFullYear() - hireDate.getUTCFullYear();
  const hireMonthDay = hireDate.getUTCMonth() * 100 + hireDate.getUTCDate();
  const asOfMonthDay = asOf.getUTCMonth() * 100 + asOf.getUTCDate();
  if (asOfMonthDay < hireMonthDay) years -= 1;
  return Math.max(0, years);
}

function parseEtat(raw: string | { toString(): string } | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const n = Number.parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
}

async function hasLedgerSourceRef(
  tx: TxClient,
  key: { organizationId: string; workerId: string; leaveTypeId: string; sourceRef: string },
): Promise<boolean> {
  const row = await tx.leaveLedgerEntry.findFirst({
    where: {
      organizationId: key.organizationId,
      workerId: key.workerId,
      leaveTypeId: key.leaveTypeId,
      sourceRef: key.sourceRef,
    },
    select: { id: true },
  });
  return row !== null;
}

/** Idempotent annual accrual — skips when `accrual:{year}` already exists. */
export async function accrueAnnualIfNeeded(
  tx: TxClient,
  input: AccrueAnnualInput,
): Promise<{ accrued: boolean; accruedMinutes?: number }> {
  const sourceRef = `accrual:${input.year}`;
  if (
    await hasLedgerSourceRef(tx, {
      organizationId: input.organizationId,
      workerId: input.workerId,
      leaveTypeId: input.leaveTypeId,
      sourceRef,
    })
  ) {
    return { accrued: false };
  }
  const { accruedMinutes } = await accrueAnnual(tx, input);
  return { accrued: true, accruedMinutes };
}

export interface OnboardAccrualInput {
  organizationId: string;
  workerId: string;
  countryCode: string;
  hireDate: Date;
}

/** Seed the current-year ANNUAL accrual rows when an employee is registered. */
export async function onboardWorkerLeaveAccrual(
  tx: TxClient,
  input: OnboardAccrualInput,
): Promise<void> {
  const jurisdiction = mapCountryCodeToJurisdiction(input.countryCode);
  if (!jurisdiction) return;

  const annualTypes = await tx.leaveType.findMany({
    where: { organizationId: input.organizationId, kind: 'ANNUAL', active: true },
    select: { id: true },
  });
  if (annualTypes.length === 0) return;

  const profile = await tx.employeeProfile.findFirst({
    where: { workerId: input.workerId },
    select: { etat: true },
  });

  const year = new Date().getUTCFullYear();
  const tenureYears = computeTenureYears(input.hireDate, new Date(Date.UTC(year, 0, 1)));
  const etat = parseEtat(profile?.etat);

  for (const leaveType of annualTypes) {
    await accrueAnnualIfNeeded(tx, {
      organizationId: input.organizationId,
      workerId: input.workerId,
      leaveTypeId: leaveType.id,
      jurisdiction,
      tenureYears,
      etat,
      year,
    });
  }
}

export interface LeaveAdjustmentParams {
  organizationId: string;
  workerId: string;
  leaveTypeId: string;
  minutes: number;
  reason: string;
  effectiveDate?: string;
  userId?: string | null;
}

/** Append-only ADJUSTMENT ledger row + cache refresh (corrections never edit prior rows). */
export async function applyLeaveAdjustment(
  tx: TxClient,
  params: LeaveAdjustmentParams,
): Promise<{ entryId: string }> {
  const effectiveDate = params.effectiveDate
    ? new Date(params.effectiveDate)
    : new Date(
        Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()),
      );

  const entry = await tx.leaveLedgerEntry.create({
    data: {
      organizationId: params.organizationId,
      workerId: params.workerId,
      leaveTypeId: params.leaveTypeId,
      entryType: 'ADJUSTMENT',
      minutes: params.minutes,
      effectiveDate,
      reason: params.reason,
      createdByUserId: params.userId ?? null,
    },
    select: { id: true },
  });

  await recomputeBalanceCache(tx, {
    organizationId: params.organizationId,
    workerId: params.workerId,
    leaveTypeId: params.leaveTypeId,
    year: effectiveDate.getUTCFullYear(),
  });

  return { entryId: entry.id };
}

export interface CarryoverWorkerInput {
  organizationId: string;
  workerId: string;
  leaveTypeId: string;
  jurisdiction: Jurisdiction;
  fromYear: number;
}

/** Idempotent year-end carryover into `fromYear + 1`. */
export async function applyYearEndCarryoverIfNeeded(
  tx: TxClient,
  input: CarryoverWorkerInput,
): Promise<{ carried: boolean; carriedMinutes?: number }> {
  const sourceRef = `carryover:${input.fromYear}->${input.fromYear + 1}`;
  if (
    await hasLedgerSourceRef(tx, {
      organizationId: input.organizationId,
      workerId: input.workerId,
      leaveTypeId: input.leaveTypeId,
      sourceRef,
    })
  ) {
    return { carried: false };
  }

  const balance = await recomputeBalanceCache(tx, {
    organizationId: input.organizationId,
    workerId: input.workerId,
    leaveTypeId: input.leaveTypeId,
    year: input.fromYear,
  });
  const remaining = balance.entitledMinutes + balance.carryoverMinutes - balance.usedMinutes;
  if (remaining <= 0) return { carried: false };

  const { carriedMinutes } = await applyCarryover(tx, {
    organizationId: input.organizationId,
    workerId: input.workerId,
    leaveTypeId: input.leaveTypeId,
    jurisdiction: input.jurisdiction,
    remainingMinutes: remaining,
    fromYear: input.fromYear,
  });
  return carriedMinutes > 0 ? { carried: true, carriedMinutes } : { carried: false };
}

export interface LeaveAccrualScanResult {
  workers: number;
  accrued: number;
  carryovers: number;
}

interface AccrualScanClient {
  employeeProfile: {
    findMany: (args: Prisma.EmployeeProfileFindManyArgs) => Promise<
      Array<{
        workerId: string;
        organizationId: string;
        countryCode: string;
        etat: string | { toString(): string } | null;
        employmentStatus: string | null;
        worker: { personnelFile: { hireDate: Date | null } | null };
      }>
    >;
  };
  leaveType: {
    findMany: (args: Prisma.LeaveTypeFindManyArgs) => Promise<Array<{ id: string }>>;
  };
  $transaction: <R>(fn: (tx: TxClient) => Promise<R>) => Promise<R>;
}

async function runLeaveAccrualForClient(
  client: AccrualScanClient,
  now: Date,
): Promise<LeaveAccrualScanResult> {
  const year = now.getUTCFullYear();
  const isYearStart = now.getUTCMonth() === 0 && now.getUTCDate() === 1;
  const priorYear = year - 1;
  const accrualAsOf = new Date(Date.UTC(year, 0, 1));

  const employees = await client.employeeProfile.findMany({
    where: {
      employmentStatus: { in: ['ACTIVE', 'ON_LEAVE'] },
      worker: { workerType: 'EMPLOYEE', deletedAt: null },
    },
    select: {
      workerId: true,
      organizationId: true,
      countryCode: true,
      etat: true,
      employmentStatus: true,
      worker: { select: { personnelFile: { select: { hireDate: true } } } },
    },
  });

  let accrued = 0;
  let carryovers = 0;

  const typesByOrg = new Map<string, Array<{ id: string }>>();

  for (const emp of employees) {
    const jurisdiction = mapCountryCodeToJurisdiction(emp.countryCode);
    if (!jurisdiction) continue;

    let annualTypes = typesByOrg.get(emp.organizationId);
    if (!annualTypes) {
      annualTypes = await client.leaveType.findMany({
        where: { organizationId: emp.organizationId, kind: 'ANNUAL', active: true },
        select: { id: true },
      });
      typesByOrg.set(emp.organizationId, annualTypes);
    }
    if (annualTypes.length === 0) continue;

    const hireDate = emp.worker.personnelFile?.hireDate;
    if (!hireDate) continue;

    const tenureYears = computeTenureYears(hireDate, accrualAsOf);
    const etat = parseEtat(emp.etat);

    for (const leaveType of annualTypes) {
      try {
        await client.$transaction(async tx => {
          const accrual = await accrueAnnualIfNeeded(tx, {
            organizationId: emp.organizationId,
            workerId: emp.workerId,
            leaveTypeId: leaveType.id,
            jurisdiction,
            tenureYears,
            etat,
            year,
          });
          if (accrual.accrued) accrued += 1;

          if (isYearStart) {
            const carry = await applyYearEndCarryoverIfNeeded(tx, {
              organizationId: emp.organizationId,
              workerId: emp.workerId,
              leaveTypeId: leaveType.id,
              jurisdiction,
              fromYear: priorYear,
            });
            if (carry.carried) carryovers += 1;
          }
        });
      } catch (err) {
        log.warn(
          { err, organizationId: emp.organizationId, workerId: emp.workerId },
          'leave-accrual: worker failed (best-effort, continuing)',
        );
      }
    }
  }

  return { workers: employees.length, accrued, carryovers };
}

/** Daily cron entry — fans out across data regions. */
export async function runLeaveAccrualScan(now: Date = new Date()): Promise<LeaveAccrualScanResult> {
  const total: LeaveAccrualScanResult = { workers: 0, accrued: 0, carryovers: 0 };

  for (const region of SUPPORTED_REGIONS) {
    let client: AccrualScanClient;
    try {
      client = getRegionalClient(region) as unknown as AccrualScanClient;
    } catch (err) {
      log.warn({ err, region }, 'leave-accrual: region client unavailable; skipping');
      continue;
    }

    const result = await runLeaveAccrualForClient(client, now);
    total.workers += result.workers;
    total.accrued += result.accrued;
    total.carryovers += result.carryovers;
  }

  metrics.gauge('cron.leave_accrual.workers', total.workers);
  metrics.gauge('cron.leave_accrual.accrued', total.accrued);
  metrics.gauge('cron.leave_accrual.carryovers', total.carryovers);
  log.info(total, 'leave-accrual scan completed');
  return total;
}
