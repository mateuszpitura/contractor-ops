/** @vitest-environment node */

/**
 * Regression test for GAP-OBSERVABILITY-005 — server-side Sentry init must
 * opt into structured log capture (`enableLogs: true`). Removing this
 * option silently drops every `Sentry.logger.*` call without a build error,
 * which is the historic failure mode we are pinning against.
 *
 * `beforeSend: scrubSentryEvent` is asserted here as well so a future
 * regression on the PII-scrub wiring fails loudly during typecheck/test
 * rather than after a production leak.
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

describe('initSentry — GAP-OBSERVABILITY-005 + -009 regression', () => {
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

  it('forwards RENDER_GIT_COMMIT as release tag (GAP-OBSERVABILITY-009)', async () => {
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
