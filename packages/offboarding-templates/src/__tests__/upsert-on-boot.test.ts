// Phase 74 Plan 05 — GREEN tests for upsertSeedTemplates idempotency.
// Uses vitest mocks (no live DB) to track call counts and shape.

import { describe, expect, it, vi } from 'vitest';
import { OFFBOARDING_TEMPLATE_SEEDS } from '../seeds';
import { upsertSeedTemplates } from '../upsert-on-boot';

interface FakeRow {
  id: string;
}

function makePrismaMock() {
  const templateUpsert = vi.fn<(args: unknown) => Promise<FakeRow>>(async () => ({
    id: `tmpl-${Math.random().toString(36).slice(2, 8)}`,
  }));
  const taskUpsert = vi.fn<(args: unknown) => Promise<FakeRow>>(async () => ({
    id: `task-${Math.random().toString(36).slice(2, 8)}`,
  }));

  return {
    workflowRoleTemplate: { upsert: templateUpsert },
    workflowRoleTaskTemplate: { upsert: taskUpsert },
    _spies: { templateUpsert, taskUpsert },
  };
}

describe('upsertSeedTemplates — first-boot idempotency', () => {
  it('inserts 4 WorkflowRoleTemplate rows on first call', async () => {
    const prisma = makePrismaMock();
    await upsertSeedTemplates(prisma as never, 'org-1');
    expect(prisma._spies.templateUpsert).toHaveBeenCalledTimes(4);

    const totalTaskItems = OFFBOARDING_TEMPLATE_SEEDS.reduce(
      (acc, seed) => acc + seed.taskItems.length,
      0,
    );
    expect(prisma._spies.taskUpsert).toHaveBeenCalledTimes(totalTaskItems);
  });

  it('is idempotent — second call calls upsert again with same arguments', async () => {
    const prisma = makePrismaMock();
    await upsertSeedTemplates(prisma as never, 'org-1');
    const firstTemplateCalls = prisma._spies.templateUpsert.mock.calls.length;
    const firstTaskCalls = prisma._spies.taskUpsert.mock.calls.length;

    // Re-run — Prisma upsert is idempotent at the DB layer (no error, no duplicate).
    // We assert the function does the same number of upsert calls — the DB
    // itself enforces uniqueness so the second pass is a no-op write.
    await upsertSeedTemplates(prisma as never, 'org-1');
    expect(prisma._spies.templateUpsert.mock.calls.length).toBe(firstTemplateCalls * 2);
    expect(prisma._spies.taskUpsert.mock.calls.length).toBe(firstTaskCalls * 2);

    // The compound unique key is consistent across calls (same organizationId+role)
    const firstCallWhere = (prisma._spies.templateUpsert.mock.calls[0]?.[0] as { where: unknown })
      .where;
    const secondPassFirstCallWhere = (
      prisma._spies.templateUpsert.mock.calls[firstTemplateCalls]?.[0] as { where: unknown }
    ).where;
    expect(firstCallWhere).toEqual(secondPassFirstCallWhere);
  });

  it('sets isSeed: true for all 4 rows', async () => {
    const prisma = makePrismaMock();
    await upsertSeedTemplates(prisma as never, 'org-2');
    for (const call of prisma._spies.templateUpsert.mock.calls) {
      const args = call[0] as { create: { isSeed: boolean } };
      expect(args.create.isSeed).toBe(true);
    }
  });
});
