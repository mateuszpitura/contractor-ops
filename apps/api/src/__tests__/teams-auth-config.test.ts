/** @vitest-environment node */

/**
 * Pins for `getAuthConfig` in `routes/teams.ts`:
 *
 *   - Production boot with both `AZURE_BOT_APP_ID` and
 *     `AZURE_BOT_APP_SECRET` set returns a complete `AuthConfiguration`.
 *   - Production boot with either var missing throws — `authorizeJWT`
 *     must NOT enter anonymous mode for a webhook that accepts unsigned
 *     payloads.
 *   - Non-production boot with empty vars resolves to empty
 *     `clientId` / `clientSecret` (the SDK's anonymous-mode default).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@microsoft/agents-hosting', () => ({
  authorizeJWT: vi.fn(),
  CloudAdapter: class {
    process() {
      return;
    }
  },
}));

vi.mock('@contractor-ops/api/services/teams/teams-bot-handler', () => ({
  TeamsBotHandler: class {
    async run() {
      /* no-op */
    }
  },
}));

import { __resetEnvForTests } from '../env.js';

const ENV_KEYS = ['NODE_ENV', 'AZURE_BOT_APP_ID', 'AZURE_BOT_APP_SECRET'] as const;
type EnvKey = (typeof ENV_KEYS)[number];

function snapshotEnv(): Record<EnvKey, string | undefined> {
  return ENV_KEYS.reduce(
    (acc, key) => {
      acc[key] = process.env[key];
      return acc;
    },
    {} as Record<EnvKey, string | undefined>,
  );
}

function restoreEnv(snap: Record<EnvKey, string | undefined>): void {
  for (const key of ENV_KEYS) {
    if (snap[key] === undefined) delete process.env[key];
    else process.env[key] = snap[key];
  }
}

async function loadGetAuthConfig() {
  __resetEnvForTests();
  vi.resetModules();
  const mod = await import('../routes/teams.js');
  return mod.getAuthConfig;
}

describe('getAuthConfig — Teams Bot Framework auth posture', () => {
  const original = snapshotEnv();

  afterEach(() => {
    restoreEnv(original);
    __resetEnvForTests();
  });

  it('returns the env values when both AZURE_BOT_APP_ID and SECRET are set in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AZURE_BOT_APP_ID = 'aad-app-id';
    process.env.AZURE_BOT_APP_SECRET = 'aad-app-secret';
    const getAuthConfig = await loadGetAuthConfig();
    expect(getAuthConfig()).toEqual({
      clientId: 'aad-app-id',
      clientSecret: 'aad-app-secret',
    });
  });

  it('throws in production when AZURE_BOT_APP_ID is unset', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.AZURE_BOT_APP_ID;
    process.env.AZURE_BOT_APP_SECRET = 'aad-app-secret';
    const getAuthConfig = await loadGetAuthConfig();
    expect(() => getAuthConfig()).toThrow(/required in production/);
  });

  it('throws in production when AZURE_BOT_APP_SECRET is unset', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AZURE_BOT_APP_ID = 'aad-app-id';
    delete process.env.AZURE_BOT_APP_SECRET;
    const getAuthConfig = await loadGetAuthConfig();
    expect(() => getAuthConfig()).toThrow(/required in production/);
  });

  it('resolves to empty strings in non-production when both env vars are absent (SDK anonymous mode)', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.AZURE_BOT_APP_ID;
    delete process.env.AZURE_BOT_APP_SECRET;
    const getAuthConfig = await loadGetAuthConfig();
    expect(getAuthConfig()).toEqual({ clientId: '', clientSecret: '' });
  });
});
