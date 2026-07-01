# Phase 90 — Deferred Items

Out-of-scope discoveries logged during plan execution (NOT fixed here).

## From Plan 90-02 (validators GREEN)

- **`employee-country-fields.test.ts` fails at module resolution** — this Plan-01
  RED scaffold imports `../employee-country-fields.js`, a module owned by a LATER
  wave (the `employee-country-fields.ts` country-fields registry). It is NOT in
  90-02's `files_modified` (90-02 ships only `employee-validators.ts`,
  `employee-reference-lists.ts`, and `reference-data/*`). Left RED by design; flips
  GREEN when the country-fields registry wave lands. The `-- employee-validators`
  vitest filter incidentally matches this file by substring, but the in-scope
  `employee-validators.test.ts` suite is fully GREEN (36/36) when run in isolation.

## From Plan 90-04 (EmployeeProfile storage + access control)

### 1. Pre-existing: `db:audit-enum-casing` red on `ManualOverrideCategory` (P77)

- **File:** `packages/db/prisma/schema/idp-deprovisioning.prisma:117-121`
- **Issue:** `enum ManualOverrideCategory` uses lowercase values
  (`verified_via_vendor_console`, `user_already_inactive`,
  `provider_endpoint_deprecated`, `transient_provider_issue_resolved`, `other`) —
  fails the UPPER_SNAKE audit.
- **Pre-existing:** present at base commit `dd67ff922`; file untouched by 90-04.
- **This plan's addition is clean:** `enum EmploymentStatus { ACTIVE ON_LEAVE
  SUSPENDED TERMINATED }` passes the audit (absent from the offender list).
- **Fix owner:** the P77 IdP manual-override enum normalization workstream; a
  rename needs an enum-rename migration across regions.

### 2. Pre-existing: `rbac-recipients.test.ts` snapshot mismatch (P89 drift)

- **File:** `packages/api/src/services/rbac-recipients.ts` (`ROLE_CONTRACTOR_ACTIONS`
  mirror) vs `packages/auth/src/roles.ts`
- **Issue:** the static `ROLE_CONTRACTOR_ACTIONS` mirror lists only the 10 core
  roles; P89 added the 4 HR roles (`hr_admin`, `hr_manager`, `payroll_officer`,
  `leave_approver`) to `roles.ts` without updating the mirror. The snapshot assert
  (`rbac-recipients.test.ts:110`) compares the mirror against the live role set and
  fails on the 4 missing HR keys.
- **Pre-existing:** drift predates 90-04. 90-04's `roles.ts` edit only adds the
  `employeePii` resource — it does not touch `contractor` actions or the role set,
  so it neither causes nor worsens this failure (the scoped
  `employee-cross-org-leak.test.ts` is GREEN, 4/4).
- **Latent bug:** `roleGrants('hr_admin'|'hr_manager', 'read')` returns `false`, so
  cron notification fan-out silently drops HR-role users from contractor-read
  recipients. Worth fixing when the employee notification surface lands.
- **Fix owner:** add the 4 HR roles to `ROLE_CONTRACTOR_ACTIONS` (`hr_admin:
  ['read']`, `hr_manager: ['read']`, `payroll_officer: []`, `leave_approver: []`) —
  matches the test's own remediation note.

## From Plan 90-06 (per-market registration UI)

### Frontend RBAC mirror missing `employee` + `employeePii` grants and HR roles

- **Files:** `apps/web-vite/src/hooks/use-permissions.ts` (grant mirror) +
  `packages/auth/src/role-normalization.ts` (`memberRoles` union).
- **Issue:** the server (`packages/auth/src/roles.ts` + `permissions.ts`) grants
  `employeePii: ['read']` to owner + admin, and `employee: [...]` to the HR roles
  (`hr_admin`/`hr_manager`/`payroll_officer`/`leave_approver`). The web-vite mirror
  omits `employee`/`employeePii`, and `memberRoles` does not yet include the HR
  roles.
- **Effect:** `can('employee',['create'])` and `can('employeePii',['read'])` are
  false for all current member roles, so the registration Register control shows a
  muted "ask an HR administrator" note and the PII reveal control is absent
  (fail-safe, matches threat T-90-06-01).
- **Not fixed here** because (a) it is outside 90-06's `files_modified`, and (b)
  adding grants for roles not present in `memberRoles` would diverge the mirror from
  the server contract that CLAUDE.md requires to stay in lockstep.
- **Fix owner:** the plan that owns the HR-role frontend surface — wire the HR roles
  into `memberRoles` and mirror the server `employee`/`employeePii` grants in
  `usePermissions`.
