# Phase 22: Component Mounting & Lifecycle Wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 22-component-mounting-lifecycle-wiring
**Areas discussed:** DocLinksSection placement, CalendarTaskConfig placement, Calendar auto-push triggers, Error handling for auto-push

---

## DocLinksSection Placement

| Option | Description | Selected |
|--------|-------------|----------|
| After TaskAttachments | Documents section appears below file attachments, before comments. Natural grouping. | ✓ |
| Before TaskAttachments | Linked docs appear first, then file attachments, then comments. | |
| Merged with Attachments | Combine into a single "Resources" section with tabs or sub-headers. | |

**User's choice:** After TaskAttachments
**Notes:** None

### Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Only when expanded | Matches TaskComments and TaskAttachments behavior — visible in collapsible content area. | ✓ |
| Always visible as chips | Show doc link chips on collapsed card header (like Jira chips). | |

**User's choice:** Only when expanded
**Notes:** None

---

## CalendarTaskConfig Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Below JiraTaskConfig | Calendar config appears right after Jira config. Same saved-task-only guard. | ✓ |
| In own "Integrations" group | Group Jira + Calendar under an "Integrations" sub-header. | |

**User's choice:** Below JiraTaskConfig
**Notes:** None

---

## Calendar Auto-Push Triggers

| Option | Description | Selected |
|--------|-------------|----------|
| Contract create/update with expiry date | syncContractDeadline fires on contract create/update with expiresAt. | ✓ |
| Invoice marked as approved (payment due) | syncPaymentDeadline fires on APPROVED status with paymentDueDate. | ✓ |
| Contract/invoice deletion or expiry removal | Delete corresponding calendar events to keep calendar clean. | ✓ |
| Approval SLA deadline creation | Push approval SLA deadlines when approval chain starts. | ✓ |

**User's choice:** All four triggers selected
**Notes:** None

---

## Error Handling for Auto-Push

| Option | Description | Selected |
|--------|-------------|----------|
| Fire-and-forget with server log | Async, never blocks save. Failures logged server-side. Matches Jira pattern. | ✓ |
| Toast notification on failure | Non-blocking toast if push fails. Requires async result surfacing. | |
| Visible error badge on entity | Warning badge on contract/invoice if sync failed. More complex. | |

**User's choice:** Fire-and-forget with server log
**Notes:** None

---

## Claude's Discretion

- Exact import structure and prop threading
- Which router mutations to hook into
- Calendar event cleanup logic details
- Approval SLA deadline calculation

## Deferred Ideas

None — discussion stayed within phase scope.
