import { describe, expect, it } from 'vitest';
import { minimalServerEnv } from '../minimal-server-env.js';
import { serverEnvSchema } from '../env.js';

describe('minimalServerEnv', () => {
  it('returns a Record<string, string>', () => {
    const env = minimalServerEnv();
    expect(typeof env).toBe('object');
    for (const [key, value] of Object.entries(env)) {
      expect(typeof key).toBe('string');
      expect(typeof value).toBe('string');
    }
  });

  it('passes serverEnvSchema validation', () => {
    const env = minimalServerEnv();
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(true);
  });

  it('returns a fresh object on each call (no shared mutation risk)', () => {
    const a = minimalServerEnv();
    const b = minimalServerEnv();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('contains required core variables', () => {
    const env = minimalServerEnv();
    expect(env.NODE_ENV).toBe('development');
    expect(env.DATABASE_URL).toBeDefined();
    expect(env.BETTER_AUTH_SECRET).toBeDefined();
    expect(env.STRIPE_SECRET_KEY).toMatch(/^sk_/);
    expect(env.STRIPE_WEBHOOK_SECRET).toMatch(/^whsec_/);
    expect(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).toMatch(/^pk_/);
  });

  it('contains valid 64-char hex strings for encryption keys', () => {
    const env = minimalServerEnv();
    const hex64Regex = /^[0-9a-f]{64}$/i;
    expect(env.BANK_ACCOUNT_ENCRYPTION_KEY).toMatch(hex64Regex);
    expect(env.SLACK_TOKEN_ENCRYPTION_KEY).toMatch(hex64Regex);
  });

  it('contains Upstash Redis variables for cache resolution', () => {
    const env = minimalServerEnv();
    expect(env.UPSTASH_REDIS_REST_URL).toBeDefined();
    expect(env.UPSTASH_REDIS_REST_TOKEN).toBeDefined();
  });
});
