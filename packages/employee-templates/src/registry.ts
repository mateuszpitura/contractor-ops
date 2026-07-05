import type { MarketTemplateSeed } from './types';

// Register-on-import store: each `content/<cc>` module registers its seeds as a
// side-effect on import (mirrors the compliance-policy policy registry). The
// index materializes the aggregate after importing all content modules.
const REGISTRY: MarketTemplateSeed[] = [];

export function registerMarketTemplates(...seeds: MarketTemplateSeed[]): void {
  REGISTRY.push(...seeds);
}

export function allMarketTemplateSeeds(): readonly MarketTemplateSeed[] {
  return REGISTRY;
}
