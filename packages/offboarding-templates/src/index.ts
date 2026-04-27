// Phase 74 — @contractor-ops/offboarding-templates barrel.
//
// Wave 0 (Plan 74-01) ships the type contracts + stub re-exports so downstream
// plans can import-resolve. Wave 1 Plan 74-02 fills the seed/keyword constants,
// Wave 2 Plan 74-05 fills `upsertSeedTemplates` against the real PrismaClient.

export { PTO_KEYWORDS } from './pto-keywords.js';

export { OFFBOARDING_TEMPLATE_SEEDS } from './seeds.js';
export type {
  DocumentType,
  OffboardingTemplateSeedRole,
  PtoKeywords,
  Role,
  Seed,
  SupportedLocale,
  TaskItem,
} from './types.js';
export { upsertSeedTemplates } from './upsert-on-boot.js';
