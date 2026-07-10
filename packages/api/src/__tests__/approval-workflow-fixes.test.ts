import { describe, expect, it } from 'vitest';
import { approveInvokeSchema } from '../services/teams/teams-bot-handler';

describe('teams approval invoke schemas', () => {
  it('accepts cuid ids (not uuid)', () => {
    const parsed = approveInvokeSchema.safeParse({
      action: 'approve_invoice',
      invoiceId: 'clinvaaaaaaaaaaaaaaaaaaaaa',
      flowId: 'clflowaaaaaaaaaaaaaaaaaaaa',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects empty ids', () => {
    const parsed = approveInvokeSchema.safeParse({
      action: 'approve_invoice',
      invoiceId: '',
      flowId: 'clflowaaaaaaaaaaaaaaaaaaaa',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('workflow task transitions', () => {
  it('allows TODO to complete via implicit IN_PROGRESS', async () => {
    const { validateTransition } = await import('../routers/workflow/workflow-shared');
    expect(validateTransition('TODO', 'IN_PROGRESS')).toBe(true);
    expect(validateTransition('IN_PROGRESS', 'DONE')).toBe(true);
    expect(validateTransition('TODO', 'DONE')).toBe(false);
  });
});
