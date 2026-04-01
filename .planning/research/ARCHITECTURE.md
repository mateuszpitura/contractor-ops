# Architecture Research: v3.0 Enterprise & Monetization

**Domain:** B2B contractor operations platform -- integration expansion, equipment tracking, billing infrastructure
**Researched:** 2026-04-01
**Confidence:** HIGH (existing adapter architecture well-understood, new integration APIs documented, Stripe billing patterns established)

## System Overview

The existing integration framework (Phase 12, v2.0) provides a well-defined extension surface with `IntegrationProviderAdapter`, a provider registry, generic OAuth callback, generic webhook ingestion, QStash async processing, and AES-256-GCM credential encryption. The key architectural question is: which v3.0 features fit cleanly into this adapter pattern, which need new bounded contexts, and which require infrastructure-level changes?

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        NEW v3.0 Components                              │
│                                                                         │
│  ┌───────────┐ ┌───────────┐ ┌────────────┐ ┌──────────┐ ┌──────────┐ │
│  │  Linear   │ │  Teams    │ │ Google WS  │ │Equipment │ │  Stripe  │ │
│  │  Adapter  │ │  Adapter  │ │  Adapter   │ │ Tracker  │ │ Billing  │ │
│  └─────┬─────┘ └─────┬─────┘ └─────┬──────┘ └────┬─────┘ └────┬─────┘ │
│        │              │             │              │            │       │
├────────┴──────────────┴─────────────┴──────────────┼────────────┼───────┤
│              EXISTING Integration Framework        │            │       │
│  ┌──────────────────────────────────────────────┐  │            │       │
│  │  Registry │ OAuth │ Webhook Pipeline │ Health │  │            │       │
│  └──────────────────────────────────────────────┘  │            │       │
├────────────────────────────────────────────────────┼────────────┼───────┤
│                    NEW Cross-Cutting Concerns       │            │       │
│  ┌────────────────────┐  ┌──────────────────────┐  │            │       │
│  │ Onboarding Import  │  │ Messaging Abstraction│  │            │       │
│  │ Orchestrator       │  │ (Slack + Teams)       │  │            │       │
│  └────────────────────┘  └──────────────────────┘  │            │       │
├────────────────────────────────────────────────────┴────────────┴───────┤
│                    EXISTING Infrastructure                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ Prisma   │  │ QStash   │  │ tRPC     │  │ Neon PG  │               │
│  │ (40+ mod)│  │ (async)  │  │ (19 rtr) │  │ (DB)     │               │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘               │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Classification

| v3.0 Feature | Integration Type | Fits Existing Adapter? | New Infrastructure? |
|---|---|---|---|
| Linear integration | New adapter (mirrors Jira) | YES -- extends BaseAdapter, uses all existing infra | No |
| Teams integration | New adapter + messaging abstraction | PARTIALLY -- adapter yes, but notification-service needs refactor to abstract Slack/Teams | Messaging abstraction layer |
| Google Workspace | New adapter + directory import | PARTIALLY -- OAuth adapter yes, directory import is a new capability type | Directory sync service |
| Intelligent onboarding | Cross-cutting orchestrator | NO -- new bounded context that consumes data from existing integrations | Import orchestrator, data mapping engine |
| Equipment tracking | New domain model | NO -- not an integration provider | New Prisma schema, courier API clients |
| Stripe billing | Tenant-level infrastructure | NO -- billing is infrastructure, not a user-managed integration | Billing service, tRPC middleware, usage metering |

## Integration Point Analysis

### 1. Linear Adapter -- Clean Fit

Linear's API mirrors Jira closely: OAuth 2.0, webhooks with HMAC-SHA256 verification, bidirectional issue sync. The existing `JiraAdapter` is the exact template.

**What exists and can be reused (zero changes needed):**
- `BaseAdapter` class -- extend directly
- Generic OAuth callback route `/api/oauth/[provider]/callback` -- works as-is
- Generic webhook ingestion route `/api/webhooks/[provider]` -- works as-is
- `IntegrationConnection` model -- works as-is
- `ExternalLink` model -- works as-is (link Linear issues to contractors/projects)
- `IntegrationSyncLog` -- works as-is
- QStash async processing via `_process` route -- works as-is
- AES-256-GCM per-provider credential encryption -- add `LINEAR_ENCRYPTION_KEY`
- `verifyOAuthState()` / `generateOAuthState()` -- works as-is

**New components needed:**
- `packages/integrations/src/adapters/linear-adapter.ts` -- OAuth config, token exchange, refresh token, webhook HMAC verification
- `packages/api/src/services/linear-issue-sync.ts` -- bidirectional issue sync (mirrors `jira-issue-sync.ts`)
- `packages/api/src/services/linear-webhook-handler.ts` -- webhook event processing (issue created/updated/deleted)
- `packages/api/src/routers/linear.ts` -- tRPC router for Linear-specific operations (connect project, map statuses, manual sync)

**Schema changes:**
- Add `LINEAR` to `IntegrationProvider` enum

**Linear-specific considerations:**
- Linear uses **GraphQL** (not REST like Jira) -- the adapter's sync service needs a lightweight GraphQL client (`graphql-request` or direct `fetch`), but the adapter interface itself is unchanged
- Linear webhooks use HMAC-SHA256 with a signing secret -- identical verification pattern to Jira's `X-Hub-Signature: sha256=<hex>`
- Linear OAuth now **requires refresh tokens** (mandatory since April 2026) -- the existing `refreshToken()` flow handles this without changes
- Linear has team-scoped access, analogous to Jira's cloudId -- store `teamId`/`workspaceId` in `configJson`
- Linear supports `client_credentials` grant for server-to-server (app actor tokens, 30-day validity) -- not needed if using per-user OAuth

**Data flow (identical to Jira pattern):**
```
Linear Webhook → /api/webhooks/linear → LinearAdapter.verifyWebhookSignature()
    → WebhookDelivery log → QStash → /api/webhooks/_process
    → linear-webhook-handler.processLinearWebhook()
    → Update ExternalLink + sync contractor/project status
```

### 2. Teams Adapter -- Requires Messaging Abstraction

Teams integration is NOT a simple adapter addition. The current Slack integration is deeply coupled: `slack-client.ts` contains approval card rendering (Block Kit), reminder DMs, user sync, and message updates. The `notification-service.ts` calls `sendSlackDM()` and `sendApprovalCard()` directly.

Adding Teams means every notification call site would need `if (slack) ... else if (teams) ...` unless we extract a messaging abstraction.

**The core problem in code:**
```typescript
// Current notification-service.ts (line 182-198)
async function sendSlackDM(userId: string, event: NotificationEvent): Promise<void> {
  const slackUserId = await getSlackUserIdForUser(event.organizationId, userId);
  if (!slackUserId) return;
  if (event.type === "APPROVAL_REQUEST") {
    await sendApprovalCard({ ... });  // Directly coupled to Slack Block Kit
  }
  // ...
}
```

**Recommended approach -- MessagingProvider interface:**

```typescript
// packages/api/src/services/messaging/types.ts
interface MessageRef {
  platform: "slack" | "teams";
  channelId: string;
  messageId: string;  // Slack ts, Teams message id
}

interface MessagingProvider {
  readonly platform: "slack" | "teams";
  sendApprovalCard(params: ApprovalCardParams): Promise<MessageRef>;
  updateApprovalResult(ref: MessageRef, result: ApprovalResult): Promise<void>;
  sendReminderDM(params: ReminderParams): Promise<void>;
  resolveUserMapping(orgId: string, userId: string): Promise<string | null>;
  syncWorkspaceUsers(orgId: string, connectionId: string): Promise<SyncResult>;
}
```

**What exists and can be reused:**
- `BaseAdapter` -- extend for Teams OAuth (Azure AD) + webhook verification
- OAuth callback route -- works as-is (Azure AD uses standard OAuth 2.0 Authorization Code Grant)
- `ExternalLink` model -- for user mapping (`TEAMS_USER` external type, like existing `SLACK_USER`)
- `UserNotificationPreference` model -- add `channelTeams` boolean (mirrors `channelSlack`)

**What CANNOT be reused as-is:**
- Webhook ingestion route -- Teams Bot Framework uses a different messaging endpoint pattern (`/api/messages/teams`), not the generic webhook pipeline. The Bot Framework SDK expects to handle the HTTP request directly via `BotFrameworkAdapter.processActivity()`
- `notification-service.ts` -- must be refactored to dispatch through messaging abstraction instead of calling Slack directly

**New components needed:**
- `packages/integrations/src/adapters/teams-adapter.ts` -- Azure AD OAuth config, token exchange
- `packages/api/src/services/messaging/types.ts` -- `MessagingProvider` interface
- `packages/api/src/services/messaging/slack-provider.ts` -- wraps existing `slack-client.ts` functions behind interface
- `packages/api/src/services/messaging/teams-provider.ts` -- Bot Framework SDK + Adaptive Cards for approval UI
- `packages/api/src/services/messaging/index.ts` -- `getMessagingProviders(orgId)` resolution (returns all connected providers)
- `apps/web/src/app/api/messages/teams/route.ts` -- Bot Framework messaging endpoint (separate from generic webhook route)
- Refactor `notification-service.ts` -- replace direct `sendSlackDM()` / `sendApprovalCard()` calls with messaging abstraction dispatch

**Teams-specific infrastructure requirements:**
- **Azure Bot registration** required in Azure Portal (Bot Channels Registration resource)
- `botbuilder` npm package (Bot Framework SDK v4 for Node.js) for message handling
- **Adaptive Cards** JSON schema for approval UI (replaces Slack's Block Kit)
- **Proactive messaging** requires storing `ConversationReference` per user -- store in `ExternalLink.metadataJson` (fields: `serviceUrl`, `conversationId`, `tenantId`, `userId`)
- **Admin consent** required for organizational installation -- more complex than Slack's simple bot token

**Schema changes:**
- Add `MICROSOFT_TEAMS` to `IntegrationProvider` enum (note: `MICROSOFT_365` already exists for Outlook Calendar -- Teams requires a separate connection)
- Add `channelTeams` to `UserNotificationPreference` model

### 3. Google Workspace Adapter -- Directory Import is the Novel Part

Google OAuth infrastructure is already partially established: `GoogleCalendarAdapter` handles Google OAuth token exchange. `GOOGLE_WORKSPACE` already exists in the `IntegrationProvider` enum. The directory import capability is what is new.

**What exists and can be reused:**
- Google OAuth token exchange pattern from `GoogleCalendarAdapter` -- same auth server, different scopes
- OAuth callback route -- works as-is
- `ExternalLink` model -- for mapping Google Workspace users to internal users

**Critical distinction from Google Calendar:**
- Google Calendar uses **per-user OAuth** (personal calendar access, scope: `calendar.events`)
- Google Workspace Directory requires **domain-wide admin consent** or service account with domain delegation (scope: `admin.directory.user.readonly`, `admin.directory.group.readonly`)
- These are **separate connections** in `IntegrationConnection` -- one `GOOGLE_CALENDAR`, one `GOOGLE_WORKSPACE`

**New components needed:**
- `packages/integrations/src/adapters/google-workspace-adapter.ts` -- OAuth config with Admin SDK scopes
- `packages/api/src/services/google-directory-sync.ts` -- fetch users, groups, org units from Google Workspace directory via Admin SDK
- Directory data mapper for import orchestrator consumption

**Schema changes:**
- `GOOGLE_WORKSPACE` already exists in enum -- no change needed
- Consider adding `USER` to `EntityType` enum for ExternalLink user mapping (currently uses `CONTRACTOR` or `ORGANIZATION` as workaround for Slack user mapping -- line 102-108 of `slack-client.ts`)

### 4. Intelligent Onboarding Import -- New Bounded Context

This is NOT an integration adapter. It is an orchestrator that reads data FROM connected integrations to pre-populate the organization during initial setup or periodic sync.

**Architecture:**

```
Onboarding Wizard UI (step in existing wizard or new settings page)
    ↓
Import Orchestrator (new service)
    ├── Google Workspace → fetch users, departments, org units
    ├── Linear → fetch teams, projects, members
    ├── Jira → fetch projects, team members (via existing Jira connection)
    ├── Slack → fetch channels, members (existing syncWorkspaceUsers pattern)
    └── Teams → fetch teams, channels, members
    ↓
Per-Provider Data Mapper (normalize to internal schema candidates)
    ↓
Preview / Confirmation UI (show what will be created, let user deselect)
    ↓
Batch Create (users, contractors, projects, teams -- with audit trail)
```

**New components needed:**
- `packages/api/src/services/import-orchestrator.ts` -- coordinates multi-source import, deduplication
- `packages/api/src/services/import-mappers/` -- per-provider data mappers:
  - `linear-mapper.ts` -- Linear teams/projects/members to internal entities
  - `jira-mapper.ts` -- Jira projects/team members to internal entities
  - `google-workspace-mapper.ts` -- Google Workspace users/groups to internal entities
  - `slack-mapper.ts` -- Slack members to internal users (extends existing `syncWorkspaceUsers`)
  - `teams-mapper.ts` -- Teams members/channels to internal entities
- `packages/api/src/routers/onboarding-import.ts` -- tRPC router for import flow (list sources, preview, confirm, status)

**Key design principle:** Import is a one-time (or periodic) operation, not a continuous sync. It uses existing `IntegrationConnection` credentials to call provider APIs but does not create new connections. The orchestrator reads, normalizes, previews, and batch-creates on user confirmation.

**Schema changes:**
- `ImportSession` model -- tracks import state, source providers, preview data, status
- `ImportMapping` model -- stores field mappings, dedup keys, and transformation rules per provider

**Dependency chain:** Requires at least one integration (Google Workspace, Linear, Jira, Slack, or Teams) to be connected first. The onboarding wizard should guide connection setup before import.

### 5. Equipment/Shipment Tracking -- New Domain Model

This is a new bounded context, not an integration adapter. Courier API clients (InPost, DPD, UPS) are lightweight HTTP clients with fundamentally different characteristics from integration providers:
- API-key authenticated (not OAuth, except InPost which supports both)
- Mostly read-only tracking (poll for status or receive status webhooks)
- No bidirectional sync, no credential rotation
- No user-facing "connect" flow

**Architecture decision: DO NOT use the IntegrationProviderAdapter pattern for couriers.** Use a simpler `CourierClient` interface:

```typescript
// packages/api/src/services/courier/types.ts
interface TrackingStatus {
  carrier: "inpost" | "dpd" | "ups";
  trackingNumber: string;
  status: string;
  statusCode: string;
  timestamp: Date;
  location?: string;
  estimatedDelivery?: Date;
  isDelivered: boolean;
}

interface CourierClient {
  readonly carrier: "inpost" | "dpd" | "ups";
  getTrackingStatus(trackingNumber: string): Promise<TrackingStatus>;
  verifyWebhook?(rawBody: string, headers: Record<string, string>): boolean;
}
```

**New components needed:**

Schema (new bounded context -- `packages/db/prisma/schema/equipment.prisma`):
- `Equipment` model -- name, serial number, type (laptop/monitor/etc.), contractor assignment, status (AVAILABLE/ASSIGNED/IN_TRANSIT/RETURNED), condition, purchase date, notes
- `Shipment` model -- tracking number, carrier, origin/destination, status, linked equipment IDs, linked contractor, direction (OUTBOUND/RETURN)
- `ShipmentStatusUpdate` model -- status history from courier API or webhooks

Service layer:
- `packages/api/src/services/courier/inpost-client.ts` -- InPost ShipX API client (OAuth 2.0 or API key, base: `api-shipx-pl.easypack24.net/v1/`)
- `packages/api/src/services/courier/dpd-client.ts` -- DPD tracking API client
- `packages/api/src/services/courier/ups-client.ts` -- UPS tracking API client
- `packages/api/src/services/courier/index.ts` -- carrier resolution by tracking number prefix or explicit selection
- `packages/api/src/services/equipment-service.ts` -- equipment lifecycle (assign, ship, receive, return)

Routers:
- `packages/api/src/routers/equipment.ts` -- CRUD, assign to contractor, view history
- `packages/api/src/routers/shipment.ts` -- create shipment, track, manual status update

**Schema changes:**
- Add `EQUIPMENT` and `SHIPMENT` to `EntityType` enum (for ExternalLink, audit log)
- New `equipment.prisma` schema file with models above
- Equipment links to Contractor (many-to-one) and WorkflowRun (equipment handoff as workflow task)

**Status polling:** QStash cron job polls courier APIs for active shipment status updates. When a courier supports webhooks (InPost does), those bypass polling.

**Workflow integration:** Equipment handoff (assign laptop to contractor on onboarding, collect on offboarding) ties into the existing workflow engine as specialized workflow task types.

### 6. Stripe Billing -- Tenant-Level Infrastructure

Stripe billing is NOT an integration adapter. It is infrastructure that gates access to features. It operates at the tenant (organization) level and affects every tRPC request.

**Architecture -- new middleware in the existing chain:**

```
Request → tRPC Middleware Chain
    auth → tenant → rbac → [NEW: billing] → sensitive → handler
                              ↓
                    Check subscription tier (cached)
                    Check AI credit balance (for OCR routes)
                    Enforce feature gates
```

**New components needed:**

Billing service layer (`packages/api/src/services/billing/`):
- `stripe-client.ts` -- Stripe SDK wrapper, lazy initialization
- `subscription-service.ts` -- create/update/cancel subscriptions, handle tier changes, per-seat quantity updates
- `usage-metering.ts` -- record AI/OCR usage events to Stripe Billing Meters (new API since version 2025-03-31.basil)
- `feature-gates.ts` -- check if org's tier allows feature X (e.g., Linear integration only on Pro+)
- `webhook-handler.ts` -- process Stripe webhook events (invoice.paid, subscription.updated, etc.)

Middleware:
- `packages/api/src/middleware/billing.ts` -- tRPC middleware checking subscription status on protected routes

Routers:
- `packages/api/src/routers/billing.ts` -- manage subscription, view usage dashboard, redirect to Stripe Customer Portal

Webhook route:
- `apps/web/src/app/api/webhooks/stripe/route.ts` -- **dedicated** Stripe webhook handler, NOT through the generic `/api/webhooks/[provider]` pipeline

**Schema changes (new `billing.prisma`):**
- `Subscription` model -- Stripe subscription ID, tier (FREE/STARTER/PRO/ENTERPRISE), status, current period start/end, seat count, Stripe price IDs
- `UsageRecord` model -- local mirror of metered usage (type: AI_EXTRACTION/OCR, count, period, Stripe meter event ID)
- `BillingEvent` model -- audit trail (upgrade, downgrade, payment_failed, trial_ended, etc.)
- Add to `Organization` model: `stripeCustomerId`, `subscriptionTier` (enum), `trialEndsAt`

**Stripe-specific architecture decisions:**

Per-seat pricing: Use Stripe `subscription.quantity` for seat count. Update quantity on user invite (`subscription.update({ quantity: newCount })`) and user removal. Prorate automatically.

AI credit metering: Use Stripe Billing Meters (current API, legacy `usage_records` removed since 2025-03-31.basil):
```typescript
// Create meter once during Stripe product setup
const meter = await stripe.billing.meters.create({
  display_name: "AI Extractions",
  event_name: "ai_extraction",
  default_aggregation: { formula: "sum" },
  customer_mapping: { event_payload_key: "stripe_customer_id", type: "by_id" },
  value_settings: { event_payload_key: "value" },
});

// Record each OCR/AI usage
await stripe.billing.meterEvents.create({
  event_name: "ai_extraction",
  payload: { stripe_customer_id: org.stripeCustomerId, value: "1" },
});
```

Free trial: Create subscription with `trial_period_days`, no payment method required initially. On trial end, Stripe fires `customer.subscription.trial_will_end` webhook.

Self-service: Use Stripe Customer Portal for billing management (payment method updates, invoice history, plan changes) -- reduces code to maintain.

**Key design decision:** Stripe webhooks bypass the integration adapter pipeline. Stripe is infrastructure, not a user-managed integration. The webhook uses `stripe.webhooks.constructEvent()` for signature verification, which is incompatible with the adapter's `verifyWebhookSignature()` method signature. Keeping billing separate from integration concerns is architecturally correct.

## Recommended Project Structure (New Files Only)

```
packages/
├── integrations/src/
│   ├── adapters/
│   │   ├── linear-adapter.ts           # NEW — extends BaseAdapter
│   │   ├── teams-adapter.ts            # NEW — extends BaseAdapter
│   │   ├── google-workspace-adapter.ts # NEW — extends BaseAdapter
│   │   └── register-all.ts            # MODIFY — register 3 new adapters
│   └── types/
│       └── provider.ts                # EXISTING — no interface changes needed
│
├── api/src/
│   ├── services/
│   │   ├── linear-issue-sync.ts        # NEW — bidirectional issue sync
│   │   ├── linear-webhook-handler.ts   # NEW — webhook event processing
│   │   ├── google-directory-sync.ts    # NEW — directory user/group fetch
│   │   ├── messaging/                  # NEW directory
│   │   │   ├── types.ts               # MessagingProvider interface
│   │   │   ├── slack-provider.ts      # Wraps existing slack-client.ts
│   │   │   ├── teams-provider.ts      # Bot Framework + Adaptive Cards
│   │   │   └── index.ts              # Provider resolution
│   │   ├── import-orchestrator.ts      # NEW — multi-source import
│   │   ├── import-mappers/             # NEW directory
│   │   │   ├── linear-mapper.ts
│   │   │   ├── jira-mapper.ts
│   │   │   ├── google-workspace-mapper.ts
│   │   │   ├── slack-mapper.ts
│   │   │   └── teams-mapper.ts
│   │   ├── equipment-service.ts        # NEW — equipment lifecycle
│   │   ├── courier/                    # NEW directory
│   │   │   ├── types.ts               # CourierClient interface
│   │   │   ├── inpost-client.ts       # InPost ShipX API
│   │   │   ├── dpd-client.ts          # DPD tracking API
│   │   │   ├── ups-client.ts          # UPS tracking API
│   │   │   └── index.ts              # Carrier resolution
│   │   ├── billing/                    # NEW directory
│   │   │   ├── stripe-client.ts       # Stripe SDK wrapper
│   │   │   ├── subscription-service.ts # Subscription lifecycle
│   │   │   ├── usage-metering.ts      # AI/OCR credit metering
│   │   │   ├── feature-gates.ts       # Tier-based feature access
│   │   │   └── webhook-handler.ts     # Stripe event processing
│   │   └── notification-service.ts     # MODIFY — use messaging abstraction
│   ├── routers/
│   │   ├── linear.ts                   # NEW
│   │   ├── equipment.ts               # NEW
│   │   ├── shipment.ts                # NEW
│   │   ├── onboarding-import.ts       # NEW
│   │   └── billing.ts                # NEW
│   └── middleware/
│       └── billing.ts                 # NEW — subscription/tier check
│
├── db/prisma/schema/
│   ├── integration.prisma             # MODIFY — add LINEAR, MICROSOFT_TEAMS to enum
│   ├── equipment.prisma               # NEW — Equipment, Shipment, ShipmentStatusUpdate
│   ├── billing.prisma                 # NEW — Subscription, UsageRecord, BillingEvent
│   ├── organization.prisma            # MODIFY — add stripeCustomerId, subscriptionTier, trialEndsAt
│   ├── contract.prisma                # MODIFY — add EQUIPMENT, SHIPMENT to EntityType
│   └── notification.prisma            # MODIFY — add channelTeams to UserNotificationPreference
│
└── web/src/app/api/
    ├── webhooks/stripe/route.ts       # NEW — dedicated Stripe webhook (NOT generic pipeline)
    └── messages/teams/route.ts        # NEW — Bot Framework messaging endpoint
```

### Structure Rationale

- **Adapters in `packages/integrations`:** Linear, Teams, and Google Workspace adapters follow the established pattern. They implement `BaseAdapter` and register in `register-all.ts`. Zero deviation from the convention established by the 12 existing adapters.
- **Services in `packages/api`:** Domain-specific logic stays in `api/src/services/`. Messaging abstraction, import orchestrator, equipment service, courier clients, and billing service all follow the existing pattern of service files exporting functions.
- **Courier clients NOT in integrations package:** Courier APIs are simple HTTP clients with API keys, not OAuth-based provider adapters. Putting them in `api/src/services/courier/` correctly scopes them as domain services, not integration adapters.
- **Billing NOT in integrations package:** Stripe billing is tenant infrastructure, not a user-managed integration connection. It has its own middleware, its own webhook route, and its own schema file. Users do not "connect" and "disconnect" Stripe like they do Slack or Jira.
- **Teams messaging endpoint separate from webhook route:** Bot Framework SDK expects to handle the full HTTP request via `BotFrameworkAdapter.processActivity()`, which is incompatible with the generic webhook pipeline's verify-then-queue pattern.

## Architectural Patterns

### Pattern 1: Adapter Extension (Linear, Teams, Google Workspace)

**What:** Extend `BaseAdapter`, implement OAuth config + token exchange + webhook verification, register in `register-all.ts`.
**When to use:** Any new provider that supports OAuth and/or webhooks and fits the existing credential/webhook infrastructure.
**Trade-offs:** Very low friction to add (proven 12 times), but limited to the `IntegrationProviderAdapter` interface capabilities. Provider-specific features (e.g., Linear's GraphQL, Teams' Adaptive Cards) live in separate service files, not in the adapter.

```typescript
// packages/integrations/src/adapters/linear-adapter.ts
export class LinearAdapter extends BaseAdapter {
  readonly slug = "linear";
  readonly displayName = "Linear";
  readonly supportsOAuth = true;
  readonly supportsWebhooks = true;

  getOAuthConfig(): OAuthConfig {
    return {
      clientIdEnvVar: "LINEAR_CLIENT_ID",
      clientSecretEnvVar: "LINEAR_CLIENT_SECRET",
      authorizationUrl: "https://linear.app/oauth/authorize",
      tokenUrl: "https://api.linear.app/oauth/token",
      scopes: ["read", "write", "issues:create", "comments:create"],
      redirectPath: "/api/oauth/linear/callback",
    };
  }

  // exchangeCodeForTokens, refreshToken — standard OAuth 2.0
  // verifyWebhookSignature — HMAC-SHA256, same pattern as JiraAdapter
  // getHealthStatus — same pattern as JiraAdapter
}
```

### Pattern 2: Messaging Abstraction (Slack + Teams Unification)

**What:** Extract a `MessagingProvider` interface from the existing Slack-specific code, allowing `notification-service.ts` to dispatch to all connected messaging platforms without knowing which ones are active.
**When to use:** Whenever the platform sends interactive messages (approval cards, reminders, activity alerts) to external messaging systems.
**Trade-offs:** Introduces an abstraction layer that adds one level of indirection, but eliminates the `if slack else if teams` anti-pattern. Both Slack and Teams can be active simultaneously for the same org -- notifications go to both.

```typescript
// In notification-service.ts (refactored)
async function sendMessagingNotification(
  userId: string,
  event: NotificationEvent,
): Promise<void> {
  const providers = await getMessagingProviders(event.organizationId);
  // Fire-and-forget to ALL connected messaging platforms
  // Matches existing void + .catch() pattern
  void Promise.allSettled(
    providers.map(provider =>
      event.type === "APPROVAL_REQUEST"
        ? provider.sendApprovalCard({ /* ... */ })
        : provider.sendReminderDM({ /* ... */ })
    )
  ).catch(err => console.error("[messaging] dispatch failed:", err));
}
```

### Pattern 3: Infrastructure Billing (Not Integration Billing)

**What:** Billing middleware in the tRPC chain that checks subscription status before handler execution. Feature gates as utility functions called by routers. Usage metering as fire-and-forget after successful operations.
**When to use:** Stripe billing specifically. Any future billing/monetization concern.
**Trade-offs:** Every request pays a small cost for the billing check. Mitigate by caching the subscription tier in Redis (Upstash) with 5-minute TTL, invalidated on Stripe webhook.

```typescript
// packages/api/src/middleware/billing.ts
const billingMiddleware = t.middleware(async ({ ctx, next }) => {
  // Fast path: check Redis cache first
  const cached = await redis.get(`billing:${ctx.organizationId}`);
  if (cached) {
    return next({ ctx: { ...ctx, subscription: JSON.parse(cached) } });
  }

  const sub = await prisma.subscription.findFirst({
    where: { organizationId: ctx.organizationId, status: { in: ["ACTIVE", "TRIALING"] } },
  });

  if (!sub) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Active subscription required" });
  }

  await redis.set(`billing:${ctx.organizationId}`, JSON.stringify(sub), { ex: 300 });
  return next({ ctx: { ...ctx, subscription: sub } });
});
```

## Data Flow

### Webhook Processing (Existing -- Extended for Linear)

```
Linear/Teams Webhook
    ↓ HTTP POST
/api/webhooks/linear (generic route) OR /api/messages/teams (Bot Framework)
    ↓
Adapter.verifyWebhookSignature() (Linear) OR botFramework.processActivity() (Teams)
    ↓
WebhookDelivery log (Prisma)
    ↓
QStash queue → /api/webhooks/_process
    ↓
Provider-specific handler (linear-webhook-handler, teams-action-handler)
    ↓
Domain mutations (ExternalLink sync, approval actions, status updates)
```

### Billing Middleware (New)

```
tRPC Request
    ↓
authMiddleware → tenantMiddleware → rbacMiddleware
    ↓
billingMiddleware ← Redis cache OR Subscription.findFirst({ orgId })
    ↓
  ├─ ACTIVE subscription → check feature gates → proceed
  ├─ TRIALING → proceed (all features enabled during trial)
  ├─ PAST_DUE → proceed with warning (grace period)
  └─ CANCELED/UNPAID → reject with 402 + upgrade URL
    ↓
sensitiveMiddleware → handler
```

### AI Credit Metering (New)

```
OCR Extraction Request
    ↓
billingMiddleware → check subscription tier allows OCR
    ↓
featureGates.checkAICredits(orgId)
  ├─ Credits available → proceed
  └─ Credits exhausted → reject with 402 + buy credits CTA
    ↓
Claude Vision API call (existing ocr-extraction.ts)
    ↓
On success: fire-and-forget meter event
  void stripe.billing.meterEvents.create({
    event_name: "ai_extraction",
    payload: { stripe_customer_id: org.stripeCustomerId, value: "1" },
  }).catch(...)
    ↓
Update local UsageRecord for dashboard display
```

### Equipment Lifecycle (New)

```
Equipment Assignment (via onboarding workflow task or manual)
    ↓
equipment-service.assignToContractor(equipmentId, contractorId)
    ↓
Create Shipment → courier-client.createShipment() OR manual tracking number entry
    ↓
Status tracking: QStash cron polls courier API  OR  courier webhook callback
    ↓
ShipmentStatusUpdate log → update Shipment.status
    ↓
On delivery: Equipment.status = ASSIGNED, notify contractor via portal + messaging
    ↓
On offboarding: Create return Shipment, track return, Equipment.status = RETURNED
```

### Onboarding Import (New)

```
User connects integrations (Google Workspace, Linear, Jira, etc.)
    ↓
User clicks "Import from connected tools" in onboarding wizard
    ↓
Import Orchestrator reads from each connected provider:
  ├── Google Workspace API → users, departments
  ├── Linear GraphQL → teams, projects, members
  ├── Jira REST → projects, team members
  └── Slack API → workspace members
    ↓
Per-provider mapper normalizes to import candidates:
  { type: "user"|"contractor"|"project"|"team", data: {...}, source: "linear", dedup_key: "email" }
    ↓
Deduplication across sources (merge by email, name)
    ↓
Preview UI → user reviews, selects/deselects candidates
    ↓
Batch create via Prisma transaction
    ↓
ImportSession.status = COMPLETED, audit log entries
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 orgs | Current architecture handles fine. Billing middleware hits DB once per 5 min (Redis cache). Equipment polling via QStash cron is low volume. |
| 500-5K orgs | Billing middleware must use Redis cache (DB per request is too expensive). Courier polling needs batching -- fan out QStash cron to process N shipments per invocation. |
| 5K+ orgs | Stripe Meter events at volume -- batch meter events using `stripe.billing.meterEvents.create()` in bulk windows instead of per-request. Move billing tier check entirely to Redis. |

### Scaling Priorities

1. **First bottleneck -- Billing middleware DB query:** Every tRPC request checks subscription status. Without caching, this adds ~5ms per request. At 5K orgs with 100 RPM each, that is 500K queries/minute on the subscription table. **Solution:** Redis cache with 5-minute TTL, invalidated on Stripe webhook events (`customer.subscription.updated`, `invoice.paid`).
2. **Second bottleneck -- Courier status polling:** Polling 3 courier APIs for every active shipment on a cron schedule. At 1000 active shipments across 3 carriers, that is 1000 API calls every polling interval. **Solution:** Switch to webhook-only for carriers that support it (InPost), poll only for carriers without webhook support, increase polling interval for non-urgent shipments.

## Anti-Patterns

### Anti-Pattern 1: Using IntegrationProviderAdapter for Couriers

**What people do:** Create `InPostAdapter extends BaseAdapter` and register it alongside Slack, Jira, Linear.
**Why it's wrong:** Courier APIs use API keys (not OAuth), don't have bidirectional sync, and don't need the credential encryption/rotation infrastructure. The `IntegrationProviderAdapter` interface has methods (`exchangeCodeForTokens`, `refreshToken`, `getOAuthConfig`) that would be empty stubs. The `IntegrationConnection` model tracks OAuth state that doesn't apply.
**Do this instead:** Simple `CourierClient` interface with carrier-specific HTTP clients in `packages/api/src/services/courier/`. Store API keys in environment variables, not in encrypted credential blobs.

### Anti-Pattern 2: Using IntegrationProviderAdapter for Stripe

**What people do:** Create `StripeAdapter extends BaseAdapter` and route Stripe webhooks through the generic `/api/webhooks/[provider]` pipeline.
**Why it's wrong:** Stripe is tenant infrastructure, not a user-managed integration. Org admins don't "connect" and "disconnect" Stripe -- it's always active once the org has a subscription. Stripe webhook verification uses `stripe.webhooks.constructEvent()` with a webhook signing secret, which is incompatible with the adapter's `verifyWebhookSignature(rawBody, headers)` return type. The WebhookDelivery log and QStash queue add unnecessary latency to billing-critical events.
**Do this instead:** Dedicated `/api/webhooks/stripe/route.ts` with Stripe SDK verification. Billing service in `packages/api/src/services/billing/`. Subscription data in its own Prisma schema.

### Anti-Pattern 3: Direct Teams/Slack Calls in Business Logic

**What people do:** Import `teams-provider.ts` directly in the approval router, creating tight coupling to a specific messaging platform.
**Why it's wrong:** When a third messaging platform appears (Discord, Google Chat), every call site needs `if/else` branching. The existing `slack-client.ts` direct-call pattern already shows this problem -- `notification-service.ts` has Slack-specific imports and function calls.
**Do this instead:** All messaging dispatch goes through `getMessagingProviders(orgId)` which returns all connected providers. Business logic never references Slack or Teams directly. The fire-and-forget pattern (`void + .catch()`) already established in the codebase is the right dispatch model.

### Anti-Pattern 4: Putting Onboarding Import Logic in Adapters

**What people do:** Add `importUsers()` or `listTeamMembers()` methods to `GoogleWorkspaceAdapter` or `LinearAdapter`.
**Why it's wrong:** Import orchestration is a cross-cutting concern that spans multiple providers and involves deduplication, preview, and batch creation. The adapter interface should only handle OAuth plumbing and webhook verification -- it has no concept of "import" or "batch create".
**Do this instead:** Import orchestrator service that reads from provider APIs using the existing `IntegrationConnection` credentials. Per-provider mapper services handle data normalization. The orchestrator handles dedup, preview, and batch create.

## Integration Points

### External Services

| Service | Auth Pattern | Integration Pattern | Notes |
|---------|-------------|---------------------|-------|
| Linear API | OAuth 2.0 (refresh tokens mandatory since April 2026) | GraphQL API + Webhooks (HMAC-SHA256) | Use `graphql-request` or direct fetch. Team-scoped access (store teamId in configJson). |
| Microsoft Teams | Azure AD OAuth 2.0 + Bot Framework | Bot Framework SDK v4 + Adaptive Cards | Requires Azure Bot registration. Proactive messaging needs stored ConversationReference. Admin consent for org install. |
| Google Workspace | Google OAuth 2.0 (domain admin consent) | Admin SDK Directory API (REST) | Separate from Google Calendar connection. Scope: `admin.directory.user.readonly`. |
| InPost ShipX | OAuth 2.0 or API key | REST API (tracking + webhooks) | Polish-market courier. Base: `api-shipx-pl.easypack24.net/v1/`. Webhook for status updates. |
| DPD | API key | REST API (tracking) | Limited webhook support. Polling-based tracking. |
| UPS | OAuth 2.0 | REST API (tracking) | Tracking API. Webhook via "My Choice" platform. |
| Stripe | API key (server-side) + Webhooks | Stripe SDK + Billing Meters + Customer Portal | Meters for usage-based pricing. `constructEvent()` for webhook verification. Customer Portal for self-service. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Billing middleware <-> tRPC routers | Middleware injection in chain | Every protected route checks subscription tier. Cache in Redis with 5-min TTL. Invalidate on Stripe webhook. |
| Notification service <-> Messaging providers | Service call (fire-and-forget) | `notification-service.ts` dispatches to all connected providers via `getMessagingProviders()`. Existing `void + .catch()` pattern. |
| Import orchestrator <-> Provider APIs | Credential reuse | Uses existing `IntegrationConnection` credentials. Does NOT create new connections. Reads data, normalizes, previews, batch-creates. |
| Equipment service <-> Workflow engine | Domain integration | Equipment assignment/return triggers workflow tasks. Uses existing `WorkflowTaskRun` model with new task types. |
| Courier clients <-> QStash | Cron scheduling | Status polling scheduled via QStash cron. Webhook updates from InPost bypass cron. |
| Stripe billing <-> OCR service | Usage metering | After successful OCR extraction, fire-and-forget meter event to Stripe. Local UsageRecord for dashboard. |

## Build Order Recommendation

Based on dependency analysis and risk assessment:

1. **Linear adapter** -- zero dependencies on other v3.0 features, clean adapter pattern extension, validates that "add a new adapter" is still a smooth 1-2 phase operation. Lowest risk, immediate value.
2. **Stripe billing** -- infrastructure that all other features may depend on (feature gates determine which integrations are available per tier, credit metering for AI). Better to have billing in place early so subsequent features integrate with gates from the start.
3. **Teams adapter + Messaging abstraction** -- requires refactoring `notification-service.ts` and extracting `slack-client.ts` into the messaging abstraction. This touches many existing features (approvals, reminders, alerts). Build early to stabilize the refactoring before more features pile on.
4. **Google Workspace adapter** -- OAuth adapter + directory sync service. Enables the onboarding import feature that comes later.
5. **Equipment/Shipment tracking** -- new bounded context, fully independent of other v3.0 integrations. Can be built in parallel with Google Workspace if capacity allows.
6. **Intelligent onboarding import** -- depends on multiple integrations being connected (Linear, Google Workspace, Jira, Slack, Teams). Build last because it orchestrates across already-built integrations.

**Rationale:**
- Linear first: lowest risk, validates adapter extension pattern, no refactoring
- Stripe second: infrastructure dependency for feature gates and metering
- Teams third: messaging abstraction is a refactoring risk that benefits from early stabilization
- Google Workspace fourth: prerequisite for onboarding import
- Equipment fifth: independent domain, no integration dependencies
- Onboarding import last: cross-cutting orchestrator that needs its dependencies already built

## Sources

- Linear OAuth 2.0: https://linear.app/developers/oauth-2-0-authentication (HIGH confidence)
- Linear Webhooks: https://linear.app/developers/webhooks (HIGH confidence)
- Microsoft Teams Bot Framework: https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/authentication/add-authentication (HIGH confidence)
- Microsoft Teams Adaptive Cards: https://learn.microsoft.com/en-us/adaptive-cards/authoring-cards/universal-action-model (HIGH confidence)
- Microsoft Teams Proactive Messaging: https://learn.microsoft.com/en-us/samples/officedev/microsoft-teams-samples/officedev-microsoft-teams-samples-bot-proactive-messaging-teamsfx-nodejs/ (HIGH confidence)
- Google Workspace Admin SDK Directory API: https://developers.google.com/workspace/admin/directory/v1/guides (HIGH confidence)
- InPost ShipX API: https://dokumentacja-inpost.atlassian.net/wiki/spaces/PL/pages/622754/API+ShipX (MEDIUM confidence)
- Stripe Billing Meters: https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api (HIGH confidence)
- Stripe Subscriptions Quantities (per-seat): https://docs.stripe.com/billing/subscriptions/quantities (HIGH confidence)
- Stripe Metered Billing Guide 2026: https://www.buildmvpfast.com/blog/stripe-metered-billing-implementation-guide-saas-2026 (MEDIUM confidence)
- Existing codebase analysis: `packages/integrations/src/`, `packages/api/src/services/`, `packages/db/prisma/schema/` (HIGH confidence)

---
*Architecture research for: Contractor Ops v3.0 Enterprise & Monetization*
*Researched: 2026-04-01*
