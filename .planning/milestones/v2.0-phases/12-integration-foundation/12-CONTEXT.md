# Phase 12: Integration Foundation - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Shared OAuth credential store, webhook ingestion layer, and health monitoring dashboard that every subsequent integration phase (13-20) builds on. Migrate existing Slack and Resend integrations to the new framework as validation. No new third-party integrations — just the infrastructure and migration.

</domain>

<decisions>
## Implementation Decisions

### Credential Store Design
- **D-01:** Per-provider encryption keys — each provider gets its own env var (e.g., JIRA_ENCRYPTION_KEY, DOCUSIGN_ENCRYPTION_KEY). More isolation between providers, independent key rotation.
- **D-02:** Encrypted JSON blob in credentialsRef field — store all tokens (access, refresh, scopes, expiry) as one encrypted JSON object. Flexible for providers with different token shapes. Existing Slack pattern stores similarly.
- **D-03:** Proactive cron refresh + lazy fallback — background job checks token expiry periodically and refreshes before expiry. Lazy refresh on API call as safety net if cron misses. Most robust approach.
- **D-04:** Migrate existing Slack credentials to the new generic store — proves the abstraction works with a real provider. One credential management pattern going forward.

### Webhook Processing
- **D-05:** Queue-based async processing via Upstash QStash — webhook arrives, HMAC verified, stored in WebhookDelivery, pushed to queue for async processing. Handles retries, backpressure, timeouts. Upstash already in stack for Redis cache.
- **D-06:** Single endpoint + provider routing — one `/api/webhooks/[provider]` route that dispatches to registered handlers by provider slug. Central signature verification, clean URL structure.
- **D-07:** Migrate both Slack interactivity and Resend inbound webhooks to the unified system — proves the abstraction with two real providers. Single webhook pattern going forward.

### Health Monitoring UI
- **D-08:** Provider cards grid layout — card per provider showing status badge (connected/error/disconnected), last sync time, error count. Click to expand. Matches card-based patterns used in dashboard KPIs.
- **D-09:** Connection details + recent sync log on click — expandable card or slide-over showing connection metadata, token expiry countdown, last 10 sync entries, last 10 webhook deliveries. Re-authorize and disconnect buttons.
- **D-10:** Polling every 30s via TanStack Query auto-refetch — simple, works with existing patterns, no WebSocket infrastructure needed.

### Provider Abstraction
- **D-11:** TypeScript interface + adapter pattern — define IntegrationProvider interface with methods like getOAuthConfig(), handleWebhook(), refreshToken(), getHealthStatus(). Each provider implements it. Typed, testable, enforces consistency.
- **D-12:** New `packages/integrations` package in monorepo — dedicated package for the framework: interfaces, base adapter, credential service, webhook dispatcher. Providers register adapters here. Clean separation from API layer.
- **D-13:** Use Slack migration as the real framework validation — migrating Slack to the new framework IS the end-to-end test. Real OAuth flow, real webhooks, real credential refresh. No mock/stub provider needed.

### Claude's Discretion
- Exact cron interval for proactive token refresh (suggested: every 15 min)
- QStash retry strategy and backoff configuration
- Encryption algorithm details (AES-256-GCM already proven)
- Exact card component design and spacing
- Sync log pagination and filtering UX
- Internal package structure within packages/integrations

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Integration infrastructure
- `PRD.md` §12.1-12.12 — Integration requirements, provider list, OAuth flows, webhook specs
- `DB-SCHEMA.md` — IntegrationConnection, ExternalLink, IntegrationSyncLog, WebhookDelivery models and their relationships

### Existing implementation (migration targets)
- `packages/api/src/services/slack-client.ts` — Current AES-256-GCM encryption pattern (encryptToken/decryptToken)
- `packages/api/src/routers/integration.ts` — Current Slack-only integration router (7 procedures)
- `apps/web/src/app/api/slack/oauth/route.ts` — Current Slack OAuth flow with HMAC-signed state
- `apps/web/src/app/api/slack/interactivity/route.ts` — Current Slack webhook handler with signature verification
- `apps/web/src/app/api/webhooks/resend-inbound/route.ts` — Current Resend email intake webhook with Svix verification

### Database schema
- `packages/db/prisma/schema/integration.prisma` — IntegrationProvider enum, IntegrationStatus enum, all integration tables

### UI patterns
- `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx` — Settings tab structure (integrations tab exists)
- `apps/web/src/components/settings/slack-connection-card.tsx` — Current Slack connection card (migration target for generic provider cards)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `slack-client.ts` encryptToken/decryptToken: AES-256-GCM encryption can be extracted into a generic credential encryption service
- `slack-connection-card.tsx`: Card pattern can be generalized into a provider-agnostic connection card component
- `slack-user-mapping.tsx`: ExternalLink CRUD pattern reusable for all provider entity mappings
- IntegrationConnection, WebhookDelivery, IntegrationSyncLog, ExternalLink: Prisma models already exist and are well-indexed

### Established Patterns
- tRPC middleware chain: auth → tenant → RBAC → handler (all new procedures follow this)
- TanStack Query for server state with auto-refetch capabilities
- nuqs for URL-synced tab state in settings
- Zod validation schemas in `packages/validators`
- AsyncLocalStorage for multi-tenant context scoping
- Better Auth RBAC with hasPermission API

### Integration Points
- Settings page integrations tab: where health dashboard will render
- `packages/api/src/root.ts`: integration router already registered
- `packages/validators/src/integration.ts`: existing integration schemas (Slack-only, needs expansion)
- Upstash Redis already in stack — QStash adds queue alongside existing cache

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-integration-foundation*
*Context gathered: 2026-03-23*
