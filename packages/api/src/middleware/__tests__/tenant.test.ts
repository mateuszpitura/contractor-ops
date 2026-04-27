import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, tenantStoreRun } = vi.hoisted(() => {
  const mockPrisma = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ dataRegion: 'EU' }),
    },
  };
  const tenantStoreRun = vi.fn(
    (_ctx: { organizationId: string; region: string }, fn: () => unknown) => fn(),
  );
  return { mockPrisma, tenantStoreRun };
});

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
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), distribution: vi.fn(), histogram: vi.fn() },
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
  tenantStore: {
    run: tenantStoreRun,
    getStore: vi.fn(),
  },
  getRegionalClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn((client: unknown) => client),
}));

import { t } from '../../init.js';
import { tenantProcedure } from '../tenant.js';

function authedCtx(orgId: string | null) {
  const userId = 'user_tenant_test';
  const session = {
    session: {
      id: 'sess-1',
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

describe('tenantMiddleware', () => {
  const router = t.router({
    scoped: tenantProcedure.query(({ ctx }) => ({
      organizationId: ctx.organizationId,
    })),
  });
  const createCaller = t.createCallerFactory(router);

  beforeEach(() => {
    tenantStoreRun.mockClear();
  });

  it('throws UNAUTHORIZED when session is missing', async () => {
    await expect(
      createCaller({
        headers: new Headers(),
        session: null,
        user: null,
      }).scoped(),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws FORBIDDEN when no active organization', async () => {
    await expect(createCaller(authedCtx(null)).scoped()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('runs tenantStore with organizationId and exposes ctx.organizationId', async () => {
    const ctx = authedCtx('org_abc');
    const result = await createCaller(ctx).scoped();
    expect(result.organizationId).toBe('org_abc');
    expect(tenantStoreRun).toHaveBeenCalledWith(
      { organizationId: 'org_abc', region: 'EU' },
      expect.any(Function),
    );
  });
});
