/**
 * KSeF router — connection status, sync history, disconnect not-found.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  ORG_ID,
  USER_ID,
  mockPrisma,
  mockPublishJSON,
  mockSchedulesCreate,
  mockKsefVerifyCredentials,
} = vi.hoisted(() => {
  const OrgId = 'org-ksef-00000000-0000-0000-0000-000000000001';
  const UserId = 'user-ksef-00000000-0000-0000-0000-000000000001';
  const mockPublishJSON = vi.fn().mockResolvedValue(undefined);
  const mockSchedulesCreate = vi.fn().mockResolvedValue({ scheduleId: 'sched-ksef-1' });
  const mockKsefVerifyCredentials = vi.fn(async () => true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockPrisma: Record<string, unknown> = {
    organization: {
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn().mockResolvedValue({ dataRegion: 'EU' }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
    integrationConnection: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    integrationSyncLog: {
      findMany: vi.fn(),
    },
  };

  return {
    ORG_ID: OrgId,
    USER_ID: UserId,
    mockPrisma,
    mockPublishJSON,
    mockSchedulesCreate,
    mockKsefVerifyCredentials,
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
  prisma: mockPrisma,
  getRegionalClient: vi.fn(() => mockPrisma),
  tenantStore: {
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => {
  const stub = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  };
  return {
    createTrpcLogger: vi.fn(() => stub),
    createLogger: vi.fn(() => stub),
    createCronLogger: vi.fn(() => stub),
    createWebhookLogger: vi.fn(() => stub),
    createIntegrationLogger: vi.fn(() => stub),
  };
});

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), distribution: vi.fn(), histogram: vi.fn() },
}));

vi.mock('../../services/cache.js', () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {},
  CacheTTL: {},
}));

vi.mock('@contractor-ops/einvoice', () => ({
  KsefApiClient: class KsefApiClientMock {
    verifyCredentials = mockKsefVerifyCredentials;
  },
  ksefConnectionConfigSchema: { parse: vi.fn((x: unknown) => x) },
}));

vi.mock('@contractor-ops/integrations', () => ({
  storeCredentials: vi.fn(async () => 'enc-ref'),
  deleteCredentials: vi.fn(async () => undefined),
  encryptCredentials: vi.fn(async (v: unknown) => ({
    ciphertext: 'enc',
    iv: 'iv',
    keyVersion: 1,
    data: v,
  })),
  decryptCredentials: vi.fn(async () => ({})),
}));

vi.mock('@contractor-ops/integrations/services/qstash-client', () => ({
  getQStashClient: vi.fn(() => ({
    schedules: {
      create: mockSchedulesCreate,
      delete: vi.fn(async () => undefined),
    },
    publishJSON: mockPublishJSON,
  })),
}));

vi.mock('../../services/ksef-sync-orchestrator.js', () => ({
  processKsefSync: vi.fn(async () => undefined),
}));

import { createCallerFactory } from '../../init.js';
import { ksefRouter } from '../integrations/ksef.js';

const createCaller = createCallerFactory(ksefRouter);

function makeCaller(orgId: string) {
  const session = {
    session: {
      id: 'sess-ksef',
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
      name: 'KSeF User',
      email: 'ksef@example.com',
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

describe('ksefRouter', () => {
  const caller = makeCaller(ORG_ID);

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.integrationSyncLog.findMany.mockResolvedValue([]);
  });

  it('connectionStatus returns null when no KSeF connection', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);
    const result = await caller.connectionStatus();
    expect(result).toBeNull();
    expect(mockPrisma.integrationConnection.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        provider: 'KSEF',
      },
      select: expect.any(Object),
    });
  });

  it('connectionStatus returns sanitized fields when connected', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: 'ksef-1',
      status: 'CONNECTED',
      configJson: { authMethod: 'token' },
      lastSyncAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      connectedAt: new Date(),
    });

    const result = await caller.connectionStatus();

    expect(result).toMatchObject({
      id: 'ksef-1',
      status: 'CONNECTED',
    });
  });

  it('syncHistory returns empty logs when no connection', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);
    const result = await caller.syncHistory({ limit: 5 });
    expect(result).toEqual({ logs: [] });
    expect(mockPrisma.integrationSyncLog.findMany).not.toHaveBeenCalled();
  });

  it('syncHistory loads logs for KSeF connection', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: 'conn-ksef',
    });
    mockPrisma.integrationSyncLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        syncType: 'FULL',
        status: 'SUCCESS',
        direction: 'INBOUND',
        errorMessage: null,
        responsePayloadJson: null,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    ]);

    const result = await caller.syncHistory({ limit: 10 });

    expect(mockPrisma.integrationSyncLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { integrationConnectionId: 'conn-ksef' },
        take: 10,
      }),
    );
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]?.id).toBe('log-1');
  });

  it('disconnect throws NOT_FOUND when no KSeF connection', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);

    await expect(caller.disconnect()).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('connect throws BAD_REQUEST when organization has no NIP (taxId)', async () => {
    mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({
      settingsJson: {},
    });

    await expect(
      caller.connect({
        authMethod: 'token',
        token: 'tok',
        environment: 'test',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('connect rejects when token auth but token is missing (Zod refine)', async () => {
    mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({
      settingsJson: { taxId: '1234567890' },
    });

    await expect(
      caller.connect({
        authMethod: 'token',
        environment: 'test',
      }),
    ).rejects.toThrow();
  });

  it('connect creates IntegrationConnection when credentials verify', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({
      settingsJson: { taxId: '1234567890' },
    });
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);
    mockPrisma.integrationConnection.create.mockResolvedValue({
      id: 'new-ksef-conn',
      organizationId: ORG_ID,
      provider: 'KSEF',
      status: 'CONNECTED',
      configJson: { authMethod: 'token', environment: 'test' },
      credentialsRef: 'enc-ref',
      connectedByUserId: USER_ID,
      connectedAt: new Date(),
      lastSyncAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
    });
    mockPrisma.integrationConnection.update.mockResolvedValue({});

    const result = await caller.connect({
      authMethod: 'token',
      token: 'valid-ksef-token',
      environment: 'test',
    });

    expect(result.id).toBe('new-ksef-conn');
    expect(mockPrisma.integrationConnection.create).toHaveBeenCalled();
    expect(mockSchedulesCreate).toHaveBeenCalled();
  });

  it('triggerSync throws NOT_FOUND when no connected KSeF integration', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValue(null);

    await expect(caller.triggerSync()).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('triggerSync publishes one-off QStash job when connected', async () => {
    const { resetServerEnvCacheForTesting } = await import('@contractor-ops/validators');
    process.env.NEXT_PUBLIC_APP_URL = 'http://app.example';
    resetServerEnvCacheForTesting();
    mockPrisma.integrationConnection.findFirst.mockResolvedValue({
      id: 'conn-ksef-sync',
      status: 'CONNECTED',
    });

    await caller.triggerSync();

    expect(mockPublishJSON).toHaveBeenCalledWith({
      url: 'http://app.example/api/ksef/_sync',
      body: {
        organizationId: ORG_ID,
        connectionId: 'conn-ksef-sync',
      },
    });
  });
});
