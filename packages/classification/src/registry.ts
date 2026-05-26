// ---------------------------------------------------------------------------
// Classification Profile Registry
// ---------------------------------------------------------------------------
//
// Per D-02: registry-based pluggable profile architecture mirroring
// packages/einvoice. Each country rule set (IR35, Scheinselbständigkeit)
// registers a ClassificationProfile via `registerProfile` on import.
//
// Per CLASS-01: adding a profile via `registerProfile` does NOT require
// modifying this file — tree-shakeable, finite set of country profiles.

import type { ClassificationProfile } from './types/profile.js';

/**
 * Static registry map for classification country profiles.
 */
const profiles = new Map<string, ClassificationProfile>();

/**
 * Register a country profile. Idempotent — re-registering the same
 * profileId is a no-op (Next.js dev HMR re-evaluates the registering
 * module on every request, which would otherwise crash every tRPC call
 * with `Classification profile already registered`). Production runs
 * register exactly once at module init.
 */
export function registerProfile(profile: ClassificationProfile): void {
  if (profiles.has(profile.profileId)) return;
  profiles.set(profile.profileId, profile);
}

/**
 * Retrieve a registered profile by ID.
 * Throws if profile not found (fail-fast over silent null).
 */
export function getProfile(profileId: string): ClassificationProfile {
  const profile = profiles.get(profileId);
  if (!profile) {
    throw new Error(
      `Unknown classification profile: ${profileId}. Available: ${Array.from(profiles.keys()).join(', ') || 'none'}`,
    );
  }
  return profile;
}

/**
 * Retrieve the first registered profile matching a country code (ISO 3166-1 alpha-2).
 * Throws if no profile exists for that country.
 */
export function getProfileForCountry(countryCode: string): ClassificationProfile {
  const normalized = countryCode.toUpperCase();
  for (const profile of profiles.values()) {
    if (profile.country.toUpperCase() === normalized) {
      return profile;
    }
  }
  const available = Array.from(profiles.values())
    .map(p => p.country)
    .join(', ');
  throw new Error(
    `No classification profile for country: ${countryCode}. Available: ${available || 'none'}`,
  );
}

/**
 * List all registered profiles.
 */
export function listProfiles(): ClassificationProfile[] {
  return Array.from(profiles.values());
}

/**
 * Clear all registered profiles (for testing only).
 */
export function clearProfiles(): void {
  profiles.clear();
}
