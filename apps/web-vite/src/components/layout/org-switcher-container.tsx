import { useOrgSwitcher } from './hooks/use-org-switcher.js';
import { OrgSwitcher } from './org-switcher.js';

export function OrgSwitcherContainer() {
  const { currentOrg, organizations, handleOrgSwitch } = useOrgSwitcher();

  return (
    <OrgSwitcher
      currentOrg={currentOrg}
      organizations={organizations}
      onOrgSwitch={handleOrgSwitch}
    />
  );
}
