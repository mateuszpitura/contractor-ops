// Wave 0 scaffold — registry behavior (D-02, CLASS-01)
import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearProfiles,
  getProfile,
  getProfileForCountry,
  listProfiles,
  registerProfile,
} from '../registry.js';
import type { ClassificationProfile } from '../types/profile.js';

function makeProfile(overrides: Partial<ClassificationProfile> = {}): ClassificationProfile {
  return {
    profileId: 'test-profile',
    country: 'GB',
    displayName: 'Test',
    ruleSetVersion: '1.0.0',
    buildAssessment: () => ({
      ruleSetVersion: '1.0.0',
      profileId: 'test-profile',
      questions: [],
    }),
    scoreAssessment: () => ({
      kind: 'IR35',
      ruleSetVersion: '1.0.0',
      verdict: 'indeterminate',
      areas: [],
      computedAt: new Date().toISOString(),
    }),
    renderOutcome: () => ({
      kind: 'IR35',
      verdict: 'indeterminate',
      summary: '',
    }),
    ...overrides,
  };
}

describe('classification registry', () => {
  beforeEach(() => {
    clearProfiles();
  });

  it('throws on unknown country with message containing "No classification profile for country:"', () => {
    expect(() => getProfileForCountry('ZZ')).toThrow(/No classification profile for country:/);
  });

  it('is idempotent on clearProfiles + re-register', () => {
    const p = makeProfile();
    registerProfile(p);
    clearProfiles();
    expect(() => registerProfile(p)).not.toThrow();
    expect(listProfiles()).toHaveLength(1);
  });

  it('is idempotent on duplicate profileId registrations (HMR-safe)', () => {
    // Registry is intentionally idempotent: re-registering the same profileId
    // is a no-op so Next.js dev HMR (which re-evaluates registering modules
    // on every request) does not crash every tRPC call. The first
    // registration wins; subsequent ones are silently ignored.
    const first = makeProfile({ displayName: 'First' });
    const second = makeProfile({ displayName: 'Second' });
    registerProfile(first);
    expect(() => registerProfile(second)).not.toThrow();
    expect(listProfiles()).toHaveLength(1);
    expect(getProfile('test-profile')).toBe(first);
  });

  it('retrieves registered profile by ID', () => {
    const p = makeProfile({ profileId: 'p1' });
    registerProfile(p);
    expect(getProfile('p1')).toBe(p);
  });

  it('retrieves registered profile by country (case-insensitive)', () => {
    const p = makeProfile({ profileId: 'p-gb', country: 'GB' });
    registerProfile(p);
    expect(getProfileForCountry('gb')).toBe(p);
  });

  it('extensibility: new profile registered without modifying registry.ts source (CLASS-01)', () => {
    // A profile whose implementation lives outside packages/classification/src/registry.ts
    // can be registered purely via `registerProfile` — the registry is closed for modification,
    // open for extension.
    const external = makeProfile({ profileId: 'external', country: 'FR' });
    registerProfile(external);
    expect(getProfileForCountry('FR')).toBe(external);
  });
});
