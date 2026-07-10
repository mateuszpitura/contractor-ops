// Public surface of the HRIS two-way sync engine.

export { type ApplyPatchOpts, type ApplyPatchResult, applyPatchToWorker } from './apply-patch';
export {
  assertNotHrisOwnedField,
  FIELD_OWNER,
  type FieldOwner,
  type HrisWritableEmployeePatch,
  projectToWritablePatch,
  type WritableEmploymentStatus,
} from './field-partition';
export {
  defaultMappingFor,
  hrisFieldMappingSchema,
  isOneHrisPerOrgViolation,
  ONE_HRIS_PER_ORG_INDEX,
  publicHrisConfig,
  readSyncState,
  resolveMapping,
  writeSyncState,
} from './mapping';
export {
  type HrisPullResult,
  type HrisPullStatus,
  runHrisPull,
  runScheduledHrisSync,
  type ScheduledHrisSyncResult,
} from './pull-orchestrator';
export { type ChangeOrigin, syncHash } from './sync-hash';
export {
  HRIS_PROVIDERS,
  type HrisEmployeeRecord,
  type HrisFieldMapping,
  type HrisProvider,
  type HrisPushInput,
  type HrisPushPayload,
  type HrisSyncState,
} from './types';
