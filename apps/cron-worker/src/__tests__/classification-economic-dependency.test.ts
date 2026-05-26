/**
 * Unit tests for the `classification-economic-dependency` cron handler.
 *
 * Coverage:
 *   1. `module.classification-engine` off → ok=true + skipped (D-08).
 *   2. Flag on, scan succeeds → ok=true + scan result relayed.
 *   3. Scan throws → ok=false + Sentry capture.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRunScan, mockEvaluate, mockCaptureException } = vi.hoisted(() => ({
  mockRunScan: vi.fn(),
  mockEvaluate: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('@contractor-ops/api/services/economic-dependency-scan', () => ({
  runEconomicDependencyScan: mockRunScan,
}));

vi.mock('@contractor-ops/feature-flags', () => ({
  evaluate: mockEvaluate,
}));

vi.mock('../lib/sentry.js', () => ({
  Sentry: { captureException: mockCaptureException, captureMessage: vi.fn() },
}));

import { classificationEconomicDependencyHandler } from '../jobs/handlers/classification-economic-dependency.js';
import { makeJobContext } from './_helpers.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockEvaluate.mockReturnValue({ enabled: true, reason: 'default' });
  mockRunScan.mockResolvedValue({ scanned: 8, alertsRaised: 1 });
});

describe('classificationEconomicDependencyHandler', () => {
  it('skips with ok=true when module.classification-engine is off', async () => {
    mockEvaluate.mockReturnValue({ enabled: false, reason: 'flag disabled' });

    const result = await classificationEconomicDependencyHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ skipped: true, reason: 'FLAG_OFF' });
    expect(mockRunScan).not.toHaveBeenCalled();
  });

  it('returns ok=true and relays the scan result on success', async () => {
    mockRunScan.mockResolvedValue({ scanned: 30, alertsRaised: 4 });

    const result = await classificationEconomicDependencyHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ scanned: 30, alertsRaised: 4 });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('returns ok=false and reports to Sentry when the scan throws', async () => {
    mockRunScan.mockRejectedValue(new Error('neon timeout'));

    const result = await classificationEconomicDependencyHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ error: 'neon timeout' });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
