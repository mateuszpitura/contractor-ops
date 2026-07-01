// Load-time flag-off proof for the staff Form 1042-S surface.
//
// form1042s.* (and the sibling taxForm.*) are spread into appRouter only when
// isUsExpansionRegistered() is true; otherwise they are absent and a client call
// resolves to METHOD_NOT_FOUND. Registration is evaluated at module load, so each
// branch resets the module graph and re-imports ../../../root with a different
// QA_DEFAULT_ORG_ID (the deterministic force-register lever).
//
// The router graph pulls in db + auth at import time; both are stubbed so the
// module evaluates without a live Postgres/Redis/Unleash connection. No procedure
// is invoked — the presence assertions only read `_def.procedures`.

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

const US_EXPANSION_NAMESPACES = ['form1042s.', 'taxForm.'];

function namespacePresent(procedures: Record<string, unknown>, prefix: string): boolean {
  return Object.keys(procedures).some(path => path.startsWith(prefix));
}

async function loadAppRouter(): Promise<{ procedures: Record<string, unknown> }> {
  vi.resetModules();
  const { appRouter } = await import('../../../root');
  return { procedures: appRouter._def.procedures as Record<string, unknown> };
}

describe('form 1042-S flag-off — load-time router registration', () => {
  let savedQaOrg: string | undefined;

  beforeEach(() => {
    savedQaOrg = process.env.QA_DEFAULT_ORG_ID;
  });

  afterEach(() => {
    if (savedQaOrg === undefined) delete process.env.QA_DEFAULT_ORG_ID;
    else process.env.QA_DEFAULT_ORG_ID = savedQaOrg;
    vi.resetModules();
  });

  it('omits form1042s.* from appRouter when the us-expansion flag is OFF', async () => {
    delete process.env.QA_DEFAULT_ORG_ID;
    const { procedures } = await loadAppRouter();

    for (const prefix of US_EXPANSION_NAMESPACES) {
      expect(namespacePresent(procedures, prefix)).toBe(false);
    }
  });

  it('mounts form1042s.* in appRouter when the us-expansion flag is ON', async () => {
    process.env.QA_DEFAULT_ORG_ID = 'qa-walk-org';
    const { procedures } = await loadAppRouter();

    for (const prefix of US_EXPANSION_NAMESPACES) {
      expect(namespacePresent(procedures, prefix)).toBe(true);
    }
  });
});
