// Dark-mount gating for the HR dashboard.
//
// hrDashboard.* is spread into appRouter only when BOTH module.workforce-employees
// (the data prerequisite) AND module.hr-dashboard (the surface kill switch) are
// registered; otherwise the namespace is absent and a client call resolves to
// METHOD_NOT_FOUND. Registration is evaluated at module load, so each branch
// resets the module graph and re-imports ../../root under different flag state.
//
// db + auth are stubbed so the router graph evaluates without a live
// Postgres/Redis/Unleash connection. No procedure is invoked — the presence
// assertions only read `_def.procedures`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/db', () => {
  const noopClient = new Proxy({}, { get: () => () => undefined });
  return {
    prisma: noopClient,
    prismaRaw: noopClient,
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
    tenantStore: { run: (_ctx: unknown, fn: () => unknown) => fn(), getStore: vi.fn() },
    withTenantScope: vi.fn((c: unknown) => c),
    withSoftDelete: vi.fn((c: unknown) => c),
    withWorkerTypeDefault: vi.fn((c: unknown) => c),
    createTenantClient: vi.fn(() => noopClient),
    createTenantClientFrom: vi.fn(() => noopClient),
    getRegionalClient: vi.fn(() => noopClient),
    preWarmRegionalClients: vi.fn(),
  };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: { api: { getSession: vi.fn(), hasPermission: vi.fn() } },
  authApi: { getSession: vi.fn(), hasPermission: vi.fn(), getFullOrganization: vi.fn() },
}));

function hrDashboardPresent(procedures: Record<string, unknown>): boolean {
  return Object.keys(procedures).some(path => path.startsWith('hrDashboard.'));
}

async function loadAppRouter(): Promise<Record<string, unknown>> {
  vi.resetModules();
  const { appRouter } = await import('../../../root');
  return appRouter._def.procedures as Record<string, unknown>;
}

describe('hrDashboard dark-mount gating', () => {
  let savedQaOrg: string | undefined;

  beforeEach(() => {
    savedQaOrg = process.env.QA_DEFAULT_ORG_ID;
  });

  afterEach(() => {
    if (savedQaOrg === undefined) delete process.env.QA_DEFAULT_ORG_ID;
    else process.env.QA_DEFAULT_ORG_ID = savedQaOrg;
    vi.resetModules();
    vi.doUnmock('@contractor-ops/feature-flags');
  });

  it('omits hrDashboard.* when both flags are OFF', async () => {
    delete process.env.QA_DEFAULT_ORG_ID;
    expect(hrDashboardPresent(await loadAppRouter())).toBe(false);
  });

  it('mounts hrDashboard.* when both flags are ON (QA force-register)', async () => {
    process.env.QA_DEFAULT_ORG_ID = 'qa-walk-org';
    expect(hrDashboardPresent(await loadAppRouter())).toBe(true);
  });

  it('omits hrDashboard.* when workforce is ON but module.hr-dashboard is OFF', async () => {
    delete process.env.QA_DEFAULT_ORG_ID;
    vi.resetModules();
    vi.doMock('@contractor-ops/feature-flags', () => ({
      evaluate: vi.fn((key: string) => ({
        enabled: key === 'module.workforce-employees',
        reason: 'test',
      })),
      buildFlagBag: vi.fn(() => ({ isEnabled: () => false })),
    }));
    const { appRouter } = await import('../../../root');
    expect(hrDashboardPresent(appRouter._def.procedures as Record<string, unknown>)).toBe(false);
  });
});
