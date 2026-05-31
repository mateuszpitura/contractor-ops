// Phase 70 D-09 D-10 D-11 D-12 — Runtime flag-namespace signoff registry.
//
// Validates the JSON at module load (fail-fast on malformed data, structural
// sibling of `packages/validators/src/legal/signoff-registry.ts`). Plan 70-07
// wires the boot-time gate that consumes the helpers here.

import rawRegistry from './signoff-registry-flags.json' with { type: 'json' };
import type { FlagSignoffEntry, FlagSignoffRegistry } from './signoff-registry-flags-schema';
import { FlagSignoffRegistrySchema } from './signoff-registry-flags-schema';

// ---------------------------------------------------------------------------
// Boot-time validation — abort module load on malformed JSON.
// ---------------------------------------------------------------------------

let Registry: FlagSignoffRegistry;
try {
  Registry = FlagSignoffRegistrySchema.parse(rawRegistry);
} catch (err) {
  process.stderr.write(
    `[FLAG-SIGNOFF] signoff-registry-flags.json failed Zod validation — startup aborted: ${String(err)}\n`,
  );
  throw err;
}

// ---------------------------------------------------------------------------
// Gated namespace prefix list (D-11)
// ---------------------------------------------------------------------------

/**
 * Flags whose key matches any of these prefixes require a registry entry
 * before the app boots. Phase 70 D-11.
 *
 * Mapping to v6.0 features:
 *   - 'compliance-'             → F1 Compliance Document Lifecycle (Phases 71–73)
 *   - 'idp-deprovisioning'      → F2 IdP Deprovisioning saga signoff (Phase 76)
 *   - 'module.idp-deprovisioning' → F2 per-provider FLAGS gating (Phase 77)
 *   - 'gulf-'                   → F3 Gulf Operational Polish (Phase 79)
 *   - 'offboarding-ip-'         → F4 Offboarding Hardening (Phases 74–75)
 */
export const GATED_FLAG_NAMESPACE_PREFIXES = [
  'compliance-',
  'idp-deprovisioning',
  'module.idp-deprovisioning',
  'gulf-',
  'offboarding-ip-',
] as const satisfies readonly string[];

export function isGatedFlag(key: string): boolean {
  return GATED_FLAG_NAMESPACE_PREFIXES.some(prefix => key.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// Helpers (consumed by Plan 70-07 boot gate)
// ---------------------------------------------------------------------------

/**
 * Returns the signoff entry for a flag key, or undefined if the key has
 * no registry entry. Plan 70-07 treats missing-entry as a boot failure
 * (when the key is also gated by namespace prefix).
 */
export function getFlagSignoff(key: string): FlagSignoffEntry | undefined {
  return Registry[key];
}

/**
 * Returns all flag keys whose status is 'PENDING'. Used by future audit
 * dashboards (deferred — out of Phase 70 scope; helper exposed for tooling).
 */
export function getAllPendingFlags(): string[] {
  return Object.entries(Registry)
    .filter(([, entry]) => entry.status === 'PENDING')
    .map(([key]) => key);
}

/**
 * Returns true when the entry is present (Module-load Zod parse already
 * enforced legalTicketRef when status === APPROVED). Convenience predicate
 * for the boot gate's flow.
 */
export function isFlagSignoffSatisfied(key: string): boolean {
  return Registry[key] !== undefined;
}
