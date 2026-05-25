import { useCallback } from 'react';

import { useAuth } from '../../../providers/auth-provider.js';
import type { OrgInfo } from '../dashboard-context.js';
import { useDashboardContext } from '../dashboard-context.js';

export interface OrgSwitcherListItem {
  id: string;
  name: string;
}

export interface OrgSwitcherView {
  currentOrg: OrgInfo | null;
  organizations: OrgSwitcherListItem[];
  handleOrgSwitch: (orgId: string) => Promise<void>;
}

export function useOrgSwitcher(): OrgSwitcherView {
  const { activeOrg } = useDashboardContext();
  const auth = useAuth();
  const { data: orgList } = auth.useListOrganizations();

  const organizations: OrgSwitcherListItem[] = (orgList ?? []).map(org => ({
    id: org.id,
    name: org.name,
  }));

  const handleOrgSwitch = useCallback(
    async (orgId: string) => {
      await auth.organization.setActive({ organizationId: orgId });
      window.location.reload();
    },
    [auth],
  );

  return {
    currentOrg: activeOrg,
    organizations,
    handleOrgSwitch,
  };
}
