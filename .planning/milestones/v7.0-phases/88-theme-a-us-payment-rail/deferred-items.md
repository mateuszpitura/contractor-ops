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

## 88-06 — pre-existing check:no-process-env ratchet drift (NOT introduced here)
`pnpm check:no-process-env` reports 184 raw `process.env` reads vs a committed baseline of
182 (`scripts/.process-env-ratchet.json`). The +2 drift is present on base commit
`4da605fe8` — none of the 88-06 changed files contain `process.env` (verified via
`git diff <base> -- '*.ts' | grep '^+.*process.env'` → empty). The 88-06 integrations
adapters read provider keys only through the existing `credential-service.getProviderEncryptionKey`
dynamic per-slug path (no new raw env access), and the payout-init procedure adds none.
Out of 88-06 scope (SCOPE BOUNDARY); belongs to whoever introduced the two new call sites
on the base branch. Either migrate them to a package env schema and re-run the ratchet in
tighten mode, or bump the baseline in the same change set that legitimises them.
