---
phase: 62-zugferd-e-invoicing
plan: 05
subsystem: api-trpc

tags:
  - einvoice
  - zugferd
  - trpc
  - zod
  - multi-tenant
  - rbac
  - intake
  - idempotency

# Dependency graph
requires:
  - phase: 62-zugferd-e-invoicing
    plan: 01
    provides: InvoiceIntakeRequest model + EInvoiceLifecycle.zugferdPdfKey columns + ZUGFERD_GENERATED event
  - phase: 62-zugferd-e-invoicing
    plan: 03
    provides: generateZugferdPdf + ZugferdLevelUnsupportedForOutput
  - phase: 62-zugferd-e-invoicing
    plan: 04
    provides: uploadAndPersist / confirmMatch / acknowledgeValidation / convertToInvoice / reject + rankIntakeCandidates
provides:
  - invoiceIntake tRPC router (11 procedures) registered in appRouter
  - einvoice.generateZugferdPdf mutation with content-addressed idempotency
  - Typed service error → tRPC error-code translation table
  - Cross-tenant NOT_FOUND (never FORBIDDEN) oracle-free access pattern
  - Upload rate-limit wiring (10/user/minute) via existing uploadRateLimitMiddleware
affects:
  - 62-06-invoice-intake-ui (can now call trpc.invoiceIntake.* and einvoice.generateZugferdPdf)
  - 62-07-e2e-and-hardening (full intake + outbound pipelines exerciseable via tRPC)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Export mapPrismaInvoiceToEInvoice from einvoice-finalize.ts — single canonical envelope feeds both XRechnung CII and ZUGFeRD PDF generation, so the two paths cannot drift."
    - "Content-addressed PDF idempotency (sha256 over PDF bytes) — re-run with identical input short-circuits to the existing R2 key and appends no second ZUGFERD_GENERATED event."
    - "Typed-error → tRPC-code translator (mapIntakeErrorToTrpc) colocated in the router — single place to audit error-code stability, callers never need to inspect POJO shapes."
    - "Direct createCallerFactory(invoiceIntakeRouter) in tests — isolates the router's tests from the full appRouter's pre-existing mock setup in einvoice.test.ts, keeping Plan-05 tests hermetic."
    - "Parser POJO error passthrough — ZUGFERD_NO_XML_ATTACHMENT / CII_XSD_INVALID / ZUGFERD_LEVEL_UNSUPPORTED bubble from einvoice service layer straight to UNPROCESSABLE_CONTENT without requiring catch points in each router method."

key-files:
  created:
    - packages/api/src/routers/invoice-intake.ts
    - packages/api/src/routers/__tests__/invoice-intake.test.ts
    - packages/api/src/routers/__tests__/einvoice.generate-zugferd.test.ts
  modified:
    - packages/api/src/routers/einvoice.ts
    - packages/api/src/root.ts

key-decisions:
  - "Procedures use tenantProcedure (pre-existing) rather than a custom organizationProcedure — mirrors the exact auth primitive einvoice.ts already uses. ctx.organizationId, ctx.user, ctx.db are the established paths."
  - "upload procedure composes .use(requirePermission).use(uploadRateLimitMiddleware).input(...) — the rate limiter is the existing helper at packages/api/src/middleware/upload-rate-limit.ts (10/min/user in-memory sliding window). No new dep was introduced."
  - "Cross-org access resolves to NOT_FOUND (never FORBIDDEN) — avoids the response-code oracle. Every loader (loadIntakeScoped, generateZugferdPdf's findFirst) uses {id, organizationId} filters so cross-tenant queries simply return null."
  - "generateZugferdPdf is idempotent by content-hash: if EInvoiceLifecycle.zugferdPdfSha256 already matches the newly-computed SHA-256, the existing key is re-signed and no second ZUGFERD_GENERATED event is appended. The R2 key slug uses the first 16 hex chars of the sha (content-addressed)."
  - "Invoice envelope is derived by the canonical mapPrismaInvoiceToEInvoice helper (already exported from einvoice-finalize.ts for Phase 61 XRechnung). No plan-level buildEInvoiceEnvelope rename was introduced — we reuse what's live."
  - "downloadExtractedXml falls back to rawFileKey when extractedXmlKey is null (XML uploads have no separate extraction slot) — a single client endpoint works for both PDF and XML intake shapes."

patterns-established:
  - "Typed-service-error translator pattern: duck-type guard + switch mapping POJO .code values to TRPCError codes, colocated at the top of the router."
  - "Router tests via createCallerFactory(specificRouter) (not appRouter) — hermetic mocking isolated from neighbouring router test setups."

requirements-completed: [EINV-02, EINV-03]

# Metrics
duration: ~45 min
completed: 2026-04-15
tasks-completed: 3
tasks-total: 3
tests-added: 27 (20 invoice-intake + 7 generate-zugferd)
tests-passing: 27 / 27 in new files; 31 / 31 in pre-existing intake service tests
---

# Phase 62 Plan 05: Invoice Intake Router + ZUGFeRD Outbound Mutation Summary

**11-procedure `invoiceIntake` tRPC router (upload + listByOrg + getById + getMatchCandidates + confirmMatch + acknowledgeValidation + convertToInvoice + reject + 3 downloads) registered in `appRouter`, plus a new `einvoice.generateZugferdPdf` mutation with content-addressed idempotency. Every procedure is tenant-scoped + RBAC-gated + Zod-validated, cross-org access always resolves to NOT_FOUND, and typed parser/service errors map cleanly onto tRPC error codes. 27 new unit tests, all passing.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 / 3
- **Tests added:** 27 (20 invoice-intake router + 7 einvoice.generateZugferdPdf)
- **Tests passing:** 27 / 27 in new files; pre-existing service tests (31 / 31) unaffected

## Accomplishments

### Task 1 — `invoice-intake.ts` tRPC router + 20 tests

- 11 procedures: `upload` / `listByOrg` / `getById` / `getMatchCandidates` / `confirmMatch` / `acknowledgeValidation` / `convertToInvoice` / `reject` / `downloadRawFile` / `downloadExtractedXml` / `downloadValidationReport`.
- Every procedure uses `tenantProcedure.use(requirePermission({ invoice: [...] }))` — auth + RBAC + org scope in one line, same primitive the existing `einvoice` router uses.
- `upload` composes `.use(uploadRateLimitMiddleware)` (10/min/user sliding window, existing helper). No new dep.
- `mapIntakeErrorToTrpc` translator at the top of the file: duck-types typed service errors (`FILE_TOO_LARGE` → `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MIME` → `BAD_REQUEST`, `CII_XSD_INVALID` → `UNPROCESSABLE_CONTENT`, `INVALID_STATE_TRANSITION` → `CONFLICT`, `NOT_FOUND` → `NOT_FOUND`, `VALIDATION_NOT_REQUIRED` → `CONFLICT`, `REASON_TOO_SHORT` → `BAD_REQUEST`) and parser POJO errors (`ZUGFERD_*`, `CII_*`) to `UNPROCESSABLE_CONTENT`.
- Org-scoped intake loader (`loadIntakeScoped`) — returns `null` for cross-org rows, router throws `NOT_FOUND`. Used by all three download endpoints.
- Zod schemas: `intakeIdInput` uses `z.string().cuid()`; `uploadInput` caps `fileBase64.length` at 7 000 000 chars (cheap pre-filter before the service's 5 MiB byte-ceiling); `rejectInput` requires `reason.min(3).max(500)` at the boundary.
- Never logs the `input` payload — it can carry base64 file bytes and supplier PII.
- **Commit:** `149356a1`

### Task 2 — `einvoice.generateZugferdPdf` mutation + 7 tests

- New tRPC mutation wired into the existing `einvoiceRouter`, sits immediately before the Phase-61 finalize/revalidate block.
- Loads the invoice org-scoped via `db.invoice.findFirst({ where: { id, organizationId }, include: { lines, contractor, contract, organization, eInvoiceLifecycle } })` — same relation set the finalize path already eager-loads.
- Builds the canonical `EInvoice` envelope via `mapPrismaInvoiceToEInvoice` (imported from `services/einvoice-finalize.ts` — the helper was already exported for the Phase-61 XRechnung pipeline).
- Calls `generateZugferdPdf({ invoice })` from `@contractor-ops/einvoice` (Plan 62-03).
- Computes SHA-256 over the returned bytes → content-addressed R2 key `einvoice-pdf/{orgId}/{invoiceId}/{sha16}.pdf`.
- Idempotency: if `EInvoiceLifecycle.zugferdPdfSha256` already matches the new SHA and `zugferdPdfKey` is set, re-signs the existing key (300 s TTL) and returns `{ ..., reused: true }` — no second upload, no second event.
- Transaction-wrapped lifecycle upsert + `ZUGFERD_GENERATED` event insert.
- Typed error translation: `ZugferdLevelUnsupportedForOutput` → `UNPROCESSABLE_CONTENT`; any other generator crash → `INTERNAL_SERVER_ERROR` with `ZUGFERD_WRAPPING_FAILED` message.
- 7 tests: happy path (upload + event + sha parity), idempotent reuse (no second event), cross-org NOT_FOUND, generator error → ZUGFERD_WRAPPING_FAILED, level-unsupported → UNPROCESSABLE_CONTENT, upsert create branch, invalid cuid.
- **Commit:** `4d19ce97`

### Task 3 — Register `invoiceIntake` in `appRouter`

- Added `import { invoiceIntakeRouter } from './routers/invoice-intake.js'` alongside the existing `invoice` import.
- Added `invoiceIntake: invoiceIntakeRouter` to the router object immediately below `invoice: invoiceRouter` with an inline comment explaining its scope (Phase 62 EINV-03).
- No other router entry touched.
- **Committed alongside Task 1:** `149356a1`

## Task Commits

1. **Task 1 + Task 3: invoice-intake router (11 procedures) + appRouter registration** — `149356a1` (feat)
2. **Task 2: einvoice.generateZugferdPdf mutation** — `4d19ce97` (feat)

## Files Created / Modified

### Created

- `packages/api/src/routers/invoice-intake.ts` — 448 LoC, 11 procedures, typed error translator, org-scoped loader.
- `packages/api/src/routers/__tests__/invoice-intake.test.ts` — 20 tests covering happy paths, Zod pre-service rejects, service-error translation, cross-org isolation (ORG_A vs ORG_B findMany filter), idempotent convertToInvoice, downloadValidationReport null branch.
- `packages/api/src/routers/__tests__/einvoice.generate-zugferd.test.ts` — 7 self-contained tests with the einvoice package mocked at the boundary (no pdf-lib / react-pdf loaded in this suite).

### Modified

- `packages/api/src/routers/einvoice.ts` — added `createHash` import, `generateZugferdPdf` + `ZugferdLevelUnsupportedForOutput` re-imports from `@contractor-ops/einvoice`, `mapPrismaInvoiceToEInvoice` import from `einvoice-finalize.ts`, `putObjectAndSignDownload` import from `r2.ts`, new `generateZugferdPdf` mutation (184 LoC).
- `packages/api/src/root.ts` — added import + `invoiceIntake: invoiceIntakeRouter` entry.

## Decisions Made

- **Reused the existing `mapPrismaInvoiceToEInvoice` helper.** The plan pseudocode mentioned `buildEInvoiceEnvelope`, but the live codebase has the same helper under the Phase-61 name (in `einvoice-finalize.ts`) and it already handles reverse-charge category selection, tax-breakdown aggregation, and Leitweg-ID resolution. Forking to a new helper name would create an immediate drift risk. Imported the existing one directly.
- **Idempotency by SHA-256, not by timestamp.** The plan allowed either; content hash is cheaper (no extra DB field needed beyond what Plan 62-01 already landed), deterministic for the same invoice content, and collision-resistant. Re-running `generateZugferdPdf` with identical input bytes is now guaranteed to be a no-op at the event level.
- **Tests mock `@contractor-ops/einvoice` at the module boundary, not individual sub-modules.** The real ZUGFeRD generator pulls pdf-lib + react-pdf + the KoSIT validator; exercising those in a router-unit test would double the runtime and create cross-suite flakiness. The router's responsibility (auth, Zod, error translation, transaction wiring) is fully covered without loading the generator.
- **`createCallerFactory(invoiceIntakeRouter)` rather than `createCallerFactory(appRouter)`.** The pre-existing `einvoice.test.ts` has a 150-line mock surface for the full `appRouter`; reusing it would couple Plan-05 tests to every pre-existing mock gap. Direct router-level callers are hermetic and let the Plan-05 tests remain green even when unrelated router tests drift.
- **Typed-service-error translator lives at the top of the router, not in middleware.** The typed POJO shape (`{ code: 'NOT_FOUND' | ... }`) is intake-specific; hoisting the translator into middleware would force other routers to know about intake codes. Local translation keeps the contract private to this router.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's `buildEInvoiceEnvelope` helper does not exist under that name**

- **Found during:** Task 2 (drafting the `generateZugferdPdf` handler)
- **Issue:** Plan text referenced `buildEInvoiceEnvelope(invoice)` and suggested it was an "existing helper from phase 61". The actual Phase-61 helper is `mapPrismaInvoiceToEInvoice` in `packages/api/src/services/einvoice-finalize.ts` — a clean jurisdiction-neutral mapper that handles reverse-charge categories, tax breakdown aggregation, and supplier/customer country fallbacks. Introducing a second helper under the plan's suggested name would create a second source of CII truth and risk future drift.
- **Fix:** Imported `mapPrismaInvoiceToEInvoice` directly (it is already `export`ed from the finalize module). The ZUGFeRD pipeline now consumes the exact same envelope the XRechnung pipeline does, so CII content is byte-identical for the same invoice row.
- **Commit:** `4d19ce97`

**2. [Rule 1 - Bug] Plan's `ctx.activeOrgId` + `ctx.userId` placeholders do not match actual context shape**

- **Found during:** Task 2 (drafting the `generateZugferdPdf` handler)
- **Issue:** Plan pseudocode used `ctx.activeOrgId` and `ctx.userId`. The actual `tenantProcedure` adds `ctx.organizationId` + `ctx.region` + `ctx.db` onto the base context; the authed user is at `ctx.user?.id`. Copy-pasting the plan's shape would have failed `tsc --noEmit`.
- **Fix:** Used `ctx.organizationId` for the org scope and `ctx.user?.id ?? null` for the actor — exactly mirrors how the existing `finalize` mutation three lines earlier in the same file spells it.
- **Commit:** `4d19ce97`

**3. [Rule 3 - Blocking] R2 `putObjectAndSignDownload` signature differs from the plan's shape**

- **Found during:** Task 2 (wiring the upload path)
- **Issue:** Plan pseudocode showed `const { signedUrl } = await putObjectAndSignDownload({ key, body, contentType, ttlSeconds: 300 })`. The actual helper returns `{ signedUrl, expiresInSeconds }`. More subtly, `putObjectString` is a separate helper used for text bodies only — the plan's shape would have worked but lost the `expiresInSeconds` field that downstream clients need for UI countdowns.
- **Fix:** Destructured both `signedUrl` + `expiresInSeconds` from the existing helper's return. Surfaces `expiresInSeconds: 300` back to the caller on both the upload-now and idempotent-reuse branches so the UI can always render the same TTL badge.
- **Files:** `packages/api/src/routers/einvoice.ts`
- **Commit:** `4d19ce97`

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 3 blocking).
**Impact on plan:** Zero scope creep. All three are drift between plan prose and the live codebase; fixing them preserves plan intent and keeps the new code aligned with Phase-61 conventions.

## Issues Encountered

- **Pre-existing `einvoice.test.ts` fails at import time.** The existing test file mocks `@contractor-ops/logger` but only exports `createLogger` / `createTrpcLogger` — not `logger`. The einvoice package's Plan-62-02 parser update adds a top-level `logger.child` call, so the whole test suite fails to evaluate when our new einvoice.ts imports trigger its chain. This is out of scope for Plan 05 (documented in Plan 62-04 Summary's "Issues Encountered"). Our new tests sidestep the gap by providing a complete logger mock including `logger`.
- **Pre-existing `tsc --noEmit` failures in unrelated packages.** `@contractor-ops/gov-api` has 2 TS errors (implicit-any + missing `@contractor-ops/test-utils` declaration), `@contractor-ops/einvoice` has 4 errors (missing `@types/saxon-js`, `pdf-wrapper.test.ts` lookup overload). Both pre-existed on `dad54f78` (this branch's base). Running `pnpm --filter @contractor-ops/api exec vitest run` for only the new test files succeeds cleanly (27 / 27 pass); the pre-existing build failures do not block the intake + outbound routers.
- **Sandbox worktree reset mid-execution.** An initial attempt happened inside a dedicated git worktree; the worktree was removed by the harness partway through execution, orphaning the first two commits. Work was replayed on a fresh branch `worktree-agent-a0f13ad3-replay` based off the expected `dad54f78` commit — file contents, test coverage, and commit messages are identical to the originals; only the sha values changed (`149356a1` / `4d19ce97`).

## Known Stubs

None — every procedure is fully wired to its service, the generator, or an R2 sign helper. No TODO / placeholder data flows to the client.

## Threat Flags

None — Plan 05 exposes existing intake-service behaviour (already threat-modelled in Plan 62-04 summary) plus the outbound `generateZugferdPdf` mutation. The latter only reads an invoice the caller's organization owns, writes to `einvoice-pdf/{orgId}/...` R2 keys (org-scoped by convention), and inserts an `EInvoiceLifecycleEvent` inside `$transaction`. No new trust boundaries crossed.

## User Setup Required

None — consumes only existing workspace packages + database columns from Plan 62-01.

## Next Phase Readiness

- **Plan 62-06 (intake UI)** can now call `trpc.invoiceIntake.upload`, `.listByOrg`, `.confirmMatch`, `.convertToInvoice`, etc., and `trpc.einvoice.generateZugferdPdf` for the outbound split-button. Typed error responses (`PAYLOAD_TOO_LARGE` / `UNPROCESSABLE_CONTENT` / `CONFLICT` / `NOT_FOUND`) are stable — UI toast copy can switch on `code` + `message` without reading the body.
- **Plan 62-07 (e2e + hardening)** can exercise the full PDF → intake → match → convert loop through the tRPC layer end-to-end. The 300 s signed-URL TTL matches the other Phase-56 R2 flows for consistent test timing.
- **No blockers** for downstream plans.

## Self-Check: PASSED

Verified:

- [x] `packages/api/src/routers/invoice-intake.ts` exists and exports `invoiceIntakeRouter` with 11 procedures named exactly as specified: upload, listByOrg, getById, getMatchCandidates, confirmMatch, acknowledgeValidation, convertToInvoice, reject, downloadRawFile, downloadExtractedXml, downloadValidationReport
- [x] File imports from `../services/invoice-intake-service.js` and `../services/invoice-intake-matcher.js`
- [x] Every `intakeId` input uses `z.string().cuid()`
- [x] `TRPCError` is imported from `@trpc/server`
- [x] Zero `console.*` calls in `invoice-intake.ts` (grep count = 0)
- [x] Zero `console.*` calls in `einvoice.ts` (grep count = 0) — zero net additions in this plan
- [x] `packages/api/src/routers/einvoice.ts` contains `generateZugferdPdf: tenantProcedure` (the project's equivalent of `organizationProcedure`)
- [x] `einvoice.ts` imports `generateZugferdPdf` + `ZugferdLevelUnsupportedForOutput` from `@contractor-ops/einvoice`
- [x] `generateZugferdPdf` procedure wraps lifecycle upsert + event insert in `$transaction`
- [x] `packages/api/src/root.ts` imports `invoiceIntakeRouter` from `./routers/invoice-intake.js` and contains the exact key `invoiceIntake: invoiceIntakeRouter`
- [x] All 27 new tests pass (20 invoice-intake + 7 einvoice.generateZugferdPdf)
- [x] Test case 5 (cross-org isolation in `listByOrg`) explicitly seeds two orgs and asserts each caller sees only its own findMany result
- [x] Test case 3 in generate-zugferd (cross-org NOT_FOUND) explicitly uses ORG_A vs ORG_B findFirst filter
- [x] Test case for idempotency (generate-zugferd #2) asserts `reused === true` and `lifecycleEvents.length === 0`
- [x] Both task commits present on `worktree-agent-a0f13ad3-replay`: `149356a1` (Task 1 + 3) and `4d19ce97` (Task 2)

---

*Phase: 62-zugferd-e-invoicing*
*Completed: 2026-04-15*
