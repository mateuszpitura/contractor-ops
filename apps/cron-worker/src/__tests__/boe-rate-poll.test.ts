/**
 * Unit tests for the `boe-rate-poll` cron handler.
 *
 * Coverage:
 *   1. `payments.late-interest-enabled` off → ok=true + skipped, poller untouched.
 *   2. Flag on, poll succeeds → ok=true + rate relayed.
 *   3. Flag on, poll returns a soft error → ok=false (error surfaced, no throw).
 *   4. Flag on, poll throws → ok=false + Sentry capture.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockEvaluate, mockPollBoeBaseRate, mockCaptureException } = vi.hoisted(() => ({
  mockEvaluate: vi.fn(),
  mockPollBoeBaseRate: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('@contractor-ops/feature-flags', () => ({
  evaluate: mockEvaluate,
}));

vi.mock('@contractor-ops/integrations/services/boe-base-rate-poller', () => ({
  pollBoeBaseRate: mockPollBoeBaseRate,
}));

vi.mock('../lib/sentry.js', () => ({
  Sentry: { captureException: mockCaptureException, captureMessage: vi.fn() },
}));

import { boeRatePollHandler } from '../jobs/handlers/boe-rate-poll.js';
import { makeJobContext } from './_helpers.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockEvaluate.mockReturnValue({ enabled: true, reason: 'default' });
  mockPollBoeBaseRate.mockResolvedValue({ updated: true, currentRate: 5.25 });
});

describe('boeRatePollHandler', () => {
  it('skips with ok=true when payments.late-interest-enabled is off', async () => {
    mockEvaluate.mockReturnValue({ enabled: false, reason: 'flag disabled' });

    const result = await boeRatePollHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ skipped: true });
    expect(mockPollBoeBaseRate).not.toHaveBeenCalled();
  });

  it('returns ok=true and relays the rate when the poll succeeds', async () => {
    mockPollBoeBaseRate.mockResolvedValue({ updated: true, currentRate: 4.75 });

    const result = await boeRatePollHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ updated: true, currentRate: 4.75 });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('returns ok=false when the poll reports a soft error', async () => {
    mockPollBoeBaseRate.mockResolvedValue({
      updated: false,
      currentRate: null,
      error: 'BoE responded 403',
    });

    const result = await boeRatePollHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ error: 'BoE responded 403' });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('returns ok=false and reports to Sentry when the poll throws', async () => {
    mockPollBoeBaseRate.mockRejectedValue(new Error('network unreachable'));

    const result = await boeRatePollHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ error: 'network unreachable' });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
