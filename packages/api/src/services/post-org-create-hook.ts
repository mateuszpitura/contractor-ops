// Post-Organization-create hook.
//
// Materialises the 4 KT seed templates for a freshly-created organization.
// Failure path is logged but NOT re-thrown — org creation must not fail
// because of seed upsert; selectForContractor falls back to Generic Consultant
// if a seed row is somehow missing.

import type { PrismaClient } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { upsertSeedTemplates } from '@contractor-ops/offboarding-templates';

const logger = createLogger({ service: 'post-org-create-hook' });

export async function runPostOrganizationCreateHooks(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  try {
    await upsertSeedTemplates(prisma, organizationId);
    logger.info({ organizationId }, 'offboarding seed templates upserted');
  } catch (err) {
    logger.error(
      { organizationId, err },
      'seed upsert failed; org will use NULL workflowRoleId fallback',
    );
    // Do NOT re-throw — org creation must succeed even if seeding fails.
  }
}
