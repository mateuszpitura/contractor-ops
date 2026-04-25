// Phase 64 · D-12 — Runtime signoff registry module.
//
// Validates the registry JSON at module load time (fail-fast on malformed data).
// Exports helper functions used by:
//   - packages/feature-flags/src/evaluator.ts (isAllApproved → disclaimer gate D-10)
//   - apps/web/src/app/admin/feature-flags/classification-engine/page.tsx (status page D-11)
//   - .github/workflows/ci.yml legal-gate-production job (getAllPending D-14)

import type { LockedDisclaimerKey } from './disclaimers.js';
import rawRegistry from './signoff-registry.json' with { type: 'json' };
import type { SignoffEntry, SignoffRegistry } from './signoff-registry-schema.js';
import { SignoffRegistrySchema } from './signoff-registry-schema.js';

// Validate at module load — throws if the JSON is malformed.
// This ensures server startup fails fast rather than silently using bad data.
// Uses process.stderr.write: this package has no @contractor-ops/logger dep.
let Registry: SignoffRegistry;
try {
  Registry = SignoffRegistrySchema.parse(rawRegistry);
} catch (err) {
  process.stderr.write(
    `[signoff-registry] signoff-registry.json failed Zod validation — startup aborted: ${String(err)}\n`,
  );
  throw err; // Fatal: abort module load
}

/**
 * Returns the signoff entry for a specific disclaimer key.
 * Returns undefined if the key has no registry entry (failing open — the
 * CI dangling-entry test catches this at PR time).
 */
export function getDisclaimerStatus(key: string): SignoffEntry | undefined {
  return Registry[key];
}

/**
 * Returns all disclaimer keys whose status is 'PENDING'.
 * Used by the production deploy gate and the evaluator override.
 */
export function getAllPending(): string[] {
  return Object.entries(Registry)
    .filter(([, entry]) => entry.status === 'PENDING')
    .map(([key]) => key);
}

/**
 * Returns true when every entry in the registry has status 'APPROVED'.
 * Used by the evaluator's classificationEngineDisclaimerGate (D-10) —
 * if false, the flag is forcibly disabled even when Unleash says ON.
 */
export function isAllApproved(): boolean {
  return getAllPending().length === 0;
}

/**
 * Returns the full registry snapshot (read-only).
 * Used by the admin status page to render the per-key table.
 */
export function getRegistry(): Readonly<SignoffRegistry> {
  return Registry;
}

export type { SignoffEntry, SignoffRegistry, SignoffStatus } from './signoff-registry-schema.js';
export type { LockedDisclaimerKey };
