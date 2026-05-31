// Public API for @contractor-ops/lint-guards.
// Plans 02 (schema-guard) populates the schema exports below.
// Plans 03 (logs-guard) and 04 (i18n-parity) extend this surface.

export { formatI18nParityOffences } from './i18n-parity/format-offence';
export {
  type I18nParityOffence,
  type I18nParityOptions,
  runI18nParity,
} from './i18n-parity/run-guard';
export { formatLogsOffences } from './logs-guard/format-offence';
export {
  type LogsGuardOffence,
  type LogsGuardOptions,
  runLogsGuard,
} from './logs-guard/run-guard';
export { formatSchemaOffences } from './schema-guard/format-offence';
export {
  GLOBAL_LOOKUP_MODELS_ALLOWLIST,
  type GlobalLookupModel,
} from './schema-guard/global-lookup-allowlist';
export {
  runSchemaGuard,
  type SchemaGuardOffence,
  type SchemaGuardOptions,
} from './schema-guard/run-guard';
export { formatScopesOffences } from './scopes-guard/format-offence';
export {
  runScopesGuard,
  type ScopesGuardOffence,
  type ScopesGuardOptions,
} from './scopes-guard/run-guard';
