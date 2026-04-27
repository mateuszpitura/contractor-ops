// Phase 71 — deep-freeze runtime complement to `as const`. Lifted verbatim from
// packages/feature-flags/src/registry.ts (Phase 64/70 pattern).

export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
}
