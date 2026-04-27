import { describe, expect, it } from 'vitest';
import { loadAuthEnv } from '../env.js';

const minimalDevEnv = (overrides: Record<string, string | undefined> = {}) => ({
  NODE_ENV: 'development',
  ...overrides,
});

describe('loadAuthEnv', () => {
  it('returns a resolved env in development without any auth secrets', () => {
    const env = loadAuthEnv(minimalDevEnv() as NodeJS.ProcessEnv);
    expect(env.isDevelopment).toBe(true);
    expect(env.isProduction).toBe(false);
    expect(env.betterAuthSecret).toBeUndefined();
    expect(env.google).toBeNull();
    expect(env.microsoft).toBeNull();
    expect(env.trustedOrigins).toEqual([]);
  });

  it('throws when only one half of an OAuth credential pair is present', () => {
    expect(() =>
      loadAuthEnv(minimalDevEnv({ GOOGLE_CLIENT_ID: 'id-only' }) as NodeJS.ProcessEnv),
    ).toThrow(/GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together/);

    expect(() =>
      loadAuthEnv(minimalDevEnv({ MICROSOFT_CLIENT_SECRET: 'secret-only' }) as NodeJS.ProcessEnv),
    ).toThrow(/MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be set together/);
  });

  it('registers Google when both id and secret are present', () => {
    const env = loadAuthEnv(
      minimalDevEnv({
        GOOGLE_CLIENT_ID: 'g-id',
        GOOGLE_CLIENT_SECRET: 'g-secret',
      }) as NodeJS.ProcessEnv,
    );
    expect(env.google).toEqual({ clientId: 'g-id', clientSecret: 'g-secret' });
    expect(env.microsoft).toBeNull();
  });

  it('throws in production when BETTER_AUTH_SECRET is missing', () => {
    expect(() =>
      loadAuthEnv({
        NODE_ENV: 'production',
        BETTER_AUTH_URL: 'https://app.example.com',
        NEXT_PUBLIC_APP_URL: 'https://app.example.com',
      } as NodeJS.ProcessEnv),
    ).toThrow(/BETTER_AUTH_SECRET is required in production/);
  });

  it('rejects a BETTER_AUTH_SECRET shorter than 16 characters', () => {
    expect(() =>
      loadAuthEnv(minimalDevEnv({ BETTER_AUTH_SECRET: 'short' }) as NodeJS.ProcessEnv),
    ).toThrow(/at least 16 characters/);
  });

  it('seeds trustedOrigins from baseURL and AUTH_TRUSTED_ORIGINS list', () => {
    const env = loadAuthEnv(
      minimalDevEnv({
        BETTER_AUTH_URL: 'https://app.example.com',
        AUTH_TRUSTED_ORIGINS: 'https://preview.example.com, https://admin.example.com',
      }) as NodeJS.ProcessEnv,
    );
    expect(env.baseURL).toBe('https://app.example.com');
    expect(env.trustedOrigins).toEqual([
      'https://app.example.com',
      'https://preview.example.com',
      'https://admin.example.com',
    ]);
  });

  it('falls back to NEXT_PUBLIC_APP_URL when BETTER_AUTH_URL is missing', () => {
    const env = loadAuthEnv(
      minimalDevEnv({ NEXT_PUBLIC_APP_URL: 'https://app.example.com' }) as NodeJS.ProcessEnv,
    );
    expect(env.baseURL).toBe('https://app.example.com');
    expect(env.trustedOrigins).toEqual(['https://app.example.com']);
  });

  it('rejects malformed entries in AUTH_TRUSTED_ORIGINS', () => {
    expect(() =>
      loadAuthEnv(
        minimalDevEnv({
          BETTER_AUTH_URL: 'https://app.example.com',
          AUTH_TRUSTED_ORIGINS: 'https://ok.example.com, not-a-url',
        }) as NodeJS.ProcessEnv,
      ),
    ).toThrow(/AUTH_TRUSTED_ORIGINS contains invalid URL/);
  });
});
