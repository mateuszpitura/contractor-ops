import { describe, expect, it } from 'vitest';
import {
  amendmentCreateSchema,
  contractCreateSchema,
  contractExpiryReminderSchema,
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
      expect(r.data.sortBy).toBe('endDate');
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

  it('rejects more than 10 reminder days', () => {
    const r = orgExpiryReminderDefaultsSchema.safeParse({
      reminderDaysBefore: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    });
    expect(r.success).toBe(false);
  });

  it('rejects non-positive reminder days', () => {
    const r = orgExpiryReminderDefaultsSchema.safeParse({
      reminderDaysBefore: [0],
    });
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// contractCreateSchema — branch coverage for refinements
// ---------------------------------------------------------------------------

describe('contractCreateSchema — refinement branches', () => {
  it('accepts when endDate is absent (open-ended contract)', () => {
    const r = contractCreateSchema.safeParse({
      ...validCreate,
      endDate: undefined,
    });
    expect(r.success).toBe(true);
  });

  it('accepts autoRenewal=true', () => {
    const r = contractCreateSchema.safeParse({
      ...validCreate,
      autoRenewal: true,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.autoRenewal).toBe(true);
    }
  });

  it('accepts all contract types', () => {
    const types = [
      'B2B_MASTER_SERVICE',
      'STATEMENT_OF_WORK',
      'NDA',
      'IP_ASSIGNMENT',
      'DPA',
      'OTHER',
    ] as const;
    for (const type of types) {
      const r = contractCreateSchema.safeParse({ ...validCreate, type });
      expect(r.success).toBe(true);
    }
  });

  it('accepts all billing models', () => {
    const models = [
      'MONTHLY_RETAINER',
      'HOURLY',
      'DAILY',
      'MILESTONE',
      'DELIVERABLE_BASED',
      'MIXED',
    ] as const;
    for (const billingModel of models) {
      const r = contractCreateSchema.safeParse({ ...validCreate, billingModel });
      expect(r.success).toBe(true);
    }
  });

  it('accepts all rate types', () => {
    const rateTypes = [
      'MONTHLY_FIXED',
      'PER_HOUR',
      'PER_DAY',
      'PER_MILESTONE',
      'PER_DELIVERABLE',
    ] as const;
    for (const rateType of rateTypes) {
      const r = contractCreateSchema.safeParse({ ...validCreate, rateType });
      expect(r.success).toBe(true);
    }
  });

  it('rejects invalid contractorId (empty)', () => {
    const r = contractCreateSchema.safeParse({ ...validCreate, contractorId: '' });
    expect(r.success).toBe(false);
  });

  it('accepts optional fields', () => {
    const r = contractCreateSchema.safeParse({
      ...validCreate,
      noticePeriodDays: 30,
      renewalTerms: 'Auto renew annually',
      rateValueMinor: 500000,
      retainerAmountMinor: 1000000,
      expectedHoursPerPeriod: 160,
      paymentTermsDays: 14,
      invoiceCycle: 'MONTHLY',
      notes: 'Test notes',
    });
    expect(r.success).toBe(true);
  });

  it('rejects negative rateValueMinor', () => {
    const r = contractCreateSchema.safeParse({ ...validCreate, rateValueMinor: -1 });
    expect(r.success).toBe(false);
  });

  it('rejects non-positive noticePeriodDays', () => {
    const r = contractCreateSchema.safeParse({ ...validCreate, noticePeriodDays: 0 });
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// contractUpdateSchema — branch coverage
// ---------------------------------------------------------------------------

describe('contractUpdateSchema — branch coverage', () => {
  it('accepts null for nullable optional fields', () => {
    const r = contractUpdateSchema.safeParse({
      endDate: null,
      noticePeriodDays: null,
      renewalTerms: null,
      rateValueMinor: null,
      retainerAmountMinor: null,
      expectedHoursPerPeriod: null,
      paymentTermsDays: null,
      invoiceCycle: null,
      notes: null,
    });
    expect(r.success).toBe(true);
  });

  it('coerces empty string FK fields to null', () => {
    const r = contractUpdateSchema.safeParse({
      internalOwnerUserId: '',
      teamId: '',
      projectId: '',
      costCenterId: '',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.internalOwnerUserId).toBeNull();
      expect(r.data.teamId).toBeNull();
      expect(r.data.projectId).toBeNull();
      expect(r.data.costCenterId).toBeNull();
    }
  });

  it('accepts valid FK string values', () => {
    const r = contractUpdateSchema.safeParse({
      internalOwnerUserId: 'user-1',
      teamId: 'team-1',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.internalOwnerUserId).toBe('user-1');
    }
  });
});

// ---------------------------------------------------------------------------
// contractListSchema — branch coverage
// ---------------------------------------------------------------------------

describe('contractListSchema — branch coverage', () => {
  it('accepts all sort options', () => {
    const sortOptions = ['createdAt', 'title', 'status', 'endDate', 'startDate', 'type'] as const;
    for (const sortBy of sortOptions) {
      const r = contractListSchema.safeParse({ sortBy });
      expect(r.success).toBe(true);
    }
  });

  it('accepts filters with all filter types', () => {
    const r = contractListSchema.safeParse({
      filters: {
        status: ['DRAFT', 'ACTIVE'],
        type: ['NDA', 'DPA'],
        billingModel: ['HOURLY'],
        ownerUserId: ['user-1'],
        endDateFrom: '2026-01-01T00:00:00.000Z',
        endDateTo: '2026-12-31T00:00:00.000Z',
        complianceRiskLevel: ['HIGH', 'MEDIUM'],
      },
    });
    expect(r.success).toBe(true);
  });

  it('rejects pageSize below min', () => {
    const r = contractListSchema.safeParse({ pageSize: 5 });
    expect(r.success).toBe(false);
  });

  it('accepts contractorId filter', () => {
    const r = contractListSchema.safeParse({ contractorId: 'ctr-1' });
    expect(r.success).toBe(true);
  });

  it('accepts sortOrder asc and desc', () => {
    expect(contractListSchema.safeParse({ sortOrder: 'asc' }).success).toBe(true);
    expect(contractListSchema.safeParse({ sortOrder: 'desc' }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// contractExpiryReminderSchema
// ---------------------------------------------------------------------------

describe('contractExpiryReminderSchema', () => {
  it('accepts valid expiry reminder', () => {
    const r = contractExpiryReminderSchema.safeParse({
      contractId: 'c1',
      reminderDaysBefore: [30, 60],
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty contractId', () => {
    const r = contractExpiryReminderSchema.safeParse({
      contractId: '',
      reminderDaysBefore: [30],
    });
    expect(r.success).toBe(false);
  });
});
