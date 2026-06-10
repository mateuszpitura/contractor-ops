// @contractor-ops/offboarding-templates barrel.

export { PTO_KEYWORDS } from './pto-keywords';

export { OFFBOARDING_TEMPLATE_SEEDS } from './seeds';
export type {
  DocumentType,
  OffboardingTemplateSeedRole,
  PtoKeywords,
  Role,
  Seed,
  SupportedLocale,
  TaskItem,
} from './types';
export { upsertSeedTemplates } from './upsert-on-boot';
