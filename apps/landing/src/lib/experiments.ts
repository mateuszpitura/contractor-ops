/**
 * Typed wrapper around PostHog feature flags + experiments for landing.
 *
 * Each market gets one or more experiment keys; flag values map to copy
 * variants rendered by `<VariantSlot/>`. Keys are registered in PostHog
 * UI; this module is the single place that names them.
 */
import type { Market } from './market';

export const EXPERIMENT_KEYS = {
  hero_pl: 'landing_market_pl_hero_v1',
  hero_de: 'landing_market_de_hero_v1',
  hero_intl: 'landing_market_intl_hero_v1',
  hero_uk: 'landing_market_uk_hero_v1',
  hero_uae: 'landing_market_uae_hero_v1',
  hero_sa: 'landing_market_sa_hero_v1',
} as const;

export type ExperimentKey = (typeof EXPERIMENT_KEYS)[keyof typeof EXPERIMENT_KEYS];

const MARKET_HERO_KEY: Record<Market, ExperimentKey> = {
  PL: EXPERIMENT_KEYS.hero_pl,
  DE: EXPERIMENT_KEYS.hero_de,
  INTL: EXPERIMENT_KEYS.hero_intl,
  UK: EXPERIMENT_KEYS.hero_uk,
  UAE: EXPERIMENT_KEYS.hero_uae,
  SA: EXPERIMENT_KEYS.hero_sa,
};

/**
 * Per-market hero variant key + active variants. Wave 1 ships variants
 * A (pain-first) and C (compliance-first) for PL; B (outcome-first) and
 * C for DE; A and B for INTL; B and C for UK; C and D (ICP-narrow) for
 * UAE; C and D for SA. The matrix mirrors
 * `docs/marketing/LANDING-AB-STRATEGIES.md`.
 */
export interface HeroExperimentConfig {
  key: ExperimentKey;
  variants: readonly ('control' | 'A' | 'B' | 'C' | 'D')[];
  /** Variant rendered when flag eval has not resolved yet (avoids flash). */
  fallback: 'control' | 'A' | 'B' | 'C' | 'D';
}

export const HERO_EXPERIMENT: Record<Market, HeroExperimentConfig> = {
  PL: { key: EXPERIMENT_KEYS.hero_pl, variants: ['control', 'A', 'C'], fallback: 'control' },
  DE: { key: EXPERIMENT_KEYS.hero_de, variants: ['control', 'B', 'C'], fallback: 'control' },
  INTL: { key: EXPERIMENT_KEYS.hero_intl, variants: ['control', 'A', 'B'], fallback: 'control' },
  UK: { key: EXPERIMENT_KEYS.hero_uk, variants: ['control', 'B', 'C'], fallback: 'control' },
  UAE: { key: EXPERIMENT_KEYS.hero_uae, variants: ['control', 'C', 'D'], fallback: 'control' },
  SA: { key: EXPERIMENT_KEYS.hero_sa, variants: ['control', 'C', 'D'], fallback: 'control' },
};

export function heroExperimentFor(market: Market): HeroExperimentConfig {
  return HERO_EXPERIMENT[market];
}

export function marketHeroKey(market: Market): ExperimentKey {
  return MARKET_HERO_KEY[market];
}
