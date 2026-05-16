'use client';

import { useQuery } from '@tanstack/react-query';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// usePermissionsServer
// ---------------------------------------------------------------------------

/**
 * Server-derived permission introspection (Phase 74 Plan 05).
 *
 * Returns the resource→actions map for the current session's active role,
 * fetched from `authPermissions.getCurrentUserPermissions` so the client
 * cannot influence which role is used for the lookup
 * (T-74-05-permission-introspection-bypass mitigation).
 *
 * Prefer this over the hard-coded `usePermissions()` matrix when:
 *   - The action is destructive / privileged (e.g. workflow override blocking
 *     task) and the gating decision MUST match what the server would enforce.
 *   - The role list might be customised per org / extended at runtime (the
 *     local matrix in `use-permissions.ts` mirrors the seed role set only).
 *
 * Stable for the lifetime of the session: cached aggressively via TanStack
 * Query defaults (staleTime: Infinity is intentional — role changes require
 * a re-auth round-trip which already invalidates the session).
 *
 * Falls back to permissive `false` while loading so the UI doesn't flash
 * affirmative state for an action the caller can't actually perform.
 */
export function usePermissionsServer() {
  const query = useQuery({
    ...trpc.authPermissions.getCurrentUserPermissions.queryOptions(),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const permissions = query.data ?? {};

  return {
    /**
     * Returns true iff the server-derived permission map for the current
     * user's role includes every `action` for the given `resource`.
     * Returns false while loading or if the role yields no entry.
     */
    can: (resource: string, actions: string[]): boolean => {
      const granted = permissions[resource];
      if (!granted) return false;
      return actions.every(action => granted.includes(action));
    },
    isLoading: query.isPending,
    permissions,
  };
}
