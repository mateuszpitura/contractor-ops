// Decision: settings tab section gated upstream by SettingsIndexContainer (`approvals` tab).
// View owns variant branches (loading, empty list, chain editor open) via hook flags; container
// is the hook ownership boundary per ARCHITECTURE.md.

import { ApprovalChainsTab } from './approval-chains-tab.js';
import { useApprovalChainsTab } from './hooks/use-approval-chains-tab.js';

export function ApprovalChainsTabContainer() {
  const chains = useApprovalChainsTab();
  return <ApprovalChainsTab {...chains} />;
}
