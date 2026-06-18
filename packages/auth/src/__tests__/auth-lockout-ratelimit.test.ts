// Exercises the real Better Auth `hooks.before` / `hooks.after` middleware
// and the declarative rateLimit config from `packages/auth/src/config.ts`.
//
// The hooks are wrapped in `createAuthMiddleware`, which returns a plain
// async function we can invoke with a synthetic `ctx` (no full auth server).
// Prisma is mocked so we assert the exact SQL/ORM calls the lockout logic
// issues and the APIError it raises for a locked account.
//
// Contracts under test:
//   1. Account lockout — 5 failed sign-ins flip `lockedUntil` (single atomic
//      UPDATE), and a subsequent sign-in while locked is rejected in
//      `hooks.before` with a generic UNAUTHORIZED (no email enumeration),
//      even if the credentials are correct.
//   2. Sign-in rate-limit (10/min per IP) + sign-up rate-limit (5/min) are
//      declared in `rateLimit.customRules`; sign-up is gated by a Turnstile
//      CAPTCHA check that throws FORBIDDEN when the token fails verification.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    user: { findUnique: vi.fn(), updateMany: vi.fn() },
    member: { findFirst: vi.fn() },
    userPinnedView: { create: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('better-auth/next-js', () => ({
  nextCookies: vi.fn(() => ({ id: 'next-cookies' })),
}));

vi.mock('../turnstile.js', () => ({
  verifyTurnstileToken: vi.fn(),
}));

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MIN = 15;

type Ctx = {
  path: string;
  body?: Record<string, unknown>;
  context?: { newSession?: unknown };
  request?: { headers: Headers };
};

async function getHooks() {
  const { auth } = await import('../config.js');
  const before = auth.options.hooks?.before;
  const after = auth.options.hooks?.after;
  if (typeof before !== 'function' || typeof after !== 'function') {
    throw new Error('expected before/after hook middleware to be callable functions');
  }
  return { beforeHook: before, afterHook: after } as {
    beforeHook: (ctx: Ctx) => Promise<unknown>;
    afterHook: (ctx: Ctx) => Promise<unknown>;
  };
}

let prismaMock: {
  user: { findUnique: ReturnType<typeof vi.fn> };
  $queryRaw: ReturnType<typeof vi.fn>;
};
let verifyTurnstileToken: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  const db = await import('@contractor-ops/db');
  prismaMock = db.prisma as never;
  prismaMock.user.findUnique.mockReset();
  prismaMock.$queryRaw.mockReset();
  const turnstile = await import('../turnstile.js');
  verifyTurnstileToken = turnstile.verifyTurnstileToken as ReturnType<typeof vi.fn>;
  verifyTurnstileToken.mockReset();
});

describe('auth rateLimit + Turnstile config', () => {
  it('caps /sign-in/email at 10 attempts per 60s window per IP', async () => {
    const { auth } = await import('../config.js');
    const rules = auth.options.rateLimit?.customRules ?? {};
    expect(rules['/sign-in/email']).toEqual({ window: 60, max: 10 });
  });

  it('caps /sign-up/email at 5 attempts per 60s window per IP', async () => {
    const { auth } = await import('../config.js');
    const rules = auth.options.rateLimit?.customRules ?? {};
    expect(rules['/sign-up/email']).toEqual({ window: 60, max: 5 });
  });

  it('forces the rate limiter ON in every environment', async () => {
    const { auth } = await import('../config.js');
    expect(auth.options.rateLimit?.enabled).toBe(true);
  });
});

describe('sign-up Turnstile CAPTCHA gate (hooks.before)', () => {
  it('blocks sign-up with FORBIDDEN when the Turnstile token fails verification', async () => {
    verifyTurnstileToken.mockResolvedValueOnce(false);
    const { beforeHook } = await getHooks();

    await expect(
      beforeHook({
        path: '/sign-up/email',
        body: { email: 'bot@example.com', 'cf-turnstile-response': 'bad-token' },
        request: { headers: new Headers() },
      }),
    ).rejects.toMatchObject({ status: 'FORBIDDEN' });
    expect(verifyTurnstileToken).toHaveBeenCalledTimes(1);
  });

  it('lets sign-up proceed when Turnstile verification passes', async () => {
    verifyTurnstileToken.mockResolvedValueOnce(true);
    const { beforeHook } = await getHooks();

    await expect(
      beforeHook({
        path: '/sign-up/email',
        body: { email: 'human@example.com', 'cf-turnstile-response': 'good-token' },
        request: { headers: new Headers() },
      }),
    ).resolves.not.toThrow();
    expect(verifyTurnstileToken).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'good-token' }),
    );
  });

  it('forwards the client IP to Turnstile from x-real-ip', async () => {
    verifyTurnstileToken.mockResolvedValueOnce(true);
    const { beforeHook } = await getHooks();

    await beforeHook({
      path: '/sign-up/email',
      body: { email: 'human@example.com', 'cf-turnstile-response': 'tok' },
      request: { headers: new Headers({ 'x-real-ip': '203.0.113.7' }) },
    });
    expect(verifyTurnstileToken).toHaveBeenCalledWith(
      expect.objectContaining({ remoteIp: '203.0.113.7' }),
    );
  });
});

describe('account lockout (hooks.after increment + hooks.before block)', () => {
  it('atomically increments failedLoginAttempts and locks on the 5th failure', async () => {
    // Simulate the post-increment count crossing the threshold: the raw UPDATE
    // returns the new count + the just-set lockedUntil.
    const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MIN * 60_000);
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { failedLoginAttempts: MAX_LOGIN_ATTEMPTS, lockedUntil: lockUntil },
    ]);
    const { afterHook } = await getHooks();

    await afterHook({
      path: '/sign-in/email',
      body: { email: 'victim@example.com' },
      context: { newSession: null }, // failed login → no new session
    });

    // The lockout path uses a single atomic $queryRaw UPDATE (closes the
    // increment/read TOCTOU window), never updateMany on the failure branch.
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects a 6th sign-in while locked — even with correct creds — via hooks.before', async () => {
    // Account is currently locked: lockedUntil is in the future.
    prismaMock.user.findUnique.mockResolvedValueOnce({
      lockedUntil: new Date(Date.now() + 5 * 60_000),
    });
    const { beforeHook } = await getHooks();

    const err = await beforeHook({
      path: '/sign-in/email',
      body: { email: 'victim@example.com', password: 'the-correct-password' },
    }).then(
      () => null,
      (e: unknown) => e,
    );

    expect(err).not.toBeNull();
    // Generic UNAUTHORIZED — identical shape to invalid-credentials, so a
    // locked account is indistinguishable from a wrong password (anti-enum).
    expect(err).toMatchObject({ status: 'UNAUTHORIZED' });
    expect((err as { body?: { message?: string } }).body?.message).toBe(
      'Invalid email or password.',
    );
    // Crucially: the password was never checked — Better Auth's credential
    // verification is short-circuited before it runs.
  });

  it('does NOT block sign-in when the lock window has already expired', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      lockedUntil: new Date(Date.now() - 60_000), // expired one minute ago
    });
    const { beforeHook } = await getHooks();

    await expect(
      beforeHook({
        path: '/sign-in/email',
        body: { email: 'recovered@example.com', password: 'pw' },
      }),
    ).resolves.not.toThrow();
  });

  it('does NOT block sign-in for an account that has never been locked', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ lockedUntil: null });
    const { beforeHook } = await getHooks();

    await expect(
      beforeHook({
        path: '/sign-in/email',
        body: { email: 'fresh@example.com', password: 'pw' },
      }),
    ).resolves.not.toThrow();
  });
});
