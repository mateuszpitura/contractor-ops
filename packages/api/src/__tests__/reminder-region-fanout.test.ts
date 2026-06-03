// Phase 79 Wave 0 — RED scaffold. Turn GREEN in plan 79-03.
//
// Critical behavior C3 (GULF-02, Pitfall 18): the compliance reminder scan
// iterates SUPPORTED_REGIONS ('EU','ME') so an ME-region BLOCKING free-zone item
// enters the 90/60/30/15/7 cascade.
//
// LANDMINE: runComplianceReminderScan currently closes over the module-level
// prismaRaw client (= DATABASE_URL = EU only) and the reminders cron handler
// calls it once with no region iteration — so UAE/KSA orgs (which live in the ME
// DB) never receive reminders. The scan must accept a Prisma client and be
// fanned across getRegionalClient(region) per SUPPORTED_REGIONS.
//
// Template: apps/cron-worker/src/jobs/handlers/exchange-rates.ts (fetchDaily fans
// across SUPPORTED_REGIONS) + packages/db/src/region.ts getRegionalClient.

import { describe, it } from 'vitest';

describe.todo('C3 (Pitfall 18) reminder region fan-out — ME free-zone items enter the cascade', () => {
  it.todo('runs the compliance reminder scan once per SUPPORTED_REGIONS region [79-03]');

  it.todo(
    'uses getRegionalClient(region) so an ME-region BLOCKING free-zone item is scanned [79-03]',
  );

  it.todo('skips a region gracefully when its DATABASE_URL_* env var is not configured [79-03]');

  it.todo('does not collide cron dedup keys across regions [79-03]');
});
