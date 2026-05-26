import { AuditLogTab } from './audit-log-tab.js';
import { useAuditLogTab } from './hooks/use-audit-log-tab.js';

// Decision: data-table host — audit log table gated by SettingsIndexContainer
// (`canViewAuditLog`); view delegates loading/empty/refetching row variants to the
// shared table shell.
export function AuditLogTabContainer() {
  const auditLog = useAuditLogTab();
  return <AuditLogTab {...auditLog} />;
}
