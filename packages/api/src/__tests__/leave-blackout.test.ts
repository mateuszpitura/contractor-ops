// LEAVE-02 blackout contract: submitLeaveRequest rejects (BAD_REQUEST) when the
// requested range overlaps an org BlackoutPeriod for the requester's team (or an
// org-wide blackout), and also rejects when the requested minutes exceed the
// available balance.
//
// HOLD: requires the leave router (Plan 09) + generated client (Plan 06).

import { describe, it } from 'vitest';

describe.skip('blackout period + balance guards on submit', () => {
  it('rejects a vacation request overlapping a BlackoutPeriod with BAD_REQUEST', () => {});
  it('rejects a request whose minutes exceed the available balance', () => {});
  it('allows a request outside every blackout with sufficient balance', () => {});
});
