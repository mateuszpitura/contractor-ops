// TODO(Plan 74-05): implement first-boot idempotency assertions once Plan
// 74-05 wires upsertSeedTemplates to the real PrismaClient.

import { describe, it } from 'vitest';

describe('upsertSeedTemplates — first-boot idempotency', () => {
  it.todo('inserts 4 WorkflowRoleTemplate rows on first call');
  it.todo('is idempotent — second call does not duplicate or error');
  it.todo('sets isSeed: true for all 4 rows');
});
