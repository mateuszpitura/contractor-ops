import { describe, expect, it } from 'vitest';
import {
  cancelRunSchema,
  conditionGroupSchema,
  conditionRuleSchema,
  myTasksListSchema,
  skipTaskSchema,
  startRunSchema,
  taskTemplateInputSchema,
  templateCreateSchema,
  templateUpdateSchema,
} from '../workflow.js';

const baseTask = {
  title: 'Collect ID',
  taskType: 'DOCUMENT_COLLECTION' as const,
  sortOrder: 0,
  required: true,
  assigneeMode: 'CONTRACTOR_OWNER' as const,
};

describe('conditionRuleSchema', () => {
  it('accepts equals rule', () => {
    const r = conditionRuleSchema.safeParse({
      field: 'country',
      operator: 'equals',
      value: 'PL',
    });
    expect(r.success).toBe(true);
  });

  it('accepts snake_case operators', () => {
    expect(
      conditionRuleSchema.safeParse({
        field: 'x',
        operator: 'not_equals',
        value: 'a',
      }).success,
    ).toBe(true);
    expect(
      conditionRuleSchema.safeParse({
        field: 'x',
        operator: 'starts_with',
        value: 'a',
      }).success,
    ).toBe(true);
  });

  it('rejects empty field', () => {
    const r = conditionRuleSchema.safeParse({
      field: '',
      operator: 'equals',
      value: 'x',
    });
    expect(r.success).toBe(false);
  });
});

describe('conditionGroupSchema', () => {
  it('requires at least one rule', () => {
    const r = conditionGroupSchema.safeParse({
      combinator: 'AND',
      rules: [],
    });
    expect(r.success).toBe(false);
  });
});

describe('taskTemplateInputSchema', () => {
  it('accepts task with optional URL', () => {
    const r = taskTemplateInputSchema.safeParse({
      ...baseTask,
      externalUrl: 'https://example.com/form',
    });
    expect(r.success).toBe(true);
  });

  it('accepts empty string externalUrl', () => {
    const r = taskTemplateInputSchema.safeParse({
      ...baseTask,
      externalUrl: '',
    });
    expect(r.success).toBe(true);
  });
});

describe('templateCreateSchema', () => {
  it('accepts template with tasks', () => {
    const r = templateCreateSchema.safeParse({
      name: 'Onboarding',
      type: 'ONBOARDING',
      tasks: [baseTask],
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty tasks array (template must have at least one task)', () => {
    const r = templateCreateSchema.safeParse({
      name: 'X',
      type: 'CUSTOM',
      tasks: [],
    });
    expect(r.success).toBe(false);
  });
});

describe('templateUpdateSchema', () => {
  it('requires id', () => {
    const r = templateUpdateSchema.safeParse({ name: 'Y' });
    expect(r.success).toBe(false);
  });

  it('accepts id + partial fields', () => {
    const r = templateUpdateSchema.safeParse({
      id: 'tmpl_1',
      status: 'ARCHIVED',
    });
    expect(r.success).toBe(true);
  });
});

describe('startRunSchema', () => {
  it('accepts template + contractor', () => {
    const r = startRunSchema.safeParse({
      templateId: 't1',
      contractorId: 'c1',
    });
    expect(r.success).toBe(true);
  });
});

describe('skipTaskSchema', () => {
  it('requires reason length >= 3', () => {
    expect(skipTaskSchema.safeParse({ taskRunId: 'x', reason: 'ab' }).success).toBe(false);
    expect(skipTaskSchema.safeParse({ taskRunId: 'x', reason: 'n/a' }).success).toBe(true);
  });
});

describe('cancelRunSchema', () => {
  it('accepts optional reason when long enough', () => {
    const r = cancelRunSchema.safeParse({
      runId: 'r1',
      reason: 'dup',
    });
    expect(r.success).toBe(true);
  });

  it('accepts when reason is omitted entirely', () => {
    const r = cancelRunSchema.safeParse({
      runId: 'r1',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.reason).toBeUndefined();
    }
  });
});

describe('myTasksListSchema', () => {
  it('applies pagination defaults', () => {
    const r = myTasksListSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.pageSize).toBe(25);
    }
  });
});
