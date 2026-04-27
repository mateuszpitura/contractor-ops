// TODO(Plan 74-05): implement workflowRoles CRUD + getCurrentUserPermissions
// assertions once the tRPC router lands.

import { describe, it } from 'vitest';

describe('workflowRoles router — D-01/D-14 CRUD', () => {
  it.todo('createRoleTemplate writes per-locale columns titleEn/Pl/De');
  it.todo('listRoleTemplates returns seed + ops rows scoped to organizationId');
  it.todo('updateRoleTemplate enforces tenant isolation');
  it.todo('deleteRoleTemplate refuses to delete isSeed=true rows');
  it.todo('getCurrentUserPermissions returns workflow.override_blocking_task only for owner role');
});
