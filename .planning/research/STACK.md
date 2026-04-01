# Stack Research: v3.0 Enterprise & Monetization

**Domain:** B2B contractor operations platform — new integrations + billing
**Researched:** 2026-04-01
**Confidence:** HIGH (versions verified via npm registry, API docs confirmed via official sources)

## Scope

This document covers ONLY the stack additions needed for v3.0 features:
- Linear bidirectional integration
- Microsoft Teams integration (approve/reject)
- Google Workspace integration (directory import)
- Courier tracking APIs (InPost, DPD, UPS)
- Stripe billing (subscriptions + AI credit metering)

The existing stack (Next.js 15, React 19, tRPC, Prisma, Better Auth, QStash, etc.) is validated and unchanged. The provider-agnostic integration framework (BaseAdapter, credential store, webhook pipeline, health monitoring) is reused for all new integrations.

## Recommended Stack Additions

### Integration SDKs

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@linear/sdk` | ^80.1.0 | Linear GraphQL API client | Official TypeScript SDK with strong typing, OAuth 2.0 support, model-based API matching existing adapter pattern. Auto-generated from Linear's GraphQL schema so types are always current. |
| `botbuilder` | ^4.23.3 | Microsoft Teams bot framework | Official Microsoft SDK. Teams-specific functions (teamsGetChannelId, teamsNotifyUser) are built into core since v4.6 — no separate `botbuilder-teams` package needed. Handles Adaptive Card actions (Action.Execute for approve/reject). |
| `adaptivecards` | ^3.0.5 | Adaptive Card templating for Teams | Official library for building/validating Adaptive Cards. Needed for rendering approval cards with approve/reject buttons, invoice summaries, and reminder notifications in Teams. |
| `googleapis` | ^171.4.0 | Google Workspace Admin Directory API | Official Google API client. Covers Directory API (user listing, group membership) and supports service account + OAuth auth. Already partially in ecosystem (Google Calendar adapter exists). Reuse the same Google OAuth connection for directory access by adding `admin.directory.user.readonly` and `admin.directory.group.readonly` scopes. |

### Billing

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `stripe` | ^21.0.1 | Server-side Stripe API (subscriptions, meters, webhooks) | Official Node.js SDK. v21 uses API version 2026-03-25.dahlia. Supports Meters API for usage-based billing (AI/OCR credits), Subscriptions API for flat + per-seat plans, Customer Portal for self-service, and webhook signature verification. |
| `@stripe/stripe-js` | ^9.0.1 | Client-side Stripe.js loader | Loads Stripe.js for Checkout Sessions and Customer Portal redirects. Thin wrapper, no PCI scope increase. |
| `@stripe/react-stripe-js` | ^6.1.0 | React components for Stripe Elements | Provides `<Elements>`, `<PaymentElement>`, `<PricingTable>` components. Only needed if embedding payment forms directly (vs Checkout Sessions redirect). Include but may defer usage — Checkout Sessions are simpler for v3.0 MVP. |

### Courier Tracking

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Direct REST API calls | N/A | InPost ShipX, DPD, UPS tracking | **No SDK needed.** All three couriers expose REST APIs. Build thin adapter classes (following existing BaseAdapter pattern) that call REST endpoints directly with `fetch()`. This avoids unmaintained npm packages and keeps the dependency footprint small. See rationale below. |
| `zod` | (already installed) | Validate courier API responses | Parse and validate external API responses at the boundary. Already in the project. |

### No New Dependencies Required

| Capability | Why No New Package |
|------------|-------------------|
| Courier API HTTP calls | Use native `fetch()` (Node 18+). InPost ShipX, DPD, and UPS all have REST/JSON APIs. Existing npm packages for these couriers are poorly maintained (last updates 2-5 years ago). |
| Webhook signature verification | Existing `crypto` module (HMAC-SHA256) pattern from Slack adapter applies to Linear, Teams, and Stripe webhooks. |
| OAuth flows | Existing credential store + token refresh infrastructure handles Linear and Google OAuth. Teams uses Azure AD app registration (client credentials flow for bot, not user OAuth). |
| Async job processing | QStash (already installed) handles courier polling, sync jobs, and meter event batching. |
| Encryption | AES-256-GCM per-provider encryption (already built) covers all new provider credentials. |

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `adaptivecards-templating` | ^2.3.1 | Data binding for Adaptive Cards | Use when rendering dynamic data (invoice amounts, contractor names) into Adaptive Card templates. Pairs with `adaptivecards`. |

## Installation

```bash
# Integration SDKs (into packages/integrations)
npm install @linear/sdk@^80.1.0 botbuilder@^4.23.3 adaptivecards@^3.0.5 adaptivecards-templating@^2.3.1 googleapis@^171.4.0

# Billing — server-side (into packages/integrations)
npm install stripe@^21.0.1

# Billing — client-side (into apps/web)
npm install @stripe/stripe-js@^9.0.1 @stripe/react-stripe-js@^6.1.0
```

All packages install into existing workspace packages:
- `@linear/sdk`, `botbuilder`, `adaptivecards*`, `googleapis` --> `packages/integrations`
- `stripe` --> `packages/integrations` (server-side webhook handling, meter events) AND `apps/web` (tRPC router calls)
- `@stripe/stripe-js`, `@stripe/react-stripe-js` --> `apps/web` (client-side only)

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@linear/sdk` (official) | Raw GraphQL via `graphql-request` | Never for Linear — the SDK is auto-generated from their schema, handles pagination, and provides typed models. Going raw adds boilerplate with zero benefit. |
| `botbuilder` (official) | Microsoft Graph API direct calls | Only if you need proactive messaging without bot registration. But approve/reject requires Adaptive Card actions which need the Bot Framework. Graph alone cannot handle interactive card responses. |
| `googleapis` | `google-admin-sdk` (community) | Never — community package has 34 weekly downloads, limited API coverage, and no Google backing. `googleapis` is the official monorepo client. |
| Direct REST for couriers | TrackingMore / AfterShip aggregator API | Consider if adding 5+ courier providers. For 3 couriers (InPost, DPD, UPS), direct integration is simpler, cheaper (no aggregator fees), and gives full control over polling intervals. Aggregators charge $0.04-0.05 per tracking call. |
| Direct REST for couriers | `ups-nodejs-sdk`, `shipping-ups` npm packages | Never — these packages have low download counts (under 500/week), infrequent updates, and add dependency risk for what amounts to 2-3 REST endpoint calls per courier. |
| `stripe` (official) | Paddle, Lemon Squeezy | Only if targeting merchant-of-record model to avoid EU VAT handling. Stripe gives more control over pricing, better metered billing support, and is the standard for SaaS in Poland. |
| Stripe Checkout Sessions | Embedded Stripe Elements | Consider embedded Elements if you need a fully custom payment form. For v3.0, Checkout Sessions are faster to implement and PCI-compliant by default. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `botbuilder-teams` | Deprecated since Bot Framework v4.6 (5+ years ago). Teams functions merged into core `botbuilder`. | `botbuilder` ^4.23.3 |
| `@microsoft/teams-js` | Client-side Teams SDK for tabs/task modules. Not needed for bot-based approve/reject. Only needed if building a Teams tab app. | `botbuilder` for bot interactions |
| `google-admin-sdk` (npm) | Community package, 34 downloads/week, limited coverage | `googleapis` ^171.4.0 |
| Any InPost/DPD/UPS npm SDK | All poorly maintained (last updates 2019-2022), low downloads, incomplete API coverage | Direct `fetch()` calls with Zod validation |
| `stripe-event-types` | Redundant — Stripe SDK v21 includes full TypeScript types for all webhook event types | `stripe` ^21.0.1 (types included) |
| Courier aggregator (TrackingMore, AfterShip) | Adds cost ($0.04-0.05/call), another vendor dependency, and rate limits for only 3 carriers | Direct REST integration |

## Integration Architecture Notes

### How New Adapters Fit the Existing Framework

Every new integration follows the established `BaseAdapter` pattern:

```
LinearAdapter extends BaseAdapter
  - slug: "linear"
  - supportsOAuth: true (Linear OAuth 2.0)
  - supportsWebhooks: true (Linear webhook signatures)
  - handleWebhook: process issue.create, issue.update, issue.remove

TeamsAdapter extends BaseAdapter
  - slug: "teams"
  - supportsOAuth: false (uses Azure AD app credentials, not user OAuth)
  - supportsWebhooks: true (Bot Framework activity handling)
  - Custom: BotFrameworkAdapter wraps botbuilder internally

GoogleWorkspaceAdapter extends BaseAdapter
  - slug: "google-workspace"
  - supportsOAuth: true (reuses Google OAuth, adds directory scopes)
  - supportsWebhooks: false (polling-based directory sync)
  - NOTE: Separate from existing GoogleCalendarAdapter — different scopes, different purpose

InPostAdapter extends BaseAdapter
  - slug: "inpost"
  - supportsOAuth: true (InPost ShipX uses OAuth 2.0)
  - supportsWebhooks: true (InPost supports status webhooks)

DpdAdapter extends BaseAdapter
  - slug: "dpd"
  - supportsOAuth: false (API key auth)
  - supportsWebhooks: true (DPD callback URL for status changes)

UpsAdapter extends BaseAdapter
  - slug: "ups"
  - supportsOAuth: true (UPS uses OAuth 2.0 since 2024 migration)
  - supportsWebhooks: false (polling-based tracking)

StripeAdapter extends BaseAdapter
  - slug: "stripe"
  - supportsOAuth: false (API key, not per-org OAuth)
  - supportsWebhooks: true (Stripe webhook signatures via stripe.webhooks.constructEvent)
```

### Stripe Billing Architecture

Stripe is NOT a per-org integration (unlike Linear/Teams/Google). It is platform-level:

- **One Stripe account** for the entire platform (not per-tenant)
- **Stripe Customer** maps to Organization
- **Stripe Subscription** maps to organization's plan (flat fee + per-seat quantity)
- **Stripe Meter** tracks AI/OCR usage per customer
- **Stripe Checkout Sessions** for initial subscription + plan changes
- **Stripe Customer Portal** for self-service billing management
- **Stripe Webhooks** for subscription lifecycle (created, updated, cancelled, invoice.paid, invoice.payment_failed)

### Teams Bot Registration

Teams requires an Azure AD app registration (not standard OAuth like other integrations):
- Register bot in Azure Bot Service
- Get Microsoft App ID + App Password
- Configure messaging endpoint URL (`/api/webhooks/teams/messages`)
- Bot Framework handles authentication internally via `BotFrameworkAdapter`
- No per-org OAuth — the bot is installed into Teams workspaces via manifest

### Google Workspace Scopes Strategy

The existing Google Calendar adapter already handles Google OAuth. For directory import:
- Add `admin.directory.user.readonly` and `admin.directory.group.readonly` scopes to the Google OAuth connection
- Create a separate `GoogleWorkspaceAdapter` (not merged into calendar adapter — different capability, different consent screen)
- Requires the connecting user to be a Google Workspace admin (scope enforcement)

### Courier API Authentication Summary

| Courier | Auth Method | Base URL | Rate Limits |
|---------|------------|----------|-------------|
| InPost ShipX | OAuth 2.0 Bearer token | `https://api-shipx-pl.easypack24.net/v1/` | Not published, respect 429s |
| DPD | API Key in header | `https://api.dpd.com.pl/` | Not published, respect 429s |
| UPS | OAuth 2.0 (client credentials) | `https://onlinetools.ups.com/api/` | 1 req/sec default tier |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `stripe@^21.0.1` | Node 18+ | Uses API version 2026-03-25.dahlia, requires Node 18+ (LTS) |
| `@stripe/react-stripe-js@^6.1.0` | React 19, `@stripe/stripe-js@^9.0.1` | Must pair with matching stripe-js version |
| `botbuilder@^4.23.3` | Node 18+ | Uses `restify` internally but works with Express/Next.js API routes via adapter |
| `@linear/sdk@^80.1.0` | Node 18+ | Auto-generated, frequent major versions (follows Linear API changes) — pin to ^80 |
| `googleapis@^171.4.0` | Node 18+ | Monorepo package — large but tree-shakeable. Only imports used services. |

## Environment Variables Required

```bash
# Linear
LINEAR_CLIENT_ID=
LINEAR_CLIENT_SECRET=
LINEAR_WEBHOOK_SECRET=

# Microsoft Teams
TEAMS_APP_ID=
TEAMS_APP_PASSWORD=
TEAMS_APP_TENANT_ID=

# Google Workspace (extends existing Google OAuth)
# No new vars — reuses GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
# Additional scopes requested at connection time

# Courier APIs
INPOST_CLIENT_ID=
INPOST_CLIENT_SECRET=
DPD_API_KEY=
DPD_API_PASSWORD=
UPS_CLIENT_ID=
UPS_CLIENT_SECRET=

# Stripe (platform-level, not per-org)
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_METER_EVENT_NAME=ai_ocr_credits
```

## Sources

- [Linear SDK npm](https://www.npmjs.com/package/@linear/sdk) — version 80.1.0 verified via `npm view`
- [Linear Developers](https://linear.app/developers) — OAuth + webhook documentation
- [botbuilder npm](https://www.npmjs.com/package/botbuilder) — version 4.23.3 verified via `npm view`
- [Microsoft Teams Bot Approval Sample](https://learn.microsoft.com/en-us/samples/officedev/microsoft-teams-samples/officedev-microsoft-teams-samples-bot-request-approval-nodejs/) — reference implementation for approve/reject flows
- [Adaptive Cards Actions](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/universal-actions-for-adaptive-cards/up-to-date-views) — Action.Execute pattern for approval cards
- [googleapis npm](https://www.npmjs.com/package/googleapis) — version 171.4.0 verified via `npm view`
- [Google Admin SDK Quickstart](https://developers.google.com/workspace/admin/directory/v1/quickstart/nodejs) — Node.js setup (updated March 2026)
- [stripe npm](https://www.npmjs.com/package/stripe) — version 21.0.1 verified via `npm view`
- [Stripe Usage-Based Billing](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api) — Meters API for AI credit metering
- [Stripe AI Startup Guide](https://docs.stripe.com/get-started/use-cases/usage-based-billing) — reference architecture for usage-based billing
- [InPost ShipX API Docs](https://dokumentacja-inpost.atlassian.net/wiki/spaces/PL/pages/622754/API+ShipX) — REST API with OAuth 2.0
- [DPD API Documentation v1.2.1](https://www.dpd.com/wp-content/uploads/sites/235/2023/04/DPD-API-documentation-v1-2-1.pdf) — REST API specification
- [UPS Developer Portal](https://www.npmjs.com/package/ups-nodejs-sdk) — OAuth 2.0 migration confirmed

---
*Stack research for: v3.0 Enterprise & Monetization additions*
*Researched: 2026-04-01*
