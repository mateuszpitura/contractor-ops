// Ewidencja czasu pracy builder (PL KP art. 149) — freezes the statutory
// working-time register for a worker-period into an immutable snapshot.
//
// buildEwidencjaSnapshot assembles the KP §149 field set (hours + start/end,
// night, overtime bands, days-off with type, on-call dyżur hours + place,
// zwolnienia and other absences) from Σ EmployeeTimeRecord + the leave ledger
// and freezes it to a deterministic (stable key order) JSON document — a
// point-in-time evidentiary record, not a live projection of mutable rows.
//
// Supersession is INSERT-only: regenerating a register INSERTs a NEW version row
// (version+1 + previousSnapshotId back-pointer set at insert), so the append-only
// UPDATE-reject trigger on EwidencjaSnapshot never conflicts. Prior rows are
// never updated. The "current" register is the highest-version row.

import type { TxClient } from './approval-engine';

export interface EwidencjaDayEntry {
  workDate: string;
  startTime: string | null;
  endTime: string | null;
  workedMinutes: number;
  nightMinutes: number;
  overtimeMinutes50: number;
  overtimeMinutes100: number;
  weekendHolidayMinutes: number;
  onCallMinutes: number;
  onCallLocation: string | null;
  absenceKind: string | null;
}

export interface EwidencjaTotals {
  workedMinutes: number;
  nightMinutes: number;
  overtimeMinutes50: number;
  overtimeMinutes100: number;
  weekendHolidayMinutes: number;
  onCallMinutes: number;
}

export interface EwidencjaAbsences {
  /** zwolnienia lekarskie (sick) */
  sick: number;
  /** other justified absences (vacation/parental/bereavement/study/other) */
  justified: number;
  /** unjustified absences */
  unjustified: number;
}

export interface EwidencjaSnapshotContent {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  totals: EwidencjaTotals;
  days: EwidencjaDayEntry[];
  absences: EwidencjaAbsences;
  /** Total leave minutes deducted in the period (magnitude, positive). */
  leaveDeductedMinutes: number;
}

export interface BuildEwidencjaInput {
  tx: TxClient;
  organizationId: string;
  workerId: string;
  periodStart: Date;
  periodEnd: Date;
}

const JUSTIFIED_ABSENCES = new Set([
  'VACATION',
  'PARENTAL',
  'BEREAVEMENT',
  'STUDY',
  'UNPAID',
  'OTHER_JUSTIFIED',
]);

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toIsoOrNull(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function periodKeyFor(periodStart: Date): string {
  const year = periodStart.getUTCFullYear();
  const month = String(periodStart.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export async function buildEwidencjaSnapshot(
  input: BuildEwidencjaInput,
): Promise<EwidencjaSnapshotContent> {
  const records = await input.tx.employeeTimeRecord.findMany({
    where: {
      organizationId: input.organizationId,
      workerId: input.workerId,
      workDate: { gte: input.periodStart, lte: input.periodEnd },
    },
    orderBy: { workDate: 'asc' },
  });

  const ledger = await input.tx.leaveLedgerEntry.findMany({
    where: {
      organizationId: input.organizationId,
      workerId: input.workerId,
      effectiveDate: { gte: input.periodStart, lte: input.periodEnd },
    },
    select: { entryType: true, minutes: true },
  });

  const totals: EwidencjaTotals = {
    workedMinutes: 0,
    nightMinutes: 0,
    overtimeMinutes50: 0,
    overtimeMinutes100: 0,
    weekendHolidayMinutes: 0,
    onCallMinutes: 0,
  };
  const absences: EwidencjaAbsences = { sick: 0, justified: 0, unjustified: 0 };

  const days: EwidencjaDayEntry[] = records.map(r => {
    totals.workedMinutes += r.workedMinutes;
    totals.nightMinutes += r.nightMinutes;
    totals.overtimeMinutes50 += r.overtimeMinutes50;
    totals.overtimeMinutes100 += r.overtimeMinutes100;
    totals.weekendHolidayMinutes += r.weekendHolidayMinutes;
    totals.onCallMinutes += r.onCallMinutes;

    if (r.absenceKind === 'SICK') absences.sick += 1;
    else if (r.absenceKind === 'UNJUSTIFIED') absences.unjustified += 1;
    else if (r.absenceKind && JUSTIFIED_ABSENCES.has(r.absenceKind)) absences.justified += 1;

    return {
      workDate: toDateStr(r.workDate),
      startTime: toIsoOrNull(r.startTime),
      endTime: toIsoOrNull(r.endTime),
      workedMinutes: r.workedMinutes,
      nightMinutes: r.nightMinutes,
      overtimeMinutes50: r.overtimeMinutes50,
      overtimeMinutes100: r.overtimeMinutes100,
      weekendHolidayMinutes: r.weekendHolidayMinutes,
      onCallMinutes: r.onCallMinutes,
      onCallLocation: r.onCallLocation ?? null,
      absenceKind: r.absenceKind ?? null,
    };
  });

  const leaveDeductedMinutes = ledger.reduce(
    (sum, row) => (row.entryType === 'DEDUCTION' ? sum + -row.minutes : sum),
    0,
  );

  return {
    periodKey: periodKeyFor(input.periodStart),
    periodStart: toDateStr(input.periodStart),
    periodEnd: toDateStr(input.periodEnd),
    totals,
    days,
    absences,
    leaveDeductedMinutes,
  };
}

export interface SupersedeEwidencjaInput {
  organizationId: string;
  workerId: string;
  periodStart: Date;
  periodEnd: Date;
  periodKey: string;
  snapshotJson: EwidencjaSnapshotContent;
  generatedByUserId?: string | null;
}

/**
 * INSERT-only supersession: reads the highest existing version for the
 * (org, worker, period), then INSERTS a new row with version+1 and a
 * previousSnapshotId back-pointer. NEVER updates a prior row — the append-only
 * trigger forbids UPDATE, and the highest-version row is the current register.
 */
export async function supersedeAndInsertEwidencja(
  tx: TxClient,
  input: SupersedeEwidencjaInput,
): Promise<{ id: string; version: number }> {
  const prior = await tx.ewidencjaSnapshot.findFirst({
    where: {
      organizationId: input.organizationId,
      workerId: input.workerId,
      periodKey: input.periodKey,
    },
    orderBy: { version: 'desc' },
    select: { id: true, version: true },
  });

  const nextVersion = (prior?.version ?? 0) + 1;

  const created = await tx.ewidencjaSnapshot.create({
    data: {
      organizationId: input.organizationId,
      workerId: input.workerId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      periodKey: input.periodKey,
      version: nextVersion,
      previousSnapshotId: prior?.id ?? null,
      status: 'ACTIVE',
      snapshotJson: input.snapshotJson as unknown as object,
      generatedByUserId: input.generatedByUserId ?? null,
    },
    select: { id: true, version: true },
  });

  return created;
}
