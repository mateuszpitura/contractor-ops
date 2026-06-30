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
