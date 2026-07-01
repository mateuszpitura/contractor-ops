---
phase: 88-theme-a-us-payment-rail
plan: 04
subsystem: payments
tags: [nacha, ach, fedwire, pacs008, iso20022, us-payment-rail, settlement, export, tdd]

# Dependency graph
requires:
  - phase: 88-01
    provides: terminal-RED NACHA + Fedwire golden-file scaffolds; ExportFormat union seam
  - phase: 88-02
    provides: ACH_NACHA + FEDWIRE PaymentExportFormat Prisma enum + US bank encrypted/masked columns
  - phase: 88-03
    provides: generalized withholding (applyWithholding / applyWithholdingToRun) on the seeding path
  - phase: 88-05
    provides: resolveSettlementCurrency + convertForSettlement seam consumed on the export path
provides:
  - "generateNachaFile — hand-rolled, zero-dependency NACHA ACH credit file (94-char 1/5/6/8/9 records, entry hash, balanced control totals, 10-line block padding, service class 220 + SEC PPD + txn 22 defaults, SEC/txn parameterizable)"
  - "generateFedwirePacs008 — ISO 20022 pacs.008.001.08 FI-to-FI customer credit transfer XML mirroring generateSwiftXml (Fedwire CLRG/FDW settlement block; adviser-verify)"
  - "detectUsFormat(currency, isUsBank, amountMinor, sameDayCeilingMinor) + sameDayAchCeilingMinor(asOf) — USD+US-bank routing to ACH_NACHA / above-ceiling FEDWIRE, ceiling a dated config ($1M now, $10M from 2027-09-17)"
  - "_generateExportFileForFormat ACH_NACHA + FEDWIRE dispatch branches (surface NACHA warnings)"
  - "_buildExportItems settlement wiring — resolveSettlementCurrency + convertForSettlement on the export path; the export file carries the settled amount, missing rate throws instead of zeroing"
affects: [88-06, 88-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NACHA hand-rolled on the BACS fixed-width scaffold (padField/padZero + per-record hard-length guard) — zero new dependency"
    - "Fedwire = ISO 20022 pacs.008 XML mirroring the SWIFT pain.001 generator (no legacy FAIM flat file)"
    - "Same-Day ACH ceiling is a dated config function, not a constant baked into the routing rule"
    - "Settlement conversion delegates verbatim to the 88-05 seam (convertForSettlement) — no re-implemented FX; a missing rate surfaces UNPROCESSABLE_CONTENT, never a zeroed payout"

key-files:
  created:
    - packages/api/src/routers/finance/__tests__/payment-export-settlement.test.ts
  modified:
    - packages/api/src/services/payment-export.ts
    - packages/api/src/services/payment-format-detection.ts
    - packages/api/src/routers/finance/payment-shared.ts
    - packages/api/src/routers/finance/payment-export-router.ts
    - packages/api/src/errors.ts
    - packages/api/src/services/__tests__/payment-export-nacha.test.ts
    - packages/api/src/services/__tests__/payment-export-fedwire.test.ts
    - packages/api/src/services/__tests__/payment-format-detection.test.ts
    - packages/api/src/routers/__tests__/payment.test.ts

key-decisions:
  - "NACHA hand-rolled with zero dependencies (mirrors generateBacsStandard18) — the recommended posture per RESEARCH; @midlandsbank/node-nacha explicitly not installed (no exposed source repo)."
  - "Unbalanced credit-only NACHA batch (service class 220, SEC PPD, txn 22) by default; SEC/txn are parameters (CCD/CTX, savings 32). Balanced-vs-unbalanced is ODFI-dependent — annotated adviser-verify."
  - "Fedwire delivered as a pacs.008.001.08 XML the operator hands to their bank; live FedLine transmission is a deferred bank channel (annotated adviser-verify)."
  - "Same-Day ACH ceiling modelled as sameDayAchCeilingMinor(asOf) returning $1M before 2027-09-17 and $10M on/after — config, not a constant; detectUsFormat takes the resolved ceiling as a parameter."
  - "_buildExportItems settles each item before the buffer is built; a missing ECB rate throws UNPROCESSABLE_CONTENT (new E.PAYMENT_SETTLEMENT_RATE_UNAVAILABLE) rather than settling a zeroed amount (Pitfall 3)."

patterns-established:
  - "The export path now consumes the 88-05 settlement seam (no longer dead code); 88-06's programmatic payout threads the per-run settlement-currency override into the same resolveSettlementCurrency call."

requirements-completed: [US-PAY-01, US-PAY-04]

# Metrics
duration: ~30min
completed: 2026-07-01
---

# Phase 88 Plan 04: NACHA + Fedwire US Export Formats Summary

**Added the two US export-format generators to the payment-export factory — a hand-rolled zero-dependency NACHA ACH credit file (mirroring `generateBacsStandard18`) and a Fedwire ISO 20022 `pacs.008.001.08` XML (mirroring `generateSwiftXml`) — plus the `detectUsFormat` routing with the Same-Day ACH ceiling as a dated config, the `_generateExportFileForFormat` dispatch branches, and the wiring that runs the 88-05 settlement conversion in `_buildExportItems` so the export file carries the settled amount, not the raw run amount.**

## Performance

- **Duration:** ~30 min (includes fresh-worktree dependency install)
- **Tasks:** 2 (both TDD)
- **Files:** 1 test created, 9 modified (5 source, 4 test)

## Accomplishments

- **Task 1 (NACHA):** `generateNachaFile` hand-rolled on the BACS fixed-width scaffold — 94-char records in 1/5/6/8/9 order, entry hash = Σ(first-8-digit RDFI routing) mod 10^10, balanced batch/file control totals, all-9 block padding to a multiple of 10, service class 220 + SEC PPD + txn 22 defaults (SEC/txn parameterizable), per-record hard-length guard, amount-overflow throw. Zero new dependencies. The 88-01 golden-file scaffold (9 assertions) turns green.
- **Task 2 (Fedwire + routing + settlement):**
  - `generateFedwirePacs008` emits a pacs.008.001.08 FI-to-FI customer-credit-transfer XML with a Fedwire `CLRG`/`FDW` settlement block, one `CdtTrfTxInf` per item, and a control sum equal to Σ amount — the 88-01 scaffold turns green.
  - Extended the `ExportFormat` union with `ACH_NACHA` + `FEDWIRE`; added `detectUsFormat` + `sameDayAchCeilingMinor(asOf)` (config `$1M` now, `$10M` from 2027-09-17; the routing flips at ceiling + 1).
  - Added the `ACH_NACHA` + `FEDWIRE` branches to `_generateExportFileForFormat` (ext `txt`/`xml`), surfacing NACHA receiver-name warnings rather than dropping them.
  - Wired the settlement conversion into `_buildExportItems`: each item's settlement currency is resolved (per-run override, else contractor currency) and converted at the payment-date ECB rate via `convertForSettlement`, so the emitted `ExportItem` carries the settled amount/currency. A missing rate throws `UNPROCESSABLE_CONTENT` — never a silently zeroed payout.

## Task Commits

1. **Task 1 RED** — un-skip NACHA golden-file scaffold — `383f6f805` (test)
2. **Task 1 GREEN** — hand-roll `generateNachaFile` — `444893f84` (feat)
3. **Task 2 RED** — Fedwire pacs.008 + `detectUsFormat` + settlement scaffolds — `a4d2d826f` (test)
4. **Task 2 GREEN** — Fedwire generator + US routing + dispatch + settlement wiring — `9e90a0a60` (feat)
5. **Breadcrumb fix** — drop `(D-07)` from a test header (lint:no-breadcrumbs) — `b48576daf` (style)

_Each task followed RED → GREEN; no REFACTOR commits needed (both generators are minimal). Plan metadata committed with this SUMMARY. STATE.md / ROADMAP.md intentionally NOT touched — the orchestrator owns those writes after the wave (worktree mode)._

## Decisions Made

See `key-decisions` frontmatter. In short: NACHA hand-rolled zero-dep (unbalanced credit-only 220/PPD/22 default, adviser-verify), Fedwire as pacs.008 XML (bank-channel transmission deferred), the ceiling is a dated config function, and the export path settles via the 88-05 seam with a missing-rate throw rather than a zeroed amount.

## Deviations from Plan

### Auto-fixed / auto-added (Rules 1-3)

**1. [Rule 3 - Blocking] Updated `payment-export-router.ts` (outside declared `files_modified`).**
- **Found during:** Task 2. Wiring settlement into `_buildExportItems` changed its signature (now `async`, takes `db` + a `settlement` param, and reads `contractor.currency`).
- **Fix:** The single production caller (`payment-export-router.ts:303`) was updated to `await _buildExportItems(ctx.db, prepared.run.items, template, { paymentDate: new Date() })`, and the contractor `select` gained `currency: true`. Required to compile; the plan's `<interfaces>` already documented this call site.
- **Commit:** `9e90a0a60`.

**2. [Rule 2 - Correctness] Added `E.PAYMENT_SETTLEMENT_RATE_UNAVAILABLE`.**
- **Found during:** Task 2. The missing-rate throw needs a message key (CLAUDE.md: tRPC errors use `E.*` constants).
- **Fix:** Added `PAYMENT_SETTLEMENT_RATE_UNAVAILABLE = 'paymentSettlementRateUnavailable'` to `errors.ts`.
- **Commit:** `9e90a0a60`.

**3. [Rule 1 - Test fixture] `payment.test.ts` lockAndExport fixture gained `contractor.currency: 'PLN'`.**
- **Found during:** Task 2. The new settlement wiring reads `contractor.currency`; the existing fixture omitted it, which would have produced a cross-currency FX lookup against an unstubbed rate.
- **Fix:** Set `currency: 'PLN'` (matching the run currency) so settlement short-circuits to rate 1 (no FX lookup, amount unchanged) — preserving the test's asserted behavior. All existing lockAndExport / audit / race-security tests stay green.
- **Commit:** `9e90a0a60`.

**4. [Rule 2 - Completeness] Extended `ExportItem` (`usRoutingNumber?`/`usAccountNumber?`) + `OrgBankInfo` (optional ACH origination fields), populated from org settings in `_resolveOrgBankInfo`.**
- **Reason:** the NACHA generator needs routing/account + hand-set ODFI origin. These optional fields let the dispatch build a real NACHA file when the data is present, and `_resolveOrgBankInfo` reads `settingsJson.achOrigin` defensively (mirroring the existing untyped `paymentTransferTitleTemplate` read). Absent config serializes blank origin fields (still structurally valid 94-char records).
- **Commit:** `9e90a0a60`.

## Verification

- `pnpm --filter @contractor-ops/api exec vitest run payment-export-nacha payment-export-fedwire payment-format-detection payment-export payment-export-settlement` → 5 files, 119 tests, all GREEN.
- Regression sweep (`payment.test.ts`, `payment-export-race.security.test.ts`, `audit-mutation-coverage.test.ts`, `payment-run-compliance-check.test.ts`, `payment-settlement.test.ts`) → 11 files, 203 tests, all GREEN.
- `pnpm typecheck --filter=@contractor-ops/api` → 14/14 tasks successful.
- Settlement invoked on the export path: `grep -nE 'resolveSettlementCurrency|convertForSettlement' packages/api/src/routers/finance/payment-shared.ts` matches inside `_buildExportItems` (lines 331/336).
- `git diff <base> -- '**/package.json'` → no dependency changes (NACHA hand-rolled; `@midlandsbank/node-nacha` NOT installed — T-88-SC).
- `pnpm lint:no-breadcrumbs` → clean. `pnpm lint:logs` → clean (2343 files; NACHA/dispatch warnings use `@contractor-ops/logger`, no `console.*`).

## Threat Model Coverage

All dispositions in the plan's threat register are addressed:
- **T-88-04-01** (account/routing disclosure): generators receive already-decrypted values from the router and never log full account/routing (only `log.warn` on receiver-name transliteration counts).
- **T-88-04-02** (balance/hash/blocking tampering): per-record 94-char hard guard + entry-hash + control-total formulas unit-tested against the golden fixture.
- **T-88-04-03** (ceiling drift): ceiling is `sameDayAchCeilingMinor(asOf)` config, boundary-tested at ceiling + 1 and at the 2027 value.
- **T-88-04-04** (missing-rate silent zero): `_buildExportItems` throws `UNPROCESSABLE_CONTENT` on a null rate; single HALF-UP round delegated to `convertAmount`.
- **T-88-SC** (NACHA dep): zero new dependency.

No new threat surface beyond the register — no Threat Flags.

## Known Stubs / Deferred (owned by 88-06 / 88-07)

- **The `lockAndExport` input enum still exposes only CSV/BANK_FILE/SEPA_XML/SWIFT_XML** (`paymentExportFormatEnum` in `packages/validators`). `ACH_NACHA`/`FEDWIRE` are not yet selectable through that input, so the new dispatch branches are reachable via the `_generateExportFileForFormat` unit tests today and become reachable end-to-end when **88-06** threads the format selection (and the decrypted US routing/account into `ExportItem.usRoutingNumber`/`usAccountNumber`) through the programmatic payout path. This is a documented forward-dependency — the generators, routing rule, dispatch branches, and settlement wiring are all real and tested; nothing here is a placeholder that blocks the plan goal (US-PAY-01 NACHA generator + US-PAY-04 Fedwire generator + config ceiling + settled export path are complete).
- **Per-run settlement-currency override** is a parameter of `_buildExportItems`; the file-export router passes `undefined` (default = contractor currency). The override input is **88-06**'s `initiatePayout` Zod field — the unit test already exercises the override branch.
- **Wiki synthesis** (`wiki/structure/key-services.md` NACHA/Fedwire entries + the US-payout-rail domain page) is owned by **88-07**, consistent with the 88-02 / 88-05 precedent; `payment-export.ts` / `payment-format-detection.ts` are not referenced by any wiki page's `verify_with`, so this change introduces no `check:wiki-brain` drift.

## Self-Check: PASSED

- Files verified present: `payment-export-settlement.test.ts` (created); `payment-export.ts`, `payment-format-detection.ts`, `payment-shared.ts`, `payment-export-router.ts`, `errors.ts` (modified).
- Commits verified present: `383f6f805`, `444893f84`, `a4d2d826f`, `9e90a0a60`, `b48576daf`.
- TDD gate compliance: a `test(...)` RED commit precedes each `feat(...)` GREEN commit (Task 1: `383f6f805` → `444893f84`; Task 2: `a4d2d826f` → `9e90a0a60`).

---
*Phase: 88-theme-a-us-payment-rail*
*Completed: 2026-07-01*
