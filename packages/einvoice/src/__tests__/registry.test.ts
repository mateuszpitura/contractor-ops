import { beforeEach, describe, expect, it } from 'vitest';
import { clearProfiles, getProfile, listProfiles, registerProfile } from '../registry.js';
import type { ComplianceStatus } from '../types/compliance.js';
import type { EInvoice } from '../types/invoice.js';
import type { EInvoiceProfile } from '../types/profile.js';
import type { ValidationResult } from '../types/validation.js';

// ---------------------------------------------------------------------------
// Mock Profile
// ---------------------------------------------------------------------------

function createMockProfile(id: string): EInvoiceProfile {
  return {
    profileId: id,
    country: 'XX',
    displayName: `Mock (${id})`,
    sign: undefined,
    qrCode: undefined,
    async generate(_invoice: EInvoice) {
      return '<xml/>';
    },
    async parse(_xml: string) {
      return {} as EInvoice;
    },
    async validate(_xml: string): Promise<ValidationResult> {
      return { valid: true, errors: [], warnings: [], profileId: id };
    },
    async getComplianceStatus(_orgId: string): Promise<ComplianceStatus> {
      return {
        profileId: id,
        state: 'not_connected',
        country: 'XX',
        displayName: `Mock (${id})`,
        healthScore: 0,
        capabilities: {
          canGenerate: true,
          canParse: true,
          canSign: false,
          canQRCode: false,
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Profile Registry', () => {
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

  it('throws for unregistered profileId', () => {
    expect(() => getProfile('nonexistent')).toThrow('Unknown e-invoicing profile: nonexistent');
  });

  it('lists all registered profiles', () => {
    const a = createMockProfile('profile-a');
    const b = createMockProfile('profile-b');
    registerProfile(a);
    registerProfile(b);
    const all = listProfiles();
    expect(all).toHaveLength(2);
    expect(all.map(p => p.profileId)).toEqual(['profile-a', 'profile-b']);
  });

  it('returns empty array when no profiles registered', () => {
    expect(listProfiles()).toEqual([]);
  });

  it('throws when registering duplicate profileId', () => {
    const mock = createMockProfile('dup');
    registerProfile(mock);
    expect(() => registerProfile(createMockProfile('dup'))).toThrow(
      'E-invoicing profile already registered: dup',
    );
  });
});
