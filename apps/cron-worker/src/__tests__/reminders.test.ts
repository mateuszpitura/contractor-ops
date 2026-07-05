/**
 * Unit tests for the `reminders` cron handler.
 *
 * The handler fans out its sub-jobs inside one advisory-locked tx, running
 * every DB read/write on the lock-holding `tx` connection:
 * `evaluateReminderRules`, `detectOverdueTasks`, `detectDrvClearanceExpiries`.
 *
 * Coverage:
 *   1. Advisory lock not acquired → ok=true + skipped.
 *   2. Lock acquired, nothing pending → ok=true + all counters 0.
 *   3. Transaction throws → ok=false + Sentry capture.
 *   4. A dispatch failure leaves the row PENDING → the next tick re-sends.
 *   5. A poison rule is isolated → sibling rules still process.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockTransaction,
  mockTryAcquireLock,
  mockDispatch,
  mockResolveRbacRecipients,
  mockCaptureException,
  mockComplianceReminderScan,
  tx,
} = vi.hoisted(() => {
  const tx = {
    reminderRule: { findMany: vi.fn() },
    contract: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() },
    member: { findMany: vi.fn() },
    workflowTaskRun: { findMany: vi.fn() },
    statusfeststellungsverfahren: { findMany: vi.fn() },
    approvalStep: { findMany: vi.fn(), findFirst: vi.fn() },
    notification: { findFirst: vi.fn(), count: vi.fn() },
    reminderInstance: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  };
  return {
    mockTransaction: vi.fn(),
    mockTryAcquireLock: vi.fn(),
    mockDispatch: vi.fn(),
    mockResolveRbacRecipients: vi.fn(),
    mockCaptureException: vi.fn(),
    mockComplianceReminderScan: vi.fn(),
    tx,
  };
});

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
  prismaRaw: {
    $transaction: mockTransaction,
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
  mockTransaction.mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx));
  mockTryAcquireLock.mockResolvedValue(true);
  mockComplianceReminderScan.mockResolvedValue({ scanned: 0, fires: 0, digests: 0 });
  mockDispatch.mockResolvedValue(undefined);

  tx.reminderRule.findMany.mockResolvedValue([]);
  tx.contract.findMany.mockResolvedValue([]);
  tx.invoice.findMany.mockResolvedValue([]);
  tx.member.findMany.mockResolvedValue([]);
  tx.workflowTaskRun.findMany.mockResolvedValue([]);
  tx.statusfeststellungsverfahren.findMany.mockResolvedValue([]);
  tx.approvalStep.findMany.mockResolvedValue([]);
  tx.approvalStep.findFirst.mockResolvedValue(null);
  tx.notification.findFirst.mockResolvedValue(null);
  tx.notification.count.mockResolvedValue(0);
  tx.reminderInstance.findFirst.mockResolvedValue(null);
  tx.reminderInstance.create.mockResolvedValue({});
  tx.reminderInstance.updateMany.mockResolvedValue({ count: 1 });
});

describe('remindersHandler', () => {
  it('skips with ok=true when the advisory lock is not acquired', async () => {
    mockTryAcquireLock.mockResolvedValue(false);

    const result = await remindersHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ skipped: true });
    expect(tx.reminderRule.findMany).not.toHaveBeenCalled();
  });

  it('returns ok=true with zero counters when nothing is pending', async () => {
    const result = await remindersHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({
      skipped: false,
      processed: 0,
      sent: 0,
      ruleErrors: 0,
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

  it('re-dispatches a stuck PENDING reminder on the next tick after a dispatch failure', async () => {
    tx.reminderRule.findMany.mockResolvedValue([
      {
        id: 'rule1',
        organizationId: 'org1',
        recipientMode: 'ENTITY_OWNER',
        configJson: null,
        triggerType: 'BEFORE_CONTRACT_END',
        entityType: 'CONTRACT',
        offsetDays: 7,
        active: true,
      },
    ]);
    tx.contract.findMany.mockResolvedValue([
      { id: 'c1', title: 'Contract A', contractorId: 'user1', organizationId: 'org1' },
    ]);

    // Tick 1: no existing instance, dispatch throws → the row is left PENDING
    // (never marked SENT) and the per-rule catch keeps the run green.
    tx.reminderInstance.findFirst.mockResolvedValueOnce(null);
    mockDispatch.mockRejectedValueOnce(new Error('email provider down'));

    const first = await remindersHandler(makeJobContext());

    expect(first.ok).toBe(true);
    expect(first.details).toMatchObject({ ruleErrors: 1, sent: 0 });
    expect(tx.reminderInstance.create).toHaveBeenCalledTimes(1);
    expect(tx.reminderInstance.updateMany).not.toHaveBeenCalled();

    // Tick 2: the PENDING row is found → re-dispatch (no re-create) and mark SENT.
    tx.reminderInstance.findFirst.mockResolvedValueOnce({ id: 'ri1', status: 'PENDING' });

    const second = await remindersHandler(makeJobContext());

    expect(second.ok).toBe(true);
    expect(second.details).toMatchObject({ sent: 1 });
    expect(tx.reminderInstance.create).toHaveBeenCalledTimes(1); // not re-created
    expect(tx.reminderInstance.updateMany).toHaveBeenCalledTimes(1); // marked SENT
    expect(mockDispatch).toHaveBeenCalledTimes(2); // dispatched on both ticks
  });

  it('isolates a poison rule so sibling rules still process', async () => {
    tx.reminderRule.findMany.mockResolvedValue([
      {
        id: 'poison',
        organizationId: 'org1',
        recipientMode: 'ENTITY_OWNER',
        configJson: null,
        triggerType: 'BEFORE_CONTRACT_END',
        entityType: 'CONTRACT',
        offsetDays: 7,
        active: true,
      },
      {
        id: 'healthy',
        organizationId: 'org2',
        recipientMode: 'ENTITY_OWNER',
        configJson: null,
        triggerType: 'BEFORE_CONTRACT_END',
        entityType: 'CONTRACT',
        offsetDays: 7,
        active: true,
      },
    ]);
    tx.contract.findMany
      .mockRejectedValueOnce(new Error('bad rule query'))
      .mockResolvedValueOnce([
        { id: 'c2', title: 'Contract B', contractorId: 'user2', organizationId: 'org2' },
      ]);

    const result = await remindersHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ processed: 2, sent: 1, ruleErrors: 1 });
    // The healthy rule still dispatched despite the poison rule throwing.
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });
});
