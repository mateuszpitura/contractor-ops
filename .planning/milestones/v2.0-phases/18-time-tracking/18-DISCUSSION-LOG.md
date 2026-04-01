# Phase 18: Time Tracking - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 18-time-tracking
**Areas discussed:** Time entry form & UX, Manager review flow, External imports, Invoice reconciliation

---

## Time Entry Form & UX

| Option | Description | Selected |
|--------|-------------|----------|
| Weekly timesheet grid | Mon–Sun grid with project rows. Familiar from Clockify/Harvest. | |
| Single entry form | One entry at a time: date, hours, project, description. | |
| Both modes | Timesheet grid as default + "Add single entry" for ad-hoc. | ✓ |

**User's choice:** Both modes
**Notes:** Weekly grid as primary, single entry for ad-hoc logging.

| Option | Description | Selected |
|--------|-------------|----------|
| Project only | Contractor picks project mapped to contract. Description for task details. | ✓ |
| Project + task | Project then task. Requires task management. | |
| Freeform | Just date, hours, description. No project association. | |

**User's choice:** Project only

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit submit | DRAFT → SUBMITTED → APPROVED/REJECTED. Contractor can edit drafts. | ✓ |
| Auto-submit on entry | Each entry immediately goes to manager review. | |

**User's choice:** Explicit submit

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Time' nav item | Add to portal top bar between Documents and Payments. | ✓ |
| Under existing section | Nest under Contracts or Invoices. | |

**User's choice:** New 'Time' nav item

---

## Manager Review Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Per-contractor timesheets | Manager picks contractor, sees their submitted timesheet. | |
| Aggregated queue | All pending entries in one list, sortable/filterable. | |
| Both views | Queue for batch approval + drill into per-contractor detail. | ✓ |

**User's choice:** Both views

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Time' section | Top-level sidebar in admin. Dedicated page. | ✓ |
| Under Contractor profile | Time tab on contractor profile page. | |
| Under Approvals | Time approvals in existing approval queue. | |

**User's choice:** New 'Time' section

| Option | Description | Selected |
|--------|-------------|----------|
| Approve/reject only | Manager approves or rejects with reason. Contractor resubmits. | ✓ |
| Approve/reject + adjust | Manager can adjust hours before approving. | |

**User's choice:** Approve/reject only

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone | Direct manager approval, one person. | ✓ |
| Reuse approval chains | Route through existing 1-3 level approval workflow. | |

**User's choice:** Standalone

---

## External Imports

| Option | Description | Selected |
|--------|-------------|----------|
| Polling on demand | Click "Sync from Clockify" to pull entries for date range. | ✓ |
| Scheduled polling | Background job polls every N hours. | |
| Webhook-driven | Real-time via Clockify webhooks. Requires paid plan. | |

**User's choice:** Polling on demand

| Option | Description | Selected |
|--------|-------------|----------|
| By contractor | Pull all worklogs by contractor's Jira user across issues. | ✓ |
| By project/board | Pull from specific Jira project, filter by contractor. | |

**User's choice:** By contractor

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only with notes | Source badge, not editable. Contractor can add notes. | ✓ |
| Editable copies | Import creates editable entries pre-filled from source. | |

**User's choice:** Read-only with notes

| Option | Description | Selected |
|--------|-------------|----------|
| Basic standalone OAuth here | Minimal Jira OAuth + worklog pull. Phase 19 extends. | ✓ |
| Depend on Phase 19 | Jira worklogs wait for full Phase 19 integration. | |

**User's choice:** Basic standalone OAuth here

---

## Invoice Reconciliation

| Option | Description | Selected |
|--------|-------------|----------|
| Auto on invoice submit | System checks approved hours when invoice submitted. | ✓ |
| Manual reconciliation | Manager explicitly runs reconciliation from Time section. | |

**User's choice:** Auto on invoice submit

| Option | Description | Selected |
|--------|-------------|----------|
| Configurable per org | Admin sets deviation % in settings (default 10%). | ✓ |
| Fixed 10% threshold | Hard-coded 10% deviation flag. | |
| No threshold — always show | Always display comparison, informational only. | |

**User's choice:** Configurable per org

| Option | Description | Selected |
|--------|-------------|----------|
| Warning only | Flag appears but doesn't block approval. | ✓ |
| Soft block | Requires approver to acknowledge deviation. | |
| Hard block | Cannot approve until deviation resolved. | |

**User's choice:** Warning only

| Option | Description | Selected |
|--------|-------------|----------|
| Invoice detail page | New section on invoice detail with hours vs amount. | |
| Both invoice + time section | Show on invoice detail AND Time admin reconciliation view. | ✓ |
| Separate report | Dedicated reconciliation report in Reports section. | |

**User's choice:** Both invoice + time section

---

## Claude's Discretion

- Timesheet grid component design and interaction details
- Single entry form field layout and validation
- Manager queue table columns and sorting defaults
- Per-contractor timesheet review layout
- Clockify/Jira sync button placement and loading states
- Source badge design for imported entries
- Deviation flag visual design
- Reconciliation view layout
- Empty states and loading skeletons

## Deferred Ideas

None — discussion stayed within phase scope
