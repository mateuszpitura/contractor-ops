// Three-layer flag-off proof for the Theme B worker / employee surface.
//
// Layer 1 (load-time): worker.* and employee.* are spread into appRouter only
// when isWorkforceRegistered() is true; otherwise they are absent and a client
// call resolves to METHOD_NOT_FOUND. The registration is evaluated at module
// load, so each branch resets the module graph and re-imports ../root with a
// different QA_DEFAULT_ORG_ID (the deterministic force-register lever, mirroring
// the us-expansion gate).
//
// Layer 2 (per-request): assertWorkforceEnabled re-checks the flag and throws
// FORBIDDEN / WORKFORCE_DISABLED when disabled, regardless of load-time state.
//
// contractor.* is never flag-gated — it must be present in BOTH branches.
//
// The router graph pulls in db + auth at import time; both are stubbed so the
// module evaluates without a live Postgres/Redis/Unleash connection. No
// procedure is invoked — the presence assertions only read `_def.procedures`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/db', () => {
  const noopClient = new Proxy(
    {},
    {
      get: () => () => undefined,
    },
  );
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

const WORKFORCE_NAMESPACES = [
  'worker.',
  'employee.',
  'leave.',
  'employeeTime.',
  'ewidencja.',
  'payrollExport.',
];

function namespacePresent(procedures: Record<string, unknown>, prefix: string): boolean {
  return Object.keys(procedures).some(path => path.startsWith(prefix));
}

async function loadAppRouter(): Promise<{ procedures: Record<string, unknown> }> {
  vi.resetModules();
  const { appRouter } = await import('../root');
  return { procedures: appRouter._def.procedures as Record<string, unknown> };
}

describe('workforce flag-off — load-time router registration', () => {
  let savedQaOrg: string | undefined;

  beforeEach(() => {
    savedQaOrg = process.env.QA_DEFAULT_ORG_ID;
  });

  afterEach(() => {
    if (savedQaOrg === undefined) delete process.env.QA_DEFAULT_ORG_ID;
    else process.env.QA_DEFAULT_ORG_ID = savedQaOrg;
    vi.resetModules();
  });

  it('omits worker.* and employee.* from appRouter when the flag is OFF', async () => {
    delete process.env.QA_DEFAULT_ORG_ID;
    const { procedures } = await loadAppRouter();

    for (const prefix of WORKFORCE_NAMESPACES) {
      expect(namespacePresent(procedures, prefix)).toBe(false);
    }
  });

  it('mounts worker.* and employee.* in appRouter when the flag is ON', async () => {
    process.env.QA_DEFAULT_ORG_ID = 'qa-walk-org';
    const { procedures } = await loadAppRouter();

    for (const prefix of WORKFORCE_NAMESPACES) {
      expect(namespacePresent(procedures, prefix)).toBe(true);
    }
  });

  it('keeps contractor.* present regardless of the workforce flag', async () => {
    delete process.env.QA_DEFAULT_ORG_ID;
    const off = await loadAppRouter();
    expect(namespacePresent(off.procedures, 'contractor.')).toBe(true);

    process.env.QA_DEFAULT_ORG_ID = 'qa-walk-org';
    const on = await loadAppRouter();
    expect(namespacePresent(on.procedures, 'contractor.')).toBe(true);
  });
});

describe('workforce flag-off — per-request guard', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@contractor-ops/feature-flags');
  });

  it('assertWorkforceEnabled throws FORBIDDEN / WORKFORCE_DISABLED when the flag is OFF', async () => {
    vi.resetModules();
    vi.doMock('@contractor-ops/feature-flags', () => ({
      evaluate: vi.fn(() => ({ enabled: false, reason: 'disabled' })),
    }));

    const { assertWorkforceEnabled } = await import('../middleware/require-workforce-flag');
    const { WORKFORCE_DISABLED } = await import('../errors');

    try {
      assertWorkforceEnabled('org-1', 'EU');
      expect.unreachable('assertWorkforceEnabled should have thrown');
    } catch (err) {
      const e = err as { code?: string; message?: string };
      expect(e.code).toBe('FORBIDDEN');
      expect(e.message).toBe(WORKFORCE_DISABLED);
    }
  });

  it('assertWorkforceEnabled passes when the flag is ON', async () => {
    vi.resetModules();
    vi.doMock('@contractor-ops/feature-flags', () => ({
      evaluate: vi.fn(() => ({ enabled: true, reason: 'enabled' })),
    }));

    const { assertWorkforceEnabled } = await import('../middleware/require-workforce-flag');

    expect(() => assertWorkforceEnabled('org-1', 'ME')).not.toThrow();
  });
});
