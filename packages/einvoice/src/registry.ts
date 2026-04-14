// ---------------------------------------------------------------------------
// E-Invoice Profile Registry
// ---------------------------------------------------------------------------
//
// Known profile identifiers — imported and re-exported here so downstream
// callers can reference the canonical constants through a single surface
// (`@contractor-ops/einvoice/registry`). Actual profile registration is done
// at call sites via the convenience `register*Profile()` functions exported
// from `./index.ts`.
//
// Keeping the ID symbols visible in this file makes the static surface of
// the registry self-documenting — a grep for `ZUGFERD_DE_PROFILE_ID` in
// `registry.ts` returns this file, which is the invariant Plan 62-02 Task 5
// pins in its acceptance criteria.

import type { EInvoiceProfile } from './types/profile.js';
import { XRECHNUNG_DE_PROFILE_ID } from './profiles/xrechnung-de/constants.js';
import { ZUGFERD_DE_PROFILE_ID } from './profiles/zugferd-de/constants.js';

export { XRECHNUNG_DE_PROFILE_ID, ZUGFERD_DE_PROFILE_ID };

/**
 * Static registry map for e-invoicing country profiles.
 * Per D-02: type-safe, tree-shakeable, finite number of country profiles.
 */
const profiles = new Map<string, EInvoiceProfile>();

/**
 * Register a country profile. Throws if a profile with the same ID
 * is already registered (prevents silent overwrites).
 */
export function registerProfile(profile: EInvoiceProfile): void {
  if (profiles.has(profile.profileId)) {
    throw new Error(`E-invoicing profile already registered: ${profile.profileId}`);
  }
  profiles.set(profile.profileId, profile);
}

/**
 * Retrieve a registered profile by ID.
 * Throws if profile not found (fail-fast over silent null).
 */
export function getProfile(profileId: string): EInvoiceProfile {
  const profile = profiles.get(profileId);
  if (!profile) {
    throw new Error(
      `Unknown e-invoicing profile: ${profileId}. Available: ${Array.from(profiles.keys()).join(', ') || 'none'}`,
    );
  }
  return profile;
}

/**
 * List all registered profiles.
 */
export function listProfiles(): EInvoiceProfile[] {
  return Array.from(profiles.values());
}

/**
 * Clear all registered profiles (for testing only).
 */
export function clearProfiles(): void {
  profiles.clear();
}
