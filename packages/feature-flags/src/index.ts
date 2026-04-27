export {
  type FlagClient,
  getFlagClient,
  type Region,
  setFlagClientForTesting,
  shutdownFlagClients,
} from './client.js';
export {
  type EvalReason,
  type EvalResult,
  evaluate,
  evaluateAgainst,
  registerClassificationDisclaimerGate,
} from './evaluator.js';
export {
  buildFlagBag,
  emptyFlagBag,
  type FlagBag,
  type FlagValues,
  type LazyFlagBag,
  lazyFlagBag,
} from './flag-bag.js';
export {
  assertFlagSignoffsOrExit,
  CLASSIFICATION_ENGINE_FLAG,
  EINVOICE_IMPORT_ENABLED,
  FLAG_KEYS,
  FLAGS,
  type FlagKey,
  getFlagDefinition,
} from './registry.js';
export {
  type EvalContext,
  evalContextSchema,
  type FlagCategory,
  type FlagDefinition,
  flagCategorySchema,
  flagDefinitionSchema,
  type Jurisdiction,
  jurisdictionSchema,
  regionSchema,
} from './schemas.js';
export {
  GATED_FLAG_NAMESPACE_PREFIXES,
  getAllPendingFlags,
  getFlagSignoff,
  isFlagSignoffSatisfied,
  isGatedFlag,
} from './signoff-registry-flags.js';
export type {
  FlagApproverRole,
  FlagSignoffEntry,
  FlagSignoffRegistry,
  FlagSignoffStatus,
} from './signoff-registry-flags-schema.js';
