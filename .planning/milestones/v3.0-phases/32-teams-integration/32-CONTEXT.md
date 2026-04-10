# Phase 32: Teams Integration - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Organizations using Microsoft Teams can receive activity alerts in configured channels and approve/reject invoices directly from Teams Adaptive Cards. Proactive DM reminders nudge approvers with overdue items. This mirrors the Slack integration's functionality using Microsoft's Bot Framework and Adaptive Cards instead of Block Kit. Does NOT include Teams-based onboarding, file sharing, or meeting scheduling.

</domain>

<decisions>
## Implementation Decisions

### Messaging abstraction
- **D-01:** Extract a `MessagingProvider` interface from the existing Slack-hardcoded notification service. Interface methods: `sendApprovalCard()`, `sendReminderDM()`, `sendChannelAlert()`, `getUserId()`. Both Slack and Teams implement this interface.
- **D-02:** Refactor happens within Phase 32 (first plan: extract interface + refactor Slack, second plan: add Teams implementation). No separate prerequisite phase.
- **D-03:** `dispatch()` iterates all connected messaging providers for each notification. `UserNotificationPreference` gets a `channelTeams` boolean column alongside existing `channelSlack`.
- **D-04:** Slack and Teams can be connected simultaneously. Different users in the same org can use different platforms. No mutual exclusion.

### Adaptive Card design
- **D-05:** Approval cards use `Action.Submit` for approve (direct submit) and reject (opens task module/modal dialog for mandatory comment). Card updates in-place after action to show result with approver name.
- **D-06:** Approval card shows: invoice number, contractor name, amount with currency, due date. After action: status icon, approver name, invoice reference, amount.
- **D-07:** Activity alert cards are compact Adaptive Cards: event icon, title, 2-3 key details, and a "View in Contractor Ops" OpenUrl button. Non-interactive — just awareness.
- **D-08:** Approval reminder DMs are full Adaptive Cards with approve/reject action buttons — approver can act directly from the reminder without opening the web app. Shows overdue duration.

### Channel configuration UX
- **D-09:** Per-notification-type channel mapping. Admin picks a Teams channel for each notification category (approvals, invoices, contracts, tasks, equipment). Stored in `IntegrationConnection.configJson`.
- **D-10:** Bot fetches available channels via Graph API after OAuth connection. Dropdown shows channels where bot is installed. Refresh button to re-fetch if teams/channels change.

### Bot registration & auth
- **D-11:** Azure Bot Service registration handled via USER-SETUP.md with step-by-step instructions. Code expects `AZURE_BOT_APP_ID` and `AZURE_BOT_APP_SECRET` env vars. Health check reports unconnected until configured.
- **D-12:** `TeamsAdapter` extends `BaseAdapter` following the same provider adapter pattern as Slack, Jira, Linear, Google Workspace. OAuth via Azure AD, credentials in `IntegrationConnection`, health check via Graph API.
- **D-13:** ConversationReferences for proactive messaging stored in `IntegrationConnection.configJson` — follows the same pattern as Linear status mappings and Google sync state.

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Notification service (refactor target)
- `packages/api/src/services/notification-service.ts` — Current hardcoded Slack dispatch, refactor to MessagingProvider pattern
- `packages/api/src/services/slack-client.ts` — Current Slack implementation to extract into MessagingProvider
- `packages/api/src/services/email-templates.ts` — Email template patterns (reference for card content structure)

### Integration framework (adapter pattern to follow)
- `packages/integrations/src/adapters/base-adapter.ts` — Base class TeamsAdapter extends
- `packages/integrations/src/types/provider.ts` — IntegrationProviderAdapter interface
- `packages/integrations/src/registry.ts` — Provider registry for TeamsAdapter registration
- `packages/integrations/services/credential-service.ts` — AES-256-GCM credential encryption

### Existing Slack integration (parallel to replicate)
- `packages/api/src/routers/notification.ts` — Notification tRPC router
- `apps/web/src/components/settings/integrations-tab.tsx` — Settings tab where Teams section goes
- `apps/web/src/components/settings/provider-connection-card.tsx` — Standard connection card component

### Webhook/bot endpoint pattern
- `apps/web/src/app/api/webhooks/[provider]/route.ts` — Unified webhook ingestion
- `apps/web/src/app/api/webhooks/_process/route.ts` — QStash async processing

### Database models
- `packages/db/prisma/schema/integration.prisma` — IntegrationConnection, configJson storage
- `packages/db/prisma/schema/notification.prisma` — Notification, UserNotificationPreference (needs channelTeams column)

### Prior phase context
- `.planning/phases/07-notifications-slack/07-CONTEXT.md` — Slack integration decisions, notification dispatch architecture
- `.planning/phases/29-linear-integration/29-CONTEXT.md` — Recent adapter pattern implementation, configJson usage

### Requirements
- `.planning/REQUIREMENTS.md` — TEAM-01 through TEAM-06

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BaseAdapter` class: OAuth flow, token refresh, health status — TeamsAdapter extends this
- `ProviderConnectionCard`: Standard connection UI with status badges — reuse for Teams
- `IntegrationConnection.configJson`: Already stores per-provider config (Linear status mappings, Google sync state) — use for channel routing and ConversationReferences
- `notification-service.ts dispatch()`: Central dispatch loop — refactor target for MessagingProvider
- `slack-client.ts`: Slack-specific methods — extract into SlackMessagingProvider

### Established Patterns
- Provider adapter pattern: stateless adapters, state in IntegrationConnection
- OAuth callback at `/api/oauth/[provider]/callback` — automatic routing by slug
- Webhook ingestion at `/api/webhooks/[provider]` — automatic routing by slug
- `UserNotificationPreference`: per-user per-type per-channel toggles — add channelTeams
- Fire-and-forget for messaging: `void sendSlackDM().catch()` pattern — same for Teams
- Auto-match users by email for messaging platforms (Slack precedent)
- Provider section components in `apps/web/src/components/integrations/` with i18n

### Integration Points
- `notification-service.ts` — Refactor to use MessagingProvider interface
- `registerAllAdapters()` — Add TeamsAdapter registration
- Integrations settings tab — Add Teams provider section with channel routing config
- `UserNotificationPreference` schema — Add `channelTeams` column
- `.env.example` — Add `AZURE_BOT_APP_ID`, `AZURE_BOT_APP_SECRET`, `TEAMS_ENCRYPTION_KEY`
- Bot messaging endpoint — New route for Teams bot activity handler (card actions, proactive messaging)

</code_context>

<specifics>
## Specific Ideas

- Approval cards should mirror the Slack Block Kit experience — approve with one click, reject opens modal for mandatory comment, card updates in-place to show result
- Per-type channel routing gives admins control over noise — approvals in #approvals, invoices in #finance, tasks in #ops
- Reminder DMs with actionable approve/reject buttons are the key differentiator — approver never needs to leave Teams for routine approvals
- MessagingProvider abstraction future-proofs for any additional messaging platform (Discord, WhatsApp Business, etc.)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 32-teams-integration*
*Context gathered: 2026-04-03*
