---
title: DocuSign and e-sign
type: integration
tags: [esign, docusign, autenti]
source_commit: 671b24f0d7790ac32119330a0a589dffdcfece36
verify_with:
  - packages/api/src/routers/core/esign.ts
  - packages/api/src/services/esign-orchestrator.ts
updated: 2026-07-06
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
- OAuth token responses (Autenti `exchangeCodeForTokens` / `refreshToken`): routed through `parseJsonResponse` with a token Zod schema (fail-closed) so a malformed token body never persists as a credential — same convention as the other OAuth adapters
- Contract status transitions audited
- **Completion idempotency (`handleSigningCompletion`) — atomic:** the signed `Document` + `SIGNED_COPY` `DocumentLink` + terminal `SIGNED_PDF_SAVED` `SigningEvent` are written in one `$transaction`, and `SigningEvent` carries a **partial unique** `signing_event_signed_pdf_saved_key` (`@@unique([signingEnvelopeId]) WHERE eventType = 'SIGNED_PDF_SAVED'`). This closes a read-then-write TOCTOU: two concurrent "completed" deliveries both pass the fast-path `SIGNED_PDF_SAVED`-exists check, but only one event can commit — the loser's insert raises **P2002**, rolling back its whole transaction (its duplicate `Document` + link included). The loser catches that P2002 as an **idempotent no-op** and returns the winner's already-persisted signed `Document` (resolved via the `SIGNED_COPY` `DocumentLink`; `null` for envelopes with no contract link) — never a duplicate. The earlier `SIGNED_PDF_SAVED`-exists check remains, but only as a fast path; the partial unique is the real guard. A redelivered "completed" webhook also short-circuits here — `handleSigningWebhook` receives the **internal** envelope id and dedups by `providerEventId`, so a same-payload redelivery reports `completed=false`.
- **Retriable vs permanent completion failures:** `handleSigningCompletion` throws `EsignCompletionError { retriable }`. R2 upload / network failures are `retriable=true`; an envelope missing its provider external id is `retriable=false`. The webhook drain (`apps/api/.../webhooks/process.ts`) **rethrows retriable errors** (delivery → `FAILED` + 500 → QStash / reaper retry) and **swallows permanent ones** (delivery → `PROCESSED`, Sentry-captured for manual replay). Because a retry's webhook dedups to `completed=false`, the drain re-drives completion via `isSignedCopyPending(envelopeId)` (envelope terminal `COMPLETED` with no `SIGNED_PDF_SAVED` yet) — so a signed PDF lost to a transient R2 blip is actually re-saved, not silently dropped.
- **Envelope-created-before-tx (send path):** `sendForSignature` calls the provider adapter before the DB `$transaction`. DocuSign is safe on retry — `createEnvelope` sends a **deterministic** `X-DocuSign-Idempotency-Key` via `deriveIdempotencyKey({ orgId: organizationId ?? connectionId, operation: 'docusign.envelope.create', businessKey: sha256(documentName|base64.length|sorted signer emails) })`, so the same logical envelope collapses inside DocuSign's 24h window. **Autenti has no idempotency key** (multi-step `document-processes` POSTs), so a rolled-back tx would otherwise orphan the process and let a retry duplicate it.
- **Intent-row idempotency (non-idempotent providers):** every send now claims an `EsignEnvelopeIntent` row (unique `(organizationId, documentId, signerSetHash)`) **before** the provider call, where `signerSetHash = sha256(documentId | sorted(email:role:routingOrder))` mirrors the DocuSign businessKey. Flow: (a) if a row already carries `externalEnvelopeId`, short-circuit — return the persisted `SigningEnvelope` (resolved via the `(provider, externalEnvelopeId)` unique) or, if the prior local tx rolled back, re-drive **only** the persistence against the existing process (never a second provider create); (b) if a row exists **without** `externalEnvelopeId` — a prior attempt that crashed between claiming the row and the write-back, which may already have created a provider process — fail closed with **`CONFLICT`** (`esignNoExternalId`, manual reconcile) rather than re-issuing the create and duplicating it; (c) otherwise (no prior row) claim it, call the provider, stamp `externalEnvelopeId` back onto the intent row **before** the local tx, then persist — only a claim made in **this** call proceeds to the provider; (d) a concurrent claim on that create raises **P2002** → resolve/reuse the winner's process, or (winner still mid-flight, no id yet) fail closed with `CONFLICT` so the caller retries rather than duplicating. Applies uniformly (DocuSign keeps its own server-side key on top). See `esign-orchestrator.ts` `computeSignerSetHash` / `reuseProviderEnvelope` / `persistEnvelopeRecords`.

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
