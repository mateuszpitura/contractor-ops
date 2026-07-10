---
title: Payments and bank files
type: domain
tags: [payments, bacs, skonto, banking]
source_commit: e0d533fa
verify_with:
  - packages/api/src/routers/finance/payment.ts
  - packages/api/src/routers/finance/payment-export-router.ts
  - packages/api/src/routers/finance/payment-shared.ts
  - packages/api/src/routers/finance/payment-core.ts
  - packages/api/src/routers/finance/payment-run-ops.ts
  - packages/api/src/routers/finance/bacs.ts
  - packages/api/src/routers/finance/invoice-actions.ts
  - packages/api/src/routers/core/settings.ts
  - packages/api/src/services/ach-return.service.ts
  - packages/api/src/routers/finance/late-payment-interest.ts
  - packages/api/src/services/late-payment-interest.ts
  - packages/api/src/services/exchange-rate.ts
  - packages/api/src/services/payment-export.ts
  - packages/api/src/services/payment-settlement.ts
  - packages/api/src/services/boe-rate-cache.ts
  - packages/api/src/services/invoice-intake/finalize-stage.ts
  - packages/db/prisma/schema/invoice.prisma
  - packages/api/src/services/wht-certificate.service.ts
  - packages/shared/src/money.ts
updated: 2026-07-10
---

# Payments and bank files

## Purpose

Payment runs, lock+export (CSV/Elixir/SEPA/BACS), bank statement import, skonto, UK late payment interest (LPCDA), ECB exchange rates.

## Entry points

| Piece | Path |
|-------|------|
| Payment (merged) | `routers/finance/payment.ts` → core, export, import, skonto |
| BACS | `bacs` router |
| Skonto | `skonto` router |
| LPC | `latePaymentInterest` router |
| Rates | `exchangeRate` router |
| UI | `apps/web-vite/src/components/payments/` |
| Org debtor IBAN/BIC | Settings → General → **Organization bank account** (`settings.getOrgBankAccount` / `updateOrgBankAccount`; UI `org-bank-settings.tsx`) |

## Invariants

- `compliance-payment-gate` on run creation
- [[patterns/entity-id-and-money]] in UI
- Sensitive payment mutations write `writeAuditLog` inside the same `$transaction` as the business write (BACS `generateExport` → `payment_run.bacs_export`; LPC `claim` → `invoice_interest.claimed`; ACH return summary audit via `ingestAudit` in `applyAchReturns`).
- `lockAndExport` exports the bank file exactly once per run. The DRAFT/LOCKED → EXPORTED flip is a guarded `updateMany` (single winner); the file buffer is built *before* the flip, so a concurrent race loser returns `{ fileBase64: null, fileName: null, idempotent: true }` — never a second copy of the payment file.
- **Idempotent-replay branches re-select the safe response shape** — never return the raw Prisma run row: staff `lockAndExport` (`routers/finance/payment-export-router.ts`) re-selects the bare run on replay, and the public-api payment-run route re-selects via `paymentRunSelect` (`routers/public-api/payment-run.ts`). The raw row carries encrypted bank fields (bankAccount/routing/account ciphertext) + contractor `taxId`; a replay must never widen the response shape vs the first call.
- **Org SEPA bank-detail settings mutations audit `fieldsUpdated` (field names only)** — IBAN/BIC values never enter audit `oldValues`/`newValues` (`routers/core/settings.ts`). At-rest encryption of the SEPA fields inside `settingsJson` is a known backlog item.
- **Org bank settings UI fails loudly, never blank** — `org-bank-settings.tsx` + `hooks/use-org-bank-settings.ts` render a query error panel on load failure (no blank form), toast translated errors, and block field-clearing with an explanatory hint (locale key `orgBankCannotClear`, 4 locales): empty-string inputs are normalized to `undefined`, so a "cleared" field would silently preserve the old value.
- **FX settlement provenance is winner-only + stamps the ECB observation date.** `_buildExportItems` (`payment-shared.ts`) settles each cross-currency item and now *returns* the provenance (`ExportSettlementProvenance[]`) instead of writing it inline; only the transition winner calls `persistExportSettlements(ctx.db, ...)`, so a race loser no longer repeats the idempotent `PaymentRunItem.settlementRate/settlementRateDate` write for a file it discards. `settlementRateDate` is the **ECB rate row's observation date** (`convertAmount` → oldest leg via `observationDate`), NOT the pay date — a weekend/holiday or carried-forward gap means the observation is *earlier* than the pay date, and provenance must reconstruct the rate actually used. The programmatic payout path (`initiatePayout` loop) still persists inline via `persistSettlementProvenance` — it is not a race.
- **Programmatic ACH payout persists provider order ids** — `_initiatePayoutForRun` stores each adapter `orderId` on `PaymentRunItem.paymentReference` (same field ACH-return matching uses) when flipping items to `EXPORTED`.
- **Settlement FX staleness + negative HALF-UP** — `convertForSettlement` / `getRate` enforce `FX_CONVERSION_MAX_AGE_DAYS` (7d) via `StaleExchangeRateError`; `convertAmount` uses sign-aware `roundHalfUpMinor` so credit-note negatives round HALF-UP, not toward zero.
- **Bank-file emit guards** — BACS `buildDetailRecord` rejects short sort-code/account digit strings (no space-padding); NACHA `generateNachaFile` validates 9-digit ABA routing + mod-10 checksum before emitting entry detail.
- **Supported settlement currencies:** `currencyOf` / `CURRENCY_MAP` in `packages/shared/src/money.ts` includes USD, EUR, GBP, PLN, AED, SAR, CHF, CZK, KWD, QAR, JPY, BHD — bank export `minorToDecimalStr` must not throw for Gulf + common EU currencies.
- **One late-interest claim per invoice** — `InvoiceInterestClaim @@unique([invoiceId])` (migration `20260705000000_...additive_integrity`). The existing guard is a non-atomic `interestClaims.length > 0` read, so two concurrent claims produced duplicate claim rows + duplicate `LPC-*` secondary invoices; the DB unique is the backstop (a claim is never voided → a full unique correctly caps it at one). Catching P2002 → CONFLICT in `late-payment-interest.ts` is a later change set — this migration adds the unique.
- **No statutory rate = not applicable, never a bare 8% margin** — `resolveStatutoryRate` (`services/late-payment-interest.ts`) returns `null` (not 0) when no BoE base rate is in effect on the LPCDA §4(1) reference date, and `calculateLateInterest` then returns `applicable:false` with reason `RATE_HISTORY_UNAVAILABLE` rather than accruing interest at the 8% margin alone. The BoE rate history is served from `boe-rate-cache.ts`, an in-process cache with a 5-minute TTL so a poller-written rate is picked up without an explicit invalidation.

## Related

- [[invoice-to-payment]]
- [[compliance-dashboard]]
- [[tax-and-wht]]

## Verify live

```bash
semble search "payment-core"
semble search "lockAndExport"
```

## Agent mistakes

- **ACH return on PAID invoice** reverts `InvoicePayment` rows tied to the failed run item and syncs `Invoice.paymentStatus` back to `READY`/`PARTIALLY_PAID` via `revertInvoicePaymentOutcome` (`ach-return.service.ts`).
- **`updateItemStatus` / `markAllPaid` enforce the run state machine** — illegal item transitions rejected; `markAllPaid` requires `run.status === 'EXPORTED'`.
- **`toggleReverseCharge` is blocked on PAID/IN_RUN/VOID invoices** and writes an audit row inside the mutation tx.
- **US withholding routes by W-form on file** (`taxFormOnFile` in `applyWithholding`), not `contractor.countryCode` alone — W-9 blocks chapter-3; W-8 enables it even for US `countryCode`.
- Local IBAN parsing without Zod safeParse
