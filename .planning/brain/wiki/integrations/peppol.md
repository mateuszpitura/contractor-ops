---
title: Peppol network
type: integration
tags: [peppol, uae, storecove]
source_commit: f9de62452
verify_with:
  - packages/api/src/routers/integrations/peppol.ts
  - packages/einvoice/src/profiles/peppol-ae/
  - packages/db/prisma/schema/peppol.prisma
updated: 2026-07-05
---

# Peppol (Gulf / AE)

## Purpose

Peppol network via Storecove ASP: participant registration, inbound/outbound transmission tracking, UAE PINT-AE compliance QR codes.

## Flow

```mermaid
flowchart LR
  register[participant register] --> asp[Storecove ASP]
  outbound[generate invoice] --> transmit[transmission track]
  inbound[inbound doc] --> parse[peppol-ae parser]
```

## Entry points

| Piece | Path |
|-------|------|
| tRPC | `peppol` router |
| ASP client | `packages/einvoice/src/asp/storecove/` |
| Profile | `packages/einvoice/src/profiles/peppol-ae/` |
| Orchestrator | `packages/api/src/services/peppol-orchestrator.ts` |
| UI | `components/peppol/`, settings e-invoicing |

## Invariants

- Storecove API key per org
- VAT defaults in orchestrator — see [[decisions/tech-debt-hotspots]] if touching
- **One in-flight `PeppolTransmission` per invoice** — DB partial unique `PeppolTransmission_invoiceId_active_key` on `(invoiceId) WHERE status IN (PENDING, TRANSMITTED)` (migration `20260705000000_...additive_integrity`). Terminal rows (DELIVERED/FAILED/REJECTED) and null `invoiceId` are excluded, so a failed attempt can be re-transmitted, but a retry landing before the first reaches a terminal state hits P2002 instead of creating a duplicate row. The orchestrator P2002-catch + stale-PENDING reaper land in a later change set.

## Related

- [[domains/gulf-saudization]]
- [[einvoice-profiles]]
- [[framework-core]]

## Verify live

```bash
semble search "peppolRouter"
semble search "storecove"
```

## Agent mistakes

- Hardcoding ASP credentials outside credential-service
- Skipping transmission status tracking on outbound send
