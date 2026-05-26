/**
 * Unit tests for the `org-definition-sync` cron handler.
 *
 * Coverage:
 *   1. Sync succeeds → ok=true + summary relayed in details.
 *   2. `runScheduledOrgDefinitionSync` throws → ok=false + Sentry capture.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRunScheduledSync, mockCaptureException } = vi.hoisted(() => ({
  mockRunScheduledSync: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('@contractor-ops/api/services/org-definition-sync', () => ({
  runScheduledOrgDefinitionSync: mockRunScheduledSync,
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {},
  createTenantClientFrom: vi.fn(),
  getRegionalClient: vi.fn(),
  tenantStore: { run: vi.fn() },
}));

vi.mock('../lib/sentry.js', () => ({
  Sentry: { captureException: mockCaptureException, captureMessage: vi.fn() },
}));

import { orgDefinitionSyncHandler } from '../jobs/handlers/org-definition-sync.js';
import { makeJobContext } from './_helpers.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('orgDefinitionSyncHandler', () => {
  it('returns ok=true and relays the sync summary on success', async () => {
    mockRunScheduledSync.mockResolvedValue({ evaluated: 5, ran: 2, skipped: 3 });

    const result = await orgDefinitionSyncHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ evaluated: 5, ran: 2, skipped: 3 });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('returns ok=false and reports to Sentry when the sync throws', async () => {
    mockRunScheduledSync.mockRejectedValue(new Error('neon timeout'));

    const result = await orgDefinitionSyncHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ error: 'neon timeout' });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
