---
title: Money rounding policy
type: pattern
tags: [money, currency, rounding, finance, validators]
source_commit: 730cc8e69
verify_with:
  - packages/api/src/services/skonto.ts
  - packages/api/src/services/late-payment-interest.ts
  - packages/api/src/services/exchange-rate.ts
  - packages/api/src/services/bank-statement.ts
  - packages/api/src/routers/finance/payment-shared.ts
  - packages/api/src/services/payment-settlement.ts
updated: 2026-07-05
---

# Money rounding policy

## Purpose

One canonical rule for how derived monetary values are rounded, so two
services never disagree on a cent/grosz/halala and so float error never leaks
into a stored amount.

## Invariants

- **Minor units only.** All monetary values are stored and computed as INTEGER
  minor units (cents / grosze / halala). Major-unit floats are an external
  boundary input, never an internal money representation.
- **Default = HALF-UP.** Derived monetary minor-unit values round half-up to the
  nearest minor unit via `Math.round`.
- **No float arithmetic on currency.** No `parseFloat`-then-scale on an
  unvalidated money string; no multiplying float FX rates without a single
  controlled round on integer minor units. Validate the external value first,
  then do exactly ONE round.

## Directional exceptions

Only where an invariant demands a fixed direction:

| Site | Direction | Why |
|------|-----------|-----|
| Skonto / early-payment discount amount | **FLOOR** (`Math.floor`) | Never grant more discount than mathematically due; protects the seller's receivable, buyer deduction stays conservative. |
| Statutory late-payment interest (final accrued claim) | **HALF-UP** (`Math.round`) | Compute-then-round on the accrued total — matches EU Late Payment Directive / German §288 BGB. |

## Entry points

| Site | Path | Rule |
|------|------|------|
| Skonto discount | `packages/api/src/services/skonto.ts` | FLOOR |
| Late-payment interest | `packages/api/src/services/late-payment-interest.ts` | HALF-UP; `resolveStatutoryRate` returns `null` (not 0) when no BoE rate is in effect on the §4(1) reference date, and `calculateLateInterest` then returns `applicable:false` (`RATE_HISTORY_UNAVAILABLE`) rather than accruing at the bare 8% margin |
| FX conversion | `packages/api/src/services/exchange-rate.ts` | Finite-guard inputs → single HALF-UP on integer minor units (no `decimal.js` in this service). `getRate(…, maxAgeDays?)` throws `StaleExchangeRateError` when the observation is older than the floor (settlement + 1099 box-1 pass `FX_CONVERSION_MAX_AGE_DAYS = 7`; display-only reads pass none). An ECB-outage carry-forward row is stamped `CARRIED_FORWARD:<original-date>` so its staleness stays visible and is measured from the original observation, not the re-stamped row date |
| Bank statement amounts | `packages/api/src/services/bank-statement.ts` | zod-validate external major amount → single HALF-UP to minor units; parser caps output at 5000 transactions (mirrors import `MAX_IMPORT_ROWS`) so the run matcher stays bounded |
| Withholding deduction | `packages/api/src/routers/finance/payment-shared.ts` (`applyWithholding`) | ONE HALF-UP round of `whtAmountMinor` at the rate (SA WHT / US §3406 24% / 1042-S treaty), then `amountMinor = grossAmountMinor − whtAmountMinor` — integer gross/net invariant, no chained round |
| Settlement FX | `packages/api/src/services/payment-settlement.ts` (`convertForSettlement`) | Delegates verbatim to `convertAmount` — single HALF-UP on integer minor units at the payment-date ECB rate; rate 1 same-currency; `null` on a missing rate and a throw on a stale rate (default `maxAgeDays = FX_CONVERSION_MAX_AGE_DAYS = 7`) — never a coerced 1.0 or a silently zeroed/stale payout. The applied rate + as-of date are persisted onto `PaymentRunItem.settlementRate`/`settlementRateDate` for provenance |

## Verify live

```bash
semble search "Math.round" packages/api/src/services
pnpm --filter @contractor-ops/api test src/services/__tests__/skonto.test.ts src/services/__tests__/exchange-rate.test.ts src/services/__tests__/bank-statement.test.ts src/services/__tests__/late-payment-interest.test.ts
```

## Related

- [[entity-id-and-money]]
- [[validators-boundaries]]

## Agent mistakes

- Flipping a rounding direction (floor ↔ half-up) "to match the other site"
  without checking the invariant the direction protects. Skonto floors on
  purpose; interest rounds half-up on purpose.
- `parseFloat` on a money string and scaling without validating it is a finite
  number first — a malformed cell becomes `NaN`/`Infinity` money.
- Rounding twice (once on the rate, once on the product). Round exactly once, on
  the integer minor-unit result.
