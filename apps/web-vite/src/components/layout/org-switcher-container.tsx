import { useOrgSwitcher } from './hooks/use-org-switcher.js';
import { OrgSwitcher, OrgSwitcherEmpty } from './org-switcher.js';

export function OrgSwitcherContainer() {
  const { currentOrg, organizations, handleOrgSwitch } = useOrgSwitcher();

  if (organizations.length === 0) {
    return <OrgSwitcherEmpty currentOrg={currentOrg} />;
  }

  return (
    <OrgSwitcher
      currentOrg={currentOrg}
      organizations={organizations}
      onOrgSwitch={handleOrgSwitch}
    />
  );
}
