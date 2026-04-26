import { TRPCError } from '@trpc/server';
import { describe, expect, it, vi } from 'vitest';

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

import { t } from '../../init.js';
import { authMiddleware } from '../auth.js';

function baseSession(userId: string, overrides: { banned?: boolean } = {}) {
  return {
    session: {
      id: `session-${userId}`,
      userId,
      activeOrganizationId: 'org_test',
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
      banned: overrides.banned ?? false,
      banReason: null,
      banExpires: null,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

describe('authMiddleware', () => {
  const router = t.router({
    protected: t.procedure.use(authMiddleware).query(({ ctx }) => ({
      userId: ctx.user.id,
    })),
  });
  const createCaller = t.createCallerFactory(router);

  it('throws UNAUTHORIZED when session is missing', async () => {
    await expect(
      createCaller({
        headers: new Headers(),
        session: null,
        user: null,
      }).protected(),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws UNAUTHORIZED when user is missing', async () => {
    await expect(
      createCaller({
        headers: new Headers(),
        session: baseSession('u1') as never,
        user: null,
      }).protected(),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws FORBIDDEN with ACCOUNT_BANNED when user is banned', async () => {
    const session = baseSession('u_banned', { banned: true });
    try {
      await createCaller({
        headers: new Headers(),
        session: session as never,
        user: session.user as never,
      }).protected();
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('FORBIDDEN');
      expect((e as TRPCError).message).toBe('ACCOUNT_BANNED');
    }
  });

  it('passes session and user through on success', async () => {
    const session = baseSession('u_ok');
    const result = await createCaller({
      headers: new Headers(),
      session: session as never,
      user: session.user as never,
    }).protected();
    expect(result.userId).toBe('u_ok');
  });
});
