import { TRPCError } from '@trpc/server';
import { describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ dataRegion: 'EU' }),
    },
  };
  return { mockPrisma };
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
    run: (_ctx: { organizationId: string; region: string }, fn: () => unknown) => fn(),
    getStore: vi.fn(),
  },
  getRegionalClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn((client: unknown) => client),
}));

import { t } from '../../init.js';
import { sensitiveActionProcedure } from '../sensitive.js';

function ctxWithSessionAge(createdAt: Date) {
  const userId = 'user_sens';
  const session = {
    session: {
      id: 'sess-1',
      userId,
      activeOrganizationId: 'org_sens',
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt,
      updatedAt: createdAt,
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

describe('sensitiveActionProcedure', () => {
  const router = t.router({
    sensitive: sensitiveActionProcedure.query(() => 'ok'),
  });
  const createCaller = t.createCallerFactory(router);

  it('throws UNAUTHORIZED when session is missing', async () => {
    await expect(
      createCaller({
        headers: new Headers(),
        session: null,
        user: null,
      }).sensitive(),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws FORBIDDEN with REAUTH_REQUIRED cause when session is older than 5 minutes', async () => {
    const old = new Date(Date.now() - 6 * 60 * 1000);
    try {
      await createCaller(ctxWithSessionAge(old)).sensitive();
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('FORBIDDEN');
      const cause = (e as TRPCError).cause;
      if (cause instanceof Error) {
        expect(cause.message).toBe('REAUTH_REQUIRED');
      } else {
        expect(cause).toBe('REAUTH_REQUIRED');
      }
    }
  });

  it('passes when session is fresh', async () => {
    const recent = new Date(Date.now() - 60 * 1000);
    await expect(createCaller(ctxWithSessionAge(recent)).sensitive()).resolves.toBe('ok');
  });
});
