// ---------------------------------------------------------------------------
// E-Invoice Profile Registry
// ---------------------------------------------------------------------------

import type { EInvoiceProfile } from './types/profile.js';

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
