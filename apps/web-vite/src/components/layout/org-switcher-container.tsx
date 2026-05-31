import { useOrgSwitcher } from './hooks/use-org-switcher.js';
import { OrgSwitcher, OrgSwitcherEmpty } from './org-switcher.js';

export function OrgSwitcherContainer() {
  const { currentOrg, organizations, handleOrgSwitch, createOrg, isCreating } = useOrgSwitcher();

  if (organizations.length === 0) {
    return (
      <OrgSwitcherEmpty currentOrg={currentOrg} onCreateOrg={createOrg} isCreating={isCreating} />
    );
  }

  return (
    <OrgSwitcher
      currentOrg={currentOrg}
      organizations={organizations}
      onOrgSwitch={handleOrgSwitch}
      onCreateOrg={createOrg}
      isCreating={isCreating}
    />
  );
}
