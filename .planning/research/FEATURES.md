# Feature Research: v3.0 Enterprise & Monetization

**Domain:** B2B Contractor Operations Platform -- enterprise integrations, intelligent onboarding, equipment tracking, monetization
**Researched:** 2026-04-01
**Confidence:** MEDIUM-HIGH (verified against official APIs, Stripe docs, courier API docs, existing codebase patterns)

## Feature Landscape

### Table Stakes (Users Expect These)

Features that each v3.0 module must ship. Without these, each integration feels half-baked.

#### Linear Bidirectional Integration

Mirrors the existing Jira integration pattern. Linear uses GraphQL API + webhooks, not REST.

| Feature | Why Expected | Complexity | Dependencies on v2.0 | Notes |
|---------|--------------|------------|----------------------|-------|
| Connect Linear workspace (OAuth 2.0) | Same pattern users already have for Jira -- connect once, use everywhere | LOW | Integration framework, OAuth credential store | Linear OAuth 2.0 with mandatory refresh tokens (enforced from April 2026). New LinearAdapter extending BaseAdapter |
| Create Linear issue from workflow | Onboarding step auto-creates Linear issue for IT setup, access provisioning, etc. | MEDIUM | Workflow engine | GraphQL mutation `issueCreate` with teamId, title, description, assigneeId, labelIds. Must resolve team/project IDs first |
| Bidirectional status sync | When Linear issue moves to "Done", linked workflow task updates. When task completes, Linear issue closes | MEDIUM | Workflow engine, webhook pipeline | Linear webhooks fire on Issue create/update/remove. Payload mirrors GraphQL entity. HMAC-SHA256 verification. Map Linear workflow states to internal task statuses |
| Linked issue display | Show Linear issue key + status badge on workflow task views, clickable to Linear | LOW | UI components | Store Linear issue ID + URL + status. Same chip/badge pattern as existing Jira linked issues |
| Status mapping configuration | Admin maps Linear workflow states (e.g., "In Progress", "Done") to internal task statuses | MEDIUM | Settings UI | Per-team status mapping since Linear statuses are per-team. Similar to existing Jira status mapping |

#### Teams Integration (Approve/Reject + Notifications)

Mirrors existing Slack integration. Teams uses Bot Framework + Adaptive Cards instead of Slack Block Kit.

| Feature | Why Expected | Complexity | Dependencies on v2.0 | Notes |
|---------|--------------|------------|----------------------|-------|
| Approve/reject from Teams message | Manager receives approval request in Teams, clicks Approve/Reject without leaving Teams | HIGH | Approval workflow, notification system | Requires a registered Teams Bot (Azure Bot Service) + Adaptive Cards with Action.Execute buttons. Action payloads route back to webhook endpoint. Significantly more complex than Slack -- requires Azure AD app registration, bot manifest, Teams app package |
| Approval reminders in Teams | Overdue approval requests send reminder in Teams DM | MEDIUM | Approval SLA timers | Proactive messaging via stored ConversationReference. Bot must capture reference on first interaction, store per-user. Uses `adapter.continueConversation()` pattern |
| Activity alerts in Teams | Invoice received, payment completed, contract expiring -- same alerts as Slack channel | MEDIUM | Notification system | Adaptive Card templates for each notification type. Post to configured Teams channel via bot. User-specific views for approval cards |
| Teams channel configuration | Admin selects which Teams channel receives which notification types | LOW | Settings UI, notification routing | Store Teams channel ID + webhook URL per notification category. Similar to existing Slack channel config |
| Connect Teams workspace | Admin authorizes the Teams bot for their tenant | HIGH | Integration framework | Azure AD OAuth 2.0 with admin consent for the bot. Requires Azure App Registration with `ChannelMessage.Send`, `User.Read` permissions. Bot must be published to org's Teams app catalog or sideloaded |

#### Google Workspace Directory Import

New capability -- importing org structure from Google Workspace to bootstrap the platform.

| Feature | Why Expected | Complexity | Dependencies on v2.0 | Notes |
|---------|--------------|------------|----------------------|-------|
| Connect Google Workspace (OAuth + admin consent) | One-click connect to pull organization directory | MEDIUM | Integration framework, existing Google Calendar OAuth can be extended | Requires Admin SDK Directory API scopes: `admin.directory.user.readonly`, `admin.directory.group.readonly`. Needs domain-wide delegation OR admin consent. Builds on existing Google OAuth flow |
| List and preview users from directory | Show Google Workspace users with name, email, department, org unit before importing | LOW | UI components | `GET /admin/directory/v1/users?domain=example.com` returns full user list with org unit, department, title. Paginated (max 500/request) |
| Selective user import as org members | Pick which Google users to import as internal org members (not contractors) | MEDIUM | User management, RBAC | Map Google user fields to internal user model. Auto-assign roles based on department/org unit rules. Dedup against existing users by email |
| Group-based role mapping | Map Google Workspace groups to internal RBAC roles (e.g., "Finance" group -> "approver" role) | MEDIUM | RBAC system | `GET /admin/directory/v1/groups` + member listing. Pre-populate role assignments during import |
| Periodic directory sync | Keep internal user list in sync with Google Workspace changes (new hires, departures) | HIGH | Background jobs, user management | Scheduled sync via QStash cron. Diff detection: new users -> invite, removed users -> flag for deactivation. Must NOT auto-delete -- flag only |

#### Intelligent Org Onboarding via Connected Tools

Enhances existing 5-step onboarding checklist with data import from connected integrations.

| Feature | Why Expected | Complexity | Dependencies on v2.0 | Notes |
|---------|--------------|------------|----------------------|-------|
| Import wizard with source selection | "Where do you manage your team today?" -> select Linear/Jira/Google/Slack -> import relevant data | MEDIUM | Onboarding wizard (existing), integration connections | Step-by-step wizard: (1) connect tools, (2) preview data, (3) map fields, (4) confirm import. Extends existing 5-step onboarding |
| Import team members from connected tools | Pull users from Jira, Linear, Google Workspace, Slack and create org members | MEDIUM | User management, connected integrations | Each source provides user data: Jira users via `/rest/api/3/users/search`, Linear team members via GraphQL, Google via Directory API, Slack via `users.list`. Dedup across sources by email |
| Import projects/statuses from PM tools | Pull Jira projects + Linear teams/projects to pre-configure workflow templates | MEDIUM | Workflow engine | Map external project structures to internal workflow templates. Pre-populate status mappings |
| Data preview and conflict resolution | Show what will be imported, highlight duplicates, let admin resolve conflicts before committing | MEDIUM | UI components | Preview table with diff indicators: new (green), duplicate (yellow), conflict (red). Batch confirm/skip/edit |
| Progress tracking with partial retry | Import progress bar, ability to retry failed items without re-importing everything | LOW | Background jobs | QStash for async import. Track per-item status. Failed items shown in review screen with retry button |

#### Equipment/Shipment Tracking

New domain -- tracking physical equipment (laptops, phones, access cards) tied to contractor lifecycle.

| Feature | Why Expected | Complexity | Dependencies on v2.0 | Notes |
|---------|--------------|------------|----------------------|-------|
| Equipment registry | CRUD for equipment items: type, serial number, assigned contractor, status (in stock, assigned, in transit, returned) | MEDIUM | Contractor registry | New `equipment` table with contractor FK. Equipment types: laptop, phone, access card, other. Status lifecycle: available -> assigned -> in_transit -> delivered -> return_requested -> returned |
| Assign equipment to contractor | Link equipment to contractor, track assignment history | LOW | Contractor profiles | Assignment creates audit trail entry. Shows on contractor profile "Equipment" tab |
| Create shipment for equipment | Ship equipment to contractor (onboarding) or request return (offboarding). Manual entry: carrier, tracking number, expected delivery | MEDIUM | Equipment registry | New `shipment` table linked to equipment + contractor. Manual entry always available regardless of courier API integration |
| InPost ShipX API integration | Create InPost shipments (Parcel Locker + courier), track status automatically | HIGH | Integration framework | InPost ShipX API with OAuth 2.0. Sandbox at `sandbox-api-shipx-pl.easypack24.net`. Create shipment -> get tracking number -> webhook/poll for status updates. Parcel Locker selection UI needed (list of lockers via API) |
| DPD API integration | Create DPD shipments, generate labels, track status | HIGH | Integration framework | DPD WebAPI (SOAP/REST). Shipment creation, label PDF generation, tracking status polling. Less documented than InPost, may need direct DPD partner onboarding |
| UPS API integration | Create UPS shipments, track status | HIGH | Integration framework | UPS Developer Kit REST API. OAuth 2.0 auth. Shipment creation + tracking. Well-documented but requires UPS developer account approval |
| Tracking status display | Show shipment status timeline on equipment detail and contractor profile | MEDIUM | Equipment registry, shipments | Unified status model across carriers: created -> picked_up -> in_transit -> out_for_delivery -> delivered. Map each carrier's native statuses to this model |
| Workflow integration for equipment | Onboarding workflow step: "Ship laptop to contractor" triggers shipment creation. Offboarding: "Return equipment" triggers return request | MEDIUM | Workflow engine, equipment registry | New workflow action types: `create_shipment`, `request_return`. Auto-advance workflow task when shipment status reaches target (e.g., "delivered") |
| Equipment return tracking | Track return shipments. Contractor initiates return via portal, gets shipping label | MEDIUM | Contractor portal, equipment registry | Return flow: contractor requests return -> org approves -> system generates return label (via courier API) -> contractor ships -> status tracked |

#### Stripe Paywall (Subscriptions + AI Credit Metering)

Monetization layer. First paywall for the platform.

| Feature | Why Expected | Complexity | Dependencies on v2.0 | Notes |
|---------|--------------|------------|----------------------|-------|
| Subscription tiers (flat + per-seat) | Standard SaaS pricing: Starter/Pro/Enterprise with per-seat component | HIGH | Org management, user management | Stripe Subscription with `quantity` for per-seat. Products + Prices in Stripe Dashboard. Subscription lifecycle: `trial -> active -> past_due -> canceled`. Webhook-driven status sync |
| Free trial period | 14-day free trial, no credit card required (or card required -- product decision) | MEDIUM | Subscription management | Stripe `trial_period_days` on subscription creation. Trial-end webhook triggers "upgrade or lose access" flow |
| AI/OCR credit metering | Track Claude Vision OCR usage per org, bill overage beyond plan allowance | HIGH | OCR service (existing), invoice processing | Stripe Meter API (post-2025-03-31 API version). Create Meter for `ocr_pages_processed`. Report meter events on each OCR call. Metered price attached to subscription. Credits burned at invoice finalization |
| Credit grants for plans | Each tier includes N free OCR pages/month. Overage billed per-page | MEDIUM | AI credit metering | Stripe Billing Credits with credit grants. Reset monthly. Grant applied before overage kicks in |
| Billing portal (Stripe hosted) | Customer manages payment method, views invoices, cancels subscription | LOW | Subscription management | Stripe Customer Portal -- hosted by Stripe. One redirect URL. Handles payment method updates, invoice history, cancellation |
| Feature gating by plan | Restrict features by subscription tier (e.g., integrations only on Pro+, equipment tracking on Enterprise) | MEDIUM | All feature modules | Middleware that checks org's active subscription tier. Plan limits stored in config, checked on feature access. Graceful upgrade prompts, not hard blocks |
| Usage dashboard | Org admin sees current plan, usage stats (seats, OCR credits), billing date | LOW | Subscription management, metering | Pull from Stripe API: subscription status, current period, upcoming invoice amount. Combine with internal usage counters |
| Upgrade/downgrade flow | Change plans with proration | MEDIUM | Subscription management | Stripe handles proration automatically. `subscription.update` with `proration_behavior: 'create_prorations'`. Show price difference preview before confirming |
| Webhook-driven billing sync | Stripe events (`invoice.paid`, `customer.subscription.updated`, `invoice.payment_failed`) update internal state | MEDIUM | Integration framework | Stripe webhook endpoint with signature verification (`stripe-signature` header). Idempotent event processing. Critical events: subscription status changes, payment failures, trial ending |

### Differentiators (Competitive Advantage)

Features that make v3.0 stand out vs competitors attempting similar integrations.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Unified PM tool abstraction (Jira + Linear) | Same workflow templates work with either Jira or Linear -- admin picks PM tool, workflow doesn't change. No competitor offers dual PM bidirectional sync in contractor ops | MEDIUM | Shared interface: `createIssue()`, `syncStatus()`, `getIssueLink()`. Linear adapter mirrors Jira adapter. Workflow engine calls abstraction, not provider directly |
| Equipment lifecycle tied to contractor lifecycle | Onboarding auto-ships laptop, offboarding auto-triggers return. Equipment tracking is integrated, not a separate spreadsheet. No contractor ops tool does this | HIGH | Equipment status changes trigger workflow events. Contractor status change (e.g., "offboarding") auto-creates return shipment task |
| Intelligent onboarding from connected tools | Instead of manual data entry, connect your Jira + Google Workspace + Slack and the platform bootstraps itself. Import users, projects, statuses in minutes. Massive time-to-value improvement | MEDIUM | Multi-source import with dedup. Each source contributes different data: Google = users + structure, Jira/Linear = projects + statuses, Slack = channels for notifications |
| Multi-channel approval (Slack + Teams) | Approve invoices from whichever messaging tool the org uses. Same approval flow, two delivery channels. Most tools pick one | MEDIUM | Shared approval action handler. Notification routing decides Slack vs Teams per org. Same approval mutation regardless of source |
| Credit-based AI billing | OCR usage metered per page, included credits per plan, transparent overage pricing. Aligns cost with value -- light users pay less. Builds on Stripe's 2026 meter infrastructure | MEDIUM | Stripe Meter + Billing Credits. Report usage on each OCR call. Credits refresh monthly per plan tier |
| Polish courier ecosystem (InPost + DPD) | InPost Parcel Lockers are the default shipping method in Poland. Having native InPost integration with locker selection is a huge UX win for Polish companies. No B2B contractor tool supports this | HIGH | InPost ShipX API for locker selection + shipment creation. Parcel Locker picker component (search by address, show on map via InPost Geowidget) |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full asset management system | "Track all company assets, not just contractor equipment" | Massive scope -- inventory management, depreciation, procurement. Asset management tools (Snipe-IT, AssetTiger) exist. Contractor Ops tracks equipment tied to contractor lifecycle only | Track equipment assigned to contractors. For full asset management, integrate with dedicated tools |
| Teams bot as full messaging layer | "Let contractors chat with managers through Teams" | Building a chat relay between Teams and the platform is enormous scope. Message threading, history, presence, file sharing -- this is Teams' job | Use Teams for notifications + approvals only. Link to contractor profile/invoice for context. Don't relay messages |
| Build own subscription/billing system | "Stripe takes 2.9%. We can save money with direct bank integration" | Payment processing compliance (PCI-DSS), invoice generation, tax handling, dunning, card retry logic -- Stripe handles all of this. Building it is 6+ months of work with ongoing maintenance | Use Stripe. The 2.9% fee is trivial at current scale. Revisit at 500+ customers if fee becomes material |
| SCIM provisioning from Google Workspace | "Auto-provision users when they're added to Google Workspace" | SCIM is a full identity lifecycle protocol (create, update, deactivate, delete). Requires SCIM server implementation, continuous sync, conflict resolution. Enterprise feature that very few customers at 10-200 employees need | Directory import (one-time + scheduled sync) covers 95% of the need. Full SCIM is v4+ if demand materializes |
| Multi-carrier rate comparison | "Show shipping rates from InPost vs DPD vs UPS and let user pick cheapest" | Requires real-time rate API calls to all carriers, address validation, weight/dimension input. This is a shipping platform feature (e.g., Shippo, EasyPost) | Default to org's preferred carrier. Manual carrier selection when creating shipment. Don't build a rate engine |
| Linear/Jira time tracking import merged | "Pull time from both Linear and Jira into one view" | Linear has no native time tracking -- it's an issue tracker. Time tracking in Linear requires third-party integrations (Clockify, Toggl). Importing from two PM tools simultaneously creates messy data | Import time from Clockify (works with both Linear and Jira). PM tool provides issues, time tracking tool provides hours |
| Stripe Connect for contractor payments | "Pay contractors directly through Stripe" | Stripe Connect requires KYC for each contractor, adds per-transaction fees, doesn't handle Polish B2B invoice requirements (NIP, KSeF). Bank transfer is the standard B2B payment method in Poland | Keep existing payment run + bank file export flow. Stripe handles platform billing (SaaS subscription), not contractor payments |

## Feature Dependencies

```
[Linear Integration]
    |-- requires --> [Integration framework (existing)]
    |-- requires --> [LinearAdapter extending BaseAdapter]
    |
    +-- [Linear OAuth Connect] -- uses --> [OAuth credential store (existing)]
    +-- [Create Linear Issue] -- enhances --> [Workflow engine]
    +-- [Bidirectional Status Sync] -- uses --> [Webhook pipeline (existing)]
    +-- [Status Mapping Config] -- similar to --> [Jira status mapping (existing)]

[Teams Integration]
    |-- requires --> [Integration framework (existing)]
    |-- requires --> [Azure AD app registration + Bot Service]
    |-- requires --> [TeamsAdapter extending BaseAdapter]
    |
    +-- [Approve/Reject in Teams] -- mirrors --> [Slack approve/reject (existing)]
    +-- [Activity Alerts] -- uses --> [Notification system (existing)]
    +-- [Proactive Messaging] -- requires --> [ConversationReference storage]

[Google Workspace Directory]
    |-- requires --> [Integration framework (existing)]
    |-- extends --> [Google Calendar OAuth (existing) with additional scopes]
    |
    +-- [User Import] -- enhances --> [User management (existing)]
    +-- [Group-Role Mapping] -- enhances --> [RBAC (existing)]
    +-- [Periodic Sync] -- requires --> [QStash cron (existing infra)]

[Intelligent Onboarding]
    |-- requires --> [At least one connected integration]
    |-- enhances --> [Onboarding wizard (existing 5-step)]
    |
    +-- [Import from Jira] -- requires --> [Jira integration (existing v2.0)]
    +-- [Import from Linear] -- requires --> [Linear integration (v3.0)]
    +-- [Import from Google] -- requires --> [Google Workspace (v3.0)]
    +-- [Import from Slack] -- requires --> [Slack integration (existing v1.0)]
    +-- [Data Preview + Dedup] -- independent (UI component)

[Equipment/Shipment Tracking]
    |-- requires --> [New equipment + shipment data models]
    |-- independent of other v3.0 features
    |
    +-- [Equipment Registry] -- enhances --> [Contractor profiles (existing)]
    +-- [Manual Shipment Entry] -- standalone (no API required)
    +-- [InPost Integration] -- requires --> [InPost ShipX API adapter]
    +-- [DPD Integration] -- requires --> [DPD WebAPI adapter]
    +-- [UPS Integration] -- requires --> [UPS REST API adapter]
    +-- [Workflow Integration] -- enhances --> [Workflow engine (existing)]
    +-- [Portal Equipment View] -- enhances --> [Contractor portal (existing)]
    +-- [Return Flow] -- requires --> [Equipment registry + courier API]

[Stripe Paywall]
    |-- independent of other v3.0 features (can be built first or last)
    |-- gates all other features via plan tiers
    |
    +-- [Subscription Management] -- new domain
    +-- [AI Credit Metering] -- hooks into --> [OCR service (existing)]
    +-- [Feature Gating] -- wraps --> [All feature modules]
    +-- [Billing Portal] -- uses --> [Stripe Customer Portal (hosted)]
    +-- [Webhook Sync] -- uses --> [Webhook pipeline (existing)]

[Stripe Paywall] ──gates──> [All features based on plan tier]
[Equipment Tracking] ──enhances──> [Workflow engine] (onboarding/offboarding steps)
[Intelligent Onboarding] ──requires──> [Linear, Google Workspace, or existing integrations]
[Linear Integration] ──conflicts with──> nothing (additive)
[Teams Integration] ──parallel to──> [Slack Integration] (orgs use one or the other)
```

### Dependency Notes

- **Linear Integration is a straightforward clone of Jira pattern:** Same adapter interface, same webhook pipeline, same workflow engine hooks. Primary difference is GraphQL vs REST and Linear's per-team status model.
- **Teams Integration is significantly harder than Slack:** Slack uses simple webhook + interactivity endpoint. Teams requires Azure Bot Service registration, Teams app manifest, proactive messaging with stored conversation references, and Adaptive Cards instead of Block Kit. Estimate 2-3x the effort of Slack.
- **Google Workspace extends existing Google OAuth:** The Google Calendar adapter already handles OAuth. Directory API just needs additional scopes. Can share the same OAuth connection with expanded permissions.
- **Intelligent Onboarding depends on connected integrations:** Cannot build the import wizard until at least the source integrations exist. Jira + Slack already exist from v2.0/v1.0. Linear + Google Workspace are new in v3.0.
- **Equipment Tracking is fully independent:** New domain with no dependencies on other v3.0 features. Can be built in parallel. Only dependency is on existing contractor registry and workflow engine.
- **Stripe Paywall should be built early but activated late:** Build subscription infrastructure early (it gates everything), but don't enforce paywall until other v3.0 features are ready. Feature gating middleware should be the last piece.

## MVP Definition

### Phase 1: Build First (Infrastructure + Independent Features)

- [ ] **Stripe subscription management** -- Foundation for monetization. Build Products/Prices in Stripe, subscription lifecycle, webhook sync. Don't enforce yet, but track
- [ ] **Linear integration (OAuth + issue create + status sync)** -- Direct clone of Jira pattern. Low risk, reuses integration framework. Adds value to dev-heavy orgs using Linear instead of Jira
- [ ] **Equipment registry + manual shipment tracking** -- New data model, CRUD, contractor profile tab. No courier API dependency -- manual tracking number entry works immediately
- [ ] **Teams bot registration + basic notifications** -- Azure app setup, bot manifest, simple notification cards. Establish the connection before adding approve/reject complexity

### Phase 2: Add After Foundation

- [ ] **Teams approve/reject with Adaptive Cards** -- Complex: Action.Execute buttons, user-specific views, proactive messaging. Needs Teams bot foundation from Phase 1
- [ ] **Google Workspace directory import** -- Extend Google OAuth with Admin SDK scopes, build import wizard UI, role mapping
- [ ] **InPost ShipX API integration** -- Most important courier for Poland. Parcel Locker selection, shipment creation, status tracking
- [ ] **AI/OCR credit metering** -- Stripe Meter integration, usage reporting on each OCR call, credit grants per plan tier
- [ ] **Feature gating by plan** -- Middleware to check subscription tier on feature access

### Phase 3: Connect and Polish

- [ ] **Intelligent onboarding wizard** -- Multi-source import from connected tools. Depends on Linear + Google Workspace being ready
- [ ] **DPD + UPS courier integrations** -- Additional carriers beyond InPost. Lower priority for Polish market
- [ ] **Equipment workflow integration** -- Auto-ship on onboarding, auto-return on offboarding
- [ ] **Equipment return flow via portal** -- Contractor initiates return, gets shipping label
- [ ] **Periodic Google Workspace sync** -- Scheduled directory sync for ongoing user management
- [ ] **Free trial flow** -- Trial period, trial-ending notifications, upgrade prompts
- [ ] **Billing portal + usage dashboard** -- Stripe Customer Portal redirect, internal usage stats display

### Defer (v4+)

- [ ] **SCIM provisioning** -- Full identity lifecycle protocol. Overkill at current scale
- [ ] **Multi-carrier rate comparison** -- Shipping platform territory, not contractor ops
- [ ] **Stripe Connect for contractor payments** -- Polish B2B uses bank transfers, not Stripe payouts
- [ ] **Teams as full messaging layer** -- Notifications and approvals only, not chat relay

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Urgency |
|---------|------------|---------------------|----------|---------|
| Stripe subscriptions + billing | HIGH | HIGH | P1 | CRITICAL -- needed for revenue |
| Linear bidirectional sync | MEDIUM | MEDIUM | P1 | High -- dev orgs using Linear have no option today |
| Teams approve/reject | HIGH | HIGH | P1 | High -- Teams-first orgs can't use the platform without it |
| Equipment registry + manual tracking | MEDIUM | MEDIUM | P1 | High -- physical equipment tracking is unserved |
| AI/OCR credit metering | HIGH | MEDIUM | P1 | High -- usage-based billing for AI features |
| Feature gating by plan | HIGH | MEDIUM | P1 | High -- enforces monetization |
| Google Workspace directory import | MEDIUM | MEDIUM | P2 | Medium -- speeds up onboarding but not blocking |
| InPost ShipX integration | MEDIUM | HIGH | P2 | Medium -- manual tracking works as fallback |
| Intelligent onboarding wizard | MEDIUM | MEDIUM | P2 | Medium -- nice to have, not blocking |
| Teams notifications/reminders | MEDIUM | MEDIUM | P2 | Medium -- basic cards before approve/reject |
| Free trial flow | HIGH | LOW | P2 | Medium -- needed for go-to-market |
| DPD API integration | LOW | HIGH | P3 | Low -- InPost covers most Polish shipments |
| UPS API integration | LOW | HIGH | P3 | Low -- international only |
| Equipment return via portal | LOW | MEDIUM | P3 | Low -- manual process works initially |
| Periodic Google sync | LOW | MEDIUM | P3 | Low -- one-time import covers initial need |
| Billing portal + usage dashboard | LOW | LOW | P3 | Low -- Stripe portal handles essentials |

**Priority key:**
- P1: Must have for v3.0 launch -- revenue generation + core enterprise features
- P2: Should have, add in later v3.0 phases
- P3: Nice to have, can ship v3.0 without these

## Competitor Feature Analysis

| Feature | Deel | Rippling | Manual (Excel+Email) | Contractor Ops v3.0 |
|---------|------|----------|----------------------|----------------------|
| Linear integration | No | No | N/A | Bidirectional sync with workflow automation |
| Teams approve/reject | No (Slack only) | Yes (basic) | Email threads | Full Adaptive Card approval with user-specific views |
| Google Workspace import | No (own identity) | Yes (native) | Manual user creation | Directory import + group-to-role mapping |
| Intelligent onboarding | Basic wizard | Yes (connected tools) | N/A | Multi-source import from PM + directory + messaging tools |
| Equipment tracking | Basic asset list | Yes (full IT asset mgmt) | Spreadsheet | Equipment lifecycle tied to contractor onboarding/offboarding |
| Courier API tracking | No | No | Manual tracking | InPost + DPD + UPS with auto-status updates |
| Subscription billing | N/A (usage-based) | N/A (enterprise) | N/A | Stripe subscriptions + AI credit metering |
| Multi-channel approvals | Slack only | Email + Slack | Email | Slack + Teams (same flow, two channels) |

**Key takeaway:** Rippling is the closest competitor for enterprise features (directory import, asset management), but they're an HR platform at enterprise pricing ($8+/user/mo). Contractor Ops targets the 10-200 employee sweet spot with Poland-specific courier integrations (InPost) and competitive pricing. No competitor combines PM bidirectional sync + equipment tracking + Polish courier APIs.

## Complexity Estimates (for Roadmap Planning)

| Module | Estimated Effort | Risk Level | Notes |
|--------|-----------------|------------|-------|
| Linear integration | 1-2 weeks | LOW | Direct clone of Jira adapter pattern. GraphQL instead of REST, but same webhook pipeline and workflow hooks |
| Teams integration | 3-4 weeks | HIGH | Azure Bot Service setup, Adaptive Cards, proactive messaging, Teams app manifest. Much more complex than Slack. Azure AD admin consent flow is the biggest risk |
| Google Workspace import | 2 weeks | MEDIUM | Extends existing Google OAuth. Admin SDK Directory API is well-documented. Import wizard UI is the main effort |
| Intelligent onboarding | 2-3 weeks | MEDIUM | Multi-source import logic, dedup, preview UI. Depends on connected integrations existing first |
| Equipment registry + manual tracking | 2 weeks | LOW | Standard CRUD, new data model. No external API dependency for manual tracking |
| InPost ShipX integration | 2-3 weeks | MEDIUM | OAuth 2.0, shipment creation, Parcel Locker selection. Sandbox available. Well-documented for Polish market |
| DPD API integration | 2 weeks | MEDIUM | Less documented than InPost. May need partner onboarding process |
| UPS API integration | 2 weeks | MEDIUM | Well-documented REST API. Developer account approval may take time |
| Stripe subscriptions | 2-3 weeks | MEDIUM | Products/Prices setup, subscription lifecycle, webhook handling. Well-documented but many edge cases (proration, dunning, trial expiry) |
| AI credit metering | 1-2 weeks | MEDIUM | New Stripe Meter API (2025+). Create meter, report events, billing credits. Newer API -- less community knowledge |
| Feature gating | 1 week | LOW | Middleware/guard checking org's plan tier. Configuration-driven |
| Free trial + billing portal | 1 week | LOW | Stripe handles most of this. Trial config on subscription, portal is a redirect |

## Sources

- [Linear Developers - Webhooks](https://linear.app/developers/webhooks) -- webhook events, payload format, HMAC-SHA256 verification
- [Linear Developers - GraphQL API](https://linear.app/developers/graphql) -- query/mutation reference for issue operations
- [Linear Changelog](https://linear.app/changelog/page/2) -- refresh token migration deadline April 2026
- [Microsoft Teams - Universal Actions for Adaptive Cards](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/universal-actions-for-adaptive-cards/overview) -- Action.Execute pattern
- [Microsoft Teams - Bot Request Approval Sample](https://learn.microsoft.com/en-us/samples/officedev/microsoft-teams-samples/officedev-microsoft-teams-samples-bot-request-approval-nodejs/) -- Node.js approval bot sample
- [Microsoft Teams - Proactive Messages](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/send-proactive-messages) -- ConversationReference pattern
- [Google Admin SDK Directory API](https://developers.google.com/workspace/admin/directory/v1/guides) -- user/group management
- [Google Directory API - Manage Users](https://developers.google.com/workspace/admin/directory/v1/guides/manage-users) -- user listing/creation
- [InPost ShipX API Documentation](https://dokumentacja-inpost.atlassian.net/wiki/spaces/PL/pages/622754/API+ShipX) -- official API docs
- [InPost Integration](https://inpost.pl/en/integration) -- integration overview + sandbox
- [Stripe Usage-Based Billing](https://docs.stripe.com/billing/subscriptions/usage-based) -- Meter API, metered pricing
- [Stripe Billing Credits](https://docs.stripe.com/billing/subscriptions/usage-based/billing-credits) -- credit grants for plan allowances
- [Stripe Subscriptions - Free Trials](https://docs.stripe.com/billing/subscriptions/trials/free-trials) -- trial period configuration
- [Stripe Metered Billing Guide (2026)](https://www.buildmvpfast.com/blog/stripe-metered-billing-implementation-guide-saas-2026) -- implementation patterns for new Meter API
- [Stripe Build Usage-Based Billing for AI](https://docs.stripe.com/get-started/use-cases/usage-based-billing) -- AI startup billing use case

---
*Feature research for: Contractor Ops v3.0 Enterprise & Monetization*
*Researched: 2026-04-01*
