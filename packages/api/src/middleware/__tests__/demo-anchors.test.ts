// Integration coverage for the demo guard *as wired onto the real base
// procedures* — proving the security boundary is attached at the anchors every
// router inherits (`authedProcedure` for staff `appRouter`, `portalProcedure`
// for `portalAppRouter`), not just on the standalone middleware.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { validatePortalSession } = vi.hoisted(() => ({ validatePortalSession: vi.fn() }));

vi.mock('../../services/portal-session', () => ({ validatePortalSession }));

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
    setTags: vi.fn(),
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
  withBodyLogging: vi.fn((_o, fn) => fn),
  logIntegrationCall: vi.fn(),
  subscribeOpossumEvents: vi.fn(),
  runWithRequestContext: vi.fn((_c, fn) => fn()),
  getRequestId: vi.fn(() => undefined),
  getTraceparent: vi.fn(() => undefined),
  buildContextFromHeaders: vi.fn(() => ({})),
  getOutboundHeaders: vi.fn(() => ({})),
  generateRequestId: vi.fn(() => 'test-request-id'),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  LOG_BODY_INCLUDE_PREFIXES: [],
  PII_MASK_KEYWORDS: [],
  PII_MASK_PATHS: [],
  createLogger: vi.fn(() => ({
    info: vi.fn(),

    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), distribution: vi.fn(), histogram: vi.fn() },
}));

vi.mock('@contractor-ops/db', () => {
  const MockDbPrisma = {
    organization: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: 'org_portal', dataRegion: 'EU', status: 'ACTIVE' }),
    },
  };
  return {
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
    prisma: MockDbPrisma,
    prismaRaw: MockDbPrisma,
    getRegionalClient: vi.fn(() => ({})),
    createTenantClientFrom: vi.fn(() => ({ scoped: true })),
    tenantStore: { run: (_ctx: unknown, fn: () => unknown) => fn(), getStore: vi.fn() },
  };
});

const env = { DEMO_MODE: false as boolean, DEMO_ORG_IDS: [] as string[] };
vi.mock('@contractor-ops/validators', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, getServerEnv: vi.fn(() => env) };
});

import { t } from '../../init';
import { authedProcedure } from '../auth';
import { portalProcedure } from '../portal-auth';

const staffRouter = t.router({
  read: authedProcedure.query(() => 'ok'),
  write: authedProcedure.mutation(() => 'wrote'),
});
const staffCaller = t.createCallerFactory(staffRouter);

const portalRouter = t.router({
  read: portalProcedure.query(() => 'ok'),
  write: portalProcedure.mutation(() => 'wrote'),
});
const portalCaller = t.createCallerFactory(portalRouter);

function staffCtx(orgId: string) {
  return {
    headers: new Headers(),
    session: { session: { activeOrganizationId: orgId } },
    user: { id: 'u1', banned: false },
  } as never;
}

function portalCtx() {
  const h = new Headers();
  h.set('cookie', 'portal_session=tok');
  return { headers: h, session: null, user: null } as never;
}

beforeEach(() => {
  env.DEMO_MODE = false;
  env.DEMO_ORG_IDS = [];
  validatePortalSession.mockReset();
  validatePortalSession.mockResolvedValue({
    id: 'ps1',
    contractorId: 'contractor_1',
    organizationId: 'org_portal',
    email: 'c@example.com',
    expiresAt: new Date('2099-01-01'),
    contractor: { id: 'contractor_1', status: 'ACTIVE', name: 'Contractor' },
  });
});

describe('authedProcedure (staff appRouter anchor)', () => {
  it('blocks a mutation for a demo-org session', async () => {
    env.DEMO_ORG_IDS = ['org_demo'];
    await expect(staffCaller(staffCtx('org_demo')).write()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'demoReadOnly',
    });
  });

  it('allows a query for a demo-org session', async () => {
    env.DEMO_ORG_IDS = ['org_demo'];
    await expect(staffCaller(staffCtx('org_demo')).read()).resolves.toBe('ok');
  });

  it('allows a mutation for a non-demo org (no regression)', async () => {
    env.DEMO_ORG_IDS = ['org_demo'];
    await expect(staffCaller(staffCtx('org_real')).write()).resolves.toBe('wrote');
  });
});

describe('portalProcedure (portalAppRouter anchor)', () => {
  it('blocks a mutation when the portal session org is demo', async () => {
    env.DEMO_ORG_IDS = ['org_portal'];
    await expect(portalCaller(portalCtx()).write()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'demoReadOnly',
    });
  });

  it('allows a query when the portal session org is demo', async () => {
    env.DEMO_ORG_IDS = ['org_portal'];
    await expect(portalCaller(portalCtx()).read()).resolves.toBe('ok');
  });

  it('allows a portal mutation for a non-demo org', async () => {
    await expect(portalCaller(portalCtx()).write()).resolves.toBe('wrote');
  });
});
