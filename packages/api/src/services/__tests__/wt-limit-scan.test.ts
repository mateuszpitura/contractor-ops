// Rolling-window half of the WT alerting: the daily scan. A twin of the
// compliance-reminder scan — region fan-out over SUPPORTED_REGIONS (no ME
// employee excluded), rolling weekly-average 48h breach detection, and ONE
// dedup-gated digest per recipient/day with region-prefixed dedup keys.
//
// Uses the REAL compliance-policy rules (resolveWtLimits / country mapping) over
// mocked regional clients + dispatch + dedup. No live DB.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-06-15T00:00:00.000Z');
const IN_WINDOW = new Date('2026-06-10T00:00:00.000Z');

const { mockDispatch, mockResolveRecipients, mockClaimDedup, claimedKeys, euClient, meClient } =
  vi.hoisted(() => {
    const claimedKeys = new Set<string>();

    // A PL worker whose window sum / 16 weeks exceeds the 2880-minute (48h) cap.
    const breachMinutes = 48_100; // /16 ≈ 3006 > 2880

    function makeClient(orgId: string, workerIds: string[]) {
      return {
        employeeTimeRecord: {
          findMany: vi.fn(async () =>
            workerIds.map(workerId => ({
              workerId,
              organizationId: orgId,
              workDate: IN_WINDOW,
              workedMinutes: breachMinutes,
              wtOptOut: false,
            })),
          ),
        },
        employeeProfile: {
          findMany: vi.fn(async () => workerIds.map(workerId => ({ workerId, countryCode: 'PL' }))),
        },
      };
    }

    const euClient = makeClient('org-eu', ['worker-eu-1', 'worker-eu-2']);
    const meClient = makeClient('org-me', ['worker-me-1']);

    return {
      mockDispatch: vi.fn(async () => undefined),
      mockResolveRecipients: vi.fn(async () => ['recipient-1']),
      mockClaimDedup: vi.fn(async (key: string) => {
        if (claimedKeys.has(key)) return false;
        claimedKeys.add(key);
        return true;
      }),
      claimedKeys,
      euClient,
      meClient,
    };
  });

vi.mock('@contractor-ops/db', () => ({
  SUPPORTED_REGIONS: ['EU', 'ME'] as const,
  getRegionalClient: vi.fn((region: string) => (region === 'ME' ? meClient : euClient)),
}));

vi.mock('@contractor-ops/logger', () => ({
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: vi.fn(), increment: vi.fn(), distribution: vi.fn() },
}));

vi.mock('../notification-service', () => ({ dispatch: mockDispatch }));
vi.mock('../rbac-recipients', () => ({ resolveRbacRecipients: mockResolveRecipients }));
vi.mock('../cron-dedup', () => ({ claimCronNotificationDedup: mockClaimDedup }));

import { getRegionalClient } from '@contractor-ops/db';
import { runWtLimitScan, runWtLimitScanForClient } from '../wt-limit-scan';

beforeEach(() => {
  vi.clearAllMocks();
  claimedKeys.clear();
});

describe('runWtLimitScan (region fan-out + two-pass digest)', () => {
  it('fires a breach for a worker whose rolling weekly average exceeds 48h', async () => {
    const result = await runWtLimitScan(NOW);

    // EU (2 workers) + ME (1 worker), all PL, all over the 16-week 48h average.
    expect(result.breaches).toBe(3);
    expect(mockDispatch).toHaveBeenCalled();
    const event = mockDispatch.mock.calls[0][0];
    expect(event.type).toBe('employee.wt_limit_breach');
    expect(event.entityType).toBe('EMPLOYEE_TIME_RECORD');
  });

  it('fans out over EU AND ME regions (no ME exclusion)', async () => {
    await runWtLimitScan(NOW);

    expect(vi.mocked(getRegionalClient)).toHaveBeenCalledWith('EU');
    expect(vi.mocked(getRegionalClient)).toHaveBeenCalledWith('ME');
    expect(euClient.employeeTimeRecord.findMany).toHaveBeenCalled();
    expect(meClient.employeeTimeRecord.findMany).toHaveBeenCalled();
  });

  it('emits exactly one digest per recipient per day (dedup)', async () => {
    // EU has two breaching workers in the same org → one recipient → ONE digest
    // aggregating both breaches.
    const first = await runWtLimitScanForClient(euClient, 'EU', NOW);
    expect(first.digests).toBe(1);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch.mock.calls[0][0].metadata.count).toBe(2);

    // A second scan on the same region/day is suppressed by the dedup claim.
    const second = await runWtLimitScanForClient(euClient, 'EU', NOW);
    expect(second.digests).toBe(0);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it('region-prefixes every dedup key', async () => {
    await runWtLimitScan(NOW);

    const keys = mockClaimDedup.mock.calls.map(c => c[0] as string);
    expect(keys.some(k => k.startsWith('wt:EU:'))).toBe(true);
    expect(keys.some(k => k.startsWith('wt:ME:'))).toBe(true);
    // Never an unprefixed / cross-region-collidable key.
    expect(keys.every(k => /^wt:(EU|ME):/.test(k))).toBe(true);
  });
});
