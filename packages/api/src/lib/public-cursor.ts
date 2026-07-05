// Cursor + sort helpers for the public REST read procedures.
//
// The public API uses a single cursor convention (no offset). The opaque
// cursor envelope (base64url {v,id}) is a TRANSPORT concern owned by the Hono
// boundary (apps/public-api/src/lib/openapi-cursor.ts) — by the time input
// reaches a tRPC procedure, `cursor` is already the decoded row id. Here we own
// the sort → orderBy translation (leading `-` = desc) with a stable `id`
// tiebreaker so keyset pagination is deterministic.

/** Split a `sort` token (`field` | `-field`) into a Prisma field + direction. */
export function parsePublicSort(sort: string): { field: string; dir: 'asc' | 'desc' } {
  const dir: 'asc' | 'desc' = sort.startsWith('-') ? 'desc' : 'asc';
  const field = sort.startsWith('-') ? sort.slice(1) : sort;
  return { field, dir };
}

/**
 * Deterministic `orderBy` for keyset pagination: the sort field followed by the
 * unique `id` (same direction) as a tiebreaker. When the sort field IS `id`,
 * a single clause is returned.
 */
export function publicOrderBy(sort: string): Array<Record<string, 'asc' | 'desc'>> {
  const { field, dir } = parsePublicSort(sort);
  if (field === 'id') return [{ id: dir }];
  return [{ [field]: dir }, { id: dir }];
}
