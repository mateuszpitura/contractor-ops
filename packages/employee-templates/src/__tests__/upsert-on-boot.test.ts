// GREEN idempotency tests for upsertEmployeeMarketTemplates.
// Stateful vitest mock (no live DB): the parent upsert returns a stable id per
// compound key and the child createMany runs only while the template has no
// tasks — so a re-run adds zero rows.

import { describe, expect, it, vi } from 'vitest';
import { ALL_MARKET_TEMPLATE_SEEDS, upsertEmployeeMarketTemplates } from '../index';

function makePrismaMock() {
  const templateIds = new Map<string, string>();
  const taskCountByTemplate = new Map<string, number>();
  let counter = 0;

  const templateUpsert = vi.fn(
    async (args: {
      where: {
        organizationId_jurisdiction_type_seedKey: {
          organizationId: string;
          jurisdiction: string;
          type: string;
          seedKey: string;
        };
      };
      create: Record<string, unknown>;
    }) => {
      const w = args.where.organizationId_jurisdiction_type_seedKey;
      const key = `${w.organizationId}|${w.jurisdiction}|${w.type}|${w.seedKey}`;
      let id = templateIds.get(key);
      if (!id) {
        id = `tmpl-${counter++}`;
        templateIds.set(key, id);
      }
      return { id };
    },
  );

  const taskCount = vi.fn(
    async (args: { where: { workflowTemplateId: string } }) =>
      taskCountByTemplate.get(args.where.workflowTemplateId) ?? 0,
  );

  const taskCreateMany = vi.fn(async (args: { data: Array<{ workflowTemplateId: string }> }) => {
    const tid = args.data[0]?.workflowTemplateId;
    if (tid) taskCountByTemplate.set(tid, (taskCountByTemplate.get(tid) ?? 0) + args.data.length);
    return { count: args.data.length };
  });

  return {
    workflowTemplate: { upsert: templateUpsert },
    workflowTaskTemplate: { count: taskCount, createMany: taskCreateMany },
    _spies: { templateUpsert, taskCount, taskCreateMany },
  };
}

describe('ALL_MARKET_TEMPLATE_SEEDS', () => {
  it('has exactly 8 seeds (4 jurisdictions × ONBOARDING + OFFBOARDING)', () => {
    expect(ALL_MARKET_TEMPLATE_SEEDS).toHaveLength(8);
    const juris = new Set(ALL_MARKET_TEMPLATE_SEEDS.map(s => s.jurisdiction));
    expect([...juris].sort()).toEqual(['DE', 'PL', 'UK', 'US']);
    const onboarding = ALL_MARKET_TEMPLATE_SEEDS.filter(s => s.type === 'ONBOARDING');
    const offboarding = ALL_MARKET_TEMPLATE_SEEDS.filter(s => s.type === 'OFFBOARDING');
    expect(onboarding).toHaveLength(4);
    expect(offboarding).toHaveLength(4);
  });
});

describe('upsertEmployeeMarketTemplates — first-boot idempotency', () => {
  it('creates 8 templates + their task children on first run', async () => {
    const prisma = makePrismaMock();
    await upsertEmployeeMarketTemplates(prisma as never, 'org-1');

    expect(prisma._spies.templateUpsert).toHaveBeenCalledTimes(8);
    expect(prisma._spies.taskCreateMany).toHaveBeenCalledTimes(8);

    const totalTasks = ALL_MARKET_TEMPLATE_SEEDS.reduce((acc, s) => acc + s.tasks.length, 0);
    const createdTasks = prisma._spies.taskCreateMany.mock.calls.reduce(
      (acc, call) => acc + (call[0] as { data: unknown[] }).data.length,
      0,
    );
    expect(createdTasks).toBe(totalTasks);
  });

  it('is idempotent — a second run creates zero new task rows', async () => {
    const prisma = makePrismaMock();
    await upsertEmployeeMarketTemplates(prisma as never, 'org-1');
    const firstCreateManyCalls = prisma._spies.taskCreateMany.mock.calls.length;

    await upsertEmployeeMarketTemplates(prisma as never, 'org-1');

    // Parent upsert re-runs (DB-idempotent) but no new children are created.
    expect(prisma._spies.templateUpsert).toHaveBeenCalledTimes(16);
    expect(prisma._spies.taskCreateMany.mock.calls.length).toBe(firstCreateManyCalls);
  });

  it('seeds rows as DRAFT + appliesToEntityType EMPLOYEE (never clobbers on update)', async () => {
    const prisma = makePrismaMock();
    await upsertEmployeeMarketTemplates(prisma as never, 'org-2');
    for (const call of prisma._spies.templateUpsert.mock.calls) {
      const args = call[0] as {
        create: { status: string; appliesToEntityType: string };
        update: Record<string, unknown>;
      };
      expect(args.create.status).toBe('DRAFT');
      expect(args.create.appliesToEntityType).toBe('EMPLOYEE');
      expect(args.update).toEqual({});
    }
  });
});
