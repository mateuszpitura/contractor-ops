// ---------------------------------------------------------------------------
// Phase 60 · CLASS-07 — economic-dependency scan tests.
// ---------------------------------------------------------------------------
//
// Wave-0 scaffolds — describe.todo stubs matching VALIDATION.md rows
// 60-01-01..08. Task 2 replaces each todo with a concrete test.
//
// NOTE: Task 2 fills these in against the real `runEconomicDependencyScan`,
// `computeBillingShare`, `bandFor`, and `updateBandState` exports.

import { describe, it } from 'vitest';

describe('runEconomicDependencyScan', () => {
  describe.todo('auth');
  describe.todo('window');
  describe.todo('cross-org');
  describe.todo('band-state');
  describe.todo('dedup');
  describe.todo('reminder-cadence');
  describe.todo('RBAC');
  describe.todo('replay');

  it.todo('Kleinunternehmer status does not alter the §2 SGB VI 70%/83.33% thresholds');
  it.todo('assignments with status=ENDED are skipped (only status=ACTIVE scanned)');
});
