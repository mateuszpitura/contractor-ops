import { describe, expect, it } from 'vitest';
import {
  reminderRuleCreateSchema,
  reminderRuleToggleSchema,
  reminderRuleUpdateSchema,
} from '../reminder.js';

describe('reminderRuleCreateSchema', () => {
  it('accepts valid rule', () => {
    const r = reminderRuleCreateSchema.safeParse({
      name: 'Due soon',
      entityType: 'INVOICE',
      triggerType: 'BEFORE_DUE_DATE',
      offsetDays: 3,
      channel: 'EMAIL',
      recipientMode: 'ENTITY_OWNER',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.active).toBe(true);
  });

  it('rejects name longer than 100', () => {
    const r = reminderRuleCreateSchema.safeParse({
      name: 'x'.repeat(101),
      entityType: 'INVOICE',
      triggerType: 'ON_DUE_DATE',
      channel: 'IN_APP',
      recipientMode: 'ASSIGNEE',
    });
    expect(r.success).toBe(false);
  });
});

describe('reminderRuleUpdateSchema', () => {
  it('allows partial update', () => {
    const r = reminderRuleUpdateSchema.safeParse({ name: 'Renamed' });
    expect(r.success).toBe(true);
  });
});

describe('reminderRuleToggleSchema', () => {
  it('toggles by id', () => {
    const r = reminderRuleToggleSchema.safeParse({
      id: 'r1',
      active: false,
    });
    expect(r.success).toBe(true);
  });
});
