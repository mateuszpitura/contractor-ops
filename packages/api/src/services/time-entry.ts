import type { TimeEntry } from '@contractor-ops/db/generated/prisma/client';
import { TRPCError } from '@trpc/server';
import {
  TIMESHEET_CAN_ONLY_EDIT_DRAFT_OR_REJECTED,
  TIMESHEET_CANNOT_APPROVE,
  TIMESHEET_CANNOT_EDIT_IMPORTED,
  TIMESHEET_CANNOT_REJECT,
  TIMESHEET_CANNOT_SUBMIT,
  TIMESHEET_ENTRY_DATE_OUT_OF_WEEK,
  TIMESHEET_ENTRY_NOT_FOUND,
  TIMESHEET_INVALID_CONTRACT,
  TIMESHEET_NOT_FOUND,
  TIMESHEET_WEEK_START_DATE_MUST_BE_MONDAY,
} from '../errors';
import { writeAuditLog, writeAuditLogMany } from './audit-writer';
import type { DbClient } from './types';

type TxClient = Parameters<Parameters<DbClient['$transaction']>[0]>[0];

export interface TimesheetAuditContext {
  actorName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// ---------------------------------------------------------------------------
// Status transition rules:
// DRAFT -> SUBMITTED (contractor submits)
// SUBMITTED -> APPROVED (manager approves)
// SUBMITTED -> REJECTED (manager rejects with reason)
// REJECTED -> SUBMITTED (contractor resubmits after corrections)
// ---------------------------------------------------------------------------

/**
 * Returns the ISO Monday for a given date (sets to start of ISO week).
 * Avoids external date-fns dependency — inlined for zero overhead.
 */
function getISOMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

function parseEntryDate(entryDate: string): Date {
  return new Date(`${entryDate}T00:00:00.000Z`);
}

async function assertValidContractsForEntries(
  db: DbClient,
  organizationId: string,
  contractorId: string,
  contractIds: string[],
): Promise<void> {
  if (!('contract' in db)) return;

  const uniqueIds = [...new Set(contractIds)];
  const valid = await (
    db as DbClient & {
      contract: {
        findMany: (args: {
          where: {
            id: { in: string[] };
            organizationId: string;
            contractorId: string;
            deletedAt: null;
            status: { in: string[] };
          };
          select: { id: true };
        }) => Promise<Array<{ id: string }>>;
      };
    }
  ).contract.findMany({
    where: {
      id: { in: uniqueIds },
      organizationId,
      contractorId,
      deletedAt: null,
      status: { in: ['ACTIVE', 'PENDING'] },
    },
    select: { id: true },
  });
  if (valid.length !== uniqueIds.length) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: TIMESHEET_INVALID_CONTRACT });
  }
}

function assertEntryDateInWeek(entryDate: string, weekStartDate: Date): void {
  const entry = parseEntryDate(entryDate);
  const weekEnd = getWeekEnd(weekStartDate);
  if (entry < weekStartDate || entry > weekEnd) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: TIMESHEET_ENTRY_DATE_OUT_OF_WEEK });
  }
}

/** Imported/manual entry writes are allowed only on DRAFT or REJECTED sheets. */
export function assertTimesheetEditable(status: string): void {
  if (status !== 'DRAFT' && status !== 'REJECTED') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: TIMESHEET_CAN_ONLY_EDIT_DRAFT_OR_REJECTED,
    });
  }
}

// ---------------------------------------------------------------------------
// getOrCreateTimesheet
// ---------------------------------------------------------------------------

export async function getOrCreateTimesheet(
  db: DbClient,
  organizationId: string,
  contractorId: string,
  weekStartDate: Date, // Must be a Monday
  opts?: { requireEditable?: boolean },
) {
  // Validate weekStartDate is a Monday
  const monday = getISOMonday(weekStartDate);
  if (monday.getTime() !== weekStartDate.getTime()) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: TIMESHEET_WEEK_START_DATE_MUST_BE_MONDAY,
    });
  }

  const timesheet = await db.timesheet.upsert({
    where: {
      organizationId_contractorId_weekStartDate: {
        organizationId,
        contractorId,
        weekStartDate: monday,
      },
    },
    create: {
      organizationId,
      contractorId,
      weekStartDate: monday,
      status: 'DRAFT',
      totalMinutes: 0,
    },
    update: {},
    include: { entries: true },
  });

  if (opts?.requireEditable) {
    assertTimesheetEditable(timesheet.status);
  }

  return timesheet;
}

/**
 * Updates an existing time entry after verifying ownership and MANUAL source.
 */
async function updateExistingEntry(
  tx: TxClient,
  entryId: string,
  organizationId: string,
  contractorId: string,
  timesheetId: string,
  entry: { contractId: string; entryDate: string; minutes: number; description?: string },
): Promise<TimeEntry> {
  const existing = await tx.timeEntry.findFirst({
    where: { id: entryId, organizationId, contractorId, timesheetId },
  });
  if (!existing) {
    throw new TRPCError({ code: 'NOT_FOUND', message: TIMESHEET_ENTRY_NOT_FOUND });
  }
  if (existing.source !== 'MANUAL') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: TIMESHEET_CANNOT_EDIT_IMPORTED,
    });
  }
  return tx.timeEntry.update({
    where: { id: entryId },
    data: {
      contractId: entry.contractId,
      entryDate: new Date(entry.entryDate),
      minutes: entry.minutes,
      description: entry.description ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// saveDraftEntries
// ---------------------------------------------------------------------------

export async function saveDraftEntries(
  db: DbClient,
  organizationId: string,
  contractorId: string,
  timesheetId: string,
  entries: Array<{
    id?: string;
    contractId: string;
    entryDate: string;
    minutes: number;
    description?: string;
  }>,
) {
  // Verify timesheet belongs to contractor and is in DRAFT or REJECTED status
  const timesheet = await db.timesheet.findFirst({
    where: { id: timesheetId, organizationId, contractorId },
  });

  if (!timesheet) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: TIMESHEET_NOT_FOUND,
    });
  }

  if (timesheet.status !== 'DRAFT' && timesheet.status !== 'REJECTED') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: TIMESHEET_CAN_ONLY_EDIT_DRAFT_OR_REJECTED,
    });
  }

  await assertValidContractsForEntries(
    db,
    organizationId,
    contractorId,
    entries.map(e => e.contractId),
  );
  for (const entry of entries) {
    assertEntryDateInWeek(entry.entryDate, timesheet.weekStartDate);
  }

  // Upsert entries in transaction
  const result = await db.$transaction(async (tx: TxClient) => {
    const upserted: TimeEntry[] = [];
    for (const entry of entries) {
      const record = entry.id
        ? await updateExistingEntry(tx, entry.id, organizationId, contractorId, timesheetId, entry)
        : await tx.timeEntry.create({
            data: {
              organizationId,
              timesheetId,
              contractorId,
              contractId: entry.contractId,
              entryDate: new Date(entry.entryDate),
              minutes: entry.minutes,
              description: entry.description ?? null,
              source: 'MANUAL',
            },
          });
      upserted.push(record);
    }

    // Recalculate totalMinutes
    const { _sum } = await tx.timeEntry.aggregate({
      where: { timesheetId, organizationId },
      _sum: { minutes: true },
    });
    await tx.timesheet.update({
      where: { id: timesheetId },
      data: { totalMinutes: _sum.minutes ?? 0 },
    });

    return upserted;
  });

  return result;
}

// ---------------------------------------------------------------------------
// submitTimesheet
// ---------------------------------------------------------------------------

export async function submitTimesheet(
  db: DbClient,
  organizationId: string,
  contractorId: string,
  timesheetId: string,
) {
  // Optimistic lock: update only if status is DRAFT or REJECTED
  const updated = await db.timesheet.updateMany({
    where: {
      id: timesheetId,
      organizationId,
      contractorId,
      status: { in: ['DRAFT', 'REJECTED'] },
    },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
      rejectionReason: null, // Clear previous rejection
    },
  });

  if (updated.count === 0) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: TIMESHEET_CANNOT_SUBMIT,
    });
  }

  return db.timesheet.findUniqueOrThrow({
    where: { id: timesheetId },
    include: { entries: true },
  });
}

// ---------------------------------------------------------------------------
// approveTimesheet
// ---------------------------------------------------------------------------

export async function approveTimesheet(
  db: DbClient,
  organizationId: string,
  timesheetId: string,
  reviewerUserId: string,
  audit?: TimesheetAuditContext,
) {
  return db.$transaction(async (tx: TxClient) => {
    const timesheet = await tx.timesheet.findFirst({
      where: { id: timesheetId, organizationId, status: 'SUBMITTED' },
    });

    if (!timesheet) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: TIMESHEET_CANNOT_APPROVE,
      });
    }

    await tx.timesheet.update({
      where: { id: timesheetId },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedByUserId: reviewerUserId,
      },
    });

    await writeAuditLog({
      tx,
      organizationId,
      actorType: 'USER',
      actorId: reviewerUserId,
      actorName: audit?.actorName ?? null,
      action: 'timesheet.approve',
      resourceType: 'TIMESHEET',
      resourceId: timesheetId,
      oldValues: { status: timesheet.status },
      newValues: { status: 'APPROVED' },
      ipAddress: audit?.ipAddress ?? null,
      userAgent: audit?.userAgent ?? null,
    });

    return tx.timesheet.findUniqueOrThrow({
      where: { id: timesheetId },
      include: { entries: true, contractor: true },
    });
  });
}

// ---------------------------------------------------------------------------
// rejectTimesheet
// ---------------------------------------------------------------------------

export async function rejectTimesheet(
  db: DbClient,
  organizationId: string,
  timesheetId: string,
  reviewerUserId: string,
  reason: string,
  audit?: TimesheetAuditContext,
) {
  return db.$transaction(async (tx: TxClient) => {
    const timesheet = await tx.timesheet.findFirst({
      where: { id: timesheetId, organizationId, status: 'SUBMITTED' },
    });

    if (!timesheet) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: TIMESHEET_CANNOT_REJECT,
      });
    }

    await tx.timesheet.update({
      where: { id: timesheetId },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedByUserId: reviewerUserId,
        rejectionReason: reason,
      },
    });

    await writeAuditLog({
      tx,
      organizationId,
      actorType: 'USER',
      actorId: reviewerUserId,
      actorName: audit?.actorName ?? null,
      action: 'timesheet.reject',
      resourceType: 'TIMESHEET',
      resourceId: timesheetId,
      oldValues: { status: timesheet.status },
      newValues: { status: 'REJECTED', rejectionReason: reason },
      ipAddress: audit?.ipAddress ?? null,
      userAgent: audit?.userAgent ?? null,
    });

    return tx.timesheet.findUniqueOrThrow({
      where: { id: timesheetId },
      include: { entries: true, contractor: true },
    });
  });
}

// ---------------------------------------------------------------------------
// bulkApproveTimesheets
// ---------------------------------------------------------------------------

export async function bulkApproveTimesheets(
  db: DbClient,
  organizationId: string,
  timesheetIds: string[],
  reviewerUserId: string,
  audit?: TimesheetAuditContext,
) {
  return db.$transaction(async (tx: TxClient) => {
    const timesheets = await tx.timesheet.findMany({
      where: {
        id: { in: timesheetIds },
        organizationId,
        status: 'SUBMITTED',
      },
      select: { id: true, status: true },
    });

    if (timesheets.length === 0) {
      return { count: 0 };
    }

    const result = await tx.timesheet.updateMany({
      where: {
        id: { in: timesheets.map(t => t.id) },
        organizationId,
        status: 'SUBMITTED',
      },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedByUserId: reviewerUserId,
      },
    });

    await writeAuditLogMany({
      tx,
      rows: timesheets.map(ts => ({
        organizationId,
        actorType: 'USER' as const,
        actorId: reviewerUserId,
        actorName: audit?.actorName ?? null,
        action: 'timesheet.approve',
        resourceType: 'TIMESHEET' as const,
        resourceId: ts.id,
        oldValues: { status: ts.status },
        newValues: { status: 'APPROVED' },
        ipAddress: audit?.ipAddress ?? null,
        userAgent: audit?.userAgent ?? null,
      })),
    });

    return result;
  });
}

// ---------------------------------------------------------------------------
// bulkRejectTimesheets
// ---------------------------------------------------------------------------

export async function bulkRejectTimesheets(
  db: DbClient,
  organizationId: string,
  timesheetIds: string[],
  reviewerUserId: string,
  reason: string,
  audit?: TimesheetAuditContext,
) {
  return db.$transaction(async (tx: TxClient) => {
    const timesheets = await tx.timesheet.findMany({
      where: {
        id: { in: timesheetIds },
        organizationId,
        status: 'SUBMITTED',
      },
      select: { id: true, status: true },
    });

    if (timesheets.length === 0) {
      return { count: 0 };
    }

    const result = await tx.timesheet.updateMany({
      where: {
        id: { in: timesheets.map(t => t.id) },
        organizationId,
        status: 'SUBMITTED',
      },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedByUserId: reviewerUserId,
        rejectionReason: reason,
      },
    });

    await writeAuditLogMany({
      tx,
      rows: timesheets.map(ts => ({
        organizationId,
        actorType: 'USER' as const,
        actorId: reviewerUserId,
        actorName: audit?.actorName ?? null,
        action: 'timesheet.reject',
        resourceType: 'TIMESHEET' as const,
        resourceId: ts.id,
        oldValues: { status: ts.status },
        newValues: { status: 'REJECTED', rejectionReason: reason },
        ipAddress: audit?.ipAddress ?? null,
        userAgent: audit?.userAgent ?? null,
      })),
    });

    return result;
  });
}
