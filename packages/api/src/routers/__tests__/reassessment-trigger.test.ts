// ---------------------------------------------------------------------------
// reassessmentTrigger router tests — Phase 60 CLASS-08.
// ---------------------------------------------------------------------------

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';
const ASSIGN_A = 'clasgnmentaaaaaaaaaaaaaaaa';

type TriggerRow = {
  id: string;
  organizationId: string;
  contractorAssignmentId: string;
  priorAssessmentId: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
  triggerReasons: unknown[];
  dismissedReason: string | null;
};

const { mockPrisma, triggers, mockHasPermission } = vi.hoisted(() => {
  const triggers = new Map<string, TriggerRow>();
  const mockHasPermission = vi.fn().mockResolvedValue({ success: true });
  const mockPrisma = {
    reassessmentTrigger: {
      findMany: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args?.where ?? {};
        return Array.from(triggers.values()).filter(t => {
          if ('organizationId' in where && where.organizationId !== t.organizationId) return false;
          if (
            'contractorAssignmentId' in where &&
            where.contractorAssignmentId !== t.contractorAssignmentId
          )
            return false;
          const statusIn = (where as { status?: { in?: string[] } }).status?.in;
          if (statusIn && !statusIn.includes(t.status)) return false;
          return true;
        });
      }),
      findFirst: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args?.where ?? {};
        return (
          Array.from(triggers.values()).find(t => {
            if ('organizationId' in where && where.organizationId !== t.organizationId)
              return false;
            if ('id' in where && where.id !== t.id) return false;
            return true;
          }) ?? null
        );
      }),
      update: vi.fn(async (args: { where: { id: string }; data: Partial<TriggerRow> }) => {
        const row = triggers.get(args.where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, args.data);
        return row;
      }),
    },
    organization: {
      findUnique: vi.fn(async () => ({ dataRegion: 'EU' })),
    },
  };
  return { mockPrisma, triggers, mockHasPermission };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: mockHasPermission,
    },
  },
  authApi: {
    hasPermission: mockHasPermission,
  },
}));

vi.mock('@contractor-ops/db', () => ({
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

vi.mock('@contractor-ops/logger', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), gauge: vi.fn(), distribution: vi.fn() },
}));

import { createCallerFactory } from '../../init.js';
import { appRouter } from '../../root.js';

const createCaller = createCallerFactory(appRouter);

function makeCaller(orgId = ORG_A, userId = USER_ID) {
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

function seed() {
  triggers.clear();
  triggers.set('rt-1', {
    id: 'rt-1',
    organizationId: ORG_A,
    contractorAssignmentId: ASSIGN_A,
    priorAssessmentId: 'assess-1',
    status: 'OPEN',
    triggerReasons: [{ field: 'activeTo', auditLogId: 'aud-1', resourceType: 'CONTRACTOR' }],
    dismissedReason: null,
  });
  triggers.set('rt-2', {
    id: 'rt-2',
    organizationId: ORG_A,
    contractorAssignmentId: ASSIGN_A,
    priorAssessmentId: 'assess-1',
    status: 'RESOLVED',
    triggerReasons: [],
    dismissedReason: null,
  });
}

beforeEach(() => {
  mockHasPermission.mockResolvedValue({ success: true });
  seed();
});

describe('reassessmentTrigger.list (60-02-07)', () => {
  it('filters by status when provided', async () => {
    const caller = makeCaller(ORG_A);
    await caller.reassessmentTrigger.list({ limit: 50, status: 'OPEN' });
    const args = mockPrisma.reassessmentTrigger.findMany.mock.calls.at(-1)?.[0];
    expect(args?.where?.status).toBe('OPEN');
  });

  it('is rejected with FORBIDDEN when contractor:read is denied', async () => {
    mockHasPermission.mockResolvedValue({ success: false });
    const caller = makeCaller(ORG_A);
    await expect(caller.reassessmentTrigger.list({ limit: 50 })).rejects.toBeInstanceOf(TRPCError);
  });
});

describe('reassessmentTrigger.listByEngagement', () => {
  it('calls findMany with the assignment id', async () => {
    const caller = makeCaller(ORG_A);
    await caller.reassessmentTrigger.listByEngagement({ contractorAssignmentId: ASSIGN_A });
    const args = mockPrisma.reassessmentTrigger.findMany.mock.calls.at(-1)?.[0];
    expect(args?.where?.contractorAssignmentId).toBe(ASSIGN_A);
  });
});

describe('reassessmentTrigger.acknowledge (60-02-06)', () => {
  it('transitions an OPEN trigger to ACKNOWLEDGED', async () => {
    const caller = makeCaller(ORG_A);
    await caller.reassessmentTrigger.acknowledge({ id: 'rt-1' });
    expect(triggers.get('rt-1')?.status).toBe('ACKNOWLEDGED');
  });

  it('is rejected with FORBIDDEN without contractor:update', async () => {
    mockHasPermission.mockResolvedValue({ success: false });
    const caller = makeCaller(ORG_A);
    await expect(caller.reassessmentTrigger.acknowledge({ id: 'rt-1' })).rejects.toBeInstanceOf(
      TRPCError,
    );
  });
});

describe('reassessmentTrigger.dismiss', () => {
  it('requires a reason of at least 10 characters', async () => {
    const caller = makeCaller(ORG_A);
    await expect(
      caller.reassessmentTrigger.dismiss({ id: 'rt-1', reason: 'short' }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('dismisses an OPEN trigger with a valid reason', async () => {
    const caller = makeCaller(ORG_A);
    await caller.reassessmentTrigger.dismiss({
      id: 'rt-1',
      reason: 'Change is not material to classification after review',
    });
    expect(triggers.get('rt-1')?.status).toBe('DISMISSED');
    expect(triggers.get('rt-1')?.dismissedReason).toContain('material');
  });

  it('rejects dismiss on RESOLVED trigger (invalid transition)', async () => {
    const caller = makeCaller(ORG_A);
    await expect(
      caller.reassessmentTrigger.dismiss({
        id: 'rt-2',
        reason: 'Explaining why I cannot dismiss this one',
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});
