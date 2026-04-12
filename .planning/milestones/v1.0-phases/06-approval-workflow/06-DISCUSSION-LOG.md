# Phase 6: Approval Workflow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-21
**Phase:** 06-approval-workflow
**Areas discussed:** Chain configuration UX, Approver queue & actions, SLA timers & escalation, Audit trail display

---

## Chain configuration UX

### Q1: How should admins build approval chain levels?

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked level cards | Vertical stack of 1-3 level cards (like workflow task cards in Phase 4). Each card: level name, approver, SLA hours, required toggle | ✓ |
| Inline table rows | Simple table: Level, Approver, SLA, Required. Add row button | |
| Step-by-step wizard | Multi-step form: name chain → configure levels → set conditions → review | |

**User's choice:** Stacked level cards
**Notes:** Consistent with Phase 4 workflow task card pattern

### Q2: How should amount-based routing work?

| Option | Description | Selected |
|--------|-------------|----------|
| Threshold conditions on chain | Each chain has optional conditionsJson. System picks first matching chain. Default chain as fallback | ✓ |
| Single chain, skip levels by amount | One chain per org with all 3 levels. Low amounts auto-skip higher levels | |
| Manual chain selection | User picks which chain when submitting invoice for approval | |

**User's choice:** Threshold conditions on chain
**Notes:** None

### Q3: Where should approval chain management live?

| Option | Description | Selected |
|--------|-------------|----------|
| Settings > Approvals tab | New tab in /settings alongside existing tabs. Consistent with org config location | ✓ |
| Dedicated /approvals/settings page | Separate page under /approvals route | |
| Inline on /approvals page | Chain config as collapsible section at top of approvals page | |

**User's choice:** Settings > Approvals tab
**Notes:** None

### Q4: Should the chain snapshot show on invoice detail?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, visual chain tracker | Horizontal stepper showing each level: who approves, status, SLA countdown | ✓ |
| Just show current step | Only show who needs to act now and their SLA | |
| Audit trail only | No visual chain tracker — users check audit trail | |

**User's choice:** Visual chain tracker
**Notes:** None

---

## Approver queue & actions

### Q1: How should the approval queue be structured?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated /approvals page | Full page with TanStack Table. Sorted overdue-first. Two tabs: My Approvals, All (admin) | ✓ |
| Widget on Dashboard only | Approval queue as dashboard widget (Phase 9) | |
| Sidebar panel on /invoices | Collapsible approval queue panel on invoices page | |

**User's choice:** Dedicated /approvals page
**Notes:** None

### Q2: How should approve/reject actions work from the queue?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline actions on row | Hover reveals Approve/Reject buttons. Reject opens popover for mandatory comment | ✓ |
| Action buttons in side panel | Click row opens side panel with actions | |
| Only from invoice detail | Queue is read-only. Actions on detail page only | |

**User's choice:** Inline actions on row
**Notes:** None

### Q3: How should request clarification and delegation work?

| Option | Description | Selected |
|--------|-------------|----------|
| Clarify as comment, delegate via picker | Secondary actions in "More" dropdown. Clarify sends back with comment, delegate opens user picker | ✓ |
| All 4 actions equal | Approve, Reject, Clarify, Delegate all shown as equal buttons | |
| Only from detail page | Clarify and delegate only on invoice detail page | |

**User's choice:** Clarify as comment, delegate via picker
**Notes:** None

### Q4: How should bulk approve/reject work?

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox select + toolbar | Select multiple → floating toolbar: Approve (N) / Reject (N). Same pattern as Phase 2 bulk actions | ✓ |
| Select all + single action | Select all checkbox + one action at a time | |
| No bulk actions | One-by-one only | |

**User's choice:** Checkbox select + toolbar
**Notes:** None

---

## SLA timers & escalation

### Q1: How should SLA timers display visually?

| Option | Description | Selected |
|--------|-------------|----------|
| Countdown badge with color | Green (>50%), yellow (25-50%), red (<25% or overdue). Shows in queue, chain tracker, side panel | ✓ |
| Progress bar per step | Horizontal progress bar showing SLA consumption | |
| Text only, no color coding | Plain text "Due in 22h" or "Overdue" | |

**User's choice:** Countdown badge with color
**Notes:** None

### Q2: What should happen when an SLA is breached?

| Option | Description | Selected |
|--------|-------------|----------|
| Visual flag + notification event | OVERDUE badge, warning icon, emit event for Phase 7. No auto-escalation in v1 | ✓ |
| Auto-escalate to next level | Auto-approve current step on breach | |
| Auto-delegate to backup | Auto-delegate to configured backup approver | |

**User's choice:** Visual flag + notification event
**Notes:** None

### Q3: Should SLA use business hours or calendar hours?

| Option | Description | Selected |
|--------|-------------|----------|
| Calendar hours in v1 | Simple countdown. Business hours deferred to v1.5 | ✓ |
| Business hours from start | Mon-Fri 9-17 in org timezone | |

**User's choice:** Calendar hours in v1
**Notes:** None

---

## Audit trail display

### Q1: How should the approval audit trail render?

| Option | Description | Selected |
|--------|-------------|----------|
| Vertical timeline | Chronological, most recent at top. Actor avatar, action, comment, timestamp | ✓ |
| Table view | Compact table: Date, Actor, Action, Comment | |
| Collapsible section | Hidden by default, expand to see history | |

**User's choice:** Vertical timeline
**Notes:** None

### Q2: Should the audit trail include system events?

| Option | Description | Selected |
|--------|-------------|----------|
| Both system + human | System events styled differently (lighter, no avatar). Complete compliance picture | ✓ |
| Human decisions only | Only approve/reject/delegate/clarify actions | |
| Separate system log | Human timeline + separate expandable system events section | |

**User's choice:** Both system + human
**Notes:** None

### Q3: Who can see the audit trail?

| Option | Description | Selected |
|--------|-------------|----------|
| Anyone who can view the invoice | Controlled by existing invoice view RBAC permission | ✓ |
| Admin + Finance only | Restrict to admin and finance admin roles | |
| Role-based detail levels | Everyone sees status, only admin/finance sees full details | |

**User's choice:** Visible to anyone who can view the invoice
**Notes:** None

## Claude's Discretion

- Chain form field layout and validation rules
- Condition builder UI implementation
- Exact queue table column widths and responsive behavior
- Side panel content for approval queue rows
- Chain tracker sizing and animation
- Empty states for approvals page
- Timeline entry spacing and styling
- How "Request clarification" notifies submitter

## Deferred Ideas

None — discussion stayed within phase scope
