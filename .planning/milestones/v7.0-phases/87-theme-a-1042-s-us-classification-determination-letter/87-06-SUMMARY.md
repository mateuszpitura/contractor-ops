---
phase: 87-theme-a-1042-s-us-classification-determination-letter
plan: 06
subsystem: api
tags: [1099-k, cron, band-scan, us-tax, notifications, trpc, feature-flag, informational]

# Dependency graph
requires:
  - phase: 87-01
    provides: form-1099k-tracker.service RED scaffold test (bandFor1099K / updateTrackerBandState / informational-only invariant)
  - phase: 87-02
    provides: Form1099KTrackerState + Tax1099KThreshold Prisma models (tax-year-keyed $20,000 + 200)
provides:
  - Informational 1099-K band-scan service (SAFE/APPROACHING/OVER against the tax-year-keyed threshold, never files)
  - Daily cron handler gated on module.us-expansion (CRON_FORM_1099K_TRACKER_SCHEDULE) with flag short-circuit + Sentry-tagged catch
  - Read-only form1099kTracker.getTrackerState profile query (tenant-scoped, IDOR-guarded, us-expansion gated)
  - tax.form_1099k_approaching / tax.form_1099k_over notification types
affects: [87-phase-verification, us-tax-forms, contractor-profile-ui, wiki-synthesis]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Band-scan cron mirroring economic-dependency-scan (pure bandFor + pure transition + bounded pLimit(10) orchestrator + createCronLogger)"
    - "Tax-year-keyed threshold read from a Prisma config table, never a code constant"
    - "Read-only tRPC surface over cron-written state (the cron is the sole writer; the router never mutates)"

key-files:
  created:
    - packages/api/src/services/form-1099k-tracker.service.ts
    - apps/cron-worker/src/jobs/handlers/form-1099k-tracker.ts
    - apps/cron-worker/src/__tests__/form-1099k-tracker.test.ts
    - packages/api/src/routers/finance/form-1099k-tracker-router.ts
  modified:
    - packages/validators/src/notification.ts
    - apps/cron-worker/src/jobs/registry.ts
    - apps/cron-worker/src/env.ts
    - .env.example
    - packages/api/src/routers/finance/index.ts
    - packages/api/src/root.ts
    - packages/api/package.json
    - .planning/brain/wiki/domains/us-tax-forms.md
    - .planning/brain/wiki/structure/api-routers-catalog.md
    - .planning/brain/wiki/structure/cron-jobs.md

key-decisions:
  - "OVER requires BOTH the amount AND the transaction-count thresholds crossed (OBBBA federal 1099-K rule + the scaffold test's stated contract), not the plan action's 'either dimension'"
  - "Reminder cadence 30d + APPROACHING proximity factor 0.8, mirroring the economic-dependency §2 SGB VI scan"
  - "Notification copy is finalised English (kept as-is by dispatch), mirroring the economic-dependency sibling the plan says to mirror"

patterns-established:
  - "Informational-only tax surface: no filing/generate/transmit call path; asserted by a runtime export-name test"

requirements-completed: [US-CLASS-03]

# Metrics
duration: 22min
completed: 2026-07-01
---

# Phase 87 Plan 06: Informational 1099-K Threshold Tracker Summary

**A daily `module.us-expansion`-gated cron that sums each contractor's cumulative settled-USD payouts + transaction count, bands SAFE/APPROACHING/OVER against the tax-year-keyed $20,000 + 200 `Tax1099KThreshold`, fires a proactive heads-up on an up-crossing, and surfaces the band read-only for the profile — never filing a 1099-K.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-01T10:45:00Z
- **Completed:** 2026-07-01T11:07:00Z
- **Tasks:** 2 (both `type=auto`, Task 1 `tdd=true`)
- **Files modified:** 15 (4 created source, 7 modified source/config, 4 wiki)

## Accomplishments
- Turned the 87-01 RED scaffold `form-1099k-tracker.service.test.ts` GREEN (7/7): band transitions against the tax-year-keyed $20,000 + 200 config (not $5K/$600), same-band re-fire suppression via `lastReminderAt`, and the never-file invariant.
- `runForm1099KTrackerScan`: aggregates PAID/USD `PaymentRunItem` rows (run `completedAt` in the calendar tax year) per contractor, upserts `Form1099KTrackerState` keyed on `(contractorId, taxYear)`, and dispatches an up-cross / cadence heads-up via `resolveRbacRecipients` + `dispatch` — bounded `pLimit(10)`, `createCronLogger`, `metrics.gauge`.
- Cron handler mirrors `classification-economic-dependency`: `evaluate('module.us-expansion')` short-circuit → `CRON_SKIPPED_FLAG_OFF`, `runScan → { ok, durationMs, details }`, catch → `Sentry.captureException({ tags: { 'cron.job': 'form-1099k-tracker' } })`. Registered with `CRON_FORM_1099K_TRACKER_SCHEDULE` (env schema default `0 5 * * *` + `.env.example`).
- Read-only `form1099kTracker.getTrackerState`: band + cumulative payout + transaction count + tax-year threshold; `.strict()` Zod input, tenant IDOR guard on the contractor, per-request `assertUsExpansionEnabled`; mounted in `root.ts` via the `isUsExpansionRegistered()` conditional spread.
- Handler test (3/3): flag-off skip, success relay, throw → Sentry.

## Task Commits

1. **Task 1: band-scan service (TDD GREEN)** - `83f36bcc` (feat) — service + `tax.form_1099k_*` notification types; scaffold 7/7 green.
2. **Task 2: cron handler + registry + env + read router** - `01c17af0` (feat) — handler, registry/env wiring, `.env.example`, read router, `root.ts` mount, export subpath, handler test 3/3.
3. **Docs-follow-code: wiki** - `38417626` (docs) — `domains/us-tax-forms`, `structure/api-routers-catalog`, `structure/cron-jobs`, `wiki/log`.

_Task 1 is a TDD GREEN against the 87-01 RED scaffold; the RED `test(...)` commit landed in Plan 01 (no additional RED commit here)._

## Files Created/Modified
- `packages/api/src/services/form-1099k-tracker.service.ts` — pure `bandFor1099K` + `updateTrackerBandState` + `runForm1099KTrackerScan` orchestrator; informational only.
- `apps/cron-worker/src/jobs/handlers/form-1099k-tracker.ts` — flag-gated cron handler.
- `apps/cron-worker/src/__tests__/form-1099k-tracker.test.ts` — handler flag-off / success / throw coverage.
- `packages/api/src/routers/finance/form-1099k-tracker-router.ts` — read-only `getTrackerState`.
- `packages/validators/src/notification.ts` — `tax.form_1099k_approaching` / `_over` types.
- `apps/cron-worker/src/jobs/registry.ts`, `apps/cron-worker/src/env.ts`, `.env.example` — cron registration + `CRON_FORM_1099K_TRACKER_SCHEDULE`.
- `packages/api/src/routers/finance/index.ts`, `packages/api/src/root.ts`, `packages/api/package.json` — barrel export, conditional mount, `./services/form-1099k-tracker.service` subpath.
- `.planning/brain/wiki/{domains/us-tax-forms,structure/api-routers-catalog,structure/cron-jobs,log}.md` — docs-follow-code.

## Decisions Made
- **OVER = both dimensions crossed (AND).** OBBBA restored the pre-ARPA $20,000 **AND** 200-transaction 1099-K reporting threshold; a payee is only "over" when both legs are met. The scaffold test's own comment ("once both ... are crossed") agrees. `APPROACHING` is a proximity heads-up when either dimension reaches 80% of its threshold. This also aligns with the plan's `T-87-06-01` mitigation — a single-dimension "OVER" would falsely imply a reporting obligation.
- **English notification copy** (finalised strings kept as-is by `dispatch`), mirroring the `economic-dependency-scan` sibling the plan instructs to mirror (economic-dependency is the documented English exception vs the i18n-key reminder handlers).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Correctness] OVER band uses AND (both dimensions), not the plan action's "either dimension"**
- **Found during:** Task 1
- **Issue:** The plan action text said "OVER is at/above either dimension", but the OBBBA federal 1099-K reporting threshold — and the 87-01 scaffold test's stated contract ("is OVER once **both** the $20,000 and the 200-transaction thresholds are crossed") — require both. "Either" would falsely flag a payee as over the reporting threshold when only one leg is met.
- **Fix:** `bandFor1099K` returns OVER only when `amountRatio >= 1 && countRatio >= 1`; a single leg over (but not both) stays APPROACHING.
- **Files modified:** packages/api/src/services/form-1099k-tracker.service.ts
- **Verification:** All 7 scaffold assertions pass, including the OVER (both-crossed) and the "not-over on the stale $600 figure" cases.
- **Committed in:** 83f36bcc

**2. [Rule 3 - Blocking] Added two notification types to the validators registry**
- **Found during:** Task 1
- **Issue:** `dispatch` requires a `NotificationType` from `NOTIFICATION_TYPES`; there was no 1099-K heads-up type. Not in the plan's `files_modified`.
- **Fix:** Added `tax.form_1099k_approaching` + `tax.form_1099k_over` to `packages/validators/src/notification.ts`; typed `NOTIFICATION_TYPE_BY_BAND` against `NotificationType` (no `as any`).
- **Files modified:** packages/validators/src/notification.ts
- **Verification:** `pnpm typecheck --filter=@contractor-ops/api` green.
- **Committed in:** 83f36bcc

**3. [Rule 3 - Blocking] Declared the `./services/form-1099k-tracker.service` export subpath**
- **Found during:** Task 2
- **Issue:** `packages/api` uses an explicit `exports` map; the cron handler's `@contractor-ops/api/services/form-1099k-tracker.service` import fails to resolve without a declared subpath.
- **Fix:** Added the subpath entry (mirroring `economic-dependency-scan`).
- **Files modified:** packages/api/package.json
- **Verification:** `pnpm typecheck --filter=@contractor-ops/cron-worker` green.
- **Committed in:** 01c17af0

**4. [CLAUDE.md docs-follow-code] Wiki updated in the same change set**
- **Found during:** post-Task 2
- **Issue:** New cron + service + tRPC namespace require matching wiki per CLAUDE.md; `check:wiki-brain` also flagged `root.ts` newer than the routers catalog (which was already stale — missing the merged `form1042s`).
- **Fix:** Updated `domains/us-tax-forms` (tracker section + invariant + agent-mistake), `structure/api-routers-catalog` (US-expansion 1→3 namespaces), `structure/cron-jobs` (handler row), `wiki/log`; bumped `source_commit`; rebuilt the BM25 index.
- **Verification:** `pnpm check:wiki-brain` → 0 errors.
- **Committed in:** 38417626

**5. [Rule 2 - Missing coverage] Added the cron-worker handler test**
- **Found during:** Task 2
- **Issue:** The acceptance criterion asks to assert the flag short-circuit "if the harness supports it" — it does (`makeJobContext`).
- **Fix:** `form-1099k-tracker.test.ts` covers flag-off skip, success relay, and throw → Sentry-tagged capture.
- **Verification:** 3/3 green.
- **Committed in:** 01c17af0

---

**Total deviations:** 5 (1 correctness, 2 blocking, 1 docs-follow-code mandate, 1 added coverage)
**Impact on plan:** All within the plan's intent (mirror economic-dependency, tax-year-keyed threshold, us-expansion gating, never-file). No architectural change; the "either → both" fix makes the tracker legally accurate and safer against the flagged compliance threat.

## Issues Encountered
- `pnpm check:no-process-env` fails on **pre-existing** baseline sites (`apps/public-api/*`, etc.) — a repo-wide count ratchet. Confirmed my changed files add **zero** raw `process.env` (the cron var goes through the Zod env schema). Out of scope per SCOPE BOUNDARY; logged here, not fixed.
- The `pnpm --filter … test -- <name>` passthrough ran the full api suite; scoped subsequent runs by explicit test-file path (`vitest run <path>`) to stay fast and memory-safe.

## User Setup Required
None — `CRON_FORM_1099K_TRACKER_SCHEDULE` has a schema default (`0 5 * * *`); the whole surface stays dark until `module.us-expansion` is enabled in Unleash.

## Next Phase Readiness
- Tracker service + cron + read router shipped and typecheck-green; ready for the phase-87 verification pass.
- Follow-ups (not blockers): a contractor-profile UI hook/container over `form1099kTracker.getTrackerState`; optional i18n of the heads-up copy (currently English, matching the economic-dependency sibling); a `.planning/MEMORY.md` invariant at phase-close wiki synthesis.

## Self-Check: PASSED

All created files present (service, cron handler, handler test, read router, SUMMARY) and all task commits (`83f36bcc`, `01c17af0`, `38417626`) exist in the log.

---
*Phase: 87-theme-a-1042-s-us-classification-determination-letter*
*Completed: 2026-07-01*
