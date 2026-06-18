/**
 * Regression lock for the contractor create duplicate race (F5).
 *
 * Two concurrent `contractor.create` calls can both pass any application-level
 * dedup and hit the `@@unique([organizationId, taxId])` constraint. The loser's
 * insert raises a Prisma P2002, which must surface as a clean tRPC `CONFLICT`
 * — not an unhandled `INTERNAL_SERVER_ERROR`.
 *
 * Technique mirrors `apps/cron-worker/src/__tests__/trial-notifications.test.ts`:
 * the typed catch is `'code' in err && err.code === 'P2002'`, so the mock must
 * reject with a REAL `PrismaClientKnownRequestError` (a plain `{ code: 'P2002' }`
 * also satisfies the structural guard, but the real error exercises the path a
 * live driver would take).
 */

import { Prisma } from '@contractor-ops/db/generated/prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'org-00000000-0000-0000-0000-000000000001';
const USER_ID = 'user-00000000-0000-0000-0000-000000000001';

const { mockPrisma, contractorCreate } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const orgRecord: Rec = {
    id: 'org-00000000-0000-0000-0000-000000000001',
    dataRegion: 'EU',
    status: 'ACTIVE',
    name: 'Org',
    slug: 'org',
    logo: null,
    countryCode: 'GB',
  };

  const contractorCreate = vi.fn(async (a: { data: Rec }) => ({
    id: 'contractor-1',
    displayName: 'Acme Ltd',
    legalName: 'Acme Ltd',
    countryCode: 'GB',
    status: 'ACTIVE',
    lifecycleStage: 'DRAFT',
    ...a.data,
  }));

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn(async () => orgRecord),
      findFirst: vi.fn(async () => orgRecord),
    },
    contractor: {
      create: contractorCreate,
      count: vi.fn(async () => 1),
    },
    contractorBillingProfile: {
      create: vi.fn(async (a: { data: Rec }) => ({ id: 'bp-1', ...a.data })),
    },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma, contractorCreate };
});

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
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
  tenantStore: { run: (_ctx: unknown, fn: () => unknown) => fn(), getStore: vi.fn() },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
  preWarmRegionalClients: vi.fn(),
}));

vi.mock('../../services/bank-account-crypto', () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock('../../services/sanitize', () => ({ sanitizeStrings: vi.fn(<T>(v: T) => v) }));

vi.mock('../../services/billing-service', () => ({
  syncSeatCountForOrg: vi.fn(async () => undefined),
}));

vi.mock('../../services/cache', () => ({
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: { dashboardPrefix: (orgId: string) => `dashboard:${orgId}` },
}));

vi.mock('../../services/posthog', () => ({ captureEvent: vi.fn(async () => undefined) }));

vi.mock('../../services/audit-writer', () => ({
  writeAuditLog: vi.fn(async () => undefined),
  writeAuditLogMany: vi.fn(async () => undefined),
}));

vi.mock('../../services/org-cache', () => ({
  getOrgMeta: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })),
  invalidateOrgBranding: vi.fn(),
  invalidateOrgMeta: vi.fn(),
}));

import { createCallerFactory } from '../../init';
import { appRouter } from '../../root';

const createCaller = createCallerFactory(appRouter);

function makeCaller() {
  const session = {
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
    user: {
      id: USER_ID,
      name: 'User',
      email: 'user@example.com',
      emailVerified: true,
      image: null,
      banned: false,
      banReason: null,
      banExpires: null,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
  return createCaller({
    headers: new Headers(),
    session: session as never,
    user: session.user as never,
  });
}

const validInput = {
  legalName: 'Acme Ltd',
  displayName: 'Acme Ltd',
  type: 'COMPANY' as const,
  taxId: 'GB123456789',
  email: 'acme@example.com',
  countryCode: 'GB',
  currency: 'GBP',
  bankAccount: '',
  billingModel: 'HOURLY',
  rateValueMinor: 10000,
  ownerUserId: USER_ID,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockPrisma),
  );
});

describe('contractor.create duplicate taxId race (F5)', () => {
  it('surfaces CONFLICT (not 500) when the unique constraint raises P2002', async () => {
    contractorCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.8.0',
        meta: { target: ['organizationId', 'taxId'] },
      }),
    );

    const caller = makeCaller();

    await expect(caller.contractor.create(validInput)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('a non-P2002 Prisma error is not swallowed as CONFLICT', async () => {
    contractorCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '7.8.0',
      }),
    );

    const caller = makeCaller();

    await expect(caller.contractor.create(validInput)).rejects.not.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('a successful create still returns the contractor', async () => {
    const caller = makeCaller();

    const result = await caller.contractor.create(validInput);

    expect(result.id).toBe('contractor-1');
    expect(contractorCreate).toHaveBeenCalledTimes(1);
  });
});
