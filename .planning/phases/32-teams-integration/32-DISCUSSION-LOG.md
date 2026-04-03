# Phase 32: Teams Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 32-teams-integration
**Areas discussed:** Messaging abstraction, Adaptive Card design, Channel configuration UX, Bot registration & auth

---

## Messaging Abstraction

| Option | Description | Selected |
|--------|-------------|----------|
| MessagingProvider interface | Extract interface (sendApprovalCard, sendReminderDM, sendChannelAlert, getUserId). Slack and Teams both implement it. dispatch() iterates connected providers. | ✓ |
| Add Teams alongside Slack (minimal) | Keep Slack code as-is. Add sendTeamsDM() and channelTeams. Duplicates pattern. | |
| You decide | Claude picks based on codebase patterns. | |

**User's choice:** MessagingProvider interface
**Notes:** None

### Refactor timing

| Option | Description | Selected |
|--------|-------------|----------|
| Within Phase 32 | First plan extracts interface + refactors Slack. Second plan adds Teams. | ✓ |
| Separate prerequisite phase | Insert 31.5 or 32.0 for refactor. More isolation but adds overhead. | |
| You decide | | |

**User's choice:** Within Phase 32

### Coexistence

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, both simultaneously | Independent channelSlack + channelTeams toggles. Different users can use different platforms. | ✓ |
| Mutually exclusive | Org picks Slack OR Teams. Connecting one disconnects other. | |
| You decide | | |

**User's choice:** Yes, both simultaneously

---

## Adaptive Card Design

### Approval card interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Action.Submit with task module | Approve submits directly. Reject opens task module for mandatory comment. Card updates in-place. | ✓ |
| Action.Submit only (simpler) | Both are simple submits. Reject reason via inline Input.Text always visible. | |
| You decide | | |

**User's choice:** Action.Submit with task module

### Activity alert cards

| Option | Description | Selected |
|--------|-------------|----------|
| Summary card with link | Compact Adaptive Card: icon, title, 2-3 details, "View in Contractor Ops" button. Non-interactive. | ✓ |
| Plain text message | Simple text with link. Less visual. | |
| You decide | | |

**User's choice:** Summary card with link

### Reminder DMs

| Option | Description | Selected |
|--------|-------------|----------|
| Adaptive Card with action | Full approval card with approve/reject buttons in DM. Approver acts directly from reminder. | ✓ |
| Plain text with link | Simple text reminder with link to web app. | |

**User's choice:** Adaptive Card with action

---

## Channel Configuration UX

### Routing model

| Option | Description | Selected |
|--------|-------------|----------|
| Per-type channel mapping | Admin picks channel for each notification category. Different events to different channels. | ✓ |
| Single channel for all | One channel for everything. Simpler but noisy. | |
| You decide | | |

**User's choice:** Per-type channel mapping

### Channel discovery

| Option | Description | Selected |
|--------|-------------|----------|
| Bot fetches channels on connect | Query Graph API for channels where bot is installed. Dropdown + refresh button. | ✓ |
| Manual channel ID entry | Admin copies/pastes channel IDs. No API call needed. | |
| You decide | | |

**User's choice:** Bot fetches channels on connect

---

## Bot Registration & Auth

### Registration dependency

| Option | Description | Selected |
|--------|-------------|----------|
| Env vars + USER-SETUP.md | Step-by-step Azure Bot registration instructions. Code expects env vars. Health check reports unconnected until configured. | ✓ |
| Skip bot, use webhooks only | Incoming webhooks only. Can't do DMs or interactive cards. | |
| You decide | | |

**User's choice:** Env vars + USER-SETUP.md

### Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| TeamsAdapter extends BaseAdapter | Same pattern as Slack, Jira, Linear, Google Workspace. Consistent architecture. | ✓ |
| Standalone Teams client | Separate teams-client.ts without adapter pattern. More pragmatic but inconsistent. | |
| You decide | | |

**User's choice:** TeamsAdapter extends BaseAdapter

### ConversationReference storage

| Option | Description | Selected |
|--------|-------------|----------|
| IntegrationConnection.configJson | Same pattern as Linear status mappings and Google sync state. | ✓ |
| Dedicated Prisma model | New TeamsConversationRef model. More structured but adds migration. | |
| You decide | | |

**User's choice:** IntegrationConnection.configJson

---

## Claude's Discretion

- Adaptive Card JSON template structure and styling
- Bot Framework SDK version and configuration
- Azure AD OAuth scope selection
- Graph API queries for team/channel discovery
- ConversationReference serialization format
- Error handling for Teams API rate limits
- User-to-Teams mapping mechanism
- Task module implementation for reject comment
- Teams provider section UI layout

## Deferred Ideas

None
