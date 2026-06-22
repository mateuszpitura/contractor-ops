---
phase: 88-theme-a-us-payment-rail
plan: 01
subsystem: payments
tags: [nacha, ach, fedwire, pacs008, withholding, plaid, modern-treasury, exchange-rate, tdd, red-scaffold]

# Dependency graph
requires:
  - phase: 86-theme-a-tin-1099-iris-state
    provides: "calculateWht SA path, tin-match setBackupWithholdingFlag port, computeBox4Minor input contract"
  - phase: 85-w-form-intake-tax-treaty-engine
    provides: "applyTreaty (1042-S treaty rate + article)"
provides:
  - "Six Wave-0 test contracts pinned before implementation: generateNachaFile, generateFedwirePacs008, applyWithholding (generalized deduction), USD settlement FX guard, Modern Treasury PayoutInitiationAdapter mock, Plaid PlaidIdentityClient mock"
  - "GREEN Saudi-WHT regression guard locking the existing calculateWht baseline before generalization"
  - "GREEN F-1 currency contract lock (no USD=1.0 special-case; missing rate → null)"
affects: [88-02, 88-03, 88-04, 88-05, 88-06, 88-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Terminal-RED Wave-0 scaffolds: API files RED via missing export (is not a function); integrations files RED via missing module (Cannot find module)"
    - "GREEN regression guard co-located with a RED generalization scaffold to lock pre-change behavior"

key-files:
  created:
    - packages/api/src/services/__tests__/payment-export-nacha.test.ts
    - packages/api/src/services/__tests__/payment-export-fedwire.test.ts
    - packages/api/src/services/__tests__/payment-withholding.test.ts
    - packages/api/src/services/__tests__/payment-currency.test.ts
    - packages/integrations/src/__tests__/modern-treasury-adapter.test.ts
    - packages/integrations/src/__tests__/plaid-adapter.test.ts
  modified:
    - packages/integrations/tsconfig.json

key-decisions:
  - "API RED scaffolds use missing-export RED (is not a function); the api tsconfig already excludes __tests__ so the RED never bricks typecheck"
  - "Integrations RED scaffolds use missing-module RED (Cannot find module); excluded __tests__ from the integrations tsconfig to mirror api/db so the RED does not brick tsc --noEmit / the composite build"
  - "Saudi-WHT regression captured as a deterministic GREEN guard against calculateWht (SA-only gate + SA→SA domestic short-circuit), not a DB-seeded SA payout — locks the math without a seeded test DB"
  - "Currency scaffold is a GREEN F-1 contract lock (USD is a normal ECB currency); pins convertAmount(USD→USD)=rate 1, USD↔EUR via stored rate, missing rate → null — guards against a future USD=1.0 special-case"
  - "Zero new external dependencies — NACHA hand-rolled later; modern-treasury/plaid SDKs deferred to live paths behind a checkpoint:human-verify"

patterns-established:
  - "Wave-0 anchor set: every downstream task turns exactly one of these RED green"
  - "Provider-adapter seam scaffolds mirror the tin-match client seam (interface + deterministic mock default + flag-dark live concrete)"

requirements-completed: []  # NONE — phase 88 is 1/7 plans (scaffolds only); US-PAY-* stay [ ] until the implementation + [BLOCKING] migration waves land.

# Metrics
duration: ~9min
completed: 2026-06-22
---

# Phase 88 Plan 01: US Payment Rail — Wave-0 RED Scaffolds Summary

**Six failing Wave-0 test contracts pin the US payment rail (NACHA ACH file, Fedwire pacs.008, generalized withholding deduction, USD settlement FX, Modern Treasury + Plaid adapter mocks) before any implementation, with a GREEN Saudi-WHT regression guard locking the existing withholding math.**

## Performance

- **Duration:** ~9 min (active execution; spans 02:13–02:20)
- **Started:** 2026-06-22T02:06:00Z
- **Completed:** 2026-06-22T02:20:34Z
- **Tasks:** 2 of 2 complete
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments

### Task 1 — NACHA + Fedwire generator RED scaffolds (commit 076ab9968)

- `payment-export-nacha.test.ts` pins the NACHA ACH credit-file contract against an obviously-synthetic 3-entry fixture (ABA test routing 021000021, sequential placeholder accounts): 94-char records; record-type order 1 (file header) / 5 (batch header) / 6 (entry detail) / 8 (batch control) / 9 (file control); entry hash = Σ(first-8-digit RDFI routing) mod 10^10; total credit = Σ amount in cents; line count padded to a multiple of 10 with all-9 records; service class 220, SEC PPD, transaction code 22 defaults. Mirrors `generateBacsStandard18`.
- `payment-export-fedwire.test.ts` pins the `pacs.008.001.xx` envelope: GrpHdr MsgId/CreDtTm/NbOfTxs, control sum = Σ amount, one CdtTrfTxInf per item, XML escaping. Mirrors `generateSwiftXml` (pain.001.001.09 → pacs.008).
- Both fail RED on the missing production symbol: `generateNachaFile is not a function` (9 cases) and `generateFedwirePacs008 is not a function` (suite collection).

### Task 2 — Withholding, currency + provider-adapter scaffolds (commits 7275d22ad, ae3c255f6)

- `payment-withholding.test.ts` — RED for the generalized `applyWithholding` (amountMinor = grossAmountMinor − whtAmountMinor; whtAmountMinor = HALF-UP round of gross·rate/100 for a US contractor with `backupWithholdingFlagged` at 24% IRC §3406, and a 1042-S foreign recipient at a treaty rate). Co-located GREEN Saudi-WHT regression guard locks `calculateWht` (SA-only gate returns null off SA; SA→SA domestic returns null). Result: 5 tests = 3 RED (`applyWithholding is not a function`) + 2 GREEN.
- `payment-currency.test.ts` — GREEN F-1 contract lock against `convertAmount` with a minimal Prisma-shaped db stub: USD→USD rate 1, EUR↔USD via the stored ECB rate, USD→EUR through EUR base, missing rate → null (no coerced 1.0).
- `modern-treasury-adapter.test.ts` — RED for the `PayoutInitiationAdapter` seam: deterministic `MockModernTreasuryAdapter.initiatePayout` returning a payment_order whose status is in the pending→…→reconciled lifecycle, idempotent on the same key; `LiveModernTreasuryAdapter` refuses while flag-dark.
- `plaid-adapter.test.ts` — RED for the `PlaidIdentityClient` seam: `MockPlaidIdentityClient.verify` returns VERIFIED/PENDING/FAILED; an unverified account surfaces an advisory warning and never throws (fail-open, mirrors USPS).
- Integrations RED via `Cannot find module '../adapters/{modern-treasury,plaid}-adapter.js'`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Excluded `__tests__` from the integrations tsconfig**
- **Found during:** Task 2 (the two integrations adapter scaffolds)
- **Issue:** The plan places the adapter scaffolds in `packages/integrations/src/__tests__/`, but that package's `tsconfig.json` (`include: ["src/**/*.ts"]`) did NOT exclude the test directory — unlike `packages/api` and `packages/db`, which both exclude `src/**/__tests__/**`. A terminal-RED scaffold importing a not-yet-existing adapter module emits `error TS2307: Cannot find module` and breaks both `pnpm typecheck --filter=@contractor-ops/integrations` and the composite build (`noEmitOnError: true`). Confirmed with a throwaway probe (TS2307) which was then removed.
- **Fix:** Added `"src/**/__tests__/**"` to the integrations tsconfig `exclude`, mirroring the established api/db convention. Verified safe: nothing imports from `dist/__tests__`, no `exports` entry points there, and `dist/` is gitignored — test files were never a consumed build artifact. Integrations typecheck passes (8 successful) with the RED scaffolds present.
- **Files modified:** packages/integrations/tsconfig.json
- **Commit:** 7275d22ad

Otherwise the plan executed as written.

## Verification

- `payment-export-nacha` → 9 RED (`generateNachaFile is not a function`); `payment-export-fedwire` → RED (`generateFedwirePacs008 is not a function`).
- `payment-withholding` → 3 RED (`applyWithholding is not a function`) + 2 GREEN (Saudi-WHT regression guard); `payment-currency` → GREEN (F-1 lock).
- `modern-treasury-adapter` + `plaid-adapter` → RED (`Cannot find module`).
- `git status --short -- '**/package.json' pnpm-lock.yaml` → empty (zero new dependencies).
- `pnpm lint:no-breadcrumbs` → OK; biome → clean (import ordering autofixed pre-commit); `pnpm typecheck --filter=@contractor-ops/integrations` → 8 successful.

## Known Stubs

None. These are intentional terminal-RED test scaffolds (the Nyquist anchor set); each turns GREEN when its downstream implementation wave lands. They are not product stubs flowing empty data to a UI.

## Notes for Downstream Plans

- **88-03** owns the `applyWithholding` generalization — the SA branch must stay byte-identical (the GREEN regression guard in `payment-withholding.test.ts` enforces this) and add the US 24% backup-withholding + 1042-S treaty branches AROUND it, plus the `Contractor.backupWithholdingFlagged` column read.
- **88-01..05/04** own `generateNachaFile`, `generateFedwirePacs008`, the Modern Treasury + Plaid adapters, and the USD detect-format routing — each has a pinned contract here.
- US-PAY-* requirements remain `[ ]` — not satisfied by scaffolds.

## Self-Check: PASSED

All 6 created scaffolds + the SUMMARY exist on disk; all 3 commits (076ab9968, 7275d22ad, ae3c255f6) exist in the git log.
