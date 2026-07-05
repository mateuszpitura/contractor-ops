// ---------------------------------------------------------------------------
// Payroll Export Profile Registry
// ---------------------------------------------------------------------------
//
// A static, finite registry of per-market payroll export targets. Profiles
// register via the convenience `register*Profile()` functions exported from
// `./index.ts`; the engine resolves them by id. Mirrors the e-invoice
// registry shape (register / get / list / clear).

import type { PayrollExportProfile } from './types/profile.js';

const profiles = new Map<string, PayrollExportProfile>();

/**
 * Register a payroll export profile. Throws if a profile with the same ID is
 * already registered (prevents silent overwrites).
 */
export function registerProfile(profile: PayrollExportProfile): void {
  if (profiles.has(profile.profileId)) {
    throw new Error(`Payroll export profile already registered: ${profile.profileId}`);
  }
  profiles.set(profile.profileId, profile);
}

/**
 * Retrieve a registered profile by ID. Throws with the available list if the
 * profile is not found (fail-fast over silent null).
 */
export function getProfile(profileId: string): PayrollExportProfile {
  const profile = profiles.get(profileId);
  if (!profile) {
    throw new Error(
      `Unknown payroll export profile: ${profileId}. Available: ${Array.from(profiles.keys()).join(', ') || 'none'}`,
    );
  }
  return profile;
}

/** List all registered profiles. */
export function listProfiles(): PayrollExportProfile[] {
  return Array.from(profiles.values());
}

/** Clear all registered profiles (for testing only). */
export function clearProfiles(): void {
  profiles.clear();
}
