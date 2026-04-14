import { describe, expect, it, vi } from 'vitest';

// Mock heavy dependencies to avoid spinning up a full auth server
vi.mock('@contractor-ops/db', () => ({
  prisma: {
    user: { findUnique: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock('better-auth/next-js', () => ({
  nextCookies: vi.fn(() => ({ id: 'next-cookies' })),
}));

describe('auth config exports', () => {
  it('exports auth as a defined object', async () => {
    const { auth } = await import('../config.js');
    expect(auth).toBeDefined();
    expect(typeof auth).toBe('object');
  });

  it('exports authApi as a defined object matching auth.api', async () => {
    const { auth, authApi } = await import('../config.js');
    expect(authApi).toBeDefined();
    expect(authApi).toBe(auth.api);
  });

  it('auth has handler and api properties', async () => {
    const { auth } = await import('../config.js');
    expect(auth.handler).toBeDefined();
    expect(auth.api).toBeDefined();
  });

  it('auth session config uses expected expiry', async () => {
    const { auth } = await import('../config.js');
    // betterAuth exposes options — session should be configured
    expect(auth.options.session).toBeDefined();
    expect(auth.options.session?.expiresIn).toBe(60 * 60 * 24); // 24 hours
    expect(auth.options.session?.updateAge).toBe(60 * 60); // 1 hour
  });

  it('auth has email+password enabled', async () => {
    const { auth } = await import('../config.js');
    expect(auth.options.emailAndPassword?.enabled).toBe(true);
    expect(auth.options.emailAndPassword?.requireEmailVerification).toBe(true);
  });
});
