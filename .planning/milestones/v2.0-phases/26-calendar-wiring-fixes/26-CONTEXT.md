# Phase 26: Calendar Wiring Fixes - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix two broken integration wiring points: (1) personal calendar OAuth connect buttons navigate to the provider authorization URL instead of the callback URL, with correct adapter slug for Outlook, and (2) workflow task `startRun` calls `createTaskCalendarEvent` fire-and-forget for each task run whose template has calendar event config enabled.

</domain>

<decisions>
## Implementation Decisions

### OAuth connect URL fix
- **D-01:** Claude's discretion — pick the minimal correct fix based on codebase patterns. Fix adapter slug mapping so connect buttons resolve the correct `authorizationUrl` from the adapter's OAuth config. Ensure Outlook uses slug `"outlook-calendar"` consistently.

### Calendar event hook placement
- **D-02:** Create a dedicated "calendar integrations" block in `startRun`, separate from the Jira integration block. More readable and extensible if additional calendar hooks are added later. Same fire-and-forget `void` async pattern as Jira.

### Error handling for calendar event creation
- **D-03:** Log server-side with `console.error` (structured log) AND show a non-blocking dismissible toast warning to the user ("Calendar event could not be created"). User is aware of the failure but not blocked from continuing their workflow.

### Claude's Discretion
- OAuth URL fix: exact code changes to resolve slug mismatch or URL field selection
- Calendar hook: exact placement within the `startRun` function body relative to Jira block
- Toast warning: implementation approach (tRPC response metadata vs websocket vs mutation return)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Calendar adapters
- `packages/integrations/src/adapters/outlook-calendar-adapter.ts` — Outlook OAuth config with authorizationUrl
- `packages/integrations/src/adapters/google-calendar-adapter.ts` — Google Calendar OAuth config
- `packages/integrations/src/types/provider.ts` — Provider type with authorizationUrl field

### OAuth connect flow
- `packages/api/src/routers/integration.ts` — OAuth URL construction from adapter config (line ~381)

### Workflow runtime
- `packages/api/src/routers/workflow.ts` — `startRun` procedure with existing Jira fire-and-forget pattern
- `packages/api/src/services/calendar-event-service.ts` — `createTaskCalendarEvent` service

### Calendar UI
- `apps/web/src/components/settings/my-calendar-section.tsx` — Personal calendar connect buttons
- `apps/web/src/components/workflow/calendar-event-config-dialog.tsx` — CalendarTaskConfig dialog

### Prior phase patterns
- `packages/api/src/routers/workflow.ts` lines ~780-794 — Jira issue creation fire-and-forget pattern (reference implementation for calendar hook)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `integration.ts` OAuth URL builder: constructs authorization URL from adapter's `oauthConfig.authorizationUrl` with query params — calendar adapters should work through this existing path
- Fire-and-forget pattern in `workflow.ts`: `void createJiraIssue(...)` with try/catch logging — reusable for calendar
- `calendar-event-service.ts`: `createTaskCalendarEvent` already exists and handles event creation logic

### Established Patterns
- All integration adapters register slugs in `register-all.ts` — Outlook slug must match what the connect UI looks up
- Per-task integration config stored in `configJson` (Jira pattern) — calendar follows same approach (Phase 22 D-05)
- Fire-and-forget with `void` async and try/catch server-side logging (Phase 19/22 pattern)

### Integration Points
- Connect buttons in `my-calendar-section.tsx` → integration router `connect` mutation → adapter registry lookup by slug
- `startRun` in workflow router → iterates task runs → calls integration hooks for enabled tasks
- Toast warnings surface through existing notification/toast system in the web app

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following existing integration patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 26-calendar-wiring-fixes*
*Context gathered: 2026-03-30*
