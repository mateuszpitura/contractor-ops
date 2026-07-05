// RED net — time-off request from the portal.
//
// `portalEmployee.submitTimeOffRequest` takes NO workerId — it derives the
// subject from the session, reuses the shared leave services, and writes an
// audit row in the same transaction. A `workerId` in the payload is a `.strict()`
// rejection. RED via "procedure not found" until the employee router is built.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PortalEmployeeFixture } from './portal-fixtures';
import {
  createDbFromFixture,
  LEAVE_TYPE_ID,
  makePortalCaller,
  makePortalEmployeeFixture,
  resolveEmployeeSession,
  TOKEN_A,
  WORKER_A,
  WORKER_B,
} from './portal-fixtures';

const H = vi.hoisted(() => {
  const noopLog: Record<string, unknown> = {};
  for (const m of ['info', 'warn', 'error', 'debug', 'trace', 'fatal']) noopLog[m] = () => {};
  noopLog.child = () => noopLog;
  return {
    dbHolder: { db: null as unknown },
    sessionHolder: { resolve: (_t: string) => null as unknown },
    flagHolder: { enabled: true },
    auditHolder: { rows: [] as Record<string, unknown>[] },
    noopLog,
  };
});

vi.mock('@contractor-ops/db', () => {
  const proxy = new Proxy(
    {},
    { get: (_t, p) => (H.dbHolder.db as Record<string, unknown>)?.[p as string] },
  );
  return {
    prisma: proxy,
    prismaRaw: proxy,
    withRlsTransactions: (c: unknown) => c,
    withRlsReads: (c: unknown) => c,
    withTenantScope: (c: unknown) => c,
    withSoftDelete: (c: unknown) => c,
    createTenantClient: () => H.dbHolder.db,
    createTenantClientFrom: () => H.dbHolder.db,
    getRegionalClient: () => H.dbHolder.db,
    tenantStore: {
      run: (_c: unknown, fn: () => unknown) => fn(),
      getStore: () => ({ region: 'EU' }),
    },
  };
});

vi.mock('@contractor-ops/feature-flags', () => ({
  evaluate: () => ({ enabled: H.flagHolder.enabled, reason: 'test' }),
  buildFlagBag: () => ({ isEnabled: () => H.flagHolder.enabled }),
}));

vi.mock('../../../services/portal-session', () => ({
  validatePortalSession: (token: string) => H.sessionHolder.resolve(token),
  createPortalSession: async () => ({ id: 'sess-new' }),
  deletePortalSession: async () => {},
}));

vi.mock('../../../services/audit-writer', () => ({
  writeAuditLog: async (input: Record<string, unknown>) => {
    H.auditHolder.rows.push(input);
  },
}));

// The portal time-off write REUSES the shared leave services — it never
// reimplements approval routing or balance maths. Permissive stubs so the GREEN
// handler can call them.
vi.mock('../../../services/approval-engine', () => ({
  createApprovalFlow: async () => ({ id: 'flow-1', status: 'PENDING' }),
  routeToLeaveChain: async () => ({ chainType: 'LEAVE', steps: [] }),
  routeToChain: async () => ({ steps: [] }),
  advanceFlow: async () => ({ status: 'PENDING' }),
}));

vi.mock('../../../services/leave-balance', () => ({
  MINUTES_PER_LEAVE_DAY: 480,
  computeLeaveBalance: () => 9600,
  resolveEntitlementMinutes: () => 12000,
  recomputeBalanceCache: async () => {},
}));

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: { getSession: vi.fn(), hasPermission: vi.fn().mockResolvedValue({ success: true }) },
  },
  authApi: { hasPermission: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock('@contractor-ops/logger', () => {
  const l = H.noopLog;
  const fn = () => l;
  return {
    logger: l,
    createLogger: fn,
    createTrpcLogger: fn,
    createWebhookLogger: fn,
    createCronLogger: fn,
    createIntegrationLogger: fn,
    getIdpAuditLogger: fn,
    withBodyLogging: (_o: unknown, f: unknown) => f,
    logIntegrationCall: () => {},
    subscribeOpossumEvents: () => {},
    runWithRequestContext: (_c: unknown, f: () => unknown) => f(),
    getRequestId: () => undefined,
    getTraceparent: () => undefined,
    buildContextFromHeaders: () => ({}),
    getOutboundHeaders: () => ({}),
    generateRequestId: () => 'test-req',
    LOG_BODY_INCLUDE_PREFIXES: [],
    PII_MASK_KEYWORDS: [],
    PII_MASK_PATHS: [],
  };
});

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: () => {}, histogram: () => {}, distribution: () => {} },
}));

vi.mock('@sentry/node', () => {
  const span = { setStatus: () => {}, setAttribute: () => {}, end: () => {} };
  return {
    getCurrentScope: () => ({
      setUser: () => {},
      setTag: () => {},
      setTags: () => {},
      setContext: () => {},
      setExtra: () => {},
      clear: () => {},
    }),
    setUser: () => {},
    setTag: () => {},
    setTags: () => {},
    setContext: () => {},
    startSpan: (_o: unknown, fn: (s: typeof span) => unknown) => fn(span),
    captureException: () => {},
  };
});

import { createCallerFactory } from '../../../init';
import { portalAppRouter } from '../../../portal-root';

const createCaller = createCallerFactory(portalAppRouter as any);

function invoke(fn: () => unknown): Promise<unknown> {
  return (async () => fn())();
}

const validRequest = {
  leaveTypeId: LEAVE_TYPE_ID,
  startDate: '2026-09-01',
  endDate: '2026-09-02',
  requestedMinutes: 480,
};

let fx: PortalEmployeeFixture;
beforeEach(() => {
  fx = makePortalEmployeeFixture();
  H.dbHolder.db = createDbFromFixture(fx);
  H.sessionHolder.resolve = (t: string) => resolveEmployeeSession(fx, t);
  H.flagHolder.enabled = true;
  H.auditHolder.rows.length = 0;
});

describe('portalEmployee.submitTimeOffRequest — session-derived, audited (EMP-PORTAL-02)', () => {
  it('creates the request for the SESSION worker (A), never from client input', async () => {
    const callerA = makePortalCaller(createCaller, TOKEN_A) as any;
    await callerA.portalEmployee.submitTimeOffRequest(validRequest);
    // A new PENDING request for A carrying the submitted minutes exists.
    expect(fx.leaveRequests.some(r => r.workerId === WORKER_A && r.requestedMinutes === 480)).toBe(
      true,
    );
    // No request was created for anyone else.
    expect(fx.leaveRequests.some(r => r.workerId === WORKER_B && r.requestedMinutes === 480)).toBe(
      false,
    );
  });

  it('writes an EMPLOYEE-actor audit row in the same flow', async () => {
    const callerA = makePortalCaller(createCaller, TOKEN_A) as any;
    await callerA.portalEmployee.submitTimeOffRequest(validRequest);
    expect(H.auditHolder.rows.some(a => a.actorType === 'EMPLOYEE' && a.actorId === WORKER_A)).toBe(
      true,
    );
  });

  it('rejects a workerId smuggled into the payload (.strict())', async () => {
    const callerA = makePortalCaller(createCaller, TOKEN_A) as any;
    await expect(
      invoke(() =>
        callerA.portalEmployee.submitTimeOffRequest({ ...validRequest, workerId: WORKER_B }),
      ),
    ).rejects.toThrow();
  });
});
