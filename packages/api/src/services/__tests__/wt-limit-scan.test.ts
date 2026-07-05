// TIME-EMP-02 rolling-window half: the daily WT scan. A verbatim twin of the
// compliance-reminder scan — region fan-out over SUPPORTED_REGIONS (no ME
// employee excluded), a rolling weekly-average 48h breach detection, and ONE
// dedup-gated digest per recipient/day with region-prefixed dedup keys.
//
// HOLD: requires the wt-limit-scan service (Plan 10) + regional-client and
// notification-dispatch mocks. Registered as a describe.skip contract so it is
// visible in the run without a live-DB harness and never bricks tsc.

import { describe, it } from 'vitest';

describe.skip('runWtLimitScan (region fan-out + two-pass digest)', () => {
  it('fires a breach for a worker whose rolling weekly average exceeds 48h', () => {});
  it('fans out over EU AND ME regions (no ME exclusion)', () => {});
  it('emits exactly one digest per recipient per day (dedup)', () => {});
  it('region-prefixes every dedup key', () => {});
});
