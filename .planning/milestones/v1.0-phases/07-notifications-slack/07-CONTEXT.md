# Phase 7: Notifications & Slack - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

In-app notifications for all critical events via bell icon dropdown and full /notifications page. Email notifications via Resend with per-user per-type preferences. Slack integration with OAuth connection, Block Kit approval cards with interactive approve/reject buttons, and reminder DMs. Custom reminder rules via admin UI for scheduled notifications (contract expiry, task due dates, etc.). This phase does NOT include SMS notifications or push notifications — web-only channels.

</domain>

<decisions>
## Implementation Decisions

### Notification center UX
- **D-01:** Dropdown popover from bell icon — click bell opens scrollable notification list (max ~10 visible), unread count badge on bell, "Mark all read" button, "View all" link to full page. Bell already exists in top bar (Phase 1)
- **D-02:** Click notification navigates to related entity — uses entityType + entityId for deep linking. Marks as read on click. Universal pattern across all notification types
- **D-03:** Flat chronological list — reverse chronological, unread items have dot indicator. No grouping by entity or type in v1
- **D-04:** Full /notifications page with filters — "View all" links to page with type filter (approvals, tasks, contracts, invoices), read/unread filter, and "Mark all read" action

### Email delivery & preferences
- **D-05:** Settings > Notifications tab with per-type per-channel matrix — rows = 6 event types, columns = in-app/email/Slack toggles. UserNotificationPreference schema supports this. Each user configures their own preferences
- **D-06:** Minimal branded email templates — logo header, event summary, single CTA button ("View in Contractor Ops"), unsubscribe footer. Clean text-focused design. Resend handles delivery
- **D-07:** "Manage preferences" link in email footer — deep link to Settings > Notifications for the user

### Slack integration flow
- **D-08:** Settings > Integrations with OAuth flow — admin-only "Connect Slack" button, Slack OAuth redirect, IntegrationConnection stores credentials. Disconnect button available. Shows connected workspace name
- **D-09:** Block Kit approval cards with action buttons — rich Slack message: invoice summary (number, contractor, amount, SLA deadline), Approve/Reject buttons. Reject opens Slack modal for mandatory comment. After action, original message updates to show result
- **D-10:** Auto-match users by email — when Slack connects, bot queries workspace members and auto-matches by email address. Admin can manually link unmatched users in settings

### Event triggers & routing
- **D-11:** Inline dispatch after action — tRPC procedures call notificationService.dispatch() inline. Service checks preferences, creates Notification rows (IN_APP), sends Resend email (if enabled), sends Slack DM (if connected). No background job queue in v1
- **D-12:** All 6 core event types + custom reminder rules — Core: (1) approval request, (2) approval decision, (3) task assigned, (4) task overdue, (5) contract expiring, (6) invoice received. Custom rules via ReminderRule model with trigger types, offsets, recipient modes, and channel selection
- **D-13:** Reminder rules admin UI in Settings > Notifications — below user preference matrix. Admin creates rules: trigger type, offset (days/hours), recipients (entity owner, finance team, role), channel. List with add/edit/delete. ReminderRule schema already supports this

### Claude's Discretion
- Notification popover width and animation
- Polling vs WebSocket for real-time notification count (polling acceptable in v1)
- Email template HTML/CSS details
- Slack Block Kit layout specifics
- Reminder rule evaluation mechanism (cron interval, on-demand check, etc.)
- How to handle Slack rate limits
- Notification deduplication logic for rapid successive events
- Empty states for notification center and integrations page
- Slack user mapping admin UI design
- ReminderRule form field layout and validation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements & data model
- `prd.md` — Full PRD with notification requirements (section 11.6), Slack integration spec (section 11.7), API contracts
- `db-schema.md` — Complete database schema including Notification, UserNotificationPreference, ReminderRule, ReminderInstance, IntegrationConnection, WebhookDelivery models

### Phase requirements
- `.planning/REQUIREMENTS.md` — Phase 7 requirements: NOTF-01, NOTF-02, NOTF-03, SLCK-01, SLCK-02, SLCK-03
- `.planning/ROADMAP.md` — Phase 7 plans: notification service + center, email delivery, Slack integration

### Prisma schemas
- `packages/db/prisma/schema/notification.prisma` — Notification (channel, type, entityType/Id, status), UserNotificationPreference (per-type per-channel toggles, digestMode), ReminderRule (triggerType, offsetDays, recipientMode), ReminderInstance
- `packages/db/prisma/schema/integration.prisma` — IntegrationConnection (SLACK provider, OAuth credentials, status), WebhookDelivery (Slack interactivity payloads), ExternalLink (Slack user mapping)

### Prior phase decisions
- `.planning/phases/01-foundation-auth/01-CONTEXT.md` — App shell, top bar with bell icon, Settings page structure
- `.planning/phases/05-invoice-intake-matching/05-CONTEXT.md` — Resend already integrated for inbound email (reuse for outbound)
- `.planning/phases/06-approval-workflow/06-CONTEXT.md` — SLA breach events in audit trail response, approval decision flow, APPR-06 deferred notification to Phase 7

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/components/layout/top-bar.tsx` — Bell icon already rendered with Lucide `Bell` component, ready for notification popover wiring
- `packages/db/prisma/schema/notification.prisma` — Full Notification, UserNotificationPreference, ReminderRule, ReminderInstance models
- `packages/db/prisma/schema/integration.prisma` — Full IntegrationConnection, WebhookDelivery, ExternalLink models
- `packages/auth/src/config.ts` — Resend already configured for auth emails (reuse for notification emails)
- `packages/api/src/routers/approval.ts` — getAuditTrail returns SLA breach computed events that Phase 7 notification service should consume
- `apps/web/src/components/settings/` — Settings page with tabs pattern (add Notifications + Integrations tabs)

### Established Patterns
- tRPC routers with `tenantProcedure` + `requirePermission()` middleware
- Validators in `packages/validators/src/` with Zod schemas
- React Hook Form + Zod for all forms
- `useTranslations()` from next-intl for UI text
- URL query params via nuqs for page state
- Popover component from shadcn/ui for dropdown menus

### Integration Points
- Top bar bell icon → notification popover component
- Approval tRPC router → dispatch approval_request and approval_decision notifications
- Workflow tRPC router → dispatch task_assigned and task_overdue notifications
- Invoice tRPC router → dispatch invoice_received notification
- Contract expiry detection → dispatch contract_expiring notification
- Settings page → add Notifications tab (preferences + reminder rules) and Integrations tab (Slack connection)
- Slack interactivity webhook → API route for handling approve/reject button clicks
- Root tRPC router → add notification router registration

</code_context>

<specifics>
## Specific Ideas

- Notification popover from bell is the primary quick-check interface — users glance at it 10-20 times a day, it must be fast and scannable
- Slack Block Kit cards with inline approve/reject are the key integration differentiator — approvers don't need to leave Slack for routine approvals
- Auto-match by email eliminates 90%+ of Slack user mapping friction
- Custom reminder rules via ReminderRule give admins flexibility beyond the 6 hardcoded events — e.g., "remind finance team 7 days before every contract ends"
- Inline dispatch keeps v1 simple — no Redis queue, no background workers, just direct calls after database operations

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-notifications-slack*
*Context gathered: 2026-03-22*
