import { describe, expect, it, vi } from 'vitest';
import { runPipeline } from '../engine/pipeline.js';
import { KsefProfile } from '../profiles/ksef/index.js';
import type { ComplianceStatus } from '../types/compliance.js';
import type { EInvoice } from '../types/invoice.js';
import type { EInvoiceProfile, QRCodeable, Signable } from '../types/profile.js';
import type { ValidationResult } from '../types/validation.js';

// ---------------------------------------------------------------------------
// Test Invoice
// ---------------------------------------------------------------------------

const testInvoice: EInvoice = {
  id: 'INV-001',
  issueDate: '2026-04-11',
  invoiceTypeCode: '380',
  currencyCode: 'PLN',
  supplier: { id: '1234567890', name: 'Seller Sp. z o.o.', country: 'PL' },
  customer: { id: '0987654321', name: 'Buyer S.A.', country: 'PL' },
  lines: [
    {
      lineNumber: 1,
      description: 'Consulting services',
      quantity: 1,
      unit: 'szt',
      netAmountMinor: 10000,
      vatRate: '23',
      vatAmountMinor: 2300,
      grossAmountMinor: 12300,
    },
  ],
  taxExclusiveAmount: 10000,
  taxInclusiveAmount: 12300,
  payableAmount: 12300,
  taxBreakdown: [
    { taxableAmountMinor: 10000, taxAmountMinor: 2300, taxCategory: 'S', percent: 23 },
  ],
  profileId: 'mock',
};

// ---------------------------------------------------------------------------
// Mock Profiles
// ---------------------------------------------------------------------------

function createBarebonesProfile(): EInvoiceProfile {
  return {
    profileId: 'bare',
    country: 'XX',
    displayName: 'Barebones',
    sign: undefined,
    qrCode: undefined,
    async generate() {
      return '<bare-xml/>';
    },
    async parse() {
      return testInvoice;
    },
    async validate(): Promise<ValidationResult> {
      return { valid: true, errors: [], warnings: [], profileId: 'bare' };
    },
    async getComplianceStatus(): Promise<ComplianceStatus> {
      return {
        profileId: 'bare',
        state: 'not_connected',
        country: 'XX',
        displayName: 'Barebones',
        healthScore: 0,
        capabilities: { canGenerate: true, canParse: true, canSign: false, canQRCode: false },
      };
    },
  };
}

function createSignableProfile(): EInvoiceProfile {
  const signMock: Signable = {
    sign: vi.fn().mockResolvedValue('<signed-xml/>'),
    verify: vi.fn().mockResolvedValue({ valid: true }),
  };
  return {
    ...createBarebonesProfile(),
    profileId: 'signable',
    sign: signMock,
  };
}

function createQRProfile(): EInvoiceProfile {
  const qrMock: QRCodeable = {
    generateQR: vi.fn().mockResolvedValue(Buffer.from('QR_DATA')),
    parseQR: vi.fn().mockResolvedValue({}),
  };
  return {
    ...createBarebonesProfile(),
    profileId: 'qr',
    qrCode: qrMock,
  };
}

function createFullProfile(): EInvoiceProfile {
  const signMock: Signable = {
    sign: vi.fn().mockResolvedValue('<signed-xml/>'),
    verify: vi.fn().mockResolvedValue({ valid: true }),
  };
  const qrMock: QRCodeable = {
    generateQR: vi.fn().mockResolvedValue(Buffer.from('QR_DATA')),
    parseQR: vi.fn().mockResolvedValue({}),
  };
  return {
    ...createBarebonesProfile(),
    profileId: 'full',
    sign: signMock,
    qrCode: qrMock,
  };
}

function createFailValidationProfile(): EInvoiceProfile {
  return {
    ...createBarebonesProfile(),
    profileId: 'fail-validate',
    async validate(): Promise<ValidationResult> {
      return {
        valid: false,
        errors: [{ code: 'SCHEMA', message: 'Invalid', severity: 'error' }],
        warnings: [],
        profileId: 'fail-validate',
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runPipeline', () => {
  it('profile with NO sign/qrCode — returns XML only', async () => {
    const result = await runPipeline(createBarebonesProfile(), testInvoice);
    expect(result.xml).toBe('<bare-xml/>');
    expect(result.signedXml).toBeNull();
    expect(result.qrData).toBeNull();
    expect(result.stepsExecuted).toEqual(['generate', 'validate']);
  });

  it('profile with Signable — returns signedXml', async () => {
    const profile = createSignableProfile();
    const result = await runPipeline(profile, testInvoice, {
      certificate: { certificate: 'cert-base64' },
    });
    expect(result.signedXml).toBe('<signed-xml/>');
    expect(result.qrData).toBeNull();
    expect(result.stepsExecuted).toContain('sign');
  });

  it('profile with QRCodeable — returns qrData', async () => {
    const profile = createQRProfile();
    const result = await runPipeline(profile, testInvoice);
    expect(result.qrData).toEqual(Buffer.from('QR_DATA'));
    expect(result.signedXml).toBeNull();
    expect(result.stepsExecuted).toContain('qrCode');
  });

  it('profile with both Signable and QRCodeable — returns both', async () => {
    const profile = createFullProfile();
    const result = await runPipeline(profile, testInvoice, {
      certificate: { certificate: 'cert-base64' },
    });
    expect(result.signedXml).toBe('<signed-xml/>');
    expect(result.qrData).toEqual(Buffer.from('QR_DATA'));
    expect(result.stepsExecuted).toEqual(['generate', 'validate', 'sign', 'qrCode']);
  });

  it('validation failure stops pipeline before sign/QR', async () => {
    const profile = createFailValidationProfile();
    const result = await runPipeline(profile, testInvoice);
    expect(result.validation.valid).toBe(false);
    expect(result.signedXml).toBeNull();
    expect(result.qrData).toBeNull();
    expect(result.stepsExecuted).toEqual(['generate', 'validate']);
  });

  it('sign skipped when no certificate provided but profile supports it', async () => {
    const profile = createSignableProfile();
    const result = await runPipeline(profile, testInvoice);
    expect(result.signedXml).toBeNull();
    expect(result.validation.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'SIGN_SKIPPED' })]),
    );
  });

  it('validation result included regardless of sign/QR', async () => {
    const result = await runPipeline(createBarebonesProfile(), testInvoice);
    expect(result.validation).toBeDefined();
    expect(result.validation.profileId).toBe('bare');
  });

  it('KsefProfile through pipeline — generate and validate only', async () => {
    const ksef = new KsefProfile();
    const result = await runPipeline(ksef, testInvoice);
    expect(result.stepsExecuted).toEqual(['generate', 'validate']);
    expect(result.signedXml).toBeNull();
    expect(result.qrData).toBeNull();
    expect(result.profileId).toBe('ksef');
  });
});
