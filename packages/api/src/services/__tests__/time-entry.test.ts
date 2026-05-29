import type { PrismaClient } from '@contractor-ops/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  approveTimesheet,
  bulkApproveTimesheets,
  bulkRejectTimesheets,
  getOrCreateTimesheet,
  rejectTimesheet,
  saveDraftEntries,
  submitTimesheet,
} from '../time-entry';

// ---------------------------------------------------------------------------
// Mock Prisma factory
// ---------------------------------------------------------------------------

function createMockPrisma() {
  const mockTx = {
    timeEntry: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    timesheet: {
      update: vi.fn(),
    },
  };

  const prisma = {
    timesheet: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    timeEntry: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
  } as unknown as PrismaClient;

  return { prisma, mockTx };
}

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const ORG_ID = 'org-1';
const CONTRACTOR_ID = 'contractor-1';
const TIMESHEET_ID = 'ts-1';
const REVIEWER_ID = 'reviewer-1';

// Monday 2026-03-30
const MONDAY = new Date('2026-03-30T00:00:00.000Z');
// Tuesday 2026-03-31
const TUESDAY = new Date('2026-03-31T00:00:00.000Z');

const BASE_ENTRY = {
  contractId: 'contract-1',
  entryDate: '2026-03-30',
  minutes: 120,
  description: 'Did work',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('time-entry', () => {
  let prisma: PrismaClient;
  let mockTx: ReturnType<typeof createMockPrisma>['mockTx'];

  beforeEach(() => {
    vi.clearAllMocks();
    const mocks = createMockPrisma();
    prisma = mocks.prisma;
    mockTx = mocks.mockTx;
  });

  // -------------------------------------------------------------------------
  // getOrCreateTimesheet
  // -------------------------------------------------------------------------

  describe('getOrCreateTimesheet', () => {
    it('upserts with composite key, DRAFT status, totalMinutes 0, and no-op update', async () => {
      (prisma.timesheet.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TIMESHEET_ID,
        status: 'DRAFT',
        entries: [],
      });

      await getOrCreateTimesheet(prisma, ORG_ID, CONTRACTOR_ID, MONDAY);

      const upsertArg = (prisma.timesheet.upsert as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];

      // Composite key identifies the unique timesheet
      expect(upsertArg.where).toEqual({
        organizationId_contractorId_weekStartDate: {
          organizationId: ORG_ID,
          contractorId: CONTRACTOR_ID,
          weekStartDate: MONDAY,
        },
      });
      // New timesheets start as DRAFT with zero minutes
      expect(upsertArg.create.status).toBe('DRAFT');
      expect(upsertArg.create.totalMinutes).toBe(0);
      // update: {} ensures existing timesheets are returned without modification
      // This is critical: fetching an existing timesheet must NOT overwrite its status/data
      expect(upsertArg.update).toEqual({});
      // Entries are included for the caller to render
      expect(upsertArg.include).toEqual({ entries: true });
    });

    it('throws BAD_REQUEST when weekStartDate is not a Monday', async () => {
      await expect(
        getOrCreateTimesheet(prisma, ORG_ID, CONTRACTOR_ID, TUESDAY),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });

  // -------------------------------------------------------------------------
  // saveDraftEntries
  // -------------------------------------------------------------------------

  describe('saveDraftEntries', () => {
    it('creates new manual time entries with correct data shape', async () => {
      (prisma.timesheet.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TIMESHEET_ID,
        status: 'DRAFT',
      });

      const createdEntry = { id: 'entry-new', ...BASE_ENTRY, source: 'MANUAL' };
      mockTx.timeEntry.create.mockResolvedValue(createdEntry);
      mockTx.timeEntry.aggregate.mockResolvedValue({
        _sum: { minutes: 120 },
      });

      const result = await saveDraftEntries(prisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID, [
        BASE_ENTRY,
      ]);

      expect(result).toEqual([createdEntry]);
      expect(mockTx.timeEntry.create).toHaveBeenCalledWith({
        data: {
          organizationId: ORG_ID,
          timesheetId: TIMESHEET_ID,
          contractorId: CONTRACTOR_ID,
          contractId: 'contract-1',
          entryDate: new Date('2026-03-30'),
          minutes: 120,
          description: 'Did work',
          source: 'MANUAL',
        },
      });
    });

    it('converts entryDate string to Date object', async () => {
      (prisma.timesheet.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TIMESHEET_ID,
        status: 'DRAFT',
      });

      mockTx.timeEntry.create.mockResolvedValue({
        id: 'e1',
        ...BASE_ENTRY,
        source: 'MANUAL',
      });
      mockTx.timeEntry.aggregate.mockResolvedValue({
        _sum: { minutes: 120 },
      });

      await saveDraftEntries(prisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID, [
        { ...BASE_ENTRY, entryDate: '2026-04-01' },
      ]);

      const createCall = mockTx.timeEntry.create.mock.calls[0]?.[0];
      expect(createCall.data.entryDate).toBeInstanceOf(Date);
      expect(createCall.data.entryDate).toEqual(new Date('2026-04-01'));
    });

    it('converts undefined description to null', async () => {
      (prisma.timesheet.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TIMESHEET_ID,
        status: 'DRAFT',
      });

      mockTx.timeEntry.create.mockResolvedValue({
        id: 'e1',
        source: 'MANUAL',
      });
      mockTx.timeEntry.aggregate.mockResolvedValue({
        _sum: { minutes: 60 },
      });

      await saveDraftEntries(prisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID, [
        { contractId: 'c-1', entryDate: '2026-03-30', minutes: 60 },
      ]);

      const createCall = mockTx.timeEntry.create.mock.calls[0]?.[0];
      expect(createCall.data.description).toBeNull();
    });

    it('aggregate uses correct timesheetId filter', async () => {
      (prisma.timesheet.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TIMESHEET_ID,
        status: 'DRAFT',
      });

      mockTx.timeEntry.create.mockResolvedValue({
        id: 'e1',
        ...BASE_ENTRY,
        source: 'MANUAL',
      });
      mockTx.timeEntry.aggregate.mockResolvedValue({
        _sum: { minutes: 120 },
      });

      await saveDraftEntries(prisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID, [BASE_ENTRY]);

      expect(mockTx.timeEntry.aggregate).toHaveBeenCalledWith({
        where: { timesheetId: TIMESHEET_ID, organizationId: ORG_ID },
        _sum: { minutes: true },
      });
    });

    it('updates existing manual entries using where: { id } with all updatable fields', async () => {
      (prisma.timesheet.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TIMESHEET_ID,
        status: 'DRAFT',
      });

      const existingEntry = {
        id: 'entry-1',
        source: 'MANUAL',
        ...BASE_ENTRY,
      };
      mockTx.timeEntry.findFirst.mockResolvedValue(existingEntry);
      const updatedEntry = {
        ...existingEntry,
        minutes: 180,
        description: 'Updated work',
      };
      mockTx.timeEntry.update.mockResolvedValue(updatedEntry);
      mockTx.timeEntry.aggregate.mockResolvedValue({
        _sum: { minutes: 180 },
      });

      await saveDraftEntries(prisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID, [
        {
          ...BASE_ENTRY,
          id: 'entry-1',
          minutes: 180,
          description: 'Updated work',
        },
      ]);

      expect(mockTx.timeEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
        data: {
          contractId: 'contract-1',
          entryDate: new Date('2026-03-30'),
          minutes: 180,
          description: 'Updated work',
        },
      });
    });

    it('rejects edits when timesheet is SUBMITTED', async () => {
      (prisma.timesheet.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TIMESHEET_ID,
        status: 'SUBMITTED',
      });

      await expect(
        saveDraftEntries(prisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID, [BASE_ENTRY]),
      ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    });

    it('rejects edits when timesheet is APPROVED', async () => {
      (prisma.timesheet.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TIMESHEET_ID,
        status: 'APPROVED',
      });

      await expect(
        saveDraftEntries(prisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID, [BASE_ENTRY]),
      ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    });

    it('allows edits when timesheet is REJECTED', async () => {
      (prisma.timesheet.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TIMESHEET_ID,
        status: 'REJECTED',
      });

      const createdEntry = { id: 'entry-new', ...BASE_ENTRY, source: 'MANUAL' };
      mockTx.timeEntry.create.mockResolvedValue(createdEntry);
      mockTx.timeEntry.aggregate.mockResolvedValue({
        _sum: { minutes: 120 },
      });

      const result = await saveDraftEntries(prisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID, [
        BASE_ENTRY,
      ]);

      expect(result).toEqual([createdEntry]);
      expect(mockTx.timeEntry.create).toHaveBeenCalledOnce();
    });

    it('prevents editing imported entries (source !== MANUAL)', async () => {
      (prisma.timesheet.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TIMESHEET_ID,
        status: 'DRAFT',
      });

      mockTx.timeEntry.findFirst.mockResolvedValue({
        id: 'entry-imported',
        source: 'IMPORTED',
      });

      await expect(
        saveDraftEntries(prisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID, [
          { ...BASE_ENTRY, id: 'entry-imported' },
        ]),
      ).rejects.toMatchObject({
        code: 'PRECONDITION_FAILED',
        message: 'timesheetCannotEditImported',
      });
    });

    it('recalculates timesheet totalMinutes after save', async () => {
      (prisma.timesheet.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TIMESHEET_ID,
        status: 'DRAFT',
      });

      mockTx.timeEntry.create.mockResolvedValue({
        id: 'entry-1',
        ...BASE_ENTRY,
        source: 'MANUAL',
      });
      mockTx.timeEntry.aggregate.mockResolvedValue({
        _sum: { minutes: 360 },
      });

      await saveDraftEntries(prisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID, [BASE_ENTRY]);

      expect(mockTx.timesheet.update).toHaveBeenCalledWith({
        where: { id: TIMESHEET_ID },
        data: { totalMinutes: 360 },
      });
    });

    it('passes minutes value through to create without conversion', async () => {
      (prisma.timesheet.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TIMESHEET_ID,
        status: 'DRAFT',
      });

      mockTx.timeEntry.create.mockResolvedValue({
        id: 'entry-1',
        ...BASE_ENTRY,
        minutes: 90,
        source: 'MANUAL',
      });
      mockTx.timeEntry.aggregate.mockResolvedValue({
        _sum: { minutes: 90 },
      });

      await saveDraftEntries(prisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID, [
        { ...BASE_ENTRY, minutes: 90 },
      ]);

      // Verify the exact input value (90) is passed to Prisma without
      // any floating-point conversion (e.g., parseFloat, division, rounding)
      const createCall = mockTx.timeEntry.create.mock.calls[0]?.[0];
      expect(createCall.data.minutes).toBe(90);
    });

    it('throws NOT_FOUND when timesheet does not exist', async () => {
      (prisma.timesheet.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        saveDraftEntries(prisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID, [BASE_ENTRY]),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws NOT_FOUND when entry to update does not exist', async () => {
      (prisma.timesheet.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TIMESHEET_ID,
        status: 'DRAFT',
      });

      mockTx.timeEntry.findFirst.mockResolvedValue(null);

      await expect(
        saveDraftEntries(prisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID, [
          { ...BASE_ENTRY, id: 'nonexistent' },
        ]),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('defaults totalMinutes to 0 when aggregate sum is null', async () => {
      (prisma.timesheet.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TIMESHEET_ID,
        status: 'DRAFT',
      });

      mockTx.timeEntry.create.mockResolvedValue({
        id: 'e1',
        ...BASE_ENTRY,
        source: 'MANUAL',
      });
      mockTx.timeEntry.aggregate.mockResolvedValue({
        _sum: { minutes: null },
      });

      await saveDraftEntries(prisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID, [BASE_ENTRY]);

      expect(mockTx.timesheet.update).toHaveBeenCalledWith({
        where: { id: TIMESHEET_ID },
        data: { totalMinutes: 0 },
      });
    });
  });

  // -------------------------------------------------------------------------
  // submitTimesheet
  // -------------------------------------------------------------------------

  describe('submitTimesheet', () => {
    it('uses where clause with status in [DRAFT, REJECTED] and sets submittedAt + clears rejectionReason', async () => {
      (prisma.timesheet.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
      const submitted = { id: TIMESHEET_ID, status: 'SUBMITTED', entries: [] };
      (prisma.timesheet.findUniqueOrThrow as ReturnType<typeof vi.fn>).mockResolvedValue(submitted);

      const result = await submitTimesheet(prisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID);

      expect(result).toEqual(submitted);

      const call = (prisma.timesheet.updateMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];

      // Where clause allows both DRAFT and REJECTED
      expect(call.where).toEqual({
        id: TIMESHEET_ID,
        organizationId: ORG_ID,
        contractorId: CONTRACTOR_ID,
        status: { in: ['DRAFT', 'REJECTED'] },
      });

      // Data includes submittedAt as a Date and clears rejection
      expect(call.data.status).toBe('SUBMITTED');
      expect(call.data.submittedAt).toBeInstanceOf(Date);
      expect(call.data.rejectionReason).toBeNull();
    });

    it('rejects when updateMany matches 0 rows — WHERE restricts to DRAFT and REJECTED only', async () => {
      (prisma.timesheet.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

      await expect(
        submitTimesheet(prisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID),
      ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });

      // Verify the WHERE clause uses optimistic locking with status guard
      const whereClause = (prisma.timesheet.updateMany as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0].where;
      expect(whereClause.status).toEqual({ in: ['DRAFT', 'REJECTED'] });
      expect(whereClause.contractorId).toBe(CONTRACTOR_ID);
      expect(whereClause.organizationId).toBe(ORG_ID);
    });
  });

  // -------------------------------------------------------------------------
  // approveTimesheet
  // -------------------------------------------------------------------------

  describe('approveTimesheet', () => {
    it('transitions SUBMITTED timesheet to APPROVED', async () => {
      (prisma.timesheet.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
      const approved = {
        id: TIMESHEET_ID,
        status: 'APPROVED',
        entries: [],
        contractor: {},
      };
      (prisma.timesheet.findUniqueOrThrow as ReturnType<typeof vi.fn>).mockResolvedValue(approved);

      const result = await approveTimesheet(prisma, ORG_ID, TIMESHEET_ID, REVIEWER_ID);

      expect(result).toEqual(approved);
      expect(prisma.timesheet.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: TIMESHEET_ID,
            organizationId: ORG_ID,
            status: 'SUBMITTED',
          },
          data: expect.objectContaining({
            status: 'APPROVED',
            reviewedByUserId: REVIEWER_ID,
          }),
        }),
      );
    });

    it('rejects when updateMany matches 0 rows — WHERE restricts to SUBMITTED only', async () => {
      (prisma.timesheet.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

      await expect(
        approveTimesheet(prisma, ORG_ID, TIMESHEET_ID, REVIEWER_ID),
      ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });

      // Verify the WHERE clause only allows SUBMITTED timesheets
      const whereClause = (prisma.timesheet.updateMany as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0].where;
      expect(whereClause.status).toBe('SUBMITTED');
    });
  });

  // -------------------------------------------------------------------------
  // rejectTimesheet
  // -------------------------------------------------------------------------

  describe('rejectTimesheet', () => {
    it('transitions SUBMITTED timesheet to REJECTED with reason', async () => {
      (prisma.timesheet.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
      const rejected = {
        id: TIMESHEET_ID,
        status: 'REJECTED',
        entries: [],
        contractor: {},
      };
      (prisma.timesheet.findUniqueOrThrow as ReturnType<typeof vi.fn>).mockResolvedValue(rejected);

      const reason = 'Missing descriptions';
      const result = await rejectTimesheet(prisma, ORG_ID, TIMESHEET_ID, REVIEWER_ID, reason);

      expect(result).toEqual(rejected);
      expect(prisma.timesheet.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REJECTED',
            rejectionReason: reason,
            reviewedByUserId: REVIEWER_ID,
          }),
        }),
      );
    });

    it('rejects when updateMany matches 0 rows — WHERE restricts to SUBMITTED only', async () => {
      (prisma.timesheet.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

      await expect(
        rejectTimesheet(prisma, ORG_ID, TIMESHEET_ID, REVIEWER_ID, 'reason'),
      ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });

      // Verify the WHERE clause only allows SUBMITTED timesheets
      const whereClause = (prisma.timesheet.updateMany as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0].where;
      expect(whereClause.status).toBe('SUBMITTED');
    });
  });

  // -------------------------------------------------------------------------
  // bulkApproveTimesheets
  // -------------------------------------------------------------------------

  describe('bulkApproveTimesheets', () => {
    it('where clause includes status SUBMITTED and id in ids', async () => {
      const ids = ['ts-1', 'ts-2', 'ts-3'];
      (prisma.timesheet.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 3 });

      const result = await bulkApproveTimesheets(prisma, ORG_ID, ids, REVIEWER_ID);

      expect(result).toEqual({ count: 3 });
      expect(prisma.timesheet.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ids },
          organizationId: ORG_ID,
          status: 'SUBMITTED',
        },
        data: expect.objectContaining({
          status: 'APPROVED',
          reviewedByUserId: REVIEWER_ID,
        }),
      });
    });

    it('returns the database count directly — caller uses it to detect partial updates', async () => {
      const ids = ['ts-1', 'ts-2'];
      (prisma.timesheet.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

      const result = await bulkApproveTimesheets(prisma, ORG_ID, ids, REVIEWER_ID);

      // bulkApproveTimesheets returns the Prisma BatchPayload directly.
      // The WHERE clause (verified in the test above) ensures only SUBMITTED
      // timesheets are updated, so count < ids.length signals partial update.
      // Verify the function returns the raw Prisma result without transformation.
      expect(result).toEqual({ count: 1 });
      expect(result.count).toBeLessThan(ids.length);
    });
  });

  // -------------------------------------------------------------------------
  // bulkRejectTimesheets
  // -------------------------------------------------------------------------

  describe('bulkRejectTimesheets', () => {
    it('where clause includes status SUBMITTED and id in ids', async () => {
      const ids = ['ts-1', 'ts-2'];
      const reason = 'Incomplete entries';
      (prisma.timesheet.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });

      const result = await bulkRejectTimesheets(prisma, ORG_ID, ids, REVIEWER_ID, reason);

      expect(result).toEqual({ count: 2 });
      expect(prisma.timesheet.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ids },
          organizationId: ORG_ID,
          status: 'SUBMITTED',
        },
        data: expect.objectContaining({
          status: 'REJECTED',
          rejectionReason: reason,
          reviewedByUserId: REVIEWER_ID,
        }),
      });
    });
  });
});
