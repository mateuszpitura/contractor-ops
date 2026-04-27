// Phase 74 Plan 05 — Idempotent first-boot upsert that materialises the 4
// typed-const seeds (from Plan 74-02) into per-organization
// `WorkflowRoleTemplate` rows along with their `WorkflowRoleTaskTemplate`
// children. Called by `runPostOrganizationCreateHooks` (api/src/services).

import type { PrismaClient } from '@contractor-ops/db';
import { Prisma } from '@contractor-ops/db/generated/prisma/client';
import { OFFBOARDING_TEMPLATE_SEEDS } from './seeds.js';

/**
 * Upserts the 4 KT seed templates for an organization. Idempotent — re-running
 * is safe because both upserts key on the canonical compound-unique constraints
 * (`@@unique([organizationId, role])` for parent rows, `@@unique([workflowRoleTemplateId, sortOrder])`
 * for child task rows, both established by Plan 74-04's migration).
 */
export async function upsertSeedTemplates(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  for (const seed of OFFBOARDING_TEMPLATE_SEEDS) {
    const tmpl = await prisma.workflowRoleTemplate.upsert({
      where: { organizationId_role: { organizationId, role: seed.role } },
      update: { displayNameI18nKey: seed.displayNameI18nKey },
      create: {
        organizationId,
        role: seed.role,
        displayNameI18nKey: seed.displayNameI18nKey,
        isSeed: true,
      },
    });
    for (const [i, item] of seed.taskItems.entries()) {
      const requiredDocs = item.requiredDocs ? [...item.requiredDocs] : Prisma.JsonNull;
      await prisma.workflowRoleTaskTemplate.upsert({
        where: {
          workflowRoleTemplateId_sortOrder: {
            workflowRoleTemplateId: tmpl.id,
            sortOrder: i,
          },
        },
        update: {
          titleI18nKey: item.titleI18nKey,
          descriptionI18nKey: item.descriptionI18nKey,
          dueDayOffset: item.dueDayOffset,
          requiredDocsJson: requiredDocs,
        },
        create: {
          organizationId,
          workflowRoleTemplateId: tmpl.id,
          sortOrder: i,
          titleI18nKey: item.titleI18nKey,
          descriptionI18nKey: item.descriptionI18nKey,
          dueDayOffset: item.dueDayOffset,
          requiredDocsJson: requiredDocs,
        },
      });
    }
  }
}
