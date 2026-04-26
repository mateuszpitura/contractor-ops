import { describe, expect, it } from 'vitest';
import {
  de13bServiceTypeEnum,
  invoiceCreateSchema,
  invoiceListSchema,
  invoiceManualMatchSchema,
  invoiceUpdateSchema,
} from '../invoice.js';

// ---------------------------------------------------------------------------
// invoiceCreateSchema
// ---------------------------------------------------------------------------

describe('invoiceCreateSchema', () => {
  const validInput = {
    invoiceNumber: 'FV/2026/001',
    issueDate: '2026-03-01',
    dueDate: '2026-03-31',
    subtotalMinor: 100000,
    vatAmountMinor: 23000,
    totalMinor: 123000,
    amountToPayMinor: 123000,
    documentIds: ['doc_abc'],
  };

  it('accepts valid input', () => {
    const result = invoiceCreateSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it.each([
    'invoiceNumber',
    'issueDate',
    'dueDate',
    'subtotalMinor',
    'totalMinor',
    'amountToPayMinor',
    'documentIds',
  ] as const)("rejects when required field '%s' is missing", field => {
    const input = { ...validInput };
    delete (input as Record<string, unknown>)[field];
    const result = invoiceCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.flatMap(i => i.path);
      expect(paths).toContain(field);
    }
  });

  it('rejects negative minor-unit values', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      subtotalMinor: -1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path.includes('subtotalMinor'));
      expect(issue).toBeDefined();
    }
  });

  it('rejects negative totalMinor', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      totalMinor: -500,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path.includes('totalMinor'));
      expect(issue).toBeDefined();
    }
  });

  it('rejects empty documentIds array with specific message', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      documentIds: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path.includes('documentIds'));
      expect(issue).toBeDefined();
      expect(issue?.message).toContain('At least one document');
    }
  });

  it('rejects dueDate before issueDate', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      issueDate: '2026-03-15',
      dueDate: '2026-03-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path.includes('dueDate'));
      expect(issue).toBeDefined();
      expect(issue?.message).toBe('Due date must be on or after issue date');
    }
  });

  it('rejects servicePeriodEnd before servicePeriodStart', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      servicePeriodStart: '2026-03-15',
      servicePeriodEnd: '2026-03-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path.includes('servicePeriodEnd'));
      expect(issue).toBeDefined();
      expect(issue?.message).toBe('Service period end must be on or after start');
    }
  });

  it('rejects issueDate in the future', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const futureStr = future.toISOString().split('T')[0];

    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      issueDate: futureStr,
      dueDate: futureStr,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path.includes('issueDate'));
      expect(issue).toBeDefined();
      expect(issue?.message).toBe('Issue date cannot be in the future');
    }
  });

  it('defaults currency to PLN', () => {
    const result = invoiceCreateSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('PLN');
    }
  });

  it('requires currency to be exactly 3 characters', () => {
    const tooShort = invoiceCreateSchema.safeParse({
      ...validInput,
      currency: 'PL',
    });
    expect(tooShort.success).toBe(false);
    if (!tooShort.success) {
      const issue = tooShort.error.issues.find(i => i.path.includes('currency'));
      expect(issue).toBeDefined();
    }

    const tooLong = invoiceCreateSchema.safeParse({
      ...validInput,
      currency: 'PLNN',
    });
    expect(tooLong.success).toBe(false);
    if (!tooLong.success) {
      const issue = tooLong.error.issues.find(i => i.path.includes('currency'));
      expect(issue).toBeDefined();
    }

    const valid = invoiceCreateSchema.safeParse({
      ...validInput,
      currency: 'EUR',
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.currency).toBe('EUR');
    }
  });
});

// ---------------------------------------------------------------------------
// invoiceListSchema
// ---------------------------------------------------------------------------

describe('invoiceListSchema', () => {
  it('applies defaults', () => {
    const result = invoiceListSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(25);
      expect(result.data.sortBy).toBe('receivedAt');
      expect(result.data.sortOrder).toBe('desc');
    }
  });

  it('accepts valid filters', () => {
    const result = invoiceListSchema.safeParse({
      filters: {
        status: ['RECEIVED', 'APPROVED'],
        matchStatus: ['UNMATCHED'],
        source: ['MANUAL_UPLOAD'],
        contractorId: 'ctr_123',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status in filters', () => {
    const result = invoiceListSchema.safeParse({
      filters: {
        status: ['NOT_A_STATUS'],
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.flatMap(i => i.path);
      expect(paths).toContain('filters');
    }
  });
});

// ---------------------------------------------------------------------------
// invoiceManualMatchSchema
// ---------------------------------------------------------------------------

describe('invoiceManualMatchSchema', () => {
  it('accepts valid input', () => {
    const result = invoiceManualMatchSchema.safeParse({
      invoiceId: 'inv_123',
      contractorId: 'ctr_456',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty invoiceId', () => {
    const result = invoiceManualMatchSchema.safeParse({
      invoiceId: '',
      contractorId: 'ctr_456',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path.includes('invoiceId'));
      expect(issue).toBeDefined();
    }
  });

  it('rejects empty contractorId', () => {
    const result = invoiceManualMatchSchema.safeParse({
      invoiceId: 'inv_123',
      contractorId: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path.includes('contractorId'));
      expect(issue).toBeDefined();
    }
  });

  it('accepts optional contractId FK', () => {
    const result = invoiceManualMatchSchema.safeParse({
      invoiceId: 'inv_123',
      contractorId: 'ctr_456',
      contractId: 'con_789',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// invoiceCreateSchema — additional branch coverage (refinements)
// ---------------------------------------------------------------------------

describe('invoiceCreateSchema — refinement branches', () => {
  const validInput = {
    invoiceNumber: 'FV/2026/001',
    issueDate: '2026-03-01',
    dueDate: '2026-03-31',
    subtotalMinor: 100000,
    vatAmountMinor: 23000,
    totalMinor: 123000,
    amountToPayMinor: 123000,
    documentIds: ['doc_abc'],
  };

  it('rejects totalMinor that does not match subtotal + vat - withholding', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      totalMinor: 999999,
      amountToPayMinor: 999999,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.message === 'INVOICE_AMOUNT_MISMATCH');
      expect(issue).toBeDefined();
    }
  });

  it('rejects amountToPayMinor that does not match totalMinor', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      amountToPayMinor: 100000, // not equal to totalMinor
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        i => i.path.includes('amountToPayMinor') && i.message === 'INVOICE_AMOUNT_MISMATCH',
      );
      expect(issue).toBeDefined();
    }
  });

  it('accepts withholding that adjusts totalMinor correctly', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      withholdingMinor: 10000,
      totalMinor: 113000, // 100000 + 23000 - 10000
      amountToPayMinor: 113000,
    });
    expect(result.success).toBe(true);
  });

  it('accepts servicePeriod when both start and end are present and valid', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      servicePeriodStart: '2026-03-01',
      servicePeriodEnd: '2026-03-31',
    });
    expect(result.success).toBe(true);
  });

  it('accepts servicePeriod when only start is provided (no end)', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      servicePeriodStart: '2026-03-01',
    });
    expect(result.success).toBe(true);
  });

  it('accepts dueDate equal to issueDate', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      dueDate: '2026-03-01', // same as issueDate
    });
    expect(result.success).toBe(true);
  });

  it('defaults isReverseCharge to false', () => {
    const result = invoiceCreateSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isReverseCharge).toBe(false);
    }
  });

  it('accepts isReverseCharge=true', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      isReverseCharge: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isReverseCharge).toBe(true);
    }
  });

  it('requires reverseChargeOverrideReason when reverseChargeOverride is false', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      reverseChargeOverride: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path.includes('reverseChargeOverrideReason'));
      expect(issue).toBeDefined();
      expect(issue?.message).toContain('Override reason required');
    }
  });

  it('accepts reverseChargeOverride=false with valid reason', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      reverseChargeOverride: false,
      reverseChargeOverrideReason: 'Verified by finance team - domestic supply',
    });
    expect(result.success).toBe(true);
  });

  it('does not require reason when reverseChargeOverride is undefined', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
    });
    expect(result.success).toBe(true);
  });

  it('does not require reason when reverseChargeOverride is true', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      reverseChargeOverride: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects reverseChargeOverrideReason shorter than 5 chars', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      reverseChargeOverride: false,
      reverseChargeOverrideReason: 'abc',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid serviceType values', () => {
    const types = ['CONSTRUCTION', 'CLEANING_BUILDING', 'SCRAP_METALS', 'GOLD', 'MOBILE_PHONES'];
    for (const serviceType of types) {
      const result = invoiceCreateSchema.safeParse({
        ...validInput,
        serviceType,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid serviceType', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      serviceType: 'INVALID_TYPE',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional sellerTaxId and sellerName', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      sellerTaxId: 'PL1234567890',
      sellerName: 'Acme Corp',
      sellerBankAccount: 'PL12345678901234567890123456',
    });
    expect(result.success).toBe(true);
  });

  it('rejects sellerBankAccount longer than 34 chars', () => {
    const result = invoiceCreateSchema.safeParse({
      ...validInput,
      sellerBankAccount: 'A'.repeat(35),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// invoiceUpdateSchema
// ---------------------------------------------------------------------------

describe('invoiceUpdateSchema', () => {
  it('accepts empty update (all optional)', () => {
    const result = invoiceUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts partial update with single field', () => {
    const result = invoiceUpdateSchema.safeParse({
      invoiceNumber: 'FV/2026/002',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// invoiceListSchema — additional branches
// ---------------------------------------------------------------------------

describe('invoiceListSchema — additional branches', () => {
  it('accepts all sort options', () => {
    const sortOptions = [
      'receivedAt',
      'invoiceNumber',
      'issueDate',
      'dueDate',
      'totalMinor',
      'status',
    ] as const;
    for (const sortBy of sortOptions) {
      const result = invoiceListSchema.safeParse({ sortBy });
      expect(result.success).toBe(true);
    }
  });

  it('rejects pageSize above max', () => {
    const result = invoiceListSchema.safeParse({ pageSize: 200 });
    expect(result.success).toBe(false);
  });

  it('rejects page below min', () => {
    const result = invoiceListSchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it('accepts search parameter', () => {
    const result = invoiceListSchema.safeParse({ search: 'FV/2026' });
    expect(result.success).toBe(true);
  });

  it('accepts filter with matchStatus', () => {
    const result = invoiceListSchema.safeParse({
      filters: { matchStatus: ['MATCHED', 'PARTIAL', 'DISCREPANCY', 'MANUALLY_CONFIRMED'] },
    });
    expect(result.success).toBe(true);
  });

  it('accepts filter with all source types', () => {
    const result = invoiceListSchema.safeParse({
      filters: { source: ['MANUAL_UPLOAD', 'EMAIL_INTAKE', 'KSEF', 'API'] },
    });
    expect(result.success).toBe(true);
  });
});
