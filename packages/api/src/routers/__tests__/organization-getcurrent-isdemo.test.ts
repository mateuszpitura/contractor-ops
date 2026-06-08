// Step 7 — `organization.getCurrent` exposes an env-driven `isDemo` boolean that
// drives the web-vite DEMO banner. DEMO_ORG_IDS is set before imports so the
// cached server env carries it.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHasPermission, getFullOrganization, mockPrisma } = vi.hoisted(() => {
  process.env.DEMO_MODE = '';
  process.env.DEMO_ORG_IDS = 'org_demo';
  return {
    mockHasPermission: vi.fn().mockResolvedValue({ success: true }),
    getFullOrganization: vi.fn(async () => ({ id: 'org', name: 'Acme', slug: 'acme' })),
    mockPrisma: {
      organization: {
        findUnique: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })),
      },
    },
  };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: { api: { getSession: vi.fn(), hasPermission: mockHasPermission } },
  authApi: { hasPermission: mockHasPermission, getFullOrganization },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
  tenantStore: {
    run: (_c: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
}));

import { createCallerFactory } from '../../init';
import { organizationRouter } from '../core/organization';

const createCaller = createCallerFactory(organizationRouter);

function callerFor(orgId: string) {
  const session = {
    session: {
      id: 's1',
      userId: 'u1',
      activeOrganizationId: orgId,
      expiresAt: new Date('2099-01-01'),
      token: 't',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: { id: 'u1', name: 'U', email: 'u@e.com', emailVerified: true, banned: false },
  };
  return createCaller({ headers: new Headers(), session, user: session.user } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('organization.getCurrent isDemo', () => {
  it('is true for an org in DEMO_ORG_IDS', async () => {
    const res = await callerFor('org_demo').getCurrent();
    expect(res?.isDemo).toBe(true);
    expect(res?.name).toBe('Acme');
  });

  it('is false for a non-demo org', async () => {
    const res = await callerFor('org_real').getCurrent();
    expect(res?.isDemo).toBe(false);
  });
});
