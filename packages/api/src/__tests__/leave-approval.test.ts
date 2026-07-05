// LEAVE-02 approval integration contract: a leave request routes through the
// generic approval-chain (ApprovalFlow with resourceType='LEAVE_REQUEST'), and
// approving it inserts a DEDUCTION LeaveLedgerEntry + decrements the balance
// cache in the same transaction.
//
// HOLD: requires the leave router (Plan 09) + approval-seam edits (Plan 07) +
// the generated client (Plan 06). Registered as a describe.skip contract so it
// is visible in the run without a live-DB harness and never bricks tsc.

import { describe, it } from 'vitest';

describe.skip('leave request → approval-chain → ledger deduction', () => {
  it('creates an ApprovalFlow with resourceType=LEAVE_REQUEST and status PENDING', () => {});
  it('inserts a DEDUCTION ledger row + recomputes the balance cache on approve', () => {});
  it('writes an audit log (leave.approved) inside the finalize transaction', () => {});
});
