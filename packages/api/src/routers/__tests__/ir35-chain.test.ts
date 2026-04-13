// PLAN_REF: Phase 59 Plan 59-03 (IR35 chain router + UI) closes todos below.
import { describe } from 'vitest';

describe('ir35Chain router (Phase 59 · CLASS-04)', () => {
  describe.todo('listByEngagement auto-seeds CLIENT + WORKER on first call for GB engagement');
  describe.todo('listByEngagement does NOT auto-seed for non-GB engagements');
  describe.todo('upsertParticipant rejects linkedContractorId belonging to another org');
  describe.todo('markDelivered sets sdsDeliveredAt + preserves note');
  describe.todo('markAcknowledged sets sdsAcknowledgedAt independently of sdsDeliveredAt');
  describe.todo('reorderParticipants assigns orderIndex = position; rejects foreign ids');
  describe.todo('removeParticipant blocks removal of CLIENT role (auto-populated)');
  describe.todo('multi-tenant: Org A cannot list / mutate Org B chain (NOT_FOUND)');
  describe.todo('concurrent listByEngagement on empty engagement auto-seeds exactly once');
});
