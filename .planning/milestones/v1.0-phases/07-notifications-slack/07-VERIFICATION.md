---
phase: 07-notifications-slack
verified: 2026-03-22T00:00:00Z
status: passed
score: 18/19 must-haves verified
re_verification: false
gaps:
  - truth: "Admin can manually trigger Slack user sync via tRPC"
    status: partial
    reason: "The integration.syncUsers tRPC procedure returns { matched: 0, total: 0 } with a TODO comment and never calls syncWorkspaceUsers(). The real sync is wired in the OAuth callback (apps/web/src/app/api/slack/oauth/route.ts line 164) but the tRPC endpoint itself is a stub."
    artifacts:
      - path: "packages/api/src/routers/integration.ts"
        issue: "syncUsers mutation returns hardcoded { matched: 0, total: 0 } — TODO comment says Plan 02 was supposed to implement it, but it was not."
    missing:
      - "Call syncWorkspaceUsers(ctx.orgId, connectionId) from the syncUsers tRPC procedure instead of returning a hardcoded empty result."
human_verification:
  - test: "End-to-end notification delivery — email"
    expected: "When an invoice is submitted for approval, the approver receives a branded React Email via Resend within seconds."
    why_human: "Requires live Resend API key and running server to verify email delivery."
  - test: "End-to-end Slack DM — approval card"
    expected: "Approver receives a Block Kit message in Slack with Approve and Reject buttons. Clicking Approve updates the original Slack message and advances the approval flow."
    why_human: "Requires a live Slack workspace, connected bot token, and running server."
  - test: "Slack interactivity 3-second response window"
    expected: "Clicking Approve/Reject in Slack never triggers a timeout error. The 200 OK is returned before async processing begins."
    why_human: "Requires real Slack interaction to measure timing behaviour."
  - test: "Cron reminder evaluation"
    expected: "Calling GET /api/cron/reminders with the correct Bearer token evaluates active rules, creates ReminderInstances, and dispatches notifications without duplicates."
    why_human: "Requires a live database with active reminder rules and an authorised HTTP client."
  - test: "Notification popover visual — badge and polling"
    expected: "Bell icon shows correct unread count badge (capped at 99+). Badge updates automatically every 30 seconds without page refresh."
    why_human: "Visual regression and timing are not verifiable via static analysis."
---

# Phase 7: Notifications & Slack — Verification Report

**Phase Goal:** Notification system with email and Slack delivery, notification UI, settings management, and integration wiring.
**Verified:** 2026-03-22
**Status:** gaps_found — 1 stub detected (integration.syncUsers tRPC procedure)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Notification service dispatches IN_APP Notification rows to the database | VERIFIED | `prisma.notification.create` at notification-service.ts:259, deduplication check at line 99 |
| 2 | User can query their notifications (list, unread count, mark read, mark all read) | VERIFIED | notification.ts router has all 4 procedures wired to Prisma; popover calls all of them |
| 3 | Admin can CRUD reminder rules | VERIFIED | reminder.ts router: list, create, update, delete, toggleActive all present and substantial (172 lines) |
| 4 | Admin can CRUD integration connections (Slack OAuth, status, disconnect) | VERIFIED | integration.ts router: getSlackStatus, getOAuthUrl, disconnect, listUserMappings, linkUser, unlinkUser present |
| 5 | Admin can manually re-trigger Slack user sync via tRPC | PARTIAL | syncUsers tRPC procedure is a stub returning { matched: 0, total: 0 } — real syncWorkspaceUsers() exists in slack-client.ts but is only called from the OAuth route, not from the tRPC endpoint |
| 6 | Email templates render React Email components for all 6 notification types | VERIFIED | 6 template files present in packages/api/src/emails/, renderNotificationEmail() dispatches by type |
| 7 | Slack client sends Block Kit DMs with approve/reject buttons | VERIFIED | sendApprovalCard() in slack-client.ts uses @slack/web-api WebClient; blocks structure present |
| 8 | Slack OAuth callback exchanges code, encrypts token, stores connection | VERIFIED | oauth/route.ts: HMAC state verification, oauth.v2.access fetch, encryptToken, Prisma upsert |
| 9 | Slack interactivity handler processes approve/reject within 3-second window | VERIFIED | interactivity/route.ts: returns 200 immediately, calls advanceFlow async |
| 10 | Cron endpoint evaluates active reminder rules and dispatches notifications | VERIFIED | cron/reminders/route.ts imports dispatch(), calls it 4 times across rule types and TASK_OVERDUE |
| 11 | User sees unread count badge on bell, updated every 30 seconds | VERIFIED | notification-popover.tsx: refetchInterval: 30_000 at line 56, badge renders at line 123 |
| 12 | User can open bell popover, scroll notifications, click to navigate and mark read | VERIFIED | popover uses ScrollArea, markRead mutation called on item click, router.push navigates |
| 13 | User can mark all notifications read from popover | VERIFIED | markAllRead mutation wired at popover line 152 |
| 14 | User can view /notifications page with type and read/unread filters and pagination | VERIFIED | notification-center.tsx: nuqs URL state, trpc.notification.list.queryOptions with filter params |
| 15 | User can configure per-type per-channel notification preferences | VERIFIED | notification-preferences.tsx: getPreferences query (line 125), updatePreferences mutation (line 164) |
| 16 | Admin can connect/disconnect Slack workspace via OAuth | VERIFIED | slack-connection-card.tsx: getOAuthUrl query (line 125), disconnect mutation present |
| 17 | Admin can see and manually manage Slack user mappings | VERIFIED | slack-user-mapping.tsx: listUserMappings, linkUser, unlinkUser all wired |
| 18 | Settings page has Notifications and Integrations tabs | VERIFIED | settings/page.tsx: TabsTrigger "notifications" and "integrations", admin gate via canManageIntegrations |
| 19 | All Phase 7 UI text available in English and Polish with matching key structure | VERIFIED | Notifications namespace keys match between en.json and pl.json (23 sub-sections each) |

**Score:** 18/19 truths verified (1 partial)

---

## Required Artifacts

| Artifact | Min Lines | Actual Lines | Status | Notes |
|----------|-----------|--------------|--------|-------|
| `packages/validators/src/notification.ts` | — | 72 | VERIFIED | Zod schemas exported |
| `packages/validators/src/reminder.ts` | — | 67 | VERIFIED | Zod schemas exported |
| `packages/validators/src/integration.ts` | — | 26 | VERIFIED | Zod schemas exported |
| `packages/api/src/services/notification-service.ts` | 80 | 299 | VERIFIED | dispatch(), getOrCreatePreferences(), real email and Slack senders |
| `packages/api/src/services/slack-client.ts` | 60 | 371 | VERIFIED | WebClient factory, encryptToken/decryptToken, sendApprovalCard, syncWorkspaceUsers |
| `packages/api/src/services/email-templates.ts` | 30 | 72 | VERIFIED | renderNotificationEmail() maps 6 types |
| `packages/api/src/emails/base-layout.tsx` | — | present | VERIFIED | Shared email layout |
| `packages/api/src/routers/notification.ts` | — | 177 | VERIFIED | list, unreadCount, markRead, markAllRead, getPreferences, updatePreferences |
| `packages/api/src/routers/reminder.ts` | — | 172 | VERIFIED | list, create, update, delete, toggleActive |
| `packages/api/src/routers/integration.ts` | — | 288 | STUB (partial) | syncUsers procedure is placeholder (lines 282-287); all other procedures verified |
| `packages/api/src/root.ts` | — | present | VERIFIED | notification, reminder, integration routers all registered |
| `apps/web/src/app/api/slack/oauth/route.ts` | — | present | VERIFIED | GET handler with HMAC state, token exchange, upsert, syncWorkspaceUsers call |
| `apps/web/src/app/api/slack/interactivity/route.ts` | — | present | VERIFIED | POST handler, 200 returned immediately, block_actions and view_submission processed |
| `apps/web/src/app/api/cron/reminders/route.ts` | — | present | VERIFIED | CRON_SECRET auth, rule evaluation, dispatch calls, TASK_OVERDUE detection |
| `apps/web/src/components/notifications/notification-popover.tsx` | 80 | 202 | VERIFIED | Bell popover with badge, scroll, mark-all-read |
| `apps/web/src/components/notifications/notification-item.tsx` | — | 184 | VERIFIED | Reusable row with icon, unread dot, relative timestamp, onClick prop |
| `apps/web/src/app/[locale]/(dashboard)/notifications/page.tsx` | — | present | VERIFIED | Server component wrapping NotificationCenter |
| `apps/web/src/components/notifications/notification-center.tsx` | — | 286 | VERIFIED | Filters, unread toggle, pagination, mark-all-read |
| `apps/web/src/components/layout/top-bar.tsx` | — | present | VERIFIED | NotificationPopover imported and rendered at line 117 |
| `apps/web/src/components/settings/notification-preferences.tsx` | 80 | 335 | VERIFIED | 6-row x 3-column matrix with switches |
| `apps/web/src/components/settings/reminder-rules-section.tsx` | — | 350 | VERIFIED | Rule cards, active toggle, edit/delete |
| `apps/web/src/components/settings/reminder-rule-editor.tsx` | — | 676 | VERIFIED | Dialog form with all 8 fields |
| `apps/web/src/components/settings/slack-connection-card.tsx` | — | 286 | VERIFIED | OAuth initiation, connected/disconnected/error states |
| `apps/web/src/components/settings/slack-user-mapping.tsx` | — | 321 | VERIFIED | User mapping table with link/unlink |
| `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx` | — | present | VERIFIED | Notifications and Integrations tabs with admin gate |
| `apps/web/messages/en.json` (Notifications ns) | — | 23 sub-keys | VERIFIED | Full i18n namespace |
| `apps/web/messages/pl.json` (Notifications ns) | — | 23 sub-keys | VERIFIED | Key parity with EN confirmed |

---

## Key Link Verification

| From | To | Via | Status | Detail |
|------|----|-----|--------|--------|
| notification-service.ts | prisma.notification | create() in dispatch | WIRED | Line 259 |
| notification-service.ts | prisma.userNotificationPreference | findFirst in getOrCreatePreferences | WIRED | Line 99 |
| root.ts | notificationRouter | registration | WIRED | Lines 11, 41 |
| root.ts | reminderRouter | registration | WIRED | Lines 12, 42 |
| root.ts | integrationRouter | registration | WIRED | Lines 13, 43 |
| notification-service.ts | email-templates.ts | renderNotificationEmail | WIRED | Lines 4, 152 |
| notification-service.ts | resend.emails.send | email delivery | WIRED | Line 162 |
| notification-service.ts | slack-client.ts | sendApprovalCard | WIRED | Lines 7, 198 |
| slack-client.ts | @slack/web-api | WebClient import | WIRED | Line 1 |
| apps/web/api/slack/interactivity/route.ts | approval-engine.ts | advanceFlow() | WIRED | Lines 9, 135 |
| apps/web/api/cron/reminders/route.ts | notification-service.ts | dispatch() | WIRED | Lines 4, 107, 184, 260, 342 |
| notification-popover.tsx | api.notification.unreadCount | refetchInterval 30s | WIRED | Lines 55-57 |
| notification-popover.tsx | api.notification.list | useQuery on open | WIRED | Line 66 |
| notification-popover.tsx | router.push | click-to-navigate | WIRED | Lines 9, 50, 111 |
| notification-preferences.tsx | api.notification.getPreferences | useQuery | WIRED | Line 125 |
| notification-preferences.tsx | api.notification.updatePreferences | useMutation | WIRED | Line 164 |
| slack-connection-card.tsx | api.integration.getOAuthUrl | OAuth initiation | WIRED | Line 125 |
| apps/web/api/slack/oauth/route.ts | syncWorkspaceUsers | auto-sync on connect | WIRED | Line 164 |
| integration.ts (tRPC) | syncWorkspaceUsers | syncUsers mutation | NOT WIRED | syncUsers stub returns { matched: 0, total: 0 } — syncWorkspaceUsers() in slack-client.ts is not called |
| approval.ts (router) | notification-service.dispatch | after submitForApproval/advanceFlow | WIRED | Lines 449, 484, 604, 990 |
| workflow.ts (router) | notification-service.dispatch | after task assignment | WIRED | Lines 727, 1193 |
| invoice.ts (router) | notification-service.dispatch | after invoice creation | WIRED | Line 138 |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| NOTF-01 | 07-01, 07-05 | System sends in-app notifications for 6 event types | SATISFIED | dispatch() creates IN_APP rows; approval, workflow, invoice routers wire all 6 event types |
| NOTF-02 | 07-01, 07-02, 07-04, 07-05 | System sends email notifications (configurable per user) | SATISFIED | sendNotificationEmail calls renderNotificationEmail + resend.emails.send; preferences matrix configures email per type |
| NOTF-03 | 07-01, 07-03 | User can view and manage notifications | SATISFIED | notification router has list/unreadCount/markRead/markAllRead; full popover and /notifications page with filters |
| SLCK-01 | 07-02, 07-04, 07-05 | System sends Slack DMs to approvers with approve/reject buttons | SATISFIED | sendApprovalCard builds Block Kit blocks; interactivity route handles button actions |
| SLCK-02 | 07-02 | Approver can approve/reject invoices directly from Slack | SATISFIED | interactivity route calls advanceFlow() on approve/reject button click; reject opens comment modal |
| SLCK-03 | 07-01, 07-02, 07-04 | System sends Slack reminders for overdue approvals and expiring contracts | SATISFIED | cron route evaluates ReminderRules and TASK_OVERDUE; reminder router provides CRUD for admin rules |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/api/src/routers/integration.ts` | 282-287 | `syncUsers` tRPC mutation returns `{ matched: 0, total: 0 }` with TODO comment, never calls `syncWorkspaceUsers()` | Warning | Manual re-sync via tRPC does nothing; auto-sync on OAuth still works so the feature is not fully broken, but the UI "Sync users" action (if exposed) would silently do nothing |

No blocker anti-patterns (empty renders, null returns in critical paths, unimplemented event wiring) were detected in any other file. The stub is isolated to the tRPC re-sync endpoint only; the sync that matters (post-OAuth) is correctly wired.

---

## Human Verification Required

### 1. Email delivery — end-to-end

**Test:** Submit an invoice for approval in a live environment with a Resend key configured.
**Expected:** The approver receives a branded React Email with correct subject, contractor/invoice details, a CTA button, and a preferences link in the footer.
**Why human:** Requires live Resend credentials and a running server; React Email render output and Resend delivery are not verifiable statically.

### 2. Slack DM — approval Block Kit card

**Test:** Submit an invoice for approval where the approver has a linked Slack account.
**Expected:** Approver receives a Slack DM with a formatted Block Kit message showing invoice details plus Approve and Reject buttons. Clicking Approve updates the original message and advances the flow.
**Why human:** Requires live Slack workspace, connected bot token, and server runtime.

### 3. Slack interactivity 3-second compliance

**Test:** Click Approve or Reject in a Slack approval card.
**Expected:** No "This app took too long to respond" error from Slack.
**Why human:** Timing behaviour depends on server response latency and cannot be measured statically.

### 4. Cron reminder evaluation

**Test:** With active ReminderRules and matching entities, call GET /api/cron/reminders with `Authorization: Bearer {CRON_SECRET}`.
**Expected:** Response `{ processed: N, sent: N, overdueTasksNotified: N }` with N > 0 when matching data exists. Re-running the cron does not create duplicate notifications within 24 hours.
**Why human:** Requires live database state and authorised HTTP client.

### 5. Notification popover visual quality

**Test:** Open the bell popover with a mix of read and unread notifications across several event types.
**Expected:** Unread items show the muted background and coloured icon correctly. Badge shows correct count, capped at "99+". Relative timestamps update correctly. Empty state shows BellOff icon.
**Why human:** Visual regression and icon colour accuracy require rendered output inspection.

---

## Gaps Summary

One gap found, classified as **warning** severity:

**integration.syncUsers tRPC stub** — The `syncUsers` mutation in `packages/api/src/routers/integration.ts` (lines 282-287) has a TODO comment and returns `{ matched: 0, total: 0 }` without calling `syncWorkspaceUsers()`. The real Slack user sync function exists in `slack-client.ts` and is correctly called from the OAuth callback route, so the primary user-sync path (automatic sync on Slack connect) works correctly.

The gap only affects a secondary path: any UI button or admin action that calls `api.integration.syncUsers` directly (for example, a "Re-sync users" button) would silently return empty results. The fix is one line: call `syncWorkspaceUsers(ctx.orgId, connectionId)` inside the mutation instead of returning a hardcoded response.

This does not block any of the six requirement IDs (NOTF-01 through SLCK-03), because:
- SLCK-01/SLCK-02 rely on the ExternalLink user mapping, which is created by the OAuth-triggered sync.
- SLCK-03 reminder delivery relies on the same mapping.

The system is functionally complete for the stated requirements. The stub represents an incomplete administrative convenience feature, not a core flow.

---

_Verified: 2026-03-22_
_Verifier: Claude (gsd-verifier)_
