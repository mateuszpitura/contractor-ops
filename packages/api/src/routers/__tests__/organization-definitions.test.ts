// Router-level tests for the organizationDefinitions group (team / project /
// cost-center). Exercises:
//   - happy-path create + audit
//   - RBAC deny on missing permission
//   - archive-then-list filtering
//   - cost-center code uniqueness (P2002 → CONFLICT)
//   - CSV import transactional rollback

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const ORG_ID = 'org-orgdef-001';
const USER_ID = 'user-orgdef-001';

const { mockPrisma, mockHasPermission, mockWriteAuditLog, mockWriteAuditLogMany } = vi.hoisted(
  () => {
    type Rec = Record<string, unknown>;
    const orgId = 'org-orgdef-001';

    const mockPrisma: Rec = {
      organization: {
        findUnique: vi.fn().mockResolvedValue({ id: orgId, dataRegion: 'EU', status: 'ACTIVE' }),
      },
      member: {
        findFirst: vi.fn().mockResolvedValue({ role: 'admin' }),
      },
      team: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
      },
      project: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
      },
      costCenter: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
      },
      pendingProjectMerge: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn(),
        delete: vi.fn(),
      },
      projectExternalLink: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
      },
      integrationConnection: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
      auditLog: { create: vi.fn(), createMany: vi.fn(async () => ({ count: 0 })) },
      $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
    };

    return {
      mockPrisma,
      mockHasPermission: vi.fn().mockResolvedValue({ success: true }),
      mockWriteAuditLog: vi.fn(async () => undefined),
      mockWriteAuditLogMany: vi.fn(async () => undefined),
    };
  },
);

vi.mock('@contractor-ops/auth', () => ({
  auth: { api: { getSession: vi.fn(), hasPermission: mockHasPermission } },
  authApi: { hasPermission: mockHasPermission },
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

vi.mock('../../services/audit-writer', () => ({
  writeAuditLog: mockWriteAuditLog,
  writeAuditLogMany: mockWriteAuditLogMany,
}));

vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() })),
  createLogger: vi.fn(() => ({
    info: vi.fn(),

    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
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
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock('@sentry/node', () => ({
  startSpan: vi.fn((_o, fn) => fn({ setStatus: vi.fn(), setAttribute: vi.fn() })),
  captureException: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  setTags: vi.fn(),
  setContext: vi.fn(),
  getCurrentScope: vi.fn(() => ({
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setContext: vi.fn(),
    setExtra: vi.fn(),
    clear: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init';
import { appRouter } from '../../root';

const createCaller = createCallerFactory(appRouter);

function makeCaller(role: 'admin' | 'readonly' = 'admin') {
  mockHasPermission.mockImplementation(
    async ({ body }: { body: { permissions: Record<string, string[]> } }) => {
      if (role === 'admin') return { success: true };
      // Readonly: only the *read* action passes for team/project/costCenter.
      const allRead = Object.entries(body.permissions).every(([, actions]) =>
        (actions as string[]).every(a => a === 'read'),
      );
      return { success: allRead };
    },
  );

  return createCaller({
    headers: new Headers(),
    session: {
      session: {
        id: 'sess-1',
        userId: USER_ID,
        activeOrganizationId: ORG_ID,
        expiresAt: new Date('2099-01-01'),
        token: 't',
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
      },
      user: {
        id: USER_ID,
        name: 'Tester',
        email: 't@test.com',
        emailVerified: true,
        image: null,
        banned: false,
        banReason: null,
        banExpires: null,
        role: role === 'admin' ? 'admin' : 'readonly',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as never,
    user: { id: USER_ID, name: 'Tester', email: 't@test.com' } as never,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('organizationDefinitions.team', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.organization.findUnique = vi.fn().mockResolvedValue({
      id: ORG_ID,
      dataRegion: 'EU',
      status: 'ACTIVE',
    });
    mockPrisma.member.findFirst = vi.fn().mockResolvedValue({ role: 'admin' });
    mockPrisma.team.findFirst = vi.fn();
    mockPrisma.team.findMany = vi.fn().mockResolvedValue([]);
    mockPrisma.team.create = vi.fn();
    mockPrisma.team.update = vi.fn();
  });

  it('create writes the team and an AuditLog row on the happy path', async () => {
    const caller = makeCaller('admin');
    mockPrisma.team.create = vi.fn().mockResolvedValue({
      id: 'team-1',
      name: 'Platform',
      code: null,
      status: 'ACTIVE',
    });

    const result = await caller.organizationDefinitions.team.create({ name: 'Platform' });

    expect(result.id).toBe('team-1');
    expect(mockPrisma.team.create).toHaveBeenCalledTimes(1);
    expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
    const auditArgs = mockWriteAuditLog.mock.calls[0]?.[0];
    expect(auditArgs?.action).toBe('team.create');
    expect(auditArgs?.resourceType).toBe('TEAM');
    expect(auditArgs?.resourceId).toBe('team-1');
  });

  it('create rejects readonly users via the RBAC middleware', async () => {
    const caller = makeCaller('readonly');
    await expect(caller.organizationDefinitions.team.create({ name: 'Platform' })).rejects.toThrow(
      /FORBIDDEN|permission/i,
    );
    expect(mockPrisma.team.create).not.toHaveBeenCalled();
  });

  it('archive flips status to ARCHIVED and audits the old → new diff', async () => {
    const caller = makeCaller('admin');
    const before = { id: 'team-1', name: 'Platform', status: 'ACTIVE' };
    const after = { id: 'team-1', name: 'Platform', status: 'ARCHIVED' };
    mockPrisma.team.findFirst = vi.fn().mockResolvedValue(before);
    mockPrisma.team.update = vi.fn().mockResolvedValue(after);

    await caller.organizationDefinitions.team.archive({ id: 'team-1' });

    expect(mockPrisma.team.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: { status: 'ARCHIVED' },
    });
    const auditArgs = mockWriteAuditLog.mock.calls[0]?.[0];
    expect(auditArgs?.oldValues).toEqual({ status: 'ACTIVE' });
    expect(auditArgs?.newValues).toEqual({ status: 'ARCHIVED' });
  });

  it('list with status: ACTIVE filters out archived rows at the query level', async () => {
    const caller = makeCaller('admin');
    mockPrisma.team.findMany = vi.fn().mockResolvedValue([]);
    await caller.organizationDefinitions.team.list({ status: 'ACTIVE' });
    expect(mockPrisma.team.findMany).toHaveBeenCalledTimes(1);
    const findArgs = mockPrisma.team.findMany.mock.calls[0]?.[0] as {
      where: { status?: string };
    };
    expect(findArgs.where.status).toBe('ACTIVE');
  });
});

describe('organizationDefinitions.costCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.organization.findUnique = vi.fn().mockResolvedValue({
      id: ORG_ID,
      dataRegion: 'EU',
      status: 'ACTIVE',
    });
    mockPrisma.member.findFirst = vi.fn().mockResolvedValue({ role: 'admin' });
    mockPrisma.costCenter.findFirst = vi.fn();
    mockPrisma.costCenter.findMany = vi.fn().mockResolvedValue([]);
    mockPrisma.costCenter.create = vi.fn();
    mockPrisma.$transaction = vi.fn(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma),
    );
  });

  it('importCsv inserts every row in a single transaction', async () => {
    const caller = makeCaller('admin');
    let created = 0;
    mockPrisma.costCenter.create = vi.fn(
      async ({ data }: { data: { name: string; code: string } }) => {
        created++;
        return { id: `cc-${created}`, name: data.name, code: data.code, status: 'ACTIVE' };
      },
    );

    const result = await caller.organizationDefinitions.costCenter.importCsv({
      rows: [
        { name: 'Engineering', code: 'ENG' },
        { name: 'Operations', code: 'OPS' },
      ],
    });

    expect(result).toEqual({ inserted: 2 });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.costCenter.create).toHaveBeenCalledTimes(2);
    expect(mockWriteAuditLogMany).toHaveBeenCalledTimes(1);
    const rows = (mockWriteAuditLogMany.mock.calls[0]?.[0] as { rows: unknown[] }).rows;
    expect(rows).toHaveLength(2);
  });

  it('importCsv translates Prisma P2002 (code unique violation) into a CONFLICT TRPCError', async () => {
    const caller = makeCaller('admin');
    const p2002 = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      meta: { target: ['organizationId', 'code'] },
    });
    mockPrisma.$transaction = vi.fn(async () => {
      throw p2002;
    });

    await expect(
      caller.organizationDefinitions.costCenter.importCsv({
        rows: [{ name: 'Engineering', code: 'ENG' }],
      }),
    ).rejects.toThrow(/already exist|CONFLICT|templateCodesAlreadyExist/i);
    expect(mockWriteAuditLogMany).not.toHaveBeenCalled();
  });

  it('importCsv rejects readonly users at the RBAC middleware', async () => {
    const caller = makeCaller('readonly');
    await expect(
      caller.organizationDefinitions.costCenter.importCsv({
        rows: [{ name: 'Eng', code: 'ENG' }],
      }),
    ).rejects.toThrow(/FORBIDDEN|permission/i);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('organizationDefinitions.project.resolveMerge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.organization.findUnique = vi.fn().mockResolvedValue({
      id: ORG_ID,
      dataRegion: 'EU',
      status: 'ACTIVE',
    });
    mockPrisma.member.findFirst = vi.fn().mockResolvedValue({ role: 'admin' });
    mockPrisma.pendingProjectMerge.findFirst = vi.fn();
    mockPrisma.pendingProjectMerge.delete = vi.fn();
    mockPrisma.projectExternalLink.create = vi.fn();
    mockPrisma.project.create = vi.fn();
    mockPrisma.$transaction = vi.fn(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma),
    );
  });

  it('rejects merge action when the target id is not one of the suggested candidates', async () => {
    const caller = makeCaller('admin');
    mockPrisma.pendingProjectMerge.findFirst = vi.fn().mockResolvedValue({
      id: 'pm-1',
      source: 'JIRA',
      externalId: 'jira-1',
      candidateProjectIds: ['pr-real'],
      incomingName: 'Apollo',
    });

    await expect(
      caller.organizationDefinitions.project.resolveMerge({
        pendingMergeId: 'pm-1',
        action: 'merge',
        mergeIntoProjectId: 'pr-attacker',
      }),
    ).rejects.toThrow(/candidates|projectMergeIdNotCandidate/i);
    expect(mockPrisma.projectExternalLink.create).not.toHaveBeenCalled();
  });

  it('keep action creates a fresh Project and clears the pending row', async () => {
    const caller = makeCaller('admin');
    mockPrisma.pendingProjectMerge.findFirst = vi.fn().mockResolvedValue({
      id: 'pm-2',
      source: 'LINEAR',
      externalId: 'lin-1',
      candidateProjectIds: ['pr-existing'],
      incomingName: 'Helios',
    });
    mockPrisma.project.create = vi.fn().mockResolvedValue({
      id: 'pr-new',
      name: 'Helios',
    });

    const result = await caller.organizationDefinitions.project.resolveMerge({
      pendingMergeId: 'pm-2',
      action: 'keep',
    });

    expect(result).toEqual({ action: 'keep', projectId: 'pr-new' });
    expect(mockPrisma.project.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.pendingProjectMerge.delete).toHaveBeenCalledWith({ where: { id: 'pm-2' } });
  });
});
