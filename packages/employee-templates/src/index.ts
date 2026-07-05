// Register the per-market content as an import side-effect, then materialize the
// aggregate seed list. Import order is irrelevant — each module registers into
// the shared registry.
import './content/pl';
import './content/de';
import './content/uk';
import './content/us';

import { allMarketTemplateSeeds } from './registry';

/** All 8 employee lifecycle seeds (4 jurisdictions × ONBOARDING + OFFBOARDING). */
export const ALL_MARKET_TEMPLATE_SEEDS = allMarketTemplateSeeds();

export type {
  CertType,
  GovStubKind,
  LifecycleType,
  MarketTaskSeed,
  MarketTemplateSeed,
} from './types';
export { upsertEmployeeMarketTemplates } from './upsert-on-boot';
