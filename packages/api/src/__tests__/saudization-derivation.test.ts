// Phase 79 Wave 0 — RED scaffold. Turn GREEN in plan 79-04.
//
// Critical behaviors C6 + C7 (GULF-05/06/07, D-10/D-12):
//   C6 — the nationalisation rate is computed from the MANUAL SaudiHeadcount
//        numbers (org-wide total + Saudi count), NOT from platform contractors
//        (Pitfall 7). The platform-derived contractor breakdown is shown
//        side-by-side for sanity-check only. The Nitaqat band is NEVER
//        auto-computed — manual entry only (locked legal-liability anti-feature).
//   C7 — the offboarding band-trajectory is a live, ephemeral recompute
//        (SaudiHeadcount minus one Saudi national), advisory-only, non-gating,
//        non-authoritative ("may drop to LOW_GREEN — verify in Qiwa"). It must
//        never assert/set a band, and nothing is persisted.
//
// Mirror: computeComplianceHealth (packages/api/src/routers/core/contractor.ts).

import { describe, it } from 'vitest';

describe.todo('C6 (GULF-05/06, D-10) saudization rate from manual headcount; band never auto-computed', () => {
  it.todo(
    'computes the nationalisation rate from manual SaudiHeadcount totals, not platform contractors [79-04]',
  );

  it.todo(
    'returns the platform-derived contractor breakdown side-by-side without driving the rate [79-04]',
  );

  it.todo('never auto-computes or sets the Nitaqat band — band is manual-entry only [79-04]');
});

describe.todo('C7 (GULF-07, D-12) offboarding band-trajectory — ephemeral, advisory, non-gating', () => {
  it.todo('recomputes the projected rate from SaudiHeadcount minus one Saudi national [79-04]');

  it.todo('returns non-authoritative advisory wording and does not assert a band [79-04]');

  it.todo('persists nothing and does not gate the offboarding flow [79-04]');
});
