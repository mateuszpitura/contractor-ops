# Phase 7: Notifications & Slack - Research

**Researched:** 2026-03-22
**Domain:** In-app notifications, email delivery (Resend), Slack integration (OAuth + Block Kit interactivity)
**Confidence:** HIGH

## Summary

Phase 7 implements three notification channels (in-app, email, Slack) with a unified dispatch service, user preference management, custom reminder rules, and Slack interactive approval actions. The project already has Resend SDK v6.9.4 installed for inbound email (Phase 5), Prisma schemas for all notification/integration models, and a bell icon in the top bar ready for wiring.

The core architecture is an inline notification dispatch service called from tRPC mutation procedures after database operations. No background queue is needed for v1. For Slack, the project should use `@slack/web-api` directly (not `@slack/bolt`) since the integration only needs a few API methods and runs in Next.js API routes where full control over request/response timing matters. Email templates use React Email components rendered through Resend's SDK. The Slack OAuth flow is a standard 3-step redirect flow with credentials stored in the existing IntegrationConnection model.

**Primary recommendation:** Build a `notificationService` in `packages/api/src/services/` with a `dispatch()` method that checks user preferences, creates Notification rows, sends Resend emails, and posts Slack DMs -- called inline from existing tRPC routers after approval, workflow, invoice, and contract operations.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Dropdown popover from bell icon -- click bell opens scrollable notification list (max ~10 visible), unread count badge on bell, "Mark all read" button, "View all" link to full page
- D-02: Click notification navigates to related entity -- uses entityType + entityId for deep linking. Marks as read on click
- D-03: Flat chronological list -- reverse chronological, unread items have dot indicator. No grouping in v1
- D-04: Full /notifications page with filters -- type filter (approvals, tasks, contracts, invoices), read/unread filter, "Mark all read" action
- D-05: Settings > Notifications tab with per-type per-channel matrix -- rows = 6 event types, columns = in-app/email/Slack toggles
- D-06: Minimal branded email templates -- logo header, event summary, single CTA button, unsubscribe footer. Resend handles delivery
- D-07: "Manage preferences" link in email footer -- deep link to Settings > Notifications
- D-08: Settings > Integrations with OAuth flow -- admin-only "Connect Slack" button, IntegrationConnection stores credentials
- D-09: Block Kit approval cards with action buttons -- rich Slack message with Approve/Reject buttons. Reject opens Slack modal for mandatory comment. After action, original message updates to show result
- D-10: Auto-match users by email -- bot queries workspace members and auto-matches by email address. Admin can manually link unmatched users
- D-11: Inline dispatch after action -- tRPC procedures call notificationService.dispatch() inline. No background job queue in v1
- D-12: All 6 core event types + custom reminder rules -- (1) approval request, (2) approval decision, (3) task assigned, (4) task overdue, (5) contract expiring, (6) invoice received. Custom rules via ReminderRule model
- D-13: Reminder rules admin UI in Settings > Notifications -- below user preference matrix. Admin creates rules with trigger type, offset, recipients, channel

### Claude's Discretion
- Notification popover width and animation
- Polling vs WebSocket for real-time notification count (polling acceptable in v1)
- Email template HTML/CSS details
- Slack Block Kit layout specifics
- Reminder rule evaluation mechanism (cron interval, on-demand check, etc.)
- How to handle Slack rate limits
- Notification deduplication logic for rapid successive events
- Empty states for notification center and integrations page
- Slack user mapping admin UI design
- ReminderRule form field layout and validation

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTF-01 | System sends in-app notifications for: approval requests, approval decisions, task assignments, task overdue, contract expiring, invoice received | notificationService.dispatch() creates Notification rows with channel=IN_APP for all 6 event types. Notification model with type, entityType, entityId, status fields supports this directly |
| NOTF-02 | System sends email notifications for the same events (configurable per user) | Resend SDK already installed. React Email templates for each event type. UserNotificationPreference.channelEmail toggle per type controls routing |
| NOTF-03 | User can view and manage their notifications (mark read, mark all read) | tRPC notification router with list/markRead/markAllRead procedures. Bell popover + /notifications page consume these |
| SLCK-01 | System sends Slack DMs to approvers with approve/reject action buttons | @slack/web-api chat.postMessage with Block Kit actions block containing approve/reject buttons. User ID resolved via ExternalLink (email auto-match) |
| SLCK-02 | Approver can approve/reject invoices directly from Slack | Next.js API route handles Slack interactivity webhook (block_actions payload). Reject opens views.open modal for comment. Calls existing approval engine advanceFlow() |
| SLCK-03 | System sends Slack reminders for overdue approvals and expiring contracts | ReminderRule + ReminderInstance models with cron-like evaluation. Same chat.postMessage DM delivery as SLCK-01 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| resend | 6.9.4 | Email delivery (outbound notifications) | Already installed from Phase 5. Handles transactional email sending with React Email support |
| @react-email/components | 0.0.34 | Email template components (JSX) | Official companion to Resend. Build email templates as React components with Tailwind support |
| @slack/web-api | 7.15.0 | Slack API client (chat.postMessage, views.open, users.list) | Lightweight official SDK. Better than @slack/bolt for Next.js API routes -- no socket mode, no framework overhead |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @slack/types | 2.15.0 | TypeScript types for Slack Block Kit | Type-safe Block Kit block construction |
| react-email | 5.2.10 | Email preview dev server (optional) | Development-time preview of email templates. Not required at runtime |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @slack/web-api | @slack/bolt | Bolt adds framework overhead (receivers, middleware) unnecessary for simple Next.js API routes. Direct web-api gives full control over 3-second response timing |
| @react-email/components | MJML | MJML is XML-based, not React. React Email integrates natively with Resend and project JSX conventions |
| Inline dispatch | BullMQ / Redis queue | Queue adds infrastructure complexity. Inline is sufficient for v1 traffic (5-50 orgs). Revisit if dispatch latency impacts response times |

**Installation:**
```bash
pnpm add @slack/web-api @slack/types @react-email/components --filter @contractor-ops/api
pnpm add react-email --filter @contractor-ops/api --save-dev
```

**Version verification:** Versions confirmed via `npm view` on 2026-03-22. Resend 6.9.4 already in apps/web/package.json.

## Architecture Patterns

### Recommended Project Structure
```
packages/api/src/
  services/
    notification-service.ts    # Core dispatch logic (preferences check, IN_APP insert, email send, Slack DM)
    slack-client.ts            # @slack/web-api WebClient factory, token retrieval from IntegrationConnection
    email-templates.ts         # React Email template rendering helpers
  routers/
    notification.ts            # tRPC router: list, markRead, markAllRead, unreadCount, preferences CRUD
    reminder.ts                # tRPC router: reminder rule CRUD, list instances
    integration.ts             # tRPC router: Slack connection status, user mapping, OAuth initiation
apps/web/src/
  app/api/
    slack/
      oauth/route.ts           # GET: Slack OAuth callback (code exchange, token storage)
      interactivity/route.ts   # POST: Slack block_actions + view_submission handler
  app/[locale]/(dashboard)/
    notifications/page.tsx      # Full notification center page
    settings/page.tsx           # Extended with Notifications + Integrations tabs
  components/
    notifications/
      notification-popover.tsx  # Bell icon popover with ScrollArea
      notification-item.tsx     # Reusable notification row component
      notification-center.tsx   # Full page notification list with filters
      notification-preference-matrix.tsx  # Settings preference grid
    reminders/
      reminder-rule-card.tsx    # Individual rule display card
      reminder-rule-editor.tsx  # Create/edit dialog form
    integrations/
      slack-connection-card.tsx # Connection status + OAuth trigger
      slack-user-mapping.tsx    # User mapping table
packages/email/                 # NEW package for email templates (or in packages/api/src/emails/)
  templates/
    approval-request.tsx
    approval-decision.tsx
    task-assigned.tsx
    task-overdue.tsx
    contract-expiring.tsx
    invoice-received.tsx
    base-layout.tsx             # Shared logo header + CTA button + footer
```

### Pattern 1: Notification Dispatch Service
**What:** Central service that handles preference checking, multi-channel delivery, and Notification record creation in a single `dispatch()` call.
**When to use:** Every time a notifiable event occurs in any tRPC mutation.
**Example:**
```typescript
// packages/api/src/services/notification-service.ts
interface NotificationEvent {
  organizationId: string;
  type: "approval_request" | "approval_decision" | "task_assigned" | "task_overdue" | "contract_expiring" | "invoice_received";
  recipientUserIds: string[];
  title: string;
  body: string;
  entityType: EntityType;
  entityId: string;
  metadata?: Record<string, unknown>; // Extra data for email/Slack templates
}

async function dispatch(event: NotificationEvent): Promise<void> {
  for (const userId of event.recipientUserIds) {
    const prefs = await getOrCreatePreferences(userId, event.organizationId, event.type);

    // Always create IN_APP notification
    if (prefs.channelInApp) {
      await prisma.notification.create({
        data: {
          organizationId: event.organizationId,
          userId,
          channel: "IN_APP",
          type: event.type,
          title: event.title,
          body: event.body,
          entityType: event.entityType,
          entityId: event.entityId,
          status: "SENT",
          sentAt: new Date(),
        },
      });
    }

    // Send email if enabled
    if (prefs.channelEmail) {
      await sendNotificationEmail(userId, event);
    }

    // Send Slack DM if enabled and connected
    if (prefs.channelSlack) {
      await sendSlackDM(userId, event);
    }
  }
}
```

### Pattern 2: Slack OAuth Flow (3-Step Redirect)
**What:** Admin initiates OAuth from Settings > Integrations. Redirect to Slack authorize URL. Callback exchanges code for bot token.
**When to use:** Initial Slack workspace connection.
**Example:**
```typescript
// Step 1: Generate authorize URL (from tRPC or client-side)
const authorizeUrl = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=${BOT_SCOPES}&redirect_uri=${REDIRECT_URI}&state=${encryptedState}`;

// Step 2: Callback API route (apps/web/src/app/api/slack/oauth/route.ts)
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state"); // decrypt to get orgId

  // Exchange code for token
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: code!,
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const data = await response.json();
  // Store in IntegrationConnection: data.access_token, data.team.name, etc.
  // Encrypt token before storing in credentialsRef
}
```

### Pattern 3: Slack Interactivity Webhook Handler
**What:** Single API route that handles block_actions (button clicks) and view_submission (modal submit) payloads from Slack.
**When to use:** When approver clicks Approve/Reject on a Slack message.
**Example:**
```typescript
// apps/web/src/app/api/slack/interactivity/route.ts
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const payload = JSON.parse(formData.get("payload") as string);

  if (payload.type === "block_actions") {
    const action = payload.actions[0];
    if (action.action_id === "approve_invoice") {
      // Call approval engine directly
      await advanceFlow({ invoiceId, decision: "APPROVED", actorUserId });
      // Update original message via chat.update
      await slackClient.chat.update({ channel, ts, blocks: approvedBlocks });
    } else if (action.action_id === "reject_invoice") {
      // Open modal for mandatory rejection comment
      await slackClient.views.open({
        trigger_id: payload.trigger_id,
        view: rejectCommentModal(invoiceId),
      });
    }
    return new Response("", { status: 200 }); // Acknowledge within 3 seconds
  }

  if (payload.type === "view_submission") {
    const comment = payload.view.state.values.comment_block.comment_input.value;
    const invoiceId = JSON.parse(payload.view.private_metadata).invoiceId;
    await advanceFlow({ invoiceId, decision: "REJECTED", comment, actorUserId });
    // Update original message
    return new Response("", { status: 200 });
  }
}
```

### Pattern 4: Polling-based Unread Count
**What:** Client polls unread notification count every 30 seconds via tRPC query. No WebSocket needed for v1.
**When to use:** Bell icon badge in top bar.
**Example:**
```typescript
// Client-side in TopBar or a provider
const { data: unreadCount } = api.notification.unreadCount.useQuery(undefined, {
  refetchInterval: 30_000, // 30 seconds
  refetchIntervalInBackground: false, // Only when tab is focused
});
```

### Pattern 5: Reminder Rule Evaluation via Cron
**What:** A scheduled endpoint (Vercel Cron or external trigger) evaluates active ReminderRules against current entity dates, creates ReminderInstances, and dispatches notifications.
**When to use:** For SLCK-03 and custom reminder delivery.
**Recommendation:** Use a Next.js API route triggered by Vercel Cron at 15-minute intervals. Each run queries active rules, checks entity dates against offset, creates ReminderInstance if not already existing for that entity+rule+scheduledFor combination, and dispatches via notificationService.
```typescript
// apps/web/src/app/api/cron/reminders/route.ts
export async function GET(request: NextRequest) {
  // Verify cron secret header
  const rules = await prisma.reminderRule.findMany({ where: { active: true } });
  for (const rule of rules) {
    const entities = await findEntitiesMatchingRule(rule);
    for (const entity of entities) {
      const scheduledFor = computeScheduledDate(entity, rule);
      if (scheduledFor <= new Date()) {
        const existing = await prisma.reminderInstance.findFirst({
          where: { reminderRuleId: rule.id, entityId: entity.id, entityType: rule.entityType },
        });
        if (!existing) {
          await prisma.reminderInstance.create({ ... });
          await notificationService.dispatch({ ... });
        }
      }
    }
  }
}
```

### Anti-Patterns to Avoid
- **Dispatching in middleware:** Do not add notification dispatch to tRPC middleware. It should be explicit per-procedure to control exactly which events trigger which notifications.
- **Storing Slack bot tokens in plain text:** Always encrypt the bot token before storing in IntegrationConnection.credentialsRef. Decrypt only at send time.
- **Blocking on email/Slack delivery:** Wrap external calls in try/catch so delivery failures don't break the main operation. Log failures for retry.
- **Creating separate API routes per Slack action:** Use a single interactivity endpoint that routes by payload.type and action_id.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email HTML rendering | Custom HTML string templates | React Email (@react-email/components) | Email HTML is notoriously complex (table layouts, client quirks). React Email handles cross-client rendering |
| Slack API calls | Raw fetch to api.slack.com | @slack/web-api WebClient | Handles token rotation, rate limit retries, error typing, pagination automatically |
| Slack OAuth state/CSRF | Manual state parameter generation | Crypto-signed state token with orgId + timestamp | State must be unforgeable; use HMAC or AES encryption on the state parameter |
| Email delivery + tracking | SMTP integration | Resend SDK | Already installed. Handles delivery, bounces, complaint tracking |
| Block Kit message construction | JSON object literals | Typed builder with @slack/types | Prevents invalid block structures at compile time |

**Key insight:** The Slack integration has three tricky parts (OAuth token security, 3-second interactivity response window, modal submission state passing). Using @slack/web-api handles the API complexity, but the OAuth and interactivity flows need careful implementation in Next.js API routes.

## Common Pitfalls

### Pitfall 1: Slack 3-Second Interactivity Timeout
**What goes wrong:** Slack requires a 200 OK response within 3 seconds of sending a block_actions payload. If your handler does database operations before responding, it times out and shows an error to the user.
**Why it happens:** The interactivity handler does approval engine work (DB reads/writes) synchronously before responding.
**How to avoid:** Respond immediately with 200 OK, then perform the approval action. Use chat.update after the fact to update the original message. Alternatively, use `waitUntil()` on Vercel or fire-and-forget the async work.
**Warning signs:** Users see "Something went wrong" in Slack after clicking Approve/Reject.

### Pitfall 2: Slack Token Storage Security
**What goes wrong:** Slack bot tokens stored in plain text in the database. If DB is compromised, attacker can impersonate the bot in all connected workspaces.
**Why it happens:** Quick implementation stores the token directly in credentialsRef.
**How to avoid:** Encrypt the bot token with a server-side encryption key (e.g., AES-256-GCM) before storing. Store the encryption key in environment variables, not in the database.
**Warning signs:** credentialsRef column contains values starting with "xoxb-".

### Pitfall 3: Missing Slack User Email Match
**What goes wrong:** users.list API doesn't return email addresses unless users:read.email scope is requested.
**Why it happens:** The scope is easy to forget -- users:read alone returns user profiles WITHOUT email fields.
**How to avoid:** Request both `users:read` and `users:read.email` scopes during OAuth. Verify email field is populated in the response.
**Warning signs:** Auto-match finds 0 users despite workspace having many members.

### Pitfall 4: Notification Preference Defaults
**What goes wrong:** New users have no UserNotificationPreference rows, causing notifications to be skipped.
**Why it happens:** Preference check returns null, and the dispatch service treats it as "all disabled."
**How to avoid:** Use a `getOrCreatePreferences()` helper that creates default rows (all channels enabled) when none exist for a user+type combination.
**Warning signs:** New users never receive any notifications despite the system being operational.

### Pitfall 5: Duplicate Notifications on Retry
**What goes wrong:** If a tRPC mutation is retried (network error), the notification dispatch fires again, sending duplicate emails/Slack messages.
**Why it happens:** Inline dispatch is not idempotent -- each call creates new Notification rows.
**How to avoid:** Include a deduplication key based on (userId + type + entityId + timestamp window). Before creating a Notification, check if one exists within the last 60 seconds for the same combination.
**Warning signs:** Users receive the same notification email twice within seconds.

### Pitfall 6: Slack OAuth CSRF
**What goes wrong:** Attacker crafts a fake OAuth callback URL to connect their own Slack workspace to a victim's organization.
**Why it happens:** No state parameter verification on the OAuth callback.
**How to avoid:** Generate a cryptographically signed state parameter containing the orgId and a timestamp. Verify the signature on callback before exchanging the code.
**Warning signs:** None visible to users -- this is a security vulnerability that needs preventive design.

### Pitfall 7: Cron Reminder Double-Send
**What goes wrong:** If the cron job runs twice in quick succession (e.g., cold start retry), the same reminder is sent twice.
**Why it happens:** No idempotency check on ReminderInstance creation.
**How to avoid:** Use a unique constraint or findFirst check on (reminderRuleId + entityId + scheduledFor date) before creating a ReminderInstance.
**Warning signs:** Users receive duplicate reminder notifications on the same day.

## Code Examples

### Resend Outbound Email (using existing SDK)
```typescript
// Source: Resend SDK docs + project pattern from resend-inbound/route.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

await resend.emails.send({
  from: "Contractor Ops <notifications@contractorhub.io>",
  to: [userEmail],
  subject: "Action needed: Approve invoice INV-2024-001",
  react: ApprovalRequestEmail({ invoiceNumber, contractorName, amount, ctaUrl }),
  headers: {
    "List-Unsubscribe": `<${preferencesUrl}>`,
  },
});
```

### Slack DM with Block Kit Approval Card
```typescript
// Source: Slack docs.slack.dev + @slack/web-api
import { WebClient } from "@slack/web-api";
import type { KnownBlock } from "@slack/types";

const blocks: KnownBlock[] = [
  {
    type: "header",
    text: { type: "plain_text", text: "Invoice approval request" },
  },
  {
    type: "section",
    fields: [
      { type: "mrkdwn", text: `*Invoice:*\n${invoiceNumber}` },
      { type: "mrkdwn", text: `*Contractor:*\n${contractorName}` },
      { type: "mrkdwn", text: `*Amount:*\n${formattedAmount}` },
      { type: "mrkdwn", text: `*SLA deadline:*\n${slaDeadline}` },
    ],
  },
  {
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Approve" },
        style: "primary",
        action_id: "approve_invoice",
        value: JSON.stringify({ invoiceId, flowId }),
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Reject" },
        style: "danger",
        action_id: "reject_invoice",
        value: JSON.stringify({ invoiceId, flowId }),
      },
    ],
  },
];

await slackClient.chat.postMessage({
  channel: slackUserId, // Slack user ID opens DM automatically
  text: `Approval request for invoice ${invoiceNumber}`, // Fallback for notifications
  blocks,
});
```

### Slack Reject Modal (views.open)
```typescript
// Source: Slack docs.slack.dev/reference/methods/views.open
await slackClient.views.open({
  trigger_id: payload.trigger_id,
  view: {
    type: "modal",
    callback_id: "reject_invoice_modal",
    private_metadata: JSON.stringify({ invoiceId, flowId, channelId, messageTs }),
    title: { type: "plain_text", text: "Reject invoice" },
    submit: { type: "plain_text", text: "Reject invoice" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "comment_block",
        label: { type: "plain_text", text: "Reason (required)" },
        element: {
          type: "plain_text_input",
          action_id: "comment_input",
          multiline: true,
          placeholder: { type: "plain_text", text: "Describe why this invoice is being rejected..." },
        },
      },
    ],
  },
});
```

### Entity Deep Link URL Construction
```typescript
// Notification click -> navigate to entity
function getEntityUrl(entityType: EntityType, entityId: string): string {
  const routes: Record<string, string> = {
    INVOICE: `/invoices/${entityId}`,
    CONTRACT: `/contracts/${entityId}`,
    CONTRACTOR: `/contractors/${entityId}`,
    WORKFLOW_RUN: `/workflows/${entityId}`,
    WORKFLOW_TASK_RUN: `/workflows/${entityId}`, // Navigate to parent run
    APPROVAL_FLOW: `/approvals`, // Navigate to queue
  };
  return routes[entityType] ?? "/notifications";
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Slack legacy OAuth (oauth.access) | OAuth v2 (oauth.v2.access) | 2020+ | v2 puts bot tokens first, cleaner response shape. Legacy is deprecated |
| Slack dialogs (dialog.open) | Slack modals (views.open) | 2019+ | Modals support Block Kit, are more powerful, dialogs are deprecated |
| response_url for message updates | chat.update API method | 2024+ | response_url is deprecated for new apps. Use chat.update with channel + ts |
| Custom HTML email strings | React Email components | 2023+ | JSX-based email templates with cross-client rendering, Tailwind CSS support |
| MJML for email | React Email | 2024+ | React Email has better DX, native Resend integration, component reuse |

**Deprecated/outdated:**
- Slack dialogs (dialog.open) -- replaced by modals (views.open)
- Slack response_url for interactive messages -- use chat.update instead
- Slack legacy OAuth (oauth.access) -- use oauth.v2.access

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected -- no test framework configured in project |
| Config file | none -- see Wave 0 |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTF-01 | notificationService.dispatch creates IN_APP notifications for 6 event types | unit | N/A | No -- Wave 0 |
| NOTF-02 | dispatch sends email when channelEmail=true, skips when false | unit | N/A | No -- Wave 0 |
| NOTF-03 | markRead/markAllRead update notification status | unit | N/A | No -- Wave 0 |
| SLCK-01 | dispatch sends Slack DM with Block Kit when channelSlack=true and connected | unit | N/A | No -- Wave 0 |
| SLCK-02 | interactivity handler calls advanceFlow on approve/reject | integration | N/A | No -- Wave 0 |
| SLCK-03 | cron handler evaluates rules and dispatches reminders | unit | N/A | No -- Wave 0 |

### Sampling Rate
Not applicable -- no test framework configured.

### Wave 0 Gaps
No test infrastructure exists in this project. Testing would require:
- [ ] Install vitest + test utilities
- [ ] Configure vitest.config.ts for packages/api
- [ ] Create test fixtures for Prisma models (notification, preference, etc.)
- [ ] Mock Resend SDK and Slack WebClient for unit tests

Given the project has completed 6 phases without tests (yolo mode, no test infrastructure), this is consistent with project conventions. The planner should not introduce test infrastructure unless explicitly requested.

## Open Questions

1. **Slack bot token encryption approach**
   - What we know: credentialsRef field stores the encrypted token reference
   - What's unclear: Whether to use Node.js crypto AES-256-GCM, or a separate secrets manager
   - Recommendation: Use Node.js `crypto.createCipheriv` with AES-256-GCM and a SLACK_TOKEN_ENCRYPTION_KEY env var. Simple, no extra dependencies

2. **Cron trigger for reminder evaluation**
   - What we know: ReminderRule + ReminderInstance models exist in schema
   - What's unclear: Whether project deploys to Vercel (Vercel Cron) or self-hosted
   - Recommendation: Implement as a Next.js API route with a shared secret header check. Works with Vercel Cron, external cron services, or manual trigger. 15-minute interval sufficient for v1

3. **Slack interactivity request verification**
   - What we know: Slack signs interactivity payloads with a signing secret
   - What's unclear: Whether to use @slack/web-api's built-in verification or manual HMAC
   - Recommendation: Use Slack signing secret verification (HMAC-SHA256) in the interactivity route. The @slack/web-api package does not include this -- implement manually or use the lightweight `@slack/events-api` verifier

4. **Email sender domain**
   - What we know: Inbound uses contractorhub.io domain (from Phase 5 webhook)
   - What's unclear: Whether outbound notifications should use same domain
   - Recommendation: Use `notifications@contractorhub.io` as sender. Requires Resend domain verification for this address (may already be done for inbound)

## Slack Integration Scopes

The Slack app requires these bot token scopes during OAuth:

| Scope | Purpose |
|-------|---------|
| `chat:write` | Send DMs and update messages (approval cards, reminders) |
| `users:read` | List workspace members for user mapping |
| `users:read.email` | Access member email addresses for auto-matching |
| `im:write` | Open DM conversations with users |

**Full scope string for OAuth authorize URL:**
```
chat:write,users:read,users:read.email,im:write
```

## Environment Variables (New)

| Variable | Purpose | Required |
|----------|---------|----------|
| SLACK_CLIENT_ID | Slack app OAuth client ID | Yes (for Slack features) |
| SLACK_CLIENT_SECRET | Slack app OAuth client secret | Yes (for Slack features) |
| SLACK_SIGNING_SECRET | Slack request signature verification | Yes (for interactivity webhook) |
| SLACK_TOKEN_ENCRYPTION_KEY | AES-256 key for encrypting stored bot tokens | Yes (for Slack features) |
| CRON_SECRET | Shared secret for cron endpoint authentication | Yes (for reminders) |
| RESEND_API_KEY | Already exists -- reuse for outbound email | Already configured |

## Sources

### Primary (HIGH confidence)
- Slack Developer Docs (docs.slack.dev) -- OAuth v2 install flow, Block Kit interactive messages, views.open API, scopes reference
- Resend SDK (already installed v6.9.4) -- outbound email sending, React Email integration
- Project codebase -- Prisma schemas (notification.prisma, integration.prisma), existing Resend webhook (resend-inbound/route.ts), top-bar.tsx bell icon, settings page structure

### Secondary (MEDIUM confidence)
- [Installing with OAuth | Slack Developer Docs](https://docs.slack.dev/authentication/installing-with-oauth/) -- 3-step OAuth flow details
- [block_actions payload | Slack Developer Docs](https://docs.slack.dev/reference/interaction-payloads/block_actions-payload/) -- Interactivity payload structure
- [views.open method | Slack Developer Docs](https://docs.slack.dev/reference/methods/views.open/) -- Modal opening API
- [chat:write scope | Slack Developer Docs](https://docs.slack.dev/reference/scopes/chat.write/) -- DM sending scope
- [React Email + Resend integration](https://react.email/docs/integrations/resend) -- Email template rendering

### Tertiary (LOW confidence)
- Slack 3-second timeout handling in serverless -- based on community reports and Vercel blog posts. Core claim (3s limit) is well-documented officially; mitigation patterns are community-sourced

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Resend already installed, @slack/web-api is the official SDK, versions verified via npm
- Architecture: HIGH -- Prisma models already defined, integration points clearly identified in codebase, established tRPC router patterns to follow
- Pitfalls: HIGH -- Slack timeout, OAuth CSRF, email scope issues are well-documented in official Slack docs and community

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (30 days -- stable APIs, no breaking changes expected)
