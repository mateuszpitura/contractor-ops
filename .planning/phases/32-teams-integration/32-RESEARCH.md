# Phase 32: Teams Integration - Research

**Researched:** 2026-04-04
**Domain:** Microsoft Teams Bot Framework, Adaptive Cards, Graph API, MessagingProvider abstraction
**Confidence:** MEDIUM

## Summary

Phase 32 requires two major workstreams: (1) extracting a MessagingProvider interface from the existing hardcoded Slack notification dispatch, then (2) implementing a Teams adapter using Microsoft's Bot Framework with Adaptive Cards for notifications and interactive invoice approvals.

The Bot Framework SDK (`botbuilder` v4.23.3) is technically archived as of December 2025, with Microsoft recommending migration to the Microsoft 365 Agents SDK (`@microsoft/agents-hosting`). However, the Agents SDK for JavaScript is pre-1.0 (v0.4.3 for the Teams extension, last updated May 2025), while `botbuilder` remains functional, well-documented, and battle-tested. The recommended approach is to use `botbuilder` v4.23.3 now and plan for Agents SDK migration later -- the API surface is similar and migration is primarily a package swap.

The project already has a mature integration adapter framework (BaseAdapter, provider registry, OAuth callback routing, webhook pipeline, credential encryption). The TeamsAdapter fits cleanly into this pattern. The main complexity lies in the Bot Framework's `CloudAdapter` and `TeamsActivityHandler` integration within Next.js API routes, plus the Adaptive Card JSON template system for approvals with task module (modal) support for rejection comments.

**Primary recommendation:** Use `botbuilder` v4.23.3 with `CloudAdapter` + `TeamsActivityHandler`. Create a dedicated `/api/teams/messages` route for the Bot Framework messaging endpoint (separate from the generic webhook pipeline, since Bot Framework has its own authentication and message processing model). Extract MessagingProvider interface first, then implement Teams provider.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Extract a `MessagingProvider` interface from the existing Slack-hardcoded notification service. Interface methods: `sendApprovalCard()`, `sendReminderDM()`, `sendChannelAlert()`, `getUserId()`. Both Slack and Teams implement this interface.
- **D-02:** Refactor happens within Phase 32 (first plan: extract interface + refactor Slack, second plan: add Teams implementation). No separate prerequisite phase.
- **D-03:** `dispatch()` iterates all connected messaging providers for each notification. `UserNotificationPreference` gets a `channelTeams` boolean column alongside existing `channelSlack`.
- **D-04:** Slack and Teams can be connected simultaneously. Different users in the same org can use different platforms. No mutual exclusion.
- **D-05:** Approval cards use `Action.Submit` for approve (direct submit) and reject (opens task module/modal dialog for mandatory comment). Card updates in-place after action to show result with approver name.
- **D-06:** Approval card shows: invoice number, contractor name, amount with currency, due date. After action: status icon, approver name, invoice reference, amount.
- **D-07:** Activity alert cards are compact Adaptive Cards: event icon, title, 2-3 key details, and a "View in Contractor Ops" OpenUrl button. Non-interactive -- just awareness.
- **D-08:** Approval reminder DMs are full Adaptive Cards with approve/reject action buttons -- approver can act directly from the reminder without opening the web app. Shows overdue duration.
- **D-09:** Per-notification-type channel mapping. Admin picks a Teams channel for each notification category (approvals, invoices, contracts, tasks, equipment). Stored in `IntegrationConnection.configJson`.
- **D-10:** Bot fetches available channels via Graph API after OAuth connection. Dropdown shows channels where bot is installed. Refresh button to re-fetch if teams/channels change.
- **D-11:** Azure Bot Service registration handled via USER-SETUP.md with step-by-step instructions. Code expects `AZURE_BOT_APP_ID` and `AZURE_BOT_APP_SECRET` env vars. Health check reports unconnected until configured.
- **D-12:** `TeamsAdapter` extends `BaseAdapter` following the same provider adapter pattern as Slack, Jira, Linear, Google Workspace. OAuth via Azure AD, credentials in `IntegrationConnection`, health check via Graph API.
- **D-13:** ConversationReferences for proactive messaging stored in `IntegrationConnection.configJson` -- follows the same pattern as Linear status mappings and Google sync state.

### Claude's Discretion
- Adaptive Card JSON template structure and styling
- Bot Framework SDK version and configuration
- Azure AD OAuth scope selection
- Graph API queries for team/channel discovery
- ConversationReference serialization format within configJson
- Error handling for Teams API rate limits
- User-to-Teams mapping mechanism (email match, like Slack)
- Task module (modal) implementation details for reject comment
- Teams provider section UI in Settings > Integrations (follow existing provider section pattern)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEAM-01 | Admin can connect Teams workspace via Azure AD OAuth with bot registration | TeamsAdapter extends BaseAdapter with Azure AD OAuth config; uses existing `/api/oauth/[provider]/callback` route; requires MICROSOFT_TEAMS enum in IntegrationProvider |
| TEAM-02 | Admin can configure which Teams channel receives which notification types | Graph API `GET /teams/{id}/channels` for channel list; per-type mapping stored in configJson; TeamsChannelMappingCard UI component |
| TEAM-03 | System sends activity alerts to configured Teams channels via Adaptive Cards | ActivityAlertCard Adaptive Card template; TeamsMessagingProvider.sendChannelAlert() dispatches via Bot Framework continueConversation |
| TEAM-04 | Manager can approve or reject invoices directly from Teams Adaptive Card actions | ApprovalCard with Action.Submit (approve) and task/fetch (reject modal); TeamsActivityHandler processes invoke activities; reuses approval-engine.advanceFlow() |
| TEAM-05 | System sends approval reminder DMs to approvers with overdue items via proactive messaging | ApprovalReminderCard with action buttons; continueConversation with stored ConversationReference; cron trigger same as existing reminder system |
| TEAM-06 | Teams bot stores ConversationReferences for proactive messaging per user | Captured in onMembersAdded / onConversationUpdate; stored in IntegrationConnection.configJson keyed by user AAD object ID |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Use `ctx7` CLI for library documentation (applied: Bot Framework, Adaptive Cards)
- Schema validation for all external inputs (Zod for webhook payloads, card action data)
- Never trust client input (validate Teams invoke payloads, verify bot authentication)
- AES-256-GCM per-provider encryption for credentials (TEAMS_ENCRYPTION_KEY)
- Follow existing adapter pattern (BaseAdapter, provider registry)
- Production-grade code, not demo-grade shortcuts
- Both `en` and `pl` i18n translations required
- Clean architecture with clear boundaries between packages

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| botbuilder | 4.23.3 | Bot Framework SDK -- CloudAdapter, TeamsActivityHandler, TurnContext | Industry standard for Teams bot development; CloudAdapter replaces deprecated BotFrameworkAdapter |
| @microsoft/adaptivecards | - | Adaptive Card schema reference (type-only, cards are JSON) | Not needed as runtime dep -- Adaptive Cards are JSON templates sent to Teams |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @microsoft/microsoft-graph-client | 3.0.7 | Graph API client for channel discovery | Fetching team/channel lists; user lookup by email |
| @azure/identity | 4.x | Azure credential management for Graph API calls | Token acquisition for Graph API using client credentials |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| botbuilder v4 | @microsoft/agents-hosting v1.4.2 | Agents SDK is the official successor but JS Teams extension is pre-1.0 (v0.4.3); too immature for production; migration path exists for later |
| @microsoft/microsoft-graph-client | Raw fetch to Graph API | Graph client handles token management, retry, and pagination; worth the dependency |
| Adaptive Cards SDK | Plain JSON objects | Cards are JSON -- no SDK needed; TypeScript interfaces for type safety suffice |

**Installation:**
```bash
npm install botbuilder @microsoft/microsoft-graph-client @azure/identity
```

**Version verification:**
- botbuilder: 4.23.3 (verified via npm, published 2025-08-27)
- @microsoft/microsoft-graph-client: verify at install time
- @azure/identity: verify at install time

**Note on Bot Framework SDK lifecycle:** Microsoft archived the Bot Framework SDK repository in December 2025 and recommends the M365 Agents SDK. However, `botbuilder` v4.23.3 on npm is functional and widely used. The Agents SDK JS is pre-1.0 and not production-ready. Use botbuilder now; migration is a future concern (package swap, similar API surface).

## Architecture Patterns

### Recommended Project Structure
```
packages/api/src/services/
  messaging/
    types.ts                    # MessagingProvider interface
    slack-messaging-provider.ts # Extracted from slack-client.ts
    teams-messaging-provider.ts # New Teams implementation
    index.ts                    # Provider registry/factory
  teams/
    cards/
      approval-card.ts          # Adaptive Card JSON builder
      approval-result-card.ts   # Post-action card replacement
      activity-alert-card.ts    # Channel notification card
      approval-reminder-card.ts # DM reminder with actions
    teams-bot-handler.ts        # TeamsActivityHandler subclass
    teams-graph-client.ts       # Graph API wrapper (channels, users)

packages/integrations/src/adapters/
  teams-adapter.ts              # BaseAdapter extension for OAuth + health

apps/web/src/app/api/teams/
  messages/route.ts             # Bot Framework messaging endpoint (CloudAdapter.process)

apps/web/src/components/integrations/
  teams-provider-section.tsx    # Provider card + channel mapping UI
  teams-logo.tsx                # SiMicrosoftteams brand icon
  teams-channel-mapping-card.tsx # Channel-to-notification-type config
```

### Pattern 1: MessagingProvider Interface (D-01)
**What:** Abstract interface for multi-platform messaging dispatch
**When to use:** Any notification that needs to go to Slack, Teams, or future platforms
**Example:**
```typescript
// packages/api/src/services/messaging/types.ts
export interface MessagingProvider {
  readonly platform: "slack" | "teams";

  sendApprovalCard(params: ApprovalCardParams): Promise<void>;
  sendReminderDM(params: ReminderDMParams): Promise<void>;
  sendChannelAlert(params: ChannelAlertParams): Promise<void>;
  getUserId(organizationId: string, userId: string): Promise<string | null>;
}

export interface ApprovalCardParams {
  organizationId: string;
  recipientId: string; // platform-specific user/channel ID
  invoiceNumber: string;
  contractorName: string;
  amount: string;
  currency: string;
  dueDate: string;
  invoiceId: string;
  flowId: string;
}
```

### Pattern 2: Bot Framework in Next.js API Route
**What:** CloudAdapter + TeamsActivityHandler as a Next.js API route
**When to use:** Handling all inbound Teams bot activities (card actions, conversation updates)
**Example:**
```typescript
// apps/web/src/app/api/teams/messages/route.ts
import { CloudAdapter, ConfigurationBotFrameworkAuthentication } from "botbuilder";
import { TeamsBotHandler } from "@contractor-ops/api/services/teams/teams-bot-handler";

const auth = new ConfigurationBotFrameworkAuthentication({
  MicrosoftAppId: process.env.AZURE_BOT_APP_ID,
  MicrosoftAppPassword: process.env.AZURE_BOT_APP_SECRET,
  MicrosoftAppType: "MultiTenant",
});

const adapter = new CloudAdapter(auth);
const bot = new TeamsBotHandler();

export async function POST(request: Request) {
  const body = await request.json();
  const headers = Object.fromEntries(request.headers.entries());

  // CloudAdapter.process expects Node.js-style req/res
  // We need to adapt Next.js Request to the expected interface
  // See "Common Pitfalls" section for details
  await adapter.process(adaptedReq, adaptedRes, (context) => bot.run(context));

  return new Response(JSON.stringify(responseBody), {
    status: responseStatus,
    headers: { "Content-Type": "application/json" },
  });
}
```

### Pattern 3: Proactive Messaging with Stored ConversationReferences (D-13, TEAM-06)
**What:** Store ConversationReference when bot is installed or user first interacts; use for proactive DMs later
**When to use:** Approval reminders, activity alerts to channels
**Example:**
```typescript
// In TeamsActivityHandler.onConversationUpdate or onMembersAdded:
const ref = TurnContext.getConversationReference(context.activity);
// Store in configJson keyed by user's aadObjectId
await storeConversationReference(organizationId, ref);

// Later, for proactive messaging:
await adapter.continueConversation(storedRef, async (turnContext) => {
  await turnContext.sendActivity({
    type: "message",
    attachments: [CardFactory.adaptiveCard(approvalCardJson)],
  });
});
```

### Pattern 4: Adaptive Card with Task Module for Reject (D-05)
**What:** Approve uses direct Action.Submit; Reject uses Action.Submit with msteams.type = "task/fetch" to open a modal
**When to use:** Any card action that requires additional user input
**Example:**
```typescript
// Approval card actions array:
{
  type: "ActionSet",
  actions: [
    {
      type: "Action.Submit",
      title: "Approve",
      style: "positive",
      data: {
        action: "approve_invoice",
        invoiceId: params.invoiceId,
        flowId: params.flowId,
      },
    },
    {
      type: "Action.Submit",
      title: "Reject",
      style: "destructive",
      data: {
        msteams: { type: "task/fetch" },
        action: "reject_invoice",
        invoiceId: params.invoiceId,
        flowId: params.flowId,
      },
    },
  ],
}
```

### Pattern 5: Notification Dispatch Refactor (D-03)
**What:** dispatch() iterates all connected messaging providers instead of calling Slack directly
**When to use:** Central notification dispatch in notification-service.ts
**Example:**
```typescript
// In dispatch(), replace direct Slack call with provider iteration:
const providers = await getConnectedMessagingProviders(event.organizationId);
for (const provider of providers) {
  const prefKey = provider.platform === "slack" ? "channelSlack" : "channelTeams";
  if (prefs[prefKey]) {
    try {
      // Delegate to provider-specific implementation
      if (event.type === "APPROVAL_REQUEST") {
        await provider.sendApprovalCard({ ... });
      } else {
        await provider.sendReminderDM({ ... });
      }
    } catch (error) {
      console.error(`[notification-service] ${provider.platform} failed:`, error);
    }
  }
}
```

### Anti-Patterns to Avoid
- **Direct Bot Framework dependency in notification-service.ts:** Keep bot framework imports in teams-messaging-provider.ts only; notification service uses the MessagingProvider interface
- **Storing ConversationReferences in separate DB table:** Use configJson on IntegrationConnection per D-13; no new schema needed
- **Using BotFrameworkAdapter:** Deprecated -- use CloudAdapter with ConfigurationBotFrameworkAuthentication
- **Hardcoding Adaptive Card JSON inline:** Extract to card builder functions in separate files for testability and reuse

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bot authentication | Custom JWT verification for Teams activities | CloudAdapter built-in auth | Bot Framework handles Teams token validation, App ID verification |
| Adaptive Card rendering | Custom card HTML/CSS | Adaptive Card JSON schema | Teams renders cards natively; just send conformant JSON |
| Graph API token management | Manual OAuth token refresh for Graph | @azure/identity ClientSecretCredential | Handles token caching, refresh, and retry |
| Proactive messaging plumbing | Custom conversation creation | adapter.continueConversation() | Handles service URL routing, authentication headers |
| Task module (modal) lifecycle | Custom modal state management | handleTeamsTaskModuleFetch/Submit | Bot Framework handles the invoke/response cycle |

**Key insight:** The Bot Framework handles the hardest parts (authentication, service URL routing, conversation management). The custom code should focus on business logic (approval flow advancement) and card templates.

## Common Pitfalls

### Pitfall 1: CloudAdapter.process() expects Node.js IncomingMessage/ServerResponse
**What goes wrong:** CloudAdapter.process() expects Express-style req/res objects, not Next.js Request/Response
**Why it happens:** Bot Framework SDK was built for Express; Next.js API routes use Web API Request
**How to avoid:** Create a shim that adapts Next.js Request to the expected interface. The adapter needs `req.body`, `req.headers`, and `res.status().send()` patterns. Use a readable stream wrapper or buffer the body.
**Warning signs:** TypeError on process() call, "body is not readable" errors

### Pitfall 2: ConversationReference must be captured proactively
**What goes wrong:** Bot cannot send proactive messages because no ConversationReference exists
**Why it happens:** ConversationReferences are only available during an active turn (when the user/bot interacts); they must be stored for later use
**How to avoid:** Capture and store references in `onConversationUpdate` (when bot is added to team/chat) and in `onMembersAdded`. Store in configJson keyed by user's aadObjectId.
**Warning signs:** "Conversation not found" errors when sending proactive messages

### Pitfall 3: Adaptive Card schema version compatibility
**What goes wrong:** Cards don't render or lose interactivity in Teams
**Why it happens:** Using schema version 1.5 features without checking Teams client support; or using too-old schema version
**How to avoid:** Use Adaptive Card schema version 1.4 for maximum Teams compatibility. Version 1.5 adds Universal Actions but may not work on all Teams clients.
**Warning signs:** Cards render as plain text, action buttons missing

### Pitfall 4: Task module (modal) requires specific data structure
**What goes wrong:** Clicking "Reject" doesn't open the modal dialog
**Why it happens:** The `msteams.type: "task/fetch"` must be in the `data` property of `Action.Submit`, and the bot must implement `handleTeamsTaskModuleFetch()` to return the modal card
**How to avoid:** Include `data: { msteams: { type: "task/fetch" }, ...customData }` in the reject button's Action.Submit. Implement both `handleTeamsTaskModuleFetch()` (return modal) and `handleTeamsTaskModuleSubmit()` (process result).
**Warning signs:** Button click does nothing, or returns a generic error

### Pitfall 5: Card update after action requires activity ID
**What goes wrong:** Can't update the original card in-place after approve/reject
**Why it happens:** To update an existing card, you need the original activity ID (from context.activity.replyToId)
**How to avoid:** In the Action.Submit handler, use `context.updateActivity()` with the updated card JSON and the original activity's `replyToId`. For proactive messages, store the activity ID when the card is first sent.
**Warning signs:** New message posted instead of card update, or "activity not found" error

### Pitfall 6: IntegrationProvider enum needs MICROSOFT_TEAMS value
**What goes wrong:** Prisma schema doesn't have a matching enum value for the Teams adapter
**Why it happens:** Current enum has MICROSOFT_365 (for general Microsoft integration) but not MICROSOFT_TEAMS specifically
**How to avoid:** Add `MICROSOFT_TEAMS` to the IntegrationProvider enum in integration.prisma. Adapter slug should be `microsoft_teams` (underscore, per Phase 31 convention) so `toUpperCase()` maps correctly.
**Warning signs:** Prisma validation error on connection creation

### Pitfall 7: Multi-tenant bot registration deprecation
**What goes wrong:** New multi-tenant bot registrations may be restricted
**Why it happens:** Microsoft deprecated new multi-tenant bot registrations after July 31, 2025
**How to avoid:** Check Azure Bot Service registration options at implementation time. May need to use single-tenant or managed identity configuration. Document the exact registration steps in USER-SETUP.md.
**Warning signs:** Azure portal doesn't offer multi-tenant option for new bots

## Code Examples

### Adaptive Card JSON: Approval Request (D-06)
```typescript
// packages/api/src/services/teams/cards/approval-card.ts
export function buildApprovalCard(params: {
  invoiceNumber: string;
  contractorName: string;
  amount: string;
  currency: string;
  dueDate: string;
  invoiceId: string;
  flowId: string;
}): Record<string, unknown> {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body: [
      {
        type: "TextBlock",
        text: "Invoice Approval Required",
        weight: "Bolder",
        size: "Medium",
      },
      {
        type: "FactSet",
        facts: [
          { title: "Invoice:", value: params.invoiceNumber },
          { title: "Contractor:", value: params.contractorName },
          { title: "Amount:", value: `${params.amount} ${params.currency}` },
          { title: "Due date:", value: params.dueDate },
        ],
      },
    ],
    actions: [
      {
        type: "Action.Submit",
        title: "Approve",
        style: "positive",
        data: {
          action: "approve_invoice",
          invoiceId: params.invoiceId,
          flowId: params.flowId,
        },
      },
      {
        type: "Action.Submit",
        title: "Reject",
        style: "destructive",
        data: {
          msteams: { type: "task/fetch" },
          action: "reject_invoice",
          invoiceId: params.invoiceId,
          flowId: params.flowId,
        },
      },
    ],
  };
}
```

### TeamsActivityHandler: Handling Card Actions (TEAM-04)
```typescript
// packages/api/src/services/teams/teams-bot-handler.ts
import { TeamsActivityHandler, CardFactory, TurnContext } from "botbuilder";

export class TeamsBotHandler extends TeamsActivityHandler {
  // Handle approve Action.Submit
  async onAdaptiveCardInvoke(context: TurnContext, invokeValue: any) {
    const { action, invoiceId, flowId } = invokeValue;

    if (action === "approve_invoice") {
      // Process approval via approval-engine
      await processApproval(context, invoiceId, flowId);
      // Return updated card
      return {
        statusCode: 200,
        type: "application/vnd.microsoft.card.adaptive",
        value: buildApprovalResultCard({ result: "approved", ... }),
      };
    }

    return { statusCode: 200 };
  }

  // Handle reject task/fetch (return modal)
  async handleTeamsTaskModuleFetch(context: TurnContext, taskModuleRequest: any) {
    const { invoiceId, flowId } = taskModuleRequest.data;
    return {
      task: {
        type: "continue",
        value: {
          title: "Reject Invoice",
          card: CardFactory.adaptiveCard(buildRejectModalCard(invoiceId, flowId)),
          width: "medium",
          height: "small",
        },
      },
    };
  }

  // Handle reject modal submission
  async handleTeamsTaskModuleSubmit(context: TurnContext, taskModuleRequest: any) {
    const { invoiceId, flowId, comment } = taskModuleRequest.data;
    await processRejection(context, invoiceId, flowId, comment);
    // Return null to close the modal
    return null;
  }

  // Capture ConversationReferences (TEAM-06)
  async onConversationUpdateActivity(context: TurnContext) {
    const ref = TurnContext.getConversationReference(context.activity);
    await storeConversationReference(ref);
    return super.onConversationUpdateActivity(context);
  }
}
```

### Graph API: Channel Discovery (TEAM-02)
```typescript
// packages/api/src/services/teams/teams-graph-client.ts
import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import { TokenCredentialAuthenticationProvider } from
  "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";

export async function getTeamsChannels(
  tenantId: string,
  teamId: string,
): Promise<Array<{ id: string; displayName: string }>> {
  const credential = new ClientSecretCredential(
    tenantId,
    process.env.AZURE_BOT_APP_ID!,
    process.env.AZURE_BOT_APP_SECRET!,
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });

  const client = Client.initWithMiddleware({ authProvider });

  const response = await client
    .api(`/teams/${teamId}/channels`)
    .select("id,displayName")
    .get();

  return response.value;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BotFrameworkAdapter | CloudAdapter | SDK v4.14+ (2023) | Must use CloudAdapter; BotFrameworkAdapter is deprecated |
| Bot Framework SDK (botbuilder) | Microsoft 365 Agents SDK | Dec 2025 | BF SDK archived; Agents SDK JS is pre-1.0, not production-ready; use botbuilder for now |
| Adaptive Cards v1.2 | Adaptive Cards v1.4-1.5 | 2023-2024 | v1.4 recommended for Teams compatibility; v1.5 adds Universal Actions but limited client support |
| TeamsFx SDK | M365 Agents Toolkit | Sep 2025 | TeamsFx deprecated; not relevant since we use raw botbuilder |

**Deprecated/outdated:**
- `BotFrameworkAdapter`: Replaced by `CloudAdapter` -- deprecated since v4.14
- `botbuilder-teams` (old npm package): Merged into `botbuilder` core -- do not install separately
- Multi-tenant bot registration (Azure portal): New registrations deprecated Jul 2025 -- check current options

## Open Questions

1. **CloudAdapter + Next.js Request/Response compatibility**
   - What we know: CloudAdapter.process() expects Node.js IncomingMessage/ServerResponse
   - What's unclear: Exact shim implementation for Next.js App Router API routes
   - Recommendation: Build a minimal adapter shim; test early in implementation. Alternative: use the lower-level `adapter.processActivity()` which accepts a raw Activity object

2. **Multi-tenant vs single-tenant bot registration**
   - What we know: Microsoft deprecated new multi-tenant registrations after Jul 2025
   - What's unclear: Whether existing multi-tenant registrations still work, or if single-tenant is now required
   - Recommendation: Document both options in USER-SETUP.md; prefer single-tenant if multi-tenant is blocked

3. **Azure AD OAuth scopes for bot + Graph API**
   - What we know: Bot needs app permissions for Graph API (Team.ReadBasic.All, Channel.ReadBasic.All); bot messaging uses its own auth
   - What's unclear: Exact minimum scope set; whether delegated or application permissions are needed for channel listing
   - Recommendation: Use application permissions (client credentials flow) for Graph API channel discovery; bot messaging auth is separate (handled by Bot Framework)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Assumed | 20+ | -- |
| npm/pnpm | Package install | Assumed | -- | -- |
| Azure Bot Service registration | Bot messaging | External setup | -- | None -- required; USER-SETUP.md |
| Microsoft Graph API | Channel discovery | External API | v1.0 | None -- required |

**Missing dependencies with no fallback:**
- Azure Bot Service registration must be configured manually before bot can function
- Azure AD app registration with appropriate API permissions

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (already configured) |
| Config file | packages/api/vitest.config.ts |
| Quick run command | `cd packages/api && pnpm test -- --run` |
| Full suite command | `cd packages/api && pnpm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEAM-01 | TeamsAdapter OAuth config, token exchange | unit | `cd packages/integrations && pnpm test -- --run src/__tests__/teams-adapter.test.ts` | Wave 0 |
| TEAM-02 | Channel mapping CRUD in configJson | unit | `cd packages/api && pnpm test -- --run src/routers/__tests__/teams.test.ts` | Wave 0 |
| TEAM-03 | Activity alert card builder output | unit | `cd packages/api && pnpm test -- --run src/services/teams/__tests__/cards.test.ts` | Wave 0 |
| TEAM-04 | Approve/reject card action processing | unit | `cd packages/api && pnpm test -- --run src/services/teams/__tests__/teams-bot-handler.test.ts` | Wave 0 |
| TEAM-05 | Reminder DM dispatch with MessagingProvider | unit | `cd packages/api && pnpm test -- --run src/services/__tests__/notification-service.test.ts` | Wave 0 |
| TEAM-06 | ConversationReference storage/retrieval | unit | `cd packages/api && pnpm test -- --run src/services/teams/__tests__/conversation-ref.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/api && pnpm test -- --run`
- **Per wave merge:** `cd packages/api && pnpm test && cd ../../packages/integrations && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/api/src/services/messaging/__tests__/messaging-provider.test.ts` -- covers MessagingProvider interface + dispatch refactor
- [ ] `packages/api/src/services/teams/__tests__/cards.test.ts` -- covers TEAM-03, TEAM-04 card builders
- [ ] `packages/api/src/services/teams/__tests__/teams-bot-handler.test.ts` -- covers TEAM-04 action handling
- [ ] `packages/api/src/services/teams/__tests__/conversation-ref.test.ts` -- covers TEAM-06
- [ ] `packages/integrations/src/__tests__/teams-adapter.test.ts` -- covers TEAM-01 OAuth + health
- [ ] `packages/api/src/routers/__tests__/teams.test.ts` -- covers TEAM-02 channel mapping tRPC

## Sources

### Primary (HIGH confidence)
- Existing codebase: BaseAdapter, SlackAdapter, LinearAdapter, notification-service.ts, slack-client.ts -- direct code inspection
- Existing codebase: integration.prisma, notification.prisma schema -- direct code inspection
- npm registry: botbuilder 4.23.3, @microsoft/agents-hosting 1.4.2, @microsoft/agents-hosting-teams 0.4.3 -- version checks

### Secondary (MEDIUM confidence)
- [Microsoft Learn: Send proactive messages](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/send-proactive-messages) -- proactive messaging patterns
- [Microsoft Learn: Use dialogs in Teams bots](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/task-modules/task-modules-bots) -- task module implementation
- [Microsoft Learn: Add card actions in a bot](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/cards-actions) -- Adaptive Card action types
- [Microsoft Learn: CloudAdapter class](https://learn.microsoft.com/en-us/javascript/api/botbuilder/cloudadapter) -- CloudAdapter API reference
- [Microsoft Learn: Bot Framework to Agents SDK migration](https://learn.microsoft.com/en-us/microsoft-365/agents-sdk/bf-migration-nodejs) -- SDK lifecycle context
- [Microsoft Learn: List channels Graph API](https://learn.microsoft.com/en-us/graph/api/channel-list) -- Graph API for channel discovery
- [GitHub: botbuilder-js TeamsActivityHandler](https://github.com/microsoft/botbuilder-js/blob/main/libraries/botbuilder/src/teamsActivityHandler.ts) -- handler method signatures

### Tertiary (LOW confidence)
- [Microsoft Q&A: Multi-tenant bot deprecation](https://learn.microsoft.com/en-us/answers/questions/5680460/) -- Jul 2025 multi-tenant restriction
- Community posts on CloudAdapter + Next.js integration -- limited examples exist

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - botbuilder v4 is functional but archived; Agents SDK not yet viable; confident in the pragmatic choice
- Architecture: HIGH - directly maps to existing adapter framework patterns in the codebase
- Pitfalls: MEDIUM - CloudAdapter/Next.js integration and multi-tenant registration require validation during implementation

**Research date:** 2026-04-04
**Valid until:** 2026-04-18 (Bot Framework SDK is stable/archived; Agents SDK evolving fast)
