import type { Logger } from 'pino';

import { PII_MASK_PATHS } from './pii-mask.js';

/**
 * Returns a child logger whose redact configuration excludes `*.body` (and
 * top-level `body`) for the given procedure prefixes.
 *
 * Phase 70 D-05 D-08 — opt-in body logging.
 *
 * Entries support two shapes:
 *   - 'router.procedure'              — full body emitted in plaintext
 *   - 'router.procedure:fieldA,fieldB' — only body.fieldA / body.fieldB exempt
 *                                        (not yet implemented at the redact
 *                                        layer; treated as full opt-in for
 *                                        Phase 70 — per-field serializers are
 *                                        deferred to a future phase)
 *
 * The parent logger is expected to have `procedure` in its bindings (see
 * `createTrpcLogger`). When the parent's procedure binding matches a prefix,
 * the returned child reapplies redact paths excluding the body wildcards.
 */
export function withBodyLogging(parent: Logger, includePrefixes: readonly string[]): Logger {
  // Read the parent's procedure binding (set by createTrpcLogger).
  const bindings = parent.bindings();
  const procedure = (bindings as { procedure?: string }).procedure;

  if (!procedure) {
    // No procedure bound — opt-in is impossible. Return parent unchanged
    // (defensive: keep default redact).
    return parent;
  }

  for (const entry of includePrefixes) {
    if (entry.includes('*')) {
      // Wildcard entries are forbidden by the lint guard; defensive runtime
      // skip in case a corrupt config is loaded.
      continue;
    }
    const [prefix] = entry.split(':') as [string, string | undefined];
    if (procedure.startsWith(prefix)) {
      // Compute redact paths excluding the body wildcards.
      const exclusions = new Set<string>(['body', '*.body']);
      const newPaths = PII_MASK_PATHS.filter(p => !exclusions.has(p));
      return parent.child({}, { redact: { paths: newPaths as string[], censor: '[REDACTED]' } });
    }
  }
  // No matching prefix — return parent unchanged (default redact applies).
  return parent;
}
