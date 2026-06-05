// Drift guard — the backstop named in the plan's risk section.
//
// Walks EVERY mutation in the live `appRouter` and `portalAppRouter` and proves
// the demo guard blocks it under global `DEMO_MODE`. A future leaf procedure
// added on a raw, un-anchored `publicProcedure` (bypassing `authedProcedure` /
// `portalProcedure`) would escape the guard — and this test would catch it.
//
// The only intentionally-unguarded mutations are the portal's pre-auth public
// endpoints (magic-link request/verify, org select); they are documented in
// PORTAL_PUBLIC_ALLOWLIST below and asserted to be exactly that set.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHasPermission, validatePortalSession, mockPrisma } = vi.hoisted(() => {
  // Turn on global DEMO_MODE before any module loads. vitest injects a full
  // server env (vitest.config.ts), so `getServerEnv()` parses these flags into
  // the cache at first read (stripe-client at import) — the demo guard then
  // sees DEMO_MODE=true. Set here (pre-import) rather than via a getServerEnv
  // mock so stripe-client / billing-service still init from the real test env.
  process.env.DEMO_MODE = 'true';
  process.env.DEMO_ORG_IDS = 'org_demo';
  return {
    mockHasPermission: vi.fn().mockResolvedValue({ success: true }),
    validatePortalSession: vi.fn(),
    mockPrisma: {
      organization: {
        findUnique: vi.fn(async () => ({ id: 'org_demo', dataRegion: 'EU', status: 'ACTIVE' })),
        findFirst: vi.fn(async () => null),
      },
    },
  };
});

vi.mock('../../services/portal-session', () => ({ validatePortalSession }));

vi.mock('@contractor-ops/auth', () => ({
  auth: { api: { getSession: vi.fn(), hasPermission: mockHasPermission } },
  authApi: { hasPermission: mockHasPermission, getFullOrganization: vi.fn(async () => ({})) },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
  tenantStore: {
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
}));

// `@contractor-ops/logger` + `@contractor-ops/logger/metrics` are mocked
// globally by ./src/__tests__/setup-logger-mock.ts (a setupFile).

vi.mock('@contractor-ops/feature-flags', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const enabledBag = {
    values: { 'module.classification-engine': true },
    isEnabled: (key: string) => key === 'module.classification-engine',
  };
  return {
    ...actual,
    buildFlagBag: vi.fn(() => enabledBag),
    lazyFlagBag: vi.fn(() => enabledBag),
    evaluate: vi.fn((key: string) =>
      key === 'module.classification-engine'
        ? { enabled: true, reason: 'mocked' }
        : { enabled: false, reason: 'mocked' },
    ),
  };
});

import { createCallerFactory } from '../../init';
import { appRouter } from '../../root';
import { portalAppRouter } from '../../portal-root';

// Intentionally-public portal mutations (pre-auth, on `portalPublicProcedure`).
// These are NOT demo-guarded by design — magic-link login must work in a demo.
const PORTAL_PUBLIC_ALLOWLIST = new Set([
  'portal.requestMagicLink',
  'portal.verifyMagicLink',
  'portal.selectOrg',
]);

type AnyProc = { _def?: { type?: string; mutation?: boolean } };

function mutationPaths(router: { _def: { procedures: Record<string, AnyProc> } }): string[] {
  return Object.entries(router._def.procedures)
    .filter(([, proc]) => proc._def?.type === 'mutation' || proc._def?.mutation === true)
    .map(([path]) => path);
}

function resolve(caller: Record<string, unknown>, path: string): (input?: unknown) => Promise<unknown> {
  const fn = path.split('.').reduce<unknown>((acc, key) => {
    return (acc as Record<string, unknown>)?.[key];
  }, caller);
  return fn as (input?: unknown) => Promise<unknown>;
}

type Outcome = 'demo-blocked' | 'auth-gated' | 'executed';

/**
 * Classifies a mutation call made in a demo context with a deliberately-empty
 * input. The demo guard and every auth gate run BEFORE input parsing / the
 * handler, so:
 *   - `demo-blocked`: FORBIDDEN + `demoReadOnly` — the guard fired.
 *   - `auth-gated`:   UNAUTHORIZED — an upstream auth gate (e.g. a portal-cookie
 *                     or cron-secret procedure reachable from this router) ran
 *                     first, so the handler provably did NOT execute either.
 *   - `executed`:     anything else (resolved, or BAD_REQUEST/INTERNAL/… from
 *                     input parsing or the handler) — the call passed all
 *                     middleware, meaning NO demo guard stopped it. This is the
 *                     drift signal: a leaf added on a raw `publicProcedure`
 *                     would land here.
 */
async function classify(fn: () => Promise<unknown>): Promise<Outcome> {
  try {
    await fn();
    return 'executed';
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === 'FORBIDDEN' && err.message === 'demoReadOnly') return 'demo-blocked';
    if (err.code === 'UNAUTHORIZED') return 'auth-gated';
    return 'executed';
  }
}

const staffCaller = createCallerFactory(appRouter)({
  headers: new Headers(),
  session: { session: { activeOrganizationId: 'org_demo' } },
  user: { id: 'u1', banned: false },
} as never);

function portalHeaders() {
  const h = new Headers();
  h.set('cookie', 'portal_session=tok');
  return h;
}
const portalCaller = createCallerFactory(portalAppRouter)({
  headers: portalHeaders(),
  session: null,
  user: null,
} as never);

beforeEach(() => {
  validatePortalSession.mockReset();
  validatePortalSession.mockResolvedValue({
    id: 'ps1',
    contractorId: 'contractor_1',
    organizationId: 'org_demo',
    email: 'c@example.com',
    expiresAt: new Date('2099-01-01'),
    contractor: { id: 'contractor_1', status: 'ACTIVE', name: 'Contractor' },
  });
});

describe('demo drift guard — appRouter', () => {
  it('finds a non-trivial set of mutations to check', () => {
    expect(mutationPaths(appRouter).length).toBeGreaterThan(20);
  });

  it('lets no staff mutation execute under global DEMO_MODE', async () => {
    const caller = staffCaller as unknown as Record<string, unknown>;
    const executed: string[] = [];
    let demoBlocked = 0;
    for (const path of mutationPaths(appRouter)) {
      const outcome = await classify(() => resolve(caller, path)(undefined));
      if (outcome === 'executed') executed.push(path);
      if (outcome === 'demo-blocked') demoBlocked += 1;
    }
    // No mutation reaches its handler in a demo context…
    expect(executed).toEqual([]);
    // …and the guard (not just auth gates) accounts for the overwhelming
    // majority — proves the assertion isn't passing trivially via UNAUTHORIZED.
    expect(demoBlocked).toBeGreaterThan(20);
  });
});

describe('demo drift guard — portalAppRouter', () => {
  it('blocks every portal mutation under DEMO_MODE except the documented public allowlist', async () => {
    const caller = portalCaller as unknown as Record<string, unknown>;
    const escaped: string[] = [];
    for (const path of mutationPaths(portalAppRouter)) {
      if (PORTAL_PUBLIC_ALLOWLIST.has(path)) continue;
      const outcome = await classify(() => resolve(caller, path)(undefined));
      if (outcome !== 'demo-blocked') escaped.push(path);
    }
    expect(escaped).toEqual([]);
  });

  it('the public allowlist entries are real portal mutations', () => {
    const all = new Set(mutationPaths(portalAppRouter));
    for (const path of PORTAL_PUBLIC_ALLOWLIST) {
      expect(all.has(path)).toBe(true);
    }
  });
});
