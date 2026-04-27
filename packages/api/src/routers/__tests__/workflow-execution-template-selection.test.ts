// TODO(Plan 74-05/74-08): implement startOffboardingRun template auto-select
// + manual override assertions once the workflow-execution router lands.

import { describe, it } from 'vitest';

describe('startOffboardingRun — D-02 + D-03 template auto-selection', () => {
  it.todo('auto-selects template by Contractor.workflowRoleId');
  it.todo('falls back to generic_consultant when workflowRoleId is NULL');
  it.todo(
    'manual override writes overriddenTemplateId/overriddenByUserId/overriddenAt on WorkflowRun',
  );
  it.todo('mid-workflow swap is rejected (D-03)');
});
