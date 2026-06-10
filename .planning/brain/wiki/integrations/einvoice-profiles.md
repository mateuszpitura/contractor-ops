---
title: E-invoice profiles
type: integration
tags: [einvoice, xrechnung, zugferd]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/einvoice/src/registry.ts
  - packages/einvoice/src/orchestration/
updated: 2026-06-10
---

# E-invoice profiles

## Purpose

Country-specific e-invoice generation, validation, and parsing orchestrated in `packages/einvoice` — shared by intake, transmission, and compliance status UIs.

## Flow

```mermaid
flowchart LR
  registry[einvoice registry] --> profile[country profile]
  profile --> gen[generator]
  profile --> parse[parser]
  orch[orchestration] --> transmit[ASP/gov API]
```

## Entry points

| Piece | Path |
|-------|------|
| Registry | `packages/einvoice/src/registry.ts` |
| Orchestration | `packages/einvoice/src/orchestration/` |
| DE XRechnung | `profiles/xrechnung-de/` |
| DE ZUGFeRD | `profiles/zugferd-de/` |
| PL KSeF | [[ksef]] |
| SA ZATCA | [[zatca]] |
| AE Peppol | [[peppol]] |
| tRPC status | `einvoice` router |
| Intake | `invoiceIntake` router |
| Leitweg-ID | `leitwegId` router (DE public sector) |
| ECB rates | `exchangeRate` router + cron |

## UI surface

`components/einvoice/`, `components/invoices/einvoice-tab/`, settings e-invoicing.

## Invariants

- Profile selection by org jurisdiction / invoice metadata — not hardcoded in UI
- Structural validation before transmission

## Related

- [[domains/invoice-to-payment]]
- [[ksef]], [[peppol]], [[zatca]]

## Verify live

```bash
ls packages/einvoice/src/profiles/
semble search "einvoiceRouter"
```

## Agent mistakes

- Duplicating XML generation in API router instead of profile module
- Mixing intake pipeline with outbound-only profile paths
