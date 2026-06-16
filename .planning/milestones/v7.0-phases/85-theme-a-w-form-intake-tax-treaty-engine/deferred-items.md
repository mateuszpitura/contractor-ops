# Phase 85 — Deferred / Out-of-Scope Items

Discoveries logged during execution that are outside the current task's scope.
Per the executor scope boundary, only issues DIRECTLY caused by this plan's changes
are auto-fixed; pre-existing offenders in untouched files are recorded here, not fixed.

## Plan 85-01

- **Pre-existing enum-casing offenders** — `db:audit-enum-casing` flags 5 values on
  `enum ManualOverrideCategory` in `packages/db/prisma/schema/idp-deprovisioning.prisma`
  (lines 117-121: `verified_via_vendor_console`, `user_already_inactive`,
  `provider_endpoint_deprecated`, `transient_provider_issue_resolved`, `other`).
  These are lower_snake, not UPPER_SNAKE. The file is UNMODIFIED by this plan
  (introduced in Phase 76). The two new enums added here (`TaxFormType`,
  `TaxFormStatus`) are correct UPPER_SNAKE and are NOT in the offender list.
  Fixing `ManualOverrideCategory` would be a value rename + data migration on an
  unrelated domain — out of scope for 85-01.
