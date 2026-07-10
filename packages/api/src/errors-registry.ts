/**
 * Registry over every error constant exported from `errors.ts`.
 *
 * Lives in its own module so `errors.ts` stays import-free (a namespace
 * self-import there forms an import cycle). Built lazily on first call so
 * adding a new constant requires no manual registration. Used by `init.ts`
 * `errorFormatter` to decide whether a `TRPCError.message` should be surfaced
 * verbatim as `shape.data.errorKey` or replaced with `'unknownError'`.
 */

import * as ApiErrors from './errors.js';

let knownValues: Set<string> | undefined;

function buildKnownValues(): Set<string> {
  const set = new Set<string>();
  for (const [, value] of Object.entries(ApiErrors as Record<string, unknown>)) {
    if (typeof value === 'string') set.add(value);
  }
  return set;
}

export function isKnownApiErrorValue(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!knownValues) knownValues = buildKnownValues();
  return knownValues.has(value);
}
