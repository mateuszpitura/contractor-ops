/**
 * Unit tests for the `inpost-status-poll` cron handler (InPost + DPD + UPS).
 *
 * Coverage:
 *   1. Happy path → ok=true + checked/updated aggregated across carriers + orgs.
 *   2. One carrier rejects → swallowed per-carrier; handler still ok=true (D-07).
 *   3. courierConfig query throws → ok=false + Sentry capture.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindMany, mockPollInPost, mockPollDpd, mockPollUps, mockCaptureException } = vi.hoisted(
  () => ({
    mockFindMany: vi.fn(),
    mockPollInPost: vi.fn(),
    mockPollDpd: vi.fn(),
    mockPollUps: vi.fn(),
    mockCaptureException: vi.fn(),
  }),
);

vi.mock('@contractor-ops/api/services/courier/inpost-polling-service', () => ({
  pollInPostShipmentStatuses: mockPollInPost,
}));

vi.mock('@contractor-ops/api/services/courier/dpd-polling-service', () => ({
  pollDpdShipmentStatuses: mockPollDpd,
}));

vi.mock('@contractor-ops/api/services/courier/ups-polling-service', () => ({
  pollUpsShipmentStatuses: mockPollUps,
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: { courierConfig: { findMany: mockFindMany } },
}));

vi.mock('../lib/sentry.js', () => ({
  Sentry: { captureException: mockCaptureException, captureMessage: vi.fn() },
}));

import { inpostStatusPollHandler } from '../jobs/handlers/inpost-status-poll.js';
import { makeJobContext } from './_helpers.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([{ organizationId: 'org-1' }]);
  mockPollInPost.mockResolvedValue({ checked: 2, updated: 1 });
  mockPollDpd.mockResolvedValue({ checked: 3, updated: 0 });
  mockPollUps.mockResolvedValue({ checked: 1, updated: 1 });
});

describe('inpostStatusPollHandler', () => {
  it('returns ok=true and aggregates checked/updated across carriers', async () => {
    const result = await inpostStatusPollHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ orgs: 1, totalChecked: 6, totalUpdated: 2 });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('swallows a single carrier failure and still returns ok=true', async () => {
    mockPollDpd.mockRejectedValue(new Error('DPD 503'));

    const result = await inpostStatusPollHandler(makeJobContext());

    expect(result.ok).toBe(true);
    // DPD contributes 0/0 after the rejection; InPost + UPS still counted.
    expect(result.details).toMatchObject({ orgs: 1, totalChecked: 3, totalUpdated: 2 });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('returns ok=false and reports to Sentry when the config query throws', async () => {
    mockFindMany.mockRejectedValue(new Error('neon connection refused'));

    const result = await inpostStatusPollHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ error: 'neon connection refused' });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
