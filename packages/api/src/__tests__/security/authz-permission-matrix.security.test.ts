/**
 * RBAC permission-gate regression tests.
 *
 * Asserts the `requirePermission` middleware DENIES callers that lack the
 * permission, for both auth modes, and ALLOWS when the permission/scope is
 * present:
 *   - session auth → Better Auth `hasPermission` returns { success: false } → FORBIDDEN
 *   - API-key auth → required scope absent from ctx.apiKeyScopes        → FORBIDDEN
 *
 * The gate is driven through a minimal router (not the full appRouter) so the
 * surface under test is the authorization check itself, and the API-key branch
 * additionally exercises `permissionToScopes` (the Permission→scope-string
 * mapping flagged as unverified during the security audit).
 *
 * Also exercises the real exported `adminProcedure` (auth → tenant → rbac chain)
 * to prove the wiring, not just the isolated middleware.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHasPermission, mockGetOrgMeta, mockPrisma } = vi.hoisted(() => ({
  mockHasPermission: vi.fn(),
  mockGetOrgMeta: vi.fn(),
  mockPrisma: {
    organization: {
      findUnique: vi.fn(async () => ({ id: 'org', dataRegion: 'EU', status: 'ACTIVE' })),
    },
  },
}));

vi.mock('@contractor-ops/auth', () => ({
  auth: { api: { getSession: vi.fn(), hasPermission: mockHasPermission } },
  authApi: {
    getSession: vi.fn(),
    hasPermission: mockHasPermission,
    getFullOrganization: vi.fn(),
  },
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
  withRlsReads: <T>(c: T) => c,
  withRlsTransactions: <T>(c: T) => c,
  tenantStore: { run: (_ctx: unknown, fn: () => unknown) => fn(), getStore: vi.fn() },
  getRegionalClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  createTenantClient: vi.fn(() => mockPrisma),
  preWarmRegionalClients: vi.fn(),
}));

vi.mock('../../services/org-cache', () => ({
  getOrgMeta: mockGetOrgMeta,
  invalidateOrgMeta: vi.fn(),
  invalidateOrgBranding: vi.fn(),
}));

import { t } from '../../init';
import { adminProcedure, requirePermission } from '../../middleware/rbac';

const ORG_ID = 'org-a-00000000-0000-0000-0000-000000000001';
const USER_ID = 'user-a-00000000-0000-0000-0000-000000000001';

// Minimal router: a single procedure guarded only by requirePermission, so the
// session/api-key branches are exercised in isolation, plus the real adminProcedure.
const router = t.router({
  needsContractorRead: t.procedure
    .use(requirePermission({ contractor: ['read'] }))
    .query(() => 'ok'),
  adminOnly: adminProcedure.query(() => 'ok'),
});
const createCaller = t.createCallerFactory(router);

type CtxShape = Parameters<typeof createCaller>[0];

function sessionCtx(): CtxShape {
  return {
    headers: new Headers(),
    session: {
      session: {
        id: `session-${USER_ID}`,
        userId: USER_ID,
        activeOrganizationId: ORG_ID,
        expiresAt: new Date('2099-01-01'),
        token: 'mock-token',
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
      },
      user: { id: USER_ID, role: 'admin', banned: false },
    },
    user: { id: USER_ID, role: 'admin', banned: false, emailVerified: true },
  } as never;
}

function apiKeyCtx(scopes: string[]): CtxShape {
  return {
    headers: new Headers(),
    session: null,
    user: null,
    authMode: 'apiKey',
    apiKeyId: 'key-1',
    apiKeyScopes: scopes,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrgMeta.mockResolvedValue({ dataRegion: 'EU', status: 'ACTIVE' });
});

describe('requirePermission — session auth', () => {
  it('denies with FORBIDDEN when Better Auth reports no permission', async () => {
    mockHasPermission.mockResolvedValue({ success: false });
    const caller = createCaller(sessionCtx());
    await expect(caller.needsContractorRead()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows when Better Auth grants the permission', async () => {
    mockHasPermission.mockResolvedValue({ success: true });
    const caller = createCaller(sessionCtx());
    await expect(caller.needsContractorRead()).resolves.toBe('ok');
  });

  it('forwards the exact required permission to Better Auth', async () => {
    mockHasPermission.mockResolvedValue({ success: true });
    await createCaller(sessionCtx()).needsContractorRead();
    expect(mockHasPermission).toHaveBeenCalledWith(
      expect.objectContaining({ body: { permissions: { contractor: ['read'] } } }),
    );
  });
});

describe('requirePermission — API-key auth (scope mapping)', () => {
  it('denies with FORBIDDEN when the mapped scope is absent', async () => {
    const caller = createCaller(apiKeyCtx([]));
    await expect(caller.needsContractorRead()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('denies when only an unrelated scope is granted', async () => {
    const caller = createCaller(apiKeyCtx(['invoice:read']));
    await expect(caller.needsContractorRead()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows when the mapped contractor:read scope is granted', async () => {
    const caller = createCaller(apiKeyCtx(['contractor:read']));
    await expect(caller.needsContractorRead()).resolves.toBe('ok');
  });

  it('never consults Better Auth on the API-key path', async () => {
    await createCaller(apiKeyCtx(['contractor:read'])).needsContractorRead();
    expect(mockHasPermission).not.toHaveBeenCalled();
  });

  it('denies an API-key context missing id/scopes entirely', async () => {
    const caller = createCaller({
      headers: new Headers(),
      session: null,
      user: null,
      authMode: 'apiKey',
    } as never);
    await expect(caller.needsContractorRead()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('adminProcedure — full auth → tenant → rbac chain', () => {
  it('rejects unauthenticated callers with UNAUTHORIZED', async () => {
    const caller = createCaller({ headers: new Headers(), session: null, user: null } as never);
    await expect(caller.adminOnly()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects a non-admin (organization.update denied) with FORBIDDEN', async () => {
    mockHasPermission.mockResolvedValue({ success: false });
    const caller = createCaller(sessionCtx());
    await expect(caller.adminOnly()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows when organization.update is granted', async () => {
    mockHasPermission.mockResolvedValue({ success: true });
    const caller = createCaller(sessionCtx());
    await expect(caller.adminOnly()).resolves.toBe('ok');
  });

  it('rejects when the active organization is suspended (FORBIDDEN before rbac)', async () => {
    mockHasPermission.mockResolvedValue({ success: true });
    mockGetOrgMeta.mockResolvedValue({ dataRegion: 'EU', status: 'SUSPENDED' });
    const caller = createCaller(sessionCtx());
    await expect(caller.adminOnly()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
