// RED net — module.employee-portal gating (defense in depth).
//
// Two layers protect the surface: (1) boot-time dark-mount — the portalEmployee /
// portalManager namespaces are absent from portalAppRouter when the flag is
// unregistered (METHOD_NOT_FOUND), mirroring conditionalWorkforceRouters; (2)
// a per-request re-assertion — every procedure throws FORBIDDEN when the flag is
// OFF for the caller's org. This suite exercises layer 2 (the flag is ON at
// import so the namespaces mount, then flipped OFF per request). RED via
// "procedure not found" (a NOT_FOUND, not the expected FORBIDDEN) until the
// employee router is built.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PortalEmployeeFixture } from './portal-fixtures';
import {
  createDbFromFixture,
  makePortalCaller,
  makePortalEmployeeFixture,
  resolveEmployeeSession,
  TOKEN_A,
  TOKEN_M,
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

describe('module.employee-portal gating — per-request re-assertion (EMP-PORTAL-01)', () => {
  it('with the flag ON, an employee procedure is reachable', async () => {
    const callerA = makePortalCaller(createCaller, TOKEN_A) as any;
    const res = await callerA.portalEmployee.getPayStubAvailability();
    expect(res).toBeDefined();
  });

  it('with the flag OFF, an employee procedure throws FORBIDDEN', async () => {
    H.flagHolder.enabled = false;
    const callerA = makePortalCaller(createCaller, TOKEN_A) as any;
    await expect(
      invoke(() => callerA.portalEmployee.getPayStubAvailability()),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('with the flag OFF, a manager procedure throws FORBIDDEN', async () => {
    H.flagHolder.enabled = false;
    const callerM = makePortalCaller(createCaller, TOKEN_M) as any;
    await expect(invoke(() => callerM.portalManager.getTeamOverview())).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
