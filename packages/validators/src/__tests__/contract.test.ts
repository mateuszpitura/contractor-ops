import { describe, expect, it } from 'vitest';
import {
  amendmentCreateSchema,
  contractCreateSchema,
  contractListSchema,
  contractStatusTransitionSchema,
  contractUpdateSchema,
  orgExpiryReminderDefaultsSchema,
} from '../contract.js';

const validCreate = {
  contractorId: 'ctr_1',
  title: 'MSA 2026',
  type: 'B2B_MASTER_SERVICE' as const,
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2027-01-01T00:00:00.000Z',
  currency: 'PLN',
  billingModel: 'MONTHLY_RETAINER' as const,
  rateType: 'MONTHLY_FIXED' as const,
};

describe('contractCreateSchema', () => {
  it('accepts minimal valid create payload', () => {
    const r = contractCreateSchema.safeParse(validCreate);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.autoRenewal).toBe(false);
    }
  });

  it('rejects endDate before startDate', () => {
    const r = contractCreateSchema.safeParse({
      ...validCreate,
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-01-01T00:00:00.000Z',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some(i => i.path.includes('endDate'))).toBe(true);
    }
  });

  it('rejects endDate equal to startDate (must be strictly after)', () => {
    const r = contractCreateSchema.safeParse({
      ...validCreate,
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-06-01T00:00:00.000Z',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some(i => i.path.includes('endDate'))).toBe(true);
    }
  });

  it('rejects empty title', () => {
    const r = contractCreateSchema.safeParse({ ...validCreate, title: '' });
    expect(r.success).toBe(false);
  });

  it('rejects wrong currency length', () => {
    const r = contractCreateSchema.safeParse({ ...validCreate, currency: 'PL' });
    expect(r.success).toBe(false);
  });
});

describe('contractUpdateSchema', () => {
  it('accepts partial patch', () => {
    const r = contractUpdateSchema.safeParse({ title: 'New title' });
    expect(r.success).toBe(true);
  });

  it('accepts empty object', () => {
    const r = contractUpdateSchema.safeParse({});
    expect(r.success).toBe(true);
  });
});

describe('contractListSchema', () => {
  it('applies defaults', () => {
    const r = contractListSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.pageSize).toBe(25);
      expect(r.data.sortBy).toBe('end_date');
    }
  });

  it('rejects pageSize above max', () => {
    const r = contractListSchema.safeParse({ pageSize: 99 });
    expect(r.success).toBe(false);
  });
});

describe('contractStatusTransitionSchema', () => {
  it('accepts valid transition', () => {
    const r = contractStatusTransitionSchema.safeParse({
      id: 'c1',
      targetStatus: 'ACTIVE',
    });
    expect(r.success).toBe(true);
  });
});

describe('amendmentCreateSchema', () => {
  it('accepts amendment with changesSummaryJson', () => {
    const r = amendmentCreateSchema.safeParse({
      contractId: 'c1',
      title: 'A1',
      effectiveDate: '2026-03-01T00:00:00.000Z',
      changesSummaryJson: { rate: { from: 1, to: 2 } },
    });
    expect(r.success).toBe(true);
  });
});

describe('orgExpiryReminderDefaultsSchema', () => {
  it('accepts 1–10 positive day intervals', () => {
    const r = orgExpiryReminderDefaultsSchema.safeParse({
      reminderDaysBefore: [30, 60, 90],
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty reminderDaysBefore', () => {
    const r = orgExpiryReminderDefaultsSchema.safeParse({
      reminderDaysBefore: [],
    });
    expect(r.success).toBe(false);
  });
});
