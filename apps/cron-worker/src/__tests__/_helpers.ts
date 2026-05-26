/**
 * Shared test utilities for cron-worker handler unit tests.
 *
 * Handlers are invoked directly (not through `runJob`) so each case can
 * assert the raw `JobResult` contract without the runner's bookkeeping.
 */

import pino from 'pino';
import type { JobContext } from '../jobs/runner.js';

/** Build a `JobContext` for invoking a handler directly in a unit test. */
export function makeJobContext(overrides: Partial<JobContext> = {}): JobContext {
  return {
    log: pino({ level: 'silent' }),
    traceId: 'test-trace-id',
    startedAt: new Date('2026-05-22T00:00:00.000Z'),
    ...overrides,
  };
}
