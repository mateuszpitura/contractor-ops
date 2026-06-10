---
title: Tax and WHT
type: domain
tags: [tax, vat, wht]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/routers/core/tax.ts
  - packages/api/src/services/wht-certificate.service.ts
updated: 2026-06-09
---

# Tax and WHT

## Purpose

Tax rate lookup, VAT validation, withholding tax calculation, WHT certificates, tax summary dashboard.

## Entry points

| Piece | Path |
|-------|------|
| Router | `tax` — `routers/core/tax.ts` |
| WHT service | `services/wht-certificate.service.ts` |
| UI | `apps/web-vite/src/components/wht/`, invoice tax sections |

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
