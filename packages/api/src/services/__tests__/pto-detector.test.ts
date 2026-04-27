// TODO(Plan 74-06): implement PTO-aware fallback routing assertions once
// resolveAssigneeWithPto lands per CONTEXT.md D-05 / D-06 / D-07 / D-08.

import { describe, it } from 'vitest';

describe('resolveAssigneeWithPto — D-05/D-06/D-07/D-08', () => {
  it.todo('routes to manager when no PTO detected');
  it.todo('routes to fallback when calendar shows all-day busy with PTO_KEYWORDS title');
  it.todo('routes to fallback when User.outOfOffice is set today');
  it.todo('honours User.outOfOffice.fallbackUserId override before Team.fallbackApproverId');
  it.todo('skips calendar lookup entirely when no integration connected (D-07)');
  it.todo('falls through to OWNER role users + admin-attention badge when team has no fallback');
  it.todo('no PTO-spam — single resolution at task creation time');
});
