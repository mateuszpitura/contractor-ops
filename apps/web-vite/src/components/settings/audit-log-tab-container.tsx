// Decision: settings tab section gated upstream by SettingsIndexContainer (`canViewAuditLog` perm).
// View internally branches on isLoading/isTrulyEmpty/isRefetching for skeleton + empty state UX;
// branches stay in view for test-contract compatibility (see __tests__/audit-log-tab.test.tsx).
// Container is the hook ownership boundary.

import { AuditLogTab } from './audit-log-tab.js';
import { useAuditLogTab } from './hooks/use-audit-log-tab.js';

export function AuditLogTabContainer() {
  const auditLog = useAuditLogTab();
  return <AuditLogTab {...auditLog} />;
}
