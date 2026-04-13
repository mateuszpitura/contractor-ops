import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Force the in-memory fallback path by clearing Upstash env BEFORE the
// middleware module is evaluated (its `hasRedis` flag is module-scoped).
// vi.hoisted runs before any import resolution.
vi.hoisted(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

vi.mock('@sentry/nextjs', () => {
  const mockSpan = {
    setStatus: vi.fn(),
    setAttribute: vi.fn(),
    end: vi.fn(),
  };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  createTrpcLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), distribution: vi.fn(), histogram: vi.fn() },
}));

import { z } from 'zod';
import { t } from '../../init.js';
import {
  __getClassificationRateLimitMaxForTests,
  __resetClassificationRateLimitForTests,
  classificationSaveAnswerRateLimit,
} from '../classification-rate-limit.js';

describe('classificationSaveAnswerRateLimit', () => {
  const router = t.router({
    saveAnswer: t.procedure
      .input(z.object({ assessmentId: z.string() }))
      .use(classificationSaveAnswerRateLimit)
      .mutation(({ input }) => ({ saved: input.assessmentId })),
  });
  const createCaller = t.createCallerFactory(router);

  function callerWithOrg(organizationId: string) {
    return createCaller({
      headers: new Headers(),
      session: null,
      user: null,
      organizationId,
    } as never);
  }

  beforeEach(() => {
    __resetClassificationRateLimitForTests(5);
  });

  afterEach(() => {
    __resetClassificationRateLimitForTests();
    vi.restoreAllMocks();
  });

  it('exposes the production default of 120 calls/min', () => {
    __resetClassificationRateLimitForTests();
    expect(__getClassificationRateLimitMaxForTests()).toBe(120);
  });

  it('allows requests under the limit', async () => {
    const caller = callerWithOrg('org-1');
    for (let i = 0; i < 5; i++) {
      await expect(caller.saveAnswer({ assessmentId: 'a-1' })).resolves.toEqual({
        saved: 'a-1',
      });
    }
  });

  it('blocks requests exceeding the limit', async () => {
    const caller = callerWithOrg('org-2');
    for (let i = 0; i < 5; i++) {
      await caller.saveAnswer({ assessmentId: 'a-2' });
    }
    await expect(caller.saveAnswer({ assessmentId: 'a-2' })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
  });

  it('allows requests again after the sliding window expires', async () => {
    // Use Date.now spy to simulate time passing without fake timers
    let now = Date.now();
    const dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now);

    const caller = callerWithOrg('org-3');
    for (let i = 0; i < 5; i++) {
      await caller.saveAnswer({ assessmentId: 'a-3' });
    }
    await expect(caller.saveAnswer({ assessmentId: 'a-3' })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });

    // Advance past the 60s window
    now += 61_000;

    await expect(caller.saveAnswer({ assessmentId: 'a-3' })).resolves.toEqual({
      saved: 'a-3',
    });

    dateNowSpy.mockRestore();
  });

  it('tracks different assessments with separate counters', async () => {
    const caller = callerWithOrg('org-4');
    // Exhaust limit for assessment a-4
    for (let i = 0; i < 5; i++) {
      await caller.saveAnswer({ assessmentId: 'a-4' });
    }
    await expect(caller.saveAnswer({ assessmentId: 'a-4' })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });

    // Different assessment should still work
    await expect(caller.saveAnswer({ assessmentId: 'a-5' })).resolves.toEqual({
      saved: 'a-5',
    });
  });

  it('throws BAD_REQUEST when assessmentId is missing from input', async () => {
    const bareRouter = t.router({
      saveAnswer: t.procedure
        .input(z.object({ other: z.string() }))
        .use(classificationSaveAnswerRateLimit)
        .mutation(({ input }) => input),
    });
    const caller = t.createCallerFactory(bareRouter)({
      headers: new Headers(),
      session: null,
      user: null,
      organizationId: 'org-5',
    } as never);

    await expect(caller.saveAnswer({ other: 'x' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});
