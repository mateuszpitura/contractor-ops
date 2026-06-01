// Phase 72 D-13 — complianceCritical operator.
// Returns TRUE iff the contractor has at least one ContractorComplianceItem with
// severity = 'BLOCKING' AND status = args.status (typically 'EXPIRED'). When TRUE
// at an invoice approval's final step, the engine holds the flow in
// PENDING_COMPLIANCE instead of marking it APPROVED.

import { registerOperator } from './registry';

interface ComplianceCriticalArgs {
  status: 'EXPIRED' | 'MISSING';
}

registerOperator<ComplianceCriticalArgs>('complianceCritical', async (args, ctx) => {
  const blocking = await ctx.tx.contractorComplianceItem.findFirst({
    where: {
      contractorId: ctx.contractorId,
      severity: 'BLOCKING',
      status: args.status,
      // Defense-in-depth tenant guard — mirrors the M-3 fix in compliance-payment-gate.ts.
      // OperatorContext.organizationId is populated by the engine (approval-engine.ts:347)
      // precisely for this guard.
      contractor: { is: { organizationId: ctx.organizationId } },
    },
    select: { id: true },
  });
  return blocking !== null;
});
