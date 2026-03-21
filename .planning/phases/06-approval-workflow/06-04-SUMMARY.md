---
phase: 06-approval-workflow
plan: 04
subsystem: ui
tags: [react, tRPC, chain-tracker, audit-timeline, stepper, approval-flow, invoice-detail]

requires:
  - phase: 06-approval-workflow
    provides: Approval tRPC router with getAuditTrail, submitForApproval endpoints
  - phase: 05-invoice-intake-matching
    provides: Invoice detail page layout, MatchCard, InvoiceMetadataForm, status model
provides:
  - ChainTracker horizontal stepper component for approval chain visualization
  - AuditTimeline vertical timeline component for approval audit trail
  - Submit-for-approval action on invoice detail page
  - Extended getAuditTrail API returning flow summary with step data
affects: [06-05, 07-notifications]

tech-stack:
  added: []
  patterns: [chain-tracker-stepper-from-flow-data, audit-timeline-decision-system-split, conditional-approval-ui-rendering]

key-files:
  created:
    - apps/web/src/components/approvals/chain-tracker.tsx
    - apps/web/src/components/approvals/audit-timeline.tsx
  modified:
    - apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx
    - packages/api/src/routers/approval.ts
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "Extended getAuditTrail API to return flow summary with step data (approver info, SLA deadlines, status) for chain tracker rendering"
  - "Chain tracker uses same getAuditTrail query as audit timeline to avoid duplicate API calls"
  - "Approval visibility based on invoice status (APPROVAL_PENDING, APPROVED, REJECTED) not on flow existence check"

patterns-established:
  - "Approval UI components conditionally rendered based on invoice.status state machine values"
  - "Chain tracker responsive layout: flex-row at lg+ breakpoint, flex-col below for mobile"
  - "Audit timeline splits events by type: human decisions with avatar+badge, system events with 8px marker+muted text"

requirements-completed: [APPR-05, APPR-06, APPR-08, APPR-09]

duration: 10min
completed: 2026-03-21
---

# Phase 06 Plan 04: Chain Tracker & Audit Timeline Summary

**Horizontal chain tracker stepper with status-colored steps and SLA badges, vertical audit timeline with human/system event split, and submit-for-approval action on invoice detail page**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-21T22:22:55Z
- **Completed:** 2026-03-21T22:32:55Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- ChainTracker component: horizontal stepper with status-colored circles (green/primary/destructive/muted), approver avatars, SLA countdown badges, responsive vertical fallback below lg breakpoint
- AuditTimeline component: vertical timeline with human decisions (avatar + color-coded decision badge) and system events (8px circle marker + muted text), comment truncation with Show more toggle
- Extended getAuditTrail API to return flow summary with step data (approver info, SLA deadlines, chain name) alongside events
- Invoice detail page integration: submit-for-approval button for matched invoices, chain tracker and audit timeline conditionally rendered for invoices in approval flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Chain tracker stepper and audit timeline components** - `6ad752c` (feat)
2. **Task 2: Integrate chain tracker, audit timeline, and submit-for-approval into invoice detail page** - `f18a28a` (feat)

## Files Created/Modified
- `apps/web/src/components/approvals/chain-tracker.tsx` - Horizontal stepper showing approval chain progress with status colors, approver info, SLA badges
- `apps/web/src/components/approvals/audit-timeline.tsx` - Vertical timeline of approval events with human decision badges and system event markers
- `apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx` - Integrated ChainTracker, AuditTimeline, and submit-for-approval button
- `packages/api/src/routers/approval.ts` - Extended getAuditTrail to return flow summary with step data
- `apps/web/messages/en.json` - Added submitForApproval i18n keys
- `apps/web/messages/pl.json` - Added submitForApproval i18n keys (Polish)

## Decisions Made
- Extended getAuditTrail API to return flow summary with step data rather than creating a separate endpoint -- both chain tracker and audit timeline use the same query, avoiding duplicate API calls
- Chain tracker uses approver user data resolved server-side via Promise.all on steps (not client-side lookup)
- Approval visibility conditions based on invoice.status values (APPROVAL_PENDING, APPROVED, REJECTED) for rendering chain tracker and audit timeline

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended getAuditTrail API to include flow summary data**
- **Found during:** Task 1 (chain tracker component creation)
- **Issue:** Plan interface specified getAuditTrail returns `{ events, flow? }` but actual API only returned `{ events }`. Chain tracker requires step data with approver info, SLA deadlines, and chain name.
- **Fix:** Added flow summary construction to getAuditTrail: resolves approver user data via Promise.all, includes step status/SLA/decision data, adds chain name from config lookup
- **Files modified:** packages/api/src/routers/approval.ts
- **Verification:** API package compiles cleanly
- **Committed in:** 6ad752c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** API extension was necessary to match the plan's documented interface contract. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components are fully wired to tRPC data sources.

## Next Phase Readiness
- Chain tracker and audit timeline ready for use in approval queue side panel (Plan 05)
- Submit-for-approval action connects invoice flow to approval pipeline
- All approval UI components (chain tracker, audit timeline, SLA badge) available as building blocks

## Self-Check: PASSED

All 4 key files verified on disk. Both task commits (6ad752c, f18a28a) verified in git log.

---
*Phase: 06-approval-workflow*
*Completed: 2026-03-21*
