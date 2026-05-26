// ---------------------------------------------------------------------------
// Cursor pagination helpers for tRPC list procedures.
// ---------------------------------------------------------------------------
//
// The pattern these helpers DRY up across `packages/api/src/routers/**`:
//
//   const rows = await ctx.db.X.findMany({
//     where, orderBy, select,
//     take: limit + 1,
//     ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
//   });
//   const hasMore = rows.length > limit;
//   return {
//     items: hasMore ? rows.slice(0, limit) : rows,
//     nextCursor: <see below>,
//   };
//
// becomes:
//
//   const rows = await ctx.db.X.findMany({
//     where, orderBy, select,
//     ...cursorClause(input),
//   });
//   return paginateByLastKept(rows, input);    // or paginateByExtraRow
//
// The helpers do NOT wrap `findMany` itself — that would force a generic
// over every Prisma model. Callers keep their own where / orderBy / select
// clauses; the helpers own the +1 take, cursor/skip wiring, and the
// trim-and-emit-nextCursor post-processing.
//
// Two cursor conventions exist in the codebase (preserved exactly — see
// facts.md: no behaviour change at any call site):
//
//   - "last kept"  : nextCursor = id of the LAST RETURNED row.
//                    Next page resumes at the row AFTER that id.
//                    Correct continuation under `cursor: { id }, skip: 1`.
//                    → use paginateByLastKept / paginateByLastKeptUndefined.
//
//   - "extra row"  : nextCursor = id of the EXTRA (limit+1)th row that was
//                    fetched but NOT returned. Next page sends that id with
//                    `cursor: { id }, skip: 1`, which causes Prisma to skip
//                    the extra row entirely — so one row is silently lost
//                    per page boundary. This is a pre-existing bug at the
//                    affected call sites; preserved bit-for-bit here. A
//                    follow-up issue should convert these sites to the
//                    last-kept convention.
//                    → use paginateByExtraRow / paginateByExtraRowUndefined.
//
// The `*Undefined` variants emit `nextCursor: string | undefined` instead
// of `string | null` to preserve the existing JSON wire shape at routers
// that already used `undefined`.

const DEFAULT_PAGE_LIMIT = 50;

export interface CursorInput {
  cursor?: string | null;
  limit?: number;
}

/**
 * Prisma findMany clauses for cursor pagination. Pair with one of the
 * paginate* helpers on the returned row array.
 */
export function cursorClause(input: CursorInput | undefined, defaultLimit = DEFAULT_PAGE_LIMIT) {
  const limit = input?.limit ?? defaultLimit;
  const cursor = input?.cursor ?? null;
  if (cursor) {
    return {
      take: limit + 1,
      cursor: { id: cursor },
      skip: 1,
    } as const;
  }
  return { take: limit + 1 } as const;
}

// ----- last-kept semantic (nextCursor = id of last returned row) -----

/** nextCursor = id of the LAST RETURNED row; null when last page. */
export function paginateByLastKept<T extends { id: string }>(
  rows: T[],
  input: CursorInput | undefined,
  defaultLimit = DEFAULT_PAGE_LIMIT,
): { items: T[]; nextCursor: string | null } {
  const limit = input?.limit ?? defaultLimit;
  const hasMore = rows.length > limit;
  return {
    items: hasMore ? rows.slice(0, limit) : rows,
    nextCursor: hasMore ? (rows[limit - 1]?.id ?? null) : null,
  };
}

/** Same as `paginateByLastKept` but `nextCursor: string | undefined`. */
export function paginateByLastKeptUndefined<T extends { id: string }>(
  rows: T[],
  input: CursorInput | undefined,
  defaultLimit = DEFAULT_PAGE_LIMIT,
): { items: T[]; nextCursor: string | undefined } {
  const limit = input?.limit ?? defaultLimit;
  const hasMore = rows.length > limit;
  return {
    items: hasMore ? rows.slice(0, limit) : rows,
    nextCursor: hasMore ? (rows[limit - 1]?.id ?? undefined) : undefined,
  };
}

// ----- extra-row semantic (nextCursor = id of dropped +1 row; pre-existing bug preserved) -----

/** nextCursor = id of the EXTRA (limit+1)th row dropped from the result; null when last page. */
export function paginateByExtraRow<T extends { id: string }>(
  rows: T[],
  input: CursorInput | undefined,
  defaultLimit = DEFAULT_PAGE_LIMIT,
): { items: T[]; nextCursor: string | null } {
  const limit = input?.limit ?? defaultLimit;
  const hasMore = rows.length > limit;
  return {
    items: hasMore ? rows.slice(0, limit) : rows,
    nextCursor: hasMore ? (rows[limit]?.id ?? null) : null,
  };
}

/** Same as `paginateByExtraRow` but `nextCursor: string | undefined`. */
export function paginateByExtraRowUndefined<T extends { id: string }>(
  rows: T[],
  input: CursorInput | undefined,
  defaultLimit = DEFAULT_PAGE_LIMIT,
): { items: T[]; nextCursor: string | undefined } {
  const limit = input?.limit ?? defaultLimit;
  const hasMore = rows.length > limit;
  return {
    items: hasMore ? rows.slice(0, limit) : rows,
    nextCursor: hasMore ? (rows[limit]?.id ?? undefined) : undefined,
  };
}
