/**
 * Unit tests for the `form-1099k-tracker` cron handler.
 *
 * Coverage:
 *   1. `module.us-expansion` off → ok=true + skipped (CRON_SKIPPED_FLAG_OFF).
 *   2. Flag on, scan succeeds → ok=true + scan result relayed.
 *   3. Scan throws → ok=false + Sentry capture tagged form-1099k-tracker.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRunScan, mockEvaluate, mockCaptureException } = vi.hoisted(() => ({
  mockRunScan: vi.fn(),
  mockEvaluate: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('@contractor-ops/api/services/form-1099k-tracker.service', () => ({
  runForm1099KTrackerScan: mockRunScan,
}));

vi.mock('@contractor-ops/feature-flags', () => ({
  evaluate: mockEvaluate,
}));

vi.mock('../lib/sentry.js', () => ({
  Sentry: { captureException: mockCaptureException, captureMessage: vi.fn() },
}));

import { form1099kTrackerHandler } from '../jobs/handlers/form-1099k-tracker.js';
import { makeJobContext } from './_helpers.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockEvaluate.mockReturnValue({ enabled: true, reason: 'default' });
  mockRunScan.mockResolvedValue({ scanned: 5, crossings: 1, notificationsDispatched: 1 });
});

describe('form1099kTrackerHandler', () => {
  it('skips with ok=true when module.us-expansion is off', async () => {
    mockEvaluate.mockReturnValue({ enabled: false, reason: 'flag disabled' });

    const result = await form1099kTrackerHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ skipped: true, reason: 'FLAG_OFF' });
    expect(mockRunScan).not.toHaveBeenCalled();
  });

  it('returns ok=true and relays the scan result on success', async () => {
    mockRunScan.mockResolvedValue({ scanned: 20, crossings: 3, notificationsDispatched: 2 });

    const result = await form1099kTrackerHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ scanned: 20, crossings: 3, notificationsDispatched: 2 });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('returns ok=false and reports to Sentry when the scan throws', async () => {
    mockRunScan.mockRejectedValue(new Error('neon timeout'));

    const result = await form1099kTrackerHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ error: 'neon timeout' });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { 'cron.job': 'form-1099k-tracker' } }),
    );
  });
});
