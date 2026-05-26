// ---------------------------------------------------------------------------
// `findOrThrow` — single source of truth for the tRPC find-or-throw pattern.
// ---------------------------------------------------------------------------
//
// The pattern these helpers DRY up across `packages/api/src/routers/**`:
//
//   const x = await ctx.db.X.findFirst({
//     where: { id, organizationId, deletedAt: null },
//     ...include,
//   });
//   if (!x) {
//     throw new TRPCError({ code: 'NOT_FOUND', message: E.X_NOT_FOUND });
//   }
//
// becomes:
//
//   const x = await findOrThrow(
//     () => ctx.db.X.findFirst({
//       where: { id, organizationId, deletedAt: null },
//       ...include,
//     }),
//     E.X_NOT_FOUND,
//   );
//
// Tenant scoping continues to come from the caller's `ctx.db` — the helper
// stays Prisma-model-agnostic by accepting a finder lambda rather than a
// model handle.

import { TRPCError } from '@trpc/server';

/**
 * Run a Prisma `findFirst`-style finder and throw a tRPC `NOT_FOUND` error
 * when it resolves to `null` / `undefined`. The resolved value is narrowed
 * to non-nullable.
 *
 * @param finder  Lambda returning the Prisma query promise.
 * @param errorMessage  Message string (typically an `E.X_NOT_FOUND` constant).
 */
export async function findOrThrow<T>(
  finder: () => Promise<T | null | undefined>,
  errorMessage: string,
): Promise<NonNullable<T>> {
  const value = await finder();
  if (value === null || value === undefined) {
    throw new TRPCError({ code: 'NOT_FOUND', message: errorMessage });
  }
  return value as NonNullable<T>;
}
