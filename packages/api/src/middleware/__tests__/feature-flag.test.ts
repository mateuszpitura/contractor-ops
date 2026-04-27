import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockLazyFlagBag } = vi.hoisted(() => ({
  mockLazyFlagBag: vi.fn(),
}));

vi.mock('@contractor-ops/feature-flags', () => ({
  lazyFlagBag: mockLazyFlagBag,
}));

vi.mock('@contractor-ops/logger', () => ({
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), distribution: vi.fn(), histogram: vi.fn() },
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = {
    setStatus: vi.fn(),
    setAttribute: vi.fn(),
    end: vi.fn(),
  };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ dataRegion: 'EU' }),
    },
  };
  return { mockPrisma };
});

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
  tenantStore: {
    run: (_ctx: { organizationId: string; region: string }, fn: () => unknown) => fn(),
    getStore: vi.fn(),
  },
  getRegionalClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn((client: unknown) => client),
}));

import { t } from '../../init.js';
import { requireFeatureFlag, tenantFlaggedProcedure } from '../feature-flag.js';
import { tenantProcedure } from '../tenant.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authedCtx() {
  const userId = 'user_ff';
  return {
    headers: new Headers(),
    session: {
      session: {
        id: 'sess-ff',
        userId,
        activeOrganizationId: 'org_ff',
        expiresAt: new Date('2099-01-01'),
        token: 'mock-token',
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
      },
      user: {
        id: userId,
        name: 'Test',
        email: 'ff@example.com',
        emailVerified: true,
        image: null,
        banned: false,
        banReason: null,
        banExpires: null,
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as never,
    user: {
      id: userId,
      name: 'Test',
      email: 'ff@example.com',
      emailVerified: true,
      image: null,
      banned: false,
      banReason: null,
      banExpires: null,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tenantFlaggedProcedure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attaches ctx.flags via lazyFlagBag with correct params', async () => {
    const mockBag = { isEnabled: vi.fn().mockReturnValue(true) };
    mockLazyFlagBag.mockReturnValue(mockBag);

    const router = t.router({
      ping: tenantFlaggedProcedure.query(({ ctx }) => {
        // Verify flags are available
        return { hasFlags: !!(ctx as Record<string, unknown>).flags };
      }),
    });

    const caller = t.createCallerFactory(router)(authedCtx());
    const result = await caller.ping();

    expect(result.hasFlags).toBe(true);
    expect(mockLazyFlagBag).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_ff',
        organizationId: 'org_ff',
        region: 'EU',
      }),
    );
  });

  it('coerces unknown region to EU', async () => {
    const mockBag = { isEnabled: vi.fn().mockReturnValue(true) };
    mockLazyFlagBag.mockReturnValue(mockBag);

    // Override org to return unusual region
    mockPrisma.organization.findUnique.mockResolvedValue({ dataRegion: 'APAC' });

    const router = t.router({
      ping: tenantFlaggedProcedure.query(() => 'ok'),
    });

    const caller = t.createCallerFactory(router)(authedCtx());
    await caller.ping();

    expect(mockLazyFlagBag).toHaveBeenCalledWith(expect.objectContaining({ region: 'EU' }));
  });

  it('passes ME region through when org has ME', async () => {
    const mockBag = { isEnabled: vi.fn().mockReturnValue(true) };
    mockLazyFlagBag.mockReturnValue(mockBag);

    mockPrisma.organization.findUnique.mockResolvedValue({ dataRegion: 'ME' });

    const router = t.router({
      ping: tenantFlaggedProcedure.query(() => 'ok'),
    });

    const caller = t.createCallerFactory(router)(authedCtx());
    await caller.ping();

    expect(mockLazyFlagBag).toHaveBeenCalledWith(expect.objectContaining({ region: 'ME' }));
  });
});

describe('requireFeatureFlag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes when flag is enabled', async () => {
    const mockBag = { isEnabled: vi.fn().mockReturnValue(true) };
    mockLazyFlagBag.mockReturnValue(mockBag);

    const router = t.router({
      gated: tenantFlaggedProcedure
        .use(requireFeatureFlag('module.legal-approval' as never))
        .query(() => 'allowed'),
    });

    const caller = t.createCallerFactory(router)(authedCtx());
    await expect(caller.gated()).resolves.toBe('allowed');
    expect(mockBag.isEnabled).toHaveBeenCalledWith('module.legal-approval');
  });

  it('throws NOT_FOUND when flag is disabled', async () => {
    const mockBag = { isEnabled: vi.fn().mockReturnValue(false) };
    mockLazyFlagBag.mockReturnValue(mockBag);

    const router = t.router({
      gated: tenantFlaggedProcedure
        .use(requireFeatureFlag('module.legal-approval' as never))
        .query(() => 'allowed'),
    });

    const caller = t.createCallerFactory(router)(authedCtx());
    try {
      await caller.gated();
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('NOT_FOUND');
    }
  });

  it('throws INTERNAL_SERVER_ERROR when ctx.flags is missing', async () => {
    // Use tenantProcedure (without flags) + requireFeatureFlag
    const router = t.router({
      noFlags: tenantProcedure
        .use(requireFeatureFlag('module.legal-approval' as never))
        .query(() => 'never'),
    });

    const caller = t.createCallerFactory(router)(authedCtx());
    try {
      await caller.noFlags();
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('INTERNAL_SERVER_ERROR');
      expect((e as TRPCError).message).toContain(
        'requireFeatureFlag used on a procedure without ctx.flags',
      );
    }
  });
});
