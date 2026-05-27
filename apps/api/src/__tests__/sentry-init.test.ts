/** @vitest-environment node */

/**
 * Pins for the server-side Sentry init contract:
 *
 *   - `enableLogs: true` so `Sentry.logger.*` flows into the same project
 *     as exceptions. Removing the option silently drops every log call
 *     without a build error.
 *   - `beforeSend: scrubSentryEvent` (PII redaction safety net). Defining
 *     the scrubber but not passing it as `beforeSend` would silently
 *     leak passwords / tokens / IBANs on every captured event.
 *   - `release: process.env.RENDER_GIT_COMMIT` so deploys group by SHA.
 *   - `initialScope.tags.service === 'api-server'` so multi-service
 *     events stay filterable.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { initSpy } = vi.hoisted(() => ({ initSpy: vi.fn() }));

vi.mock('@sentry/node', () => ({
  init: initSpy,
  // The real module exports many helpers; tests don't need them.
}));

vi.mock('../lib/sentry-scrub.js', () => ({
  scrubSentryEvent: (event: unknown) => event,
}));

vi.mock('../env.js', () => ({
  loadEnv: () => ({
    NODE_ENV: 'test' as const,
    SENTRY_DSN: 'https://abc@o0.ingest.sentry.io/0',
  }),
}));

async function loadInit() {
  vi.resetModules();
  return import('../lib/sentry.js');
}

describe('initSentry — server-side Sentry init contract', () => {
  const originalRenderCommit = process.env.RENDER_GIT_COMMIT;

  beforeEach(() => {
    initSpy.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalRenderCommit === undefined) {
      delete process.env.RENDER_GIT_COMMIT;
    } else {
      process.env.RENDER_GIT_COMMIT = originalRenderCommit;
    }
  });

  it('passes enableLogs: true so Sentry.logger.* captures flow to Sentry', async () => {
    const mod = await loadInit();
    mod.initSentry();
    expect(initSpy).toHaveBeenCalledTimes(1);
    const opts = initSpy.mock.calls[0]?.[0] as { enableLogs?: boolean };
    expect(opts.enableLogs).toBe(true);
  });

  it('wires scrubSentryEvent as beforeSend (PII redaction safety net)', async () => {
    const mod = await loadInit();
    mod.initSentry();
    const opts = initSpy.mock.calls[0]?.[0] as { beforeSend?: unknown };
    expect(typeof opts.beforeSend).toBe('function');
  });

  it('tags every event with service=api-server via initialScope', async () => {
    const mod = await loadInit();
    mod.initSentry();
    const opts = initSpy.mock.calls[0]?.[0] as {
      initialScope?: { tags?: Record<string, string> };
    };
    expect(opts.initialScope?.tags?.service).toBe('api-server');
  });

  it('forwards RENDER_GIT_COMMIT as release tag', async () => {
    process.env.RENDER_GIT_COMMIT = 'deadbeefcafebabe1234567890abcdef12345678';
    const mod = await loadInit();
    mod.initSentry();
    const opts = initSpy.mock.calls[0]?.[0] as { release?: string };
    expect(opts.release).toBe('deadbeefcafebabe1234567890abcdef12345678');
  });

  it('leaves release as undefined when RENDER_GIT_COMMIT is unset (local / CI)', async () => {
    delete process.env.RENDER_GIT_COMMIT;
    const mod = await loadInit();
    mod.initSentry();
    const opts = initSpy.mock.calls[0]?.[0] as { release?: string };
    expect(opts.release).toBeUndefined();
  });
});
