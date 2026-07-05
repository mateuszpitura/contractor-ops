// RED net — manager approval reuse + audit.
//
// Approving/rejecting a report's leave request goes through the shared approval
// transition (state change on the request) under `writeAuditLog` — the portal
// manager path reuses the leave state machine, it does not reimplement it. RED
// via "procedure not found" until the `portalManager` router is built.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PortalEmployeeFixture } from './portal-fixtures';
import {
  createDbFromFixture,
  makePortalCaller,
  makePortalEmployeeFixture,
  resolveEmployeeSession,
  TOKEN_M,
  WORKER_A,
  WORKER_M,
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

let fx: PortalEmployeeFixture;
beforeEach(() => {
  fx = makePortalEmployeeFixture();
  H.dbHolder.db = createDbFromFixture(fx);
  H.sessionHolder.resolve = (t: string) => resolveEmployeeSession(fx, t);
  H.flagHolder.enabled = true;
  H.auditHolder.rows.length = 0;
});

describe('portalManager approve/reject — shared transition + audit (EMP-PORTAL-03)', () => {
  it('approving a report leave writes an EMPLOYEE-actor audit row', async () => {
    const callerM = makePortalCaller(createCaller, TOKEN_M) as any;
    await callerM.portalManager.approveReportLeaveRequest({
      requestId: 'lr-A',
      reportWorkerId: WORKER_A,
    });
    expect(H.auditHolder.rows.some(a => a.actorType === 'EMPLOYEE' && a.actorId === WORKER_M)).toBe(
      true,
    );
  });

  it('approving transitions the request out of PENDING via the shared state machine', async () => {
    const callerM = makePortalCaller(createCaller, TOKEN_M) as any;
    await callerM.portalManager.approveReportLeaveRequest({
      requestId: 'lr-A',
      reportWorkerId: WORKER_A,
    });
    const row = fx.leaveRequests.find(r => r.id === 'lr-A');
    expect(row?.status).not.toBe('PENDING');
  });

  it('rejecting a report leave is audited and never marks it APPROVED', async () => {
    const callerM = makePortalCaller(createCaller, TOKEN_M) as any;
    await callerM.portalManager.rejectReportLeaveRequest({
      requestId: 'lr-A',
      reportWorkerId: WORKER_A,
      reason: 'insufficient cover',
    });
    const row = fx.leaveRequests.find(r => r.id === 'lr-A');
    expect(row?.status).not.toBe('APPROVED');
    expect(H.auditHolder.rows.length).toBeGreaterThan(0);
  });
});
