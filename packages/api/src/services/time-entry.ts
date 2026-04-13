import type { TimeEntry } from '@contractor-ops/db/generated/prisma/client';
import { TRPCError } from '@trpc/server';
import type { DbClient } from './types.js';

type TxClient = Parameters<Parameters<DbClient['$transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// Status transition rules (D-03):
// DRAFT -> SUBMITTED (contractor submits)
// SUBMITTED -> APPROVED (manager approves)
// SUBMITTED -> REJECTED (manager rejects with reason)
// REJECTED -> SUBMITTED (contractor resubmits after corrections)
// ---------------------------------------------------------------------------

/**
 * Returns the ISO Monday for a given date (sets to start of ISO week).
 * Avoids external date-fns dependency — inline per Phase 4 convention.
 */
function getISOMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// getOrCreateTimesheet
// ---------------------------------------------------------------------------

export async function getOrCreateTimesheet(
  db: DbClient,
  organizationId: string,
  contractorId: string,
  weekStartDate: Date, // Must be a Monday
) {
  // Validate weekStartDate is a Monday
  const monday = getISOMonday(weekStartDate);
  if (monday.getTime() !== weekStartDate.getTime()) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'errors.timesheet.weekStartDateMustBeMonday',
    });
  }

  return db.timesheet.upsert({
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
    throw new TRPCError({ code: 'NOT_FOUND', message: 'errors.timesheet.entryNotFound' });
  }
  if (existing.source !== 'MANUAL') {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'errors.timesheet.cannotEditImportedEntries' });
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
      message: 'errors.timesheet.notFound',
    });
  }

  if (timesheet.status !== 'DRAFT' && timesheet.status !== 'REJECTED') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'errors.timesheet.canOnlyEditDraftOrRejected',
    });
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
      message: 'errors.timesheet.cannotSubmit',
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
) {
  // D-08: Standalone approval (one person)
  const updated = await db.timesheet.updateMany({
    where: {
      id: timesheetId,
      organizationId,
      status: 'SUBMITTED',
    },
    data: {
      status: 'APPROVED',
      reviewedAt: new Date(),
      reviewedByUserId: reviewerUserId,
    },
  });

  if (updated.count === 0) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'errors.timesheet.cannotApprove',
    });
  }

  return db.timesheet.findUniqueOrThrow({
    where: { id: timesheetId },
    include: { entries: true, contractor: true },
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
) {
  // D-07: Rejection includes reason
  const updated = await db.timesheet.updateMany({
    where: {
      id: timesheetId,
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

  if (updated.count === 0) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'errors.timesheet.cannotReject',
    });
  }

  return db.timesheet.findUniqueOrThrow({
    where: { id: timesheetId },
    include: { entries: true, contractor: true },
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
) {
  return db.timesheet.updateMany({
    where: {
      id: { in: timesheetIds },
      organizationId,
      status: 'SUBMITTED',
    },
    data: {
      status: 'APPROVED',
      reviewedAt: new Date(),
      reviewedByUserId: reviewerUserId,
    },
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
) {
  return db.timesheet.updateMany({
    where: {
      id: { in: timesheetIds },
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
}
