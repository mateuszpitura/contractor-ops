import { beforeEach, describe, expect, it } from 'vitest';

import { clearProfiles, getProfile, listProfiles, registerProfile } from '../registry.js';
import type { PayrollFeed } from '../types/feed.js';
import type { PayrollExportProfile, PayrollExportResult } from '../types/profile.js';

function createMockProfile(id: string): PayrollExportProfile {
  return {
    profileId: id,
    country: 'XX',
    displayName: `Mock (${id})`,
    flagKey: `payroll.${id}`,
    async generate(_feed: PayrollFeed): Promise<PayrollExportResult> {
      return { buffer: Buffer.from(id), ext: 'csv', mime: 'text/csv' };
    },
  };
}

describe('Payroll Export Registry', () => {
  beforeEach(() => {
    clearProfiles();
  });

  it('registers and retrieves a profile by profileId', () => {
    const mock = createMockProfile('test-profile');
    registerProfile(mock);
    const retrieved = getProfile('test-profile');
    expect(retrieved).toBe(mock);
    expect(retrieved.profileId).toBe('test-profile');
  });

  it('throws for an unregistered profileId, listing the available ids', () => {
    registerProfile(createMockProfile('symfonia'));
    expect(() => getProfile('nonexistent')).toThrow(
      'Unknown payroll export profile: nonexistent. Available: symfonia',
    );
  });

  it('lists all registered profiles', () => {
    registerProfile(createMockProfile('profile-a'));
    registerProfile(createMockProfile('profile-b'));
    const all = listProfiles();
    expect(all).toHaveLength(2);
    expect(all.map(p => p.profileId)).toEqual(['profile-a', 'profile-b']);
  });

  it('returns an empty array when no profiles are registered', () => {
    expect(listProfiles()).toEqual([]);
  });

  it('throws when registering a duplicate profileId', () => {
    registerProfile(createMockProfile('dup'));
    expect(() => registerProfile(createMockProfile('dup'))).toThrow(
      'Payroll export profile already registered: dup',
    );
  });
});
