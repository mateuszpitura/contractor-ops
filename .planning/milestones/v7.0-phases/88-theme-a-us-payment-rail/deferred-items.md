# Phase 88 — Deferred Items

Out-of-scope discoveries logged during execution. Do NOT fix in the discovering plan.

## 88-02 — pre-existing enum-casing offenders (NOT introduced here)
`pnpm db:audit-enum-casing` exits non-zero on 5 pre-existing snake_case values in
`packages/db/prisma/schema/idp-deprovisioning.prisma` (`ManualOverrideCategory`:
`verified_via_vendor_console`, `user_already_inactive`, `provider_endpoint_deprecated`,
`transient_provider_issue_resolved`, `other`) added in Phase 77 — present on base
commit dd67ff922. The 88-02 enum members ACH_NACHA / FEDWIRE are correctly
UPPER_SNAKE_CASE and are NOT flagged. Out of 88-02 scope (unrelated file); left for a
dedicated enum-casing remediation. Either rename to UPPER_SNAKE (+ data migration) or
add an explicit allowlist to scripts/audit-enum-casing.ts.

## 88-03 — pre-existing rbac-recipients.test.ts failure (NOT introduced here)
`packages/api/src/services/__tests__/rbac-recipients.test.ts` has 1 failing case
(`payroll_officer` resolves to `[]` where the matrix expects `payroll`-scoped actions).
Present on base commit `42f4412f5` and unrelated to the 88-03 withholding work (no RBAC
source touched). Out of 88-03 scope (SCOPE BOUNDARY); belongs to whoever owns the
payroll_officer role rollout. The 88-03 suites (payment-withholding, tax-rate.service,
tin-match, treaty-rate) are all green.
