/**
 * Phase 74 Plan 05 — Auto-selection cases for workflowRoles.selectForContractor.
 *
 * Drives the real `workflowRolesRouter.selectForContractor` query through a
 * tRPC caller (createCallerFactory) so the assertions exercise the router's
 * own branch logic and Prisma WHERE clauses — not a re-implementation in the
 * test.
 */

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Prisma via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, ORG_ID, USER_ID, CONTRACTOR_ID } = vi.hoisted(() => {
  const ORG_ID = 'org-tpl-selection-001';
  const USER_ID = 'user-tpl-selection-001';
  const CONTRACTOR_ID = 'contractor-tpl-001';
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    contractor: {
      findFirstOrThrow: vi.fn(),
    },
    workflowRoleTemplate: {
      findFirstOrThrow: vi.fn(),
    },
    member: {
      findFirst: vi.fn().mockResolvedValue({ role: 'admin', userId: USER_ID }),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma, ORG_ID, USER_ID, CONTRACTOR_ID };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: vi.fn().mockResolvedValue({ success: true }),
    },
  },
  authApi: {
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
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

// The roles router imports Prisma from the generated client for the
// `Prisma.JsonNull` sentinel (unused on the selectForContractor path).
vi.mock('@contractor-ops/db/generated/prisma/client', () => ({
  Prisma: { JsonNull: Symbol('JsonNull') },
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
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
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
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init';
import { workflowRolesRouter } from '../workflow/workflow-roles';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(workflowRolesRouter);

function makeCaller(userId = USER_ID, orgId = ORG_ID) {
  const session = {
    session: {
      id: `session-${userId}`,
      userId,
      activeOrganizationId: orgId,
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(),
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

const caller = makeCaller();

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockPrisma),
  );
});

describe('workflowRoles.selectForContractor — D-02 + D-03 template auto-selection', () => {
  it('auto-selects template by Contractor.workflowRoleId', async () => {
    mockPrisma.contractor.findFirstOrThrow.mockResolvedValueOnce({
      workflowRoleId: 'tmpl-software-engineer',
    });

    const result = await caller.selectForContractor({ contractorId: CONTRACTOR_ID });

    expect(result).toEqual({
      templateId: 'tmpl-software-engineer',
      source: 'contractor_role_id',
    });

    // Contractor lookup is org-scoped.
    const contractorCall = mockPrisma.contractor.findFirstOrThrow.mock.calls[0]?.[0];
    expect(contractorCall.where).toMatchObject({ id: CONTRACTOR_ID, organizationId: ORG_ID });

    // Generic-consultant fallback must NOT run when the contractor has a role.
    expect(mockPrisma.workflowRoleTemplate.findFirstOrThrow).not.toHaveBeenCalled();
  });

  it('falls back to generic_consultant when workflowRoleId is NULL', async () => {
    mockPrisma.contractor.findFirstOrThrow.mockResolvedValueOnce({ workflowRoleId: null });
    mockPrisma.workflowRoleTemplate.findFirstOrThrow.mockResolvedValueOnce({
      id: 'seed-generic-consultant',
    });

    const result = await caller.selectForContractor({ contractorId: CONTRACTOR_ID });

    expect(result).toEqual({
      templateId: 'seed-generic-consultant',
      source: 'fallback_generic_consultant',
    });

    // Fallback uses the seed generic_consultant row scoped to the org.
    const fallbackCall = mockPrisma.workflowRoleTemplate.findFirstOrThrow.mock.calls[0]?.[0];
    expect(fallbackCall.where).toMatchObject({
      organizationId: ORG_ID,
      role: 'generic_consultant',
      isSeed: true,
    });
  });

  it('propagates NOT_FOUND when the contractor does not exist (findFirstOrThrow)', async () => {
    mockPrisma.contractor.findFirstOrThrow.mockRejectedValueOnce(
      Object.assign(new Error('No Contractor found'), { code: 'P2025' }),
    );

    await expect(
      caller.selectForContractor({ contractorId: 'nonexistent' }),
    ).rejects.toBeInstanceOf(Error);

    expect(mockPrisma.workflowRoleTemplate.findFirstOrThrow).not.toHaveBeenCalled();
  });

  it('rejects empty contractorId at the Zod boundary', async () => {
    await expect(caller.selectForContractor({ contractorId: '' })).rejects.toBeInstanceOf(
      TRPCError,
    );

    expect(mockPrisma.contractor.findFirstOrThrow).not.toHaveBeenCalled();
  });
});
