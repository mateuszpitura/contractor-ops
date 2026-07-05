// RED net — the load-bearing two-employee IDOR fence.
//
// Employee A's portal session may read ONLY A's own records; a client-supplied
// workerId is rejected by the `.strict()` input; a cross-org (org C) session
// reads nothing of org A. These procedures do not exist yet (the `portalEmployee`
// router lands later), so every case is RED via "procedure not found" until the
// router is built.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PortalEmployeeFixture } from './portal-fixtures';
import {
  createDbFromFixture,
  LEAVE_TYPE_ID,
  makePortalCaller,
  makePortalEmployeeFixture,
  ORG_C,
  resolveEmployeeSession,
  TOKEN_A,
  TOKEN_X,
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
    auditHolder: { rows: [] as unknown[] },
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
  writeAuditLog: async (input: unknown) => {
    H.auditHolder.rows.push(input);
  },
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

/** Wrap a call so a synchronous "procedure not found" access throw (RED) and a
 *  rejected validation promise (GREEN) both surface as a rejection. */
function invoke(fn: () => unknown): Promise<unknown> {
  return (async () => fn())();
}

let fx: PortalEmployeeFixture;
beforeEach(() => {
  fx = makePortalEmployeeFixture();
  H.dbHolder.db = createDbFromFixture(fx);
  H.sessionHolder.resolve = (t: string) => resolveEmployeeSession(fx, t);
  H.flagHolder.enabled = true;
  H.auditHolder.rows.length = 0;
});

describe('portalEmployee — the two-employee IDOR fence (EMP-PORTAL-02)', () => {
  it('employee A reads ONLY A leave requests, never B', async () => {
    const callerA = makePortalCaller(createCaller, TOKEN_A) as any;
    const rows = (await callerA.portalEmployee.listMyLeaveRequests()) as { workerId: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => r.workerId === WORKER_A)).toBe(true);
    expect(rows.some(r => r.workerId === WORKER_B)).toBe(false);
  });

  it('employee A reads ONLY A time records, never B', async () => {
    const callerA = makePortalCaller(createCaller, TOKEN_A) as any;
    const rows = (await callerA.portalEmployee.getMyTime()) as { workerId: string }[];
    expect(rows.every(r => r.workerId === WORKER_A)).toBe(true);
    expect(rows.some(r => r.workerId === WORKER_B)).toBe(false);
  });

  it('getLeaveBalance returns a self-scoped balance for A', async () => {
    const callerA = makePortalCaller(createCaller, TOKEN_A) as any;
    const balance = await callerA.portalEmployee.getLeaveBalance({ leaveTypeId: LEAVE_TYPE_ID });
    expect(balance).toBeDefined();
  });

  it('rejects a client-supplied workerId on getLeaveBalance (.strict())', async () => {
    const callerA = makePortalCaller(createCaller, TOKEN_A) as any;
    await expect(
      invoke(() =>
        callerA.portalEmployee.getLeaveBalance({ leaveTypeId: LEAVE_TYPE_ID, workerId: WORKER_B }),
      ),
    ).rejects.toThrow();
  });

  it('no read procedure accepts a workerId to inject another subject', async () => {
    const callerA = makePortalCaller(createCaller, TOKEN_A) as any;
    await expect(
      invoke(() => callerA.portalEmployee.listMyLeaveRequests({ workerId: WORKER_B })),
    ).rejects.toThrow();
  });

  it('a cross-org (org C) session reads only its own org, never org A rows', async () => {
    const callerX = makePortalCaller(createCaller, TOKEN_X) as any;
    const rows = (await callerX.portalEmployee.listMyLeaveRequests()) as {
      workerId: string;
      organizationId: string;
    }[];
    expect(rows.every(r => r.organizationId === ORG_C)).toBe(true);
    expect(rows.some(r => r.workerId === WORKER_A)).toBe(false);
  });
});
