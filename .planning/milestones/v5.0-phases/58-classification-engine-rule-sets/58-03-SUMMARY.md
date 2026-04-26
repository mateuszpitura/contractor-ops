---
phase: 58
plan: 03
subsystem: api
tags: [classification, trpc, rbac, rate-limit, observability, pii, wave-3]
requires:
  - packages/classification (Plans 58-01 + 58-02 — getProfileForCountry, scoreAssessment, buildQuestionsSnapshot, outcomeSchema, getAnswerSchemaForType)
  - packages/db (Plan 58-01 — ClassificationAssessment model + ClassificationAssessmentStatus enum)
provides:
  - packages/api/src/routers/classification.ts (classificationRouter)
  - packages/api/src/middleware/classification-rate-limit.ts (classificationSaveAnswerRateLimit)
  - packages/api/src/middleware/observability.ts (LOG_BODY_EXCLUDE_PREFIXES + isBodyLoggingExcluded helpers)
  - packages/api/src/root.ts (appRouter.classification wired)
  - 36 green integration + middleware unit tests
affects:
  - packages/api/package.json (added @upstash/ratelimit, @contractor-ops/classification deps)
tech-stack:
  added:
    - "@upstash/ratelimit@^2.0.8"
  patterns:
    - "Idempotent createDraft — returns existing draft row instead of creating a duplicate (app-layer single-draft guard per D-04 because Prisma 7 lacks partial-unique filters)"
    - "Optimistic concurrency via expectedUpdatedAt (wall-clock comparison, not version counter) — matches the pattern used by legal + consent routers"
    - "Server-side scoring ONLY via profile.scoreAssessment() — never imports from profiles/*/scoring.ts directly (Pitfall 2 enforcement)"
    - "Sliding-window rate limit with Upstash Redis primary + in-memory fallback (mirrors apps/web/src/middleware.ts pattern)"
    - "Prefix-match log-body exclusion list (LOG_BODY_EXCLUDE_PREFIXES) — forward-compatible with Phase 59 classification.* procedures"
key-files:
  created:
    - packages/api/src/routers/classification.ts
    - packages/api/src/routers/__tests__/classification.test.ts
    - packages/api/src/middleware/classification-rate-limit.ts
    - packages/api/src/middleware/__tests__/classification-rate-limit.test.ts
  modified:
    - packages/api/src/middleware/observability.ts (added LOG_BODY_EXCLUDE_PREFIXES + isBodyLoggingExcluded)
    - packages/api/src/root.ts (wired classification: classificationRouter)
    - packages/api/package.json (added @upstash/ratelimit, @contractor-ops/classification)
key-decisions:
  - "Rate-limit constant is `let`-mutable via __resetClassificationRateLimitForTests so the 121-iteration test can run in <1s instead of timing out the suite — production default (120) is verified by SA-5b + a dedicated middleware unit test so the mutation never weakens the guarantee."
  - "Test suite clears UPSTASH_REDIS_REST_URL via vi.hoisted to force the in-memory fallback path; real Upstash calls would add 1s latency per saveAnswer and leak test traffic into production telemetry."
  - "Observability middleware does not currently inline `input`/`result` into log records, but the plan requires a grep-visible exclusion list so future consumers (including Phase 59 audit logs) have an authoritative sentinel to consult. Implemented as `LOG_BODY_EXCLUDE_PREFIXES` + `isBodyLoggingExcluded` helper — zero runtime cost, grep-asserted."
  - "listByContractor orders draft-first in JS (not SQL) because Prisma enum ordering is alphabetical — 'completed' sorts before 'draft' which is the opposite of the wizard's resume-first UX need."
  - "saveAnswer uses `.input(schema).use(rateLimit)` order so the rate-limit middleware receives the parsed input (assessmentId guaranteed). Reversing the order causes BAD_REQUEST because the middleware runs before .input() validates."
  - "RBAC gate uses existing `requirePermission({ contractor: ['update'] })` wrapper matching the contractor router's pattern — write procedures (submit, acknowledgeDisclaimer) are gated; reads (getDraft, getLatest, listByContractor) and the idempotent pre-flight createDraft are tenant-only (RESEARCH §Security Domain V4 default)."
  - "Added @contractor-ops/classification as a workspace dependency in packages/api/package.json — was previously unreachable from the api package."
requirements-completed:
  - CLASS-01
  - CLASS-11
requirements: [CLASS-01, CLASS-11]
duration: 45 min
completed: 2026-04-13
---

# Phase 58 Plan 03: Classification tRPC Router Summary

Wires the classification engine (Plans 01 + 02) into the tRPC surface. Plan 04's wizard UI and Plan 05's outcome pages consume these seven procedures via the standard `trpc` client. All writes authenticate through `tenantProcedure`; `submit` and `acknowledgeDisclaimer` additionally require `contractor:update`. Scoring is executed server-side inside `submit` and never leaks into client bundles.

**Duration:** ~45 min (2026-04-13T23:05Z → 2026-04-13T23:28Z).
**Tasks:** 1 consolidated task (rate-limit middleware + router + observability PII guard + tests).
**Files created:** 4 (router, router test, middleware, middleware test).
**Files modified:** 3 (root.ts, observability.ts, package.json).
**Tests added:** 36 green (30 router integration + 6 middleware unit).

## What Was Built

### Router — `packages/api/src/routers/classification.ts` (426 lines)

Seven procedures, all chained off `tenantProcedure`:

| Procedure | Gate | Purpose |
|-----------|------|---------|
| `createDraft` | tenant | Idempotent per-engagement pre-flight; returns existing draft or creates one. Resolves profile via `getProfileForCountry(assignment.contractor.countryCode)`. |
| `getDraft` | tenant | Fetch the current draft. Throws `PRECONDITION_FAILED` if `draft.ruleSetVersion` ≠ current profile version (Pitfall 7). |
| `saveAnswer` | tenant + rate-limit | Merge a single answer into `answers` JSONB. Zod-validates the payload per `question.answerType`. Optimistic concurrency via `expectedUpdatedAt`. Rejects writes on non-draft rows. |
| `submit` | tenant + `contractor:update` | Scores server-side via `profile.scoreAssessment()`, freezes `questionsSnapshot`, sets `status='completed'` + `completedAt` + `immutableAfter`. Re-submitting throws `CONFLICT` (D-04 append-only). |
| `acknowledgeDisclaimer` | tenant + `contractor:update` | Idempotent disclaimer ack on completed rows only; draft rows throw `CONFLICT`. |
| `getLatest` | tenant | Most recent completed assessment for an engagement, null if none. Re-parses outcome via `outcomeSchema` (Pitfall 12). |
| `listByContractor` | tenant | All assessments for a contractor, draft-first (in JS, not SQL — Prisma enum ordering is alphabetical). |

### Rate-limit middleware — `packages/api/src/middleware/classification-rate-limit.ts` (162 lines)

- Upstash Ratelimit (sliding window, 120/min) when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set.
- In-memory fallback (sliding window) for dev / tests — prevents network latency from polluting unit tests.
- Key format: `${organizationId}:${assessmentId}`.
- Exports `__resetClassificationRateLimitForTests(max?)` + `__getClassificationRateLimitMaxForTests()` for test-only mutations of the window size. Production default is pinned at 120 and independently asserted.
- Throws `BAD_REQUEST` if `assessmentId` is missing from input (defensive — should never happen behind Zod validation).

### Observability PII guard — `packages/api/src/middleware/observability.ts` (modified)

- New exports: `LOG_BODY_EXCLUDE_PREFIXES` (readonly string[]) + `isBodyLoggingExcluded(path)` helper.
- Prefix-match — `'classification.'` covers all seven current procedures and any future `classification.*` additions from Phase 59.
- Grep-asserted by the acceptance criteria. The existing observability middleware never logged `input`/`result` bodies, so no runtime behaviour change is needed today; this landing block is the policy sentinel future consumers consult before adding body capture.

## Test Coverage (36 green)

### Router integration tests (30) — `packages/api/src/routers/__tests__/classification.test.ts`

| Test ID | Assertion |
|---------|-----------|
| CD-1..2 | createDraft creates one draft per engagement; second call returns the same row |
| CD-3 | orgA cannot createDraft for orgB engagement (NOT_FOUND, not FORBIDDEN — V7 leakage-resistant) |
| CD-4 | Unsupported countryCode ('FR') throws UNSUPPORTED_MEDIA_TYPE |
| SA-1..4 | saveAnswer merges valid answers, rejects malformed Zod, rejects non-draft, rejects stale expectedUpdatedAt |
| SA-5 | Rate limit fires once the window is exceeded (uses max=5 for speed) |
| SA-5b | Production default is 120 calls/min (anchors the Pitfall 10 guarantee) |
| SB-1..5 | submit freezes snapshot + sets immutableAfter; engine errors → BAD_REQUEST; re-submit → CONFLICT; createDraft after submit creates new row (append-only per D-04); outcome round-trips through outcomeSchema |
| AD-1..3 | acknowledgeDisclaimer sets timestamp; idempotent re-ack; draft row rejected |
| GL-1..3 | getLatest returns most recent completed; null when only drafts; orgA cannot see orgB row |
| GD-1..2 | getDraft returns current draft; rule-set drift → PRECONDITION_FAILED |
| LC-1..3 | listByContractor returns draft-first then completed DESC; orgA sees empty list for orgB contractor |
| MT-1 | Explicit multi-tenant: orgB caller cannot read an orgA assessmentId via saveAnswer / submit / acknowledgeDisclaimer / getLatest |
| RBAC-1 + 1b | Missing `contractor:update` → FORBIDDEN on submit and acknowledgeDisclaimer |
| PII-1 | LOG_BODY_EXCLUDE_PREFIXES covers all classification.* paths and does NOT over-match tax./invoice. |
| PII-1b | saveAnswer with a distinctive sentinel string does not leak it into captured logs |

### Middleware unit tests (6) — `packages/api/src/middleware/__tests__/classification-rate-limit.test.ts`

Covers under-limit pass, over-limit block, sliding-window expiry (via `Date.now()` spy), per-assessment key isolation, missing-assessmentId BAD_REQUEST, and the 120/min production default.

*Note:* This middleware test file was pre-seeded (created by a parallel worker earlier in the session). Both test files share the same `__resetClassificationRateLimitForTests` / `__getClassificationRateLimitMaxForTests` helpers from the middleware, so there is no duplication — they test different surfaces (middleware in isolation + router integration).

## Verification

```bash
pnpm --filter @contractor-ops/api test -- classification
#  Test Files  2 passed (2)
#  Tests       36 passed (36)

cd packages/api && npx tsc --noEmit 2>&1 | grep "classification" | wc -l
#  0  — no type errors introduced by Plan 58-03
```

Grep acceptance checks (all pass):

```
grep -l 'classification: classificationRouter' packages/api/src/root.ts               → match
grep -cE 'tenantProcedure|contractorUpdateProcedure' …/classification.ts              → 10
grep -l 'PRECONDITION_FAILED' …/classification.ts                                     → match
grep -l 'immutableAfter: new Date' …/classification.ts                                → match
grep -l 'scoreAssessment' …/classification.ts                                         → match
grep -l 'buildQuestionsSnapshot' …/classification.ts                                  → match
grep -l 'orgA\|orgB\|cross-org' …/__tests__/classification.test.ts                    → match
grep -l 'TOO_MANY_REQUESTS' …/__tests__/classification.test.ts                        → match
grep -l 'rule-set\|ruleSetVersion' …/__tests__/classification.test.ts                 → match
grep -E 'profiles/(ir35|scheinselbstandigkeit)/scoring' …/classification.ts           → no match (Pitfall 2 enforced)
grep -cE "contractor: \['update'\]" …/classification.ts                               → 2 (submit + acknowledgeDisclaimer)
grep -E 'classification\.' …/middleware/observability.ts                              → match
```

## Deviations from Plan

- **[Deviation — adopted]** Plan body example used `.use(classificationSaveAnswerRateLimit).input(saveAnswerInput)` ordering. In tRPC v11 this runs the middleware BEFORE Zod parses the input, so the middleware sees undefined input. Swapped to `.input().use(…)` so the rate-limit middleware sees the parsed input (assessmentId guaranteed). Documented inline.
- **[Deviation — adopted]** Plan asked for `min_lines: 200` on the test file; actual: 1070 lines because the mock Prisma must simulate enough of the tenant extension for the cross-org leak test to be meaningful.
- **[Deviation — noted]** Plan asked to use `legal.test.ts` as a test-harness template (test DB + createCaller). Reality: legal.test.ts does NOT exist in this repo (file was never ported from the Phase 56 docs). Used `tax.test.ts` (mocked Prisma) as the canonical template instead — same `createCallerFactory(appRouter)` pattern, same mock shape. Upstream tax/legal/consent routers all use mocked Prisma; there is no real test-DB harness in packages/api. Honouring that reality rather than inventing one.
- **[Deviation — resolved]** Plan asked the rate-limit test to send 120 real calls + 1 overflow. At ~1s per call (Redis latency from leaked .env), this was untenable. Solution: vi.hoisted() deletes UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN before imports (forcing in-memory fallback), and the SA-5 test uses `__resetClassificationRateLimitForTests(5)` to shrink the window to 5. Production default of 120 is pinned by a dedicated SA-5b assertion and by the middleware unit test, so the shortcut does not weaken the guarantee.
- **[Deviation — resolved]** Plan asked to `pnpm --filter @contractor-ops/api add @upstash/ratelimit`. The repo-root `pnpm install` triggers a postinstall build that fails in `@contractor-ops/integrations` (pre-existing TS errors unrelated to Phase 58, same as flagged in 58-01 and 58-02 summaries). Worked around with `pnpm install --ignore-scripts` after editing `packages/api/package.json` directly.
- **[Deviation — adopted]** Observability middleware doesn't currently log request/response bodies. Plan's PII-1 test expected us to "assert a saveAnswer call with a distinctive rationale string does NOT leak that string into captured logs". The middleware never had that leak to begin with, so PII-1 verifies the sentinel list exists and PII-1b asserts the absence-of-leak under a concrete sentinel string. Both pass.

## Open Items for Downstream Plans

- **Plan 04 (wizard UI)** — consume `trpc.classification.{createDraft, getDraft, saveAnswer, submit}`. Handle `PRECONDITION_FAILED` by prompting the user to start a new assessment (rule-set drift). Handle `TOO_MANY_REQUESTS` by backing off autosave with a toast.
- **Plan 05 (outcome page + disclaimer dialog)** — read from `trpc.classification.{getLatest, listByContractor}`. The outcome page MUST render from `questionsSnapshot` (frozen on submit), NOT from the live rule-set, so historical assessments always show the exact wording the user saw. `profile.renderOutcome(assessment)` is the intended entry point (defined in Plan 02's profile classes).
- **Phase 59 (document chain + audit)** — `LOG_BODY_EXCLUDE_PREFIXES` + `isBodyLoggingExcluded` are available as the authoritative sentinel for any future classification-adjacent procedures. Extend the prefix list (not the procedure list) so the guard remains forward-compatible.
- **Deployment** — `@upstash/ratelimit` is now a direct dependency of `@contractor-ops/api`. Render deployment must have `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` set (already in `.env.example` — verify before the next prod deploy).

## Issues Encountered

- **Parallel-agent contention on `packages/api/src/middleware/observability.ts`** — a parallel session had already modified tenant.ts + api-key-auth.ts on `v2`. I only edited my specific sections (LOG_BODY_EXCLUDE_PREFIXES + helper) and staged only the files I owned. No conflicts; the commit hash is clean.
- **Pre-existing TS errors unrelated to Plan 58-03** — `packages/api` has 310+ pre-existing TS errors (contractor.ts, approval.ts, audit.ts, etc.) from the 1M-branch refactor. Plan 58-03 adds zero new type errors (verified by diffing tsc output with / without my changes).
- **Middleware test file pre-seeded** — `src/middleware/__tests__/classification-rate-limit.test.ts` already existed (written by a parallel worker). Both test files share the helper exports from the middleware, so the intended API contract held up even under parallel authorship.

## Next Phase Readiness

Plan 58-04 (wizard UI + i18n) and Plan 58-05 (outcome + disclaimer + tile + human-verify checkpoints) are both unblocked. Every procedure referenced in Plan 58-04's `<read_first>` and Plan 58-05's `<read_first>` is now callable from the tRPC client:

- `trpc.classification.createDraft({ contractorAssignmentId })` → draft row
- `trpc.classification.getDraft({ contractorAssignmentId })` → draft row or null (+ PRECONDITION_FAILED on drift)
- `trpc.classification.saveAnswer({ assessmentId, questionId, answer, expectedUpdatedAt? })` → updated draft
- `trpc.classification.submit({ assessmentId })` → completed row with outcome + snapshot
- `trpc.classification.acknowledgeDisclaimer({ assessmentId })` → updated completed row
- `trpc.classification.getLatest({ contractorAssignmentId })` → completed row or null
- `trpc.classification.listByContractor({ contractorId })` → draft-first DESC list

Ready for **Plan 58-04** (wizard UI, i18n, autosave) and **Plan 58-05** (outcome page + disclaimer dialog + contractor-profile tile + human-verify checkpoints).
