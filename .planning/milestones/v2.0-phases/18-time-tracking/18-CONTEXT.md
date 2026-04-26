# Phase 18: Time Tracking - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Contractors can report hours manually in the portal and managers can review/approve them. System imports time entries from Clockify and Jira worklogs. When a contractor submits an invoice, the system compares approved hours against the invoice amount and flags deviations. No full time tracker with timers/screenshots (v3+), no Jira issue sync/status mapping (Phase 19).

</domain>

<decisions>
## Implementation Decisions

### Time entry form & UX
- **D-01:** Both entry modes — weekly timesheet grid (Mon–Sun with project rows) as the primary view, plus an "Add single entry" button for ad-hoc logging
- **D-02:** Project-level granularity — contractor picks a project (mapped to their contract). Description field for task-level details. No separate task picker
- **D-03:** Explicit submit workflow — entries go DRAFT → SUBMITTED → APPROVED/REJECTED. Contractor can edit drafts before submitting the timesheet
- **D-04:** New "Time" top-level nav item in portal top bar, between Documents and Payments. Dedicated section for timesheet entry, history, and status

### Manager review flow
- **D-05:** Both views for managers — aggregated queue for quick batch approval across contractors + drill-into per-contractor timesheet for detailed review
- **D-06:** New "Time" top-level section in admin sidebar. Dedicated page with contractor list, pending reviews, and history. Parallel to Invoices and Approvals
- **D-07:** Approve/reject only — manager cannot edit entries. Rejection includes reason. Contractor must resubmit corrections. Clean audit trail
- **D-08:** Standalone approval — direct manager approval (one person approves). Does not use the existing multi-level approval chain system

### External imports
- **D-09:** Clockify sync via on-demand polling — contractor or manager clicks "Sync from Clockify" to pull entries for a date range using Clockify REST API. No background polling or webhooks
- **D-10:** Jira worklog import by contractor — pull all worklogs by a contractor's Jira user across all issues for a period. Maps naturally to timesheets
- **D-11:** Imported entries are read-only with source badge (Clockify/Jira). Contractor can add a note/description but cannot edit hours. Prevents source-of-truth conflicts
- **D-12:** Basic standalone Jira OAuth in this phase for worklog pull only. Phase 19 extends with full issue sync, status mapping, etc. Avoids blocking time tracking on full Jira integration

### Invoice reconciliation
- **D-13:** Auto-comparison on invoice submit — system checks approved hours for that contract/period and computes expected amount (rate × hours) vs invoiced amount. Hooks into existing invoice-matching service
- **D-14:** Configurable deviation threshold per org — admin sets acceptable deviation % in settings (default 10%). Flags show as warning, not blocker
- **D-15:** Warning only — deviation flag appears on invoice but does not block approval. Approver sees it and can still approve. Real-world invoices have legitimate reasons to differ
- **D-16:** Display on both invoice detail page (new section with approved hours, expected amount, actual amount, deviation) AND in Time admin section as a reconciliation view

### Claude's Discretion
- Timesheet grid component design and interaction details
- Single entry form field layout and validation
- Manager queue table columns and sorting defaults
- Per-contractor timesheet review layout
- Clockify/Jira sync button placement and loading states
- Source badge design for imported entries
- Deviation flag visual design and placement on invoice detail
- Reconciliation view layout in Time admin section
- Empty states for all time tracking views
- Loading skeleton patterns

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — TIME-01 through TIME-05 acceptance criteria

### Existing portal infrastructure
- `packages/api/src/routers/portal.ts` — Portal tRPC router with portalProcedure middleware
- `packages/api/src/middleware/portal-auth.ts` — Portal authentication middleware
- `apps/web/src/app/[locale]/(portal)/portal/` — Portal route structure and page patterns

### Invoice matching (TIME-05 integration point)
- `packages/api/src/services/invoice-matching.ts` — MatchResult type with expectedAmountGrosze, amountDeltaGrosze, amountDeltaPercent, flags array

### Integration foundation (external imports)
- `packages/api/src/routers/integration.ts` — OAuth flow, provider health, adapter registration pattern
- `packages/api/src/routers/ksef.ts` — Example of external API integration with polling pattern (reference for Clockify/Jira)

### Prior portal context
- `.planning/phases/13-contractor-portal-auth-core-views/13-CONTEXT.md` — Portal layout decisions, nav structure, session model
- `.planning/phases/14-portal-self-service-branding/14-CONTEXT.md` — Portal self-service patterns, org branding

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `portalProcedure` middleware — authenticates portal requests, scopes to contractor + org
- Portal top bar nav component — needs "Time" item added
- Invoice submission form — patterns for form layout, validation, success flow in portal
- `invoice-matching.ts` — MatchResult with amount delta calculation, flags array
- Integration router — OAuth flow, provider adapter pattern, health checks
- KSeF router — polling/sync pattern with external API (reference for Clockify)

### Established Patterns
- Portal routes under `(portal)/portal/` with layout component
- tRPC routers in `packages/api/src/routers/` with tenant/portal procedure middleware
- Zod schema validation for all inputs via `@contractor-ops/validators`
- Status tracking with timeline (invoice status steps pattern)
- Grosze-based currency storage (integers, not floats)

### Integration Points
- Portal top bar nav — add "Time" item
- Portal router — add time entry endpoints (list, create, update, submit)
- Admin sidebar nav — add "Time" section
- Admin router — add time review endpoints (list pending, approve, reject)
- Invoice matching service — extend with time-based expected amount calculation
- Org settings — add deviation threshold configuration
- Integration router — add Clockify + Jira OAuth providers

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-time-tracking*
*Context gathered: 2026-03-27*
