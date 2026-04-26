/**
 * Strips Prisma class prototypes (Decimal, Date wrappers, lazy relations)
 * from query results, producing plain JSON-serializable objects.
 *
 * Purpose: avoids TS2742 errors caused by inferred tRPC router types
 * referencing the generated `@contractor-ops/db` Prisma client module from
 * consumer packages (the web app) that don't depend on it.
 *
 * Cost: a full JSON round-trip per call. Don't use in tight loops — use
 * once at the router boundary on the final response shape. superjson at
 * the tRPC transport already handles Date / BigInt, so callers only need
 * this when the inferred type is the problem (not the runtime shape).
 *
 * TODO: long-term, export concrete `Prisma.Payload` helper types from a
 * shared barrel so this hack can be deleted.
 */
export function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}
