/**
 * Unit tests for the `reminders` cron handler.
 *
 * The handler fans out three sub-jobs inside one advisory-locked tx:
 * `evaluateReminderRules`, `detectOverdueTasks`, `detectDrvClearanceExpiries`.
 *
 * Coverage:
 *   1. Advisory lock not acquired → ok=true + skipped.
 *   2. Lock acquired, nothing pending → ok=true + all counters 0.
 *   3. Transaction throws → ok=false + Sentry capture.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockTransaction,
  mockTryAcquireLock,
  mockReminderRuleFindMany,
  mockWorkflowTaskRunFindMany,
  mockStatusfestFindMany,
  mockDispatch,
  mockResolveRbacRecipients,
  mockCaptureException,
  mockComplianceReminderScan,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockTryAcquireLock: vi.fn(),
  mockReminderRuleFindMany: vi.fn(),
  mockWorkflowTaskRunFindMany: vi.fn(),
  mockStatusfestFindMany: vi.fn(),
  mockDispatch: vi.fn(),
  mockResolveRbacRecipients: vi.fn(),
  mockCaptureException: vi.fn(),
  mockComplianceReminderScan: vi.fn(),
}));

vi.mock('@contractor-ops/api/lib/advisory-lock', () => ({
  tryAcquireXactLock: mockTryAcquireLock,
}));

vi.mock('@contractor-ops/api/services/notification-service', () => ({
  dispatch: mockDispatch,
}));

vi.mock('@contractor-ops/api/services/compliance-reminder-scan', () => ({
  runComplianceReminderScan: mockComplianceReminderScan,
}));

vi.mock('@contractor-ops/api/services/rbac-recipients', () => ({
  resolveRbacRecipients: mockResolveRbacRecipients,
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    reminderRule: { findMany: mockReminderRuleFindMany },
    workflowTaskRun: { findMany: mockWorkflowTaskRunFindMany },
  },
  prismaRaw: {
    $transaction: mockTransaction,
    statusfeststellungsverfahren: { findMany: mockStatusfestFindMany },
  },
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
  mockComplianceReminderScan.mockResolvedValue({ scanned: 0, fires: 0, digests: 0 });
});

describe('remindersHandler', () => {
  it('skips with ok=true when the advisory lock is not acquired', async () => {
    mockTryAcquireLock.mockResolvedValue(false);

    const result = await remindersHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ skipped: true });
    expect(mockReminderRuleFindMany).not.toHaveBeenCalled();
  });

  it('returns ok=true with zero counters when nothing is pending', async () => {
    const result = await remindersHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({
      skipped: false,
      processed: 0,
      sent: 0,
      overdueTasksNotified: 0,
      drvExpiriesNotified: 0,
      complianceReminderFires: 0,
      complianceReminderDigests: 0,
    });
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('runs the compliance reminder scan and surfaces its fires/digests counts', async () => {
    mockComplianceReminderScan.mockResolvedValue({ scanned: 5, fires: 2, digests: 1 });

    const result = await remindersHandler(makeJobContext());

    expect(mockComplianceReminderScan).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({
      complianceReminderFires: 2,
      complianceReminderDigests: 1,
    });
  });

  it('returns ok=false and reports to Sentry when the transaction throws', async () => {
    mockTransaction.mockRejectedValue(new Error('lock wait timeout'));

    const result = await remindersHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ error: 'lock wait timeout' });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
