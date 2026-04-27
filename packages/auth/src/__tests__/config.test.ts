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

  it('does NOT register Google/Microsoft providers when env vars are absent', async () => {
    const { auth } = await import('../config.js');
    // Test env has no GOOGLE_/MICROSOFT_ vars set, so neither provider should
    // appear — the previous `as string` cast silently registered both with
    // `undefined` credentials, which is the bug we're guarding against.
    const providers = auth.options.socialProviders ?? {};
    expect(providers).not.toHaveProperty('google');
    expect(providers).not.toHaveProperty('microsoft');
  });

  it('excludes microsoft from accountLinking.trustedProviders', async () => {
    const { auth } = await import('../config.js');
    // Microsoft consumer tenants historically allow self-asserted email;
    // auto-linking on microsoft-supplied email is an account-takeover vector.
    const trusted = auth.options.account?.accountLinking?.trustedProviders ?? [];
    expect(trusted).not.toContain('microsoft');
    expect(trusted).toContain('google');
  });

  it('configures secure cookie attribute based on production flag', async () => {
    const { auth } = await import('../config.js');
    // NODE_ENV is "test" during vitest run — so secure should be false.
    expect(auth.options.advanced?.defaultCookieAttributes?.secure).toBe(false);
    expect(auth.options.advanced?.defaultCookieAttributes?.sameSite).toBe('lax');
  });
});
