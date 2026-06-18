/**
 * Privilege-escalation regression tests for `user.updateRole`.
 *
 * `requirePermission({ member: ['update'] })` alone does NOT enforce a role
 * hierarchy, and Better Auth's `updateMemberRole` blocks only the owner
 * transition. A non-admin holder of `member:['update']` (e.g. the seeded
 * `it_admin`) could therefore assign `admin` — including to itself — gaining
 * payment:export, compliance:override and contractor:delete.
 *
 * These tests pin the privilege ceiling: only owner/admin may grant `admin`,
 * and a sub-admin caller is rejected with FORBIDDEN.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const CALLER_USER_ID = 'clcaller00000000000000001';
const TARGET_USER_ID = 'cltarget0000000000000001';
const MEMBER_ID = 'clmember0000000000000001';

const { roleAuthApi } = vi.hoisted(() => ({
  roleAuthApi: {
    getSession: vi.fn(),
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
    getFullOrganization: vi.fn(),
    updateMemberRole: vi.fn(async () => ({ id: 'clmember0000000000000001' })),
  },
}));

const { mockPrisma } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;
  const mockPrisma: Rec = {
    auditLog: {
      create: vi.fn(async () => ({ id: 'audit-mock' })),
      createMany: vi.fn(async () => ({ count: 1 })),
    },
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    member: {
      // Target lookup (findFirstOrThrow) + caller lookup (findFirst) are
      // configured per-test in beforeEach / individual cases.
      findFirstOrThrow: vi.fn(async () => ({ id: MEMBER_ID, role: 'readonly' })),
      findFirst: vi.fn(async () => ({ role: 'admin' })),
      count: vi.fn(async () => 2),
      update: vi.fn(async () => ({ id: 'member-mock' })),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };
  return { mockPrisma };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: { api: roleAuthApi },
  authApi: roleAuthApi,
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

vi.mock('../../services/org-cache', () => ({
  getOrgMeta: vi.fn(async (orgId: string) => ({
    id: orgId,
    dataRegion: 'EU',
    status: 'ACTIVE',
    name: 'Test Org',
  })),
  invalidateOrgMeta: vi.fn(async () => undefined),
  ORG_META_TTL_SECONDS: 300,
  orgMetaKey: (orgId: string) => `org:${orgId}:meta`,
}));

vi.mock('@contractor-ops/logger', () => ({
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
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
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

import { auth } from '@contractor-ops/auth';
import { createCallerFactory } from '../../init';
import { appRouter } from '../../root';

const createCaller = createCallerFactory(appRouter);

function makeCaller(userId: string, orgId: string) {
  const session = {
    session: {
      id: `session-${userId}`,
      userId,
      activeOrganizationId: orgId,
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(), // fresh session so sensitiveActionProcedure does not demand re-auth
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: userId,
      name: 'Test User',
      email: `${userId}@example.com`,
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

const caller = makeCaller(CALLER_USER_ID, ORG_ID);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.api.hasPermission).mockResolvedValue({ success: true } as never);
  mockPrisma.member.findFirstOrThrow.mockResolvedValue({ id: MEMBER_ID, role: 'readonly' });
});

describe('user.updateRole — privilege escalation', () => {
  it('rejects a non-admin caller (it_admin) granting admin with FORBIDDEN', async () => {
    // Caller holds member:['update'] (it_admin) but is not owner/admin.
    mockPrisma.member.findFirst.mockResolvedValue({ role: 'it_admin' });

    await expect(
      caller.user.updateRole({ userId: TARGET_USER_ID, role: 'admin' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'permissionDenied' });

    // Escalation must never reach Better Auth.
    expect(auth.api.updateMemberRole).not.toHaveBeenCalled();
  });

  it('rejects a non-admin caller escalating itself to admin with FORBIDDEN', async () => {
    mockPrisma.member.findFirstOrThrow.mockResolvedValue({ id: MEMBER_ID, role: 'it_admin' });
    mockPrisma.member.findFirst.mockResolvedValue({ role: 'it_admin' });

    await expect(
      caller.user.updateRole({ userId: CALLER_USER_ID, role: 'admin' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'permissionDenied' });
    expect(auth.api.updateMemberRole).not.toHaveBeenCalled();
  });

  it('allows an admin caller to grant admin', async () => {
    mockPrisma.member.findFirst.mockResolvedValue({ role: 'admin' });

    await caller.user.updateRole({ userId: TARGET_USER_ID, role: 'admin' });

    expect(auth.api.updateMemberRole).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { memberId: MEMBER_ID, role: 'admin', organizationId: ORG_ID },
      }),
    );
  });

  it('allows an owner caller to grant admin', async () => {
    mockPrisma.member.findFirst.mockResolvedValue({ role: 'owner' });

    await caller.user.updateRole({ userId: TARGET_USER_ID, role: 'admin' });

    expect(auth.api.updateMemberRole).toHaveBeenCalledTimes(1);
  });

  it('allows a non-admin caller to grant a non-privileged role', async () => {
    // it_admin assigning readonly is fine — the ceiling only guards
    // privileged target roles (owner/admin).
    mockPrisma.member.findFirst.mockResolvedValue({ role: 'it_admin' });

    await caller.user.updateRole({ userId: TARGET_USER_ID, role: 'readonly' });

    expect(auth.api.updateMemberRole).toHaveBeenCalledTimes(1);
    // No caller-role lookup is needed for non-privileged roles.
    expect(mockPrisma.member.findFirst).not.toHaveBeenCalled();
  });
});
