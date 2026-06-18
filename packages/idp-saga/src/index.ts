// Public API for @contractor-ops/idp-saga.
// Pure helpers + types for the IdP deprovisioning saga (cooldown gate,
// run-status derivation, provenance self-trigger filter, 90-day GC).

export { canStartDeprovisioning } from './cooldown.js';
export { gcExpiredProvenance } from './gc.js';
export { insertProvenance, provenanceLookup } from './provenance.js';
export { deriveRunStatus, recomputeRunStatus } from './run-status.js';
export {
  type AssignmentStatus,
  COOLDOWN_DAYS,
  type CooldownDecision,
  type CooldownInput,
  type DeprovisioningProvider,
  type GcResult,
  MAX_ATTEMPTS,
  type ProvenanceActionKind,
  type ProvenanceLookupInput,
  type ProvenanceMatchResult,
  type RunStatus,
  type StepRow,
  type StepStatus,
} from './types.js';
