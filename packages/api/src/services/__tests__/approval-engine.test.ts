import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  advanceFlow,
  computeSlaStatus,
  createApprovalFlow,
  evaluateConditions,
  routeToChain,
} from '../approval-engine.js';

// ---------------------------------------------------------------------------
// Mock transaction client
// ---------------------------------------------------------------------------

function createMockTx() {
  return {
    approvalChainConfig: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    approvalFlow: {
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    approvalStep: {
      update: vi.fn(),
    },
    member: {
      findFirst: vi.fn(),
    },
  };
}

type MockTx = ReturnType<typeof createMockTx>;

// ---------------------------------------------------------------------------
// evaluateConditions
// ---------------------------------------------------------------------------

describe('evaluateConditions', () => {
  const invoice = { totalMinor: 150_00, contractorType: 'B2B' };

  it('returns false for null conditionsJson', () => {
    expect(evaluateConditions(null, invoice)).toBe(false);
  });

  it('returns false for undefined conditionsJson', () => {
    expect(evaluateConditions(undefined, invoice)).toBe(false);
  });

  it('returns false for non-array conditionsJson', () => {
    expect(evaluateConditions('not-array', invoice)).toBe(false);
    expect(evaluateConditions({}, invoice)).toBe(false);
    expect(evaluateConditions(42, invoice)).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(evaluateConditions([], invoice)).toBe(false);
  });

  describe('amount field', () => {
    it('gt operator — condition value is in PLN, compared as minor units', () => {
      // 100 PLN = 10000 minor; invoice is 15000 minor → true
      expect(evaluateConditions([{ field: 'amount', operator: 'gt', value: 100 }], invoice)).toBe(
        true,
      );

      // 150 PLN = 15000 minor; invoice is 15000 minor → not gt → false
      expect(evaluateConditions([{ field: 'amount', operator: 'gt', value: 150 }], invoice)).toBe(
        false,
      );

      // 200 PLN = 20000 minor; invoice is 15000 minor → false
      expect(evaluateConditions([{ field: 'amount', operator: 'gt', value: 200 }], invoice)).toBe(
        false,
      );
    });

    it('lt operator — condition value is in PLN, compared as minor units', () => {
      expect(evaluateConditions([{ field: 'amount', operator: 'lt', value: 200 }], invoice)).toBe(
        true,
      );

      expect(evaluateConditions([{ field: 'amount', operator: 'lt', value: 150 }], invoice)).toBe(
        false,
      );
    });

    it('eq operator — condition value is in PLN, compared as minor units', () => {
      expect(evaluateConditions([{ field: 'amount', operator: 'eq', value: 150 }], invoice)).toBe(
        true,
      );

      expect(evaluateConditions([{ field: 'amount', operator: 'eq', value: 100 }], invoice)).toBe(
        false,
      );
    });

    it('handles string value for amount (coerces to number)', () => {
      expect(evaluateConditions([{ field: 'amount', operator: 'gt', value: '100' }], invoice)).toBe(
        true,
      );
    });

    it('returns false for unknown amount operator', () => {
      expect(evaluateConditions([{ field: 'amount', operator: 'gte', value: 100 }], invoice)).toBe(
        false,
      );
    });
  });

  describe('contractor_type field', () => {
    it('eq operator matches contractor type', () => {
      expect(
        evaluateConditions([{ field: 'contractor_type', operator: 'eq', value: 'B2B' }], invoice),
      ).toBe(true);
    });

    it('eq operator does not match different type', () => {
      expect(
        evaluateConditions([{ field: 'contractor_type', operator: 'eq', value: 'UoP' }], invoice),
      ).toBe(false);
    });

    it('returns false for unknown contractor_type operator', () => {
      expect(
        evaluateConditions(
          [{ field: 'contractor_type', operator: 'contains', value: 'B2B' }],
          invoice,
        ),
      ).toBe(false);
    });
  });

  describe('AND logic', () => {
    it('returns true when all conditions match', () => {
      expect(
        evaluateConditions(
          [
            { field: 'amount', operator: 'gt', value: 100 },
            { field: 'contractor_type', operator: 'eq', value: 'B2B' },
          ],
          invoice,
        ),
      ).toBe(true);
    });

    it('returns false when one condition fails', () => {
      expect(
        evaluateConditions(
          [
            { field: 'amount', operator: 'gt', value: 100 },
            { field: 'contractor_type', operator: 'eq', value: 'UoP' },
          ],
          invoice,
        ),
      ).toBe(false);
    });

    it('returns false when all conditions fail', () => {
      expect(
        evaluateConditions(
          [
            { field: 'amount', operator: 'gt', value: 200 },
            { field: 'contractor_type', operator: 'eq', value: 'UoP' },
          ],
          invoice,
        ),
      ).toBe(false);
    });
  });

  it('returns false for unknown field', () => {
    expect(evaluateConditions([{ field: 'currency', operator: 'eq', value: 'PLN' }], invoice)).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// routeToChain
// ---------------------------------------------------------------------------

describe('routeToChain', () => {
  let mockTx: MockTx;
  const orgId = 'org-1';

  // Chain 1: amount > 500 PLN (high-value invoices)
  const highValueChain = {
    id: 'chain-high',
    conditionsJson: [{ field: 'amount', operator: 'gt', value: 500 }],
    isDefault: false,
  };
  // Chain 2: amount > 100 PLN (medium-value invoices)
  const mediumValueChain = {
    id: 'chain-medium',
    conditionsJson: [{ field: 'amount', operator: 'gt', value: 100 }],
    isDefault: false,
  };
  // Chain 3: default (catch-all)
  const defaultChain = {
    id: 'chain-default',
    conditionsJson: null,
    isDefault: true,
  };

  beforeEach(() => {
    mockTx = createMockTx();
  });

  it('selects the first chain whose conditions match (first-match strategy)', async () => {
    // Invoice: 300 PLN (30000 minor) — matches chain 2 (>100) but not chain 1 (>500)
    const invoice = { totalMinor: 300_00 };

    mockTx.approvalChainConfig.findMany.mockResolvedValue([
      highValueChain,
      mediumValueChain,
      defaultChain,
    ]);

    const result = await routeToChain(mockTx as any, orgId, invoice);

    expect(result?.id).toBe('chain-medium');
  });

  it('returns chain 1 when invoice matches both chain 1 and chain 2 (earlier wins)', async () => {
    // Invoice: 600 PLN (60000 minor) — matches both >500 and >100
    // Chain 1 appears first in array (ordered by createdAt asc), so it wins
    const invoice = { totalMinor: 600_00 };

    mockTx.approvalChainConfig.findMany.mockResolvedValue([
      highValueChain,
      mediumValueChain,
      defaultChain,
    ]);

    const result = await routeToChain(mockTx as any, orgId, invoice);

    expect(result?.id).toBe('chain-high');
  });

  it('falls back to default chain when no conditions match', async () => {
    // Invoice: 50 PLN (5000 minor) — doesn't match >500 or >100
    const invoice = { totalMinor: 50_00 };

    mockTx.approvalChainConfig.findMany.mockResolvedValue([
      highValueChain,
      mediumValueChain,
      defaultChain,
    ]);

    const result = await routeToChain(mockTx as any, orgId, invoice);

    expect(result?.id).toBe('chain-default');
  });

  it('returns null when no chains exist at all', async () => {
    mockTx.approvalChainConfig.findMany.mockResolvedValue([]);

    const result = await routeToChain(mockTx as any, orgId, { totalMinor: 100_00 });

    expect(result).toBeNull();
  });

  it('returns null when no conditions match and no default chain exists', async () => {
    const invoice = { totalMinor: 50_00 };

    mockTx.approvalChainConfig.findMany.mockResolvedValue([
      highValueChain,
      mediumValueChain,
      // no default chain
    ]);

    const result = await routeToChain(mockTx as any, orgId, invoice);

    expect(result).toBeNull();
  });

  it('evaluates multi-field conditions (amount AND contractor_type)', async () => {
    const b2bOnlyChain = {
      id: 'chain-b2b',
      conditionsJson: [
        { field: 'amount', operator: 'gt', value: 100 },
        { field: 'contractor_type', operator: 'eq', value: 'B2B' },
      ],
      isDefault: false,
    };

    mockTx.approvalChainConfig.findMany.mockResolvedValue([b2bOnlyChain, defaultChain]);

    // UoP contractor with 200 PLN — amount matches but type doesn't → falls to default
    const uopInvoice = { totalMinor: 200_00, contractorType: 'UoP' };
    const result1 = await routeToChain(mockTx as any, orgId, uopInvoice);
    expect(result1?.id).toBe('chain-default');

    // B2B contractor with 200 PLN — both conditions match → gets b2b chain
    const b2bInvoice = { totalMinor: 200_00, contractorType: 'B2B' };
    const result2 = await routeToChain(mockTx as any, orgId, b2bInvoice);
    expect(result2?.id).toBe('chain-b2b');
  });
});

// ---------------------------------------------------------------------------
// createApprovalFlow
// ---------------------------------------------------------------------------

describe('createApprovalFlow', () => {
  let mockTx: MockTx;

  /** Helper to capture the data passed to tx.approvalFlow.create */
  function captureCreateData(tx: MockTx) {
    return tx.approvalFlow.create.mock.calls[0][0].data;
  }

  beforeEach(() => {
    mockTx = createMockTx();
    // Return the nested create payload so we can inspect it
    mockTx.approvalFlow.create.mockImplementation(async (args: any) => ({
      id: 'flow-1',
      ...args.data,
      steps: args.data.steps.create,
    }));
  });

  it('step count matches stepsJson length for a 3-step chain', async () => {
    const params = {
      organizationId: 'org-1',
      resourceType: 'INVOICE' as const,
      resourceId: 'inv-1',
      chainConfig: {
        id: 'chain-1',
        stepsJson: [
          { name: 'Team Lead', approverUserId: 'user-a', slaHours: 8, required: true },
          { name: 'Finance', approverUserId: 'user-b', slaHours: 24, required: true },
          { name: 'Director', approverUserId: 'user-c', slaHours: 48, required: false },
        ],
      },
      createdByUserId: 'creator',
    };

    await createApprovalFlow(mockTx as any, params);

    const steps = captureCreateData(mockTx).steps.create;
    expect(steps).toHaveLength(3);
  });

  it('first step is PENDING with slaDeadline, remaining steps are NOT_STARTED with null deadline', async () => {
    const params = {
      organizationId: 'org-1',
      resourceType: 'INVOICE' as const,
      resourceId: 'inv-1',
      chainConfig: {
        id: 'chain-1',
        stepsJson: [
          { name: 'Team Lead', approverUserId: 'user-a', slaHours: 8, required: true },
          { name: 'Finance', approverUserId: 'user-b', slaHours: 24, required: true },
          { name: 'Director', approverUserId: 'user-c', slaHours: 48, required: false },
        ],
      },
      createdByUserId: 'creator',
    };

    await createApprovalFlow(mockTx as any, params);

    const steps = captureCreateData(mockTx).steps.create;

    // Step 1: PENDING, has deadline
    expect(steps[0].status).toBe('PENDING');
    expect(steps[0].slaDeadline).toBeInstanceOf(Date);

    // Steps 2 and 3: NOT_STARTED, no deadline
    expect(steps[1].status).toBe('NOT_STARTED');
    expect(steps[1].slaDeadline).toBeNull();
    expect(steps[2].status).toBe('NOT_STARTED');
    expect(steps[2].slaDeadline).toBeNull();
  });

  it('steps are numbered sequentially 1, 2, 3 in order', async () => {
    const params = {
      organizationId: 'org-1',
      resourceType: 'INVOICE' as const,
      resourceId: 'inv-1',
      chainConfig: {
        id: 'chain-1',
        stepsJson: [
          { name: 'Team Lead', approverUserId: 'user-a', slaHours: 8, required: true },
          { name: 'Finance', approverUserId: 'user-b', slaHours: 24, required: true },
          { name: 'Director', approverUserId: 'user-c', slaHours: 48, required: false },
        ],
      },
      createdByUserId: 'creator',
    };

    await createApprovalFlow(mockTx as any, params);

    const steps = captureCreateData(mockTx).steps.create;

    expect(steps.map((s: any) => s.stepOrder)).toEqual([1, 2, 3]);
    expect(steps.map((s: any) => s.name)).toEqual(['Team Lead', 'Finance', 'Director']);
  });

  it('first step slaDeadline reflects slaHours from config', async () => {
    const params = {
      organizationId: 'org-1',
      resourceType: 'INVOICE' as const,
      resourceId: 'inv-1',
      chainConfig: {
        id: 'chain-1',
        stepsJson: [
          { name: 'Quick Review', approverUserId: 'user-a', slaHours: 4, required: true },
        ],
      },
      createdByUserId: 'creator',
    };

    const beforeCall = Date.now();
    await createApprovalFlow(mockTx as any, params);

    const steps = captureCreateData(mockTx).steps.create;
    const deadline = steps[0].slaDeadline as Date;

    // Deadline should be ~4 hours from now
    const diffHours = (deadline.getTime() - beforeCall) / (60 * 60 * 1000);
    expect(diffHours).toBeGreaterThan(3.99);
    expect(diffHours).toBeLessThan(4.1);
  });

  it('resolves role-based approver: approverRole without approverUserId triggers member lookup', async () => {
    const params = {
      organizationId: 'org-1',
      resourceType: 'INVOICE' as const,
      resourceId: 'inv-1',
      chainConfig: {
        id: 'chain-1',
        stepsJson: [
          { name: 'Finance Review', approverRole: 'FINANCE_ADMIN', slaHours: 24, required: true },
        ],
      },
      createdByUserId: 'creator',
    };

    mockTx.member.findFirst.mockResolvedValue({ userId: 'resolved-finance-user' });

    await createApprovalFlow(mockTx as any, params);

    // Verify the resolved userId ends up in the step data
    const steps = captureCreateData(mockTx).steps.create;
    expect(steps[0].approverUserId).toBe('resolved-finance-user');
    expect(steps[0].approverRole).toBe('FINANCE_ADMIN');
  });

  it('throws PRECONDITION_FAILED when member.findFirst returns null for a role', async () => {
    const params = {
      organizationId: 'org-1',
      resourceType: 'INVOICE' as const,
      resourceId: 'inv-1',
      chainConfig: {
        id: 'chain-1',
        stepsJson: [
          { name: 'Legal Review', approverRole: 'LEGAL_VIEWER', slaHours: 24, required: true },
        ],
      },
      createdByUserId: 'creator',
    };

    mockTx.member.findFirst.mockResolvedValue(null);

    await expect(createApprovalFlow(mockTx as any, params)).rejects.toThrow(
      'No user with role LEGAL_VIEWER found',
    );
  });

  it('skips member lookup when approverUserId is already provided', async () => {
    const params = {
      organizationId: 'org-1',
      resourceType: 'INVOICE' as const,
      resourceId: 'inv-1',
      chainConfig: {
        id: 'chain-1',
        stepsJson: [
          {
            name: 'Manager Review',
            approverUserId: 'user-1',
            approverRole: 'OPS_MANAGER',
            slaHours: 24,
            required: true,
          },
        ],
      },
      createdByUserId: 'creator',
    };

    await createApprovalFlow(mockTx as any, params);

    // approverUserId is set, so member lookup should not happen even though approverRole is present
    expect(mockTx.member.findFirst).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// advanceFlow
// ---------------------------------------------------------------------------

describe('advanceFlow', () => {
  let mockTx: MockTx;

  beforeEach(() => {
    mockTx = createMockTx();
    mockTx.approvalFlow.update.mockResolvedValue({});
    mockTx.approvalStep.update.mockResolvedValue({});
  });

  it('when current step is last, flow is marked APPROVED with completedAt', async () => {
    mockTx.approvalFlow.findUniqueOrThrow.mockResolvedValue({
      id: 'flow-1',
      currentStepOrder: 2,
      chainConfigId: 'chain-1',
      steps: [
        { id: 'step-1', stepOrder: 1, status: 'APPROVED' },
        { id: 'step-2', stepOrder: 2, status: 'APPROVED' },
      ],
    });

    mockTx.approvalChainConfig.findUnique.mockResolvedValue({
      stepsJson: [
        { name: 'Step 1', slaHours: 24 },
        { name: 'Step 2', slaHours: 48 },
      ],
    });

    const result = await advanceFlow(mockTx as any, 'flow-1');

    expect(result).toEqual({ completed: true, flowStatus: 'APPROVED' });

    // Flow update should set status and completedAt
    const flowUpdateData = mockTx.approvalFlow.update.mock.calls[0][0].data;
    expect(flowUpdateData.status).toBe('APPROVED');
    expect(flowUpdateData.completedAt).toBeInstanceOf(Date);

    // No step should be activated
    expect(mockTx.approvalStep.update).not.toHaveBeenCalled();
  });

  it('when next step exists, it is activated with PENDING status and slaDeadline from chain config', async () => {
    mockTx.approvalFlow.findUniqueOrThrow.mockResolvedValue({
      id: 'flow-1',
      currentStepOrder: 1,
      chainConfigId: 'chain-1',
      steps: [
        { id: 'step-1', stepOrder: 1, status: 'APPROVED' },
        { id: 'step-2', stepOrder: 2, status: 'NOT_STARTED' },
        { id: 'step-3', stepOrder: 3, status: 'NOT_STARTED' },
      ],
    });

    mockTx.approvalChainConfig.findUnique.mockResolvedValue({
      stepsJson: [
        { name: 'Step 1', slaHours: 8 },
        { name: 'Step 2', slaHours: 72 },
        { name: 'Step 3', slaHours: 24 },
      ],
    });

    const beforeCall = Date.now();
    const result = await advanceFlow(mockTx as any, 'flow-1');

    // Return value indicates not completed, next step is 2
    expect(result).toEqual({ completed: false, nextStepOrder: 2 });

    // Step 2 activated with PENDING and deadline based on its 72h SLA
    const stepUpdateData = mockTx.approvalStep.update.mock.calls[0][0].data;
    expect(stepUpdateData.status).toBe('PENDING');

    const deadline = stepUpdateData.slaDeadline as Date;
    const diffHours = (deadline.getTime() - beforeCall) / (60 * 60 * 1000);
    expect(diffHours).toBeGreaterThan(71.9);
    expect(diffHours).toBeLessThan(72.1);

    // Flow's currentStepOrder updated to 2 (not 3)
    const flowUpdateData = mockTx.approvalFlow.update.mock.calls[0][0].data;
    expect(flowUpdateData.currentStepOrder).toBe(2);
  });

  it('uses fallback 24h SLA when chain config is not found', async () => {
    mockTx.approvalFlow.findUniqueOrThrow.mockResolvedValue({
      id: 'flow-1',
      currentStepOrder: 1,
      chainConfigId: 'chain-1',
      steps: [
        { id: 'step-1', stepOrder: 1, status: 'APPROVED' },
        { id: 'step-2', stepOrder: 2, status: 'NOT_STARTED' },
      ],
    });

    mockTx.approvalChainConfig.findUnique.mockResolvedValue(null);

    const beforeCall = Date.now();
    const result = await advanceFlow(mockTx as any, 'flow-1');

    expect(result).toEqual({ completed: false, nextStepOrder: 2 });

    const deadline = mockTx.approvalStep.update.mock.calls[0][0].data.slaDeadline as Date;
    const diffHours = (deadline.getTime() - beforeCall) / (60 * 60 * 1000);
    expect(diffHours).toBeGreaterThan(23.9);
    expect(diffHours).toBeLessThan(24.1);
  });

  it('handles flow with no chainConfigId gracefully (fallback SLA)', async () => {
    mockTx.approvalFlow.findUniqueOrThrow.mockResolvedValue({
      id: 'flow-1',
      currentStepOrder: 1,
      chainConfigId: null,
      steps: [
        { id: 'step-1', stepOrder: 1, status: 'APPROVED' },
        { id: 'step-2', stepOrder: 2, status: 'NOT_STARTED' },
      ],
    });

    const result = await advanceFlow(mockTx as any, 'flow-1');

    expect(result).toEqual({ completed: false, nextStepOrder: 2 });

    // Should not attempt to look up chain config
    expect(mockTx.approvalChainConfig.findUnique).not.toHaveBeenCalled();

    // Fallback 24h SLA used
    const deadline = mockTx.approvalStep.update.mock.calls[0][0].data.slaDeadline as Date;
    const diffHours = (deadline.getTime() - Date.now()) / (60 * 60 * 1000);
    expect(diffHours).toBeGreaterThan(23.8);
    expect(diffHours).toBeLessThan(24.1);
  });
});

// ---------------------------------------------------------------------------
// computeSlaStatus
// ---------------------------------------------------------------------------

describe('computeSlaStatus', () => {
  it('returns null when slaDeadline is null', () => {
    expect(computeSlaStatus(null, 'PENDING', 24)).toBeNull();
  });

  it('returns null when status is not PENDING', () => {
    const deadline = new Date(Date.now() + 10 * 60 * 60 * 1000);
    expect(computeSlaStatus(deadline, 'APPROVED', 24)).toBeNull();
    expect(computeSlaStatus(deadline, 'NOT_STARTED', 24)).toBeNull();
    expect(computeSlaStatus(deadline, 'REJECTED', 24)).toBeNull();
  });

  it('returns overdue status when deadline has passed', () => {
    // 2 hours overdue
    const deadline = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const result = computeSlaStatus(deadline, 'PENDING', 24);

    expect(result).not.toBeNull();
    expect(result?.status).toBe('overdue');
    expect(result?.remainingMs).toBeLessThan(0);
    expect(result?.label).toBe('OVERDUE 2h');
  });

  it('returns green when more than 50% time remaining', () => {
    // 18h left of 24h SLA = 75% remaining
    const deadline = new Date(Date.now() + 18 * 60 * 60 * 1000);
    const result = computeSlaStatus(deadline, 'PENDING', 24);

    expect(result).not.toBeNull();
    expect(result?.status).toBe('green');
    expect(result?.remainingMs).toBeGreaterThan(0);
  });

  it('returns yellow when 25-50% time remaining', () => {
    // 8h left of 24h SLA = ~33% remaining
    const deadline = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const result = computeSlaStatus(deadline, 'PENDING', 24);

    expect(result).not.toBeNull();
    expect(result?.status).toBe('yellow');
  });

  it('returns red when 25% or less time remaining', () => {
    // 3h left of 24h SLA = 12.5% remaining
    const deadline = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const result = computeSlaStatus(deadline, 'PENDING', 24);

    expect(result).not.toBeNull();
    expect(result?.status).toBe('red');
  });

  it('label shows hours remaining for non-overdue status', () => {
    const deadline = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const result = computeSlaStatus(deadline, 'PENDING', 24);

    expect(result).not.toBeNull();
    expect(result?.label).toBe('5h left');
  });

  it('overdue label shows hours overdue', () => {
    const deadline = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const result = computeSlaStatus(deadline, 'PENDING', 24);

    expect(result).not.toBeNull();
    expect(result?.label).toBe('OVERDUE 5h');
  });
});
