// LEAVE-02 RBAC gate — the Blocker-1 contract for the shared, resourceType-aware
// approval procedures. The shared approve/reject/bulk procedures gate on a
// coarse OR-set (invoice:approve OR employee:approve_leave) plus a fine-grained
// body assertion mapping the fetched step's resourceType → the exact required
// permission, so neither role reaches the other's resource.
//
// HOLD: registered as the enforcement contract; executing it GREEN requires the
// leave-router + approval-gate integration harness (role-session caller over a
// seeded LEAVE_REQUEST flow) landed in Plan 07. Kept as describe.skip so it
// registers without a live-DB/auth harness and never bricks tsc.

import { describe, it } from 'vitest';

describe.skip('leave-approval RBAC gate (resourceType-aware, no over-grant)', () => {
  it('lets a leave_approver-only session APPROVE a LEAVE_REQUEST step (writes the DEDUCTION)', () => {
    // employee:approve_leave, NO invoice:approve → approvalQueue.approve on a
    // LEAVE_REQUEST step resolves and finalizeApprovedLeave inserts a DEDUCTION.
  });

  it('FORBIDS an invoice-only approver on the SAME LEAVE_REQUEST step', () => {
    // invoice:approve, NO approve_leave → assertApprovalActionPermission throws FORBIDDEN.
  });

  it('FORBIDS a leave_approver on an INVOICE step (no over-grant either direction)', () => {
    // employee:approve_leave, NO invoice:approve → FORBIDDEN on an INVOICE step.
  });
});
