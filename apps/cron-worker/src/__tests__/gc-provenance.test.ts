/**
 * IdpChangeProvenance GC sub-task in the reminders cron handler.
 *
 * Verifies the GC runs once per tick, logs a structured entry, and is isolated:
 * a GC failure must NOT abort the handler or the other sub-tasks.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockTransaction,
  mockTryAcquireLock,
  mockReminderRuleFindMany,
  mockWorkflowTaskRunFindMany,
  mockStatusfestFindMany,
  mockGcExpiredProvenance,
  mockCaptureException,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockTryAcquireLock: vi.fn(),
  mockReminderRuleFindMany: vi.fn(),
  mockWorkflowTaskRunFindMany: vi.fn(),
  mockStatusfestFindMany: vi.fn(),
  mockGcExpiredProvenance: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('@contractor-ops/api/lib/advisory-lock', () => ({
  tryAcquireXactLock: mockTryAcquireLock,
}));

vi.mock('@contractor-ops/api/services/notification-service', () => ({ dispatch: vi.fn() }));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    reminderRule: { findMany: mockReminderRuleFindMany },
    workflowTaskRun: { findMany: mockWorkflowTaskRunFindMany },
  },
  prismaRaw: {
    $transaction: mockTransaction,
    statusfeststellungsverfahren: { findMany: mockStatusfestFindMany },
    idpChangeProvenance: { deleteMany: vi.fn() },
  },
}));

vi.mock('@contractor-ops/idp-saga', () => ({
  gcExpiredProvenance: mockGcExpiredProvenance,
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: vi.fn(), increment: vi.fn() },
}));

vi.mock('../lib/sentry.js', () => ({
  Sentry: { captureException: mockCaptureException, captureMessage: vi.fn() },
}));

import { remindersHandler } from '../jobs/handlers/reminders/index.js';
import { makeJobContext } from './_helpers.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb({}));
  mockTryAcquireLock.mockResolvedValue(true);
  mockReminderRuleFindMany.mockResolvedValue([]);
  mockWorkflowTaskRunFindMany.mockResolvedValue([]);
  mockStatusfestFindMany.mockResolvedValue([]);
  mockGcExpiredProvenance.mockResolvedValue({ deleted: 0 });
});

describe('Reminders cron — IdpChangeProvenance GC sub-task (Phase 76 D-12)', () => {
  it('reminders handler calls gcExpiredProvenance once per invocation', async () => {
    await remindersHandler(makeJobContext());
    expect(mockGcExpiredProvenance).toHaveBeenCalledTimes(1);
  });

  it('logs the structured GC entry with deleted count + sub_task', async () => {
    mockGcExpiredProvenance.mockResolvedValue({ deleted: 7 });
    const info = vi.fn();
    await remindersHandler(makeJobContext({ log: { info, error: vi.fn() } as never }));
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ deleted: 7, sub_task: 'idp_provenance_gc' }),
      expect.any(String),
    );
  });

  it('GC failure does not abort the handler or other sub-tasks (isolated try/catch)', async () => {
    mockGcExpiredProvenance.mockRejectedValue(new Error('DB connection lost'));
    const result = await remindersHandler(makeJobContext());
    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ idpProvenanceGced: 0 });
    // Reminder + overdue sub-tasks still ran (their finders were invoked).
    expect(mockReminderRuleFindMany).toHaveBeenCalled();
  });
});
