import { createLogger } from '@contractor-ops/logger';
import type { TxClient } from './approval-engine';

const log = createLogger({ service: 'leave-ewidencja-materialization' });

type LeaveKind = 'ANNUAL' | 'SICK' | 'PARENTAL' | 'BEREAVEMENT' | 'STUDY' | 'UNPAID' | 'OTHER';

type AbsenceKind =
  | 'VACATION'
  | 'SICK'
  | 'PARENTAL'
  | 'BEREAVEMENT'
  | 'STUDY'
  | 'UNPAID'
  | 'OTHER_JUSTIFIED';

function leaveKindToAbsence(kind: LeaveKind): AbsenceKind {
  switch (kind) {
    case 'ANNUAL':
      return 'VACATION';
    case 'SICK':
      return 'SICK';
    case 'PARENTAL':
      return 'PARENTAL';
    case 'BEREAVEMENT':
      return 'BEREAVEMENT';
    case 'STUDY':
      return 'STUDY';
    case 'UNPAID':
      return 'UNPAID';
    default:
      return 'OTHER_JUSTIFIED';
  }
}

function eachUtcDateInclusive(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor.getTime() <= last.getTime()) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function isUtcWeekend(workDate: Date): boolean {
  const day = workDate.getUTCDay();
  return day === 0 || day === 6;
}

export interface LeaveMaterializationAdvisories {
  skippedWeekends: number;
  skippedPublicHolidays: number;
  skippedWorkedDays: number;
}

function utcDateKey(workDate: Date): string {
  return workDate.toISOString().slice(0, 10);
}

/**
 * Materialises approved leave into day-grain `EmployeeTimeRecord` rows so the
 * KP §149 ewidencja register reflects absences without manual re-keying.
 *
 * Does not overwrite days that already record worked time, and skips weekends
 * (Sat/Sun) and org-country public holidays so absence rows are not stamped on
 * non-working days.
 */
export async function materializeApprovedLeaveDays(
  tx: TxClient,
  opts: {
    organizationId: string;
    workerId: string;
    leaveTypeKind: LeaveKind;
    startDate: Date;
    endDate: Date;
  },
): Promise<LeaveMaterializationAdvisories> {
  const absenceKind = leaveKindToAbsence(opts.leaveTypeKind);
  const days = eachUtcDateInclusive(opts.startDate, opts.endDate);
  const advisories: LeaveMaterializationAdvisories = {
    skippedWeekends: 0,
    skippedPublicHolidays: 0,
    skippedWorkedDays: 0,
  };

  const org = await tx.organization.findUnique({
    where: { id: opts.organizationId },
    select: { countryCode: true },
  });
  const publicHolidayKeys = new Set<string>();
  if (org?.countryCode) {
    const holidays = await tx.publicHoliday.findMany({
      where: {
        countryCode: org.countryCode,
        holidayDate: { gte: opts.startDate, lte: opts.endDate },
      },
      select: { holidayDate: true },
    });
    for (const row of holidays) {
      publicHolidayKeys.add(utcDateKey(row.holidayDate));
    }
  }

  for (const workDate of days) {
    if (isUtcWeekend(workDate)) {
      advisories.skippedWeekends += 1;
      continue;
    }

    if (publicHolidayKeys.has(utcDateKey(workDate))) {
      advisories.skippedPublicHolidays += 1;
      continue;
    }

    const existing = await tx.employeeTimeRecord.findUnique({
      where: {
        organizationId_workerId_workDate: {
          organizationId: opts.organizationId,
          workerId: opts.workerId,
          workDate,
        },
      },
      select: { workedMinutes: true },
    });

    if (existing && existing.workedMinutes > 0) {
      advisories.skippedWorkedDays += 1;
      log.info(
        {
          organizationId: opts.organizationId,
          workerId: opts.workerId,
          workDate: workDate.toISOString(),
          workedMinutes: existing.workedMinutes,
        },
        'leave materialisation skipped day with recorded work time',
      );
      continue;
    }

    await tx.employeeTimeRecord.upsert({
      where: {
        organizationId_workerId_workDate: {
          organizationId: opts.organizationId,
          workerId: opts.workerId,
          workDate,
        },
      },
      create: {
        organizationId: opts.organizationId,
        workerId: opts.workerId,
        workDate,
        workedMinutes: 0,
        absenceKind,
        source: 'IMPORTED',
      },
      update: {
        absenceKind,
        source: 'IMPORTED',
      },
    });
  }

  return advisories;
}
