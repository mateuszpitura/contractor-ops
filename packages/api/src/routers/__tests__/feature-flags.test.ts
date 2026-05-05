/**
 * Feature-flags router unit tests.
 *
 * Strategy:
 *  - Mock `@contractor-ops/feature-flags` with controlled FLAG_KEYS, FLAGS, and lazyFlagBag.
 *  - Mock standard dependencies (auth, db, logger, Sentry).
 *  - Create a tRPC caller via `createCallerFactory` + `makeCaller`.
 *  - Each test verifies the list procedure returns the correct shape and values.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockPrisma, mockIsEnabled, mockFlagKeys, mockFlags } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn(async () => ({
        dataRegion: 'EU', status: 'ACTIVE',
        billingEmail: 'billing@test.com',
        name: 'Test Org',
      })),
      findUniqueOrThrow: vi.fn(async () => ({ countryCode: 'PL' })),
    },
    member: { findFirst: vi.fn(async () => ({ role: 'admin' })) },
    contractor: { count: vi.fn(async () => 0) },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  const mockIsEnabled = vi.fn((_key: string) => false);

  const mockFlagKeys = ['module.legal-approval', 'module.ksef'] as string[];

  const mockFlags: Record<string, { description: string; category: string; jurisdiction: string }> =
    {
      'module.legal-approval': {
        description: 'Legal approval workflows',
        category: 'module',
        jurisdiction: 'EU',
      },
      'module.ksef': {
        description: 'KSeF e-invoicing integration',
        category: 'module',
        jurisdiction: 'EU',
      },
    };

  return { mockPrisma, mockIsEnabled, mockFlagKeys, mockFlags };
});

// ---------------------------------------------------------------------------
// Mock modules
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/feature-flags', () => ({
  FLAG_KEYS: mockFlagKeys,
  FLAGS: mockFlags,
  lazyFlagBag: vi.fn(() => ({
    values: {},
    isEnabled: mockIsEnabled,
  })),
  // root.ts evaluates `buildFlagBag` at module load to gate classification routers.
  // The test doesn't exercise that path, but the import resolves regardless.
  buildFlagBag: vi.fn(() => ({
    values: {},
    isEnabled: mockIsEnabled,
  })),
}));

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
  withRlsTransactions: <T,>(c: T) => c,
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

vi.mock('../../services/cache.js', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  CacheKeys: {},
  CacheTTL: {},
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {
    orgSettings: (orgId: string) => `org-settings:${orgId}`,
    orgSettingsJson: (orgId: string, key: string) => `org-settings-json:${orgId}:${key}`,
    orgBranding: (orgId: string) => `org-branding:${orgId}`,
    settingsPrefix: (orgId: string) => `org-settings:${orgId}`,
    approvalChains: (orgId: string) => `approval-chains:${orgId}`,
  },
  CacheTTL: { ORG_SETTINGS: 300, ORG_SETTINGS_JSON: 300, ORG_BRANDING: 300, APPROVAL_CHAINS: 300 },
}));

vi.mock('../../services/notification-service.js', () => ({
  dispatch: vi.fn(async () => undefined),
  getOrCreatePreferences: vi.fn(async () => ({})),
}));

vi.mock('../../services/sanitize.js', () => ({
  sanitizeStrings: vi.fn(<T>(v: T) => v),
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    getCurrentScope: vi.fn(() => ({ setUser: vi.fn(), setTag: vi.fn(), setTags: vi.fn(), setContext: vi.fn(), setExtra: vi.fn(), clear: vi.fn() })),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(), trace: vi.fn(), child: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
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
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { auth } from '@contractor-ops/auth';
import { createCallerFactory } from '../../init.js';
import { appRouter } from '../../root.js';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(appRouter);

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

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.api.hasPermission).mockResolvedValue({ success: true } as never);
  mockIsEnabled.mockReset().mockReturnValue(false);
});

// ===========================================================================
// Tests
// ===========================================================================

describe('featureFlags.list', () => {
  it('returns all FLAG_KEYS with correct shape', async () => {
    const result = await caller.featureFlags.list();

    expect(result).toHaveLength(mockFlagKeys.length);
    for (const item of result) {
      expect(item).toEqual(
        expect.objectContaining({
          key: expect.any(String),
          description: expect.any(String),
          category: expect.any(String),
          jurisdiction: expect.any(String),
          enabled: expect.any(Boolean),
        }),
      );
    }
  });

  it('enabled reflects ctx.flags.isEnabled per key', async () => {
    mockIsEnabled.mockImplementation((key: string) => key === 'module.ksef');

    const result = await caller.featureFlags.list();

    const legalApproval = result.find(f => f.key === 'module.legal-approval');
    const ksef = result.find(f => f.key === 'module.ksef');

    expect(legalApproval?.enabled).toBe(false);
    expect(ksef?.enabled).toBe(true);
  });

  it('description/category/jurisdiction come from FLAGS registry', async () => {
    const result = await caller.featureFlags.list();

    const legalApproval = result.find(f => f.key === 'module.legal-approval');
    expect(legalApproval).toEqual(
      expect.objectContaining({
        description: 'Legal approval workflows',
        category: 'module',
        jurisdiction: 'EU',
      }),
    );

    const ksef = result.find(f => f.key === 'module.ksef');
    expect(ksef).toEqual(
      expect.objectContaining({
        description: 'KSeF e-invoicing integration',
        category: 'module',
        jurisdiction: 'EU',
      }),
    );
  });

  it('returns empty array when FLAG_KEYS is empty', async () => {
    // Temporarily empty the keys array
    const originalLength = mockFlagKeys.length;
    mockFlagKeys.length = 0;

    const result = await caller.featureFlags.list();

    expect(result).toEqual([]);

    // Restore for other tests
    mockFlagKeys.push('module.legal-approval', 'module.ksef');
    expect(mockFlagKeys).toHaveLength(originalLength);
  });
});
