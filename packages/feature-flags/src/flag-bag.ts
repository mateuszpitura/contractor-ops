import { evaluate } from './evaluator';
import type { FlagKey } from './registry';
import { FLAG_KEYS } from './registry';
import type { EvalContext } from './schemas';

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

/**
 * Evaluates every declared flag once for the given context and returns a
 * materialized bag. Safe to serialize (plain booleans) and hydrate into the
 * browser via a React server component — which is why this object uses a
 * normal prototype: RSC's serializer rejects null-prototype objects with
 * `Classes or null prototypes are not supported`. Prototype-pollution
 * defense is unnecessary here because the only keys ever assigned come from
 * the immutable FLAG_KEYS array, which is code-controlled.
 */
export function buildFlagBag(ctx: EvalContext): FlagBag {
  const values: FlagValues = {} as FlagValues;
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
