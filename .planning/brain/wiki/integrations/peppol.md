---
title: Peppol network
type: integration
tags: [peppol, uae, storecove]
source_commit: e0d533fa
verify_with:
  - packages/api/src/routers/integrations/peppol.ts
  - packages/einvoice/src/profiles/peppol-ae/
  - packages/db/prisma/schema/peppol.prisma
  - apps/api/src/routes/webhooks/storecove.ts
  - packages/api/src/services/einvoice-submission-triggers.ts
  - apps/api/src/routes/peppol.ts
  - apps/web-vite/src/components/peppol/hooks/use-peppol.ts
updated: 2026-07-10
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
| Outbound producer | `einvoice-submission-triggers.ts` → `enqueueJob('peppol.outbound')` on UAE invoice approval when Peppol CONNECTED + contractor Peppol ID |
| UAE TRN scheme | ISO 6523 **0235** (not 0192) — `peppol-ae/constants.ts` `UAE_SCHEME_ID`; migration `20260709120000_peppol_uae_scheme_0235` re-keys legacy `0192:` rows; UI wizard preview uses `0235:` |
| Lifecycle webhook | `apps/api/src/routes/webhooks/storecove.ts` — Storecove delivery / failed acks → `EInvoiceLifecycle` |
| Transmission FSM | `packages/api/src/services/einvoice-lifecycle-fsm.ts` |
| UI | `components/peppol/`, settings e-invoicing |

## Invariants

- Storecove API key per org
- VAT defaults in orchestrator — see [[decisions/tech-debt-hotspots]] if touching
- **One in-flight `PeppolTransmission` per invoice** — DB partial unique `PeppolTransmission_invoiceId_active_key` on `(invoiceId) WHERE status IN (PENDING, TRANSMITTED)` (migration `20260705000000_...additive_integrity`). Terminal rows (DELIVERED/FAILED/REJECTED) and null `invoiceId` are excluded, so a failed attempt can be re-transmitted, but a retry landing before the first reaches a terminal state hits P2002 instead of creating a duplicate row. The orchestrator P2002-catch + stale-PENDING reaper land in a later change set.
- **Storecove webhook is per-event, FSM-routed** — the delivery/failed ack handler (`webhooks/storecove.ts`) dedups on `EInvoiceLifecycleEvent.providerEventId = ${guid}:${event}` (DB-unique `einvoice_lifecycle_event_org_eid_uniq`; P2002 → 200 idempotent), NOT the transmission guid alone — the guid is stable per transmission, so a `failed` then a `delivered` share it and guid-only dedup would drop the real delivery. Status changes route through `transitionTransmission`: a genuine `delivered` after a transient `failed` recovers `FAILED → DELIVERED`; a late `failed` after `DELIVERED` throws `IllegalFsmTransitionError` → 200 no-op (no status regression).
- **Lost outbound enqueues have a cron backstop.** The post-approval `peppol.outbound` enqueue is fire-and-forget; `peppol-reconcile` (`*/15`) sweeps `SUPPORTED_REGIONS` for post-approval invoices on Peppol-connected orgs whose contractor carries Peppol ids but which have no in-flight/delivered OUTBOUND transmission, and re-runs `maybeEnqueuePeppolOutbound` (itself idempotent: in-flight check + per-invoice QStash dedupId; returns whether it actually enqueued). FAILED/REJECTED transmissions stay eligible — a failed send is retried. See [[structure/cron-jobs]].
- **Reconcile candidate query scales.** The covered-set check in `einvoice-submission-triggers.ts` uses a correlated NOT EXISTS anti-join instead of loading all OUTBOUND transmissions into a `notIn` list (that list grows forever and hits the PG bind-param ceiling). Candidate selection also preconditions on the org being an ACTIVE Peppol participant, so permanently-ineligible invoices cannot occupy the `take 50` head and starve newer lost enqueues.

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
