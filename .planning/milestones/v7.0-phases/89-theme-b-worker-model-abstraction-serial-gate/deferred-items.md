# Phase 89 — Deferred / Out-of-Scope Items

Items discovered during execution that are NOT caused by this phase's changes and
are therefore left untouched (per the executor SCOPE BOUNDARY rule).

## Pre-existing `db:audit-enum-casing` offenders

`pnpm --filter @contractor-ops/db db:audit-enum-casing` exits non-zero on the
current tree due to 5 pre-existing lowercase enum values:

- `packages/db/prisma/schema/idp-deprovisioning.prisma:117-121` — enum
  `ManualOverrideCategory` (`verified_via_vendor_console`, `user_already_inactive`,
  `provider_endpoint_deprecated`, `transient_provider_issue_resolved`, `other`).

These predate Phase 89 (last touched by commit `6afe07244`, Phase 76). The new
`WorkerType` enum added in Plan 89-02 IS UPPER_SNAKE-compliant and is NOT an
offender. Not fixed here — unrelated file, out of scope.

_Discovered: Plan 89-02, Task 1._
