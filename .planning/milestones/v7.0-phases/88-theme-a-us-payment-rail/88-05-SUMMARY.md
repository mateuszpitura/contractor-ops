---
phase: 88-theme-a-us-payment-rail
plan: 05
subsystem: payments
tags: [usd, fx, exchange-rate, settlement-currency, ecb, withholding, tdd]

# Dependency graph
requires:
  - phase: 88-01
    provides: USD-first-class currency scaffold (payment-currency.test.ts contract lock) + US-expansion region/flag substrate
  - phase: 88-02
    provides: schema columns (Contractor.currency already existed; ACH_NACHA/FEDWIRE enum) the US export path settles against
provides:
  - "resolveSettlementCurrency({ contractorCurrency, perRunOverride? }) — per-payout settlement-currency choice defaulting Contractor.currency, override wins, blank override treated as unset"
  - "convertForSettlement(db, amountMinor, fromCurrency, settlementCurrency, paymentDate) — payment-date ECB-rate conversion delegating to exchange-rate.convertAmount; rate 1 on same-currency, null on a missing rate (no silent zero)"
  - "USD-cross-rate guard tests proving USD is a normal ECB currency (no USD=1.0 short-circuit) — USD->PLN cross-rates through EUR and a missing USD leg returns null"
affects: [88-04, 88-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Settlement-currency resolution is a thin pure function + a verbatim delegate to convertAmount — never re-implements FX math (Don't-Hand-Roll)"
    - "Missing-rate surfaces as null (caller errors) rather than a coerced 1.0 or a silently zeroed amount"
    - "USD proven first-class through the existing EUR-based ECB cross-rate path, not via a special-case short-circuit (RESEARCH F-1)"

key-files:
  created:
    - packages/api/src/services/payment-settlement.ts
    - packages/api/src/services/__tests__/payment-settlement.test.ts
  modified:
    - packages/api/src/services/__tests__/payment-currency.test.ts

key-decisions:
  - "exchange-rate.ts left unchanged — USD is already in the ECB feed (EUR->USD) and convertAmount already cross-rates + short-circuits same-currency; adding a USD=1.0 short-circuit would mask a genuine missing-rate-on-holiday null (F-1 / Pitfall 3)"
  - "Settlement-currency choice surfaces per-run with a Contractor.currency fallback (CONTEXT Claude's-discretion: per-run-with-contractor-currency-default), via the perRunOverride parameter threaded from the 88-06 initiatePayout Zod input"
  - "A blank/whitespace perRunOverride is treated as unset so an empty choice never collapses the settlement currency to an empty string (Rule 2 defensive correctness)"

patterns-established:
  - "resolveSettlementCurrency + convertForSettlement are the stable seam the 88-04 export path (_buildExportItems) and the 88-06 initiatePayout override consume unchanged"
  - "convertForSettlement delegates to convertAmount — single HALF-UP round, integer minor units, never chained (money-rounding pattern)"

requirements-completed: [US-PAY-02]

# Metrics
duration: ~14min
completed: 2026-07-01
---

# Phase 88 Plan 05: USD First-Class + Settlement Currency Summary

**USD made first-class through the existing EUR-based ECB FX path (no special-case short-circuit) plus a thin `payment-settlement.ts` seam — `resolveSettlementCurrency` (per-run override or Contractor.currency default) + `convertForSettlement` (payment-date ECB rate via `convertAmount`, null on a missing rate) — ready for the 88-04 export path and 88-06 payout override to consume.**

## Performance

- **Duration:** ~14 min (includes worktree dependency install)
- **Started:** 2026-07-01T01:28:00Z (approx)
- **Completed:** 2026-07-01T01:42:00Z
- **Tasks:** 2 (Task 1 auto, Task 2 TDD)
- **Files modified:** 3 (1 service created, 1 test created, 1 scaffold extended)

## Accomplishments
- Proved USD is a normal ECB currency, not a special case: extended the 88-01 contract lock with a USD->PLN cross-rate guard (cross-rates through EUR) and a missing-USD-leg-returns-null guard — so no future wave can regress USD into a `USD=1.0` short-circuit that would mask a genuinely missing rate. `exchange-rate.ts` needed (and got) zero production changes.
- Created `payment-settlement.ts`: `resolveSettlementCurrency` (per-run override wins, else `Contractor.currency`, blank override treated as unset) + `convertForSettlement` (delegates verbatim to `convertAmount` at the payment-date ECB rate — rate 1 on same-currency, null on a missing rate so a payout is never silently zeroed).
- Designed the service as the stable seam (signatures fixed per the plan `<interfaces>`) that 88-04's `_buildExportItems` and 88-06's `initiatePayout` per-run override consume unchanged — wiring lands in those plans.

## Task Commits

Each task was committed atomically:

1. **Task 1: USD guard test on exchange-rate (F-1, no short-circuit)** - `b77590794` (test)
2. **Task 2 RED: failing settlement-currency + FX tests** - `91b333faa` (test)
3. **Task 2 GREEN: payment-settlement.ts service** - `e15dee499` (feat)

_TDD task 2 = RED (`91b333faa`) → GREEN (`e15dee499`); no REFACTOR commit needed (the service is already minimal)._

**Plan metadata:** committed with this SUMMARY (docs). STATE.md / ROADMAP.md intentionally NOT touched — the orchestrator owns those writes after the wave (worktree mode).

## Files Created/Modified
- `packages/api/src/services/payment-settlement.ts` - `resolveSettlementCurrency` + `convertForSettlement`; reuses `convertAmount`, the seam for the 88-04 export path + 88-06 override
- `packages/api/src/services/__tests__/payment-settlement.test.ts` - override-wins / contractor-default / blank-unset + same-currency-rate-1 / cross-currency-payment-date-rate / missing-rate-null
- `packages/api/src/services/__tests__/payment-currency.test.ts` - extended the 88-01 USD contract lock with a USD->PLN cross-rate guard + a missing-USD-leg null guard

## Decisions Made
- **No `USD=1.0` short-circuit added; `exchange-rate.ts` unchanged.** USD is already present in the ECB feed (`EUR->USD`) and `convertAmount` already cross-rates and short-circuits same-currency to rate 1. Per RESEARCH F-1 / Pitfall 3, a USD short-circuit's stated premise ("USD absent from ECB") is wrong and would mask a genuine missing-rate-on-holiday `null`. The guard tests pin the existing correct behavior instead.
- **Per-run settlement-currency choice with `Contractor.currency` default** (CONTEXT Claude's-discretion D-07). The choice is a `perRunOverride` parameter — the value the 88-06 `initiatePayout` Zod input threads in — defaulting to the contractor's currency when absent.
- **Blank override = unset.** A whitespace/empty `perRunOverride` falls back to the contractor currency rather than producing an empty settlement currency.
- **`convertForSettlement` is a verbatim delegate to `convertAmount`** — no re-implemented FX math, one HALF-UP round, integer minor units, `null` propagated on a missing rate.

## Deviations from Plan

None - plan executed exactly as written.

Task 1 found the 88-01 scaffold (`payment-currency.test.ts`) already locked the three required USD assertions (USD->USD rate 1, USD<->EUR via the stored rate, missing-rate->null) and that `convertAmount` already handles USD — so the plan's "if exchange-rate.ts needs no code change, leave it unchanged and note that" path applied. The committable Task 1 deliverable is the additional USD->PLN cross-rate guard that proves USD is not special-cased even for cross-currency (the real `getRate` lookup runs for the USD leg). This is within the plan's explicit "extend the exchange-rate test" instruction, not a scope change.

## Issues Encountered
- **Worktree had no installed dependencies** (fresh worktree). Resolved with `pnpm install --frozen-lockfile --prefer-offline` (hardlinked from the populated store; frozen lockfile → no new resolution, so the 7-day release-age gate did not trigger). Postinstall rebuilt tracked compiled artifacts `packages/validators/src/legal/de.{d.ts,js}` — left unstaged as out-of-scope build churn (same as 88-02).
- **No reachable local Postgres** (port 5432 closed) — acceptable: every test here uses a minimal Prisma-shaped stub (`exchangeRate.findFirst`), so no live DB is needed. Verification ran fully on unit tests + typecheck.

## Verification
- `pnpm --filter @contractor-ops/api exec vitest run payment-currency exchange-rate payment-settlement` → 4 files, 28 tests, all GREEN.
- `pnpm typecheck --filter=@contractor-ops/api` → 14/14 tasks successful.
- `pnpm lint:logs` → clean (2343 files, no `console.*`).
- `pnpm lint:no-breadcrumbs` → clean (no planning-ID comments in the new source).
- No `USD=1.0` short-circuit added — `exchange-rate.ts` byte-unchanged vs base `42f4412f5` (F-1 honored).

> Note: the plan's verify uses `pnpm --filter ... test -- <names>`; the `--` passes through to `vitest run` literally and does NOT scope (it runs the full ~330-file suite, surfacing a pre-existing unrelated `rbac-recipients.test.ts` failure in the Phase-89 worker-RBAC area). The scoped, RAM-safe equivalent `pnpm --filter @contractor-ops/api exec vitest run <names>` was used and is GREEN for all three areas. The `rbac-recipients` failure exists on base `42f4412f5` independent of this plan (out of scope; logged for the orchestrator).

## Deferred Issues
- **Documentation-follows-code (wiki) deferred to 88-07.** `payment-settlement.ts` is a brand-new service not yet referenced by any wiki page's `verify_with`, so no `check:wiki-brain` drift is introduced by this change. Phase-88 wiki synthesis (`wiki/structure/key-services.md` entry for the settlement seam + the `us-payment-rail` domain page + `wiki/patterns/money-rounding.md` settlement note) is explicitly owned by plan **88-07**, consistent with the 88-02 precedent (and Phase 89's 89-06). The phase-level CI gate is satisfied once 88-07 lands in the merged phase diff.
- **Downstream wiring is owned by 88-04 / 88-06.** The "seam is consumed, not dead code" guarantee is satisfied at the contract level: `resolveSettlementCurrency` / `convertForSettlement` carry the exact signatures the plan `<interfaces>` documents for 88-04's `_buildExportItems` and 88-06's `initiatePayout` override. Those files live in other plans (88-04 runs concurrently in a separate worktree; 88-06 is a later wave) and are out of this plan's `files_modified` scope, so the import-side call sites are added there. No change to these signatures is required for them to consume the seam.

## Next Phase Readiness
- **88-04 (NACHA/Fedwire export path):** `_buildExportItems` can import `resolveSettlementCurrency` + `convertForSettlement` to settle each item (USD or the converted local-currency amount) before generating the bank-file buffer — signatures are stable.
- **88-06 (programmatic initiatePayout):** the Zod input's per-run `settlementCurrency` override threads straight into `resolveSettlementCurrency({ contractorCurrency, perRunOverride })`; conversion uses `convertForSettlement` at the payment-date ECB rate.
- No blockers. Live-DB FX rate availability is the existing daily-cron concern, unchanged by this plan.

## Self-Check: PASSED
- Files verified present: `payment-settlement.ts`, `payment-settlement.test.ts`, `payment-currency.test.ts` (extended).
- `exchange-rate.ts` verified byte-unchanged vs base `42f4412f5` (no production short-circuit — F-1).
- Commits verified present: `b77590794` (test), `91b333faa` (RED test), `e15dee499` (GREEN feat).
- TDD gate compliance: a `test(...)` RED commit precedes the `feat(...)` GREEN commit.

---
*Phase: 88-theme-a-us-payment-rail*
*Completed: 2026-07-01*
