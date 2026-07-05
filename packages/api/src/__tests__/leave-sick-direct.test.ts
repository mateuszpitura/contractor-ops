// LEAVE-02 sick-leave contract: manual sick entry is a DIRECT absence record —
// a notification, NOT an approval request. recordSickAbsence writes a direct
// LeaveLedgerEntry + a plain notification (never APPROVAL_REQUEST) and creates
// ZERO ApprovalFlow rows (e-ZLA/eAU auto-pull is deferred to v7.5).
//
// HOLD: requires the leave router (Plan 09) + generated client (Plan 06).

import { describe, it } from 'vitest';

describe.skip('recordSickAbsence is a direct absence, not an approval request', () => {
  it('writes a direct LeaveLedgerEntry for the sick period', () => {});
  it('dispatches a plain notification (never type APPROVAL_REQUEST)', () => {});
  it('creates NO ApprovalFlow rows', () => {});
  it('writes an audit log (leave.sick.recorded)', () => {});
});
