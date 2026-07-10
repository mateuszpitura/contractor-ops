import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useAuth } from '../../../providers/auth-provider.js';
import type { OrgInfo } from '../dashboard-context.js';
import { useDashboardContext } from '../dashboard-context.js';

export interface OrgSwitcherListItem {
  id: string;
  name: string;
}

export interface CreateOrgResult {
  ok: boolean;
}

export interface OrgSwitcherView {
  currentOrg: OrgInfo | null;
  organizations: OrgSwitcherListItem[];
  handleOrgSwitch: (orgId: string) => Promise<void>;
  createOrg: (name: string) => Promise<CreateOrgResult>;
  isCreating: boolean;
}

export function useOrgSwitcher(): OrgSwitcherView {
  const { activeOrg } = useDashboardContext();
  const auth = useAuth();
  const t = useTranslations('Common.orgSwitcher');
  const { data: orgList } = auth.useListOrganizations();
  const [isCreating, setIsCreating] = useState(false);

  const organizations: OrgSwitcherListItem[] = (orgList ?? []).map(
    (org: { id: string; name: string }) => ({
      id: org.id,
      name: org.name,
    }),
  );

  const handleOrgSwitch = useCallback(
    async (orgId: string) => {
      await auth.organization.setActive({ organizationId: orgId });
      window.location.reload();
    },
    [auth],
  );

  const createOrg = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return { ok: false };
      setIsCreating(true);
      try {
        const slug = trimmed
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
        const { data, error } = await auth.organization.create({
          name: trimmed,
          slug,
        });
        if (error) {
          toast.error(error.message ?? t('createFailed'));
          return { ok: false };
        }
        if (data?.id) {
          await auth.organization.setActive({ organizationId: data.id });
        }
        window.location.reload();
        return { ok: true };
      } finally {
        setIsCreating(false);
      }
    },
    [auth, t],
  );

  return {
    currentOrg: activeOrg,
    organizations,
    handleOrgSwitch,
    createOrg,
    isCreating,
  };
}
