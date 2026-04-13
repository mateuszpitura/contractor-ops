/**
 * Portal branding router tests.
 *
 * Tests settings.getBranding, settings.updateBranding, and portal.getSession
 * (portal layout: org name + logo; brandColor remains admin-only via settings.getBranding).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Prisma + ids (hoisted for portal-session mock)
// ---------------------------------------------------------------------------

const { ORG_ID, USER_ID, PORTAL_SESSION_TOKEN, CONTRACTOR_ID, mockPrisma } = vi.hoisted(() => {
  const ORG_ID = 'org-branding-001';
  const USER_ID = 'user-branding-001';
  const PORTAL_SESSION_TOKEN = 'portal-branding-session';
  const CONTRACTOR_ID = 'contractor-branding-001';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, any>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { ORG_ID, USER_ID, PORTAL_SESSION_TOKEN, CONTRACTOR_ID, mockPrisma };
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

vi.mock('../../services/r2.js', () => ({
  createPresignedUploadUrl: vi.fn(async () => ({ url: 'https://r2.test/upload', key: 'k' })),
  createPresignedDownloadUrl: vi.fn(async () => 'https://r2.test/download'),
  generateStorageKey: vi.fn(() => 'mock-key'),
}));

vi.mock('../../services/cache.js', () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {
    orgBranding: (orgId: string) => `org-branding:${orgId}`,
    settingsPrefix: (orgId: string) => `settings:${orgId}`,
    approvalChains: (orgId: string) => `approval-chains:${orgId}`,
  },
  CacheTTL: { ORG_BRANDING: 300, APPROVAL_CHAINS: 300 },
}));

vi.mock('../../services/portal-session.js', () => ({
  validatePortalSession: vi.fn(async (token: string) => {
    if (token !== PORTAL_SESSION_TOKEN) return null;
    return {
      contractorId: CONTRACTOR_ID,
      organizationId: ORG_ID,
      email: 'portal@contractor.test',
      contractor: {
        id: CONTRACTOR_ID,
        displayName: 'Portal Contractor',
        email: 'portal@contractor.test',
      },
    };
  }),
  createPortalSession: vi.fn(),
  deletePortalSession: vi.fn(),
}));

vi.mock('../../services/portal-magic-link.js', () => ({
  createMagicLinkToken: vi.fn(),
  verifyMagicLinkToken: vi.fn(),
  findContractorsByEmail: vi.fn(),
  sendPortalMagicLink: vi.fn(),
}));

vi.mock('../../services/bank-account-crypto.js', () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock('../../services/portal-change-request.js', () => ({
  createChangeRequest: vi.fn(),
}));

vi.mock('../../services/notification-service.js', () => ({
  dispatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/billing-service.js', () => ({
  syncSeatCountForOrg: vi.fn(async () => undefined),
}));

vi.mock('../../services/stripe-client.js', () => ({
  stripe: {
    subscriptions: { retrieve: vi.fn(), update: vi.fn(), list: vi.fn(async () => ({ data: [] })) },
    customers: { create: vi.fn(), retrieve: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
  },
}));

vi.mock('@contractor-ops/logger', () => ({
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('../../services/teams/teams-graph-client.js', () => ({
  getTeamsChannels: vi.fn(),
  getJoinedTeams: vi.fn(),
  getUserByEmail: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init.js';
import { appRouter } from '../../root.js';

// ---------------------------------------------------------------------------
// Caller setup — admin tenant caller
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(appRouter);

function makeTenantCaller() {
  const session = {
    session: {
      id: 'session-1',
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
      name: 'Admin User',
      email: 'admin@test.com',
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

const caller = makeTenantCaller();

function makePortalCaller() {
  return createCaller({
    headers: new Headers({ cookie: `portal_session=${PORTAL_SESSION_TOKEN}` }),
    session: null as never,
    user: null as never,
  });
}

const portalCaller = makePortalCaller();

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// settings.getBranding
// ===========================================================================

describe('settings.getBranding', () => {
  it('returns current brandColor from settingsJson and logo from org', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      logo: 'https://cdn.test/logo.png',
      settingsJson: { brandColor: '#FF5500', otherSetting: 'value' },
    });

    const result = await caller.settings.getBranding();

    expect(result.brandColor).toBe('#FF5500');
    expect(result.logo).toBe('https://cdn.test/logo.png');
  });

  it('returns null brandColor when settingsJson has no brandColor key', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      logo: null,
      settingsJson: { someOtherKey: 'value' },
    });

    const result = await caller.settings.getBranding();

    expect(result.brandColor).toBeNull();
  });

  it('returns null logo when org has no logo set', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      logo: null,
      settingsJson: {},
    });

    const result = await caller.settings.getBranding();

    expect(result.logo).toBeNull();
  });
});

// ===========================================================================
// settings.updateBranding
// ===========================================================================

describe('settings.updateBranding', () => {
  it('saves brandColor as hex to organization settingsJson (PORT-08a)', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      settingsJson: { existingKey: 'keep' },
      logo: null,
    });
    mockPrisma.organization.update.mockResolvedValue({});

    const result = await caller.settings.updateBranding({
      brandColor: '#AA33CC',
    });

    expect(result.brandColor).toBe('#AA33CC');

    // Verify the update call merges into settingsJson
    const updateCall = mockPrisma.organization.update.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: ORG_ID });
    expect(updateCall.data.settingsJson).toMatchObject({
      existingKey: 'keep',
      brandColor: '#AA33CC',
    });
  });

  it('validates brandColor matches /^#[0-9a-fA-F]{6}$/ regex', async () => {
    await expect(caller.settings.updateBranding({ brandColor: '#xyz' })).rejects.toThrow();

    await expect(caller.settings.updateBranding({ brandColor: '#12345' })).rejects.toThrow();

    await expect(caller.settings.updateBranding({ brandColor: 'red' })).rejects.toThrow();
  });

  it("rejects invalid hex colors (e.g., '#xyz', '#12345', 'red')", async () => {
    // 7 chars instead of 6
    await expect(caller.settings.updateBranding({ brandColor: '#1234567' })).rejects.toThrow();
  });

  it('saves logoUrl to organization.logo field', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      settingsJson: {},
      logo: null,
    });
    mockPrisma.organization.update.mockResolvedValue({});

    const result = await caller.settings.updateBranding({
      logoUrl: 'https://cdn.test/new-logo.png',
    });

    expect(result.logo).toBe('https://cdn.test/new-logo.png');

    const updateCall = mockPrisma.organization.update.mock.calls[0][0];
    expect(updateCall.data.logo).toBe('https://cdn.test/new-logo.png');
  });

  it('accepts null brandColor to remove brand color', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      settingsJson: { brandColor: '#FF0000', otherKey: 'keep' },
      logo: 'logo.png',
    });
    mockPrisma.organization.update.mockResolvedValue({});

    const result = await caller.settings.updateBranding({
      brandColor: null,
    });

    expect(result.brandColor).toBeNull();

    // Verify brandColor was deleted from settingsJson
    const updateCall = mockPrisma.organization.update.mock.calls[0][0];
    expect(updateCall.data.settingsJson).not.toHaveProperty('brandColor');
    expect(updateCall.data.settingsJson).toHaveProperty('otherKey', 'keep');
  });

  it('accepts null logoUrl to remove logo', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      settingsJson: {},
      logo: 'https://cdn.test/old-logo.png',
    });
    mockPrisma.organization.update.mockResolvedValue({});

    const result = await caller.settings.updateBranding({
      logoUrl: null,
    });

    expect(result.logo).toBeNull();

    const updateCall = mockPrisma.organization.update.mock.calls[0][0];
    expect(updateCall.data.logo).toBeNull();
  });

  it('merges brandColor into existing settingsJson without overwriting other keys', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      settingsJson: { portalTheme: 'dark', lang: 'pl' },
      logo: null,
    });
    mockPrisma.organization.update.mockResolvedValue({});

    await caller.settings.updateBranding({
      brandColor: '#123456',
    });

    const updateCall = mockPrisma.organization.update.mock.calls[0][0];
    expect(updateCall.data.settingsJson).toMatchObject({
      portalTheme: 'dark',
      lang: 'pl',
      brandColor: '#123456',
    });
  });
});

// ===========================================================================
// portal.getSession — org name + logo for portal layout (no brandColor)
// ===========================================================================

describe('portal.getSession', () => {
  it('returns organization name and logo for portal layout', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: ORG_ID,
      name: 'Branded Org',
      logo: 'https://cdn.test/logo.png',
    });

    const result = await portalCaller.portal.getSession();

    expect(result.organization.id).toBe(ORG_ID);
    expect(result.organization.name).toBe('Branded Org');
    expect(result.organization.logo).toBe('https://cdn.test/logo.png');
    expect(result.contractor.id).toBe(CONTRACTOR_ID);
    expect(result.contractor.displayName).toBe('Portal Contractor');
    expect(result.contractor.email).toBe('portal@contractor.test');
  });

  it('returns null logo and empty name when organization row is missing', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    const result = await portalCaller.portal.getSession();

    expect(result.organization.name).toBe('');
    expect(result.organization.logo).toBeNull();
  });
});
