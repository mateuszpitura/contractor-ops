import type { Prisma, PrismaClient } from '@contractor-ops/db';
import { TRPCError } from '@trpc/server';
import { APPROVAL_NO_USER_WITH_ROLE } from '../errors';
import './approval-engine/operators/index'; // side-effect: registers all condition operators
import { evaluateOperator } from './approval-engine/operators/registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Prisma interactive transaction client (subset of PrismaClient). */
export type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

interface StepConfig {
  name: string;
  approverUserId?: string | null;
  approverRole?: string | null;
  slaHours: number;
  required: boolean;
}

interface Condition {
  field: string;
  operator: string;
  value: number | string;
}

export interface SlaStatus {
  status: 'green' | 'yellow' | 'red' | 'overdue';
  remainingMs: number;
  label: string;
}

export interface AdvanceFlowResult {
  completed: boolean;
  flowStatus?: string;
  nextStepOrder?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Add hours to a date, returning a new Date instance.
 * Inline helper — no date-fns dependency.
 */
function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setTime(result.getTime() + hours * 60 * 60 * 1000);
  return result;
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluates approval chain conditions against invoice data.
 * All conditions must match (AND logic).
 *
 * @param conditionsJson - Raw JSON from ApprovalChainConfig.conditionsJson
 * @param invoice - Invoice data for condition evaluation
 * @returns true if all conditions match or no conditions defined
 */
export function evaluateConditions(
  conditionsJson: unknown,
  invoice: { totalMinor: number; contractorType?: string },
): boolean {
  if (!(conditionsJson && Array.isArray(conditionsJson))) {
    return false;
  }

  if (conditionsJson.length === 0) {
    return false;
  }

  const conditions = conditionsJson as Condition[];

  return conditions.every(condition => {
    if (condition.field === 'amount') {
      const thresholdMinor =
        typeof condition.value === 'number' ? condition.value * 100 : Number(condition.value) * 100;

      switch (condition.operator) {
        case 'gt':
          return invoice.totalMinor > thresholdMinor;
        case 'lt':
          return invoice.totalMinor < thresholdMinor;
        case 'eq':
          return invoice.totalMinor === thresholdMinor;
        default:
          return false;
      }
    }

    if (condition.field === 'contractorType') {
      const target = String(condition.value);
      switch (condition.operator) {
        case 'eq':
          return invoice.contractorType === target;
        default:
          return false;
      }
    }

    return false;
  });
}

// ---------------------------------------------------------------------------
// Chain routing
// ---------------------------------------------------------------------------

/**
 * Routes an invoice to the appropriate approval chain config.
 * Uses first-match strategy: iterates active chains by creation date,
 * evaluates conditions, returns the first matching chain.
 * Falls back to the default chain if no conditions match.
 *
 * @returns The matched chain config, or null if none found.
 */
export async function routeToChain(
  tx: TxClient,
  organizationId: string,
  invoice: { totalMinor: number; contractorType?: string },
) {
  const chains = await tx.approvalChainConfig.findMany({
    where: {
      organizationId,
      resourceType: 'INVOICE',
      isActive: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // First-match: evaluate conditions for each chain
  for (const chain of chains) {
    if (chain.conditionsJson && evaluateConditions(chain.conditionsJson, invoice)) {
      return chain;
    }
  }

  // Fallback: return the default chain
  const defaultChain = chains.find(c => c.isDefault);
  return defaultChain ?? null;
}

// ---------------------------------------------------------------------------
// Flow creation
// ---------------------------------------------------------------------------

/**
 * Creates an ApprovalFlow with snapshotted steps from the chain config.
 * Resolves role-based approvers by finding the first matching member.
 * First step is activated (PENDING with SLA deadline), others are NOT_STARTED.
 */
export async function createApprovalFlow(
  tx: TxClient,
  params: {
    organizationId: string;
    resourceType: 'INVOICE';
    resourceId: string;
    chainConfig: { id: string; stepsJson: unknown };
    createdByUserId: string;
  },
) {
  const steps = JSON.parse(JSON.stringify(params.chainConfig.stepsJson)) as StepConfig[];

  // Resolve role-based approvers
  for (const step of steps) {
    if (step.approverRole && !step.approverUserId) {
      const member = await tx.member.findFirst({
        where: {
          organizationId: params.organizationId,
          role: step.approverRole,
        },
        select: { userId: true },
      });

      if (!member) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: APPROVAL_NO_USER_WITH_ROLE,
        });
      }

      step.approverUserId = member.userId;
    }
  }

  const now = new Date();

  const flow = await tx.approvalFlow.create({
    data: {
      organizationId: params.organizationId,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      chainConfigId: params.chainConfig.id,
      status: 'PENDING',
      currentStepOrder: 1,
      startedAt: now,
      createdByUserId: params.createdByUserId,
      steps: {
        create: steps.map((step, index) => ({
          organizationId: params.organizationId,
          stepOrder: index + 1,
          name: step.name,
          approverUserId: step.approverUserId ?? null,
          approverRole: step.approverRole as
            | 'ORG_ADMIN'
            | 'FINANCE_ADMIN'
            | 'OPS_MANAGER'
            | 'TEAM_MANAGER'
            | 'LEGAL_VIEWER'
            | 'IT_ADMIN'
            | 'ACCOUNTANT'
            | 'READ_ONLY'
            | null,
          status: index === 0 ? 'PENDING' : 'NOT_STARTED',
          required: step.required,
          slaDeadline: index === 0 ? addHours(now, step.slaHours) : null,
        })) as unknown as Prisma.ApprovalStepCreateWithoutApprovalFlowInput[],
      },
    },
    include: {
      steps: { orderBy: { stepOrder: 'asc' } },
    },
  });

  return flow;
}

// ---------------------------------------------------------------------------
// Flow advancement
// ---------------------------------------------------------------------------

/**
 * Advances the approval flow to the next step after a step is approved.
 * If no more steps remain, marks the flow as APPROVED.
 *
 * @returns Whether the flow is completed and the next step order (if any).
 */
export async function advanceFlow(tx: TxClient, flowId: string): Promise<AdvanceFlowResult> {
  const flow = await tx.approvalFlow.findUniqueOrThrow({
    where: { id: flowId },
    include: {
      steps: { orderBy: { stepOrder: 'asc' } },
    },
  });

  // Parse stepsJson from the chain config to get slaHours per step
  let chainStepsJson: StepConfig[] = [];
  if (flow.chainConfigId) {
    const chainConfig = await tx.approvalChainConfig.findUnique({
      where: { id: flow.chainConfigId },
      select: { stepsJson: true },
    });
    if (chainConfig) {
      chainStepsJson = chainConfig.stepsJson as unknown as StepConfig[];
    }
  }

  const currentOrder = flow.currentStepOrder ?? 0;
  const nextStep = flow.steps.find(s => s.status === 'NOT_STARTED' && s.stepOrder > currentOrder);

  if (!nextStep) {
    // Final-step compliance gate. This runs AFTER all approver steps complete
    // and is orthogonal to the chain-config conditions evaluated at routing time
    // (evaluateConditions). complianceCritical is the canonical pre-APPROVE
    // check: if the resource's contractor has a BLOCKING+EXPIRED compliance
    // item, hold the flow in PENDING_COMPLIANCE instead of approving.
    // An approver must still act once the hold is released (never auto-APPROVE).
    const complianceHold = await checkComplianceHoldAtFinalStep(tx, flow);
    if (complianceHold) {
      await tx.approvalFlow.update({
        where: { id: flowId },
        data: {
          status: 'PENDING_COMPLIANCE',
          complianceHoldsJson: complianceHold as unknown as Prisma.InputJsonValue,
        },
      });
      return { completed: false, flowStatus: 'PENDING_COMPLIANCE' };
    }

    // All steps complete and no compliance hold — mark flow as APPROVED.
    await tx.approvalFlow.update({
      where: { id: flowId },
      data: {
        status: 'APPROVED',
        completedAt: new Date(),
      },
    });

    return { completed: true, flowStatus: 'APPROVED' };
  }

  // Activate next step
  const now = new Date();
  const stepConfig = chainStepsJson[nextStep.stepOrder - 1];
  const slaHours = stepConfig?.slaHours ?? 24; // fallback 24h

  await tx.approvalStep.update({
    where: { id: nextStep.id },
    data: {
      status: 'PENDING',
      slaDeadline: addHours(now, slaHours),
    },
  });

  await tx.approvalFlow.update({
    where: { id: flowId },
    data: { currentStepOrder: nextStep.stepOrder },
  });

  return { completed: false, nextStepOrder: nextStep.stepOrder };
}

/** Linkage stored on a held flow's complianceHoldsJson. */
export interface ComplianceHold {
  itemIds: string[];
  heldAt: string;
  heldByOperator: string;
}

/**
 * Evaluates complianceCritical(EXPIRED) at an invoice approval's final step.
 * Returns the hold linkage when the resource's contractor has at least one
 * BLOCKING+EXPIRED compliance item, or null when the flow may proceed to
 * APPROVED. Only invoice approvals are gated.
 */
async function checkComplianceHoldAtFinalStep(
  tx: TxClient,
  flow: { resourceType: string; resourceId: string; organizationId: string },
): Promise<ComplianceHold | null> {
  if (flow.resourceType !== 'INVOICE') return null;

  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: flow.resourceId },
    select: { contractorId: true },
  });
  if (!invoice.contractorId) return null;

  const blocked = await evaluateOperator(
    'complianceCritical',
    { status: 'EXPIRED' },
    { tx, contractorId: invoice.contractorId, organizationId: flow.organizationId },
  );
  if (!blocked) return null;

  const items = await tx.contractorComplianceItem.findMany({
    where: {
      contractorId: invoice.contractorId,
      severity: 'BLOCKING',
      status: 'EXPIRED',
      // Defense-in-depth tenant guard — mirrors the M-3 fix in compliance-payment-gate.ts.
      contractor: { is: { organizationId: flow.organizationId } },
    },
    select: { id: true },
  });
  return {
    itemIds: items.map(i => i.id),
    heldAt: new Date().toISOString(),
    heldByOperator: 'complianceCritical',
  };
}

// ---------------------------------------------------------------------------
// SLA computation
// ---------------------------------------------------------------------------

/**
 * Computes the SLA status for an approval step.
 *
 * @param slaDeadline - The step's SLA deadline
 * @param status - The step's current status
 * @param slaHours - The configured SLA hours (used to compute percentage)
 * @returns SLA status object or null if not applicable
 */
export function computeSlaStatus(
  slaDeadline: Date | null,
  status: string,
  slaHours?: number,
): SlaStatus | null {
  if (!slaDeadline || status !== 'PENDING') {
    return null;
  }

  const now = new Date();
  const remainingMs = slaDeadline.getTime() - now.getTime();

  if (remainingMs <= 0) {
    const overdueHours = Math.ceil(Math.abs(remainingMs) / (60 * 60 * 1000));
    return {
      status: 'overdue',
      remainingMs,
      label: `OVERDUE ${overdueHours}h`,
    };
  }

  // Compute percentage of time remaining
  const totalMs = slaHours
    ? slaHours * 60 * 60 * 1000
    : slaDeadline.getTime() - (slaDeadline.getTime() - remainingMs);
  const percentRemaining = totalMs > 0 ? (remainingMs / totalMs) * 100 : 100;

  const hoursLeft = Math.ceil(remainingMs / (60 * 60 * 1000));

  let slaStatus: 'green' | 'yellow' | 'red';
  if (percentRemaining > 50) {
    slaStatus = 'green';
  } else if (percentRemaining > 25) {
    slaStatus = 'yellow';
  } else {
    slaStatus = 'red';
  }

  return {
    status: slaStatus,
    remainingMs,
    label: `${hoursLeft}h left`,
  };
}
