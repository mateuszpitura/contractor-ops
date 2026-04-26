/**
 * Strips Prisma class prototype from query results for JSON-serializable tRPC output.
 * Shared by routers that must not re-export a local `plain` from a sibling router.
 */
export function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}
