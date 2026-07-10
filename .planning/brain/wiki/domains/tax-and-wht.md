---
title: Tax and WHT
type: domain
tags: [tax, vat, wht]
source_commit: e0d533fa
verify_with:
  - packages/api/src/routers/core/tax.ts
  - packages/api/src/services/wht-certificate.service.ts
  - packages/api/src/services/tax-rate.service.ts
  - packages/db/prisma/schema/tax.prisma
updated: 2026-07-10
---

# Tax and WHT

## Purpose

Tax rate lookup, VAT validation, withholding tax calculation, WHT certificates, tax summary dashboard.

## Entry points

| Piece | Path |
|-------|------|
| Router | `tax` — `routers/core/tax.ts` |
| WHT service | `services/wht-certificate.service.ts` |
| SA WHT rates | `services/tax-rate.service.ts` (`calculateWht` — specific residency query before `XX` fallback) |
| UI | `apps/web-vite/src/components/wht/`, invoice tax sections |

## Invariants

- **`taxSummary.whtPending*`** counts payment-run items in the period with `whtAmountMinor > 0` that have **no** linked `WhtCertificate` row (join semantics), not a subtract of disjoint aggregates.
- **WHT certificate issuance** is idempotent per `paymentRunItemId` (`@unique` + in-tx check); concurrent cert-number allocation retries on `P2002` and returns the existing row when the payment item was already certificated.
- **Tenant DB:** `createWhtCertificate` / `listWhtCertificates` use `ctx.db` from the tax router (regional RLS client), not the global `prisma` singleton.
- **WHT certificate reads are RBAC-gated:** `whtCertificate.list` / `.get` (`routers/core/tax.ts`) require `requirePermission({ payment: ['read'] })` — certificates carry contractor tax IDs + amounts and are not readable by arbitrary org members.
- **UI errors are translated:** the web-vite WHT certificates hook (`apps/web-vite/src/components/payments/hooks/use-wht-certificates.ts`) toasts `translateError(err)` — raw error codes like `whtCertificateNumberConflict` are never shown literally.

## Related

- [[payments-and-bank-files]]
- [[invoice-to-payment]]
- [[gulf-saudization]]

## Verify live

```bash
semble search "taxRouter"
semble search "wht-certificate"
```

## Agent mistakes

- Hardcoded VAT rates instead of tax router lookup
