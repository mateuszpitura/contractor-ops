/**
 * Tenant-status admission control.
 *
 * `tenantMiddleware` resolves the active org's meta via `getOrgMeta` and rejects
 * anything that is not ACTIVE (`loadAndAssertActive` → FORBIDDEN / ORG_SUSPENDED).
 * The sibling tenant tests always seed `status: 'ACTIVE'`, so the rejection path
 * itself was unguarded. This suite drives the REAL `tenantProcedure` through the
 * admission gate for every org-status outcome:
 *
 *   - ACTIVE                → resolves
 *   - SUSPENDED / ARCHIVED  → FORBIDDEN (org admission denied)
 *   - org meta missing      → FORBIDDEN (fail-closed)
 *   - no active org in sess. → FORBIDDEN (TENANT_NO_ACTIVE_ORGANIZATION)
 *   - no session            → UNAUTHORIZED (auth gate before tenant gate)
 *
 * Mocked Prisma/auth so the surface under test is the admission middleware, not
 * the data layer.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetOrgMeta, mockPrisma } = vi.hoisted(() => ({
  mockGetOrgMeta: vi.fn(),
  mockPrisma: {
    organization: {
      findUnique: vi.fn(async () => ({ id: 'org', dataRegion: 'EU', status: 'ACTIVE' })),
    },
  },
}));

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: { getSession: vi.fn(), hasPermission: vi.fn().mockResolvedValue({ success: true }) },
  },
  authApi: {
    getSession: vi.fn(),
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
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
import { tenantProcedure } from '../../middleware/tenant';

const ORG_ID = 'org-a-00000000-0000-0000-0000-000000000001';
const USER_ID = 'user-a-00000000-0000-0000-0000-000000000001';

const router = t.router({
  ping: tenantProcedure.query(() => 'ok'),
});
const createCaller = t.createCallerFactory(router);
type CtxShape = Parameters<typeof createCaller>[0];

function sessionCtx(activeOrganizationId: string | null = ORG_ID): CtxShape {
  return {
    headers: new Headers(),
    session: {
      session: {
        id: `session-${USER_ID}`,
        userId: USER_ID,
        activeOrganizationId,
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

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrgMeta.mockResolvedValue({ dataRegion: 'EU', status: 'ACTIVE' });
});

describe('tenant admission — org status gate', () => {
  it('resolves when the active org is ACTIVE', async () => {
    mockGetOrgMeta.mockResolvedValue({ dataRegion: 'EU', status: 'ACTIVE' });
    await expect(createCaller(sessionCtx()).ping()).resolves.toBe('ok');
  });

  it('rejects a SUSPENDED org with FORBIDDEN', async () => {
    mockGetOrgMeta.mockResolvedValue({ dataRegion: 'EU', status: 'SUSPENDED' });
    await expect(createCaller(sessionCtx()).ping()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects an ARCHIVED org with FORBIDDEN', async () => {
    mockGetOrgMeta.mockResolvedValue({ dataRegion: 'EU', status: 'ARCHIVED' });
    await expect(createCaller(sessionCtx()).ping()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('fails closed (FORBIDDEN) when org meta cannot be resolved', async () => {
    mockGetOrgMeta.mockResolvedValue(null);
    await expect(createCaller(sessionCtx()).ping()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('does not consult org status for a session with no active organization', async () => {
    await expect(createCaller(sessionCtx(null)).ping()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(mockGetOrgMeta).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated caller with UNAUTHORIZED (auth gate precedes tenant gate)', async () => {
    const caller = createCaller({ headers: new Headers(), session: null, user: null } as never);
    await expect(caller.ping()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(mockGetOrgMeta).not.toHaveBeenCalled();
  });
});
