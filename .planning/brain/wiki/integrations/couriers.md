---
title: Courier integrations
type: integration
tags: [courier, inpost, dpd, ups, equipment]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/services/courier/
  - apps/api/src/routes/webhooks/inpost.ts
updated: 2026-06-10
---

# Couriers (InPost / DPD / UPS)

## Purpose

Equipment shipment tracking via carrier APIs: label generation, status polling, webhook updates for InPost/DPD/UPS.

## Flow

```mermaid
sequenceDiagram
  participant UI as equipment UI
  participant API as equipment router
  participant Courier as courier services
  participant Carrier as InPost/DPD/UPS
  UI->>API: create shipment
  API->>Courier: carrier-factory
  Courier->>Carrier: API
  Carrier->>API: webhook/poll status
```

## Entry points

| Piece | Path |
|-------|------|
| Factory | `packages/api/src/services/courier/carrier-factory.ts` |
| InPost | `inpost-client.ts`, `inpost-webhook-handler.ts`, `inpost-polling-service.ts` |
| DPD | `dpd-client.ts`, `dpd-polling-service.ts` |
| UPS | `ups-client.ts`, `ups-polling-service.ts` |
| Processing | `shipment-processing.ts`, `shipment-notification.ts` |
| Webhook route | `apps/api/src/routes/webhooks/inpost.ts` |
| Cron poll | `apps/cron-worker/.../inpost-status-poll.ts` |
| UI | `apps/web-vite/src/components/equipment/` |

## Invariants

- InPost webhook must **fail closed** when secret empty — [[decisions/tech-debt-hotspots]]
- Tenant-scoped shipment records

## Related

- [[domains/equipment-logistics]]
- [[framework-core]]

## Verify live

```bash
semble search "inpost-webhook-handler"
ls packages/api/src/services/courier/
```

## Agent mistakes

- Webhook verify returns true on empty secret (copy-paste hazard)
- Polling without tenant-scoped org config
