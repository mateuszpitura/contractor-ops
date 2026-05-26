/**
 * Browser-safe slice of the flag-bag surface — just the `FlagValues` shape
 * and the fail-closed `emptyFlagBag` constructor. Split out of `./flag-bag`
 * so the SPA browser entry can re-export the empty-bag fallback without
 * dragging in `buildFlagBag` / `lazyFlagBag` (which transitively reach the
 * Unleash Node SDK via `./evaluator` → `./client`).
 *
 * `./flag-bag` re-exports everything from here, so server callers keep
 * their existing import paths.
 */

import type { FlagKey } from './flags-core';
import { FLAG_KEYS } from './flags-core';

export type FlagValues = Record<FlagKey, boolean>;

/**
 * Public surface for the lazy variant: callers MUST go through `isEnabled`.
 *
 * `values` is intentionally NOT part of this contract. The lazy bag's
 * `values` getter would materialize every flag on access — defeating the
 * laziness — and an accidental `JSON.stringify(bag)` / logger dump would
 * trigger full evaluation across all regions. Code that genuinely needs the
 * materialized record should call `buildFlagBag` explicitly instead.
 */
export interface LazyFlagBag {
  isEnabled(key: FlagKey): boolean;
}

/**
 * Eager bag — every flag has been evaluated and exposed via `values`.
 * Returned by `buildFlagBag` and {@link emptyFlagBag}. Safe to serialize
 * (plain booleans).
 */
export interface FlagBag extends LazyFlagBag {
  values: FlagValues;
}

/**
 * Returns a flag bag with every flag set to `false`. Used as the fail-closed
 * default when there is no tenant context to evaluate against (e.g. the rare
 * window where an authenticated user has no active organization during
 * onboarding). "All off" is the safe choice: gated features remain gated,
 * kill-switches are in their "killed" state. Callers that have a real
 * evaluation context should use `buildFlagBag` instead.
 */
export function emptyFlagBag(): FlagBag {
  // Plain object (not Object.create(null)) so the bag survives serialization
  // across the React Server → Client Component boundary. RSC's serializer
  // refuses null-prototype objects with `Classes or null prototypes are not
  // supported`. Prototype-pollution defense is unnecessary here because
  // FLAG_KEYS is code-controlled (no user input ever reaches it).
  const values = FLAG_KEYS.reduce<FlagValues>((acc, key) => {
    acc[key] = false;
    return acc;
  }, {} as FlagValues);
  return {
    values,
    isEnabled: () => false,
  };
}
