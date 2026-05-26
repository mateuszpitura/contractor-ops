import { ApprovalChainsTab } from './approval-chains-tab.js';
import { useApprovalChainsTab } from './hooks/use-approval-chains-tab.js';

// Decision: data-table host — chains table gated by SettingsIndexContainer (`approvals`
// tab); view delegates loading/empty row variants and editor-dialog open state to the
// table shell.
export function ApprovalChainsTabContainer() {
  const chains = useApprovalChainsTab();
  return <ApprovalChainsTab {...chains} />;
}
