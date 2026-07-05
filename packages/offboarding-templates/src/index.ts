// @contractor-ops/offboarding-templates barrel.

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
