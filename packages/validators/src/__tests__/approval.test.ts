import { describe, expect, it } from 'vitest';
import {
  approvalChainCreateSchema,
  approvalChainUpdateSchema,
  approvalQueueSchema,
  approveStepSchema,
  bulkApproveSchema,
  bulkRejectSchema,
  conditionSchema,
  rejectStepSchema,
  stepConfigSchema,
} from '../approval.js';

const validStep = {
  name: 'Manager',
  slaHours: 24,
};

describe('conditionSchema', () => {
  it('accepts numeric amount', () => {
    const r = conditionSchema.safeParse({
      field: 'amount',
      operator: 'gt',
      value: 1000,
    });
    expect(r.success).toBe(true);
  });

  it('rejects invalid field value not in enum', () => {
    const r = conditionSchema.safeParse({
      field: 'status',
      operator: 'eq',
      value: 'active',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find(i => i.path.includes('field'));
      expect(issue).toBeDefined();
    }
  });
});

describe('approvalChainCreateSchema', () => {
  it('requires 1–3 steps', () => {
    const r = approvalChainCreateSchema.safeParse({
      name: 'Default',
      stepsJson: [validStep],
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty steps', () => {
    const r = approvalChainCreateSchema.safeParse({
      name: 'Default',
      stepsJson: [],
    });
    expect(r.success).toBe(false);
  });

  it('accepts exactly 3 steps (upper boundary)', () => {
    const r = approvalChainCreateSchema.safeParse({
      name: 'Default',
      stepsJson: [validStep, validStep, validStep],
    });
    expect(r.success).toBe(true);
  });

  it('rejects more than 3 steps', () => {
    const r = approvalChainCreateSchema.safeParse({
      name: 'Default',
      stepsJson: [validStep, validStep, validStep, validStep],
    });
    expect(r.success).toBe(false);
  });
});

describe('approvalChainUpdateSchema', () => {
  it('extends with id', () => {
    const r = approvalChainUpdateSchema.safeParse({
      id: 'ch1',
      name: 'X',
      stepsJson: [validStep],
    });
    expect(r.success).toBe(true);
  });
});

describe('approvalQueueSchema', () => {
  it('defaults tab and filters', () => {
    const r = approvalQueueSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.tab).toBe('my');
      expect(r.data.pageSize).toBe(10);
      expect(r.data.sortBy).toBe('sla_deadline');
    }
  });
});

describe('rejectStepSchema', () => {
  it('requires comment length >= 10', () => {
    const bad = rejectStepSchema.safeParse({ stepId: 's1', comment: 'short' });
    expect(bad.success).toBe(false);
    const good = rejectStepSchema.safeParse({
      stepId: 's1',
      comment: 'ten chars!!',
    });
    expect(good.success).toBe(true);
  });
});

describe('bulkApproveSchema', () => {
  it('accepts 1–50 step ids', () => {
    const r = bulkApproveSchema.safeParse({ stepIds: ['a', 'b'] });
    expect(r.success).toBe(true);
  });
});

describe('bulkRejectSchema', () => {
  it('requires comment for bulk reject', () => {
    const r = bulkRejectSchema.safeParse({
      stepIds: ['s1'],
      comment: '1234567890',
    });
    expect(r.success).toBe(true);
  });
});

describe('stepConfigSchema', () => {
  it('defaults required true', () => {
    const r = stepConfigSchema.safeParse({
      name: 'A',
      slaHours: 48,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.required).toBe(true);
  });

  it('rejects slaHours of 0 (minimum is 1)', () => {
    const r = stepConfigSchema.safeParse({
      name: 'A',
      slaHours: 0,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find(i => i.path.includes('slaHours'));
      expect(issue).toBeDefined();
    }
  });

  it('accepts slaHours at lower boundary (1)', () => {
    const r = stepConfigSchema.safeParse({
      name: 'A',
      slaHours: 1,
    });
    expect(r.success).toBe(true);
  });

  it('accepts slaHours at upper boundary (720)', () => {
    const r = stepConfigSchema.safeParse({
      name: 'A',
      slaHours: 720,
    });
    expect(r.success).toBe(true);
  });

  it('rejects slaHours above upper boundary (721)', () => {
    const r = stepConfigSchema.safeParse({
      name: 'A',
      slaHours: 721,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find(i => i.path.includes('slaHours'));
      expect(issue).toBeDefined();
    }
  });
});

describe('approveStepSchema', () => {
  it('accepts optional comment', () => {
    const r = approveStepSchema.safeParse({ stepId: 's1' });
    expect(r.success).toBe(true);
  });
});
