# Phase 7: Notifications & Slack - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-22
**Phase:** 07-notifications-slack
**Areas discussed:** Notification center UX, Email delivery & preferences, Slack integration flow, Event triggers & routing

---

## Notification center UX

### Q1: How should the notification center open?

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown popover | Click bell → popover with scrollable list, unread badge, mark all read, view all link | ✓ |
| Side panel (Sheet) | Bell opens Sheet from right | |
| Full page only | Bell navigates to /notifications | |

**User's choice:** Dropdown popover

### Q2: Should clicking navigate to the entity?

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to entity | Click → navigate to related page, mark as read on click | ✓ |
| Expand inline details | Click expands in popover, second click navigates | |
| Mark read only | Click marks read, separate View button navigates | |

**User's choice:** Navigate to entity

### Q3: Grouping style?

| Option | Description | Selected |
|--------|-------------|----------|
| Flat chronological | Simple reverse-chronological, unread dot indicator | ✓ |
| Grouped by entity | Same-entity notifications collapse | |
| Grouped by type | Sections by notification type | |

**User's choice:** Flat chronological

### Q4: Full /notifications page?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, with filters | Full page with type filter, read/unread, mark all read | ✓ |
| Popover only | No separate page | |
| Yes, minimal | Longer list without filters | |

**User's choice:** Yes, with filters

---

## Email delivery & preferences

### Q1: How should users control preferences?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-type per-channel matrix | Settings tab with event types × channels toggle grid | ✓ |
| Simple on/off per channel | Global email toggle | |
| Digest only option | Instant vs daily digest choice | |

**User's choice:** Per-type per-channel matrix

### Q2: Email template style?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal branded | Logo, summary, single CTA, unsubscribe footer | ✓ |
| Rich HTML templates | Tables, badges, inline summaries | |
| Plain text only | No HTML | |

**User's choice:** Minimal branded

---

## Slack integration flow

### Q1: How to connect Slack?

| Option | Description | Selected |
|--------|-------------|----------|
| Settings > Integrations with OAuth | Admin-only, OAuth flow, IntegrationConnection schema | ✓ |
| Webhook URL only | Paste webhook, no interactive buttons | |
| Slack app manifest | Import pre-built manifest | |

**User's choice:** OAuth flow

### Q2: Slack approval message format?

| Option | Description | Selected |
|--------|-------------|----------|
| Block Kit card with action buttons | Rich message, approve/reject buttons, reject opens modal, status updates edit message | ✓ |
| Simple text with link | Plain text + link to app | |
| Threaded conversation | Thread-based discussion | |

**User's choice:** Block Kit card with action buttons

### Q3: Slack user mapping?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-match by email | Bot queries workspace, matches by email, admin manual fallback | ✓ |
| Manual mapping only | Admin maps each user | |
| Slack ID in profile | Users enter own Slack ID | |

**User's choice:** Auto-match by email

---

## Event triggers & routing

### Q1: How to dispatch notifications?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline dispatch after action | tRPC calls notificationService.dispatch() inline, no queue | ✓ |
| Event queue with background worker | Redis queue + worker | |
| Database trigger + polling | Write events, cron polls | |

**User's choice:** Inline dispatch

### Q2: Which event types at launch?

| Option | Description | Selected |
|--------|-------------|----------|
| Core 6 events | Approval request/decision, task assigned/overdue, contract expiring, invoice received | |
| Approvals only first | Just approval events | |
| All events + custom | Core 6 + admin-configurable reminder rules via ReminderRule model | ✓ |

**User's choice:** All events + custom reminder rules

### Q3: Where to configure custom rules?

| Option | Description | Selected |
|--------|-------------|----------|
| Settings > Notifications tab | Below preference matrix, admin creates rules with trigger/offset/recipients/channel | ✓ |
| Separate /notifications/rules page | Dedicated page | |
| Inline on each entity page | Per-entity reminders | |

**User's choice:** Settings > Notifications tab

## Claude's Discretion

- Notification popover width and animation
- Polling vs WebSocket for real-time count
- Email template HTML/CSS
- Slack Block Kit layout
- Reminder rule evaluation mechanism
- Slack rate limiting
- Notification deduplication
- Empty states
- Slack user mapping admin UI
- ReminderRule form layout

## Deferred Ideas

None — discussion stayed within phase scope
