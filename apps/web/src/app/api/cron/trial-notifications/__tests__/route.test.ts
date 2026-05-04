/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// F-ASYNC-07 — the trial-notifications cron now wraps its work in
// `prismaRaw.$transaction` guarded by a `pg_try_advisory_xact_lock`. Per-org
// dedup also flows through `prisma.notificationCronDedup.create` (with a
// P2002 unique-violation short-circuit). The tests below mock the raw
// transaction as a pass-through and drive both the lock-acquired and
// lock-skipped paths.

const {
  mockSubscriptionFindMany,
  mockDispatch,
  mockSendAppEmail,
  mockNotificationCronDedupCreate,
  mockTxQueryRawUnsafe,
  mockTransaction,
} = vi.hoisted(() => ({
  mockSubscriptionFindMany: vi.fn(),
  mockDispatch: vi.fn(),
  mockSendAppEmail: vi.fn(),
  mockNotificationCronDedupCreate: vi.fn(),
  mockTxQueryRawUnsafe: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    subscription: {
      findMany: mockSubscriptionFindMany,
    },
    notificationCronDedup: {
      create: mockNotificationCronDedupCreate,
    },
  },
  prismaRaw: {
    $transaction: mockTransaction,
  },
}));

vi.mock('@contractor-ops/api/services/notification-service', () => ({
  dispatch: mockDispatch,
}));

vi.mock('@contractor-ops/api/services/app-email', () => ({
  sendAppEmail: mockSendAppEmail,
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

function installTransactionPassThrough(acquired = true) {
  mockTxQueryRawUnsafe.mockResolvedValue([{ acquired }]);
  mockTransaction.mockImplementation(
    async <T,>(fn: (tx: { $queryRawUnsafe: typeof mockTxQueryRawUnsafe }) => Promise<T>) => {
      return fn({ $queryRawUnsafe: mockTxQueryRawUnsafe });
    },
  );
}

describe('GET /api/cron/trial-notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscriptionFindMany.mockResolvedValue([]);
    mockDispatch.mockResolvedValue(undefined);
    mockSendAppEmail.mockResolvedValue(undefined);
    mockNotificationCronDedupCreate.mockResolvedValue({});
    installTransactionPassThrough(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 401 when unauthorized', async () => {
    process.env.CRON_SECRET = 'trial-notifications-16ch';
    const req = new NextRequest('http://localhost/api/cron/trial-notifications', {
      headers: { authorization: 'Bearer x' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with counts when authorized and no trialing subs', async () => {
    process.env.CRON_SECRET = 'trial-notifications-16ch';
    const req = new NextRequest('http://localhost/api/cron/trial-notifications', {
      headers: { authorization: 'Bearer trial-notifications-16ch' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      processed: number;
      notificationsSent: number;
      skippedDedup: number;
      skippedLocked: boolean;
    };
    expect(json).toEqual({
      processed: 0,
      notificationsSent: 0,
      skippedDedup: 0,
      skippedLocked: false,
    });
    expect(mockSubscriptionFindMany).toHaveBeenCalled();
    // Advisory lock query must be issued exactly once per tick.
    expect(mockTxQueryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('pg_try_advisory_xact_lock'),
      'cron:trial-notifications',
    );
  });

  it('skips the fan-out when another tick already holds the advisory lock', async () => {
    installTransactionPassThrough(false);

    process.env.CRON_SECRET = 'trial-notifications-16ch';
    const req = new NextRequest('http://localhost/api/cron/trial-notifications', {
      headers: { authorization: 'Bearer trial-notifications-16ch' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      processed: number;
      skippedLocked: boolean;
    };
    expect(json.skippedLocked).toBe(true);
    expect(json.processed).toBe(0);
    // When the lock isn't acquired, we MUST NOT iterate trialing subscriptions.
    expect(mockSubscriptionFindMany).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('dispatches notification + email for a 7-day-out trial and writes a dedup row', async () => {
    vi.useFakeTimers({ now: new Date('2026-06-15T12:00:00.000Z') });
    const trialEnd = new Date('2026-06-22T12:00:00.000Z'); // 7 days out

    mockSubscriptionFindMany.mockResolvedValue([
      {
        id: 'sub-1',
        status: 'TRIALING',
        trialEnd,
        organization: {
          id: 'org-1',
          billingEmail: 'finance@example.com',
          members: [{ userId: 'user-admin-1' }],
        },
      },
    ]);

    process.env.CRON_SECRET = 'trial-notifications-16ch';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';

    const req = new NextRequest('http://localhost/api/cron/trial-notifications', {
      headers: { authorization: 'Bearer trial-notifications-16ch' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      processed: number;
      notificationsSent: number;
      skippedDedup: number;
    };
    expect(json.processed).toBe(1);
    expect(json.notificationsSent).toBe(1);
    expect(json.skippedDedup).toBe(0);

    expect(mockNotificationCronDedupCreate).toHaveBeenCalledWith({
      data: { dedupeKey: 'trial-end:org-1:7:2026-06-15' },
    });
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        type: 'TRIAL_ENDING',
        recipientUserIds: ['user-admin-1'],
      }),
    );
    expect(mockSendAppEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'finance@example.com',
        subject: expect.stringContaining('7 days'),
      }),
    );
  });

  it('treats a P2002 unique-violation on dedup as a short-circuit (skippedDedup increments)', async () => {
    vi.useFakeTimers({ now: new Date('2026-06-15T12:00:00.000Z') });
    const trialEnd = new Date('2026-06-22T12:00:00.000Z'); // 7 days out

    mockSubscriptionFindMany.mockResolvedValue([
      {
        id: 'sub-1',
        status: 'TRIALING',
        trialEnd,
        organization: {
          id: 'org-1',
          billingEmail: null,
          members: [{ userId: 'user-admin-1' }],
        },
      },
    ]);

    const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    mockNotificationCronDedupCreate.mockRejectedValueOnce(p2002);

    process.env.CRON_SECRET = 'trial-notifications-16ch';
    const req = new NextRequest('http://localhost/api/cron/trial-notifications', {
      headers: { authorization: 'Bearer trial-notifications-16ch' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      processed: number;
      notificationsSent: number;
      skippedDedup: number;
    };
    expect(json.processed).toBe(1);
    expect(json.notificationsSent).toBe(0);
    expect(json.skippedDedup).toBe(1);
    // Duplicate tick must not fan out to dispatch / email.
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockSendAppEmail).not.toHaveBeenCalled();
  });
});
