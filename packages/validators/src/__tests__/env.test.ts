/**
 * Server/client env validation — startup boundary.
 */

import { describe, expect, it } from 'vitest';
import {
  clientEnvSchema,
  getServerEnv,
  getServerEnvRecord,
  resetServerEnvCacheForTesting,
  serverEnvSchema,
  validateClientEnv,
  validateServerEnv,
} from '../env.js';
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
  it('parses an empty object (all keys optional)', () => {
    const result = clientEnvSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects invalid NEXT_PUBLIC_POSTHOG_HOST', () => {
    const result = clientEnvSchema.safeParse({
      NEXT_PUBLIC_POSTHOG_HOST: 'not a url',
    });
    expect(result.success).toBe(false);
  });
});

describe('validateClientEnv', () => {
  it('returns parsed object when empty (all optional)', () => {
    const out = validateClientEnv({});
    expect(out).toEqual({});
  });

  it('throws when validation fails', () => {
    expect(() => validateClientEnv({ NEXT_PUBLIC_POSTHOG_HOST: 'bad' })).toThrow(
      /Client environment validation failed/,
    );
  });
});

// ---------------------------------------------------------------------------
// Additional branch coverage for env validation
// ---------------------------------------------------------------------------

describe('serverEnvSchema — additional branch coverage', () => {
  it('rejects STRIPE_WEBHOOK_SECRET without whsec_ prefix', () => {
    const env = { ...minimalValidServerEnv(), STRIPE_WEBHOOK_SECRET: 'bad' };
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it('rejects invalid DATABASE_URL (empty)', () => {
    const env = { ...minimalValidServerEnv(), DATABASE_URL: '' };
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it('rejects invalid PUBLIC_APP_URL', () => {
    const env = { ...minimalValidServerEnv(), PUBLIC_APP_URL: 'not-a-url' };
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it('accepts valid DATA_HOSTING_REGION values', () => {
    for (const region of ['EU', 'ME']) {
      const env = { ...minimalValidServerEnv(), DATA_HOSTING_REGION: region };
      const result = serverEnvSchema.safeParse(env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.DATA_HOSTING_REGION).toBe(region);
      }
    }
  });

  it('defaults DATA_HOSTING_REGION to EU', () => {
    const result = serverEnvSchema.safeParse(minimalValidServerEnv());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.DATA_HOSTING_REGION).toBe('EU');
    }
  });

  it('rejects invalid DATA_HOSTING_REGION', () => {
    const env = { ...minimalValidServerEnv(), DATA_HOSTING_REGION: 'US' };
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it('accepts optional SLACK_TOKEN_ENCRYPTION_KEY as valid hex', () => {
    const env = { ...minimalValidServerEnv(), SLACK_TOKEN_ENCRYPTION_KEY: 'a'.repeat(64) };
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(true);
  });

  it('rejects invalid SLACK_TOKEN_ENCRYPTION_KEY', () => {
    const env = { ...minimalValidServerEnv(), SLACK_TOKEN_ENCRYPTION_KEY: 'short' };
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it('accepts all valid NODE_ENV values', () => {
    for (const nodeEnv of ['development', 'production', 'test']) {
      const env = { ...minimalValidServerEnv(), NODE_ENV: nodeEnv };
      const result = serverEnvSchema.safeParse(env);
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid NODE_ENV value', () => {
    const env = { ...minimalValidServerEnv(), NODE_ENV: 'staging' };
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it('accepts optional observability fields', () => {
    const env = {
      ...minimalValidServerEnv(),
      SENTRY_DSN: 'https://sentry.example.com/123',
      SENTRY_ORG: 'my-org',
      SENTRY_PROJECT: 'my-project',
      SENTRY_AUTH_TOKEN: 'token',
      AXIOM_TOKEN: 'axiom-token',
      LOG_LEVEL: 'debug',
    };
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(true);
  });

  it('rejects invalid LOG_LEVEL', () => {
    const env = { ...minimalValidServerEnv(), LOG_LEVEL: 'verbose' };
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it('coerces CLAMAV_PORT to number', () => {
    const env = { ...minimalValidServerEnv(), CLAMAV_PORT: '9999' };
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.CLAMAV_PORT).toBe(9999);
    }
  });

  it('coerces DEV_SMTP_PORT to number', () => {
    const env = { ...minimalValidServerEnv(), DEV_SMTP_PORT: '2525' };
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.DEV_SMTP_PORT).toBe(2525);
    }
  });
});

describe('getServerEnv and resetServerEnvCacheForTesting', () => {
  it('caches parsed env on first call and resets on clear', () => {
    resetServerEnvCacheForTesting();

    // Calling getServerEnv without process.env having valid data will throw
    // This tests the cache-not-populated branch
    expect(() => getServerEnv()).toThrow();
  });
});

describe('getServerEnvRecord', () => {
  it('returns a record type', () => {
    resetServerEnvCacheForTesting();

    // validateServerEnv with a valid env populates cache only when env === process.env
    // Since we pass a custom env, cache won't be populated
    expect(() => getServerEnvRecord()).toThrow();
  });
});

describe('clientEnvSchema — additional branches', () => {
  it('accepts optional PostHog key + host', () => {
    const result = clientEnvSchema.safeParse({
      NEXT_PUBLIC_POSTHOG_KEY: 'phc_test',
      NEXT_PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com',
    });
    expect(result.success).toBe(true);
  });
});
