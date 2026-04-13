/**
 * Server/client env validation — startup boundary.
 */

import { describe, expect, it } from 'vitest';
import { clientEnvSchema, serverEnvSchema, validateClientEnv, validateServerEnv } from '../env.js';
import { minimalServerEnv } from '../minimal-server-env.js';

function minimalValidServerEnv(): Record<string, string> {
  return minimalServerEnv();
}

describe('serverEnvSchema', () => {
  it('parses a complete valid env object', () => {
    const result = serverEnvSchema.safeParse(minimalValidServerEnv());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development');
      expect(result.data.EMAIL_FROM).toBe('noreply@contractor-ops.com');
      expect(result.data.R2_BUCKET_NAME).toBeUndefined();
    }
  });

  it('rejects BETTER_AUTH_SECRET shorter than 16 characters', () => {
    const env = { ...minimalValidServerEnv(), BETTER_AUTH_SECRET: 'short' };
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it('rejects STRIPE_SECRET_KEY without sk_ prefix', () => {
    const env = { ...minimalValidServerEnv(), STRIPE_SECRET_KEY: 'bad' };
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it('rejects invalid hex encryption key', () => {
    const env = {
      ...minimalValidServerEnv(),
      BANK_ACCOUNT_ENCRYPTION_KEY: 'not-hex'.padEnd(64, '0'),
    };
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it('rejects CRON_SECRET shorter than 16 characters', () => {
    const env = { ...minimalValidServerEnv(), CRON_SECRET: 'tooshort' };
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(false);
  });
});

describe('validateServerEnv', () => {
  it('returns parsed env when valid', () => {
    const out = validateServerEnv(minimalValidServerEnv());
    expect(out.DATABASE_URL).toContain('postgresql');
  });

  it('throws with aggregated message when invalid', () => {
    const bad = { ...minimalValidServerEnv(), BETTER_AUTH_SECRET: 'x' };
    expect(() => validateServerEnv(bad)).toThrow(/Environment validation failed/);
    expect(() => validateServerEnv(bad)).toThrow(/BETTER_AUTH_SECRET/);
  });
});

describe('clientEnvSchema', () => {
  it('applies defaults for empty input', () => {
    const result = clientEnvSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
    }
  });

  it('rejects invalid NEXT_PUBLIC_APP_URL', () => {
    const result = clientEnvSchema.safeParse({
      NEXT_PUBLIC_APP_URL: 'not a url',
    });
    expect(result.success).toBe(false);
  });
});

describe('validateClientEnv', () => {
  it('returns defaults when optional keys omitted', () => {
    const out = validateClientEnv({});
    expect(out.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
  });

  it('throws when validation fails', () => {
    expect(() => validateClientEnv({ NEXT_PUBLIC_APP_URL: 'bad' })).toThrow(
      /Client environment validation failed/,
    );
  });
});
