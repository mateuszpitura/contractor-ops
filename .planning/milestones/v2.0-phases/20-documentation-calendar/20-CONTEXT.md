# Phase 20: Documentation & Calendar - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

External documentation and calendar deadlines are accessible from within Contractor Ops without context-switching. Users can attach Notion/Confluence page links to workflow steps, search for doc pages via Cmd+K, and have contract expiry, approval SLA, and payment deadlines automatically pushed to their Google or Outlook calendar. Workflow steps can also create custom calendar events (e.g., onboarding kickoff meetings).

</domain>

<decisions>
## Implementation Decisions

### Documentation linking model
- **D-01:** Reuse ExternalLink model (same as Jira) with provider=notion or provider=confluence. metadataJson caches page title, icon, and last edited timestamp. Consistent pattern across all integrations.
- **D-02:** Multiple doc links per workflow step — a step like "Onboarding kickoff" can reference both an onboarding guide and a policy doc. ExternalLink already supports many-to-one relationships.
- **D-03:** Scope limited to workflow steps only for this phase. Doc linking on contracts, contractors, or other entities deferred.
- **D-04:** Cached metadata: page title + provider icon + last edited date. Enough for rich chip display (similar to JiraIssueChip). Updated via webhook or lazy refresh on view.

### Documentation search in Cmd+K
- **D-05:** Dedicated "Docs" group in command palette alongside Contractors, Contracts, Invoices. Shows page title + provider icon + workspace/space name.
- **D-06:** Search by page titles only — fast API call via Notion Search API and Confluence CQL. No full-text content search.
- **D-07:** Selecting a doc from Cmd+K opens the Notion/Confluence page in a new browser tab. Matches Jira chip click behavior.

### Calendar event scope
- **D-08:** All three deadline types auto-push to calendar: contract expiry, approval SLA deadlines, and payment due dates. Matches CAL-01 exactly.
- **D-09:** Workflow task templates get a "Create calendar event" toggle in configJson with title template, duration, and attendees. Follows the Jira per-task configJson pattern. Matches CAL-02.
- **D-10:** Calendar events placed on the actual deadline date. Calendar's native reminder system handles advance notifications (1 day, 1 week before, etc.). No separate reminder events created by the system.
- **D-11:** Auto-update on source data changes — store calendar eventId in ExternalLink. When contract/approval/payment changes, update or delete the calendar event to keep calendar accurate.

### Calendar provider UX
- **D-12:** Per-user personal calendar connection AND per-org shared calendar. Events pushed to both when both are connected. Per-user is primary; shared org calendar is supplementary.
- **D-13:** Both Google Calendar (Google Calendar API) and Microsoft Outlook (Microsoft Graph API) supported from day one. Two adapters following existing IntegrationProviderAdapter pattern.
- **D-14:** Users connect their calendar in Settings > My Calendar (personal settings page). Per-user OAuth flow. Distinct from admin integration settings since calendar is personal.
- **D-15:** Event title format: `[Contractor Ops] Contract expiry: {contractor} - {contract name}`. Deep link to Contractor Ops entity in event description. Clear source prefix for scannability.

### Claude's Discretion
- Notion vs Confluence adapter internal implementation details
- OAuth scope selection for each doc/calendar provider
- Calendar event description content structure beyond the title format
- Webhook vs polling strategy for doc metadata freshness
- Loading states and error handling in Cmd+K doc search
- Org shared calendar connection UX (admin settings placement)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Integration foundation
- `packages/integrations/src/adapters/base-adapter.ts` — Base adapter class all providers extend
- `packages/integrations/src/adapters/register-all.ts` — Adapter registration pattern for new providers
- `packages/integrations/src/adapters/jira-adapter.ts` — Reference adapter for OAuth + webhook + ExternalLink pattern

### Workflow task configuration
- `packages/api/src/services/jira-issue-sync.ts` — Per-task template configJson usage pattern for external service integration
- `packages/validators/src/jira.ts` — Validator schemas for per-task configuration

### Command palette
- `apps/web/src/components/search/command-palette.tsx` — Existing Cmd+K implementation with search groups, result types, and provider integration

### External linking
- `packages/api/src/routers/jira.ts` — ExternalLink CRUD and metadataJson caching pattern
- `packages/api/src/services/jira-webhook-handler.ts` — Webhook-driven metadata update pattern

### Requirements
- `.planning/REQUIREMENTS.md` — DOCS-01, DOCS-02, CAL-01, CAL-02 requirement definitions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **ExternalLink model**: Already stores provider, externalId, url, metadataJson for Jira issues. Directly reusable for Notion/Confluence page links and calendar eventIds.
- **IntegrationProviderAdapter interface**: Base adapter pattern with OAuth, webhook handling, health checks. New Notion, Confluence, Google Calendar, Outlook adapters extend this.
- **registerAllAdapters()**: Central registration — add new adapters here.
- **Command palette**: Existing `command-palette.tsx` with grouped results, debounced search, type badges. Add "Docs" group alongside existing types.
- **JiraIssueChip**: Clickable chip with status badge and tooltip. Pattern reusable for DocLinkChip showing page title + provider icon.
- **Per-task configJson**: WorkflowTaskTemplate.configJson used by Jira for per-task external service configuration. Reuse for calendar event creation config.

### Established Patterns
- **Adapter pattern**: All integrations follow IntegrationProviderAdapter → registerAdapter() → provider-specific router. 7 adapters already exist.
- **OAuth 2.0 flow**: Generic OAuth callback + token refresh cron from Phase 12. Per-provider encryption keys.
- **Webhook processing**: Unified `/api/webhooks/[provider]` route → QStash queue → handler. HMAC verification.
- **ExternalLink metadataJson caching**: Cache external entity data locally, update via webhooks on changes. Avoids live API calls for display.
- **Provider cards in settings**: Generic ProviderConnectionCard component with connect/disconnect, health status, last sync. Used by Jira, KSeF, etc.

### Integration Points
- **Workflow task card UI**: Add doc link chips and "Attach doc" button to task-card.tsx and task-card-run.tsx
- **Workflow template builder**: Add calendar event toggle to task template configuration in task-card.tsx
- **Settings page**: New "My Calendar" section in personal settings for per-user calendar connection
- **Integration settings**: Notion/Confluence org-level connections in existing admin integration page
- **Cron/triggers**: Contract expiry, approval SLA, and payment due date watchers need to create/update calendar events

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

- Doc linking on contracts, contractors, and other entities beyond workflow steps — future phase
- Full-text content search across Notion/Confluence pages — future enhancement
- Bidirectional calendar sync (reading events back from external calendars) — explicitly out of scope per REQUIREMENTS.md
- Notion/Confluence content rendering inline (page mirroring) — explicitly out of scope per REQUIREMENTS.md

</deferred>

---

*Phase: 20-documentation-calendar*
*Context gathered: 2026-03-29*
