# Phase 19: Jira Integration - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Workflow tasks and Jira issues stay synchronized so teams don't maintain two systems manually. Admin connects Jira Cloud, configures project/issue type mapping per workflow task template, and enables bidirectional status sync. Linked Jira issues display as clickable chips on workflow and contractor views. Extends the existing Jira OAuth from Phase 18 (worklog-only) to full issue lifecycle. Does not include Jira project/board management, sprint planning, or Jira-side automation rules.

</domain>

<decisions>
## Implementation Decisions

### Issue creation trigger
- **D-01:** Per-task template configuration — admin marks specific WorkflowTaskTemplate entries as "Create Jira issue on activation". Only configured tasks create issues; others are unaffected
- **D-02:** Each task template has its own Jira project + issue type mapping stored in configJson. Granular control — different tasks in the same workflow can target different Jira projects
- **D-03:** Jira OAuth scopes must be expanded from current read:jira-work to include write:jira-work for issue creation and status transitions

### Status mapping
- **D-04:** Admin-configurable mapping table per Jira project — maps WorkflowTaskStatus (TODO, IN_PROGRESS, DONE, etc.) to Jira transitions. Fetches available Jira statuses/transitions via API to populate the mapping UI
- **D-05:** Mapping scoped per Jira project — one mapping table per project, reused across all workflow tasks targeting that project. Matches how Jira workflows are project-scoped

### Webhook sync direction
- **D-06:** True bidirectional sync — changes flow both ways. Jira-to-app via Jira Connect webhooks (issue_updated events), app-to-Jira via REST API transition calls. Uses the same admin-configurable mapping in both directions
- **D-07:** Jira Connect webhooks registered via Jira REST API on connected projects. Routed through the existing unified webhook endpoint (/api/webhooks/jira) and QStash queue from Phase 12
- **D-08:** Last-write-wins conflict resolution — whichever change arrives last takes effect. Sync log records both changes for audit. In practice, race conditions are rare since different people work in different systems

### Linked issue display
- **D-09:** Jira chips show issue key (e.g., PROJ-123) with a colored status badge (To Do/In Progress/Done). Click opens Jira issue in new tab. Compact, scannable
- **D-10:** Chips appear inline next to each linked workflow task in views AND a summary section at the top of the contractor's Workflows tab showing recent Jira activity
- **D-11:** Jira issue data (key, summary, status, URL) cached in ExternalLink.metadataJson. Updated via webhooks on status changes — no live API calls for display

### Claude's Discretion
- Jira issue summary/description generation strategy (auto from task vs template with placeholders)
- Unmapped Jira status handling (silent log vs warning notification)
- Exact chip component design, colors for status badges
- Summary section layout on contractor Workflows tab
- Jira project picker and mapping configuration UI design
- Webhook registration lifecycle (when to register/deregister)
- Error handling for failed Jira API calls (create issue, transition)
- Loop prevention mechanism for bidirectional sync

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — JIRA-01 through JIRA-04 acceptance criteria

### Existing Jira infrastructure (Phase 12 + 18)
- `packages/integrations/src/adapters/jira-adapter.ts` — JiraAdapter with OAuth 2.0 3LO, token exchange, refresh, cloud ID discovery. Currently read:jira-work scope only, supportsWebhooks=false
- `packages/api/src/services/jira-worklog-sync.ts` — Jira worklog sync service (Phase 18). Shows Jira API call patterns, error handling, sync log usage, ExternalLink lookup
- `packages/integrations/src/adapters/register-all.ts` — Adapter registration pattern

### Integration foundation (Phase 12)
- `packages/integrations/src/adapters/base-adapter.ts` — BaseAdapter interface (OAuth, webhooks, health)
- `packages/integrations/src/types/provider.js` — OAuthConfig, provider types
- `packages/integrations/src/types/credentials.js` — CredentialBlob type
- `packages/integrations/src/types/health.js` — ProviderHealthStatus type

### Webhook infrastructure
- `packages/db/prisma/schema/integration.prisma` — WebhookDelivery model, IntegrationProvider enum (JIRA already present), SyncDirection, SyncStatus

### Workflow schema
- `packages/db/prisma/schema/workflow.prisma` — WorkflowTaskTemplate (configJson for Jira mapping), WorkflowTaskRun (externalRefType + externalRefId for linking), WorkflowTaskStatus enum, WorkflowTaskType enum

### Entity linking
- `packages/db/prisma/schema/integration.prisma` — ExternalLink model (entityType, entityId, externalType, externalId, metadataJson for cached Jira data)

### Prior phase context
- `.planning/phases/12-integration-foundation/12-CONTEXT.md` — Adapter pattern, webhook processing, health dashboard decisions
- `.planning/phases/18-time-tracking/18-CONTEXT.md` — D-12: basic Jira OAuth for worklogs only, Phase 19 extends

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `JiraAdapter`: OAuth flow, token exchange/refresh, cloud ID discovery — extend with webhook support and write scopes
- `jira-worklog-sync.ts`: Jira API call patterns (auth headers, base URL construction, pagination, error handling, sync log lifecycle)
- `ExternalLink` model: Already used for JIRA_USER mapping in worklog sync — extend with JIRA_ISSUE type for linked issues
- `WorkflowTaskRun.externalRefType/externalRefId`: Fields already exist for external linking — use for Jira issue reference
- `WorkflowTaskTemplate.configJson`: JSON field available for storing Jira project/issue type mapping config
- Unified webhook endpoint pattern from Phase 12 (`/api/webhooks/[provider]`)
- QStash queue for async webhook processing

### Established Patterns
- tRPC middleware chain: auth -> tenant -> RBAC -> handler
- Integration adapter pattern: BaseAdapter -> specific adapter (JiraAdapter)
- Sync log lifecycle: create STARTED -> update SUCCESS/FAILED with response/error
- Credential encryption via per-provider env var (JIRA_ENCRYPTION_KEY)
- ExternalLink for entity-to-external-service mappings
- IntegrationSyncLog for tracking all inbound/outbound sync operations

### Integration Points
- JiraAdapter: add supportsWebhooks=true, webhook handler method, expanded scopes
- WorkflowTaskTemplate configJson: store Jira project/issue type mapping
- WorkflowTaskRun: set externalRefType="JIRA_ISSUE", externalRefId=issue key on creation
- Workflow task status change handler: trigger outbound Jira transition
- Webhook handler: process issue_updated events, update WorkflowTaskRun status
- ExternalLink: create JIRA_ISSUE entries with cached metadataJson
- Contractor profile Workflows tab: render Jira chips inline + summary section
- Workflow detail view: render Jira chips on linked tasks
- Integration settings: Jira project picker + status mapping configuration UI

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 19-jira-integration*
*Context gathered: 2026-03-28*
