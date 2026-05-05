import { beforeEach, describe, expect, it, vi } from 'vitest';

const { validatePortalSession, tenantStoreRun } = vi.hoisted(() => ({
  validatePortalSession: vi.fn(),
  tenantStoreRun: vi.fn((_ctx: { organizationId: string }, fn: () => unknown) => fn()),
}));

vi.mock('../../services/portal-session.js', () => ({
  validatePortalSession,
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = {
    setStatus: vi.fn(),
    setAttribute: vi.fn(),
    end: vi.fn(),
  };
  return {
    getCurrentScope: vi.fn(() => ({ setUser: vi.fn(), setTag: vi.fn(), setTags: vi.fn(), setContext: vi.fn(), setExtra: vi.fn(), clear: vi.fn() })),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(), trace: vi.fn(), child: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
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
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(), trace: vi.fn(), child: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), distribution: vi.fn(), histogram: vi.fn() },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T,>(c: T) => c,
  withRlsReads: <T,>(c: T) => c,
  prisma: {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
  },
  getRegionalClient: vi.fn(() => ({})),
  createTenantClientFrom: vi.fn(() => ({ scoped: true })),
  tenantStore: {
    run: tenantStoreRun,
    getStore: vi.fn(),
  },
}));

import { t } from '../../init.js';
import { portalProcedure } from '../portal-auth.js';

const mockSession = {
  id: 'ps1',
  contractorId: 'contractor_1',
  organizationId: 'org_portal',
  email: 'c@example.com',
  expiresAt: new Date('2099-01-01'),
  contractor: {
    id: 'contractor_1',
    status: 'ACTIVE',
    name: 'Contractor',
  },
};

describe('portalProcedure', () => {
  const router = t.router({
    portal: portalProcedure.query(({ ctx }) => ({
      contractorId: ctx.contractorId,
      organizationId: ctx.organizationId,
      portalSubdomain: ctx.portalSubdomain,
    })),
  });
  const createCaller = t.createCallerFactory(router);

  beforeEach(() => {
    validatePortalSession.mockReset();
    tenantStoreRun.mockClear();
  });

  it('throws UNAUTHORIZED when Cookie header is missing', async () => {
    await expect(
      createCaller({
        headers: new Headers(),
        session: null,
        user: null,
      }).portal(),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws UNAUTHORIZED when portal_session cookie is missing', async () => {
    const h = new Headers();
    h.set('cookie', 'other=value');
    await expect(
      createCaller({ headers: h, session: null, user: null }).portal(),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws UNAUTHORIZED when validatePortalSession returns null', async () => {
    validatePortalSession.mockResolvedValue(null);
    const h = new Headers();
    h.set('cookie', 'portal_session=badtoken');
    await expect(
      createCaller({ headers: h, session: null, user: null }).portal(),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(validatePortalSession).toHaveBeenCalledWith('badtoken');
  });

  it('runs tenantStore and exposes portal context on success', async () => {
    validatePortalSession.mockResolvedValue(mockSession);
    const h = new Headers();
    h.set('cookie', 'portal_session=goodtoken');
    h.set('x-portal-org-subdomain', 'acme');
    const result = await createCaller({
      headers: h,
      session: null,
      user: null,
    }).portal();
    expect(result.contractorId).toBe('contractor_1');
    expect(result.organizationId).toBe('org_portal');
    expect(result.portalSubdomain).toBe('acme');
    expect(tenantStoreRun).toHaveBeenCalledWith(
      { organizationId: 'org_portal', region: 'EU' },
      expect.any(Function),
    );
  });
});
