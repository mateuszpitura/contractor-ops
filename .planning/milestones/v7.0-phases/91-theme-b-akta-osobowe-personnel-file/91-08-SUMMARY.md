---
phase: 91-theme-b-akta-osobowe-personnel-file
plan: 08
subsystem: api
tags: [personnel-file, akta-osobowe, trpc, classifier, audit, rbac, pending-review, gdpr]

# Dependency graph
requires:
  - phase: 91-06
    provides: classifyPersonnelDocument hybrid classifier + defaultEvaluateKillSwitch + PersonnelClassifierSeams / PersonnelClassificationResult contract
  - phase: 91-07
    provides: personnel-file router foundation (empty classifyRouter stub, section-access gate, mergeRouters index, root.ts mount)
  - phase: 91-02
    provides: PersonnelFile / PersonnelFileDocument Prisma models + PersonnelFileSection / PersonnelDocClassificationMethod enums
provides:
  - classifyRouter.attachDocument — links a persisted, virus-scanned Document into a worker's personnel file and routes it via the hybrid classifier (deterministic/AI → filed ACTIVE; ambiguous → PENDING_REVIEW), never blocking the upload
  - classifyRouter.classifyApprove / classifyReject — admin classify-step (section MANUAL + Document ACTIVE, or Document ARCHIVED) each audited in-tx, gated by compliance:override
  - classifyRouter.pendingReviewQueue — org-scoped list of PENDING_REVIEW personnel documents projected for the admin UI
  - errors.ts personnel classify keys (PERSONNEL_FILE_NOT_FOUND, PERSONNEL_FILE_DOCUMENT_NOT_FOUND, PERSONNEL_DOCUMENT_ALREADY_ATTACHED, PERSONNEL_DOCUMENT_NOT_PENDING_REVIEW)
affects: [91-09 erasure sub-router, 91-12 wiki synthesis, web-vite personnel-file classify UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Attach-then-classify: the Document (bytes) is already persisted by the upload path; the personnel-file link + classification are written in one audited transaction, and any classifier failure degrades to the admin queue (never throws, never blocks the upload)"
    - "Injected AI seam composed at the router: attach wires classifyPersonnelDocument with defaultEvaluateKillSwitch + a classifyWithClaude seam; the deterministic + kill-switch paths run synchronously, the AI-eligible tail degrades to admin review until the concrete Claude Vision adapter lands"
    - "Admin PENDING_REVIEW approve/reject mirrors compliance-admin: org+status gate before mutate, auditedMutation in-tx, closed-enum reject reason, section from a closed enum (server-set status, never client)"

key-files:
  created: []
  modified:
    - packages/api/src/routers/core/personnel-file/classify.ts
    - packages/api/src/errors.ts

key-decisions:
  - "Composed against the ACTUAL 91-06 classifier signature ({ jurisdiction, documentType, storageKey, organizationId, region }, seams) — not the plan's proposed { personnelFileDocumentId, countryCode, documentId } shape — per 91-06's Next Phase Readiness. Resolved jurisdiction via mapCountryCodeToJurisdiction and region via ctx.region (coerced to EU/ME/US)."
  - "The synchronous Claude Vision section adapter (deferred by 91-06) is NOT wired; the AI-eligible tail (taxonomy miss + kill-switch ON) degrades to the admin queue via the classifyWithClaude seam. This is the safe fallback the queue exists for (T-91-08-03) and never blocks the upload. The plan's async-QStash dispatch would require a new /api/personnel/_classify worker outside this single-file plan's scope; dispatching to a non-existent endpoint (dead jobs) would be worse than an honest degrade."
  - "errors.ts was edited (append-only) to satisfy the pre-commit i18n-system-messages biome plugin, which rejects hardcoded TRPCError messages. Reused DOCUMENT_NOT_FOUND / DOCUMENT_INFECTED and added 4 personnel keys. errors.ts is a shared constants file (not a sibling-plan file), so this stays outside the erasure.ts / root.ts prohibition."

patterns-established:
  - "A gated worker-model sub-router fills its own file (classify.ts) and inherits the personnelFile mergeRouters mount + per-request assertWorkforceEnabled without touching index.ts / root.ts"
  - "Persist-first upload safety: classification writes the personnel-file link with its final section in one audited transaction; only the ambiguous tail flips Document.status to PENDING_REVIEW"

requirements-completed: [AKTA-04]

# Metrics
duration: ~40min
completed: 2026-07-01
---

# Phase 91 Plan 08: Personnel Document Classify Sub-Router Summary

**Filled the personnel-file `classifyRouter`: `attachDocument` links a virus-scanned Document into a worker's file and runs the 91-06 hybrid classifier (deterministic taxonomy → kill-switch-gated AI → admin), filing most documents into their section (Document ACTIVE) and routing the ambiguous tail to a `PENDING_REVIEW` admin queue without ever blocking the upload; `classifyApprove` / `classifyReject` clear that queue (section MANUAL + ACTIVE, or ARCHIVED) with an in-tx audit row, and `pendingReviewQueue` lists the caller-org's awaiting documents — all admin actions gated by `compliance:override`.**

## Performance
- **Duration:** ~40 min (incl. fresh-worktree `pnpm install`)
- **Completed:** 2026-07-01
- **Tasks:** 2 (2 atomic commits)
- **Files modified:** 2

## Accomplishments
- `attachDocument` (tenantProcedure + `employee:['update']`): loads the tenant-scoped `PersonnelFile`, verifies the `Document` is org-owned and not INFECTED, refuses a duplicate attach (documentId is unique on the join), then runs `classifyPersonnelDocument` composed with `defaultEvaluateKillSwitch` + an injected AI seam. Deterministic/AI results file the document into `SECTION_A..D` with the Document left ACTIVE; ambiguous / low-confidence / kill-switch-off / unmapped-jurisdiction results write `classificationMethod PENDING` and flip `Document.status → PENDING_REVIEW`. The whole link-create (+ conditional status flip) runs inside `auditedMutation` (`personnel_file.document.attached`).
- The upload is **never blocked**: a classifier throw (e.g. the unwired AI adapter) or a non-result is caught and degraded to the admin queue (Pitfall 5 / T-91-08-03); the Document bytes are already persisted by the upload path.
- `classifyApprove` / `classifyReject` (tenantProcedure + `compliance:['override']`): in a `$transaction`, load the `PersonnelFileDocument` + its Document scoped to the org, assert `Document.status === 'PENDING_REVIEW'` (else `PRECONDITION_FAILED`), then set `section` + `MANUAL` and flip Document ACTIVE (approve) or flip Document ARCHIVED (reject, bytes retained) — each via `auditedMutation` in the same tx (`classify_approved` / `classify_rejected`, closed-enum reject reason).
- `pendingReviewQueue` (tenantProcedure + `compliance:['override']`): org-scoped `findMany` of personnel documents whose Document is `PENDING_REVIEW`, projected to worker, jurisdiction, filename, upload time, and any below-threshold AI section guess for the admin UI.
- Mapped the classifier's short `A..D` code ↔ the `SECTION_A..D` enum in one place (`SHORT_CODE_TO_SECTION` + the shared `sectionToShortCode` from 91-07); no bytes/PII logged; structured logging via `@contractor-ops/logger`.

## Task Commits

Each task was committed atomically (hooks on, no `--no-verify`):

1. **Task 1: wire attachDocument to the hybrid classifier** — `6f03bc535` (feat)
2. **Task 2: admin classify-step (approve/reject) + pending-review queue** — `2f29637ac` (feat)

**Plan metadata:** committed with this SUMMARY (docs), separate from the per-task commits.

## Files Created/Modified
- `packages/api/src/routers/core/personnel-file/classify.ts` — filled the empty 91-07 `classifyRouter` stub with `attachDocument`, `classifyApprove`, `classifyReject`, `pendingReviewQueue`, plus the classification helpers (`resolveClassification`, `toPersistedColumns`, `coerceRegion`, the AI seam).
- `packages/api/src/errors.ts` — appended 4 personnel classify-step error keys (i18n system messages) at the end of the file (append-only, merge-safe).

## Decisions Made
- **Contract follows the shipped 91-06 classifier, not the plan's prose.** The plan proposed `classifyPersonnelDocument({ organizationId, personnelFileDocumentId, documentId, countryCode, documentType, storageKey })`, but 91-06 shipped `classifyPersonnelDocument({ jurisdiction, documentType, storageKey, organizationId, region }, { evaluateKillSwitch, classifyWithClaude })` and explicitly moved `region`/`jurisdiction` resolution + result persistence to this caller. The router therefore resolves `jurisdiction` via `mapCountryCodeToJurisdiction(file.countryCode)` and `region` via `ctx.region` (coerced to `EU/ME/US`), persists `section`/`classificationMethod`/`aiSectionGuess`/`aiConfidence`, and flips `Document.status` itself.
- **AI-eligible tail degrades to admin, not a synchronous model call.** The concrete Claude Vision section adapter is deferred by 91-06. Rather than call a non-existent adapter or dispatch to a non-existent QStash callback (dead jobs), the `classifyWithClaude` seam rejects and the router degrades that document to `PENDING_REVIEW`. Behaviourally this is the queue's designed purpose: the AI is a queue-volume optimisation, and without it MORE documents reach the admin — nothing is broken or blocked.
- **Reused the compliance-admin PENDING_REVIEW precedent** for the admin step (org+status gate → mutate → `auditedMutation` in-tx; best-effort side-effects outside the tx), keeping the personnel classify-step consistent with the existing contractor upload-review flow (D-07).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Composed against the real 91-06 classifier signature**
- **Found during:** Task 1.
- **Issue:** The plan's proposed `classifyPersonnelDocument` argument shape does not exist; 91-06 shipped a different (jurisdiction/region + injected-seams) contract.
- **Fix:** Built `resolveClassification` to the shipped signature; resolved jurisdiction/region in the router and persisted the result columns + Document status here (per 91-06 Next Phase Readiness).
- **Files:** `classify.ts`
- **Committed in:** `6f03bc535`

**2. [Rule 2 - Missing critical] Unmapped-jurisdiction + classifier-failure guards**
- **Found during:** Task 1 (typecheck flagged `mapCountryCodeToJurisdiction` returning `Jurisdiction | null`).
- **Issue:** An unmapped `countryCode` (null jurisdiction) or any classifier throw would otherwise crash the mutation and block the upload — violating T-91-08-03.
- **Fix:** Null-jurisdiction short-circuits to `PENDING_REVIEW`; the classifier call is wrapped in try/catch that logs and degrades to `PENDING_REVIEW`. INFECTED documents are refused and duplicate attaches rejected (mass-assignment / virus-scan mitigations T-91-08-01 / T-91-08-03).
- **Files:** `classify.ts`
- **Committed in:** `6f03bc535`

**3. [Rule 3 - Blocking] errors.ts touched to satisfy the i18n-system-messages pre-commit gate**
- **Found during:** Task 1 (biome pre-commit plugin `no-untranslated-trpc-error.grit`).
- **Issue:** Hardcoded `TRPCError` message strings are rejected by the pre-commit biome plugin; the commit hook would fail (and `--no-verify` is prohibited).
- **Fix:** Reused `DOCUMENT_NOT_FOUND` / `DOCUMENT_INFECTED` and appended 4 personnel constants to `errors.ts` (append-only). This touches a shared constants file, not `erasure.ts` / `root.ts`, so it stays within the plan's file-isolation intent.
- **Files:** `errors.ts`, `classify.ts`
- **Committed in:** `6f03bc535` (Task-1 constants) + `2f29637ac` (Task-2 constants)

---

**Total deviations:** 3 auto-fixed (2 Rule 3 blocking, 1 Rule 2 missing-critical). No architectural (Rule 4) decisions.
**Impact on plan:** All auto-fixes were necessary to compile against the real 91-06 contract, keep the upload non-blocking, and pass the commit gate. No scope creep beyond the required `errors.ts` keys.

## Issues Encountered
- Fresh worktree had no `node_modules`; ran `pnpm install` (which built `@contractor-ops/classification`, so the previously-documented api typecheck cascade is absent here and the package typechecks with **0 errors**).

## Deferred / Out of Scope
- **Synchronous Claude Vision section adapter + async QStash worker:** the plan's "dispatch the AI path async via QStash (mirror ocr-extraction)" needs a new `/api/personnel/_classify` callback handler + a concrete Claude adapter (new `apps/api` route + integration file) — outside this single-file plan's scope. The `classifyWithClaude` seam is the swap point: wire the real adapter (and, if async, enqueue + upgrade the row) in a follow-up plan. Until then the AI tail degrades to the admin queue.
- **Best-effort uploader notification** (plan's "mirror compliance-admin, outside the $transaction"): `dispatch` requires a registered `NotificationType` + `EntityType` for personnel classify outcomes, which do not exist and cannot be added without touching `notification-service` / its registry (out of the single-file scope). Not a must_have; deferred.
- **Frontend i18n translations** for the 4 new `Errors` keys (apps/web-vite `messages/*.json`): this is an API-only plan (mirrors compliance-admin's backend-first error keys); the web-vite personnel-file classify surface adds them.
- **Wiki synthesis:** `classify.ts` is not referenced by any wiki `verify_with`, so `check:wiki-brain` is not tripped. Phase 91 batches personnel-file wiki synthesis into 91-12 (mirrors 89-06 / 91-03..07); 91-12 should document the classify router under `api-routers-catalog.md` + the personnel-file domain page.

## Known Stubs
- `routeAiTailToAdminReview` (the `classifyWithClaude` seam) intentionally rejects so the AI-eligible tail degrades to the admin queue. This is a documented, safe fallback (the queue is the designed home for ambiguous documents), not a value-faking stub — it persists no fabricated section/confidence. Swap for the concrete adapter when it lands (see Deferred).

## Threat Flags
None — all new surface is in the plan's `<threat_model>` and mitigated: T-91-08-01 (Zod `.strict()` DTOs, closed section enum, server-set status, org from session, document ownership + virus-scan verified), T-91-08-02 (approve/reject/queue gated by `compliance:override`), T-91-08-03 (PENDING path persists the doc + attach never throws on a classifier non-result), T-91-08-04 (`auditedMutation` in-tx on approve/reject + `writeAuditLog` on attach).

## User Setup Required
None — no external service configuration. The `killswitch.ai-personnel-classifier` toggle (91-06) resolves to its default (on) until ops creates it in Unleash; with the AI adapter unwired the classifier's AI branch degrades to the admin queue regardless.

## Next Phase Readiness
- **91-09 (erasure):** unaffected — fills the sibling `erasure.ts`; this plan touched only `classify.ts` + `errors.ts`.
- **web-vite personnel-file classify UI:** `personnelFile.attachDocument` returns `{ personnelFileDocumentId, classificationMethod, section, status }`; `pendingReviewQueue` returns the admin projection; `classifyApprove` / `classifyReject` clear the queue. Add the 4 `Errors` i18n keys when wiring the surface.
- **AI adapter follow-up:** swap the `classifyWithClaude` seam for the concrete Claude Vision section adapter (+ async worker if dispatched via QStash).

## Self-Check: PASSED
- `packages/api/src/routers/core/personnel-file/classify.ts` — FOUND (classifyRouter filled: attachDocument + classifyApprove + classifyReject + pendingReviewQueue)
- `packages/api/src/errors.ts` — FOUND (4 personnel classify keys)
- Commit `6f03bc535` — FOUND (Task 1)
- Commit `2f29637ac` — FOUND (Task 2)
- `pnpm --filter @contractor-ops/api typecheck` — 0 errors; `personnel-classifier.test.ts` + `personnel-file-rbac-router.test.ts` + `personnel-file-tenant-isolation.test.ts` GREEN 10/10; biome + `lint:logs` + `lint:audit-log` + `lint:no-breadcrumbs` clean for my files
- No STATE.md / ROADMAP.md edits; `erasure.ts` / `root.ts` untouched

---
*Phase: 91-theme-b-akta-osobowe-personnel-file*
*Completed: 2026-07-01*
