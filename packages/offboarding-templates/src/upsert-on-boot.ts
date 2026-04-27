// Phase 74 Plan 01 — Wave 0 stub. Plan 74-05 implements idempotent first-boot
// upsert that materialises OFFBOARDING_TEMPLATE_SEEDS into per-organization
// WorkflowRoleTemplate rows. `prisma` is typed as `unknown` here to avoid
// premature DB-package coupling — Plan 74-05 swaps in the real `PrismaClient`
// type and per-org transactional flow.

export async function upsertSeedTemplates(
  _prisma: unknown,
  _organizationId: string,
): Promise<void> {
  throw new Error('NOT_IMPLEMENTED — Plan 74-05 fills this');
}
