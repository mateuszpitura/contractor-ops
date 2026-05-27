/**
 * Recover sessions that lack an active organization.
 *
 * The server-side `databaseHooks.session.create.before` in
 * `packages/auth/src/config.ts` auto-seeds `activeOrganizationId` to the
 * user's first non-disabled membership on session CREATE. Sessions
 * created before that hook landed (or sessions where the membership was
 * cleared by an admin) have `activeOrganizationId=null`, which makes
 * `customSession` return `member=null`, which makes
 * `usePermissions().can(...)` default-deny every action, which collapses
 * the sidebar to overview/notifications and leaves the dashboard empty.
 *
 * This hook restores the equivalent client-side behaviour: if the
 * session is present, no active org is set, and the user has at least
 * one membership, set the first one active and reload so the new
 * `member` field flows through `customSession`.
 */

import { useEffect, useRef } from 'react';

import { useAuth } from '../../../providers/auth-provider.js';

export function useAutoActiveOrg(): void {
  const auth = useAuth();
  const session = auth.useSession();
  const { data: orgs } = auth.useListOrganizations();
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    if (session.isPending) return;
    if (!session.data?.user) return;
    if (session.data.session?.activeOrganizationId) return;
    if (!orgs || orgs.length === 0) return;

    triggered.current = true;
    const first = orgs[0];
    void auth.organization
      .setActive({ organizationId: first.id })
      .then(() => {
        window.location.reload();
      })
      .catch(() => {
        triggered.current = false;
      });
  }, [auth, orgs, session.data, session.isPending]);
}
