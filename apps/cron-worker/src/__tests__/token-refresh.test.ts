/**
 * Unit tests for the `token-refresh` cron handler.
 *
 * Coverage:
 *   1. All tokens refreshed (failed=0) → ok=true + gauges emitted.
 *   2. At least one refresh failed → ok=false.
 *   3. `refreshExpiring` throws → ok=false + Sentry capture.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRefreshExpiring, mockGauge, mockCaptureException } = vi.hoisted(() => ({
  mockRefreshExpiring: vi.fn(),
  mockGauge: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('@contractor-ops/integrations', () => ({
  refreshExpiring: mockRefreshExpiring,
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: mockGauge },
}));

vi.mock('../lib/sentry.js', () => ({
  Sentry: { captureException: mockCaptureException, captureMessage: vi.fn() },
}));

import { tokenRefreshHandler } from '../jobs/handlers/token-refresh.js';
import { makeJobContext } from './_helpers.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('tokenRefreshHandler', () => {
  it('returns ok=true and emits gauges when no refresh failed', async () => {
    mockRefreshExpiring.mockResolvedValue({ refreshed: 3, total: 5, failed: 0 });

    const result = await tokenRefreshHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ refreshed: 3, total: 5, failed: 0 });
    expect(mockGauge).toHaveBeenCalledWith('cron.token_refresh.refreshed', 3);
    expect(mockGauge).toHaveBeenCalledWith('cron.token_refresh.failed', 0);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('returns ok=false when at least one token failed to refresh', async () => {
    mockRefreshExpiring.mockResolvedValue({ refreshed: 2, total: 5, failed: 1 });

    const result = await tokenRefreshHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ failed: 1 });
  });

  it('returns ok=false and reports to Sentry when refreshExpiring throws', async () => {
    mockRefreshExpiring.mockRejectedValue(new Error('adapter down'));

    const result = await tokenRefreshHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ error: 'adapter down' });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
