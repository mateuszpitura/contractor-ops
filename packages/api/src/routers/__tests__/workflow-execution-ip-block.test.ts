import { describe, it } from 'vitest';

describe('completeTask — IP_VERIFICATION hard-block (Phase 75 D-08)', () => {
  it.todo(
    'attempting to set WorkflowRun.completedAt with open IP_VERIFICATION raises PRECONDITION_FAILED',
  );
  it.todo('error.cause includes { blockedTaskKind: "IP_VERIFICATION", openTaskIds: [...] }');
  it.todo('multiple open IP_VERIFICATION tasks are all enumerated in openTaskIds');
  it.todo(
    'completing a non-final task while IP_VERIFICATION is open succeeds (block is ONLY on terminal completion)',
  );
  it.todo('Phase 74 overrideBlockingTask path clears the block and allows completion');
  it.todo('an admin without workflow:override_blocking_task permission cannot use the override');
  it.todo(
    'completing the IP_VERIFICATION task itself by webhook auto-clears the block (D-08 atomic flow)',
  );
});
