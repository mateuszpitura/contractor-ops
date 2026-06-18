import { describe, expect, it } from 'vitest';
import {
  taxFormSubmissionSchema,
  w8beneFormSchema,
  w8benFormSchema,
  w9FormSchema,
} from '../w-form-validators.js';

// A valid EIN with an IRS-published prefix (01) for the W-9 TIN reference.
const VALID_EIN = '01-1234567';

const baseAttest = { perjuryAccepted: true as const, signerName: 'Jane Q. Contractor' };
const foreignAddress = { addressLine1: '1 Rynek', city: 'Kraków' };

describe('w-form-validators — W9 variant (US-FORM-01)', () => {
  it('accepts a W-9 with an EIN TIN reference, entity type, and backup-withholding flag', () => {
    const result = w9FormSchema.safeParse({
      formType: 'W9',
      usEntityType: 'LLC',
      backupWithholding: false,
      tin: { ein: VALID_EIN },
      ...baseAttest,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a W-9 carrying only the SSN last-4 reference (never the full SSN)', () => {
    const result = w9FormSchema.safeParse({
      formType: 'W9',
      usEntityType: 'INDIVIDUAL',
      backupWithholding: true,
      tin: { ssnLast4: '6789' },
      ...baseAttest,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a W-9 with neither an EIN nor an SSN last-4 reference', () => {
    const result = w9FormSchema.safeParse({
      formType: 'W9',
      usEntityType: 'INDIVIDUAL',
      backupWithholding: false,
      tin: {},
      ...baseAttest,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a 9-digit value masquerading as an SSN last-4 (last-4 must be exactly 4 digits)', () => {
    const result = w9FormSchema.safeParse({
      formType: 'W9',
      usEntityType: 'INDIVIDUAL',
      backupWithholding: false,
      tin: { ssnLast4: '123456789' },
      ...baseAttest,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a W-9 when the perjury attestation is not accepted', () => {
    const result = w9FormSchema.safeParse({
      formType: 'W9',
      usEntityType: 'INDIVIDUAL',
      backupWithholding: false,
      tin: { ssnLast4: '6789' },
      perjuryAccepted: false,
      signerName: 'Jane Q. Contractor',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a W-9 with an empty signer name', () => {
    const result = w9FormSchema.safeParse({
      formType: 'W9',
      usEntityType: 'INDIVIDUAL',
      backupWithholding: false,
      tin: { ssnLast4: '6789' },
      perjuryAccepted: true,
      signerName: '   ',
    });
    expect(result.success).toBe(false);
  });
});

describe('w-form-validators — W8BEN variant (US-FORM-02 / US-LOC-03)', () => {
  it('accepts a W-8BEN with treaty country, FTIN, address, and auto-populated treaty claim', () => {
    const result = w8benFormSchema.safeParse({
      formType: 'W8BEN',
      treatyCountry: 'PL',
      ftin: 'PL1234567890',
      ...foreignAddress,
      treatyArticle: 'Article 7',
      treatyRate: 0,
      ...baseAttest,
    });
    expect(result.success).toBe(true);
  });

  it('requires the FTIN', () => {
    const result = w8benFormSchema.safeParse({
      formType: 'W8BEN',
      treatyCountry: 'PL',
      ftin: '',
      ...foreignAddress,
      ...baseAttest,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-2-letter treaty country', () => {
    const result = w8benFormSchema.safeParse({
      formType: 'W8BEN',
      treatyCountry: 'POL',
      ftin: 'PL1234567890',
      ...foreignAddress,
      ...baseAttest,
    });
    expect(result.success).toBe(false);
  });
});

describe('w-form-validators — W8BENE variant (US-FORM-02)', () => {
  it('accepts a W-8BEN-E with LOB category, entity classification, FTIN, and address', () => {
    const result = w8beneFormSchema.safeParse({
      formType: 'W8BENE',
      treatyCountry: 'DE',
      entityType: 'CORPORATION',
      lobCategory: 'PUBLICLY_TRADED_CORPORATION',
      ftin: 'DE123456789',
      ...foreignAddress,
      treatyArticle: 'Article 7',
      treatyRate: 0,
      ...baseAttest,
    });
    expect(result.success).toBe(true);
  });

  it('requires the LOB category (line 14b)', () => {
    const result = w8beneFormSchema.safeParse({
      formType: 'W8BENE',
      treatyCountry: 'DE',
      entityType: 'CORPORATION',
      ftin: 'DE123456789',
      ...foreignAddress,
      ...baseAttest,
    });
    expect(result.success).toBe(false);
  });
});

describe('w-form-validators — taxFormSubmissionSchema discriminated union', () => {
  it('routes on formType to the W-9 variant', () => {
    const result = taxFormSubmissionSchema.safeParse({
      formType: 'W9',
      usEntityType: 'C_CORP',
      backupWithholding: false,
      tin: { ein: VALID_EIN },
      ...baseAttest,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.formType).toBe('W9');
  });

  it('routes on formType to the W-8BEN-E variant', () => {
    const result = taxFormSubmissionSchema.safeParse({
      formType: 'W8BENE',
      treatyCountry: 'NL',
      entityType: 'PARTNERSHIP',
      lobCategory: 'OTHER',
      ftin: 'NL123456789',
      ...foreignAddress,
      ...baseAttest,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.formType).toBe('W8BENE');
  });

  it('rejects an unknown formType discriminant', () => {
    const result = taxFormSubmissionSchema.safeParse({ formType: 'W4', signerName: 'x' });
    expect(result.success).toBe(false);
  });

  it('does NOT expose a full-SSN field on the W-9 variant (PII boundary)', () => {
    // A full 9-digit SSN must never round-trip: there is no `ssn` field to carry
    // it, and the only SSN-shaped input (ssnLast4) rejects a 9-digit value.
    const parsed = taxFormSubmissionSchema.safeParse({
      formType: 'W9',
      usEntityType: 'INDIVIDUAL',
      backupWithholding: false,
      ssn: '123-45-6789',
      tin: { ssnLast4: '6789' },
      ...baseAttest,
    } as any);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect('ssn' in parsed.data).toBe(false);
    }
  });
});
