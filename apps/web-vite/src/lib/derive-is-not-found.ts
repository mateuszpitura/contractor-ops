/**
 * Map a TanStack Query / tRPC error into a not-found flag for detail containers.
 * Procedures scoped by (id, organizationId) return NOT_FOUND for cross-tenant
 * reads so the UI does not reveal whether the row exists in another org.
 */
export function deriveIsNotFound(error: unknown): boolean {
  const code = (error as { data?: { code?: string } } | null | undefined)?.data?.code;
  if (code === 'NOT_FOUND') return true;
  const message = (error as { message?: string } | null | undefined)?.message;
  if (typeof message !== 'string') return false;
  const normalized = message.toLowerCase().replaceAll('_', ' ');
  return normalized.includes('not found');
}
