---
title: KSeF Poland
type: integration
tags: [ksef, poland, einvoice]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/routers/integrations/ksef.ts
  - packages/einvoice/src/profiles/ksef/
updated: 2026-06-10
---

# KSeF (Poland)

> **Do not cite KSeF API behavior from wiki alone.** Verify adapter + profile code.

## Purpose

Poland National e-Invoicing System integration: fetch inbound FA(3) XML, parse to internal invoice model, duplicate detection, display KSeF references on matched invoices.

## Flow

```mermaid
sequenceDiagram
  participant Cron as api/routes/ksef
  participant KSeF as KSeF API
  participant Adapter as ksef-adapter
  participant Intake as invoiceIntake
  Cron->>KSeF: poll FA fetch
  KSeF->>Adapter: XML
  Adapter->>Intake: parse + match
```

## Entry points

| Piece | Path |
|-------|------|
| tRPC | `ksef` — `routers/integrations/ksef.ts` |
| Adapter | `packages/integrations/src/adapters/ksef-adapter.ts` |
| API client | `packages/integrations/src/services/ksef-api-client.ts` |
| Profile | `packages/einvoice/src/profiles/ksef/` |
| Cron routes | `apps/api/src/routes/ksef.ts` |
| Intake overlap | `invoiceIntake` router + `services/invoice-intake/` |

## UI surface

Invoice KSeF references, settings e-invoicing, contractor e-invoicing section.

## Invariants

- Token/certificate auth — not OAuth; **polling** only (`supportsWebhooks: false`)
- Tenant-scoped org credentials via framework

## Related

- [[einvoice-profiles]]
- [[domains/invoice-to-payment]]
- [[framework-core]]

## Verify live

```bash
semble search "ksefRouter"
semble search "ksef-api-client"
```

## Agent mistakes

- Expecting webhook-driven sync for KSeF
- Parsing XML without einvoice profile validators
