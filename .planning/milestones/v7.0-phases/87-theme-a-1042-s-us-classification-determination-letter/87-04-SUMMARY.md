---
phase: 87-theme-a-1042-s-us-classification-determination-letter
plan: 04
subsystem: api
tags: [1042-s, treaty, section-875d, react-pdf, idempotency, audit, us-expansion, chapter-3, ftin]

# Dependency graph
requires:
  - phase: 87-01
    provides: form-1042s.service + form-1042s-pdf RED scaffolds (contract pins)
  - phase: 87-02
    provides: Form1042S Prisma model + regenerated client (append-only, supersede chain, snapshotJson)
  - phase: 87-03
    provides: US classification surface (sibling; not a build-time dependency of this core)
provides:
  - "form-1042s.service: §875(d)-gated box-2/box-3b treaty resolution, form-on-file routing, last-4 FTIN snapshot, one-transaction supersede, idempotent audited batch"
  - "form-1042s-pdf + recipient-copy react-pdf template: render-from-snapshot, FTIN last-4 mask, CAS-guarded org-scoped R2 archive"
  - "staff form1042s tRPC router (us-expansion gated): generate/correct/recipient-copy/list + contractorPii-gated full-FTIN reveal"
affects: [87-07, 87-08, 1042-s-transmit, iris, portal-recipient-consent]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injected treaty resolver: DB-free in-memory US-treaty snapshot as the default (unit-testable §875(d) gate) with the live applyTreaty injected by the router — mirrors the 1099 SEEDED_THRESHOLDS_MINOR / getBox1ThresholdMinor split"
    - "Injected persistence port (persist?: Form1042SCreateClient) so the deterministic core files with no live DB"
    - "Server-side box-figure derivation in the router (never client-supplied) — .strict() inputs carry only taxYear/formId"

key-files:
  created:
    - packages/api/src/services/form-1042s.service.ts
    - packages/api/src/services/form-1042s-pdf.ts
    - packages/api/src/pdf-templates/form-1042s-recipient-copy.tsx
    - packages/api/src/routers/finance/form-1042s-router.ts
    - packages/api/src/routers/finance/__tests__/form-1042s-router-gating.test.ts
  modified:
    - packages/api/src/root.ts
    - packages/api/src/routers/finance/index.ts
    - packages/api/src/errors.ts
    - packages/api/src/services/__tests__/form-1042s.service.test.ts
    - packages/api/src/services/__tests__/form-1042s-pdf.test.ts

key-decisions:
  - "§875(d) gate short-circuits to 30% statutory BEFORE any treaty lookup when the W-8 chain is incomplete — a treaty benefit is never granted on an unsubstantiated chain, and the decision is flagged for escalation (never a silent skip)"
  - "resolveBox2Rate defaults to a DB-free US-treaty snapshot; the router injects the live applyTreaty. This keeps the gate unit-testable in the offline test env (fake localhost DB) while production reads the record-of-record WithholdingTaxRate table"
  - "Box figures are aggregated server-side from settled (PAID) USD payouts + the W-form on file; the client input carries only taxYear/formId (mass-assignment guard). Non-USD FX-settled payouts are out of scope for this reported-only core (US payment rail owns them)"
  - "REPORTED-ONLY: the 1042-S core never mutates a payout (verified: zero payment-write call paths in the service)"

patterns-established:
  - "1042-S mirrors the 1099-NEC engine with the chapter-3 differences (no de-minimis threshold, treaty §875(d) gate, FTIN in place of TIN)"
  - "Recipient-copy PDF render/archive mirrors form-1099-nec-pdf: lazy react-pdf, render-from-immutable-snapshot, CAS archive-slot claim, short-TTL signed URL"

requirements-completed: [US-FORM-06]

# Metrics
duration: 55min
completed: 2026-07-01
---

# Phase 87 Plan 04: 1042-S Deterministic Core Summary

**Form 1042-S non-transmit core — a §875(d)-gated chapter-3 withholding engine (treaty rate only on a complete W-8 chain, else 30% statutory), immutable one-transaction supersede, idempotent audited batch, a last-4-FTIN recipient PDF archived to the US R2 tax bucket, and a us-expansion-gated staff router — turning the Plan 87-01 RED scaffolds GREEN.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3 (all `auto`; 2 TDD) + 1 style cleanup
- **Files created:** 5 · **Files modified:** 5
- **Tests:** 13 passing (service 7 + pdf 4 + router-gating 2)

## Accomplishments

- **Task 1 — `form-1042s.service.ts` (`8b59e2f48`):** `resolveBox2Rate` implements the §875(d) gate (incomplete W-8 → 30% statutory + escalation flag, no treaty lookup; complete → resolved treaty rate + article); `routeFormType` routes from the W-form on file (W-8 → 1042-S, W-9 → 1099-NEC), never nationality; `buildForm1042SSnapshot` keeps `recipientFtinLast4` only and its sanitizer strips forged full-identifier keys (`ftin`/`tin`/`ssn`); `supersedeCorrected1042S` + `fileCorrection1042S` flip ACTIVE→SUPERSEDED then insert the new ACTIVE row in one `$transaction`, audited `form1042s.correction`; `generateBatch1042S` is idempotent (reserve/complete/clear), audited `form1042s.generate`, and REPORTED-only.
- **Task 2 — recipient-copy PDF (`6766af4b3`):** `form-1042s-recipient-copy.tsx` substitute black-ink template (box 1a income code, box 2 gross, box 3a/3b ch3, box 7 withheld, recipient 13j/13k status, 13n LOB, treaty article) with the FTIN masked to last-4; `renderForm1042SRecipientCopy` renders from the stored snapshot (never a live recompute); `renderAndArchiveRecipientCopy` uses a CAS guard (`updateMany where pdfArchiveKey: null`, `count===0` short-circuit), org-scoped key `1042-s/<orgId>/<id>.pdf`, and a 60s signed URL to the US R2 tax bucket.
- **Task 3 — staff router (`31c0597d3`):** `form1042sRouter` exposes `generateBatch`, `fileCorrection`, `getRecipientCopyUrl`, `list`, and a `contractorPii:read`-gated `revealRecipientFtin`; every procedure re-evaluates `assertUsExpansionEnabled` per request; inputs are Zod `.strict()` carrying only `taxYear`/`formId` (box figures aggregated server-side from settled USD payouts + the W-form on file); mounted behind the existing `isUsExpansionRegistered()` conditional spread in `root.ts` (METHOD_NOT_FOUND when the US surface is off). A load-time gating test proves `form1042s.*` is absent when the flag is OFF and present when ON.

## Verification

- `pnpm --filter @contractor-ops/api` (vitest) — `form-1042s.service` + `form-1042s-pdf` + `form-1042s-router-gating`: **13 passed**.
- `pnpm typecheck --filter=@contractor-ops/api` — **pass**.
- `pnpm lint:audit-log` — **pass** (no direct `auditLog.create` calls).
- Acceptance greps: audit actions ≥2 (2), `assertUsExpansionEnabled` ≥1 (7), org-scoped `1042-s/` key ≥1 (2), `applyTreaty` referenced in the service (6), payout-mutation call paths in the service: **0** (REPORTED-only).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Test infra] Added standard runtime mocks the RED scaffolds omitted**
- **Found during:** Tasks 1 & 2.
- **Issue:** The Plan 87-01 RED scaffolds fail by *module resolution* and were authored without runtime mocks. In the offline api test env (`UPSTASH` + `R2` point at placeholder hosts, `DATABASE_URL` is a fake localhost) the real `idempotency.reserve` and `putObjectAndSignDownload` **hang** (empirically verified: both hit their test timeouts), which would hang the GREEN suites.
- **Fix:** Added the exact test-infra mocks the shipped siblings already use — an in-memory idempotency store + no-op `writeAuditLog` (mirrors `form-1099-nec.service.test.ts`) to the service scaffold, and a stubbed `../r2` `putObjectAndSignDownload` (mirrors 10+ sibling pdf tests) to the pdf scaffold. **No pinned assertion was changed**; the react-pdf render still runs for real.
- **Files modified:** `form-1042s.service.test.ts`, `form-1042s-pdf.test.ts`.
- **Commits:** `8b59e2f48`, `6766af4b3`.

**2. [Rule 3 - DB-free gate default] `resolveBox2Rate` defaults to a DB-free treaty snapshot**
- **Found during:** Task 1.
- **Issue:** The service-test `resolveBox2Rate('GB', complete)` expects a treaty rate + article with no DB mock and no injected resolver; the live `applyTreaty` reads `prisma.withholdingTaxRate` against the fake test DB.
- **Fix:** Default `resolveBox2Rate` to an in-memory `US_TREATY_SNAPSHOT` (mirrors the seeded `WithholdingTaxRate` US business-profits rows — PL/DE/GB/IE/NL → Article 7, 0%), exactly the 1099 `SEEDED_THRESHOLDS_MINOR` / live-`getBox1ThresholdMinor` split; the router injects the live `applyTreaty` for the record-of-record.
- **Commit:** `8b59e2f48`.

**3. [Rule 3 - Blocking] Added `E.FORM_1042S_NOT_FOUND`**
- The router needed a not-found error constant (no generic `NOT_FOUND` exists); added one additively to `errors.ts`.
- **Commit:** `31c0597d3`.

**4. [Rule 1 - Hygiene] Dropped a stale RED-scaffold decision-ID breadcrumb** in `form-1042s.service.test.ts` (the service is now GREEN and the header cited `D-06 / D-07`), per `lint:no-breadcrumbs`.
- **Commit:** `d3cff7d2d`.

## Deferred Issues

- `lint:no-breadcrumbs` also flags decision-ID breadcrumbs in two **sibling-plan** RED scaffolds out of this plan's file scope (`us-determination-letter.test.tsx`, `form-1099k-tracker.service.test.ts`) — logged to `deferred-items.md` for their owning plans.
- **Wiki (`Documentation follows code`) not updated in this change set.** New services/router/namespace warrant `key-services.md` / `api-routers-catalog.md` / `us-expansion` domain-page updates; deferred to the phase-87 wiki-synthesis plan (shared wiki index files are concurrently edited by sibling phases in parallel worktrees — updating them here would conflict). Recorded so the synthesis plan picks it up.

## Known Stubs

- **Non-USD box-2 aggregation.** The router's `aggregateBox2GrossMinor` sums only settled **USD** payouts; FX-settled payouts are owned by the US payment rail (a later phase). Documented inline as a scope boundary — the reported-only 1042-S core does not FX-convert here. Not a blocking stub for US-FORM-06 (US-source income is USD).
- **`box1IncomeCode` default `'17'`** (independent personal services) is adviser-verify per tax year; carried on the snapshot alongside the adviser-verify note.

## Threat Flags

None beyond the plan's registered threat model. Full-FTIN reveal is `contractorPii:read`-gated + audited; box amounts/rate/org are server-derived; the snapshot + PDF carry FTIN last-4 only; supersede is append-only; batch + PDF archive are idempotent/CAS-guarded.

## Self-Check: PASSED

- All 5 created source files + SUMMARY + deferred-items present on disk.
- All 4 commits present in git history (`8b59e2f48`, `6766af4b3`, `31c0597d3`, `d3cff7d2d`).
