/**
 * Pins for the public-API Sentry init contract. The init must wire
 * `beforeSend: scrubSentryEvent` because public-API receives external
 * API-key consumer payloads (request bodies, headers, auth artifacts) —
 * without the scrubber every unhandled exception would ship those
 * verbatim to Sentry.
 *
 *   - `Sentry.init` is called with `beforeSend` set to a function.
 *   - That function IS the scrubber exported by `lib/sentry-scrub.ts`
 *     (reference compare via mocked module), so silently replacing it
 *     with a stub or noop would fail here.
 *   - `enabled: false` when `SENTRY_DSN` is unset — preview/dev/CI
 *     deploys without a Sentry project must remain noops.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { initSpy, scrubFn } = vi.hoisted(() => ({
  initSpy: vi.fn(),
  scrubFn: vi.fn((event: unknown) => event),
}));

vi.mock('@sentry/node', () => ({
  init: initSpy,
}));

vi.mock('../lib/sentry-scrub.js', () => ({
  scrubSentryEvent: scrubFn,
}));

async function loadInit() {
  vi.resetModules();
  return import('../lib/sentry.js');
}

describe('initSentry (public-api) — PII scrubber must stay wired', () => {
  const originalDsn = process.env.SENTRY_DSN;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    initSpy.mockClear();
    scrubFn.mockClear();
  });

  afterEach(() => {
    if (originalDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = originalDsn;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('wires beforeSend as a function when DSN is set', async () => {
    process.env.SENTRY_DSN = 'https://abc@o0.ingest.sentry.io/0';
    const mod = await loadInit();
    mod.initSentry();
    expect(initSpy).toHaveBeenCalledTimes(1);
    const opts = initSpy.mock.calls[0]?.[0] as { beforeSend?: unknown };
    expect(typeof opts.beforeSend).toBe('function');
  });

  it('wires beforeSend to the scrubSentryEvent reference (not a stub)', async () => {
    process.env.SENTRY_DSN = 'https://abc@o0.ingest.sentry.io/0';
    const mod = await loadInit();
    mod.initSentry();
    const opts = initSpy.mock.calls[0]?.[0] as { beforeSend?: unknown };
    expect(opts.beforeSend).toBe(scrubFn);
  });

  it('disables Sentry when SENTRY_DSN is unset', async () => {
    delete process.env.SENTRY_DSN;
    const mod = await loadInit();
    mod.initSentry();
    expect(initSpy).toHaveBeenCalledTimes(1);
    const opts = initSpy.mock.calls[0]?.[0] as { enabled?: boolean };
    expect(opts.enabled).toBe(false);
  });
});
