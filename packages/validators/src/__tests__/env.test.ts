/**
 * Server/client env validation — startup boundary.
 */

import { describe, expect, it } from 'vitest';
import { clientEnvSchema, serverEnvSchema, validateClientEnv, validateServerEnv } from '../env.js';

/** 64-char lowercase hex (32 bytes) for encryption key fields */
const HEX32 = 'a'.repeat(64);

function minimalValidServerEnv(): Record<string, string> {
  return {
    NODE_ENV: 'development',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    APP_URL: 'http://localhost:3000',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    BETTER_AUTH_SECRET: '1234567890123456',
    BETTER_AUTH_URL: 'http://localhost:3000',
    GOOGLE_CLIENT_ID: 'g',
    GOOGLE_CLIENT_SECRET: 'g',
    MICROSOFT_CLIENT_ID: 'm',
    MICROSOFT_CLIENT_SECRET: 'm',
    STRIPE_SECRET_KEY: 'sk_test_xxxxxxxx',
    STRIPE_WEBHOOK_SECRET: 'whsec_xxxxxxxx',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_xxxx',
    STRIPE_PRICE_STARTER: 'price_1',
    STRIPE_PRICE_PRO: 'price_2',
    STRIPE_PRICE_ENTERPRISE: 'price_3',
    NEXT_PUBLIC_STRIPE_PRICE_TOPUP_10: 'price_t10',
    NEXT_PUBLIC_STRIPE_PRICE_TOPUP_25: 'price_t25',
    NEXT_PUBLIC_STRIPE_PRICE_TOPUP_50: 'price_t50',
    RESEND_API_KEY: 're_xxx',
    RESEND_WEBHOOK_SECRET: 'wh_xxx',
    R2_ACCOUNT_ID: 'r2',
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
    SLACK_CLIENT_ID: 's',
    SLACK_CLIENT_SECRET: 's',
    SLACK_SIGNING_SECRET: 'sig',
    SLACK_TOKEN_ENCRYPTION_KEY: HEX32,
    JIRA_CLIENT_ID: 'j',
    JIRA_CLIENT_SECRET: 'j',
    DOCUSIGN_CLIENT_ID: 'd',
    DOCUSIGN_CLIENT_SECRET: 'd',
    AUTENTI_CLIENT_ID: 'a',
    AUTENTI_CLIENT_SECRET: 'a',
    NOTION_CLIENT_ID: 'n',
    NOTION_CLIENT_SECRET: 'n',
    CONFLUENCE_CLIENT_ID: 'c',
    CONFLUENCE_CLIENT_SECRET: 'c',
    GOOGLE_CALENDAR_CLIENT_ID: 'gc',
    GOOGLE_CALENDAR_CLIENT_SECRET: 'gc',
    OUTLOOK_CALENDAR_CLIENT_ID: 'oc',
    OUTLOOK_CALENDAR_CLIENT_SECRET: 'oc',
    LINEAR_CLIENT_ID: 'l',
    LINEAR_CLIENT_SECRET: 'l',
    SLACK_ENCRYPTION_KEY: HEX32,
    JIRA_ENCRYPTION_KEY: HEX32,
    DOCUSIGN_ENCRYPTION_KEY: HEX32,
    AUTENTI_ENCRYPTION_KEY: HEX32,
    KSEF_ENCRYPTION_KEY: HEX32,
    NOTION_ENCRYPTION_KEY: HEX32,
    CONFLUENCE_ENCRYPTION_KEY: HEX32,
    GOOGLE_CALENDAR_ENCRYPTION_KEY: HEX32,
    OUTLOOK_CALENDAR_ENCRYPTION_KEY: HEX32,
    CLOCKIFY_ENCRYPTION_KEY: HEX32,
    LINEAR_ENCRYPTION_KEY: HEX32,
    BANK_ACCOUNT_ENCRYPTION_KEY: HEX32,
    ANTHROPIC_API_KEY: 'sk-ant-xxx',
    QSTASH_TOKEN: 'q',
    QSTASH_CURRENT_SIGNING_KEY: 'sig1',
    QSTASH_NEXT_SIGNING_KEY: 'sig2',
    CRON_SECRET: '1234567890123456',
  };
}

describe('serverEnvSchema', () => {
  it('parses a complete valid env object', () => {
    const result = serverEnvSchema.safeParse(minimalValidServerEnv());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development');
      expect(result.data.EMAIL_FROM).toBe('noreply@contractor-ops.com');
      expect(result.data.R2_BUCKET_NAME).toBe('contractor-ops-documents');
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
      SLACK_ENCRYPTION_KEY: 'not-hex'.padEnd(64, '0'),
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
