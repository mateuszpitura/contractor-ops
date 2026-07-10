/**
 * Linear router — connection status (no external API on this path).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ORG_ID, USER_ID, mockPrisma, mockLinearGraphQL, mockRegisterLinearWebhook } = vi.hoisted(
  () => {
    const OrgId = 'org-linear-00000000-0000-0000-0000-000000000001';
    const UserId = 'user-linear-00000000-0000-0000-0000-000000000001';
    const mockLinearGraphQL = vi.fn();
    const mockRegisterLinearWebhook = vi.fn().mockResolvedValue(undefined);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockPrisma: Record<string, unknown> = {
      auditLog: {
        create: vi.fn(async () => ({ id: 'audit-mock' })),
        createMany: vi.fn(async () => ({ count: 1 })),
      },
      organization: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
      },
      integrationConnection: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      workflowTaskTemplate: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      externalLink: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      workflowTaskRun: {
        findMany: vi.fn(),
      },
      subscription: {
        findUnique: vi.fn(async () => ({
          id: 'sub_linear_mock',
          status: 'ACTIVE',
          tier: 'PRO',
        })),
      },
    };

    return {
      ORG_ID: OrgId,
      USER_ID: UserId,
      mockPrisma,
      mockLinearGraphQL,
      mockRegisterLinearWebhook,
    };
  },
);

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

vi.mock('@sentry/node', () => {
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
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
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

vi.mock('../../services/cache', async importOriginal => {
  const actual = await importOriginal<typeof import('../../services/cache')>();
  const { createPassthroughCacheMock } = await import('../../__tests__/__mocks__/cache-service');
  return createPassthroughCacheMock(actual);
});

vi.mock('@contractor-ops/integrations/services/credential-service', () => ({
  decryptCredentials: vi.fn(() => ({ accessToken: 'lin-token' })),
}));

vi.mock('../../services/linear-issue-sync', async importOriginal => {
  const actual = await importOriginal<typeof import('../../services/linear-issue-sync')>();
  return {
    ...actual,
    linearGraphQL: mockLinearGraphQL,
  };
});

vi.mock('../../services/linear-webhook-handler', () => ({
  registerLinearWebhook: mockRegisterLinearWebhook,
}));

import { createCallerFactory } from '../../init';
import { linearRouter } from '../integrations/linear';

const createCaller = createCallerFactory(linearRouter);

function makeCaller(orgId: string) {
  const session = {
    session: {
      id: 'sess-linear',
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
      name: 'Linear User',
      email: 'linear@example.com',
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

describe('linearRouter', () => {
  const caller = makeCaller(ORG_ID);

  beforeEach(() => {
    vi.clearAllMocks();
    mockRegisterLinearWebhook.mockResolvedValue(undefined);
  });

  const linearConn = {
    id: 'conn-linear-1',
    status: 'CONNECTED' as const,
    credentialsRef: 'enc-linear',
    configJson: {},
  };

  const mappingEntry = {
    workflowStatus: 'In Progress',
    linearStateId: 'state-1',
    linearStateName: 'Doing',
    linearStateType: 'started' as const,
  };

  it('connectionStatus returns null when no Linear connection', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);
    const result = await caller.connectionStatus();
    expect(result).toBeNull();
    expect(mockPrisma.integrationConnection.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        provider: 'LINEAR',
      },
    });
  });

  it('connectionStatus returns id, status, and an allowlisted configJson when connected', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: 'conn-linear',
      status: 'CONNECTED',
      configJson: {
        statusMappings: { 'team-1': [] },
        stateCache: { 'team-1': {} },
        // Secret/internal fields that must never reach a settings:read member.
        webhooks: { 'team-1': 'wh-1' },
        webhookSecret: 'deadbeef',
      },
    });

    const result = await caller.connectionStatus();

    expect(result).toEqual({
      id: 'conn-linear',
      status: 'CONNECTED',
      configJson: {
        statusMappings: { 'team-1': [] },
        stateCache: { 'team-1': {} },
      },
    });
  });

  it('teams throws NOT_FOUND when no Linear connection', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);
    await expect(caller.teams()).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('teams maps Linear GraphQL teams and states', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(linearConn);
    mockLinearGraphQL.mockResolvedValue({
      teams: {
        nodes: [
          {
            id: 'tm1',
            name: 'Eng',
            key: 'ENG',
            states: {
              nodes: [
                {
                  id: 'st1',
                  name: 'Todo',
                  type: 'unstarted',
                  color: '#000',
                  position: 0,
                },
              ],
            },
          },
        ],
      },
    });

    const result = await caller.teams();

    expect(result).toEqual([
      {
        id: 'tm1',
        name: 'Eng',
        key: 'ENG',
        states: [
          {
            id: 'st1',
            name: 'Todo',
            type: 'unstarted',
            color: '#000',
            position: 0,
          },
        ],
      },
    ]);
    expect(mockLinearGraphQL).toHaveBeenCalledWith('lin-token', expect.stringContaining('teams'));
  });

  it('getStatusMapping returns team entries from configJson', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      ...linearConn,
      configJson: {
        statusMappings: {
          'team-99': [mappingEntry],
        },
      },
    });

    const result = await caller.getStatusMapping({ teamId: 'team-99' });
    expect(result).toEqual([mappingEntry]);
  });

  it('getStatusMapping returns empty array when team has no mappings', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      ...linearConn,
      configJson: { statusMappings: {} },
    });
    const result = await caller.getStatusMapping({ teamId: 'unknown' });
    expect(result).toEqual([]);
  });

  it('saveStatusMapping throws BAD_REQUEST when connectionId mismatches', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(linearConn);
    await expect(
      caller.saveStatusMapping({
        connectionId: 'other-id',
        teamId: 'tm1',
        mappings: [mappingEntry],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('saveStatusMapping updates config and transitions PENDING_MAPPING to CONNECTED', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      ...linearConn,
      id: 'conn-linear-1',
      status: 'PENDING_MAPPING',
      configJson: { webhooks: {} },
    });
    mockPrisma.integrationConnection.update.mockResolvedValue({});

    await caller.saveStatusMapping({
      connectionId: 'conn-linear-1',
      teamId: 'tm1',
      mappings: [mappingEntry],
    });

    expect(mockPrisma.integrationConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-linear-1' },
      data: expect.objectContaining({
        status: 'CONNECTED',
        configJson: expect.objectContaining({
          statusMappings: expect.objectContaining({
            tm1: [mappingEntry],
          }),
        }),
      }),
    });
  });

  it('saveStatusMapping registers webhook when team not yet in webhooks map', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      ...linearConn,
      configJson: { webhooks: {} },
    });
    mockPrisma.integrationConnection.update.mockResolvedValue({});

    await caller.saveStatusMapping({
      connectionId: 'conn-linear-1',
      teamId: 'tm-new',
      mappings: [mappingEntry],
    });

    await vi.waitFor(() => {
      expect(mockRegisterLinearWebhook).toHaveBeenCalledWith(mockPrisma, 'conn-linear-1', 'tm-new');
    });
  });

  it('saveStatusMapping skips webhook registration when team already registered', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      ...linearConn,
      configJson: { webhooks: { 'tm-old': 'wh-id' } },
    });
    mockPrisma.integrationConnection.update.mockResolvedValue({});

    await caller.saveStatusMapping({
      connectionId: 'conn-linear-1',
      teamId: 'tm-old',
      mappings: [mappingEntry],
    });

    await new Promise(r => setImmediate(r));
    expect(mockRegisterLinearWebhook).not.toHaveBeenCalled();
  });

  it('saveTaskConfig throws NOT_FOUND when template missing', async () => {
    mockPrisma.workflowTaskTemplate.findFirst.mockResolvedValue(null);
    await expect(
      caller.saveTaskConfig({
        taskTemplateId: 'x',
        config: { linearEnabled: true },
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('saveTaskConfig merges linear config into template', async () => {
    mockPrisma.workflowTaskTemplate.findFirst.mockResolvedValue({
      configJson: { other: 1 },
    });
    mockPrisma.workflowTaskTemplate.update.mockResolvedValue({});

    await caller.saveTaskConfig({
      taskTemplateId: 'tpl-1',
      config: { linearEnabled: true, linearTeamId: 't1' },
    });

    expect(mockPrisma.workflowTaskTemplate.update).toHaveBeenCalledWith({
      where: { id: 'tpl-1' },
      data: {
        configJson: {
          other: 1,
          linearEnabled: true,
          linearTeamId: 't1',
        },
      },
    });
  });

  it('getLinkedIssue returns null when no link', async () => {
    mockPrisma.externalLink.findFirst.mockResolvedValue(null);
    expect(await caller.getLinkedIssue({ taskRunId: 'tr-1' })).toBeNull();
  });

  it('getLinkedIssue returns plain link with metadata', async () => {
    const meta = {
      identifier: 'ENG-1',
      linearIssueId: 'iss-1',
      title: 'Fix bug',
      status: 'In Progress',
      statusType: 'started',
      url: 'https://linear.app/issue/1',
    };
    mockPrisma.externalLink.findFirst.mockResolvedValue({
      id: 'l1',
      externalId: 'iss-1',
      externalUrl: 'https://linear.app/issue/1',
      metadataJson: meta,
    });

    const result = await caller.getLinkedIssue({ taskRunId: 'tr-1' });
    expect(result).toMatchObject({
      id: 'l1',
      externalId: 'iss-1',
      metadata: meta,
    });
  });

  it('getLinkedIssues returns empty object for empty taskRunIds', async () => {
    expect(await caller.getLinkedIssues({ taskRunIds: [] })).toEqual({});
  });

  it('getLinkedIssues maps taskRunId to link or null', async () => {
    mockPrisma.externalLink.findMany.mockResolvedValue([
      {
        id: 'l1',
        entityId: 'tr-a',
        externalId: 'e1',
        externalUrl: null,
        metadataJson: null,
      },
    ]);

    const result = await caller.getLinkedIssues({
      taskRunIds: ['tr-a', 'tr-b'],
    });

    expect(result['tr-a']).toMatchObject({ id: 'l1', externalId: 'e1' });
    expect(result['tr-b']).toBeNull();
  });

  it('linkedIssues returns links for WORKFLOW_TASK_RUN', async () => {
    const links = [{ id: 'l1', externalId: 'x', externalUrl: null, metadataJson: null }];
    mockPrisma.externalLink.findMany.mockResolvedValue(links);
    const result = await caller.linkedIssues({
      entityType: 'WORKFLOW_TASK_RUN',
      entityId: 'tr-1',
    });
    // Returns paginated envelope { items, nextCursor }
    expect(result.items).toEqual(JSON.parse(JSON.stringify(links)));
    expect(result.nextCursor).toBeUndefined();
  });

  it('linkedIssues returns empty when WORKFLOW_RUN has no task runs', async () => {
    mockPrisma.workflowTaskRun.findMany.mockResolvedValue([]);
    const result = await caller.linkedIssues({
      entityType: 'WORKFLOW_RUN',
      entityId: 'wr-1',
    });
    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
  });

  describe('tier gating', () => {
    it('saveStatusMapping and saveTaskConfig are gated on tier PRO via integrationProcedure', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const sourceDir = path.resolve(import.meta.dirname, '../../routers');
      const source = fs.readFileSync(path.join(sourceDir, 'integrations/linear.ts'), 'utf-8');

      expect(source).toContain(
        "import { integrationProcedure } from '../../lib/integration-procedure'",
      );

      const matches = source.match(/tier: 'PRO'/g);
      expect(matches).toHaveLength(2);
    });

    it('read-only procedures do NOT include tier gating', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const sourceDir = path.resolve(import.meta.dirname, '../../routers');
      const source = fs.readFileSync(path.join(sourceDir, 'integrations/linear.ts'), 'utf-8');

      for (const proc of [
        'connectionStatus',
        'teams',
        'getStatusMapping',
        'getLinkedIssue',
        'getLinkedIssues',
        'linkedIssues',
      ]) {
        const procRegex = new RegExp(`${proc}:\\s*integrationProcedure\\(([\\s\\S]*?)\\)`, 'm');
        const match = source.match(procRegex);
        if (match) {
          expect(match[1]).not.toContain('tier:');
        }
      }
    });
  });
});
