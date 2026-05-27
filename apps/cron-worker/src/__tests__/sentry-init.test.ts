/**
 * Regression test for GAP-OBSERVABILITY-007 — cron-worker Sentry init must
 * wire `beforeSend: scrubSentryEvent` so raw webhook payloads, OAuth
 * tokens, IBANs, and tax IDs never ship unredacted to Sentry.
 *
 * Mirrors apps/web-vite/src/__tests__/sentry-init.test.ts.
 *
 * Pins:
 *   - `Sentry.init` receives `beforeSend` as a function.
 *   - `beforeSend` is the exact `scrubSentryEvent` reference from the
 *     scrubber module (asserted via vi.mock identity).
 *   - `enabled: false` when SENTRY_DSN is unset (no-op init posture).
 *   - `enabled: true` when SENTRY_DSN is set.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  const { __resetEnvForTests } = await import('../env.js');
  __resetEnvForTests();
  return import('../lib/sentry.js');
}

describe('initSentry (cron-worker) — GAP-OBSERVABILITY-007 regression', () => {
  const originalDsn = process.env.SENTRY_DSN;

  beforeEach(() => {
    initSpy.mockClear();
    if (originalDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = originalDsn;
  });

  it('wires scrubSentryEvent as beforeSend (PII redaction safety net)', async () => {
    process.env.SENTRY_DSN = 'https://abc@o0.ingest.sentry.io/0';
    const mod = await loadInit();
    mod.initSentry();
    expect(initSpy).toHaveBeenCalledTimes(1);
    const opts = initSpy.mock.calls[0]?.[0] as { beforeSend?: unknown };
    expect(typeof opts.beforeSend).toBe('function');
    // Identity assertion — the wired function MUST be the scrubber the
    // module mocked above, not some unrelated lambda. Catches "defined
    // the scrubber but forgot to pass it" regressions.
    expect(opts.beforeSend).toBe(scrubFn);
  });

  it('enables Sentry when DSN is set', async () => {
    process.env.SENTRY_DSN = 'https://abc@o0.ingest.sentry.io/0';
    const mod = await loadInit();
    mod.initSentry();
    const opts = initSpy.mock.calls[0]?.[0] as { enabled?: boolean };
    expect(opts.enabled).toBe(true);
  });

  it('disables Sentry when DSN is unset (no-op init posture)', async () => {
    delete process.env.SENTRY_DSN;
    const mod = await loadInit();
    mod.initSentry();
    const opts = initSpy.mock.calls[0]?.[0] as { enabled?: boolean };
    expect(opts.enabled).toBe(false);
  });
});
