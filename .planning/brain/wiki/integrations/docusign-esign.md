---
title: DocuSign and e-sign
type: integration
tags: [esign, docusign, autenti]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/routers/core/esign.ts
  - packages/api/src/services/esign-orchestrator.ts
updated: 2026-06-10
---

# DocuSign / Autenti e-sign

## Purpose

Electronic signature envelopes for contracts: DocuSign and Autenti adapters, orchestration, webhook status updates, void/signing progress UI.

## Flow

```mermaid
sequenceDiagram
  participant Staff
  participant API as esign router
  participant Orch as esign-orchestrator
  participant Provider as DocuSign/Autenti
  Staff->>API: create envelope
  API->>Orch: orchestrate
  Orch->>Provider: send
  Provider->>API: webhook status
```

## Entry points

| Piece | Path |
|-------|------|
| tRPC | `esign` router |
| Orchestrator | `esign-orchestrator.ts` |
| Adapters | `docusign-adapter.ts`, `autenti-adapter.ts` |
| Webhook | `esign-webhook-handler.ts` |
| UI | `contracts/contract-detail/signing-progress-bar.tsx`, void dialog |

## Invariants

- Webhook payloads: Zod safeParse
- Contract status transitions audited

## Related

- [[domains/contracts-lifecycle]]
- [[framework-core]]

## Verify live

```bash
semble search "esign-orchestrator"
semble search "esign-webhook"
```

## Agent mistakes

- Contract ACTIVE without webhook-confirmed signature
- Skipping envelope void handling in UI state
