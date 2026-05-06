import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockExecuteRawUnsafe, mockQueryRawUnsafe, mockTransaction, mockDispatchNotification } =
  vi.hoisted(() => ({
    mockExecuteRawUnsafe: vi.fn(),
    mockQueryRawUnsafe: vi.fn(),
    mockTransaction: vi.fn(),
    mockDispatchNotification: vi.fn(),
  }));

vi.mock('@contractor-ops/logger', () => {
  const stub = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  };
  return {
    runWithRequestContext: vi.fn((_c, fn) => fn()),
    getRequestId: vi.fn(() => undefined),
    getTraceparent: vi.fn(() => undefined),
    buildContextFromHeaders: vi.fn(() => ({})),
    getOutboundHeaders: vi.fn(() => ({})),
    generateRequestId: vi.fn(() => 'test-request-id'),
    withBodyLogging: vi.fn((_o, fn) => fn),
    logIntegrationCall: vi.fn(),
    subscribeOpossumEvents: vi.fn(),
    LOG_BODY_INCLUDE_PREFIXES: [],
    PII_MASK_KEYWORDS: [],
    PII_MASK_PATHS: [],

    createLogger: vi.fn(() => stub),
    createTrpcLogger: vi.fn(() => stub),
    createCronLogger: vi.fn(() => stub),
    createWebhookLogger: vi.fn(() => stub),
    createIntegrationLogger: vi.fn(() => stub),
  };
});

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prismaRaw: {
    // The drain refactor (NEW-ARCH-02 / NEW-ARCH-03) splits work across
    // a claim transaction (uses $transaction) plus per-row finalize
    // updates (direct $executeRawUnsafe on the raw client, NO outer tx).
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
    $executeRawUnsafe: (...args: unknown[]) => mockExecuteRawUnsafe(...args),
  },
}));

vi.mock('@sentry/nextjs', () => ({
  getCurrentScope: vi.fn(() => ({
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setContext: vi.fn(),
    setExtra: vi.fn(),
    clear: vi.fn(),
  })),
  setUser: vi.fn(),
  setTag: vi.fn(),
  setTags: vi.fn(),
  setContext: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('../../notification-service.js', () => ({
  dispatch: (...args: unknown[]) => mockDispatchNotification(...args),
}));

import {
  computeBackoffMs,
  drainOutboxBatch,
  enqueueOutboxEvent,
  MAX_OUTBOX_ATTEMPTS,
} from '../index.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockExecuteRawUnsafe.mockResolvedValue(1);
  mockQueryRawUnsafe.mockResolvedValue([]);
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      $executeRawUnsafe: mockExecuteRawUnsafe,
      $queryRawUnsafe: mockQueryRawUnsafe,
    }),
  );
  mockDispatchNotification.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// enqueueOutboxEvent
// ---------------------------------------------------------------------------

describe('enqueueOutboxEvent', () => {
  it('inserts a PENDING row inside the supplied tx and returns the new id', async () => {
    const id = await enqueueOutboxEvent({
      tx: {
        $executeRaw: vi.fn().mockResolvedValue(1),
        $executeRawUnsafe: mockExecuteRawUnsafe,
      },
      organizationId: 'org_1',
      eventType: 'notification.dispatch',
      payload: {
        organizationId: 'org_1',
        type: 'INVOICE_RECEIVED',
        recipientUserIds: ['u1'],
        title: 't',
        body: 'b',
        entityType: 'INVOICE',
        entityId: 'inv_1',
      },
    });

    expect(id).toBeTruthy();
    expect(id).toMatch(/^oxe_/);
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(1);
    const [sql, idArg, orgArg, eventTypeArg] = mockExecuteRawUnsafe.mock.calls[0] ?? [];
    expect(sql).toMatch(/INSERT INTO "OutboxEvent"/);
    expect(sql).toMatch(/ON CONFLICT \("organizationId", "dedupKey"\) DO NOTHING/);
    expect(idArg).toBe(id);
    expect(orgArg).toBe('org_1');
    expect(eventTypeArg).toBe('notification.dispatch');
  });

  it('returns null when ON CONFLICT swallowed the insert (dedupKey collision)', async () => {
    mockExecuteRawUnsafe.mockResolvedValueOnce(0);

    const id = await enqueueOutboxEvent({
      tx: {
        $executeRaw: vi.fn(),
        $executeRawUnsafe: mockExecuteRawUnsafe,
      },
      organizationId: 'org_1',
      eventType: 'notification.dispatch',
      payload: {
        organizationId: 'org_1',
        type: 'INVOICE_RECEIVED',
        recipientUserIds: ['u1'],
        title: 't',
        body: 'b',
        entityType: 'INVOICE',
        entityId: 'inv_1',
      },
      dedupKey: 'u1:INVOICE_RECEIVED:inv_1:2026-05-03',
    });

    expect(id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// drainOutboxBatch
// ---------------------------------------------------------------------------

describe('drainOutboxBatch', () => {
  it('returns zeroes when no PENDING rows are eligible', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([]);

    const result = await drainOutboxBatch();

    expect(result).toEqual({
      scanned: 0,
      dispatched: 0,
      failed: 0,
      retried: 0,
      exhausted: 0,
    });
  });

  it('locks rows FOR UPDATE SKIP LOCKED', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([]);

    await drainOutboxBatch();

    const sql = mockQueryRawUnsafe.mock.calls[0]?.[0] as string;
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/);
    expect(sql).toMatch(/WHERE "status" = 'PENDING' AND "nextAttemptAt" <= NOW\(\)/);
  });

  it('dispatches a PENDING row and marks DISPATCHED on success', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([
      {
        id: 'oxe_1',
        organizationId: 'org_1',
        eventType: 'notification.dispatch',
        payloadJson: {
          organizationId: 'org_1',
          type: 'INVOICE_RECEIVED',
          recipientUserIds: ['u1'],
          title: 't',
          body: 'b',
          entityType: 'INVOICE',
          entityId: 'inv_1',
        },
        attempts: 0,
      },
    ]);

    const result = await drainOutboxBatch();

    expect(result.dispatched).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockDispatchNotification).toHaveBeenCalledOnce();
    // The DISPATCHED update should be issued.
    const updateCall = mockExecuteRawUnsafe.mock.calls.find(call =>
      String(call[0]).includes('SET "status" = \'DISPATCHED\''),
    );
    expect(updateCall).toBeDefined();
  });

  it('schedules a retry with exponential backoff on transient failure', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([
      {
        id: 'oxe_2',
        organizationId: 'org_1',
        eventType: 'notification.dispatch',
        payloadJson: {
          organizationId: 'org_1',
          type: 'INVOICE_RECEIVED',
          recipientUserIds: ['u1'],
          title: 't',
          body: 'b',
          entityType: 'INVOICE',
          entityId: 'inv_1',
        },
        attempts: 0,
      },
    ]);
    mockDispatchNotification.mockRejectedValueOnce(new Error('upstream 503'));

    const result = await drainOutboxBatch();

    expect(result.retried).toBe(1);
    expect(result.dispatched).toBe(0);
    expect(result.failed).toBe(0);

    // NEW-ARCH-02 / NEW-ARCH-03: attempts is bumped during the CLAIM
    // phase (a bulk UPDATE … SET "attempts" = "attempts" + 1, …) — the
    // failure-path UPDATE only writes lastError + nextAttemptAt.
    const claimUpdate = mockExecuteRawUnsafe.mock.calls.find(call =>
      String(call[0]).includes('"attempts" = "attempts" + 1'),
    );
    expect(claimUpdate).toBeDefined();

    const retryCall = mockExecuteRawUnsafe.mock.calls.find(call =>
      String(call[0]).includes('SET "lastError"'),
    );
    expect(retryCall).toBeDefined();
    // lastError argument captures the upstream message
    expect(retryCall?.[2]).toMatch(/upstream 503/);
  });

  it('marks FAILED + Sentry-captures on the final attempt', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([
      {
        id: 'oxe_3',
        organizationId: 'org_1',
        eventType: 'notification.dispatch',
        payloadJson: {
          organizationId: 'org_1',
          type: 'INVOICE_RECEIVED',
          recipientUserIds: ['u1'],
          title: 't',
          body: 'b',
          entityType: 'INVOICE',
          entityId: 'inv_1',
        },
        attempts: MAX_OUTBOX_ATTEMPTS - 1,
      },
    ]);
    mockDispatchNotification.mockRejectedValueOnce(new Error('permanent boom'));

    const result = await drainOutboxBatch();

    expect(result.exhausted).toBe(1);
    expect(result.failed).toBe(1);

    const failCall = mockExecuteRawUnsafe.mock.calls.find(call =>
      String(call[0]).includes('SET "status" = \'FAILED\''),
    );
    expect(failCall).toBeDefined();
  });

  it('survives an unknown eventType by retrying then exhausting', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([
      {
        id: 'oxe_4',
        organizationId: 'org_1',
        eventType: 'not.a.real.type',
        payloadJson: {},
        attempts: 0,
      },
    ]);

    const result = await drainOutboxBatch();

    expect(result.dispatched).toBe(0);
    expect(result.retried).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeBackoffMs
// ---------------------------------------------------------------------------

describe('computeBackoffMs', () => {
  it('produces ~4m base delay for the first retry', () => {
    // BACKOFF_BASE_MS=4m + jitter(0..30s) — see NEW-ARCH-06 retune.
    const delay = computeBackoffMs(1);
    expect(delay).toBeGreaterThanOrEqual(4 * 60_000);
    expect(delay).toBeLessThanOrEqual(4 * 60_000 + 30_000);
  });

  it('caps at 1h + jitter for high attempt counts', () => {
    const delay = computeBackoffMs(20);
    expect(delay).toBeGreaterThanOrEqual(60 * 60 * 1000);
    expect(delay).toBeLessThanOrEqual(60 * 60 * 1000 + 30_000);
  });

  it('grows exponentially for early attempts', () => {
    const a1 = computeBackoffMs(1);
    const a3 = computeBackoffMs(3);
    // 4m vs 16m — even with jitter the order is preserved.
    expect(a3).toBeGreaterThan(a1);
  });
});
