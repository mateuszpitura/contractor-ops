---
last_mapped_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
last_mapped_at: 2026-06-08
---

# contractor-ops — External Integrations

Map of third-party services, government APIs, and infrastructure providers. Each section lists the tRPC namespace (if any), adapter/service paths, and auth model.

Integration framework core: `packages/integrations/src/registry.ts`, `packages/integrations/src/adapters/base-adapter.ts`, credential storage in `packages/integrations/src/services/credential-service.ts`, OAuth via `packages/integrations/src/services/oauth-arctic.ts`, token refresh in `packages/integrations/src/services/token-refresh.ts`, outbound webhooks in `packages/integrations/src/services/webhook-dispatcher.ts`.

Staff-facing connection UI lives under `apps/web-vite/src/components/integrations/` with shared hooks in `apps/web-vite/src/components/integrations/hooks/`.

---

## KSeF (Poland — National e-Invoicing)

| Aspect | Detail |
|--------|--------|
| tRPC namespace | `ksef` — `packages/api/src/routers/integrations/ksef.ts` |
| Adapter | `packages/integrations/src/adapters/ksef-adapter.ts` |
| API client | `packages/integrations/src/services/ksef-api-client.ts` |
| E-invoice profile | `packages/einvoice/src/profiles/ksef/` (parser, generator, schemas, `api-client.ts`) |
| Auth | Token/certificate-based (not OAuth); polling sync |
| Webhooks | None — KSeF uses polling (`supportsWebhooks: false`) |
| Cron routes | `apps/api/src/routes/ksef.ts` (FA fetch callbacks) |

Capabilities: auto-fetch inbound FA(3) XML, parse to internal invoice model, duplicate detection, KSeF reference display on matched invoices. Invoice intake overlap via `invoiceIntake` router (`packages/api/src/routers/finance/invoice-intake` paths).

---

## Peppol (Gulf / AE — PINT-AE via Storecove ASP)

| Aspect | Detail |
|--------|--------|
| tRPC namespace | `peppol` — `packages/api/src/routers/integrations/peppol.ts` |
| ASP client | `packages/einvoice/src/asp/storecove/client.ts`, `adapter.ts`, `schemas.ts` |
| Profile | `packages/einvoice/src/profiles/peppol-ae/` (generator, parser, validator, QR) |
| Orchestration | `packages/einvoice/src/orchestration/index.ts` |
| Auth | Storecove API key per org; participant registration tracked in DB |

Capabilities: Peppol participant registration, outbound/inbound transmission tracking, ASP management, UAE PINT-AE compliance QR codes. Peppol orchestrator references in `packages/api/src/services/peppol-orchestrator.ts` (VAT defaults — see CONCERNS).

---

## ZATCA (Saudi Arabia — Fatoorah e-Invoicing)

| Aspect | Detail |
|--------|--------|
| tRPC namespace | `zatca` — `packages/api/src/routers/compliance/zatca.ts` (compliance group, always mounted) |
| Profile | `packages/einvoice/src/profiles/zatca/` (`generator.ts`, `signer.ts`, `onboarding.ts`, `api-client.ts`, `qr-code.ts`) |
| API routes | `apps/api/src/routes/zatca.ts` (device onboarding callbacks) |
| Auth | CSR → compliance CSID → production certificate flow |
| Signing | XML DSig in `packages/einvoice/src/profiles/zatca/signer.ts` |

Capabilities: device onboarding, tax detail capture, CSR generation, compliance CSID, compliance checks, production cert upgrade, clearance/reporting submission, QR code generation. Also surfaced under `einvoice` router (`packages/api/src/routers/core/einvoice.ts`) for per-country compliance status.

---

## Google Workspace

| Aspect | Detail |
|--------|--------|
| tRPC namespace | `googleWorkspace` — `packages/api/src/routers/integrations/google-workspace.ts` |
| Adapter | `packages/integrations/src/adapters/google-workspace-adapter.ts` |
| Calendar (related) | `packages/integrations/src/adapters/google-calendar-adapter.ts`; tRPC `calendar` in `packages/api/src/routers/core/calendar.ts` |
| Deprovision scopes | `packages/integrations/src/scopes/google-workspace-deprovision-scopes.ts` |
| UI | `apps/web-vite/src/components/integrations/google-workspace-provider-section.tsx`, directory preview table |

Capabilities: Admin SDK directory import, group resolution, bulk contractor import, periodic sync, new-hire/departure detection. OAuth credential stored via integration framework; reconnect banner in `google-workspace-reconnect-banner.tsx`.

---

## Jira (Atlassian Cloud)

| Aspect | Detail |
|--------|--------|
| tRPC namespace | `jira` — `packages/api/src/routers/integrations/jira.ts` |
| Adapter | `packages/integrations/src/adapters/jira-adapter.ts` |
| Projects client | `packages/integrations/src/services/jira-projects-client.ts` |
| UI hooks | `apps/web-vite/src/components/integrations/hooks/use-jira-provider-section.ts` |

Capabilities: OAuth connect, project/issue-type discovery, status mapping, workflow task config, linked issue display, bidirectional status sync, auto-issue creation from workflow tasks. Response parsing gap: bare `as` cast at `jira.ts:80` (see CONCERNS).

---

## Linear

| Aspect | Detail |
|--------|--------|
| tRPC namespace | `linear` — `packages/api/src/routers/integrations/linear.ts` |
| Adapter | `packages/integrations/src/adapters/linear-adapter.ts` |
| Teams client | `packages/integrations/src/services/linear-teams-client.ts` |
| UI hooks | `apps/web-vite/src/components/integrations/hooks/use-linear-provider-section.ts` |

Capabilities: OAuth connect, team discovery, status mapping, task config CRUD, linked issues, bidirectional sync (v3.0). Brand icon currently pulls from `react-icons` — cleanup tracked in audit.

---

## Microsoft Teams

| Aspect | Detail |
|--------|--------|
| tRPC namespace | `teams` — `packages/api/src/routers/integrations/teams.ts` |
| Adapter | `packages/integrations/src/adapters/teams-adapter.ts` |
| Bot SDK | `@microsoft/agents-hosting`, `@microsoft/agents-hosting-extensions-teams` in `apps/api/package.json` |
| Slack (related) | `packages/integrations/src/adapters/slack-adapter.ts`; generic `integration` router for Slack OAuth |

Capabilities: channel discovery, channel-to-workflow mapping, connection status, Adaptive Card approvals, proactive channel alerts. Teams and Slack share the integration framework webhook pipeline.

---

## Stripe (Billing & subscriptions)

| Aspect | Detail |
|--------|--------|
| tRPC namespace | `billing` — `packages/api/src/routers/finance/billing.ts` |
| Package | `packages/billing` — Stripe SDK `^22.1.1` |
| Webhook handlers | `packages/billing/src/webhook/index.ts`, `handlers/subscription-deleted.ts` |
| Service wiring | `packages/api/src/services/billing-webhook.ts`, `packages/api/src/services/stripe-client.ts` |
| Landing pricing | `apps/landing` depends on `@contractor-ops/billing` |
| Tier gating | `requireTier` middleware across premium routers |

Capabilities: 3-tier plans (Starter/Pro/Enterprise), Stripe Checkout, customer portal, subscription lifecycle webhooks, AI credit metering with hard-block, free trial. Webhook route in `apps/api` plugins.

---

## Sentry (Error tracking)

| Aspect | Detail |
|--------|--------|
| Node services | `apps/api/src/lib/sentry.ts`, `apps/cron-worker/src/lib/sentry.ts`, `apps/public-api/src/lib/sentry.ts` |
| SPA | `apps/web-vite/src/sentry.ts` — `browserTracingIntegration` only today |
| PII scrubbing | `apps/api/src/lib/sentry-scrub.ts`, mirrored in worker/public-api/web-vite |
| tRPC capture | Observability middleware in `packages/api/src/init.ts` |
| Local dev | GlitchTip via `pnpm dev:observability` (Sentry-compatible DSN) |

Backend: every tRPC procedure error captured with request/user/org context. Frontend gap: route error boundary logs to console only — see CONCERNS.

---

## QStash (Upstash — async job delivery)

| Aspect | Detail |
|--------|--------|
| SDK | `@upstash/qstash` in `apps/api/package.json` |
| Verification | `apps/api/src/lib/qstash-verify.ts` |
| Route helper | `apps/api/src/lib/qstash-route.ts` (`defineQStashRoute` — Zod body + backpressure) |
| Client | `packages/integrations/src/services/qstash-client.ts` |
| Backpressure | `packages/api/src/services/qstash-backpressure.ts` |
| Cron worker | `apps/cron-worker/src/jobs/handlers/` — QStash-triggered handlers |
| Monitor | `packages/api/src/services/cron-monitor.ts` (`withQueueObservability`) |

Used for: deferred cron execution, webhook retries, outbound subscription delivery (v7 marketplace), idempotent background work. Render cron jobs (`render.yaml`) call the API over private network; heavy work often delegated to QStash → `apps/cron-worker`.

---

## Neon (PostgreSQL — multi-region)

| Aspect | Detail |
|--------|--------|
| Env vars | `DATABASE_URL`, `DATABASE_URL_EU`, `DATABASE_URL_ME` (`render.yaml`) |
| Region routing | `packages/db/src/region.ts` maps `EU` → `DATABASE_URL_EU`, `ME` → `DATABASE_URL_ME` |
| Client | `packages/db/src/client.ts` — pg pool, slow-query logging, PII param redaction |
| Migrations | `packages/db/scripts/migrate-all-regions.ts` |
| Circuit breaker | `packages/db/src/read-replica.ts` with `opossum` |
| Deploy note | External to Render blueprint; Frankfurt Render region + ME tenants on Neon ME |

Per-org routing selects regional DB + R2 bucket based on org `dataHostingRegion`.

---

## Cloudflare R2 (Object storage)

| Aspect | Detail |
|--------|--------|
| Legacy API | `packages/api/src/services/r2.ts` — S3 client singleton, presigned URLs |
| Regional API | `packages/api/src/services/regional-storage.ts` — per-region bucket selection |
| Env | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_BUCKET_NAME_EU` (`render.yaml`) |
| CMS storage | `@payloadcms/storage-s3` in `apps/cms/package.json` |
| Classification PDFs | Content-addressed R2 for IR35 SDS / DRV bundles (`classificationDocument` router) |
| Guard | `scripts/check-r2-iframe-sandbox.mjs` — iframe sandbox policy for PDF previews |

Documents, invoice files, payment exports, workflow attachments, virus-scanned uploads all flow through presigned URL pattern in `packages/api/src/routers/core/document.ts`.

---

## Unleash (Feature flags — self-hosted OSS)

| Aspect | Detail |
|--------|--------|
| Wrapper | `packages/feature-flags` — `unleash-client` `^6.10.1` |
| Registry | `packages/feature-flags/src/registry.ts`, `packages/feature-flags/src/flags-core.ts` |
| Browser entry | `packages/feature-flags/src/browser.ts` (SPA-safe, no `process.exit`) |
| tRPC introspection | `featureFlags` router — `packages/api/src/routers/core/feature-flags.ts` |
| Deploy | `unleash-eu`, `unleash-me` private services in `render.yaml` |
| Kill-switch example | `module.classification-engine` gates 8 classification routers in `packages/api/src/root.ts` |
| Signoff gate | `packages/feature-flags/src/signoff-registry-flags.ts` — boot-time legal-sensitive flag check |

Apps must not call Unleash SDK directly — always `@contractor-ops/feature-flags` (`evaluate`, `useFlag`, `<Feature>`).

---

## Other integrations (framework-covered)

Registered in `packages/integrations/src/adapters/register-all.ts`:

| Provider | Adapter path | tRPC / surface |
|----------|--------------|----------------|
| Slack | `slack-adapter.ts` | `integration` router |
| DocuSign | `docusign-adapter.ts` | `esign` router |
| Autenti | `autenti-adapter.ts` | `esign` router |
| Notion | `notion-adapter.ts` | workflow doc linking |
| Confluence | `confluence-adapter.ts` | workflow doc linking |
| Outlook Calendar | `outlook-calendar-adapter.ts` | `calendar` router |
| Clockify | `clockify-adapter.ts` | `time` router |
| Claude OCR | `claude-ocr-adapter.ts` | `ocr` router |
| Resend (email) | `resend-adapter.ts` | `packages/auth` + notification service |
| InPost / DPD / UPS | courier adapters in `packages/api/src/services/courier/` | equipment shipments |
| Okta / Entra / GitHub | IdP adapters + deprovision scopes | `deprovisioning` router |
| Company registries | `bir1-company-registry-adapter.ts`, `dataport-company-registry-adapter.ts` | contractor GUS lookup |

E-invoicing (non-integration-router): `einvoice`, `invoiceIntake`, `leitwegId`, `exchangeRate` (ECB daily rates), `bacs` (UK), `skonto` (DE), `latePaymentInterest` (UK LPCDA + BoE poller in `packages/integrations/src/services/boe-base-rate-poller.ts`).

Government API framework: `packages/gov-api/` consumed via `packages/api/src/gov-api-clients.ts`.

---

## Integration health & webhooks

- Health checks: `packages/integrations/src/services/health-service.ts`
- Inbound webhooks: `apps/api/src/plugins/webhooks.ts`, per-provider routes under `apps/api/src/routes/webhooks/`
- E-sign webhooks: `packages/integrations/src/services/esign-webhook-handler.ts`
- Billing webhooks: Stripe via `packages/api/src/services/billing-webhook.ts`
- Webhook guard: `scripts/check-webhook-routes.mjs` in `lint:ci`

---

## Related docs

- Stack overview: `.planning/codebase/STACK.md`
- Security gaps (webhooks, audit): `.planning/codebase/CONCERNS.md`
- Architecture: `.planning/codebase/ARCHITECTURE.md`
- Deploy/env reference: `render.yaml`, `CLAUDE.md`
