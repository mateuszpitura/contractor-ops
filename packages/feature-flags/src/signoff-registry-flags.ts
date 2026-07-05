// Runtime flag-namespace signoff registry.
//
// Validates the JSON at module load (fail-fast on malformed data, structural
// sibling of `packages/validators/src/legal/signoff-registry.ts`). The
// boot-time gate in registry.ts consumes the helpers here.

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
// Gated namespace prefix list
// ---------------------------------------------------------------------------

/**
 * Flags whose key matches any of these prefixes require a registry entry
 * before the app boots.
 *
 * Prefixes and the feature areas they cover:
 *   - 'compliance-'               → Compliance Document Lifecycle flags
 *   - 'idp-deprovisioning'        → IdP Deprovisioning saga signoff entry
 *   - 'module.idp-deprovisioning' → IdP Deprovisioning per-provider FLAGS keys
 *   - 'gulf-'                     → Gulf signoff-registry keys
 *   - 'gulf.'                     → Gulf FLAGS keys (dot form required because
 *       flagDefinitionSchema's first segment must be alphanumeric — cannot
 *       start with 'gulf-'). The two FLAGS keys (gulf.free-zone-tracking,
 *       gulf.saudization-dashboard) are legal-sensitive and MUST land PENDING.
 *   - 'offboarding-ip-'           → Offboarding Hardening flags
 *
 * v7.0 GTM Foundation — the 19 v7.0 flags are gated by these narrow prefixes
 * so the existing prefix gate enforces a PENDING registry entry for each. The
 * prefixes are scoped NOT to capture pre-v7.0 non-gated flags: 'payments.ach-'
 * excludes payments.bacs-enabled/skonto-enabled; 'module.us-'/
 * 'module.workforce-'/'module.iris-'/'module.public-api'/'module.outbound-'
 * exclude module.classification-engine + module.legal-approval. The gate is
 * NOT broadened to ALL declared flags (that would break boot for older flags
 * with no registry entry).
 *   - 'module.us-'              → US surface (module.us-expansion)
 *   - 'module.workforce-'       → Workforce module (module.workforce-employees)
 *   - 'module.employee-'        → Employee portal (module.employee-portal)
 *   - 'module.hr-'              → Staff HR dashboard (module.hr-dashboard)
 *   - 'module.iris-'            → IRIS A2A e-file (module.iris-efile)
 *   - 'module.public-api'       → Public API (module.public-api)
 *   - 'module.public-status-page' → Public status page
 *   - 'module.developer-portal' → Developer portal
 *   - 'module.api-sandbox'      → Free API sandbox tier
 *   - 'module.outbound-'        → Outbound webhooks (module.outbound-webhooks)
 *   - 'integration.personio-'   → Personio sync
 *   - 'integration.bamboohr-'   → BambooHR sync
 *   - 'integration.marketplace-'→ Zapier/n8n/Make listings
 *   - 'payments.ach-'           → ACH payouts
 *   - 'payroll.'                → Payroll adapters (8 keys)
 */
export const GATED_FLAG_NAMESPACE_PREFIXES = [
  'compliance-',
  'idp-deprovisioning',
  'module.idp-deprovisioning',
  'gulf-',
  'gulf.',
  'offboarding-ip-',
  'module.us-',
  'module.workforce-',
  'module.employee-',
  'module.hr-',
  'module.iris-',
  'module.public-api',
  'module.public-status-page',
  'module.developer-portal',
  'module.api-sandbox',
  'module.outbound-',
  'integration.personio-',
  'integration.bamboohr-',
  'integration.marketplace-',
  'payments.ach-',
  'payroll.',
] as const satisfies readonly string[];

export function isGatedFlag(key: string): boolean {
  return GATED_FLAG_NAMESPACE_PREFIXES.some(prefix => key.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// Helpers (consumed by the boot gate in registry.ts)
// ---------------------------------------------------------------------------

/**
 * Returns the signoff entry for a flag key, or undefined if the key has
 * no registry entry. A missing entry for a gated key is treated as a boot
 * failure by the gate in registry.ts.
 */
export function getFlagSignoff(key: string): FlagSignoffEntry | undefined {
  return Registry[key];
}

/**
 * Returns all flag keys whose status is 'PENDING'. Exposed for tooling and
 * future audit dashboards.
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
