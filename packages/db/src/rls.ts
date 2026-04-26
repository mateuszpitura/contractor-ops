import { Prisma } from '../generated/prisma/client/index.js';

export type RlsContext = {
  organizationId: string;
  userId: string;
};

/**
 * Sets Postgres session variables used by RLS policies.
 *
 * Must be called inside the same transaction that will run queries
 * (uses `set_config(..., true)` == SET LOCAL).
 */
export async function withRlsSession(
  tx: { $executeRaw: (query: Prisma.Sql) => Promise<unknown> },
  ctx: RlsContext,
) {
  await tx.$executeRaw(Prisma.sql`select set_config('app.org_id', ${ctx.organizationId}, true)`);
  await tx.$executeRaw(Prisma.sql`select set_config('app.user_id', ${ctx.userId}, true)`);
}
