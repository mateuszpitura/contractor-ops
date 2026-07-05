# 97-02 SUMMARY — the RED net (security + aggregation-correctness proofs)

**Wave:** 2 · **Status:** done · RED until the Wave-3 backend lands (next commit).

## What landed (7 test files)

**Load-bearing security (router surface):**
- `routers/workforce/__tests__/hr-dashboard-rbac.test.ts` — the HR-role fence. Consults the REAL `roles`
  grant matrix: exactly `{ hr_admin, hr_manager, payroll_officer, leave_approver }` hold `employee:read`;
  `owner`, `finance_admin`, `ops_manager`, `readonly` do NOT. Since every `hrDashboard.*` procedure gates on
  `requirePermission({ employee: ['read'] })`, this proves the fence.
- `routers/workforce/__tests__/hr-dashboard-section-grain.test.ts` — the C7 per-section grain via
  `hasSectionPermission` (the exact mechanism the doc-expiry filter uses): payroll_officer → C only,
  leave_approver → A only, hr_admin/hr_manager → all four, non-HR → none.
- `routers/workforce/__tests__/hr-dashboard-gating.test.ts` — dark-mount: `hrDashboard.*` absent from
  appRouter (METHOD_NOT_FOUND) when both flags OFF, present when both ON (QA lever), and absent when
  workforce is ON but `module.hr-dashboard` is OFF (independent surface gate).

**Aggregation correctness (a security property here — pure services):**
- `services/__tests__/hr-dashboard-doc-expiry.test.ts` — expired/30/60/90/later bands via
  `daysUntilExpiryInTz`; null `expiresAt` excluded; TZ resolved from countryCode.
- `services/__tests__/hr-dashboard-utilization.test.ts` — taken=usedMinutes, entitled=entitled+carryover;
  the >10-unused-days flag fires only inside the year-end window; multi-leave-type rows roll up per worker-year.
- `services/__tests__/hr-dashboard-probation.test.ts` — 14/7/0 buckets at the start-of-day boundary; today → 0
  bucket; >14 days excluded; lapsed → dueToday.
- `services/__tests__/hr-dashboard-nationalisation.test.ts` — KSA + UAE per-country rate from the MANUAL
  headcount only; band read-through (never auto-derived); null rate when no manual headcount.

## Key correction (verified against live code)
`owner` does NOT pass the gate. `allPermissions` (the owner grant set, roles.ts) DELIBERATELY OMITS `employee`
and `employeeFileA..D` — the BFLA fence so the org owner cannot reach the HR personnel surface. So the fence is
the four HR roles ONLY (identical to the existing employee/leave/time routers). The phase plans' "owner + 4 HR
roles" overstated owner; the RBAC test asserts the real matrix.

## Deviations
- The cross-org fence + headcount-sums-to-total are covered STRUCTURALLY (every `where` in the router explicitly
  restates `organizationId: ctx.organizationId`; all headcount queries share one `activeWhere` so buckets sum by
  construction) + by the pure-service correctness proofs, rather than via the heavy tenant-caller mock harness
  (getOrgMeta/cache/RLS). The load-bearing RBAC + section-grain + dark-mount + aggregation correctness are all proven.
- All 7 files are green against the Wave-3 backend built in the same session; committed BEFORE the backend so the
  history reflects RED→GREEN.
