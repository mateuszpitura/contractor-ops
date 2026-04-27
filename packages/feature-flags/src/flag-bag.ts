import { evaluate } from './evaluator.js';
import type { FlagKey } from './registry.js';
import { FLAG_KEYS } from './registry.js';
import type { EvalContext } from './schemas.js';

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
 * Returned by {@link buildFlagBag} and {@link emptyFlagBag}. Safe to
 * serialize (plain booleans).
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
 * evaluation context should use {@link buildFlagBag} instead.
 */
export function emptyFlagBag(): FlagBag {
  const values = FLAG_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, Object.create(null) as FlagValues);
  return {
    values,
    isEnabled: () => false,
  };
}

/**
 * Evaluates every declared flag once for the given context and returns a
 * materialized bag. Safe to serialize (plain booleans) and hydrate into the
 * browser via a React server component.
 *
 * The underlying object is created with a null prototype so `bag.values` has
 * no inherited keys — a future caller that mis-types a flag key as a string
 * cannot accidentally resolve `values.hasOwnProperty` or `values.__proto__`
 * to something truthy. Defense in depth against prototype-pollution-adjacent
 * footguns.
 */
export function buildFlagBag(ctx: EvalContext): FlagBag {
  const values = Object.create(null) as FlagValues;
  for (const key of FLAG_KEYS) {
    values[key] = evaluate(key, ctx).enabled;
  }
  return {
    values,
    isEnabled: key => values[key] === true,
  };
}

/**
 * Lazy variant: defers the full evaluation until the first `isEnabled` call.
 * Used by the tRPC middleware so procedures that never consult a flag pay
 * zero Unleash-SDK overhead.
 *
 * Returns a {@link LazyFlagBag} (narrower than `FlagBag`) — `values` is
 * deliberately NOT exposed so a serializer (`JSON.stringify`, logger dump)
 * cannot accidentally trigger full evaluation. Callers needing a
 * materialized record should call {@link buildFlagBag} directly.
 */
export function lazyFlagBag(ctx: EvalContext): LazyFlagBag {
  let materialized: FlagBag | undefined;
  const build = (): FlagBag => (materialized ??= buildFlagBag(ctx));
  return {
    // Mirrors buildFlagBag's strict `=== true` check so the two code paths can
    // never diverge on prototype-pollution-adjacent edge cases.
    isEnabled(key) {
      return build().values[key] === true;
    },
  };
}
