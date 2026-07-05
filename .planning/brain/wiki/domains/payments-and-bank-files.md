---
title: Payments and bank files
type: domain
tags: [payments, bacs, skonto, banking]
source_commit: f9de62452
verify_with:
  - packages/api/src/routers/finance/payment.ts
  - packages/api/src/routers/finance/payment-export-router.ts
  - packages/api/src/routers/finance/bacs.ts
  - packages/api/src/routers/finance/late-payment-interest.ts
  - packages/db/prisma/schema/invoice.prisma
updated: 2026-07-05
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

## Invariants

- `compliance-payment-gate` on run creation
- [[patterns/entity-id-and-money]] in UI
- Audit gap on some payment mutations — [[decisions/tech-debt-hotspots]]
- `lockAndExport` exports the bank file exactly once per run. The DRAFT/LOCKED → EXPORTED flip is a guarded `updateMany` (single winner); the file buffer is built *before* the flip, so a concurrent race loser returns `{ fileBase64: null, fileName: null, idempotent: true }` — never a second copy of the payment file.
- **One late-interest claim per invoice** — `InvoiceInterestClaim @@unique([invoiceId])` (migration `20260705000000_...additive_integrity`). The existing guard is a non-atomic `interestClaims.length > 0` read, so two concurrent claims produced duplicate claim rows + duplicate `LPC-*` secondary invoices; the DB unique is the backstop (a claim is never voided → a full unique correctly caps it at one). Catching P2002 → CONFLICT in `late-payment-interest.ts` is a later change set — this migration adds the unique.

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

- Creating runs without compliance gate check
- Local IBAN parsing without Zod safeParse
