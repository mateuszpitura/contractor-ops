---
phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n
plan: 05
subsystem: api
tags: [dashboard, trpc, compliance-policy, expiry, payment-gate, COMPL-01, COMPL-04]

requires:
  - phase: 73-02
    provides: dashboard composite index + WaivedReasonCategory schema
  - phase: 72
    provides: assertContractorPaymentEligibility + PaymentRunComplianceCheck
provides:
  - compliance-dashboard query helpers (at-risk / upcoming-renewals / blocked-payments)
  - 4 read-gated dashboard tRPC queries (dashboardKpis + 3 lists)
  - defaultExpiryFromUploadDate + PolicyRule.expirySemantic (all 19 rules backfilled)
affects: [73-06, 73-07, 73-08]

tech-stack:
  added: []
  patterns:
    - "structural DashboardClient interface (Promise<unknown> returns + as-casts) to accept the tenant-extended Prisma client without the $on PrismaClient-union mismatch — mirrors PaymentGateClient"
    - "inline addDays() in the API package to avoid adding date-fns as a new api dependency"

key-files:
  created:
    - packages/api/src/services/compliance-dashboard.ts
  modified:
    - packages/api/src/routers/compliance/classification.ts
    - packages/api/src/services/__tests__/compliance-dashboard.test.ts
    - packages/compliance-policy/src/types.ts
    - packages/compliance-policy/src/expiry.ts
    - packages/compliance-policy/src/policies/{uk,de,pl,ksa,uae,us}.ts
    - packages/compliance-policy/src/__tests__/expiry-from-upload-date.test.ts

key-decisions:
  - "DashboardClient structural type (not typeof prisma | TransactionClient) — ctx.db is the tenant-extended client which lacks $on vs base PrismaClient; loose Promise<unknown> + as-casts avoid deep-generic instantiation (PaymentGateClient precedent)"
  - "inline addDays() rather than adding date-fns to packages/api deps (date-fns is not an api dependency; trivial date math)"
  - "expiry semantics use conservative defaults where the doc's true expiry is printed on the artefact (de.aufenthaltstitel 36mo, pl.udt 60mo, ksa.work_permit 12mo, uae.emirates_id 24mo) — each carries a `// TODO Phase 73 D-07 verify with legal` comment; contractor can override the auto-filled date"
  - "backfilled us.ip_assignment@v1 (us.ts) — the expiry-semantic-coverage test enumerates the full listPolicyRules() set"

patterns-established:
  - "dashboard helpers are pure `(db, organizationId)` functions, one indexed query each, no N+1"

requirements-completed: [COMPL-01, COMPL-04]

duration: 75 min
completed: 2026-06-01
---

# Phase 73 Plan 05: Admin Dashboard Data Layer + Upload-Replacement Expiry Auto-Fill Summary

**Five indexed compliance-dashboard query helpers wired into 4 read-gated tRPC queries, plus defaultExpiryFromUploadDate + PolicyRule.expirySemantic backfilled across all 19 registered rules — Wave 0 scaffolds GREEN.**

## Performance

- **Duration:** 75 min
- **Tasks:** 7
- **Files modified:** 12 (1 created)

## Accomplishments
- compliance-dashboard.ts: at-risk count/list, upcoming-renewals count/list, blocked-payments (live + 7-day historical merge, deduped, graceful-degrade)
- 4 tRPC queries (dashboardKpis + dashboardAtRisk/UpcomingRenewals/BlockedPayments), all `requirePermission(compliance:read)`
- PolicyRule.expirySemantic/expiryDays/expiryMonths (optional) + defaultExpiryFromUploadDate; 19 rules backfilled
- dashboard test 6 GREEN, expiry+coverage test 8 GREEN, full compliance-policy suite 34 GREEN; api typecheck 0

## Task Commits

1. **Tasks 73-05-01..07** - `431579ad` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Structural DashboardClient type instead of `typeof prisma | TransactionClient`**
- ctx.db (tenant-extended client) failed to assign to the base PrismaClient union ($on missing). Replaced with a structural interface (Promise<unknown> + as-casts), mirroring PaymentGateClient. Committed `431579ad`.

**2. [Rule 1 - Bug] Inline addDays, no date-fns api dependency**
- date-fns is not a packages/api dependency. Used a trivial inline addDays() rather than adding a dep.

**3. [Rule 1 - Bug] Real policyRuleIds + us.ts backfill**
- Plan template referenced non-existent IDs (uk.right_to_work@v3, uk.proof_of_address). Backfilled the ACTUAL 19 rules incl. us.ip_assignment@v1 (coverage test enumerates the full set). Contractor select uses real fields (legalName/displayName, not businessName).

---

**Total deviations:** 3 auto-fixed (3 Rule 1).
**Impact:** Required for typecheck + matching the real registry/schema. Conservative expiry defaults flagged for legal review (TODO comments). No scope creep.

## Issues Encountered
- None beyond the type-shape deviations above.

## User Setup Required
None.

## Deferred Verification
- `// TODO Phase 73 D-07 verify with legal` expiry defaults on de.aufenthaltstitel / pl.udt / ksa.work_permit_qiwa / uae.emirates_id — the document's true expiry is printed on the artefact; the auto-fill default is contractor-overridable.
- Plan 73-08 verifies the dashboard query uses the composite index via EXPLAIN.

## Next Phase Readiness
- 73-06 (admin dashboard UI) consumes dashboardKpis + the 3 list queries.
- 73-07 (portal upload form) consumes defaultExpiryFromUploadDate for the auto-filled expiresAt.

---
*Phase: 73-f1-compliance-admin-dashboard-portal-self-service-i18n*
*Completed: 2026-06-01*
