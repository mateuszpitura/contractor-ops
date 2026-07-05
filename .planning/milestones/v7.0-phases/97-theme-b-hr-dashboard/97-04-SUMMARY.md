# 97-04 SUMMARY — document-expiry (section-grained) + probation watchlist

**Wave:** 3 · **Status:** done · delivered in the same backend commit as 97-03.

## What landed
- **`services/hr-dashboard-doc-expiry.ts`** — pure `deriveEmployeeDocExpiry(docs, now)` composing the v6.0 F1 engine the honest
  way: it runs `@contractor-ops/compliance-policy` `daysUntilExpiryInTz` (NOT the contractor-only `compliance-reminder-scan`)
  over `PersonnelFileDocument.expiresAt` rows, TZ resolved from `PersonnelFile.countryCode` via `tzForCountry` (a per-jurisdiction
  map mirroring the policy rule TZs). Bands expired/30/60/90/later; null `expiresAt` excluded.
- **`hrDashboard.getDocumentExpiry`** (HR-DASH-03) — reads the org's expiring docs joined to `PersonnelFile.countryCode` + the
  worker displayName, then **filters each row by `hasSectionPermission(ctx, section)`** before deriving bands (C7 — payroll_officer
  sees only section C, leave_approver only A). A null (unclassified) section is shown only to a caller who can read ALL four sections.
- **`services/hr-dashboard-probation.ts`** — pure `deriveProbationWatchlist(rows, now)` bucketing `probationEndsAt` into 14/7/0
  at the TZ start-of-day boundary; >14 days excluded.
- **`hrDashboard.getProbationWatchlist`** (HR-DASH-04) — a read-only date-window over the indexed `EmployeeProfile.probationEndsAt`
  (`gte startOfToday, lte +14d`, TERMINATED excluded). No reminder cron in v7.0 (D-03 / Deferred).

## Verification
- Section grain proven by `hr-dashboard-section-grain.test.ts` (the exact `hasSectionPermission` matrix the filter uses).
- Doc-expiry bands + probation buckets proven by the pure-service tests. `pnpm typecheck --filter=@contractor-ops/api` green.
