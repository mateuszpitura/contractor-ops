---
title: KSeF Poland
type: integration
tags: [ksef, poland, einvoice]
source_commit: e0d533fa
verify_with:
  - packages/api/src/routers/integrations/ksef.ts
  - packages/einvoice/src/profiles/ksef/parser.ts
  - packages/einvoice/src/profiles/ksef/schemas.ts
  - packages/api/src/services/ksef-sync-orchestrator.ts
updated: 2026-07-10
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
| Sync orchestrator | `packages/api/src/services/ksef-sync-orchestrator.ts` |
| Cron routes | `apps/api/src/routes/ksef.ts` |
| Intake overlap | `invoiceIntake` router + `services/invoice-intake/` |

## UI surface

Invoice KSeF references, settings e-invoicing, contractor e-invoicing section.

## Invariants

- Token/certificate auth — not OAuth; **polling** only (`supportsWebhooks: false`)
- Tenant-scoped org credentials via framework
- **Credential ciphertext never reaches the browser:** `ksef.connect` / `ksef.connectionStatus` (`routers/integrations/ksef.ts`) return a re-selected connection row with `credentialsRef` and `connectedByUserId` omitted — the KSeF token ciphertext stays server-side.
- **Metadata query is paginated.** `queryInvoices` returns one page plus a `hasMore` / `pageToken` cursor; `ksef-sync-orchestrator` drains every page (feeding `pageToken` into the next request) before finalizing. The sync checkpoint (`IntegrationConnection.lastSuccessAt`) advances **only** when the whole run ends with zero errors, so a mid-sync page failure — or a `hasMore` with no `pageToken` — leaves the checkpoint pinned and the window is re-queried next run. Per-invoice failures are isolated into `errors[]` (already-fetched invoices are skipped on re-query).
- **`KSEF_SYNC_COMPLETE` stays a direct dispatch, not outboxed.** It announces the run's **aggregate** result (`invoicesCreated` across many invoice rows), not one committed write, so there is no enclosing `$transaction` to bind an enqueue to — see [[patterns/transactional-outbox]] "When NOT to convert".
- **Inbound FA(3) parser (2026-07-09):** `P_11A` = line gross (not VAT); header totals sum all `P_13_*` / `P_14_*` rate bands; buyer `nip` optional (B2C/foreign) — seller still requires 10-digit PL NIP.
- **Line VAT sign guard (2026-07-10):** VAT derived from `P_11A − P_11` must carry the net's sign (KOR correction lines are negative throughout); a sign mismatch means a legacy emitter put VAT into `P_11A` — the parser then falls back to deriving VAT from the `P_12` rate instead of ingesting a negative VAT. Outbound `generateFa3Xml` emits `P_11A` = gross and `P_11Vat` = VAT (round-trip consistent with the parser).

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
- Consuming only `result.invoiceMetadataList` from `queryInvoices` and ignoring `hasMore` / `pageToken` — drops every invoice past page 1 while the checkpoint advances (permanent loss)
