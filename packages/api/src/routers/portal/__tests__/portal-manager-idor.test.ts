// RED net — the manager reporting-line IDOR fence.
//
// Manager M manages exactly one report (A). M may list / act on A's records but
// NEVER a peer (B) or a cross-org worker (X); a non-manager (B) has no
// `portalManager` surface at all. The router does not exist yet (it lands with
// the manager plan), so the positive path is RED via "procedure not found" and
// the negative guards reject; the manager plan flips them GREEN.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PortalEmployeeFixture } from './portal-fixtures';
import {
  createDbFromFixture,
  makePortalCaller,
  makePortalEmployeeFixture,
  resolveEmployeeSession,
  TOKEN_B,
  TOKEN_M,
  WORKER_A,
  WORKER_B,
  WORKER_X,
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

describe('portalManager — the reporting-line IDOR fence (EMP-PORTAL-03)', () => {
  it('manager M lists leave requests for its report (A), never a peer (B)', async () => {
    const callerM = makePortalCaller(createCaller, TOKEN_M) as any;
    const rows = (await callerM.portalManager.listReportLeaveRequests()) as { workerId: string }[];
    expect(rows.some(r => r.workerId === WORKER_A)).toBe(true);
    expect(rows.some(r => r.workerId === WORKER_B)).toBe(false);
  });

  it('manager M can approve leave for a direct report (A)', async () => {
    const callerM = makePortalCaller(createCaller, TOKEN_M) as any;
    const res = await callerM.portalManager.approveReportLeaveRequest({
      requestId: 'lr-A',
      reportWorkerId: WORKER_A,
    });
    expect(res).toBeDefined();
  });

  it('manager M CANNOT approve leave for a non-report peer (B)', async () => {
    const callerM = makePortalCaller(createCaller, TOKEN_M) as any;
    await expect(
      invoke(() =>
        callerM.portalManager.approveReportLeaveRequest({
          requestId: 'lr-B',
          reportWorkerId: WORKER_B,
        }),
      ),
    ).rejects.toThrow();
  });

  it('manager M CANNOT act on a cross-org worker (X)', async () => {
    const callerM = makePortalCaller(createCaller, TOKEN_M) as any;
    await expect(
      invoke(() =>
        callerM.portalManager.approveReportLeaveRequest({
          requestId: 'lr-X',
          reportWorkerId: WORKER_X,
        }),
      ),
    ).rejects.toThrow();
  });

  it('a non-manager employee (B) has NO portalManager surface', async () => {
    const callerB = makePortalCaller(createCaller, TOKEN_B) as any;
    await expect(invoke(() => callerB.portalManager.getTeamOverview())).rejects.toThrow();
  });

  it('a report id is never taken from client input — no listReportLeaveRequests(workerId)', async () => {
    const callerM = makePortalCaller(createCaller, TOKEN_M) as any;
    // The report scope is derived server-side from managerWorkerId; the read
    // takes no report id. In GREEN a stray arg is a `.strict()` rejection.
    await expect(
      invoke(() => callerM.portalManager.listReportLeaveRequests({ workerId: WORKER_B })),
    ).rejects.toThrow();
  });
});
