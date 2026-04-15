---
phase: 62-zugferd-e-invoicing
plan: 04
subsystem: api-services

tags:
  - einvoice
  - zugferd
  - xrechnung
  - intake
  - matcher
  - state-machine
  - multi-tenant

# Dependency graph
requires:
  - phase: 62-zugferd-e-invoicing
    plan: 01
    provides: InvoiceIntakeRequest model + 4 intake enums
  - phase: 62-zugferd-e-invoicing
    plan: 02
    provides: parseZugferdPdf, parseXrechnungCii, validateZugferdEmbeddedXml, ZugferdConformanceLevel
provides:
  - rankIntakeCandidates({db, orgId, extracted}) — deterministic contractor matcher
  - uploadAndPersist / confirmMatch / acknowledgeValidation / convertToInvoice / reject orchestration
  - IntakeServiceDeps DI surface for router + job callers
  - Deterministic intake fixtures for router + e2e tests
affects:
  - 62-05-invoice-intake-router (imports every service function)
  - 62-06-invoice-intake-ui (consumes MatchCandidate + UploadResult shapes)
  - 62-07-e2e-and-hardening (reuses fixtures)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injected-deps surface (IntakeServiceDeps) — optional last argument to each entrypoint lets tests swap parser / validator / R2 without module-level mocking. Default values pull the real imports from @contractor-ops/einvoice and ./r2."
    - "Content-addressed idempotency — (orgId, rawFileSha256) unique constraint pre-checked before persist, race-safe re-fetch on P2002."
    - "State-machine guards live in the service (not just the router) — every mutation asserts orgId ownership + status precondition defensively."
    - "Wagner–Fischer Levenshtein inlined (≤40 LoC) with first-3-char prefix gate so the fuzzy pass is O(k·n) rather than O(|contractors|·|name|²)."
    - "Corporate-form stripping regex followed by trailing-punctuation cleanup so 'Alpha GmbH' and 'Alpha AG' both normalise to 'alpha'."

key-files:
  created:
    - packages/api/src/services/invoice-intake-matcher.ts
    - packages/api/src/services/invoice-intake-service.ts
    - packages/api/src/services/__tests__/invoice-intake-matcher.test.ts
    - packages/api/src/services/__tests__/invoice-intake-service.test.ts
    - packages/api/src/services/__tests__/fixtures/intake-fixtures.ts
  modified: []

key-decisions:
  - "IntakeServiceDeps is passed as an OPTIONAL third argument (not a constructor DI container) so router/job callers can invoke the service with just (db, input) while tests override specific deps — matches the existing einvoice-finalize pattern."
  - "Contractor field is `vatId` (not `vatIdentifier` as the plan pseudocode suggested) — the Prisma model uses `vatId`. The plan signature was indicative; actual schema wins."
  - "Matcher normalisation strips trailing '.' / ',' after corporate-form removal because `\\b(Ltd\\.?)\\b` cannot cross the word boundary to consume a trailing period on 'Ltd.'."
  - "Matcher's name-strategy loop loads all org contractors once (O(N)), then evaluates exact + prefix-gated fuzzy in memory — avoids the N+1 the plan's step-by-step pseudocode would have produced."
  - "convertToInvoice writes `source = 'PEPPOL'` + `sourceReference = intake:${intakeId}` on the created Invoice — no EInvoiceLifecycleEvent write here (the plan notes only outbound GENERATED lives on lifecycle; intake-origin traceability lives on Invoice.sourceReference)."
  - "Fixtures intentionally omit pdf-lib — the orchestration tests mock `parseZugferdPdf` via IntakeServiceDeps, so the 'PDF' bytes only need to be distinguishable-per-test for sha256 dedup + pass the MIME+size gates. This keeps the api package test closure free of pdf-lib's transitive deps."

patterns-established:
  - "Optional-deps third argument (`svc(db, input, deps?)`) pattern for services that orchestrate multiple side-effectful modules (parser / validator / R2). Default values pull real imports, tests override."
  - "Matcher Score aggregation via Map<contractorId, MatchCandidate> — multi-strategy hits on the same row sum scores and append reasons, enabling composite signals ('VAT + FUZZY_NAME') to outrank single-signal hits."

requirements-completed: [EINV-03]

# Metrics
duration: ~25 min
completed: 2026-04-15
tasks-completed: 2
tasks-total: 2
tests-added: 31 (16 matcher + 15 service)
tests-passing: 31 / 31 (both files exit 0)
---

# Phase 62 Plan 04: Invoice Intake Matcher + Service Orchestration Summary

**Deterministic contractor matcher (VAT-ID > Leitweg-ID > EXACT_NAME > prefix-gated fuzzy) plus a 5-entrypoint state-machine service (uploadAndPersist / confirmMatch / acknowledgeValidation / convertToInvoice / reject) with full idempotency, cross-tenant defense, and 31 unit tests injecting mock parser + validator + R2 via an IntakeServiceDeps surface.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-15T01:55Z
- **Completed:** 2026-04-15T02:07Z
- **Tasks:** 2 / 2
- **Files created:** 5
- **New test cases:** 31 (16 matcher + 15 service)

## Accomplishments

### Task 1 — `rankIntakeCandidates` matcher

- Deterministic 4-strategy scoring: `VAT_ID` (100) > `LEITWEG_ID` (90) > `EXACT_NAME` (70) > `FUZZY_NAME` (50 − 5·d, d ≤ 3)
- Wagner–Fischer Levenshtein inlined (~35 LoC, single row reuse, no deps)
- First-3-char prefix gate before any Levenshtein pass — the fuzzy sweep never evaluates "Zebra GmbH" against "Alpha GmbH"
- Corporate-form normalisation (`GmbH | UG | AG | Ltd[.] | Limited | Inc[.] | KG | OHG | GbR | e.V. | SE`) + trailing-punctuation cleanup so "Alpha GmbH" and "Alpha AG" collide on their root
- Score aggregation via `Map<contractorId, MatchCandidate>` — a row matching via multiple strategies sums scores and appends reasons
- Top-5 cap with stable tie-break on `contractorId`
- Uses `logger.child({ module: 'invoice-intake-matcher' })` — never logs `supplierName` (PII avoidance)
- 16 tests: cross-strategy aggregation, ranking across strategies, no-VAT+no-Leitweg path, distance 3 vs 4 boundary, first-3-char prefix gate, suffix-normalisation collision, top-5 cap, Leitweg > fuzzy ordering, normaliseContractorName + levenshtein unit tests
- **Commit:** `cedadbc1`

### Task 2 — `invoice-intake-service` orchestration

- `uploadAndPersist(db, input, deps?)` — full pipeline:
  - Size gate (`5 * 1024 * 1024` bytes) + MIME gate (xml: `application/xml|text/xml`, pdf: `application/pdf`)
  - SHA-256 content hash → dedup pre-check on `(organizationId, rawFileSha256)`
  - Parser dispatch: `parseZugferdPdf` for pdf, `parseXrechnungCii` for xml (with UTF-8 BOM strip)
  - KoSIT 3-layer validation via `validateZugferdEmbeddedXml`; XSD failure → typed throw, layer-2/3 failures → `WARNINGS`/`INVALID` with row created
  - Three R2 uploads: raw → `einvoice-intake/{orgId}/{sha16}.{pdf|xml}`, extracted (pdf only) → `…-extracted.xml`, report → `…-{ruleSetVersion}-report.html`
  - `invoiceIntakeRequest.create` with typed status derivation (VALID → `PARSED`, otherwise `NEEDS_REVIEW`, EXTENDED level emits `LEVEL_EXTENDED_BEST_EFFORT`)
  - P2002 race handler re-fetches the winner and returns `DEDUP_RETURNED`
- `confirmMatch` — PARSED/NEEDS_REVIEW → MATCHED, cross-org → `NOT_FOUND`
- `acknowledgeValidation` — rejects VALID rows (`VALIDATION_NOT_REQUIRED`), stamps `validationAcknowledgedAt/ByUserId`
- `convertToInvoice` — MATCHED-only, requires VALID or prior acknowledgement, writes Invoice + InvoiceLines inside `db.$transaction`, idempotent (second call returns the same invoiceId)
- `reject` — blocked on `CONVERTED`, enforces `reason.length >= 3`
- All mutations cross-tenant-guarded via `intake.organizationId === orgId`
- `IntakeServiceDeps` DI surface (parse / validate / r2 / now) — default values pull the real imports; unit tests swap with `vi.fn()` stubs
- Uses `logger.child({ module: 'invoice-intake-service' })` — never logs raw file bytes or parsed invoice JSON
- Deterministic fixtures (`__tests__/fixtures/intake-fixtures.ts`): `buildMinimalInvoice`, `buildXmlFixture` (via real `generateXRechnungCii`), `buildHappyPathPdfBase64` (opaque PDF-header bytes, no pdf-lib), `padBase64BufferTo`, `buildXsdInvalidXmlBase64`. No `Date.now()` / `Math.random()`.
- 15 orchestration tests covering: happy-path PDF (R2 uploads + metadata), dedup (second upload returns DEDUP_RETURNED), XSD throws (zero persist), warnings (NEEDS_REVIEW), size gate (zero R2), MIME gate (parser never called), acknowledge-VALID rejection, convert from PARSED rejection, convert-idempotency, convert-without-ack rejection, reject-on-CONVERTED rejection, reason-too-short rejection, cross-org confirmMatch returns NOT_FOUND, confirmMatch happy path, acknowledge happy path
- **Commit:** `4bf54f0d`

## Task Commits

1. **Task 1: `rankIntakeCandidates` matcher + 16 tests** — `cedadbc1` (feat)
2. **Task 2: `invoice-intake-service` orchestration + fixtures + 15 tests** — `4bf54f0d` (feat)

## Decisions Made

- **Injected-deps pattern beats global mocking.** The `IntakeServiceDeps` optional third arg avoids having to `vi.mock('@contractor-ops/einvoice')` at the module level (which leaks between test workers — the api package's vitest config explicitly uses `pool: 'forks'` to work around the same issue on other services). Router and cron callers simply omit `deps`; tests inject.
- **No pdf-lib in the api test closure.** The plan suggested generating fixture PDFs via pdf-lib. Since the orchestration tests mock `parseZugferdPdf` anyway, the "PDF" bytes only need to satisfy the size + MIME gates and produce a stable sha256. Opaque `%PDF-1.4\n…%%EOF\n` bytes satisfy all three without pulling pdf-lib into `packages/api`. (When a future integration test needs real PDFs, the einvoice package's fixture builder can be imported instead.)
- **Invoice creation emits `source='PEPPOL'` + `sourceReference='intake:<intakeId>'`.** No `EInvoiceLifecycleEvent` is written on inbound conversion — Phase 61's lifecycle is for outbound GENERATED artifacts. Traceability back to the staging row lives on `Invoice.sourceReference` so operators can reverse-link without joining through lifecycle.
- **Contractor field is `vatId`, not `vatIdentifier`.** The plan's pseudocode used the wider "vatIdentifier" name. The Prisma Contractor model uses `vatId`. Adopted the schema name in the matcher to keep the code + DB aligned; this does not change the `MatchCandidate.vatIdentifier` response-shape field name.
- **Trailing punctuation is stripped post-normalisation.** `\\b(Ltd\\.?)\\b` cannot cross the word boundary to consume a trailing period, so the matcher ran a `/[.,]+\\s*$/` cleanup pass after corporate-form stripping. This is a micro-fix but would have flaked fuzzy matches on "Beta Ltd." vs "Beta Limited" otherwise.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test cases used names that failed the first-3-char prefix gate**
- **Found during:** Task 1 first test run
- **Issue:** Initial test fixtures used "Alfa GmbH" vs extracted "Alpha GmbH" — normalised "alfa" vs "alpha" — the 3-char prefixes `alf` vs `alp` differ, so the fuzzy gate correctly blocks the match. The test asserted VAT+FUZZY aggregation (145) but only VAT (100) was produced. The *plan's* intent (aggregate score on cross-strategy) is correct; the *test's* fixture was wrong.
- **Fix:** Swapped fixtures to "Alphz" (shares `alp` prefix with "alpha", distance 1) so the fuzzy gate passes. Same issue fixed in the distance-3/4 boundary test with "aaaa" vs "aaaxyz" (dist 3, kept) / "aaaxyzw" (dist 4, excluded).
- **Commit:** `cedadbc1`

**2. [Rule 2 - Missing Critical] Trailing punctuation left after corporate-form strip**
- **Found during:** Task 1 normaliseContractorName test run
- **Issue:** `normaliseContractorName('Beta Ltd.')` returned `'beta .'` instead of `'beta'`. The `\\b(Ltd\\.?)\\b` clause cannot consume the trailing period because `\\b` after `.` is a word/non-word boundary that cannot cross the period. Result: stray punctuation in the normalised output would cause Levenshtein distance inflation on otherwise-identical names.
- **Fix:** Added a post-strip `/[.,]+\\s*$/` cleanup in `normaliseContractorName`.
- **Commit:** `cedadbc1`

**3. [Rule 3 - Blocking] Stale `packages/einvoice/dist/` blocked tsc typecheck**
- **Found during:** Post-Task-2 `tsc --noEmit` run
- **Issue:** Phase 62 Plan 02 added Zugferd parser/validator exports to `packages/einvoice/src/index.ts`, but the shipped `dist/index.d.ts` was stale from a pre-Plan-02 tsc run. tsc in `packages/api` resolves via the package `"types": "./dist/index.d.ts"` and reported the new symbols as missing. Vitest tests passed (the api package's vitest.config.ts aliases `@contractor-ops/einvoice` → `packages/einvoice/src/index.ts`), so this was type-system-only but would have flagged in CI.
- **Fix:** Rebuilt `packages/einvoice/dist/` via `tsc -p tsconfig.json --outDir dist --noEmitOnError false` (pre-existing unrelated storecove-adapter + saxon-js errors do not block emit). `dist/` is gitignored and is regenerated by CI's build step anyway; the local regen here is a typecheck-only unblock.
- **Files modified:** none (dist is gitignored)
- **Commit:** no commit — local build artifact regen only

---

**Total deviations:** 3 auto-fixed (1 Rule 1 bug, 1 Rule 2 missing critical, 1 Rule 3 blocking).
**Impact on plan:** All preserve plan intent. The test-fixture fix (1) and punctuation cleanup (2) would have surfaced in any real-world matcher run — without them, "Beta Ltd." documents would never fuzzy-match existing "Beta Limited" contractors. No scope creep.

## Issues Encountered

- **Pre-existing test failures in unrelated files.** `src/services/__tests__/billing-webhook.test.ts`, `ocr-extraction.test.ts`, and `r2.msw.integration.test.ts` fail to load at setup time (MSW handler-import errors) on the current `v2` branch. Confirmed pre-existing by `git stash && test` — not introduced by this plan. Out of scope for 62-04. (The 1205 passing tests + the 31 new tests all pass cleanly.)
- **Stale `packages/einvoice/dist/` after Plan 02.** Surfaced as tsc-only errors; vitest was unaffected because of the source-file alias. Resolved by local rebuild (see deviation 3). Plan 62-05 / 62-06 will need the same fix applied if they consume any Plan-02 symbols in code paths that tsc traverses.

## Known Stubs

None — all code paths are wired to real implementations (default deps pull real parser / validator / R2; fixtures use the real XRechnung generator).

## User Setup Required

None — plan consumed only workspace packages and the DB schema landed by Plan 62-01.

## Next Phase Readiness

- **Plan 62-05 (intake tRPC router)** can import `rankIntakeCandidates`, `uploadAndPersist`, `confirmMatch`, `acknowledgeValidation`, `convertToInvoice`, `reject` directly from `@contractor-ops/api/services/invoice-intake-service` (plus the matcher from `…/invoice-intake-matcher`). Error codes (`FILE_TOO_LARGE` / `UNSUPPORTED_MIME` / `CII_XSD_INVALID` / `INVALID_STATE_TRANSITION` / `NOT_FOUND` / `VALIDATION_NOT_REQUIRED` / `REASON_TOO_SHORT`) are stable and exhaustive — the router's TRPCError mapping can switch on `.code` directly.
- **Plan 62-06 (intake UI)** can build against the `MatchCandidate` shape (`{contractorId, displayName, vatIdentifier, score, reasons[]}`) and the `UploadResult` discriminated union (`CREATED | DEDUP_RETURNED`).
- **Plan 62-07 (e2e + hardening)** can reuse the fixture helpers in `packages/api/src/services/__tests__/fixtures/intake-fixtures.ts` — they are side-effect-free and safe to import from Playwright test setup.
- **No blockers** for downstream plans.

## Self-Check: PASSED

Verified:
- [x] `packages/api/src/services/invoice-intake-matcher.ts` exists (347 LoC, exceeds min 80)
- [x] `packages/api/src/services/invoice-intake-service.ts` exists (743 LoC, exceeds min 180)
- [x] `packages/api/src/services/__tests__/invoice-intake-matcher.test.ts` exists (16 tests pass)
- [x] `packages/api/src/services/__tests__/invoice-intake-service.test.ts` exists (15 tests pass)
- [x] `packages/api/src/services/__tests__/fixtures/intake-fixtures.ts` exists (deterministic, no Date.now/Math.random)
- [x] `rankIntakeCandidates` exported; `MatchReason` type = `'VAT_ID' | 'LEITWEG_ID' | 'EXACT_NAME' | 'FUZZY_NAME'` (4 distinct values)
- [x] Matcher contains Levenshtein DP (`Math.min(` × 3, inline helper ≤40 LoC)
- [x] Matcher contains `substring(0, 3)` prefix pre-filter (2 occurrences)
- [x] Matcher uses `logger.child` (Pino); no `console.` calls (grep count = 0)
- [x] Service exports `uploadAndPersist`, `confirmMatch`, `acknowledgeValidation`, `convertToInvoice`, `reject`
- [x] Service contains `5 * 1024 * 1024` size gate (1 occurrence in INTAKE_MAX_FILE_BYTES)
- [x] Service contains `db.$transaction` (2 occurrences — convertToInvoice)
- [x] Service uses `logger.child`; no `console.` calls (grep count = 0)
- [x] All 31 new tests pass: `pnpm --filter @contractor-ops/api test -- --run src/services/__tests__/invoice-intake-matcher.test.ts src/services/__tests__/invoice-intake-service.test.ts` exits 0
- [x] `tsc --noEmit` reports zero errors in the three new files (pre-existing errors in unrelated approval/audit/contract routers remain — out of scope)
- [x] Both task commits exist on `v2`: `cedadbc1` (Task 1), `4bf54f0d` (Task 2)
- [x] Cross-org isolation tested explicitly (Test 10: `confirmMatch` with mismatched orgId throws NOT_FOUND)
- [x] Idempotency paths tested explicitly (Test 2: dedup upload; Test 8: convertToInvoice twice returns same invoiceId)

---
*Phase: 62-zugferd-e-invoicing*
*Completed: 2026-04-15*
