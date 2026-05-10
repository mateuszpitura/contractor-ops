/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// F-ASYNC-06 — the cron now runs everything inside a `prismaRaw.$transaction`
// guarded by a Postgres advisory lock (`pg_try_advisory_xact_lock`). The
// transaction is awaited and the dispatch fan-out only fires when the lock
// is acquired. These tests mock the raw transaction wrapper to a pass-through
// that returns whatever the inner callback returns, while the inner
// `tx.$queryRawUnsafe` returns `acquired: true` so the rule walk runs.

const {
  mockReminderFindMany,
  mockWorkflowTaskFindMany,
  mockNotificationFindFirst,
  mockContractFindMany,
  mockReminderInstanceFindFirst,
  mockReminderInstanceCreate,
  mockReminderInstanceUpdateMany,
  mockDispatch,
  mockTxQueryRawUnsafe,
  mockTransaction,
} = vi.hoisted(() => ({
  mockReminderFindMany: vi.fn(),
  mockWorkflowTaskFindMany: vi.fn(),
  mockNotificationFindFirst: vi.fn(),
  mockContractFindMany: vi.fn(),
  mockReminderInstanceFindFirst: vi.fn(),
  mockReminderInstanceCreate: vi.fn(),
  mockReminderInstanceUpdateMany: vi.fn(),
  mockDispatch: vi.fn(),
  mockTxQueryRawUnsafe: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    reminderRule: {
      findMany: mockReminderFindMany,
    },
    contract: {
      findMany: mockContractFindMany,
    },
    invoice: { findMany: vi.fn().mockResolvedValue([]) },
    reminderInstance: {
      findFirst: mockReminderInstanceFindFirst,
      create: mockReminderInstanceCreate,
      updateMany: mockReminderInstanceUpdateMany,
    },
    workflowTaskRun: {
      findMany: mockWorkflowTaskFindMany,
    },
    notification: {
      findFirst: mockNotificationFindFirst,
    },
    member: { findMany: vi.fn().mockResolvedValue([]) },
    notificationCronDedup: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
  prismaRaw: {
    $transaction: mockTransaction,
    statusfeststellungsverfahren: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('@contractor-ops/api/services/rbac-recipients', () => ({
  resolveRbacRecipients: vi.fn().mockResolvedValue([]),
}));

vi.mock('@contractor-ops/api/services/notification-service', () => ({
  dispatch: mockDispatch,
}));

vi.mock('@sentry/nextjs', () => ({
  withMonitor: vi.fn((_name: string, fn: () => Promise<Response>) => fn()),
  captureException: vi.fn(),
}));

vi.mock('@contractor-ops/api/services/cron-monitor', () => ({
  withCronMonitor: vi.fn((_name: string, fn: () => Promise<Response>) => fn()),
}));

vi.mock('@contractor-ops/logger', () => ({
  createCronLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: vi.fn(), increment: vi.fn() },
}));

import { GET } from '../route';

/**
 * The shape `prismaRaw.$transaction(fn)` uses: invoke `fn(tx)` and return
 * whatever it resolves to. The `tx` proxy here only needs to expose the
 * advisory-lock query path the route hits — `$queryRawUnsafe`. Configure the
 * default to return `acquired: true` so the cron walks the rule set.
 */
function installTransactionPassThrough(acquired = true) {
  mockTxQueryRawUnsafe.mockResolvedValue([{ acquired }]);
  mockTransaction.mockImplementation(
    async <T>(fn: (tx: { $queryRawUnsafe: typeof mockTxQueryRawUnsafe }) => Promise<T>) => {
      return fn({ $queryRawUnsafe: mockTxQueryRawUnsafe });
    },
  );
}

describe('GET /api/cron/reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReminderFindMany.mockResolvedValue([]);
    mockWorkflowTaskFindMany.mockResolvedValue([]);
    mockNotificationFindFirst.mockResolvedValue(null);
    mockContractFindMany.mockResolvedValue([]);
    mockReminderInstanceFindFirst.mockResolvedValue(null);
    mockReminderInstanceCreate.mockResolvedValue({});
    mockReminderInstanceUpdateMany.mockResolvedValue({ count: 1 });
    mockDispatch.mockResolvedValue(undefined);
    installTransactionPassThrough(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 401 when CRON_SECRET is set but Authorization is wrong', async () => {
    process.env.CRON_SECRET = 'reminders-secret-16chars';
    const req = new NextRequest('http://localhost/api/cron/reminders', {
      headers: { authorization: 'Bearer wrong' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET;
    const req = new NextRequest('http://localhost/api/cron/reminders');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty payload when Bearer token matches CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'reminders-secret-16chars';
    const req = new NextRequest('http://localhost/api/cron/reminders', {
      headers: { authorization: 'Bearer reminders-secret-16chars' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      processed: number;
      sent: number;
      overdueTasksNotified: number;
      drvExpiriesNotified: number;
      skipped: boolean;
    };
    expect(json).toMatchObject({
      processed: 0,
      sent: 0,
      overdueTasksNotified: 0,
      drvExpiriesNotified: 0,
      skipped: false,
    });
    // Advisory lock query must be issued exactly once per tick.
    // Two-arg form: class_id=1 ('cron' namespace) + key 'reminders'.
    // See packages/api/src/lib/advisory-lock.ts.
    expect(mockTxQueryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('pg_try_advisory_xact_lock'),
      1,
      'reminders',
    );
  });

  it('skips dispatch when another tick already holds the advisory lock', async () => {
    installTransactionPassThrough(false);

    process.env.CRON_SECRET = 'reminders-secret-16chars';
    const req = new NextRequest('http://localhost/api/cron/reminders', {
      headers: { authorization: 'Bearer reminders-secret-16chars' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      processed: number;
      sent: number;
      skipped: boolean;
    };
    expect(json.skipped).toBe(true);
    expect(json.processed).toBe(0);
    expect(json.sent).toBe(0);
    // When the lock isn't acquired, the rule walk MUST NOT run.
    expect(mockReminderFindMany).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('evaluates BEFORE_CONTRACT_END rule: creates instance, dispatches, marks SENT', async () => {
    vi.useFakeTimers({ now: new Date('2026-06-15T12:00:00.000Z') });

    mockReminderFindMany.mockResolvedValue([
      {
        id: 'rule-contract-1',
        active: true,
        organizationId: 'org-1',
        offsetDays: 7,
        triggerType: 'BEFORE_CONTRACT_END',
        entityType: 'CONTRACT',
        recipientMode: 'SPECIFIC_USER',
        configJson: { userId: 'user-notify-1' },
      },
    ]);

    mockContractFindMany.mockResolvedValue([
      {
        id: 'contract-1',
        title: 'MSA 2026',
        contractorId: 'contractor-1',
        organizationId: 'org-1',
        endDate: new Date('2026-06-20T00:00:00.000Z'),
      },
    ]);

    process.env.CRON_SECRET = 'reminders-secret-16chars';
    const req = new NextRequest('http://localhost/api/cron/reminders', {
      headers: { authorization: 'Bearer reminders-secret-16chars' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      processed: number;
      sent: number;
    };
    expect(json.processed).toBe(1);
    expect(json.sent).toBe(1);

    expect(mockReminderInstanceCreate).toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        type: 'CONTRACT_EXPIRING',
        recipientUserIds: ['user-notify-1'],
        entityId: 'contract-1',
      }),
    );
    expect(mockReminderInstanceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SENT' }),
      }),
    );
  });

  it('skips dispatch when reminder instance already exists (dedup)', async () => {
    vi.useFakeTimers({ now: new Date('2026-06-15T12:00:00.000Z') });

    mockReminderFindMany.mockResolvedValue([
      {
        id: 'rule-dedup',
        active: true,
        organizationId: 'org-1',
        offsetDays: 7,
        triggerType: 'BEFORE_CONTRACT_END',
        entityType: 'CONTRACT',
        recipientMode: 'SPECIFIC_USER',
        configJson: { userId: 'user-notify-1' },
      },
    ]);

    mockContractFindMany.mockResolvedValue([
      {
        id: 'contract-dedup',
        title: 'C',
        contractorId: 'c1',
        organizationId: 'org-1',
        endDate: new Date('2026-06-18T00:00:00.000Z'),
      },
    ]);

    mockReminderInstanceFindFirst.mockResolvedValue({ id: 'existing-instance' });

    process.env.CRON_SECRET = 'reminders-secret-16chars';
    const res = await GET(
      new NextRequest('http://localhost/api/cron/reminders', {
        headers: { authorization: 'Bearer reminders-secret-16chars' },
      }),
    );
    const json = (await res.json()) as { processed: number; sent: number };
    expect(json.processed).toBe(1);
    expect(json.sent).toBe(0);
    expect(mockReminderInstanceCreate).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
