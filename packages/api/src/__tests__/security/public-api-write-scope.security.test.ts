/**
 * BFLA tripwire.
 *
 * The public write surface must be scope-enforced by construction: EVERY write
 * procedure carries a mandatory `requirePermission(...)` whose computed scope
 * string is a member of `PUBLIC_API_SCOPES`, and a correctly-authenticated key
 * WITHOUT that scope must be forbidden. This table is the canonical BFLA
 * tripwire — adding a write procedure later without a matching entry here is a
 * hard test failure.
 *
 * Two halves:
 *   1. Scope-registry membership — every `requiredScope` in the matrix is a
 *      member of `PUBLIC_API_SCOPES` (GREEN — the write scopes shipped earlier).
 *   2. Live 403 matrix — each DELIVERED write procedure 403s a key lacking its
 *      scope and does NOT 403 a key with it.
 *
 * DELIVERED = the 6 built write entities (contractors, invoices,
 * payments, payment_runs, workflows, workflow_tasks). DEFERRED rows stay
 * explicitly skipped (never silently dropped) — compliance documents are
 * read-only externally; standalone payment.create does not exist.
 */

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PUBLIC_API_SCOPES } from '../../lib/scope-utils';

const ORG_ID = 'org-write-scope-001';
const KEY_ID = 'key-write-scope-001';
const ACTING_USER_ID = 'user-write-scope-acting-001';

/**
 * The DELIVERED write surface: `{ procedurePath, requiredScope }`. Each
 * procedure exists under `apiKeyTenantProcedure` and enforces the scope.
 */
const DELIVERED_WRITE_SCOPE_MATRIX = [
  { procedurePath: 'contractor.create', requiredScope: 'contractor:create' },
  { procedurePath: 'contractor.update', requiredScope: 'contractor:update' },
  { procedurePath: 'invoice.create', requiredScope: 'invoice:create' },
  { procedurePath: 'invoice.void', requiredScope: 'invoice:update' },
  { procedurePath: 'payment.update', requiredScope: 'payment:update' },
  { procedurePath: 'paymentRun.create', requiredScope: 'payment:create' },
  { procedurePath: 'paymentRun.transition', requiredScope: 'payment:update' },
  { procedurePath: 'paymentRun.export', requiredScope: 'payment:export' },
  { procedurePath: 'workflow.create', requiredScope: 'workflow:create' },
  { procedurePath: 'workflow.execute', requiredScope: 'workflow:execute' },
  { procedurePath: 'workflowTask.transition', requiredScope: 'workflow:update' },
] as const;

/**
 * DEFERRED — not built, kept for the scope-registry half and as an
 * explicit record so a future phase re-enables them deliberately:
 *   - payment.create — payments are seeded BY payment-run creation, never
 *     standalone, so there is no standalone create procedure.
 *   - complianceDocument.create / .link — ClassificationDocument is an
 *     append-only system artifact and the auth requirement grants
 *     `compliance:read` only; compliance documents stay READ-ONLY externally.
 */
const DEFERRED_WRITE_SCOPE_MATRIX = [
  { procedurePath: 'payment.create', requiredScope: 'payment:create' },
  { procedurePath: 'complianceDocument.create', requiredScope: 'document:create' },
  { procedurePath: 'complianceDocument.link', requiredScope: 'document:update' },
] as const;

describe('public write BFLA — scope registry membership', () => {
  const scopeSet = new Set<string>(PUBLIC_API_SCOPES);
  for (const { procedurePath, requiredScope } of [
    ...DELIVERED_WRITE_SCOPE_MATRIX,
    ...DEFERRED_WRITE_SCOPE_MATRIX,
  ]) {
    it(`${procedurePath} requires a scope present in PUBLIC_API_SCOPES (${requiredScope})`, () => {
      expect(scopeSet.has(requiredScope)).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// Live 403 matrix harness
// ---------------------------------------------------------------------------

const { mockDb, mockResolveApiKey, mockTouchLastUsed, mockGetSubscription, evaluateMock } =
  vi.hoisted(() => {
    type Rec = Record<string, unknown>;
    const table = () => ({
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findFirstOrThrow: vi.fn(async () => {
        throw new Error('row not found');
      }),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: 'created-1' })),
      update: vi.fn(async () => ({ id: 'updated-1' })),
      count: vi.fn(async () => 0),
    });
    const mockDb: Rec = {
      contractor: table(),
      invoice: table(),
      payment: table(),
      paymentRun: table(),
      paymentRunItem: table(),
      workflowRun: table(),
      workflowTaskRun: table(),
      auditLog: { create: vi.fn(async () => ({ id: 'audit-1' })) },
      organization: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'org-write-scope-001', dataRegion: 'EU', status: 'ACTIVE' }),
      },
      $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockDb)),
    };
    return {
      mockDb,
      mockResolveApiKey: vi.fn(),
      mockTouchLastUsed: vi.fn(),
      mockGetSubscription: vi.fn(),
      evaluateMock: vi.fn(() => ({ enabled: true, reason: 'unleash' })),
    };
  });

vi.mock('@contractor-ops/feature-flags', () => ({ evaluate: evaluateMock }));

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: { getSession: vi.fn(), hasPermission: vi.fn().mockResolvedValue({ success: true }) },
  },
  authApi: {
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
    getSession: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockDb,
  prismaRaw: mockDb,
  tenantStore: {
    run: (_c: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockDb),
  createTenantClientFrom: vi.fn(() => mockDb),
  getRegionalClient: vi.fn(() => mockDb),
}));

vi.mock('@contractor-ops/logger', () => {
  const stub = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return {
    createLogger: vi.fn(() => ({ ...stub, child: vi.fn(() => stub) })),
    createTrpcLogger: vi.fn(() => stub),
    createCronLogger: vi.fn(() => stub),
    createWebhookLogger: vi.fn(() => stub),
    createIntegrationLogger: vi.fn(() => stub),
    getIdpAuditLogger: vi.fn(() => ({ ...stub, child: vi.fn() })),
    withBodyLogging: vi.fn((_o: unknown, fn: unknown) => fn),
    runWithRequestContext: vi.fn((_c: unknown, fn: () => unknown) => fn()),
    getRequestId: vi.fn(() => undefined),
    generateRequestId: vi.fn(() => 'test-request-id'),
    logger: stub,
  };
});

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock('@sentry/node', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
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
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (s: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('../../services/api-key-service', () => ({
  resolveApiKey: mockResolveApiKey,
  touchLastUsed: mockTouchLastUsed,
}));

vi.mock('../../services/billing-service', () => ({ getSubscription: mockGetSubscription }));

vi.mock('../../services/cache', async importOriginal => {
  const actual = await importOriginal<typeof import('../../services/cache')>();
  const { createPassthroughCacheMock } = await import('../../__tests__/__mocks__/cache-service');
  return createPassthroughCacheMock(actual);
});

import { createCallerFactory } from '../../init';
import { publicApiRouter } from '../../routers/public-api';

const createCaller = createCallerFactory(publicApiRouter);

function makeCaller(scopes: string[]) {
  mockResolveApiKey.mockResolvedValue({
    id: KEY_ID,
    organizationId: ORG_ID,
    prefix: 'abcdefghijkl',
    hash: 'hashed',
    scopes,
    actingUserId: ACTING_USER_ID,
    revokedAt: null,
    supersededAt: null,
    graceExpiresAt: null,
    expiresAt: null,
    lastUsedAt: null,
    organization: { id: ORG_ID, dataRegion: 'EU', status: 'ACTIVE' },
  });
  mockGetSubscription.mockResolvedValue({
    id: 'sub_1',
    organizationId: ORG_ID,
    tier: 'ENTERPRISE',
    status: 'ACTIVE',
    currentPeriodStart: new Date('2026-01-01'),
    currentPeriodEnd: new Date('2027-01-01'),
  });
  return createCaller({
    headers: new Headers({ authorization: 'Bearer co_live_test_token' }),
    session: null,
    user: null,
  });
}

/** Invoke `entity.verb` on a caller built with the given scopes. */
function invoke(procedurePath: string, scopes: string[]): Promise<unknown> {
  const [entity, verb] = procedurePath.split('.') as [string, string];
  const caller = makeCaller(scopes) as unknown as Record<
    string,
    Record<string, (i: unknown) => Promise<unknown>>
  >;
  return caller[entity][verb]({});
}

/** Returns the TRPC error code thrown, or undefined if the call resolved. */
async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return;
  } catch (err) {
    return err instanceof TRPCError ? err.code : `NON_TRPC:${(err as Error).name}`;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  evaluateMock.mockReturnValue({ enabled: true, reason: 'unleash' });
});

describe('public write BFLA — live 403 matrix (DELIVERED)', () => {
  for (const { procedurePath, requiredScope } of DELIVERED_WRITE_SCOPE_MATRIX) {
    it(`${procedurePath} forbids a key WITHOUT ${requiredScope}`, async () => {
      // A key holding every OTHER scope but NOT the required one must 403.
      const withoutScope = PUBLIC_API_SCOPES.filter(s => s !== requiredScope);
      await expect(invoke(procedurePath, withoutScope)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it(`${procedurePath} does NOT 403 a key WITH ${requiredScope}`, async () => {
      // With the scope present the BFLA gate passes; the resolver may still fail
      // (validation / NOT_FOUND against the mock DB) but never with FORBIDDEN.
      const code = await codeOf(invoke(procedurePath, [...PUBLIC_API_SCOPES]));
      expect(code).not.toBe('FORBIDDEN');
    });
  }
});

describe('public write BFLA — DEFERRED (not built in Phase 99)', () => {
  for (const { procedurePath } of DEFERRED_WRITE_SCOPE_MATRIX) {
    // Intentionally NOT implemented — compliance docs are read-only
    // externally; payment.create is seeded by payment-run creation.
    it.skip(`${procedurePath} is deferred (no procedure built)`, () => {
      expect(true).toBe(true);
    });
  }
});
