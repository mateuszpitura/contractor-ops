# Pitfalls Research

**Domain:** v3.0 Enterprise & Monetization -- Linear, Teams, Google Workspace, intelligent onboarding, equipment/shipment tracking, Stripe billing for multi-tenant contractor operations SaaS
**Researched:** 2026-04-01
**Confidence:** HIGH (existing codebase patterns well-understood, API behaviors verified against official docs and community sources)

## Critical Pitfalls

### Pitfall 1: Linear Sync Loop Not Covered by Existing Jira Loop Prevention Constants

**What goes wrong:**
The existing Jira bidirectional sync uses a 30-second `LOOP_PREVENTION_WINDOW_MS` with sync source tracking on `ExternalLink` records and a 5-second `DEDUP_WINDOW_MS` for rapid-fire webhooks. Linear's webhook delivery is significantly faster than Jira's (sub-second vs. 2-5 seconds), so the 30-second suppression window causes legitimate external changes to be dropped. Additionally, Linear uses a GraphQL API (not REST) and returns the updated object inline from mutations, which changes the bounce-back timing characteristics.

**Why it happens:**
Developers copy the `jira-webhook-handler.ts` structure, reuse the same timing constants, and do not account for Linear's faster webhook pipeline. The existing pattern works for Jira because Jira webhooks are slow enough that a 30-second window safely catches bounce-backs without dropping real changes. Linear is too fast for this approach.

**How to avoid:**
- Use per-mutation correlation IDs stored in Redis (Upstash) with a 10-second TTL instead of a fixed time window. When the app pushes a status change to Linear via GraphQL mutation, store `linear:{issueId}:{newStatusId}` in Redis. When the webhook arrives, check for and consume that key. If present, skip processing.
- Keep the existing `IntegrationSyncLog` pattern but add a `correlationId` column.
- Do NOT change the Jira handler's constants -- each provider needs its own loop prevention tuning.
- Linear rate limit is 500 requests per hour per OAuth app user (vs. Jira's points-based system). Budget for bounce-back mutations eating into this quota during initial implementation.

**Warning signs:**
- Status flickers in the UI (task toggles between two states rapidly)
- `IntegrationSyncLog` shows pairs of APP/EXTERNAL entries within seconds
- Linear API rate limit (500 req/hr) hit unexpectedly from bounce-back mutations
- `LOOP_PREVENTION_WINDOW_MS` constant copy-pasted from Jira handler

**Phase to address:**
Linear integration phase (first integration phase of v3.0)

---

### Pitfall 2: Teams Bot Requires Azure Bot Service -- Cannot Replicate Slack's Pure Webhook Pattern

**What goes wrong:**
Unlike Slack (which uses simple webhook URLs, slash commands, and OAuth), Microsoft Teams requires an Azure Bot Service registration with Bot Framework protocol compliance. The bot messaging endpoint must validate JWT tokens from the Bot Framework Service. Developers assume they can replicate the existing Slack adapter pattern (OAuth + webhook URL + `Action.Submit` handler) and discover the bot never receives messages or the Adaptive Card buttons return "Something went wrong."

**Why it happens:**
The existing `BaseAdapter` interface assumes integrations follow OAuth + webhooks. Teams bots need: (1) Azure AD app registration, (2) Azure Bot resource (free F0 tier exists), (3) a `/api/messages` endpoint that validates Bot Framework JWT tokens (not simple webhook signature verification), and (4) `conversationReference` storage for proactive messaging. This is architecturally different from Slack and does not fit cleanly into `supportsOAuth: true, supportsWebhooks: true`.

**How to avoid:**
- Accept the Azure Bot Service dependency upfront. The free tier (F0) costs nothing for standard channels including Teams. Budget time for Azure portal setup before writing any adapter code.
- The messaging endpoint CAN be hosted on Vercel -- it is just an HTTPS POST to `/api/messages`. But it must validate Bot Framework JWT tokens using `botframework-connector` library or manual JWKS verification against `login.botframework.com`.
- Extend the `BaseAdapter` with a `supportsMessaging` capability flag to distinguish webhook-based integrations from bot-framework-based ones.
- Store `conversationReference` objects per user per org in the database. These are required for proactive messaging (sending approval requests without the user initiating first).
- Handle Adaptive Card `Action.Execute` (not the older `Action.Submit`) responses within the 5-second Teams timeout. Return an updated card immediately with "Processing..." status, then process the approval via QStash, then update the card again via `context.updateActivity()`.
- Separate Azure Bot registrations per environment (dev, staging, production). Shared registrations cause staging messages to appear in production Teams channels.

**Warning signs:**
- "Something went wrong. Please try again" error on Adaptive Card button press (response timeout exceeded)
- Bot appears online in Teams but never receives messages (JWT validation missing or incorrect)
- Proactive messages fail silently (missing or stale `conversationReference`)
- Using `Action.Submit` instead of `Action.Execute` (missing Universal Actions support for user-specific views)

**Phase to address:**
Teams integration phase -- Azure setup must happen before writing adapter code

---

### Pitfall 3: Stripe Webhook Race Conditions in Serverless Environment

**What goes wrong:**
Stripe sends multiple webhook events for a single subscription lifecycle change (`customer.subscription.updated`, `invoice.payment_succeeded`, `invoice.finalized` all fire within milliseconds of each other). On Vercel, each webhook invocation is a separate serverless function instance with no shared memory. Without database-level idempotency, the same event gets processed multiple times (Stripe retries on non-2xx), or concurrent handlers create duplicate records or inconsistent subscription state. The existing QStash async pattern (used for OCR, calendar sync, etc.) is dangerous for financial state mutations without idempotency guards.

**Why it happens:**
Developers test with a single event type at a time locally (using Stripe CLI forwarding). They never simulate the burst of 3-5 events that Stripe sends for a real subscription creation or plan change. The existing QStash fire-and-forget pattern works for non-financial operations but lacks the idempotency guarantees billing requires.

**How to avoid:**
- Create a `StripeEventLog` table with a unique constraint on `eventId`. Check-and-insert atomically before processing any event. Return 200 to Stripe immediately after storing, then process.
- Use `event.id` as the idempotency key, NOT `event.type` or a combination.
- Process billing-critical webhooks (`invoice.payment_succeeded`, `customer.subscription.deleted`, `customer.subscription.updated`) synchronously in the webhook handler within Stripe's 20-second timeout. Only offload non-critical events (usage reporting, analytics) to QStash.
- Map `stripe_customer_id` to `organizationId` in a dedicated `StripeCustomer` lookup table. Never rely on Stripe metadata alone -- metadata can be lost on plan migrations.
- Use Stripe Test Clocks to simulate full subscription lifecycles (create, trial, convert, upgrade, downgrade, cancel, payment failure, retry, recovery) before shipping.
- Set `payment_behavior: 'default_incomplete'` on subscription creation so failed initial payments do not create active subscriptions.

**Warning signs:**
- Organizations temporarily lose access after successful payment (race between `subscription.updated` and access check)
- Duplicate subscription records in your database for the same org
- `customer.subscription.updated` processed before `checkout.session.completed` (out-of-order events)
- No `StripeEventLog` table or idempotency check in webhook handler

**Phase to address:**
Stripe paywall phase -- must be the most rigorously tested phase in v3.0

---

### Pitfall 4: Google Workspace Directory Import Exceeds Vercel Function Timeout

**What goes wrong:**
Google Workspace Admin SDK Directory API returns paginated results (default 100 users per page, max 500). For organizations with 200+ users, the import requires multiple paginated API calls plus data transformation and database upserts. On Vercel, serverless functions timeout at 60 seconds (Pro plan with Fluid Compute, up to 800 seconds on Pro but only with explicit configuration). A naive implementation that fetches all pages, transforms, and upserts in a single function invocation times out for mid-size organizations.

**Why it happens:**
Developers test with small directories (5-10 users), the import works fine. In production, a customer connects their Google Workspace with 300 users and the function dies mid-import, leaving partial data and a confused admin.

**How to avoid:**
- Use QStash to orchestrate paginated imports: first function fetches page 1 and enqueues page 2 via QStash callback URL, each page handler processes its batch and chains to the next.
- Store import progress in an `ImportJob` table with `status` (pending/in_progress/completed/failed), `processedCount`, `totalCount`, and `nextPageToken`.
- Show import progress in the UI (poll the `ImportJob` record via tRPC query with short refetch interval).
- Handle Google's rate limits (Directory API: 2400 queries per minute per customer, 600 per minute per user) with exponential backoff.
- Implement rollback/resume: if the import fails mid-way, mark the job as failed and allow retry. Use `(organizationId, importSource, externalId)` unique constraint to make re-imports idempotent.
- For OAuth scopes, use `https://www.googleapis.com/auth/admin.directory.user.readonly` (read-only). Do NOT request write access for an import-only feature.

**Warning signs:**
- Function timeout errors in Vercel logs during directory import
- Partial user lists after import (50 out of 200 users imported)
- Google API 429 errors in production but not in development (different org sizes)
- No progress indicator in the import UI

**Phase to address:**
Google Workspace integration phase or intelligent onboarding phase

---

### Pitfall 5: Courier API Inconsistency Creates a Leaky "Unified Tracking" Abstraction

**What goes wrong:**
InPost (ShipX API via OAuth 2.0), DPD (API key auth), and UPS (OAuth 2.0 client credentials) each have fundamentally different tracking status taxonomies, authentication methods, webhook support levels, and delivery concepts. Building a unified tracking abstraction that maps all three to a single status enum (`shipped | in_transit | delivered`) loses critical provider-specific information. InPost has parcel lockers with pickup codes. DPD has depot-based routing with "AVIZO" notifications. UPS has international customs clearance states. A lowest-common-denominator enum misrepresents the actual shipment state.

**Why it happens:**
The existing provider adapter pattern encourages thinking about integrations as interchangeable behind an interface. For project management tools (Jira, Linear) this works because they share similar concepts (issues, statuses, projects). Courier APIs do not share similar concepts -- InPost pickup codes, DPD depot IDs, and UPS customs data are provider-specific and operationally important.

**How to avoid:**
- Define a base `ShipmentStatus` enum for common states (`created`, `label_generated`, `in_transit`, `out_for_delivery`, `delivered`, `returned`, `exception`) but require each courier adapter to populate a `providerDetails` JSON field with provider-specific data.
- Display provider-specific information in the UI: InPost locker location + pickup code, DPD depot + estimated delivery window, UPS customs clearance status.
- For couriers without reliable webhooks (DPD has limited webhook support), implement a QStash cron job that polls tracking status every 30 minutes for active shipments only. Filter by `status NOT IN ('delivered', 'returned', 'cancelled')`.
- Store raw courier API responses alongside normalized status for debugging and audit trail.
- InPost production URL is `api-shipx-pl.easypack24.net`; sandbox is `sandbox-api-shipx-pl.easypack24.net`. Easy to misconfigure. Use environment variables, never hardcode.
- UPS OAuth tokens expire and must be re-authenticated (client credentials flow has no refresh token, unlike user OAuth flows). Build explicit re-authentication logic, not just token refresh.

**Warning signs:**
- Users complain "tracking shows in transit but I already picked it up from the locker" (InPost pickup state lost in mapping)
- InPost-specific fields (locker ID, pickup code) missing from the tracking UI
- Polling cron job running for thousands of delivered shipments (forgot to filter completed ones)
- UPS tracking silently fails after token expiry (no re-auth logic)

**Phase to address:**
Equipment/shipment tracking phase

---

### Pitfall 6: Intelligent Onboarding Import Wizard Conflates "Import" with "Sync"

**What goes wrong:**
The onboarding import wizard is designed as a one-time import from connected tools (Linear projects/teams, Google Workspace users, Teams channels). But users expect that after importing, the data stays in sync. If the import is truly one-time, users discover their contractor list is stale days later. If you build it as ongoing sync, you have built a much more complex feature than planned, with conflict resolution, deletion handling, and reactivation logic.

**Why it happens:**
The UX of "connect your tool and import your data" implies ongoing connection. Users do not distinguish between "import" (snapshot) and "sync" (continuous). The feature scope creeps from "helpful onboarding" to "full bidirectional directory sync." Stakeholder language reinforces this -- they say "sync" when they mean "import."

**How to avoid:**
- Be explicit in the UI: "Import X users from Google Workspace" with a clear callout: "This is a one-time import. Changes in Google Workspace will not be automatically reflected."
- Offer a "Re-import" button that shows a diff (new users, removed users, changed fields) and lets the admin review before applying. This gives the "sync" feeling without building continuous sync.
- Do NOT build continuous sync for the onboarding wizard. If continuous directory sync is needed later, it is a separate feature with its own roadmap entry.
- Store `importSource`, `externalId`, and `importedAt` on imported records so you can identify which records came from which import run and support re-import diff.
- Unique constraint on `(organizationId, importSource, externalId)` prevents duplicates on re-import.

**Warning signs:**
- PM or stakeholders use the word "sync" when describing the import wizard
- Users file bugs that "imported users don't update when I change them in Google"
- Import wizard scope grows to include conflict resolution UI, deletion propagation, or real-time webhooks
- No clear "last imported at" timestamp visible in the UI

**Phase to address:**
Intelligent onboarding phase -- scope must be locked down during planning

---

### Pitfall 7: Stripe Metered Billing for AI/OCR Credits Loses Usage Events

**What goes wrong:**
AI/OCR credit usage must be reported to Stripe via `stripe.subscriptionItems.createUsageRecord()`. In a serverless environment, if the OCR processing function crashes after consuming Claude API credits but before reporting usage to Stripe, the usage is lost and the customer gets free AI processing. At scale with 100+ orgs using OCR regularly, this leaks meaningful revenue.

**Why it happens:**
The natural flow is: (1) receive OCR request, (2) call Claude Vision API, (3) return results, (4) report usage to Stripe. If step 3 succeeds but step 4 fails (function timeout, Stripe API error, cold start issue), usage goes unreported. The existing fire-and-forget pattern for integrations (`void + .catch()`) is designed for non-financial operations and silently drops failures.

**How to avoid:**
- Two-phase approach: record usage intent in your database first (an `AiUsageLog` row with `stripeReported: false`), then call Claude Vision API, then report to Stripe via a separate QStash job that retries until Stripe confirms. The QStash job reads unreported usage from `AiUsageLog` and reports them in batch.
- Always use `action: 'increment'` for usage records, never `action: 'set'`. In a concurrent environment, `set` causes races where one function's set overwrites another's.
- Implement a daily reconciliation cron job that compares internal `AiUsageLog` counts against Stripe's usage summary endpoint. Alert on discrepancies.
- Batch usage record reporting: accumulate in Redis counter, flush to Stripe every 5 minutes via QStash scheduled job. This avoids hitting Stripe's rate limits (100 concurrent API requests per key) during usage spikes.
- Use Stripe Test Clocks to verify metered billing produces correct invoices at period end.

**Warning signs:**
- Internal usage counts diverge from Stripe usage records over time
- Some organizations consistently under-billed relative to their AI feature usage
- Usage reporting QStash jobs in the dead letter queue
- No `AiUsageLog` table or equivalent internal usage tracking

**Phase to address:**
Stripe paywall phase -- specifically the metered billing sub-feature

---

### Pitfall 8: Equipment Tracking Not Tied to Contractor Offboarding Lifecycle

**What goes wrong:**
Equipment is assigned to contractors (laptops, monitors, access cards, etc.) but the offboarding workflow does not check for outstanding equipment. A contractor is offboarded, their access is revoked, but no one notices the laptop was never returned. The equipment tracking module and the contractor lifecycle module operate independently, creating an operational gap that defeats the purpose of having both in the same platform.

**Why it happens:**
Equipment tracking and contractor lifecycle are built in different phases, potentially by different implementation passes. The offboarding workflow (from v1.0) was built without equipment awareness. Adding equipment tracking later does not automatically integrate with the existing offboarding flow.

**How to avoid:**
- Add an "Equipment Check" step to the offboarding workflow template that blocks offboarding completion until all assigned equipment is marked as returned, in-transit (shipment created), or written off.
- When a contractor's status changes to `offboarding` or `inactive`, automatically generate a return shipment request (or at minimum, a task) for each assigned equipment item.
- Show equipment summary on the contractor profile page (existing 8-tab layout) so admins always see assigned equipment in context.
- Create a "pending returns" dashboard widget showing contractors with outstanding equipment past their offboarding date.

**Warning signs:**
- Equipment module has no foreign key or reference to contractor offboarding status
- Offboarding workflow template has no equipment-related steps
- No automated notification when equipment is overdue for return
- Equipment page and contractor page are completely disconnected in the UI

**Phase to address:**
Equipment/shipment tracking phase -- must integrate with existing workflow engine

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Reusing Jira webhook handler constants for Linear | Faster initial development | Linear's faster webhooks cause sync loops or dropped legitimate changes | Never -- each provider needs its own loop prevention tuning |
| Single Azure Bot registration for all environments | One-time setup | Staging messages appear in production Teams channels; cannot test safely | Never -- separate registrations per environment |
| Hardcoding Stripe price IDs as constants | Quick implementation | Cannot change plans without code deploy; breaks staging/prod parity | Only if using Stripe's product/price lookup keys instead of raw IDs |
| Embedding Stripe customer creation in org signup flow | Simpler code | Signup fails if Stripe is down; unnecessary customers for non-paying orgs | Never -- create Stripe customer lazily on first billing interaction |
| Polling all courier shipments on fixed interval | Simple cron job | Wastes API quota on delivered shipments; scales linearly with shipment count | MVP only -- filter active shipments before production |
| Processing Stripe webhooks via QStash (async) | Consistent with existing async pattern | Race conditions between subscription state updates; potential double-processing | Never for billing-critical events -- process synchronously within 20s timeout |
| Storing conversationReference in-memory for Teams bot | Works in development | Lost on serverless cold start; proactive messaging breaks | Never in serverless -- always persist to database |
| Skipping usage reconciliation for metered billing | Faster to ship | Revenue leakage goes undetected until manual audit | Never -- reconciliation is a launch requirement |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Linear | Using unofficial REST API | Use official GraphQL API via `@linear/sdk` npm package -- REST is undocumented and unsupported |
| Linear | Ignoring `webhookTimestamp` replay protection | Verify webhook timestamp is within 60 seconds of current time (Linear's official recommendation) |
| Linear | Not handling `archived` issue state | Linear treats `archived` as distinct from any status -- map it explicitly in your task lifecycle |
| Linear | Assuming issue updates always include all fields | Linear webhooks send partial updates -- only changed fields are included. Merge with existing data, do not overwrite |
| Teams | Returning slow response to Adaptive Card `Action.Execute` | Return 200 with updated card (showing "Processing...") within 5 seconds; process action async; update card again via Bot Framework API |
| Teams | Not storing `conversationReference` for proactive messaging | Persist per-user conversation references in database on first interaction; required for sending approval requests without user initiating |
| Teams | Using `Action.Submit` instead of `Action.Execute` | `Action.Execute` supports Universal Actions (user-specific views, automatic card refresh); `Action.Submit` is legacy and cannot show user-specific views |
| Teams | Expecting Teams webhook to work like Slack webhook | Teams uses Bot Framework protocol (JWT validation, activity types), not simple HTTP webhooks. Completely different architecture |
| Google Workspace | Requesting `admin.directory.user` scope (read-write) for import | Use `admin.directory.user.readonly` -- import needs read access only. Requesting write access raises security red flags for customer IT admins |
| Google Workspace | Not handling suspended/deleted users | Filter by `query: 'isSuspended=false'` or handle explicitly; importing suspended users creates confusion |
| Google Workspace | Ignoring pagination for large directories | Default page size is 100, max 500. Must handle `nextPageToken` for orgs with 500+ users |
| Google Workspace | Not distinguishing users from groups | Directory API lists users and groups separately. Import wizard must clarify which entities are being imported |
| InPost | Using sandbox URL in production | Production: `api-shipx-pl.easypack24.net`; Sandbox: `sandbox-api-shipx-pl.easypack24.net`. Environment variable, never hardcode |
| InPost | Ignoring parcel locker pickup codes | Pickup code is essential for contractor to retrieve equipment from locker. Must be prominently displayed and included in notifications |
| DPD | Expecting webhook-driven tracking | DPD webhook support is limited and inconsistent. Plan for polling as primary tracking mechanism |
| UPS | Not re-authenticating after token expiry | UPS client credentials OAuth has no refresh token. Must re-authenticate (new `POST /security/v1/oauth/token`) when access token expires |
| UPS | Ignoring country-specific tracking response formats | UPS tracking responses vary by origin/destination country. Parse defensively |
| Stripe | Using `checkout.session.completed` as sole activation trigger | Also handle `customer.subscription.updated` for plan changes and `invoice.payment_succeeded` for renewals |
| Stripe | Not handling out-of-order webhook events | `customer.subscription.updated` may arrive before `checkout.session.completed`. Design state machine that handles any event order |
| Stripe | Using `action: 'set'` for metered billing usage | In concurrent serverless environment, `set` causes races. Always use `action: 'increment'` |
| Stripe | Hardcoding price IDs | Use `lookup_key` on prices instead. Allows changing prices in Stripe Dashboard without code deploy |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Polling all courier shipments on single cron interval | Cron job duration grows, API rate limits hit | Filter: `WHERE status NOT IN ('delivered', 'returned', 'cancelled')`. Increase poll interval for shipments older than 7 days | 500+ active shipments |
| Loading all Linear/Jira issues for status mapping on each webhook | Webhook processing time grows linearly with linked issues | Index `ExternalLink` by `(providerSlug, externalId)` as covering index; single lookup per webhook | 1000+ linked issues across all orgs |
| Stripe usage record reporting on every AI request | Stripe API rate limit (100 concurrent), function duration | Batch: accumulate in Redis counter per org, flush to Stripe every 5 minutes via scheduled QStash job | 50+ concurrent AI/OCR requests |
| Google Workspace import fetching full user profile per user | API quota consumed rapidly, import takes minutes | Use `fields` parameter: `fields=users(primaryEmail,name,suspended,orgUnitPath),nextPageToken`. Reduces payload 10x | 200+ users in directory |
| Teams bot fetching user profile from Graph API on every message | Graph API rate limits per tenant (10,000 requests per 10 minutes) | Cache Teams user info in database with 24-hour TTL | 100+ active Teams users per org |
| Stripe subscription status check on every page load | Unnecessary API calls, latency on every page | Cache subscription status in database, update via webhooks only. Add `subscriptionStatus` column to `Organization` table | Any scale -- this is always wrong |
| Re-importing full Google directory on every "refresh" click | API quota exhaustion, slow operation, UI feels broken | Use re-import diff: fetch current directory, compare with stored records, show changes for review | Second import of 100+ user directory |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing Stripe API keys in the integration credential store | Billing credentials compromised if any integration credential leaks | Store `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as environment variables only. Never in database |
| Not validating Stripe webhook signatures | Attacker can forge subscription events (grant free access, cancel paid accounts) | Always use `stripe.webhooks.constructEvent()` with raw body and webhook secret |
| Exposing courier tracking numbers without access control | Tracking numbers can redirect shipments or intercept packages | Gate tracking details behind RBAC; only show to org members with equipment management permission |
| Teams bot accepting commands without org membership verification | Any Teams user who discovers the bot can trigger approvals or view data | Verify `teamsUserId` maps to a known `User` in a connected org before processing any command |
| Google Workspace admin scope persisting indefinitely after import | Unnecessary long-lived access to customer's entire user directory | Revoke offline access token after import completes; or use minimal scope that expires |
| Linear webhook secret shared across organizations | One compromised secret affects all orgs' Linear webhooks | Use per-organization webhook secrets (Linear supports per-webhook secrets). Store encrypted per existing credential pattern |
| Azure Bot credentials (App ID + Password) committed to repo | Full control of the Teams bot, ability to impersonate it | Store in environment variables (`MICROSOFT_APP_ID`, `MICROSOFT_APP_PASSWORD`). Add to `.env.example` without values |
| Stripe customer portal URL accessible without auth | Anyone with the URL can manage another org's subscription | Generate portal sessions server-side with authenticated user, verify org membership |
| Equipment assignment allowing cross-org equipment references | Equipment from Org A assigned to contractor in Org B | Enforce `organizationId` scope on all equipment queries, same as existing multi-tenant pattern |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Import wizard shows spinner with no progress for large imports | Admin thinks app is broken, refreshes, starts duplicate import | Show progress bar: "Importing 45 of 230 users..." with cancel button. Make imports idempotent so refresh is safe |
| Courier tracking shows raw API status codes | Admin sees "AVIZO" (InPost) or "M" (DPD) instead of human-readable text | Map every courier status to localized human-readable Polish + English string |
| Stripe paywall blocks features with generic "Upgrade required" | Admin does not know which plan unlocks which feature, gets frustrated | Show specific feature name, which plan unlocks it, current plan, and one-click upgrade path |
| Teams approve/reject card does not update after action | Second approver clicks approve without knowing it was already approved | Update Adaptive Card in-place after action: "Approved by [Name] at [Time]" with disabled buttons. Use `Action.Execute` with user-specific views |
| Equipment tracking page separated from contractor profile | Admin navigates away from contractor context to manage equipment | Add equipment summary as a new tab (9th tab) on contractor profile; link to full tracking detail from there |
| Free trial ends with no warning | Customer loses access suddenly, angry support ticket | Send warnings at 7, 3, and 1 day before trial ends. Show persistent banner in app during last 3 days. Grace period of 3 days after expiry |
| Linear integration settings require Linear workspace admin | Non-admin ops user cannot set up the integration themselves | Show clear message about required permissions upfront; offer "Request access" workflow that sends instructions to Linear workspace admin |
| Onboarding wizard imports everything without preview | Admin discovers unwanted data (suspended users, test projects) imported | Always show preview screen with data to import, allow deselecting specific items before confirming |
| Stripe billing page shows no usage breakdown | Admin cannot justify AI/OCR costs to finance team | Show per-feature usage breakdown (OCR scans, AI extractions) with daily/weekly/monthly view |

## "Looks Done But Isn't" Checklist

- [ ] **Linear integration:** Often missing handling for `archived` issues and Linear's partial webhook updates -- verify all issue states map to internal statuses and partial updates merge correctly
- [ ] **Linear integration:** Often missing team/workspace context -- verify webhook processing correctly identifies which org the issue belongs to when multiple orgs connect different Linear workspaces
- [ ] **Teams integration:** Often missing proactive message capability -- verify bot can send approval requests to users who have never interacted with the bot (requires admin consent + stored conversation references)
- [ ] **Teams integration:** Often missing card refresh after approval -- verify Adaptive Card updates in-place for ALL users viewing the card (Universal Actions), not just the actor
- [ ] **Google Workspace import:** Often missing pagination -- verify import works with 500+ user directories, not just 5-user test workspaces
- [ ] **Google Workspace import:** Often missing suspended user filtering -- verify suspended/deleted users are excluded or explicitly handled
- [ ] **Courier tracking (InPost):** Often missing parcel locker pickup code display -- verify pickup code and locker location are prominently shown in tracking detail and notifications
- [ ] **Courier tracking (all):** Often missing timezone handling on tracking timestamps -- verify timestamps from InPost (Europe/Warsaw), DPD (depot timezone), UPS (scan location timezone) display correctly
- [ ] **Stripe paywall:** Often missing grace period after payment failure -- verify 3-day grace period with dunning emails before access revocation
- [ ] **Stripe paywall:** Often missing proration testing -- verify upgrade/downgrade mid-cycle produces correct invoice amounts (use Stripe Test Clocks)
- [ ] **Stripe metered billing:** Often missing usage reconciliation -- verify daily cron job compares internal AI usage counts against Stripe usage records
- [ ] **Stripe paywall:** Often missing free trial to paid conversion edge cases -- verify what happens when trial expires with no payment method, with expired card, with valid card
- [ ] **Equipment tracking:** Often missing return/offboarding integration -- verify equipment flagged as "assigned" triggers a warning when contractor is offboarded
- [ ] **Equipment tracking:** Often missing equipment history -- verify full audit trail of equipment assignments (who had it, when, condition at handover)
- [ ] **Intelligent onboarding:** Often missing duplicate detection during re-import -- verify importing from Google Workspace twice does not create duplicate contractor records
- [ ] **Intelligent onboarding:** Often missing cross-source deduplication -- verify user imported from Google Workspace and separately from Linear are recognized as the same person (by email match)

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Linear sync loop (bouncing statuses) | LOW | Pause Linear webhook processing via feature flag, clear Redis correlation keys, fix timing constants, re-enable. No data loss -- just noise |
| Teams bot not receiving messages | MEDIUM | Verify Azure Bot registration messaging endpoint URL. Redeploy with JWT validation. Re-register bot in Teams app manifest. No data loss |
| Stripe duplicate subscription creation | HIGH | Manual reconciliation in Stripe Dashboard + database. Cancel duplicate subscriptions, issue credits. Add unique constraint on `(organizationId)` in `StripeCustomer` table. Audit all affected orgs |
| Google import timeout with partial data | MEDIUM | Mark failed `ImportJob`, implement "Resume Import" that fetches remaining pages using stored `nextPageToken`. Idempotent upserts prevent duplicates on retry |
| Courier polling running for delivered shipments | LOW | Add `WHERE status NOT IN ('delivered','returned','cancelled')` filter. No data impact, saves API quota and compute cost |
| Stripe usage events lost (AI credits) | HIGH | Run reconciliation comparing `AiUsageLog` against Stripe usage summary. Manually report missing usage via API. Implement pre-reporting pattern to prevent recurrence |
| Onboarding import creates duplicates | MEDIUM | Add unique constraint `(organizationId, importSource, externalId)`. Write migration to merge duplicates by email. Notify affected orgs |
| Equipment not flagged on offboarding | LOW | Backfill: query all offboarded contractors with assigned equipment, create return tasks. Add equipment check step to offboarding workflow template |
| Teams Adaptive Card showing stale approval status | LOW | Re-send updated card via Bot Framework API `context.updateActivity()`. Implement card versioning to detect stale state |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Linear sync loop timing | Linear integration | Integration tests with mocked sub-second webhook delivery; verify Redis correlation ID pattern prevents loops but passes legitimate changes |
| Linear partial webhook updates | Linear integration | Unit tests verifying partial update merge logic; test with webhooks containing only `state` field |
| Teams Azure Bot dependency | Teams integration (pre-coding setup) | Azure Bot registration exists, messaging endpoint responds to health check, before writing adapter code |
| Teams Adaptive Card timeout | Teams integration | Load test `Action.Execute` handler; verify response within 5 seconds; verify async QStash processing completes |
| Teams proactive messaging | Teams integration | End-to-end test: create approval, verify Teams notification sent to correct user without prior bot interaction |
| Google directory import timeout | Google Workspace / Onboarding | Test with mocked 500-user paginated response (3 pages); verify QStash chaining completes; verify progress updates in UI |
| Google import scope security | Google Workspace | Verify OAuth consent screen requests `readonly` scope only; verify token revocation after import |
| Courier status mapping quality | Equipment tracking | Review mapping table against real API responses from all three couriers; verify InPost pickup code preserved |
| Courier polling efficiency | Equipment tracking | Verify cron job query filters completed shipments; load test with 1000 historical shipments (only active ones polled) |
| Equipment offboarding integration | Equipment tracking | Create offboarding workflow for contractor with assigned equipment; verify warning/blocker before completion |
| Stripe webhook idempotency | Stripe paywall | Replay same Stripe event 3 times; verify only one database state change. Test with concurrent events |
| Stripe metered billing accuracy | Stripe paywall | Simulate 100 OCR requests with 5% failure rate; verify all usage eventually reported to Stripe via reconciliation |
| Stripe payment failure handling | Stripe paywall | Use Test Clock to simulate failed payment; verify grace period, dunning emails, and eventual access revocation |
| Onboarding import vs sync scope | Onboarding (planning) | UX copy reviewed for import/sync language; re-import shows diff preview; no continuous sync webhook registered |
| Onboarding duplicate prevention | Onboarding | Import same source twice; verify no duplicate records; verify cross-source dedup by email |
| Free trial expiry handling | Stripe paywall | Use Test Clock to advance through trial; verify warning emails at 7/3/1 days; verify grace period |

## Sources

- [Linear Webhooks Documentation](https://linear.app/developers/webhooks) -- webhook signature (HMAC-SHA256 via `Linear-Signature` header), timestamp verification, payload structure
- [Linear API Rate Limits](https://linear.app/docs/api-and-webhooks) -- 500 req/hr per OAuth app user, 250,000 complexity points/hr
- [Linear Webhooks Guide (InventiveHQ)](https://inventivehq.com/blog/linear-webhooks-guide) -- payload examples, event types, best practices
- [Microsoft Teams Bot Framework](https://learn.microsoft.com/en-us/azure/bot-service/channel-connect-teams?view=azure-bot-service-4.0) -- Azure Bot registration, messaging endpoint requirements
- [Teams Adaptive Card Universal Actions](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/universal-actions-for-adaptive-cards/up-to-date-views) -- user-specific views, Action.Execute, card refresh
- [Teams Bot Approval Workflows (Microsoft Q&A)](https://learn.microsoft.com/en-sg/answers/questions/5705984/custom-microsoft-teams-bot-for-approval-workflows) -- proactive messaging, conversation reference storage
- [Teams Bot Messaging Endpoint Without Azure Hosting](https://learn.microsoft.com/en-us/answers/questions/4370788/how-to-configure-messaging-endpoint-for-a-microsof) -- hosting flexibility, JWT validation requirement
- [Google Admin SDK Directory API](https://developers.google.com/workspace/admin/directory/v1/guides) -- pagination, field selection, rate limits
- [Google Admin SDK Common Errors](https://developers.google.com/workspace/admin/reseller/v1/support/directory_api_common_errors) -- 403, 429 error handling
- [Stripe Webhook Best Practices (Stigg)](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks) -- idempotency, event ordering, 20-second timeout
- [Stripe Usage-Based Billing](https://docs.stripe.com/billing/subscriptions/usage-based/manage-billing-setup) -- metered billing, usage record API, increment vs set
- [Stripe SaaS Integration Guide (DesignRevision)](https://designrevision.com/blog/saas-stripe-integration) -- multi-tenant billing patterns, common mistakes
- [Stripe Idempotent Requests](https://docs.stripe.com/api/idempotent_requests) -- idempotency key handling, 24-hour key lifetime
- [Stripe Serverless Webhook Pattern (ScaleToZeroAWS)](https://scaletozeroaws.com/blog/stripe-webhooks-serverless-saas) -- queue-based processing, signature verification
- [InPost ShipX API Documentation](https://dokumentacja-inpost.atlassian.net/wiki/spaces/PL/pages/622754/API+ShipX) -- OAuth 2.0, endpoint URLs, sandbox vs production
- [Vercel Function Limits](https://vercel.com/docs/functions/limitations) -- timeout constraints, Fluid Compute durations
- Existing codebase: `packages/integrations/src/adapters/base-adapter.ts` -- `BaseAdapter` class, `IntegrationProviderAdapter` interface
- Existing codebase: `jira-webhook-handler.ts` -- `LOOP_PREVENTION_WINDOW_MS` (30s), `DEDUP_WINDOW_MS` (5s), sync source tracking pattern
- Existing codebase: `jira-issue-sync.ts` -- outbound issue creation, ExternalLink metadata caching

---
*Pitfalls research for: Contractor Ops v3.0 Enterprise & Monetization -- Linear, Teams, Google Workspace, intelligent onboarding, equipment tracking, Stripe billing*
*Researched: 2026-04-01*
