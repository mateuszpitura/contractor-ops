/**
 * Node-side flag-bag surface. Re-exports the browser-safe slice from
 * `./bag-empty` (types + `emptyFlagBag`) and adds the eager / lazy bag
 * constructors that consult `./evaluator` → `./client` → `unleash-client`.
 *
 * The Unleash Node SDK is server-only — the SPA must import from
 * `@contractor-ops/feature-flags/browser` to stay free of the Node polyfills.
 */

// biome-ignore lint/performance/noBarrelFile: not a barrel — owns the Node bag constructors; re-exports the browser-safe slice for a single surface
export {
  emptyFlagBag,
  type FlagBag,
  type FlagValues,
  type LazyFlagBag,
} from './bag-empty';

import type { FlagBag, LazyFlagBag } from './bag-empty';
import { evaluate } from './evaluator';
import type { FlagKey } from './flags-core';
import { FLAG_KEYS } from './flags-core';
import type { EvalContext } from './schemas';

type FlagValues = Record<FlagKey, boolean>;

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
