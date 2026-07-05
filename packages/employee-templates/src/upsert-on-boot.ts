// Idempotent first-boot upsert that materializes the per-market employee
// lifecycle seeds into per-organization `WorkflowTemplate` rows (what `startRun`
// instantiates — NOT `WorkflowRoleTemplate`, the KT registry) plus their
// `WorkflowTaskTemplate` children. Called by `runPostOrganizationCreateHooks`.

import type { PrismaClient } from '@contractor-ops/db';
import { Prisma } from '@contractor-ops/db/generated/prisma/client';
import { allMarketTemplateSeeds } from './registry';
import type { MarketTaskSeed } from './types';

// Seed rows are system-authored (no originating user); WorkflowTemplate.createdByUserId
// carries no FK, so a stable sentinel keeps the record honest and greppable.
const SEED_AUTHOR = 'system';

/** Task markers live in configJson under non-`rules` keys so evaluateCondition
 * treats the task as unconditional (a config without `rules` is "no condition"). */
function taskConfig(task: MarketTaskSeed): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  const config: Record<string, unknown> = {};
  if (task.govStub) config.govStub = task.govStub;
  if (task.certType) config.certType = task.certType;
  if (task.adviserVerify) config.adviserVerify = true;
  return Object.keys(config).length > 0 ? (config as Prisma.InputJsonValue) : Prisma.JsonNull;
}

/**
 * Upserts the per-market ONBOARDING + OFFBOARDING employee templates for an
 * organization. Idempotent: the parent keys on the `@@unique([organizationId,
 * jurisdiction, type, seedKey])` constraint (never clobbering org edits — the
 * update is a no-op), and the children are created only when the template has
 * none yet, so a re-run adds zero rows and never duplicates a task.
 */
export async function upsertEmployeeMarketTemplates(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  for (const seed of allMarketTemplateSeeds()) {
    const tmpl = await prisma.workflowTemplate.upsert({
      where: {
        organizationId_jurisdiction_type_seedKey: {
          organizationId,
          jurisdiction: seed.jurisdiction,
          type: seed.type,
          seedKey: seed.seedKey,
        },
      },
      // Do NOT clobber an org's edits to a previously seeded template.
      update: {},
      create: {
        organizationId,
        name: seed.name,
        type: seed.type,
        version: 1,
        status: 'DRAFT',
        appliesToEntityType: 'EMPLOYEE',
        jurisdiction: seed.jurisdiction,
        seedKey: seed.seedKey,
        createdByUserId: SEED_AUTHOR,
      },
    });

    // Children have no compound unique — create them only on first materialization
    // (parent has no tasks yet) so the re-run is a no-op and org edits survive.
    const existingTaskCount = await prisma.workflowTaskTemplate.count({
      where: { organizationId, workflowTemplateId: tmpl.id },
    });
    if (existingTaskCount > 0) continue;

    await prisma.workflowTaskTemplate.createMany({
      data: seed.tasks.map(task => ({
        organizationId,
        workflowTemplateId: tmpl.id,
        title: task.title,
        description: task.description ?? null,
        taskType: task.taskType,
        sortOrder: task.sortOrder,
        required: task.required,
        // HR staff are Better Auth org roles (hr_admin, …), not the Prisma
        // UserRole enum, so assigneeRole stays null: DRAFT templates materialize
        // unassigned and the org assigns HR members when it reviews/activates.
        assigneeMode: 'ROLE_BASED',
        assigneeRole: null,
        configJson: taskConfig(task),
      })),
    });
  }
}
