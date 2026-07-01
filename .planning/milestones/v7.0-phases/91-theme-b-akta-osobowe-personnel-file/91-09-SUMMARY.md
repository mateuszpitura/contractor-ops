---
phase: 91-theme-b-akta-osobowe-personnel-file
plan: 09
subsystem: personnel-file
tags: [personnel-file, akta-osobowe, gdpr, rodo, erasure, retention, statutory-hold, audit, soft-delete]

# Dependency graph
requires:
  - phase: 91-01
    provides: personnel-erasure.test.ts RED scaffold (per-section disposition + fullErasureClaimed + retained-under-statute audit contract)
  - phase: 91-03
    provides: per-jurisdiction section+rule registry (getPersonnelRetentionRules, mapCountryCodeToJurisdiction)
  - phase: 91-05
    provides: getPersonnelRetentionCutoff event-anchored resolver (erasable / retainUntil / citation)
  - phase: 91-07
    provides: personnelFile router foundation + empty erasureRouter stub merged via index.ts
provides:
  - personnelFile.requestErasure({ workerId }) -> { workerId, fullErasureClaimed, sections[] } with per-section erased/retained dispositions
  - Legally-honest never-over-claim invariant (fullErasureClaimed = retained.length === 0) + per-employee/per-section/per-jurisdiction statutory-hold audit
  - PERSONNEL_FILE_NOT_FOUND error constant
affects: [web-vite personnel-file erasure surface, 91-12 wiki synthesis]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-employee RODO erasure lifts the gdpr org/model statutory-hold idiom to per-employee + per-section + per-jurisdiction: resolve each section's cutoff, erase past-window sections (soft-delete their docs), retain in-window sections with citation + retainUntil"
    - "fullErasureClaimed is the plain fact retained.length === 0 — never true while any hold is active (criterion #3 verbatim-locked)"
    - "The retained-under-statute audit joins the erasure transaction (tx-passed writeAuditLog) so the audit row and the soft-deletes commit or roll back together; allowAuditPurge stays exclusive to the org-grain GDPR path"

key-files:
  created: []
  modified:
    - packages/api/src/routers/core/personnel-file/erasure.ts
    - packages/api/src/errors.ts
    - packages/api/src/__tests__/personnel-erasure.test.ts

key-decisions:
  - "Erasure disposition keys off the resolver's `erasable` field, not the plan's literal 'retainUntil non-null AND now >= retainUntil' parenthetical: a section with NO statutory rule (US SECTION_B/C/D) has retainUntil null yet MUST be erasable — the resolver documents empty-rule as erasable, and treating null-retainUntil as retained would wrongly hold no-rule sections forever and break the all-erased assertion."
  - "resourceType 'USER' for the audit row — the writeAuditLog AuditEntityType union carries no WORKER/EMPLOYEE/PERSONNEL_FILE literal, and extending it is outside this plan's file scope; the worker is a person, resourceId = workerId keeps the employee grain."
  - "Extended the 91-01 personnel-erasure test MOCK (never its assertions), mirroring 91-07's Rule-3 precedent: the committed mock returns one shared record for both fixtures and omits getPersonnelRetentionCutoff, so no erasure.ts could make it GREEN. Made findFirst worker-aware, gave both files US + relative I-9 dates, and supplied a faithful getPersonnelRetentionCutoff to the db mock."

requirements-completed: [AKTA-03]

# Metrics
duration: ~25min
completed: 2026-07-01
---

# Phase 91 Plan 09: Personnel-File Erasure Sub-Router Summary

**A per-employee `personnelFile.requestErasure` that resolves each of the four sections against its per-jurisdiction statutory window, erases only past-window sections (soft-deleting their documents) while retaining in-window sections with their statutory citation + retainUntil, and NEVER claims full erasure while any hold is active (`fullErasureClaimed = retained.length === 0`) — auditing every retention-blocked erasure in the same transaction; turns the 91-01 erasure test GREEN (3/3).**

## Performance
- **Duration:** ~25 min (incl. fresh-worktree `pnpm install`; turbo cache hit so classification built clean this run)
- **Completed:** 2026-07-01
- **Tasks:** 1 (1 atomic feat commit)
- **Files:** 3 modified (erasureRouter stub filled; error constant added; test mock extended)

## Accomplishments
- `requestErasure({ workerId })` (erasure.ts): `tenantProcedure` gated by `requirePermission({ employee: ['delete'] })`, strict Zod input, `assertWorkforceEnabled`. Loads the `PersonnelFile` via a tenant-scoped `findFirst { workerId, organizationId, deletedAt: null }` — a missing/cross-org worker throws `NOT_FOUND` (no existence oracle, mitigates the IDOR threat).
- Per-section decision: for each of `SECTION_A..D` it reads the section's rules via `getPersonnelRetentionRules(jurisdiction, section)`, resolves a representative document date from the section's own rows (latest of `documentDate ?? Document.createdAt`, for DOCUMENT_DATE-anchored windows), and calls `getPersonnelRetentionCutoff`. `erasable` → soft-delete the section's `PersonnelFileDocument` rows (the windowed hard purge stays the data-purge cron's job) and record `'erased'`; otherwise record `'retained'` with the resolver's citation + (finite) retainUntil.
- **Never-over-claim invariant (criterion #3, verbatim-locked):** `fullErasureClaimed` is the plain fact `Object.keys(retained).length === 0` — true only when zero sections are held; even a single in-window section makes it false.
- **Never-repudiable audit:** when any section is retained, `writeAuditLog` writes `action: 'personnel_file.erasure_retained_under_statute'` with `metadata.retainedUnderStatute = { section → citation }`, passing `tx` so the audit row joins the erasure transaction. `allowAuditPurge` is NOT touched — it stays exclusive to the org-grain GDPR path.
- `PERSONNEL_FILE_NOT_FOUND = 'personnelFileNotFound'` added to `errors.ts` (satisfies the i18n-system-messages biome gate — no hardcoded TRPCError message).
- `personnel-erasure.test.ts` GREEN 3/3 (partial-hold → fullErasureClaimed false + retained-with-citation-and-retainUntil + some erased; audit fired; all-past-window → fullErasureClaimed true, every section erased).

## Task Commits
1. **Task 1 — requestErasure per-section dispositions + never-over-claim audit** — `a50ca634a` (feat)

**Plan metadata:** this SUMMARY committed separately at the real milestones path.

## Files Created/Modified
- `packages/api/src/routers/core/personnel-file/erasure.ts` — filled the stub with `erasureRouter.requestErasure` + `representativeDocumentDate` / `toDisposition` / `auditRetainedUnderStatute` helpers (helpers extracted to keep the mutation under the cognitive-complexity ceiling).
- `packages/api/src/errors.ts` — `PERSONNEL_FILE_NOT_FOUND` constant.
- `packages/api/src/__tests__/personnel-erasure.test.ts` — mock-only extension (assertions untouched): worker-aware `personnelFile.findFirst`, US country + relative I-9 dates on both fixtures, and a faithful `getPersonnelRetentionCutoff` supplied to the `@contractor-ops/db` mock.

## Decisions Made
- **Disposition keys off `cutoff.erasable`, not the plan's parenthetical.** US `SECTION_B/C/D` carry no federal window → the resolver returns `erasable: true, retainUntil: null`; treating null-retainUntil as "retained" (the plan's literal `retainUntil non-null AND now >= retainUntil`) would hold no-rule sections forever and break the all-erased assertion. The resolver's `erasable` field is the honest source and matches criterion #3.
- **`resourceType: 'USER'` for the per-employee audit.** The `writeAuditLog` `AuditEntityType` union has no WORKER/EMPLOYEE/PERSONNEL_FILE literal; extending it is outside this plan's file scope. The worker is a person and `resourceId = workerId` preserves the per-employee grain.
- **US is the partial-hold jurisdiction.** Only US mixes rules across sections (SECTION_A = two-anchor I-9 `max(hire+3y, term+1y)`; B/C/D = no window), which is exactly what a partial hold needs; PL/DE/UK apply the same rule to every section (all-retained). The held fixture's I-9 window is anchored relative to "now" (future), the erasable fixture's is long past, so the suite is wall-clock-robust.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended the 91-01 erasure test MOCK so the two fixtures resolve distinct dispositions**
- **Found during:** Task 1 (running the scaffold).
- **Issue:** The committed mock's `personnelFile.findFirst` ignores its `where` (returns `collection[0]` for BOTH workers), and the `@contractor-ops/db` mock omits `getPersonnelRetentionCutoff` entirely. With identical data the two suites are mutually contradictory (one needs a partial hold, the other full erasure), and the router would call `undefined(...)`. No `erasure.ts` could make it GREEN.
- **Fix:** Made `personnelFile.findFirst` resolve by `where.workerId`; gave both files `countryCode: 'US'` + relative hire/termination dates (held = future I-9 window, erasable = past); supplied a faithful, dependency-free port of `getPersonnelRetentionCutoff` to the db mock (the pure resolver carries no Prisma import, so a live client is never constructed). **No assertion changed.** Mirrors 91-07's Rule-3 precedent of extending the RED scaffold mocks.
- **Files:** `packages/api/src/__tests__/personnel-erasure.test.ts`
- **Commit:** `a50ca634a`

**2. [Rule 3 - Blocking] Added PERSONNEL_FILE_NOT_FOUND constant + refactored to satisfy biome gates**
- **Found during:** Task 1 verification (`biome check`, the pre-commit lint-staged path).
- **Issue:** The hardcoded `TRPCError` message tripped the i18n-system-messages plugin (error), and the inline transaction body exceeded the cognitive-complexity ceiling (21 > 15).
- **Fix:** Added `PERSONNEL_FILE_NOT_FOUND` to `errors.ts` and threw it; extracted `toDisposition` + `auditRetainedUnderStatute` helpers to drop the mutation's complexity below the ceiling. No behavior change.
- **Files:** `packages/api/src/errors.ts`, `packages/api/src/routers/core/personnel-file/erasure.ts`
- **Commit:** `a50ca634a`

**Total:** 2 auto-fixed (both Rule 3 blocking). No architectural (Rule 4) decisions.

## Deferred / Out of Scope
- **Pre-existing `lint:no-breadcrumbs` offenders (NOT this plan):** 3 decision-ID comments in `pdf-templates/__tests__/us-determination-letter.test.tsx`, `services/__tests__/form-1042s.service.test.ts`, `services/__tests__/form-1099k-tracker.service.test.ts` — the documented `deferred-items.md` (91-04) offenders. My 3 files are breadcrumb-clean.
- **i18n translation leaves for `personnelFileNotFound`:** the error constant is the code-side gate; adding `messages/*.json` leaves for 4 locales is a web-vite surface batched with the personnel-file UI, not this API plan.
- **Wiki synthesis:** the personnel-file erasure surface is batched into the phase's dedicated wiki plan (91-12), matching 89-06 / 91-03..07. New/changed source here is not referenced by any wiki `verify_with`, so `check:wiki-brain` is not tripped.

## Known Stubs
None — `requestErasure` is fully wired and exercised by the GREEN test; no placeholder data paths.

## Threat Flags
None — all new surface is in the plan's `<threat_model>` and mitigated: over-claim (T-91-09-01) by `fullErasureClaimed = retained.length===0` + per-section citations + audit; early erasure (T-91-09-02) by the per-section resolver gate + soft-delete-only; audit tampering (T-91-09-03) by leaving `allowAuditPurge` exclusive to the GDPR path; IDOR (T-91-09-04) by tenant-scoped `findFirst` → `NOT_FOUND` + `employee:delete`.

## Verification
- `pnpm --filter @contractor-ops/api test personnel-erasure.test.ts` — GREEN 3/3.
- `pnpm --filter @contractor-ops/api typecheck` — clean (exit 0; no classification cascade this run — it built via turbo cache).
- `pnpm lint:audit-log` — OK (no direct `auditLog.create`; routes through `writeAuditLog`). `pnpm lint:logs` — OK. `pnpm lint:no-breadcrumbs` — my 3 files clean (only the pre-existing offenders remain). `biome check` — clean.

## Next Phase Readiness
- **web-vite personnel-file surface:** `personnelFile.requestErasure` returns `{ workerId, fullErasureClaimed, sections: [{ section, disposition, citation?, retainUntil? }] }` — ready for an erasure-request panel that shows per-section held/erased state and the statutory citations.
- **91-12 wiki synthesis:** document the erasure disposition contract + the never-over-claim invariant + the per-employee statutory-hold audit.

## Self-Check: PASSED
- `packages/api/src/routers/core/personnel-file/erasure.ts` — FOUND (filled, exports `erasureRouter.requestErasure`, contains `fullErasureClaimed`).
- Commit `a50ca634a` (Task 1 feat) — FOUND.
- `personnel-erasure.test.ts` — GREEN 3/3; api typecheck clean.
- No STATE.md / ROADMAP.md edits; only erasure.ts + errors.ts + the erasure test touched (classify.ts / root.ts untouched).

---
*Phase: 91-theme-b-akta-osobowe-personnel-file*
*Completed: 2026-07-01*
