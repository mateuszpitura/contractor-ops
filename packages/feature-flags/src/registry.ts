/**
 * Public Node-side registry surface. Re-exports the browser-safe core
 * (flag declarations, key constants, lookup helper) from `./flags-core`
 * and adds the boot-time signoff gate, which depends on `process.exit` /
 * `process.stderr` and the JSON-backed signoff registry — both of which
 * must not land in the SPA bundle. The SPA entry should import from
 * `@contractor-ops/feature-flags/browser` instead.
 */

export {
  CLASSIFICATION_ENGINE_FLAG,
  EINVOICE_IMPORT_ENABLED,
  FLAG_KEYS,
  FLAGS,
  type FlagKey,
  getFlagDefinition,
} from './flags-core';

import { FLAG_KEYS } from './flags-core';
import { getFlagSignoff, isGatedFlag } from './signoff-registry-flags';

// ---------------------------------------------------------------------------
// Phase 70 D-10 — Boot-time signoff gate for legal-sensitive flag namespaces.
//
// Iterates every flag key. For each key whose namespace is gated (D-11),
// requires a matching entry in the flag-signoff registry. Missing entries
// trip a stderr error and `process.exit(1)` so an engineer who flips an
// Unleash flag to APPROVED but forgets the registry entry hits the failure
// at boot — not in staging.
//
// IMPORTANT: This used to run as a top-level for-loop at module load. That
// meant ANY tooling that imported `@contractor-ops/feature-flags` (codegen
// scripts, test runners without bypass, future CLI tools) could be killed by
// a missing-entry gated flag — there was no opt-out without setting an env
// var. The check is now an exported function that the consuming app must
// call explicitly during boot. Module load stays pure.
//
// Bypass: `FLAG_SIGNOFF_BYPASS=local` skips the exit and emits a warn line
// instead. LOCAL-ONLY constraint — production must NOT set this.
//
// Wiring: `apps/web/src/lib/feature-flags-init.ts` is the canonical caller.
// ---------------------------------------------------------------------------

/**
 * Walks every declared flag and verifies that every flag whose key matches a
 * gated namespace prefix has a matching entry in the flag-signoff registry.
 *
 * Behaviour on a missing entry:
 *   - default: writes to stderr and calls `process.exit(1)` (fail-fast at boot).
 *   - with `FLAG_SIGNOFF_BYPASS=local`: emits a warn line and continues
 *     (LOCAL-ONLY — production MUST NOT set this env var).
 *
 * Must be invoked explicitly during app boot. Importing this package no
 * longer triggers the side effect.
 *
 * @returns `true` when all gated flags are satisfied or the bypass is active;
 *   `false` when at least one entry is missing AND the bypass is NOT active.
 *   In the unsatisfied case the function will normally have already called
 *   `process.exit(1)` and not returned — a non-exiting return path exists
 *   only for tests that mock `process.exit`.
 */
export function assertFlagSignoffsOrExit(): boolean {
  const bypass = process.env.FLAG_SIGNOFF_BYPASS === 'local';
  let satisfied = true;

  for (const key of FLAG_KEYS) {
    if (!isGatedFlag(key)) continue;
    const entry = getFlagSignoff(key);
    if (entry !== undefined) continue;

    const msg =
      `[FLAG-SIGNOFF] flag '${key}' missing registry entry — refusing to boot. ` +
      `Add a PENDING entry to packages/feature-flags/src/signoff-registry-flags.json ` +
      `(see docs/lint-remediation/flag-signoff.md) ` +
      `or set FLAG_SIGNOFF_BYPASS=local for LOCAL-ONLY dev.`;

    if (bypass) {
      process.stderr.write(`[FLAG-SIGNOFF] WARN bypass active (LOCAL-ONLY): ${msg}\n`);
    } else {
      process.stderr.write(`${msg}\n`);
      satisfied = false;
      process.exit(1);
    }
  }

  return satisfied;
}
