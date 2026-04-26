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
  lazyFlagBag,
} from './flag-bag.js';
export {
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
} from './schemas.js';
