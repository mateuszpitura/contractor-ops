# Phase 29: Linear Integration - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Bidirectional issue sync between workflow tasks and Linear. Admin connects Linear workspace via OAuth, configures per-team status mapping, and workflow tasks auto-create/sync Linear issues. This mirrors the existing Jira integration pattern using the same adapter framework. Does NOT include time tracking import (Clockify handles both Jira and Linear) or Linear notifications.

</domain>

<decisions>
## Implementation Decisions

### Status mapping UX
- **D-01:** Per-team mapping dialog, matching Jira's per-project approach. Admin opens dialog for each Linear team and maps Linear workflow states to internal task statuses (TODO, IN_PROGRESS, DONE, BLOCKED, SKIPPED, CANCELLED)
- **D-02:** Dialog pre-populates smart defaults based on Linear state names (e.g., "Done" -> DONE, "In Progress" -> IN_PROGRESS, "Backlog" -> TODO). Admin reviews and adjusts
- **D-03:** Status mapping is required at connection time — after OAuth, admin picks teams to sync and maps statuses immediately before bidirectional sync activates
- **D-04:** Unmapped Linear states are ignored silently — state changes logged in webhook delivery records but don't update workflow tasks. Admin can map them later via the dialog

### Issue creation defaults
- **D-05:** Target Linear team is configured per-workflow template during workflow setup. All tasks from that workflow go to the same Linear team
- **D-06:** Auto-created issues include title (from task name) and description (from task description) only — no labels, priority, project, cycle, or estimate. Teams triage in Linear
- **D-07:** Assignee matched by email — if workflow task has an assignee, look up their Linear account by email and assign. Falls back to unassigned if no email match found

### Linked issue chip
- **D-08:** Chip displays issue identifier (e.g., "ENG-123") with a colored status dot — compact and scannable, matching Jira chip pattern. Clicking opens Linear issue in new tab
- **D-09:** Chip uses Linear purple accent tint/icon — instantly recognizable as a Linear link, distinct from Jira's blue chip. Follows the same provider-branded approach

### Settings placement
- **D-10:** Linear gets its own section in integrations settings tab, matching Jira's treatment — connection card + status mapping button. Both are bidirectional PM tools with complex config
- **D-11:** Jira and Linear can coexist — both connected simultaneously. Different workflow templates can target either tool. No mutual exclusion

### Claude's Discretion
- Linear OAuth scope selection and token refresh implementation
- Webhook signature verification approach (Linear uses HMAC)
- Exact smart-default mapping algorithm for status names
- Linear GraphQL API query structure for issue CRUD and status transitions
- Loop prevention timing (dedup window, suppression duration) — follow Jira's 30s/5s pattern unless Linear's webhook latency differs
- Linear team/workspace discovery flow during OAuth callback
- Error handling for Linear API rate limits

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Integration framework (adapter pattern to follow)
- `packages/integrations/src/adapters/jira-adapter.ts` — Template adapter: OAuth, webhook verification, health status, cloud ID discovery
- `packages/integrations/src/adapters/base-adapter.ts` — Base class all adapters extend
- `packages/integrations/src/types/provider.ts` — IntegrationProviderAdapter interface to implement
- `packages/integrations/src/registry.ts` — Provider registry where Linear adapter must be registered
- `packages/integrations/services/credential-service.ts` — AES-256-GCM credential encryption

### Bidirectional sync (pattern to replicate)
- `packages/api/src/services/jira-webhook-handler.ts` — Inbound sync: webhook -> task status update
- `packages/api/src/services/jira-issue-sync.ts` — Outbound sync: task change -> Jira issue update
- `packages/api/src/services/jira-status-mapping.ts` — Status mapping service with reverse lookup

### Webhook pipeline
- `apps/web/src/app/api/webhooks/[provider]/route.ts` — Unified webhook ingestion
- `apps/web/src/app/api/webhooks/_process/route.ts` — QStash async processing callback

### Database models
- `packages/db/prisma/schema/integration.prisma` — ExternalLink model, IntegrationConnection, WebhookDelivery

### UI components (to replicate/extend)
- `apps/web/src/components/settings/integrations-tab.tsx` — Settings tab where Linear section goes
- `apps/web/src/components/integrations/jira-provider-section.tsx` — Jira section pattern (connection card + mapping button)
- `apps/web/src/components/integrations/jira-status-mapping-dialog.tsx` — Status mapping dialog to replicate for Linear teams
- `apps/web/src/components/integrations/jira-issue-chip.tsx` — Issue chip pattern to replicate with Linear branding
- `apps/web/src/components/settings/provider-connection-card.tsx` — Standard connection card component
- `apps/web/src/components/settings/provider-detail-sheet.tsx` — Detail sheet with sync/webhook logs

### Requirements
- `.planning/REQUIREMENTS.md` — LIN-01 through LIN-06

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BaseAdapter` class: OAuth flow, token refresh, health status — Linear adapter extends this
- `ProviderConnectionCard`: Standard connection UI with status badges — used for Linear's card
- `ProviderDetailSheet`: Sync log + webhook log tables with cursor pagination — works for Linear out of the box
- `ExternalLink` model: Already supports arbitrary `externalType` — use "LINEAR_ISSUE" alongside existing "JIRA_ISSUE"
- Credential encryption: Per-provider key pattern — add `LINEAR_ENCRYPTION_KEY` env var
- QStash webhook pipeline: Fire-and-forget processing — Linear webhooks use same path

### Established Patterns
- Provider adapter pattern: stateless adapters, all state in IntegrationConnection (credentials, configJson, status)
- Bidirectional sync with `lastSyncOrigin` field in ExternalLink metadata for loop prevention
- OAuth callback at `/api/oauth/[provider]/callback` — automatic routing by slug
- Webhook ingestion at `/api/webhooks/[provider]` — automatic routing by slug
- Status mapping stored in `IntegrationConnection.configJson.statusMappings[teamId]`
- Integration health via `trpc.integration.getHealth({ provider })`

### Integration Points
- `registerAllAdapters()` — add Linear adapter registration
- Integrations settings tab — add Linear provider section
- Workflow template configuration — add Linear team selector (parallel to existing Jira project selector)
- Workflow task execution hooks — trigger Linear issue creation on task start
- Task status change handler — trigger outbound sync to Linear

</code_context>

<specifics>
## Specific Ideas

No specific requirements — follow the established Jira adapter pattern throughout. The goal is that Linear users get the same bidirectional sync experience Jira users already have.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 29-linear-integration*
*Context gathered: 2026-04-02*
