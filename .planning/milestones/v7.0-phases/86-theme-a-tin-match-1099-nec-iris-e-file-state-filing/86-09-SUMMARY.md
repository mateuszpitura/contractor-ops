---
phase: 86-theme-a-tin-match-1099-nec-iris-e-file-state-filing
plan: 09
subsystem: us-tax
tags: [us, tax, tin-match, backup-withholding, 1099-nec, money, shield, milestone-audit-gap]
gap-closed: TIN-MATCH-TRIGGER-UNWIRED (v7.0 milestone-audit gap #2, WARNING/money-code)
dependency-graph:
  requires: [tin-match.service, form-1099-nec.service, payment-shared.applyWithholding, ssn-crypto, integrations/tin-match]
  provides: [tin-match production trigger, Contractor.backupWithholdingFlagged producer]
  affects: [tax1099.generateBatch, contractor.updateUsProfile, 1099-NEC box-4, US payout backup withholding]
tech-stack:
  added: []
  patterns: [advisory-never-block, audit-in-tx, fail-closed-nullable-TIN, dark-live-client-behind-external-enrollment]
key-files:
  created: []
  modified:
    - packages/api/src/services/tin-match.service.ts
    - packages/api/src/routers/finance/tax-1099-router.ts
    - packages/api/src/routers/core/contractor-tax.ts
    - packages/api/src/services/__tests__/tin-match.service.test.ts
decisions:
  - The year-end batch (tax1099.generateBatch) is the canonical producer per Phase 88 deferred-items; the staff SSN/EIN-capture path (contractor.updateUsProfile) is the intake sibling (S4); the portal W-9 self-cert path is an intentional gap (holds only the TIN last-4).
  - Shipped MockTinMatchClient runs the whole trigger; the live EServicesTinMatchClient stays dark behind per-org PAF enrollment (EXTERNAL-ENABLEMENT row 5).
metrics:
  duration: ~1h
  tasks: 1
  files-changed: 12
completed: 2026-07-17
---

# Phase 86 Plan 09: TIN-match trigger wiring Summary

**Closed v7.0 milestone-audit gap #2 (TIN-MATCH-TRIGGER-UNWIRED): the TIN-match verify + backup-withholding writer had zero production callers, so the live payout read side (`applyWithholding`, 1099 box-4) read `Contractor.backupWithholdingFlagged` but nothing set it — now wired at the year-end 1099 batch and the staff SSN/EIN-capture intake path, advisory and never-blocking, with the flag+escalation+audit committed atomically in one transaction.**

## Shield Scope
- **Flow:** W-9/SSN intake (staff `updateUsProfile`) + year-end 1099 build (`tax1099.generateBatch`) → IRS TIN-match → set `Contractor.backupWithholdingFlagged` → (already-live) `applyWithholding` payout deduction + 1099 box-4
- **Surfaces touched:** staff tRPC (`tax-1099-router`, `contractor-tax`), service (`tin-match.service`)
- **Seams crossed:** router → tin-match service → injected `TinMatchClient` (Mock default; live `EServicesTinMatchClient` dark behind PAF) → persistence ports → Prisma tx
- **Pattern classes at risk:** S1, S2, S3, S4, T1, T7, T9
- **Reference:** Phase 88 `deferred-items.md` (§88 → Phase 86 trigger owner); EXTERNAL-ENABLEMENT row 5

## What was built

### Service (`tin-match.service.ts`)
- **`createTinMismatchEscalationWriter(tx, actorId)`** — the previously-missing concrete `createEscalation` port. Writes a `form1099.tin_mismatch.escalated` audit row on the caller's tx (last-4 only, USER actor when an id is supplied else SYSTEM). No dedicated escalation table exists — the mismatch also surfaces on the staff review list via the set flag (`tax1099.listTinMismatches`).
- **`revalidateYearEndTins(input, deps)`** — the year-end producer orchestrator. Runs `revalidateBatchTins` inside ONE `$transaction` with `createDbTinMatchPersistence({ setBackupWithholdingFlag: createBackupWithholdingFlagWriter(tx), createEscalation: createTinMismatchEscalationWriter(tx, actorId) }, tx)`, so on a mismatch the flag set + escalation + mismatch audit commit atomically (T1). Returns the mismatch recipient-id set so a fresh mismatch folds into the same batch's box-4 without re-reading the row.
- Refreshed the file header (removed the stale "no production callers yet" note — the seam is now wired).

### Year-end producer (`tax-1099-router.ts` → `generateBatch`)
- Selects `ssnEncrypted` + `countryFields`; resolves each recipient's full TIN server-side via `resolveRecipientTin` (`decryptSsn` for the SSN column, EIN from `countryFields`, narrowed — no unsafe cast). A recipient with no resolvable TIN (or a malformed SSN blob) is **skipped, fail-closed** (T9) with a structured warn — never matched on a fabricated value.
- Calls `revalidateYearEndTins` (wrapped in try/catch — a revalidation failure degrades to the stored flags and NEVER aborts the 1099 batch), then ORs a fresh mismatch into each recipient's `backupWithholdingFlagged` + `tinMismatch` for box-4.

### Intake sibling (`contractor-tax.ts` → `updateUsProfile`)
- When a full SSN/EIN is (re)captured (already format-validated), verifies it via `matchRecipientTin` in a `$transaction` with the same tx-bound persistence. Advisory / non-blocking (try/catch): the profile save always returns even if the match or its persistence fails.

### Client posture
- Both sites use the shipped deterministic `MockTinMatchClient`. The live `EServicesTinMatchClient` stays dark (it throws before any network call until PAF enrollment clears). Documented in EXTERNAL-ENABLEMENT row 5 with the precise live-swap delta (construct the live client + move the match calls outside the DB tx).

## Deviations from Plan

### Auto-added (Rule 2 — missing critical functionality)
**1. [Rule 2 - S4 sibling] Wired the staff intake SSN/EIN-capture path**
- **Why:** Phase 88 `deferred-items.md` assigned only the year-end batch, but the Shield S4 directive requires the intake sibling where applicable. `contractor.updateUsProfile` is where the full TIN actually lands (the portal W-9 snapshot strips it), and TIN-matching a freshly captured TIN is the correct IRS timing.
- **Files:** `contractor-tax.ts`
- **Commit:** 3a7c7372e

### Auto-added (Rule 2 — the missing concrete port)
**2. [Rule 2] `createTinMismatchEscalationWriter`** — `createDbTinMatchPersistence` requires a `createEscalation` writer; a real one (audit-row on tx) was missing, so the mismatch path could not be composed without a hollow escalation (S7). Added it. Commit 3a7c7372e.

### Documentation-follows-code (binding)
Updated the 6 wiki pages whose `verify_with` lists the changed source files (`us-tax-year-end-filing`, `irs-eservices-tin-matching`, `us-payment-rail`, `us-tax-forms`, `key-services`, `api-routers-catalog`), refined EXTERNAL-ENABLEMENT row 5, and marked the Phase 88 deferred item RESOLVED. Same change set as the code.

## Known Stubs
None. The trigger is a real production caller of the previously-unwired verify + writer; the mock client is the deterministic shipped default (not a stub — the live client is a separately-gated external enablement, not a placeholder).

## Threat Flags
None new. Reuses the existing US-tax trust boundary (SSN decrypt is `contractorPii`-gated at reveal; the year-end batch decrypts server-side under the already-gated `usExpansionProcedure` + `contractor:update`). The full TIN never reaches a log, cache key, audit row, or the persisted flag (boolean only).

## Residual risk
- **Monotonic flag (pre-existing, out of scope):** `createBackupWithholdingFlagWriter` sets `= true` only; clearing a corrected recipient is a separate admin concern (`resolveMismatch` currently audits without clearing). Inherent to the writer's spec — not introduced here. Flagged for a follow-up clear-path if backup withholding over-applies after a TIN correction.
- **Live-client tx shape:** with the Mock (pure, no network) running the match inside the tx is correct and instant. Enabling the live `EServicesTinMatchClient` must move the match calls outside the DB tx (documented in EXTERNAL-ENABLEMENT row 5) to avoid holding a transaction across the IRS network call.

## Verification (Shield T11)
- `pnpm --filter @contractor-ops/api test tin-match` → **14 passed** (9 pre-existing + 5 new, incl. the unmocked real-`MockTinMatchClient` seam for `revalidateYearEndTins`).
- `pnpm --filter @contractor-ops/api test form-1099 contractor-reveal-ssn tax-form-staff` → **60 passed** (touched-module + adjacent). The reveal-ssn suite's `updateUsProfile` mock ctx.db has no `$transaction`, so the intake TIN-match degrades via its try/catch — the SSN-storage contract holds and the suite stays green (proves advisory-never-block).
- `pnpm typecheck --filter @contractor-ops/api` → **clean**.
- `pnpm exec biome check` (4 touched files) + lint-staged on commit → **clean**; no breadcrumb IDs in source comments.
- `pnpm check:wiki-brain` → no NEW DOC_DRIFT for the changed `verify_with` files (the 2 reported errors are the gitignored local graph.json/bm25 artifacts absent in the fresh worktree — CI treats these WARN-only).

## Self-Check: PASSED
- `packages/api/src/services/tin-match.service.ts` — FOUND (modified, +`revalidateYearEndTins` / `createTinMismatchEscalationWriter`)
- `packages/api/src/routers/finance/tax-1099-router.ts` — FOUND (modified)
- `packages/api/src/routers/core/contractor-tax.ts` — FOUND (modified)
- Commit `3a7c7372e` — FOUND on `worktree-agent-a986c1c7c48227f15`.

## Shield Verdict
- **Patterns:** S1 PASS (year-end + intake production callers now exist for `matchRecipientTin` / `revalidateYearEndTins` / `createBackupWithholdingFlagWriter` / `createDbTinMatchPersistence`); S2 PASS (unmocked round-trip seam test drives the real `MockTinMatchClient` → real factories → mock tx); S3 PASS (`Contractor.backupWithholdingFlagged` is the single authoritative column both producers write and `applyWithholding`/box-4 read); S4 PASS (staff year-end + staff intake wired; portal self-cert documented intentional gap); T1 PASS (`writeAuditLog({ tx })` — flag+escalation+audit atomic); T7 PASS (regional `ctx.db` / tx only); T9 PASS (NULL/invalid TIN skipped fail-closed, never a fabricated match).
- **Seams tested:** `packages/api/src/services/__tests__/tin-match.service.test.ts` — "year-end revalidation trigger (real MockTinMatchClient seam)" + "mismatch escalation writer".
- **Verify run:** tin-match 14/14, adjacent 60/60, typecheck clean, biome clean — all green.
- **Residual risk:** monotonic flag (pre-existing, out of scope) + live-client-tx-shape at PAF enablement (documented) — see above; nothing blocking.
