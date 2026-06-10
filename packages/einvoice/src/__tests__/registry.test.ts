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
        state: 'notConnected',
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

// ---------------------------------------------------------------------------
// XRechnung-DE registration
//
// Imports the profile module directly (not the package root) to sidestep the
// zatca -> @contractor-ops/gov-api workspace-dist dependency that breaks in
// environments where gov-api hasn't been built yet. The public
// `registerXRechnungDEProfile()` convenience fn is exported from
// `packages/einvoice/src/index.ts` — see that file's E2E consumers.
// ---------------------------------------------------------------------------

describe('Profile Registry — XRechnung-DE', () => {
  beforeEach(() => {
    clearProfiles();
  });

  it('XRechnungDEProfile registers under profileId "xrechnung-de" with DE country', async () => {
    const { XRechnungDEProfile } = await import('../profiles/xrechnung-de/index.js');
    registerProfile(new XRechnungDEProfile());

    const profile = getProfile('xrechnung-de');
    expect(profile).toBeDefined();
    expect(profile.profileId).toBe('xrechnung-de');
    expect(profile.country).toBe('DE');
    expect(profile.displayName).toContain('XRechnung');
  });

  it('registered XRechnung profile generates CII XML via the profile.generate API', async () => {
    const { XRechnungDEProfile } = await import('../profiles/xrechnung-de/index.js');
    const { XRECHNUNG_DE_PROFILE_ID } = await import('../profiles/xrechnung-de/constants.js');
    registerProfile(new XRechnungDEProfile());

    const profile = getProfile('xrechnung-de');
    const xml = await profile.generate({
      id: 'INV-1',
      issueDate: '2026-04-14',
      invoiceTypeCode: '380',
      currencyCode: 'EUR',
      profileId: XRECHNUNG_DE_PROFILE_ID,
      supplier: { id: 'DE1', name: 'S', country: 'DE' },
      customer: { id: 'DE2', name: 'C', country: 'DE' },
      lines: [
        {
          lineNumber: 1,
          description: 'item',
          quantity: 1,
          unit: 'C62',
          unitPriceMinor: 1000,
          netAmountMinor: 1000,
          vatRate: '19',
          vatAmountMinor: 190,
        },
      ],
      taxExclusiveAmount: 1000,
      taxInclusiveAmount: 1190,
      payableAmount: 1190,
      taxBreakdown: [
        { taxableAmountMinor: 1000, taxAmountMinor: 190, taxCategory: 'S', percent: 19 },
      ],
    });
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain('<rsm:CrossIndustryInvoice');
  });

  it('parse() on XRechnung profile round-trips through generator output (Phase 62)', async () => {
    // The real CII parser is implemented; this test asserts the round-trip
    // invariant.
    const { XRechnungDEProfile } = await import('../profiles/xrechnung-de/index.js');
    const { generateXRechnungCii } = await import('../profiles/xrechnung-de/generator.js');
    registerProfile(new XRechnungDEProfile());

    const profile = getProfile('xrechnung-de');
    const invoice = {
      id: 'RT-0001',
      issueDate: '2026-04-14',
      invoiceTypeCode: '380',
      currencyCode: 'EUR',
      profileId: 'xrechnung-de',
      supplier: { id: 'DE111111111', name: 'Seller GmbH', country: 'DE' },
      customer: { id: 'DE222222222', name: 'Buyer GmbH', country: 'DE' },
      lines: [
        {
          lineNumber: 1,
          description: 'Roundtrip item',
          quantity: 1,
          unit: 'C62',
          unitPriceMinor: 1000,
          netAmountMinor: 1000,
          vatRate: '19',
        },
      ],
      taxExclusiveAmount: 1000,
      taxInclusiveAmount: 1190,
      payableAmount: 1190,
      taxBreakdown: [
        { taxableAmountMinor: 1000, taxAmountMinor: 190, taxCategory: 'S', percent: 19 },
      ],
    };
    const xml = generateXRechnungCii(invoice, null);
    const parsed = await profile.parse(xml);
    expect(parsed.id).toBe('RT-0001');
    expect(parsed.currencyCode).toBe('EUR');
    expect(parsed.profileId).toBe('xrechnung-de');
  });

  it('XRechnungDEProfile.validate() returns a ValidationResult for invalid input', async () => {
    const { XRechnungDEProfile } = await import('../profiles/xrechnung-de/index.js');
    registerProfile(new XRechnungDEProfile());

    const profile = getProfile('xrechnung-de');
    const result = await profile.validate('<irrelevant/>');
    expect(result.valid).toBe(false);
    expect(result.profileId).toBe('xrechnung-de');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('XRechnungDEProfile.getComplianceStatus() reports active state + KoSIT rule-set version', async () => {
    const { XRechnungDEProfile } = await import('../profiles/xrechnung-de/index.js');
    const { KOSIT_RULE_SET_VERSION } = await import('../profiles/xrechnung-de/constants.js');
    registerProfile(new XRechnungDEProfile());

    const profile = getProfile('xrechnung-de');
    const status = await profile.getComplianceStatus('org-1');
    expect(status.state).toBe('active');
    expect(status.country).toBe('DE');
    expect(status.displayName).toContain(KOSIT_RULE_SET_VERSION);
    expect(status.capabilities.canGenerate).toBe(true);
    expect(status.capabilities.canParse).toBe(true); // parser is wired
  });
});
