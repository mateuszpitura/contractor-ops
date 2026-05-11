/**
 * Jira router — connection status and tenant scoping.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  ORG_ID,
  USER_ID,
  mockPrisma,
  mockGetStatusMapping,
  mockSaveStatusMappingSvc,
  mockRegisterJiraWebhooks,
  mockDeregisterJiraWebhooks,
} = vi.hoisted(() => {
  const OrgId = 'org-jira-00000000-0000-0000-0000-000000000001';
  const UserId = 'user-jira-00000000-0000-0000-0000-000000000001';

  const mockGetStatusMapping = vi.fn(async () => null as unknown[] | null);
  const mockSaveStatusMappingSvc = vi.fn(async () => undefined);
  const mockRegisterJiraWebhooks = vi.fn(async () => undefined);
  const mockDeregisterJiraWebhooks = vi.fn(async () => undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockPrisma: Record<string, unknown> = {
    auditLog: {
      create: vi.fn(async () => ({ id: 'audit-mock' })),
      createMany: vi.fn(async () => ({ count: 1 })),
    },
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    integrationConnection: {
      findFirst: vi.fn(),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    workflowTaskTemplate: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    externalLink: {
      findMany: vi.fn(),
    },
    workflowTaskRun: {
      findMany: vi.fn(),
    },
    workflowRun: {
      findMany: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(async () => ({
        id: 'sub_jira_mock',
        status: 'ACTIVE',
        tier: 'PRO',
      })),
    },
  };

  return {
    ORG_ID: OrgId,
    USER_ID: UserId,
    mockPrisma,
    mockGetStatusMapping,
    mockSaveStatusMappingSvc,
    mockRegisterJiraWebhooks,
    mockDeregisterJiraWebhooks,
  };
});

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

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    getCurrentScope: vi.fn(() => ({
      setUser: vi.fn(),
      setTag: vi.fn(),
      setTags: vi.fn(),
      setContext: vi.fn(),
      setExtra: vi.fn(),
      clear: vi.fn(),
    })),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

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
  createTrpcLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), distribution: vi.fn(), histogram: vi.fn() },
}));

vi.mock('../../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {
    subscription: (orgId: string) => `co:${orgId}:billing:sub`,
  },
  CacheTTL: {
    SUBSCRIPTION: 15 * 60,
  },
}));

vi.mock('@contractor-ops/integrations/services/credential-service', () => ({
  decryptCredentials: vi.fn(() => ({
    accessToken: 'tok',
    scope: 'read:jira-work',
  })),
}));

vi.mock('../../services/jira-issue-sync', () => ({
  detectScopeExpansionNeeded: vi.fn(() => false),
}));

vi.mock('../../services/jira-status-mapping', () => ({
  getStatusMapping: (...a: unknown[]) => mockGetStatusMapping(...a),
  saveStatusMapping: (...a: unknown[]) => mockSaveStatusMappingSvc(...a),
}));

vi.mock('../../services/jira-webhook-handler', () => ({
  registerJiraWebhooks: (...a: unknown[]) => mockRegisterJiraWebhooks(...a),
  deregisterJiraWebhooks: (...a: unknown[]) => mockDeregisterJiraWebhooks(...a),
}));

import { createCallerFactory } from '../../init';
import { jiraRouter } from '../integrations/jira';

const createCaller = createCallerFactory(jiraRouter);

function makeCaller(orgId: string) {
  const session = {
    session: {
      id: 'sess-jira',
      userId: USER_ID,
      activeOrganizationId: orgId,
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: USER_ID,
      name: 'Jira User',
      email: 'jira@example.com',
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

describe('jiraRouter', () => {
  const caller = makeCaller(ORG_ID);
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStatusMapping.mockImplementation(async () => null);
    fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'err',
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('connectionStatus returns null when no Jira connection', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);
    const result = await caller.connectionStatus();
    expect(result).toBeNull();
    expect(mockPrisma.integrationConnection.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        provider: 'JIRA',
      },
      select: expect.any(Object),
    });
  });

  it('connectionStatus returns connection without credentialsRef fields when connected', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: 'conn-jira',
      status: 'CONNECTED',
      displayName: 'Jira',
      configJson: { cloudId: 'cloud-1' },
      lastSyncAt: null,
      tokenExpiresAt: null,
      credentialsRef: 'ref-enc',
    });

    const result = await caller.connectionStatus();

    expect(result).toMatchObject({
      id: 'conn-jira',
      status: 'CONNECTED',
      scopeExpansionNeeded: false,
    });
    expect(result).not.toHaveProperty('credentialsRef');
  });

  it('listProjects throws PRECONDITION_FAILED when connection is missing', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);
    await expect(caller.listProjects({ connectionId: 'missing' })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
  });

  it('listProjects throws BAD_REQUEST when cloudId is missing from config', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      status: 'CONNECTED',
      configJson: {},
      credentialsRef: 'ref',
    });
    await expect(caller.listProjects({ connectionId: 'conn-1' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('listProjects maps Jira project API response', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      status: 'CONNECTED',
      configJson: { cloudId: 'cloud-x' },
      credentialsRef: 'ref',
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        { id: '100', key: 'OPS', name: 'Operations' },
        { id: '101', key: 'FIN', name: 'Finance' },
      ],
    } as Response);

    const result = await caller.listProjects({ connectionId: 'conn-1' });

    expect(result).toEqual([
      { id: '100', key: 'OPS', name: 'Operations' },
      { id: '101', key: 'FIN', name: 'Finance' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.atlassian.com/ex/jira/cloud-x/rest/api/3/project',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer tok',
        }),
      }),
    );
  });

  const connectedConn = {
    id: 'conn-1',
    status: 'CONNECTED',
    configJson: { cloudId: 'cloud-x' },
    credentialsRef: 'ref',
  };

  const statusMappingEntry = {
    workflowStatus: 'Todo',
    jiraTransitionId: 't1',
    jiraTransitionName: 'To Do',
    jiraTargetStatusName: 'To Do',
    jiraTargetStatusCategory: 'new' as const,
  };

  it('listIssueTypes maps issueTypes from Jira project response', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(connectedConn);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        issueTypes: [
          { id: 'it1', name: 'Story' },
          { id: 'it2', name: 'Bug' },
        ],
      }),
    } as Response);

    const result = await caller.listIssueTypes({
      connectionId: 'conn-1',
      projectId: '10000',
    });

    expect(result).toEqual([
      { id: 'it1', name: 'Story' },
      { id: 'it2', name: 'Bug' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.atlassian.com/ex/jira/cloud-x/rest/api/3/project/10000',
      expect.any(Object),
    );
  });

  it('listIssueTypes throws INTERNAL_SERVER_ERROR when Jira API fails', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(connectedConn);
    fetchMock.mockResolvedValue({
      ok: false,
      text: async () => 'bad',
    } as Response);

    await expect(
      caller.listIssueTypes({ connectionId: 'conn-1', projectId: 'p1' }),
    ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  });

  it('listProjectStatuses returns statuses array from Jira', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(connectedConn);
    const statuses = [
      {
        id: 's1',
        name: 'To Do',
        statusCategory: { key: 'new', name: 'New' },
      },
    ];
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => statuses,
    } as Response);

    const result = await caller.listProjectStatuses({
      connectionId: 'conn-1',
      projectId: '10000',
    });

    expect(result).toEqual(statuses);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.atlassian.com/ex/jira/cloud-x/rest/api/3/status/project/10000',
      expect.any(Object),
    );
  });

  it('getStatusMapping returns empty array when service returns null', async () => {
    mockGetStatusMapping.mockResolvedValue(null);
    const result = await caller.getStatusMapping({
      connectionId: 'conn-1',
      projectId: 'p1',
    });
    expect(result).toEqual([]);
  });

  it('getStatusMapping returns entries from service', async () => {
    mockGetStatusMapping.mockResolvedValue([statusMappingEntry]);
    const result = await caller.getStatusMapping({
      connectionId: 'conn-1',
      projectId: 'p1',
    });
    expect(result).toEqual([statusMappingEntry]);
    expect(mockGetStatusMapping).toHaveBeenCalledWith(mockPrisma, 'conn-1', 'p1');
  });

  it('getTaskConfig returns jiraEnabled false when template missing', async () => {
    mockPrisma.workflowTaskTemplate.findUnique.mockResolvedValue(null);
    const result = await caller.getTaskConfig({ taskTemplateId: 'tmpl-missing' });
    expect(result).toEqual({ jiraEnabled: false });
  });

  it('getTaskConfig returns jiraEnabled false when configJson missing', async () => {
    mockPrisma.workflowTaskTemplate.findUnique.mockResolvedValue({
      configJson: null,
    });
    const result = await caller.getTaskConfig({ taskTemplateId: 'tmpl-1' });
    expect(result).toEqual({ jiraEnabled: false });
  });

  it('getTaskConfig returns parsed Jira config when valid', async () => {
    mockPrisma.workflowTaskTemplate.findUnique.mockResolvedValue({
      configJson: {
        jiraEnabled: true,
        jiraProjectId: '100',
        jiraProjectKey: 'OPS',
      },
    });
    const result = await caller.getTaskConfig({ taskTemplateId: 'tmpl-1' });
    expect(result).toMatchObject({
      jiraEnabled: true,
      jiraProjectId: '100',
      jiraProjectKey: 'OPS',
    });
  });

  it('linkedIssues returns external links for WORKFLOW_TASK_RUN', async () => {
    const links = [
      {
        id: 'l1',
        externalId: 'JIRA-1',
        externalUrl: 'https://jira/issue/1',
        metadataJson: { key: 'K-1' },
      },
    ];
    mockPrisma.externalLink.findMany.mockResolvedValue(links);

    const result = await caller.linkedIssues({
      entityType: 'WORKFLOW_TASK_RUN',
      entityId: 'tr-1',
    });

    // F-DB-09: paginated envelope { items, nextCursor }
    expect(result.items).toEqual(JSON.parse(JSON.stringify(links)) as typeof links);
    expect(result.nextCursor).toBeUndefined();
    expect(mockPrisma.externalLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          entityId: 'tr-1',
          externalType: 'JIRA_ISSUE',
        }),
      }),
    );
  });

  it('linkedIssues aggregates links for WORKFLOW_RUN via task runs', async () => {
    mockPrisma.workflowRun.findMany.mockResolvedValue([{ id: 'wr-1' }]);
    mockPrisma.workflowTaskRun.findMany.mockResolvedValue([{ id: 'tr-a' }, { id: 'tr-b' }]);
    mockPrisma.externalLink.findMany.mockResolvedValue([]);

    const result = await caller.linkedIssues({
      entityType: 'WORKFLOW_RUN',
      entityId: 'wr-1',
    });

    expect(result.items).toEqual([]);
    expect(mockPrisma.workflowTaskRun.findMany).toHaveBeenCalled();
  });

  it('linkedIssues returns empty when WORKFLOW_RUN has no task runs', async () => {
    mockPrisma.workflowRun.findMany.mockResolvedValue([{ id: 'wr-1' }]);
    mockPrisma.workflowTaskRun.findMany.mockResolvedValue([]);

    const result = await caller.linkedIssues({
      entityType: 'WORKFLOW_RUN',
      entityId: 'wr-1',
    });

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
    expect(mockPrisma.externalLink.findMany).not.toHaveBeenCalled();
  });

  it('recentActivity returns empty when contractor has no workflow runs', async () => {
    mockPrisma.workflowRun.findMany.mockResolvedValue([]);
    const result = await caller.recentActivity({
      contractorId: 'c-1',
      limit: 5,
    });
    expect(result).toEqual([]);
  });

  it('recentActivity returns plain JSON links ordered by limit', async () => {
    mockPrisma.workflowRun.findMany.mockResolvedValue([{ id: 'wr-1' }]);
    mockPrisma.workflowTaskRun.findMany.mockResolvedValue([{ id: 'tr-1' }]);
    const updatedAt = new Date('2026-01-15T12:00:00.000Z');
    mockPrisma.externalLink.findMany.mockResolvedValue([
      {
        id: 'l1',
        externalId: 'X-1',
        externalUrl: null,
        metadataJson: null,
        updatedAt,
      },
    ]);

    const result = await caller.recentActivity({
      contractorId: 'c-1',
      limit: 3,
    });

    expect(result).toHaveLength(1);
    const got = (result[0] as { updatedAt: string | Date }).updatedAt;
    const gotIso = got instanceof Date ? got.toISOString() : got;
    expect(gotIso).toBe(updatedAt.toISOString());
    expect(mockPrisma.externalLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
  });

  it('saveStatusMapping delegates to service and registers webhooks', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      ...connectedConn,
      configJson: { cloudId: 'cloud-x', statusMappings: {} },
    });

    await caller.saveStatusMapping({
      connectionId: 'conn-1',
      projectId: '10000',
      mappings: [statusMappingEntry],
    });

    expect(mockSaveStatusMappingSvc).toHaveBeenCalledWith(mockPrisma, 'conn-1', '10000', [
      statusMappingEntry,
    ]);
    expect(mockRegisterJiraWebhooks).toHaveBeenCalledWith(mockPrisma, 'conn-1', ['10000']);
  });

  it('saveTaskConfig throws NOT_FOUND when template missing', async () => {
    mockPrisma.workflowTaskTemplate.findFirst.mockResolvedValue(null);
    await expect(
      caller.saveTaskConfig({
        taskTemplateId: 'missing',
        config: { jiraEnabled: true },
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('saveTaskConfig merges config into workflowTaskTemplate', async () => {
    mockPrisma.workflowTaskTemplate.findFirst.mockResolvedValue({
      configJson: { existing: true },
    });
    mockPrisma.workflowTaskTemplate.update.mockResolvedValue({});

    await caller.saveTaskConfig({
      taskTemplateId: 'tmpl-1',
      config: { jiraEnabled: true, jiraProjectId: '99' },
    });

    expect(mockPrisma.workflowTaskTemplate.update).toHaveBeenCalledWith({
      where: { id: 'tmpl-1' },
      data: {
        configJson: {
          existing: true,
          jiraEnabled: true,
          jiraProjectId: '99',
        },
      },
    });
  });

  it('disconnect throws NOT_FOUND when Jira connection missing', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);
    await expect(caller.disconnect({ connectionId: 'nope' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('disconnect deregisters webhooks and sets DISCONNECTED', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      provider: 'JIRA',
    });
    mockPrisma.integrationConnection.update.mockResolvedValue({});

    const result = await caller.disconnect({ connectionId: 'conn-1' });

    expect(result).toEqual({ success: true });
    expect(mockDeregisterJiraWebhooks).toHaveBeenCalledWith(mockPrisma, 'conn-1');
    expect(mockPrisma.integrationConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: { status: 'DISCONNECTED' },
    });
  });

  describe('tier gating', () => {
    it('saveStatusMapping, saveTaskConfig, and disconnect include requireTier(PRO)', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const sourceDir = path.resolve(import.meta.dirname, '../../routers');
      const source = fs.readFileSync(path.join(sourceDir, 'integrations/jira.ts'), 'utf-8');

      expect(source).toContain("import { requireTier } from '../../middleware/tier'");
      expect(source).toContain("requireTier('PRO')");

      const matches = source.match(/\.use\(requireTier\('PRO'\)\)/g);
      expect(matches).toHaveLength(3);
    });

    it('read-only procedures do NOT include requireTier', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const sourceDir = path.resolve(import.meta.dirname, '../../routers');
      const source = fs.readFileSync(path.join(sourceDir, 'integrations/jira.ts'), 'utf-8');

      for (const proc of [
        'connectionStatus',
        'listProjects',
        'listIssueTypes',
        'listProjectStatuses',
        'getStatusMapping',
        'getTaskConfig',
        'linkedIssues',
        'recentActivity',
      ]) {
        const procRegex = new RegExp(
          `${proc}:\\s*tenantProcedure[\\s\\S]*?(?=\\w+:\\s*tenantProcedure|\\}\\);$)`,
          'm',
        );
        const match = source.match(procRegex);
        if (match) {
          expect(match[0]).not.toContain('requireTier');
        }
      }
    });
  });
});
