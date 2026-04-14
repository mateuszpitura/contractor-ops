import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockHasPermission = vi.fn();

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ dataRegion: 'EU' }),
    },
  };
  return { mockPrisma };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      hasPermission: (...args: unknown[]) => mockHasPermission(...args),
    },
  },
  authApi: {
    hasPermission: (...args: unknown[]) => mockHasPermission(...args),
  },
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

vi.mock('@contractor-ops/logger', () => ({
  createTrpcLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), distribution: vi.fn(), histogram: vi.fn() },
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
  tenantStore: {
    run: (_ctx: { organizationId: string; region: string }, fn: () => unknown) => fn(),
    getStore: vi.fn(),
  },
  getRegionalClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn((client: unknown) => client),
}));

import * as E from '../../errors.js';
import { publicProcedure, t } from '../../init.js';
import { adminProcedure, requirePermission } from '../rbac.js';
import { tenantProcedure } from '../tenant.js';

function authedWithOrg() {
  const userId = 'user_rbac';
  const session = {
    session: {
      id: 'sess-1',
      userId,
      activeOrganizationId: 'org_rbac',
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
      email: 't@example.com',
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
  return {
    headers: new Headers(),
    session: session as never,
    user: session.user as never,
  };
}

describe('requirePermission', () => {
  const router = t.router({
    contractorRead: tenantProcedure
      .use(requirePermission({ contractor: ['read'] }))
      .query(() => 'ok'),
  });
  const createCaller = t.createCallerFactory(router);

  beforeEach(() => {
    mockHasPermission.mockReset();
  });

  it('throws FORBIDDEN with PERMISSION_DENIED when hasPermission fails', async () => {
    mockHasPermission.mockResolvedValue({ success: false });
    try {
      await createCaller(authedWithOrg()).contractorRead();
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('FORBIDDEN');
      expect((e as TRPCError).message).toBe(E.PERMISSION_DENIED);
    }
    expect(mockHasPermission).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { permissions: { contractor: ['read'] } },
    });
  });

  it('passes when hasPermission succeeds', async () => {
    mockHasPermission.mockResolvedValue({ success: true });
    await expect(createCaller(authedWithOrg()).contractorRead()).resolves.toBe('ok');
  });
});

describe('adminProcedure', () => {
  const router = t.router({
    adminPing: adminProcedure.query(() => 'admin-ok'),
  });
  const createCaller = t.createCallerFactory(router);

  beforeEach(() => {
    mockHasPermission.mockReset();
  });

  it('chains auth → tenant → rbac and succeeds when organization:update is granted', async () => {
    mockHasPermission.mockResolvedValue({ success: true });
    await expect(createCaller(authedWithOrg()).adminPing()).resolves.toBe('admin-ok');
    expect(mockHasPermission).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { permissions: { organization: ['update'] } },
    });
  });
});

// ---------------------------------------------------------------------------
// API key auth path for requirePermission
// ---------------------------------------------------------------------------

function apiKeyCtx(
  overrides?: Partial<{
    authMode: 'apiKey';
    apiKeyId: string | undefined;
    apiKeyScopes: string[] | undefined;
    organizationId: string;
    region: string;
  }>,
) {
  return {
    headers: new Headers(),
    authMode: 'apiKey' as const,
    apiKeyId: 'key_test_123',
    apiKeyScopes: ['contractor:read', 'contractor:update'],
    session: null,
    user: null,
    organizationId: 'org_rbac',
    region: 'EU',
    ...overrides,
  };
}

describe('requirePermission — API key auth', () => {
  // Use publicProcedure (bypasses session-based auth/tenant chain) to isolate
  // the requirePermission middleware's API-key branch.
  const router = t.router({
    contractorReadUpdate: publicProcedure
      .use(requirePermission({ contractor: ['read', 'update'] }))
      .query(() => 'ok'),
  });
  const createCaller = t.createCallerFactory(router);

  it('passes through when API key has exactly the required scopes', async () => {
    const result = await createCaller(apiKeyCtx() as never).contractorReadUpdate();
    expect(result).toBe('ok');
  });

  it('passes through when API key has a superset of required scopes', async () => {
    const ctx = apiKeyCtx({
      apiKeyScopes: ['contractor:read', 'contractor:update', 'invoice:read', 'invoice:create'],
    });
    const result = await createCaller(ctx as never).contractorReadUpdate();
    expect(result).toBe('ok');
  });

  it('throws FORBIDDEN when apiKeyId is undefined', async () => {
    const ctx = apiKeyCtx({ apiKeyId: undefined });
    try {
      await createCaller(ctx as never).contractorReadUpdate();
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('FORBIDDEN');
      expect((e as TRPCError).message).toBe(E.PERMISSION_DENIED);
    }
  });

  it('throws FORBIDDEN when apiKeyScopes is undefined', async () => {
    const ctx = apiKeyCtx({ apiKeyScopes: undefined });
    try {
      await createCaller(ctx as never).contractorReadUpdate();
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('FORBIDDEN');
      expect((e as TRPCError).message).toBe(E.PERMISSION_DENIED);
    }
  });

  it('throws FORBIDDEN when API key has only partial scopes', async () => {
    const ctx = apiKeyCtx({
      apiKeyScopes: ['contractor:read'], // missing contractor:update
    });
    try {
      await createCaller(ctx as never).contractorReadUpdate();
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('FORBIDDEN');
      expect((e as TRPCError).message).toBe(E.PERMISSION_DENIED);
    }
  });

  it('does not call hasPermission for API key auth mode', async () => {
    mockHasPermission.mockReset();
    await createCaller(apiKeyCtx() as never).contractorReadUpdate();
    expect(mockHasPermission).not.toHaveBeenCalled();
  });
});
