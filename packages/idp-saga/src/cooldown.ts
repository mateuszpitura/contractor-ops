import type { CooldownDecision, CooldownInput } from './types';

/**
 * D-05/D-06 — Cooldown gate. Stubbed in Plan 76-01 (Wave 0); implemented in Plan 76-04.
 * Returns a conservative refusal so any accidental caller sees a deterministic gate-deny.
 */
export function canStartDeprovisioning(_input: CooldownInput): CooldownDecision {
  return { allowed: false, reason: 'Not implemented — Phase 76 Plan 76-04' };
}
