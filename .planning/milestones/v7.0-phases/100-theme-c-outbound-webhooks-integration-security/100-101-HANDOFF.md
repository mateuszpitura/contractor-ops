# 100 → 101 HANDOFF — marketplace apps + DX portal + status page

Phase 100 shipped the outbound-webhook engine (signed, PII-safe, SSRF-guarded, DLQ-backed), the integration
security controls (SSRF/DNS-rebind, HMAC replay, PII redaction, key-leak alarm), and the OWASP-gated un-hide
of the P99 write surface. **Phase 101** builds the external DX layer on top of these contracts.

## What Phase 101 consumes from Phase 100

- **The event catalog** (`packages/validators/src/webhooks` — `WEBHOOK_EVENT_TYPES` + `webhookEventEnvelopeSchema`)
  is the contract the marketplace apps (Zapier / n8n / Make) trigger on. A new event type is a compile error
  until added to the catalog — keep it the single source of truth.
- **The SDK-with-writes** — Phase 100 un-hid the 11 write routes into `buildOpenApiDocument` → Scalar → SDK.
  Phase 101 promotes the SDK to include writes (SDK 1.0) once the per-org `module.public-api` grant is a live
  ops act (EXTERNAL-ENABLEMENT #8). The Speakeasy publish job stays dark until then (EXTERNAL-ENABLEMENT #7).
- **The sample verifiers** (`apps/public-api/docs/webhooks/verifiers/{ts,py,go,php}`) are the copy-paste
  snippets the DX portal ships to subscribers — they are drift-guarded against the signer, so surface them
  verbatim.
- **The delivery gauges + `webhook_failures` DLQ** feed a status page: `jobs.apikey.leak_suspects`, the
  per-org 5-failures/1h alert, `WebhookDeliveryAttempt.status`, and the DLQ retention/replay surface are the
  data a public status/health page renders.

## Still deferred after Phase 100

- **Marketplace listings (Zapier/n8n/Make), full DX portal, SDK 1.0, Postman/Insomnia, status page, sandbox
  tier** — all Phase 101. The sandbox tier reuses the ship-dark `module.*` posture.
- **Public `webhooks:manage` sub-router** — the scope exists in `PUBLIC_API_SCOPES`; the internal staff router
  is the primary surface. An external self-serve subscription-management sub-router is optional Phase-101 work.
- **`_initiatePayoutForRun`** — still NOT exposed; needs its own scoped actor review.
- **Per-org grants** — `module.public-api` and `module.outbound-webhooks` are manual Unleash acts, sign-off-gated.

## Verify before building Phase 101

```bash
pnpm --filter @contractor-ops/api test owasp-api-gate webhook-ssrf webhook-hmac webhook-dispatch
pnpm --filter @contractor-ops/public-api test write-routes-dark openapi-doc   # writes present + 404 per-org
```
