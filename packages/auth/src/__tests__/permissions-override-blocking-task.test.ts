// TODO(Plan 74-03): implement OWNER-only permission table-test once the
// workflow:override_blocking_task statement lands in @contractor-ops/auth.
//
// Plan 74-03 will replace the it.todo placeholders below with the actual
// table-driven assertions iterating all 10 lowercase role names.

import { describe, it } from 'vitest';

describe('workflow:override_blocking_task — D-09 / SC#5 OWNER-only', () => {
  it.todo('owner role grants override_blocking_task');

  // Plan 74-03 will expand this into it.each(...) over the 9 non-owner roles.
  it.todo('role admin does NOT grant override_blocking_task');
  it.todo('role finance_admin does NOT grant override_blocking_task');
  it.todo('role ops_manager does NOT grant override_blocking_task');
  it.todo('role team_manager does NOT grant override_blocking_task');
  it.todo('role legal_compliance_viewer does NOT grant override_blocking_task');
  it.todo('role it_admin does NOT grant override_blocking_task');
  it.todo('role external_accountant does NOT grant override_blocking_task');
  it.todo('role readonly does NOT grant override_blocking_task');
  it.todo('role platform_operator does NOT grant override_blocking_task');
});
