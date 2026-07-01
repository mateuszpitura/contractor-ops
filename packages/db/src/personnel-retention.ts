/**
 * Personnel-file ("akta osobowe" / Personalakte) retention — personnel-facing
 * entry point.
 *
 * The resolver itself lives on the shared retention primitive in
 * `retention-policy.ts` (one engine, one RETENTION_YEARS source, no parallel
 * module). This module re-exports the personnel-specific surface so callers that
 * reason in personnel terms can import it by name without pulling the whole
 * retention primitive, and without creating an import cycle back into
 * `retention-policy.ts`.
 */

export {
  getPersonnelRetentionCutoff,
  type PersonnelRetentionDates,
  type PersonnelRetentionResult,
  type PersonnelRetentionRuleInput,
  type RetentionAnchor,
} from './retention-policy.js';
