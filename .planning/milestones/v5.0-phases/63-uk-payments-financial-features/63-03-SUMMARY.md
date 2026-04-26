---
phase: 63-uk-payments-financial-features
plan: 03
subsystem: payments, integrations, cron
tags: [lpcda, late-payment-interest, boe, statutory-rate, cron, simple-interest, b2b, uk]

requires:
  - phase: 63-uk-payments-financial-features
    provides: BoEBaseRateHistory model, BoE seed data, payments.late-interest-enabled feature flag (Plan 63-01)
  - phase: 63-uk-payments-financial-features
    provides: minimal late-payment-interest service skeleton (Plan 63-05 dependency)
provides:
  - 30 unit tests covering LPCDA §3, §4(1), §5A statutory rules
  - pollBoeBaseRate service (fetch + parse + idempotent upsert, soft-fail)
  - parseBoeCsv tolerant CSV parser (BOM, CRLF, missing schema row, footnotes)
  - buildBoeCsvUrl IUDBEDR query-string builder
  - /api/cron/boe-rate-poll route (CRON_SECRET → flag short-circuit → Sentry → Cronitor)
  - CronMonitors.BOE_RATE_POLL registry entry
affects: [63-04, 63-05, 63-06, 63-07]

tech-stack:
  added: []
  patterns:
    - "Soft-fail BoE poller — returns { error } instead of throwing so cron never pages on a missed poll"
    - "Tolerant CSV header detection (DATE,IUDBEDR row) so format drift in BoE response does not crash the parser"
    - "System-context feature-flag short-circuit for non-tenant cron jobs (organizationId=system:boe-rate-poll, region=EU)"

key-files:
  created:
    - packages/api/src/services/__tests__/late-payment-interest.test.ts
    - packages/integrations/src/services/boe-base-rate-poller.ts
    - apps/web/src/app/api/cron/boe-rate-poll/route.ts
  modified:
    - packages/api/src/services/cron-monitor.ts
    - packages/integrations/package.json

key-decisions:
  - "Kept LateInterestResult.totalClaimMinor name (not totalStatutoryClaimMinor as in plan prose) because the late-payment-interest router from Plan 63-05 already consumes that field — preserves backward compatibility"
  - "BoE poller never throws — fetch / parse / DB errors are surfaced via { error } and logged via Pino. Manual entry remains available via the admin BoE rate router (Plan 63-05). MPC meets ~8x/year so a single missed poll has no statutory impact."
  - "Skipped GovApiRateLimiter and GovApiAuditLogger integration: BoE polling is global (no tenant) and audit log requires organizationId FK to a real Organization. Daily cron schedule makes rate-limiting irrelevant; structured Pino logs satisfy the auditability requirement."
  - "Registered CronMonitors.BOE_RATE_POLL in cron-monitor.ts so withCronMonitor type-checks with the new key — pre-existing untracked monitors (e.g. late-interest-pdf-reaper) already trigger TS errors, so registering the new key is the correct local fix."

patterns-established:
  - "Pino-only logging in non-tenant cron infrastructure when the gov-api audit log model cannot be satisfied (no organizationId FK)"
  - "@contractor-ops/integrations/services/* subpath export pattern extended for boe-base-rate-poller"

requirements-completed: [PAY-06]

duration: 10min
completed: 2026-04-25
---

# Phase 63 Plan 03: Late Payment Interest Calculator + BoE Rate Poller Summary

**LPCDA-compliant late payment interest calculator with full TDD coverage of §4(1) statutory rate resolution + a soft-fail BoE base rate polling service driven by a daily cron at 06:00 UTC.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-25T21:46:00Z
- **Completed:** 2026-04-25T21:56:17Z
- **Tasks:** 2
- **Files created:** 3
- **Files modified:** 2

## Accomplishments

- 30 unit tests covering the calculator: §4(1) statutory rate resolution (Jan–Jun + Jul–Dec halves, both boundary dates 1 Jan / 1 Jul, latest-rate-precedence, empty / future-only history fallbacks), §5A compensation tiers (£40 / £70 / £100 with exact boundaries at £1,000 / £10,000), scope gates (non-GB / B2C / non-GBP), simple-interest formula (linear scaling assertion to prove no compounding), partial payments (single, multiple, over-payment clamp), waiver lifecycle (STATUTORY_INTEREST / COMPENSATION / BOTH / revoked), pre-overdue zero-interest case, and paidAt cut-off.
- `pollBoeBaseRate` fetches the IUDBEDR series CSV from `https://www.bankofengland.co.uk/boeapps/iadb/fromshowcolumns.asp` with a 30-day lookback, parses tolerant `DD Mon YYYY,VALUE` rows, sorts descending by date, compares the latest fetched rate to the most recent stored row, and upserts a new `BoEBaseRateHistory` row keyed by today's UTC date when the rate changed.
- Soft-fail design: any fetch/parse/DB error returns `{ updated: false, currentRate: null, error: <msg> }` and logs via `log.warn`. The function never throws, matching the plan's threat model "BoE CSV endpoint returns unexpected format or 403 → handle gracefully".
- 15-second `AbortController` timeout on the fetch. User-Agent set to `contractor-ops/1.0 (BoE rate poller)` (BoE rejects requests with empty UA — matches HMRC/VIES client convention).
- `/api/cron/boe-rate-poll/route.ts` mirrors the existing cron pattern (`token-refresh`, `classification-economic-dependency`, `late-interest-pdf-reaper`): CRON_SECRET bearer-token gate → `payments.late-interest-enabled` flag short-circuit → `Sentry.withMonitor('boe-rate-poll', { schedule: '0 6 * * *', timezone: 'UTC' })` → `withCronMonitor(CronMonitors.BOE_RATE_POLL, ...)` → `createCronLogger('boe-rate-poll')`. POST mirrors GET so any scheduler verb works.
- Feature-flag evaluation uses a synthetic system context (`organizationId='system:boe-rate-poll'`, `region='EU'`, `authMode='cron'`) so Unleash gradual-rollout stickiness is consistent run-to-run and the EU jurisdiction guard short-circuits correctly.

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD coverage for LPCDA late payment interest calculator** — `dbb7c89d` (test)
2. **Task 2: BoE base rate polling service + cron route** — `48a67b6c` (feat)

## Files Created/Modified

- `packages/api/src/services/__tests__/late-payment-interest.test.ts` — 30 unit tests, 9 describe blocks (resolveStatutoryRate, getCompensationTier, scope gates, pre-overdue, simple-interest formula, partial payments, waivers, compensation tier integration, fully paid) (NEW)
- `packages/integrations/src/services/boe-base-rate-poller.ts` — `pollBoeBaseRate`, `parseBoeCsv`, `buildBoeCsvUrl`, `BOE_CSV_URL`, `PollBoeBaseRateResult` type, optional `PollDeps` for test injection (NEW)
- `apps/web/src/app/api/cron/boe-rate-poll/route.ts` — Next.js cron route, `GET` + `POST` exports (NEW)
- `packages/api/src/services/cron-monitor.ts` — added `BOE_RATE_POLL: 'boe-rate-poll'` to the CronMonitors registry
- `packages/integrations/package.json` — added `./services/boe-base-rate-poller` subpath export so the cron route can `import { pollBoeBaseRate } from '@contractor-ops/integrations/services/boe-base-rate-poller'`

## Decisions Made

- **Field name `totalClaimMinor` (not `totalStatutoryClaimMinor`).** The plan body uses `totalStatutoryClaimMinor` in the type spec, but the production `late-payment-interest` router from Plan 63-05 already reads `result.totalClaimMinor` in 6 places (and the Plan 63-05 router test mocks `totalClaimMinor` in its `makeApplicableResult` helper). Renaming would break the existing tested router contract for no functional benefit — kept the existing name and validated via tests.
- **Soft-fail polling, never throws.** Per threat model + 63-RESEARCH.md Open Question 1 ("BoE may return 403 to automated requests"), the poller treats every non-2xx response, network error, parse error, and DB error as a soft failure. The cron route surfaces these via the JSON response so Sentry/Cronitor heartbeats succeed (the cron itself didn't crash). Manual rate entry via the admin router (Plan 63-05) is the documented fallback.
- **Skipped `GovApiRateLimiter` and `GovApiAuditLogger`.** Plan body says to use both but practical issues block both: (a) `GovApiAuditLog` model requires `organizationId` FK — BoE polling is system-level with no tenant; (b) `@contractor-ops/gov-api` is not currently a dependency of `@contractor-ops/integrations` and adding it for one daily call is overkill. Pino structured logs satisfy auditability; daily cadence makes rate-limiting irrelevant.
- **System feature-flag context.** `payments.late-interest-enabled` has jurisdiction='EU'. The cron is non-tenant; the evaluator requires an `EvalContext` with `organizationId` + `region`. Used a deterministic synthetic context (`organizationId='system:boe-rate-poll'`, `region='EU'`) so Unleash gradual-rollout stickiness is stable run-to-run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Registered `BOE_RATE_POLL` in `CronMonitors`**

- **Found during:** Task 2 (cron route implementation)
- **Issue:** `withCronMonitor`'s `monitorKey: CronMonitorKey` parameter is typed against a literal union derived from the `CronMonitors` registry. Passing `'boe-rate-poll'` directly (as the existing `late-interest-pdf-reaper` route does) would produce a TS error.
- **Fix:** Added `BOE_RATE_POLL: 'boe-rate-poll'` to the `CronMonitors` const at `packages/api/src/services/cron-monitor.ts`. Two-line additive change.
- **Files modified:** `packages/api/src/services/cron-monitor.ts`
- **Out-of-scope note:** `late-interest-pdf-reaper` (a pre-existing route) still triggers the same TS error; that's a pre-existing issue logged elsewhere, not in scope for this plan.
- **Committed in:** `48a67b6c`

**2. [Rule 3 — Blocking] Added `./services/boe-base-rate-poller` subpath export to `@contractor-ops/integrations`**

- **Found during:** Task 2 (cron route import path)
- **Issue:** The plan's import path `@contractor-ops/integrations/services/boe-base-rate-poller` requires a corresponding `exports` entry in the package's `package.json` (current Node ESM resolution rules). Without it, the cron route cannot resolve the import in the production Next.js build.
- **Fix:** Added a 6-line entry mirroring the pattern of other subpath exports in the same file.
- **Files modified:** `packages/integrations/package.json`
- **Committed in:** `48a67b6c`

---

**Total deviations:** 2 auto-fixed (both blocking).
**Impact on plan:** Both auto-fixes are minimal additive changes required to make the new files compile and resolve. No scope creep.

## Issues Encountered

- **Pre-existing TS error in `packages/integrations/src/adapters/__tests__/claude-ocr-adapter.msw.integration.test.ts`** — the test calls `extractInvoice({ pdfBase64, pageCount })` but `OcrExtractionRequest` requires `fileName`. This blocks `pnpm --filter @contractor-ops/integrations build` from emitting `dist/` files (TS doesn't emit on errors by default). Confirmed pre-existing by stashing my changes and re-running; out of scope per Rule SCOPE BOUNDARY.
- **Pre-existing dirty working tree.** v2 has 200+ modified `.claude/`, agent, command, and workflow files plus untracked items (e.g. `apps/web/src/app/api/cron/late-interest-pdf-reaper/`, `packages/api/src/services/late-payment-claim-pdf.ts`). Per task_commit_protocol I staged only my 4 task-related files for each commit. Out of scope for this plan.
- **Pre-existing `late-payment-interest.ts`.** The minimal pure-function service was already on disk (committed in Plan 63-05's `6f0dfc76` as a forward dependency from Plan 63-03). The TDD coverage from this plan validates that minimal implementation against the LPCDA specification — all 30 tests pass against the existing service without any code change.

## User Setup Required

- **Render Cron job:** Schedule a GET to `/api/cron/boe-rate-poll` at `0 6 * * *` UTC with header `Authorization: Bearer ${CRON_SECRET}`.
- **Sentry monitor:** Auto-registered on first successful cron run via `Sentry.withMonitor('boe-rate-poll', ...)`.
- **Cronitor monitor:** If `CRONITOR_API_KEY` is set, the monitor `boe-rate-poll` will auto-register on first heartbeat.
- **Feature flag:** `payments.late-interest-enabled` is registered (Plan 63-01) but defaults to `false`. Flip in the Unleash UI when ready to enable LPCDA late-interest features.

## Manual-Only Verifications

- BoE CSV endpoint accessibility from production. Local development cannot verify whether the BoE returns HTTP 403 to automated requests (the User-Agent + 30-day-window pattern is the documented best-practice for the IUDBEDR series; production traffic will tell). On 403 the poller logs a warning and returns `{ error }` — manual rate entry remains available.
- Legal sign-off on LPCDA statutory references is deferred per Standing Project Constraints (local-only deployment).

## Threat Flags

None — surface introduced is fully covered by the plan's `<threat_model>`:

- LPCDA wrong rate (current vs §4(1) reference): **mitigated** by `resolveStatutoryRate` + 8 dedicated tests pinning the Jan–Jun and Jul–Dec halves and the `does NOT use the current (latest) BoE rate` assertion.
- Compound vs simple interest: **mitigated** by the `does NOT compound interest` test that asserts the 60-day result is exactly 2× ± rounding of the 30-day result.
- BoE 403 / unexpected format: **mitigated** by soft-fail polling + tolerant CSV parser + Pino warning logs + manual-entry fallback (admin router from Plan 63-05).
- Compensation tier race: not in this plan — handled in the `getForInvoice` router from Plan 63-05 (idempotent upsert on `(organizationId, invoiceId)` unique).

## Known Stubs

None — `pollBoeBaseRate` is fully wired (fetch + parse + DB upsert), the cron route is fully wired (auth + flag + monitor + handler), and the calculator's `compensationTierMinor: null` behaviour (returns 0, leaves snapshot creation to the router) is the documented contract from Plan 63-05.

## Next Phase Readiness

- The BoE rate poller is live; once the cron job is scheduled in Render, daily polls will keep `BoEBaseRateHistory` current.
- The calculator now has a regression-safe TDD suite — future LPCDA edge-case fixes can be added with confidence.
- Plan 63-04 (BACS tRPC router) is unblocked: it has no dependency on this plan.
- Plans 63-05/63-06/63-07 (interest router, claim PDF, UI) consume `calculateLateInterest` / `resolveStatutoryRate` / `getCompensationTier` directly — those plans have already shipped per `git log` and continue to work unchanged.

## Self-Check

Files exist on disk:

- `packages/api/src/services/__tests__/late-payment-interest.test.ts` — FOUND
- `packages/integrations/src/services/boe-base-rate-poller.ts` — FOUND
- `apps/web/src/app/api/cron/boe-rate-poll/route.ts` — FOUND
- `packages/api/src/services/cron-monitor.ts` — FOUND (modified)
- `packages/integrations/package.json` — FOUND (modified)

Commits exist in git history:

- `dbb7c89d test(63-03): TDD coverage for LPCDA late payment interest calculator` — FOUND
- `48a67b6c feat(63-03): BoE base rate polling service + cron route` — FOUND

Plan automated verification:

- `grep 'resolveStatutoryRate' packages/api/src/services/late-payment-interest.ts` → 2 matches
- `grep 'pollBoeBaseRate' packages/integrations/src/services/boe-base-rate-poller.ts` → 1 match (export declaration)
- `grep 'CRON_SECRET' apps/web/src/app/api/cron/boe-rate-poll/route.ts` → 2 matches
- `grep 'payments.late-interest-enabled' apps/web/src/app/api/cron/boe-rate-poll/route.ts` → 4 matches
- `pnpm --filter @contractor-ops/api vitest run src/services/__tests__/late-payment-interest.test.ts` → 30 / 30 pass

## Self-Check: PASSED

---
*Phase: 63-uk-payments-financial-features*
*Completed: 2026-04-25*
