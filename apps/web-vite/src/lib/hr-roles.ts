/**
 * The staff roles that hold the server `employee:read` grant and therefore the
 * HR command surface (`hrDashboard.*`). The frontend `MemberRole` union
 * (role-normalization.ts) does NOT model these four worker-model HR roles — they
 * exist only server-side — so `usePermissions().can('employee', ['read'])`
 * resolves to `false` for every client-modeled role and cannot gate the HR
 * dashboard. Matching the raw active-member role against this set mirrors the
 * server gate exactly (the four HR roles, owner excluded by the BFLA fence). The
 * server `hrDashboardProcedure` stays the authoritative RBAC boundary; this is
 * the UX / defense-in-depth gate.
 */
export const HR_DASHBOARD_ROLE_LIST = [
  'hr_admin',
  'hr_manager',
  'payroll_officer',
  'leave_approver',
] as const;

const HR_DASHBOARD_ROLE_SET: ReadonlySet<string> = new Set(HR_DASHBOARD_ROLE_LIST);

/** Whether the active member's raw role holds the HR command surface. */
export function isHrDashboardRole(role: string | null | undefined): boolean {
  return role != null && HR_DASHBOARD_ROLE_SET.has(role);
}
