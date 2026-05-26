/**
 * Browser-safe subpath entry for `@contractor-ops/feature-flags`.
 *
 * Exposes only the symbols the SPA needs (flag-key types, key constants,
 * `emptyFlagBag` fallback, evaluation-context shapes) and is hand-curated
 * to import exclusively from internal source files that have NO Node-only
 * dependencies:
 *
 *   - `./flags-core` — pure declarations + key constants (no signoff JSON,
 *     no `process.exit` boot gate).
 *   - `./bag-empty` — fail-closed empty bag (no `./evaluator` chain,
 *     therefore no `./client` / `unleash-client`).
 *   - `./schemas` — pure Zod schemas (no runtime side effects beyond
 *     defining schemas).
 *
 * CLAUDE.md "Feature flags" forbids importing the Unleash Node SDK from
 * app code; this entry is the SPA-facing surface that keeps that contract.
 * Anything that needs `getFlagClient`, `evaluate`, `buildFlagBag`,
 * `lazyFlagBag`, or `assertFlagSignoffsOrExit` must import from
 * `@contractor-ops/feature-flags` (the default `.` entry) instead — Node
 * runtime only.
 */

export {
  emptyFlagBag,
  type FlagBag,
  type FlagValues,
  type LazyFlagBag,
} from './bag-empty';
export {
  CLASSIFICATION_ENGINE_FLAG,
  EINVOICE_IMPORT_ENABLED,
  FLAG_KEYS,
  FLAGS,
  type FlagKey,
  getFlagDefinition,
} from './flags-core';

export {
  type EvalContext,
  evalContextSchema,
  type FlagCategory,
  type FlagDefinition,
  flagCategorySchema,
  flagDefinitionSchema,
  type Jurisdiction,
  jurisdictionSchema,
  type Region,
  regionSchema,
} from './schemas';
