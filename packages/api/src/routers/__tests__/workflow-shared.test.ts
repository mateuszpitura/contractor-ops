/**
 * Workflow shared helpers unit tests.
 *
 * Tests pure utility functions from workflow-shared.ts:
 * plain(), addDays(), addHours(), evaluateCondition(), resolveAssignee(),
 * calculateProgress(), validateTransition(), and TASK_TRANSITIONS.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  addDays,
  addHours,
  calculateProgress,
  evaluateCondition,
  plain,
  resolveAssignee,
  TASK_TRANSITIONS,
  validateTransition,
  WORKFLOW_TEMPLATE_KEYS,
} from '../workflow-shared.js';

// ===========================================================================
// plain()
// ===========================================================================

describe('plain()', () => {
  it('returns a JSON-serializable copy of the input', () => {
    const input = { id: '1', name: 'Template', nested: { a: 1 } };
    const result = plain(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it('strips functions and undefined values', () => {
    const input = {
      id: '1',
      fn: () => {
        /* noop */
      },
      undef: undefined,
    };
    const result = plain(input);
    expect(result).toEqual({ id: '1' });
  });
});

// ===========================================================================
// addDays()
// ===========================================================================

describe('addDays()', () => {
  it('adds the specified number of days', () => {
    const base = new Date('2026-01-01T00:00:00Z');
    const result = addDays(base, 5);
    expect(result.toISOString()).toBe('2026-01-06T00:00:00.000Z');
  });

  it('does not mutate the original date', () => {
    const base = new Date('2026-01-01T00:00:00Z');
    addDays(base, 10);
    expect(base.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('handles negative days', () => {
    const base = new Date('2026-01-10T00:00:00Z');
    const result = addDays(base, -3);
    expect(result.toISOString()).toBe('2026-01-07T00:00:00.000Z');
  });
});

// ===========================================================================
// addHours()
// ===========================================================================

describe('addHours()', () => {
  it('adds the specified number of hours', () => {
    const base = new Date('2026-01-01T00:00:00Z');
    const result = addHours(base, 3);
    expect(result.toISOString()).toBe('2026-01-01T03:00:00.000Z');
  });

  it('does not mutate the original date', () => {
    const base = new Date('2026-01-01T00:00:00Z');
    addHours(base, 5);
    expect(base.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('handles fractional hours', () => {
    const base = new Date('2026-01-01T00:00:00Z');
    const result = addHours(base, 1.5);
    expect(result.toISOString()).toBe('2026-01-01T01:30:00.000Z');
  });
});

// ===========================================================================
// evaluateCondition()
// ===========================================================================

describe('evaluateCondition()', () => {
  it('returns true when condition is null', () => {
    expect(evaluateCondition(null, { contractor: { type: 'B2B' } })).toBe(true);
  });

  it('returns true when rules array is empty', () => {
    expect(
      evaluateCondition({ combinator: 'AND', rules: [] }, { contractor: { type: 'B2B' } }),
    ).toBe(true);
  });

  it('AND combinator requires all rules to match', () => {
    const condition = {
      combinator: 'AND' as const,
      rules: [
        { field: 'contractor.type', operator: 'equals' as const, value: 'B2B' },
        { field: 'contractor.country', operator: 'equals' as const, value: 'PL' },
      ],
    };

    expect(evaluateCondition(condition, { contractor: { type: 'B2B', country: 'PL' } })).toBe(true);
    expect(evaluateCondition(condition, { contractor: { type: 'B2B', country: 'DE' } })).toBe(
      false,
    );
  });

  it('OR combinator requires at least one rule to match', () => {
    const condition = {
      combinator: 'OR' as const,
      rules: [
        { field: 'contractor.type', operator: 'equals' as const, value: 'B2B' },
        { field: 'contractor.type', operator: 'equals' as const, value: 'EMPLOYMENT' },
      ],
    };

    expect(evaluateCondition(condition, { contractor: { type: 'EMPLOYMENT' } })).toBe(true);
    expect(evaluateCondition(condition, { contractor: { type: 'FREELANCE' } })).toBe(false);
  });

  it('supports notEquals operator', () => {
    const condition = {
      combinator: 'AND' as const,
      rules: [{ field: 'contractor.type', operator: 'notEquals' as const, value: 'B2B' }],
    };

    expect(evaluateCondition(condition, { contractor: { type: 'EMPLOYMENT' } })).toBe(true);
    expect(evaluateCondition(condition, { contractor: { type: 'B2B' } })).toBe(false);
  });

  it('supports contains operator', () => {
    const condition = {
      combinator: 'AND' as const,
      rules: [{ field: 'contractor.name', operator: 'contains' as const, value: 'Corp' }],
    };

    expect(evaluateCondition(condition, { contractor: { name: 'Acme Corp Ltd' } })).toBe(true);
    expect(evaluateCondition(condition, { contractor: { name: 'Acme LLC' } })).toBe(false);
  });

  it('supports startsWith operator', () => {
    const condition = {
      combinator: 'AND' as const,
      rules: [{ field: 'contractor.name', operator: 'startsWith' as const, value: 'Acme' }],
    };

    expect(evaluateCondition(condition, { contractor: { name: 'Acme Corp' } })).toBe(true);
    expect(evaluateCondition(condition, { contractor: { name: 'Best Acme' } })).toBe(false);
  });

  it('accesses nested contract fields via dot notation', () => {
    const condition = {
      combinator: 'AND' as const,
      rules: [{ field: 'contract.billingModel', operator: 'equals' as const, value: 'FIXED' }],
    };

    expect(
      evaluateCondition(condition, {
        contractor: { type: 'B2B' },
        contract: { billingModel: 'FIXED' },
      }),
    ).toBe(true);
  });

  it('returns false for unknown operator', () => {
    const condition = {
      combinator: 'AND' as const,
      rules: [
        // @ts-expect-error intentional unknown operator
        { field: 'contractor.type', operator: 'unknownOp', value: 'B2B' },
      ],
    };

    expect(evaluateCondition(condition, { contractor: { type: 'B2B' } })).toBe(false);
  });
});

// ===========================================================================
// resolveAssignee()
// ===========================================================================

describe('resolveAssignee()', () => {
  const mockTx = {
    member: {
      findFirst: vi.fn(),
    },
  };

  it('returns userId for FIXED_USER mode', async () => {
    const result = await resolveAssignee(
      { assigneeMode: 'FIXED_USER', assigneeUserId: 'user-1' },
      {},
      null,
      'org-1',
      mockTx,
    );
    expect(result).toBe('user-1');
  });

  it('returns null for FIXED_USER without userId', async () => {
    const result = await resolveAssignee(
      { assigneeMode: 'FIXED_USER', assigneeUserId: null },
      {},
      null,
      'org-1',
      mockTx,
    );
    expect(result).toBeNull();
  });

  it('queries member by role for ROLE_BASED mode', async () => {
    mockTx.member.findFirst.mockResolvedValueOnce({ userId: 'member-1' });

    const result = await resolveAssignee(
      { assigneeMode: 'ROLE_BASED', assigneeRole: 'ops_manager' },
      {},
      null,
      'org-1',
      mockTx,
    );

    expect(result).toBe('member-1');
    expect(mockTx.member.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          role: 'ops_manager',
        }),
      }),
    );
  });

  it('returns null when ROLE_BASED finds no matching member', async () => {
    mockTx.member.findFirst.mockResolvedValueOnce(null);

    const result = await resolveAssignee(
      { assigneeMode: 'ROLE_BASED', assigneeRole: 'MISSING_ROLE' },
      {},
      null,
      'org-1',
      mockTx,
    );
    expect(result).toBeNull();
  });

  it('returns contractor owner for CONTRACTOR_OWNER mode', async () => {
    const result = await resolveAssignee(
      { assigneeMode: 'CONTRACTOR_OWNER' },
      { internalOwnerUserId: 'owner-1' },
      null,
      'org-1',
      mockTx,
    );
    expect(result).toBe('owner-1');
  });

  it('returns contract owner for CONTRACT_OWNER mode', async () => {
    const result = await resolveAssignee(
      { assigneeMode: 'CONTRACT_OWNER' },
      {},
      { internalOwnerUserId: 'contract-owner-1' },
      'org-1',
      mockTx,
    );
    expect(result).toBe('contract-owner-1');
  });

  it('returns null for PROJECT_MANAGER mode', async () => {
    const result = await resolveAssignee(
      { assigneeMode: 'PROJECT_MANAGER' },
      {},
      null,
      'org-1',
      mockTx,
    );
    expect(result).toBeNull();
  });

  it('returns null for unknown mode', async () => {
    const result = await resolveAssignee({ assigneeMode: 'UNKNOWN' }, {}, null, 'org-1', mockTx);
    expect(result).toBeNull();
  });
});

// ===========================================================================
// calculateProgress()
// ===========================================================================

describe('calculateProgress()', () => {
  it('returns 100% when all tasks are DONE', () => {
    const result = calculateProgress([
      { status: 'DONE', resultJson: null },
      { status: 'DONE', resultJson: null },
    ]);
    expect(result).toEqual({ done: 2, total: 2, percent: 100 });
  });

  it('returns 0% when no tasks are done', () => {
    const result = calculateProgress([
      { status: 'TODO', resultJson: null },
      { status: 'IN_PROGRESS', resultJson: null },
    ]);
    expect(result).toEqual({ done: 0, total: 2, percent: 0 });
  });

  it('includes manually skipped tasks as done', () => {
    const result = calculateProgress([
      { status: 'DONE', resultJson: null },
      { status: 'SKIPPED', resultJson: { skipReason: 'Not needed' } },
    ]);
    expect(result).toEqual({ done: 2, total: 2, percent: 100 });
  });

  it('excludes condition-skipped tasks from numerator and denominator', () => {
    const result = calculateProgress([
      { status: 'DONE', resultJson: null },
      { status: 'SKIPPED', resultJson: { skipReason: 'conditionNotMet' } },
      { status: 'TODO', resultJson: null },
    ]);
    // conditionNotMet task excluded: 1 done / 2 total = 50%
    expect(result).toEqual({ done: 1, total: 2, percent: 50 });
  });

  it('returns 0% for empty task array', () => {
    const result = calculateProgress([]);
    expect(result).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

// ===========================================================================
// validateTransition()
// ===========================================================================

describe('validateTransition()', () => {
  it('allows TODO -> IN_PROGRESS', () => {
    expect(validateTransition('TODO', 'IN_PROGRESS')).toBe(true);
  });

  it('allows TODO -> SKIPPED', () => {
    expect(validateTransition('TODO', 'SKIPPED')).toBe(true);
  });

  it('allows IN_PROGRESS -> DONE', () => {
    expect(validateTransition('IN_PROGRESS', 'DONE')).toBe(true);
  });

  it('disallows DONE -> TODO', () => {
    expect(validateTransition('DONE', 'TODO')).toBe(false);
  });

  it('disallows SKIPPED -> any', () => {
    expect(validateTransition('SKIPPED', 'TODO')).toBe(false);
    expect(validateTransition('SKIPPED', 'DONE')).toBe(false);
  });

  it('disallows CANCELLED -> any', () => {
    expect(validateTransition('CANCELLED', 'TODO')).toBe(false);
  });

  it('allows BLOCKED -> TODO (unblocking)', () => {
    expect(validateTransition('BLOCKED', 'TODO')).toBe(true);
  });

  it('returns false for unknown status', () => {
    expect(validateTransition('UNKNOWN', 'TODO')).toBe(false);
  });
});

// ===========================================================================
// TASK_TRANSITIONS
// ===========================================================================

describe('TASK_TRANSITIONS', () => {
  it('has no transitions from terminal states DONE, SKIPPED, CANCELLED', () => {
    expect(TASK_TRANSITIONS.DONE).toEqual([]);
    expect(TASK_TRANSITIONS.SKIPPED).toEqual([]);
    expect(TASK_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it('OVERDUE allows DONE, SKIPPED, CANCELLED', () => {
    expect(TASK_TRANSITIONS.OVERDUE).toEqual(
      expect.arrayContaining(['DONE', 'SKIPPED', 'CANCELLED']),
    );
  });
});

// ===========================================================================
// WORKFLOW_TEMPLATE_KEYS
// ===========================================================================

describe('WORKFLOW_TEMPLATE_KEYS', () => {
  it('exposes onboarding template keys', () => {
    expect(WORKFLOW_TEMPLATE_KEYS.onboarding.collectNda).toBe(
      'workflow.templates.onboarding.collectNda',
    );
    expect(WORKFLOW_TEMPLATE_KEYS.onboarding.signContract).toBe(
      'workflow.templates.onboarding.signContract',
    );
  });

  it('exposes offboarding template keys', () => {
    expect(WORKFLOW_TEMPLATE_KEYS.offboarding.knowledgeTransfer).toBe(
      'workflow.templates.offboarding.knowledgeTransfer',
    );
    expect(WORKFLOW_TEMPLATE_KEYS.offboarding.revokeItAccess).toBe(
      'workflow.templates.offboarding.revokeItAccess',
    );
  });
});
