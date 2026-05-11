/**
 * Phase 57 · Plan 04 · Task 1 — gov-api-clients factory tests.
 *
 * Asserts the env-driven production-VRN guard fires at bootstrap time
 * (INFO #4 defense-in-depth):
 *
 *   - HMRC_ENV='production' + empty HMRC_PLATFORM_VRN → throws
 *   - HMRC_ENV='sandbox'    + empty HMRC_PLATFORM_VRN → does not throw
 *
 * The module caches singletons via module state, so each test uses
 * `vi.resetModules()` + a fresh `await import('../gov-api-clients')` to
 * exercise the first-call branch cleanly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('getHmrcVatClient — production VRN guard (INFO #4)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws when HMRC_ENV=production and HMRC_PLATFORM_VRN is empty', async () => {
    process.env.HMRC_ENV = 'production';
    process.env.HMRC_PLATFORM_VRN = '';
    const { getHmrcVatClient } = await import('../gov-api-clients');
    expect(() => getHmrcVatClient()).toThrow(/HMRC_PLATFORM_VRN required in production/);
  });

  it('throws when HMRC_ENV=production and HMRC_PLATFORM_VRN is undefined', async () => {
    process.env.HMRC_ENV = 'production';
    delete process.env.HMRC_PLATFORM_VRN;
    const { getHmrcVatClient } = await import('../gov-api-clients');
    expect(() => getHmrcVatClient()).toThrow(/HMRC_PLATFORM_VRN/);
  });

  it('permits empty HMRC_PLATFORM_VRN in sandbox', async () => {
    process.env.HMRC_ENV = 'sandbox';
    process.env.HMRC_PLATFORM_VRN = '';
    const { getHmrcVatClient } = await import('../gov-api-clients');
    expect(() => getHmrcVatClient()).not.toThrow();
  });

  it('caches the singleton across calls (same instance returned twice)', async () => {
    process.env.HMRC_ENV = 'sandbox';
    process.env.HMRC_PLATFORM_VRN = '';
    const { getHmrcVatClient } = await import('../gov-api-clients');
    const a = getHmrcVatClient();
    const b = getHmrcVatClient();
    expect(a).toBe(b);
  });
});

describe('getViesClient', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('does not throw when VIES_ENV is set to production', async () => {
    process.env.VIES_ENV = 'production';
    process.env.HMRC_ENV = 'sandbox';
    process.env.HMRC_PLATFORM_VRN = '';
    const { getViesClient } = await import('../gov-api-clients');
    expect(() => getViesClient()).not.toThrow();
  });

  it('caches the singleton across calls', async () => {
    process.env.VIES_ENV = 'production';
    process.env.HMRC_ENV = 'sandbox';
    const { getViesClient } = await import('../gov-api-clients');
    const a = getViesClient();
    const b = getViesClient();
    expect(a).toBe(b);
  });
});
