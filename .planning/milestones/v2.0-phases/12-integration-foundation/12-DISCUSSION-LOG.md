# Phase 12: Integration Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 12-Integration Foundation
**Areas discussed:** Credential store design, Webhook processing, Health monitoring UI, Provider abstraction

---

## Credential Store Design

### Encryption Key Model

| Option | Description | Selected |
|--------|-------------|----------|
| Single app-wide key | One INTEGRATION_ENCRYPTION_KEY for all providers. Simpler ops, matches Slack pattern. | |
| Per-provider keys | Separate encryption key per provider (JIRA_KEY, DOCUSIGN_KEY). More isolation. | ✓ |
| You decide | Claude picks based on security best practices | |

**User's choice:** Per-provider keys
**Notes:** None

### Credential Storage Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Encrypted JSON blob | All tokens as one encrypted JSON object in credentialsRef. Flexible for different token shapes. | ✓ |
| Separate encrypted fields | Individual encrypted columns for each token type. More structured but rigid. | |
| You decide | Claude picks during planning | |

**User's choice:** Encrypted JSON blob
**Notes:** None

### Token Refresh Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Proactive cron refresh | Background job checks expiry periodically, refreshes before expiry. | |
| Lazy refresh on use | Refresh only when API call is made and token is expired/near-expiry. | |
| Both (proactive + lazy fallback) | Proactive cron as primary, lazy refresh as safety net. | ✓ |

**User's choice:** Both (proactive + lazy fallback)
**Notes:** None

### Slack Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, migrate Slack | Refactor Slack to use new generic credential store. Proves abstraction. | ✓ |
| No, keep Slack separate | Leave Slack as-is with its own encryption. | |

**User's choice:** Yes, migrate Slack
**Notes:** None

---

## Webhook Processing

### Processing Model

| Option | Description | Selected |
|--------|-------------|----------|
| Queue-based async | Webhook → HMAC verify → store → queue for async processing. | ✓ |
| Sync with async fallback | Process in-request if fast, queue only slow handlers. | |
| Sync only | Process everything in request handler (like current Slack). | |

**User's choice:** Queue-based async
**Notes:** None

### Queue Technology

| Option | Description | Selected |
|--------|-------------|----------|
| Upstash QStash | Serverless queue, native Vercel integration, HTTP-based. Already using Upstash Redis. | ✓ |
| Vercel background functions | Built-in background execution via waitUntil. Limited retry control. | |
| Inngest | Event-driven functions with retries, fan-out, observability. New vendor. | |

**User's choice:** Upstash QStash
**Notes:** None

### Webhook Routing

| Option | Description | Selected |
|--------|-------------|----------|
| Single endpoint + provider routing | One /api/webhooks/[provider] dispatches to registered handlers. | ✓ |
| Per-provider endpoints | Each provider gets its own route file. | |

**User's choice:** Single endpoint + provider routing
**Notes:** None

### Existing Webhook Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, migrate both | Migrate Slack interactivity and Resend inbound to unified system. | ✓ |
| Migrate Slack only | Only Slack since it's already an IntegrationProvider enum value. | |
| No, keep existing separate | New system for new integrations only. | |

**User's choice:** Yes, migrate both
**Notes:** None

---

## Health Monitoring UI

### Dashboard Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Provider cards grid | Card per provider with status badge, last sync, error count. Click to expand. | ✓ |
| Table-based list | Dense table with all providers, sortable. | |
| You decide | Claude picks based on existing patterns | |

**User's choice:** Provider cards grid
**Notes:** None

### Detail Level

| Option | Description | Selected |
|--------|-------------|----------|
| Connection details + recent sync log | Expandable card/slide-over with metadata, token expiry, last 10 syncs, last 10 webhooks. | ✓ |
| Minimal status only | Connected/disconnected status with reconnect button. | |
| Full debug view | Everything plus raw payloads, request/response JSON, manual retry. | |

**User's choice:** Connection details + recent sync log
**Notes:** None

### Update Frequency

| Option | Description | Selected |
|--------|-------------|----------|
| Polling every 30s | TanStack Query auto-refetch. Simple, works with existing patterns. | ✓ |
| Manual refresh only | Data loads on page visit, refresh button to reload. | |
| You decide | Claude picks based on UX | |

**User's choice:** Polling every 30s
**Notes:** None

---

## Provider Abstraction

### Abstraction Level

| Option | Description | Selected |
|--------|-------------|----------|
| Interface + adapter pattern | TypeScript IntegrationProvider interface with standard methods per provider. | ✓ |
| Lightweight registry | Simple provider registry mapping enum to config objects. | |
| You decide | Claude picks the right level | |

**User's choice:** Interface + adapter pattern
**Notes:** None

### Package Location

| Option | Description | Selected |
|--------|-------------|----------|
| New packages/integrations | Dedicated package for framework, interfaces, adapters. | ✓ |
| Inside packages/api | Keep in API package as services/integrations/ directory. | |
| You decide | Claude decides placement | |

**User's choice:** New packages/integrations package
**Notes:** None

### Framework Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Use Slack as real test | Migrating Slack to new framework IS the validation. | ✓ |
| Build a mock provider too | Mock/test provider alongside Slack migration. | |
| You decide | Claude decides | |

**User's choice:** Use Slack as the real test
**Notes:** None

---

## Claude's Discretion

- Cron interval for proactive token refresh
- QStash retry strategy and backoff configuration
- Encryption algorithm details
- Card component design and spacing
- Sync log pagination and filtering UX
- Internal packages/integrations structure

## Deferred Ideas

None — discussion stayed within phase scope.
