/**
 * Integration `connectionStatus` secret-leak regression tests.
 *
 * `jira`/`linear`/`teams` `connectionStatus` are gated only on
 * `settings:['read']`, so any read-only member can call them. Their
 * `IntegrationConnection.configJson` blob stores secret/sensitive material —
 * the per-connection inbound webhook HMAC `webhookSecret`, provider
 * `webhookIds`, and (Teams) Bot Framework conversation references. These must
 * never appear in the response; returning them would let a read-only member
 * forge signed inbound webhooks. The routers project `configJson` through a
 * per-provider allowlist; this proves the allowlist holds for the full blob
 * that the webhook handlers actually persist.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ORG_ID, USER_ID, mockPrisma } = vi.hoisted(() => {
  const OrgId = 'org-leak-00000000-0000-0000-0000-000000000001';
  const UserId = 'user-leak-00000000-0000-0000-0000-000000000001';

  const mockPrisma: Record<string, unknown> = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    integrationConnection: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(async () => ({ id: 'sub_mock', status: 'ACTIVE', tier: 'PRO' })),
    },
  };

  return { ORG_ID: OrgId, USER_ID: UserId, mockPrisma };
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
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
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
  CacheKeys: { subscription: (orgId: string) => `co:${orgId}:billing:sub` },
  CacheTTL: { SUBSCRIPTION: 15 * 60 },
}));

vi.mock('@contractor-ops/integrations/services/credential-service', () => ({
  // Credentials decrypt is irrelevant to the leak surface — return a token so
  // Jira's scope-expansion probe does not throw.
  decryptCredentials: vi.fn(() => ({ accessToken: 'tok', scope: 'read:jira-work' })),
}));

vi.mock('../../services/jira-issue-sync', () => ({
  detectScopeExpansionNeeded: vi.fn(() => false),
}));

vi.mock('../../services/jira-status-mapping', () => ({
  getStatusMapping: vi.fn(async () => null),
  saveStatusMapping: vi.fn(async () => undefined),
}));

vi.mock('../../services/jira-webhook-handler', () => ({
  registerJiraWebhooks: vi.fn(async () => undefined),
  deregisterJiraWebhooks: vi.fn(async () => undefined),
}));

vi.mock('../../services/linear-issue-sync', () => ({
  linearGraphQL: vi.fn(async () => ({ teams: { nodes: [] } })),
}));

vi.mock('../../services/linear-webhook-handler', () => ({
  registerLinearWebhook: vi.fn(async () => undefined),
}));

vi.mock('../../services/teams/teams-graph-client', () => ({
  getJoinedTeams: vi.fn(async () => []),
  getTeamsChannels: vi.fn(async () => []),
}));

import { createCallerFactory } from '../../init';
import { jiraRouter } from '../../routers/integrations/jira';
import { linearRouter } from '../../routers/integrations/linear';
import { teamsRouter } from '../../routers/integrations/teams';

const SECRET = 'a'.repeat(64); // 32-byte HMAC secret, hex-encoded

function makeCaller<R extends Parameters<typeof createCallerFactory>[0]>(routerDef: R) {
  const session = {
    session: {
      id: 'sess-leak',
      userId: USER_ID,
      activeOrganizationId: ORG_ID,
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    // A read-only member, NOT an admin — `settings:['read']` is granted via the
    // mocked hasPermission, the point being a low-privilege caller.
    user: {
      id: USER_ID,
      name: 'Read Only',
      email: 'reader@example.com',
      emailVerified: true,
      image: null,
      banned: false,
      banReason: null,
      banExpires: null,
      role: 'member',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
  return createCallerFactory(routerDef)({
    headers: new Headers(),
    session: session as never,
    user: session.user as never,
  });
}

/** All secret/sensitive substrings that must never reach a read-only member. */
function assertNoSecrets(serialized: string): void {
  expect(serialized).not.toContain(SECRET);
  expect(serialized).not.toContain('webhookSecret');
  expect(serialized).not.toContain('webhookIds');
  expect(serialized).not.toContain('credentialsRef');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('integration connectionStatus — configJson secret leak', () => {
  it('jira.connectionStatus omits webhookSecret/webhookIds, keeps safe fields', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: 'conn-jira',
      status: 'CONNECTED',
      displayName: 'Acme Jira',
      lastSyncAt: null,
      tokenExpiresAt: null,
      credentialsRef: 'ref-enc',
      configJson: {
        cloudId: 'cloud-1',
        siteName: 'acme',
        siteUrl: 'https://acme.atlassian.net',
        statusMappings: { OPS: [{ workflowStatus: 'Todo' }] },
        webhookRegisteredAt: '2026-01-01T00:00:00.000Z',
        webhookIds: [12345],
        webhookSecret: SECRET,
      },
    });

    const result = await makeCaller(jiraRouter).connectionStatus();

    assertNoSecrets(JSON.stringify(result));
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const config = result!.configJson as Record<string, unknown>;
    expect(config.cloudId).toBe('cloud-1');
    expect(config.siteName).toBe('acme');
    expect(config.statusMappings).toEqual({ OPS: [{ workflowStatus: 'Todo' }] });
    expect(config.webhookRegisteredAt).toBe('2026-01-01T00:00:00.000Z');
    expect(config).not.toHaveProperty('webhookSecret');
    expect(config).not.toHaveProperty('webhookIds');
    expect(result).not.toHaveProperty('credentialsRef');
  });

  it('linear.connectionStatus omits webhookSecret/webhook ids, keeps safe fields', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: 'conn-linear',
      status: 'CONNECTED',
      credentialsRef: 'ref-enc',
      configJson: {
        statusMappings: { 'team-1': [{ workflowStatus: 'Done' }] },
        stateCache: { 'team-1': { s1: { name: 'Done', type: 'completed' } } },
        webhooks: { 'team-1': 'wh-abc' },
        webhookSecret: SECRET,
      },
    });

    const result = await makeCaller(linearRouter).connectionStatus();

    assertNoSecrets(JSON.stringify(result));
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const config = result!.configJson as Record<string, unknown>;
    expect(config.statusMappings).toEqual({ 'team-1': [{ workflowStatus: 'Done' }] });
    expect(config.stateCache).toEqual({ 'team-1': { s1: { name: 'Done', type: 'completed' } } });
    expect(config).not.toHaveProperty('webhooks');
    expect(config).not.toHaveProperty('webhookSecret');
  });

  it('teams.connectionStatus omits conversation references, keeps safe fields', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: 'conn-teams',
      status: 'CONNECTED',
      credentialsRef: 'ref-enc',
      configJson: {
        channelMapping: { approvals: '19:abc@thread.tacv2' },
        defaultTeamId: 'team-1',
        defaultFallbackApproverId: 'user-9',
        conversationReferences: { 'aad-1': { serviceUrl: 'https://smba.secret/' } },
        teamConversationReferences: {
          '19:abc@thread.tacv2': { serviceUrl: 'https://smba.secret/' },
        },
        webhookSecret: SECRET,
      },
    });

    const result = await makeCaller(teamsRouter).connectionStatus();

    const serialized = JSON.stringify(result);
    assertNoSecrets(serialized);
    expect(serialized).not.toContain('conversationReferences');
    expect(serialized).not.toContain('smba.secret');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const config = result!.configJson as Record<string, unknown>;
    expect(config.channelMapping).toEqual({ approvals: '19:abc@thread.tacv2' });
    expect(config.defaultTeamId).toBe('team-1');
    expect(config.defaultFallbackApproverId).toBe('user-9');
    expect(config).not.toHaveProperty('conversationReferences');
    expect(config).not.toHaveProperty('teamConversationReferences');
    expect(config).not.toHaveProperty('webhookSecret');
  });
});
