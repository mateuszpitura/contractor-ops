# Phase 63: UK Payments & Financial Features - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `63-CONTEXT.md` — this log preserves the discussion path.

**Date:** 2026-04-15
**Phase:** 63-uk-payments-financial-features
**Mode:** discuss (interactive, 4 areas)

## Gray Areas Presented

| # | Area | User selected |
|---|------|---------------|
| 1 | BACS Std 18 export — bank details model & submitter config | ✓ |
| 2 | Late payment interest — BoE rate data & calculation scope | ✓ |
| 3 | Late interest surfacing — UI & payment-run integration | ✓ |
| 4 | Skonto configuration model & payment-run handling | ✓ |

All four selected.

## Area 1 — BACS Std 18 export

| Question | User choice |
|----------|-------------|
| UK bank fields on ContractorBillingProfile | New encrypted columns `ukSortCodeEncrypted` + `ukAccountNumberEncrypted` + masked pair |
| Organization-level BACS submitter | New encrypted fields on `Organization` (SUN + submitter sort code + submitter account) |
| ASCII transliteration | Deterministic `@contractor-ops/shared/ascii-transliterate.ts` util with `?` last-resort replacement |

## Area 2 — Late payment interest calculation

| Question | User choice |
|----------|-------------|
| BoE base rate data source | Manual admin table `BoEBaseRateHistory` + daily cron poll from BoE |
| Scope | B2B only (LPCDA-correct) via new `isBusinessCustomer` flag on `Contractor` |
| Accrual model | Live computation on read — pure function `calculateLateInterest` |
| Fixed compensation trigger | Once per invoice at first overdue, snapshot tier in `InvoiceInterestCompensation` |

## Area 3 — Late interest UI & payment-run

| Question | User choice |
|----------|-------------|
| Where users see interest | Invoice detail + invoices list column + dashboard summary tile |
| Auto-post vs display-only | Display-only + user-triggered "Claim statutory interest" action (snapshot + PDF letter + optional secondary invoice) |
| PaymentRun integration | Exclude from PaymentRun totals (PaymentRun is payables; interest is receivables) |
| Partial-payment + waive | Interest accrues on outstanding balance via new `InvoicePayment` table; user waive via `InvoiceInterestWaiver` with required reason |

## Area 4 — Skonto configuration

| Question | User choice |
|----------|-------------|
| Where Skonto is configured | Per-invoice with ContractorBillingProfile default cascade (XOR via CHECK constraint) |
| Single-tier vs multi-tier | Single-tier for v5.0 (multi-tier deferred) |
| XRechnung BG-20 integration | Extend Phase 61 generator: emit structured Skonto + locked DE phrase + Peppol EXT syntax |
| Eligibility tracking | Recompute from `paidAt` for display + persist `SkontoSnapshot` at payment complete; PaymentRun preview offers "Use Skonto amount" checkbox with `SkontoApplication` audit row |

## Summary

- 27 explicit decisions captured (D-01 through D-27 in CONTEXT.md).
- BACS Std 18 generator slots into existing `packages/api/src/services/payment-export.ts`; auto-routing extended for GBP+UK.
- Late interest uses a pure-function live calculator (`calculateLateInterest`) with a statutory-period helper that handles LPCDA §4(1) correctly.
- Fixed compensation snapshot is load-bearing — legal correctness requires tier freezing at first overdue.
- Partial-payment architecture via new `InvoicePayment` child table is the biggest data-model shift; existing invoices migrated.
- Skonto XRechnung integration extends Phase 61's generator — coordinating note added to 63-CONTEXT `canonical_refs` to alert any concurrent phase-61 work.
- Three independent feature flags (`PAY_BACS_ENABLED`, `PAY_LATE_INTEREST_ENABLED`, `PAY_SKONTO_ENABLED`) gate the three sub-deliverables so they can ship independently.
- No scope creep — BACSTEL-IP submission, multi-tier Skonto, receivables tracking, B2C consumer debts, compounding interest, non-UK jurisdictions all deferred.
- Zero todos folded (`gsd-tools todo match-phase 63` = 0 matches).
