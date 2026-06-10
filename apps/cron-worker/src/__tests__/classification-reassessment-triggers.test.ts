/**
 * Unit tests for the `classification-reassessment-triggers` cron handler.
 *
 * Coverage:
 *   1. `module.classification-engine` off → ok=true + skipped.
 *   2. Flag on, scan succeeds → ok=true + scan result relayed.
 *   3. Scan throws → ok=false + Sentry capture.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRunScan, mockEvaluate, mockCaptureException } = vi.hoisted(() => ({
  mockRunScan: vi.fn(),
  mockEvaluate: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('@contractor-ops/api/services/reassessment-trigger-scan', () => ({
  runReassessmentTriggerScan: mockRunScan,
}));

vi.mock('@contractor-ops/feature-flags', () => ({
  evaluate: mockEvaluate,
}));

vi.mock('../lib/sentry.js', () => ({
  Sentry: { captureException: mockCaptureException, captureMessage: vi.fn() },
}));

import { classificationReassessmentTriggersHandler } from '../jobs/handlers/classification-reassessment-triggers.js';
import { makeJobContext } from './_helpers.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockEvaluate.mockReturnValue({ enabled: true, reason: 'default' });
  mockRunScan.mockResolvedValue({ scanned: 10, triggersCreated: 2 });
});

describe('classificationReassessmentTriggersHandler', () => {
  it('skips with ok=true when module.classification-engine is off', async () => {
    mockEvaluate.mockReturnValue({ enabled: false, reason: 'flag disabled' });

    const result = await classificationReassessmentTriggersHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ skipped: true, reason: 'FLAG_OFF' });
    expect(mockRunScan).not.toHaveBeenCalled();
  });

  it('returns ok=true and relays the scan result on success', async () => {
    mockRunScan.mockResolvedValue({ scanned: 42, triggersCreated: 7 });

    const result = await classificationReassessmentTriggersHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ scanned: 42, triggersCreated: 7 });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('returns ok=false and reports to Sentry when the scan throws', async () => {
    mockRunScan.mockRejectedValue(new Error('audit query failed'));

    const result = await classificationReassessmentTriggersHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ error: 'audit query failed' });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
