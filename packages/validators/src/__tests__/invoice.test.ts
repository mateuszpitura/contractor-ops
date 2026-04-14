import { describe, expect, it } from 'vitest';
import { invoiceCreateSchema, invoiceListSchema, invoiceManualMatchSchema } from '../invoice.js';

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
});
