---
phase: 07-notifications-slack
plan: 02
subsystem: api
tags: [slack, react-email, resend, block-kit, oauth, webhooks, cron, aes-gcm, encryption]

requires:
  - phase: 07-01
    provides: notification dispatch service, preferences, in-app notifications
  - phase: 06-approval-workflow
    provides: approval engine advanceFlow, ApprovalStep/ApprovalFlow models
provides:
  - Slack client service with token encryption, Block Kit approval cards, workspace user sync
  - 6 React Email templates with base layout for all notification types
  - Email template rendering helper mapping event types to templates
  - Slack OAuth callback route with CSRF-protected state verification
  - Slack interactivity webhook with signature verification and 3-second compliance
  - Cron reminder route with rule evaluation, dedup, and built-in TASK_OVERDUE detection
affects: [07-03, 07-04, 07-05]

tech-stack:
  added: ["@slack/web-api", "@react-email/components", "react (api package)"]
  patterns: [AES-256-GCM token encryption, Block Kit approval cards, HMAC-signed OAuth state, Slack signature verification, fire-and-forget async processing]

key-files:
  created:
    - packages/api/src/services/slack-client.ts
    - packages/api/src/services/email-templates.ts
    - packages/api/src/emails/base-layout.tsx
    - packages/api/src/emails/approval-request.tsx
    - packages/api/src/emails/approval-decision.tsx
    - packages/api/src/emails/task-assigned.tsx
    - packages/api/src/emails/task-overdue.tsx
    - packages/api/src/emails/contract-expiring.tsx
    - packages/api/src/emails/invoice-received.tsx
    - apps/web/src/app/api/slack/oauth/route.ts
    - apps/web/src/app/api/slack/interactivity/route.ts
    - apps/web/src/app/api/cron/reminders/route.ts
  modified:
    - packages/api/package.json
    - packages/api/tsconfig.json
    - .env.example

key-decisions:
  - "Subpath exports for api package services (slack-client, approval-engine, notification-service) to enable direct imports from web routes"
  - "JSX support added to api tsconfig for React Email template compilation"
  - "ApprovalDecision record created on Slack approve/reject to maintain audit trail consistency with web UI flow"
  - "WorkflowTemplate name used for overdue task notification body (WorkflowRun has no name field)"

patterns-established:
  - "AES-256-GCM encryption for Slack bot tokens with iv:authTag:ciphertext hex format"
  - "HMAC-SHA256 signed OAuth state parameter with 10-minute expiry for CSRF protection"
  - "Slack signature verification with timing-safe comparison and 5-minute timestamp freshness"
  - "Fire-and-forget async processing pattern for Slack interactivity (respond 200 immediately, process async)"

requirements-completed: [NOTF-02, SLCK-01, SLCK-02, SLCK-03]

duration: 8min
completed: 2026-03-22
---

# Phase 07 Plan 02: Email & Slack Delivery Summary

**Slack client with AES-256-GCM encrypted tokens, 6 React Email templates, OAuth/interactivity/cron API routes**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-22T01:27:23Z
- **Completed:** 2026-03-22T01:35:14Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Slack client service with encrypted token storage, Block Kit approval cards, and workspace user sync by email
- 6 React Email templates (approval-request, approval-decision, task-assigned, task-overdue, contract-expiring, invoice-received) with shared base layout
- Slack OAuth callback with HMAC-signed state verification, token exchange, encrypted storage, and auto user sync
- Slack interactivity webhook processing approve/reject actions within 3-second window with reject modal via views.open
- Cron reminder endpoint evaluating active rules with dedup protection and built-in TASK_OVERDUE detection with 24h dedup

## Task Commits

Each task was committed atomically:

1. **Task 1: Slack client service, email templates, and package dependencies** - `c82ac36` (feat)
2. **Task 2: Slack OAuth callback, interactivity webhook, and cron reminder API routes** - `59e2af6` (feat)

## Files Created/Modified
- `packages/api/src/services/slack-client.ts` - WebClient factory, AES-256-GCM token encryption, approval card Block Kit builder, workspace user sync
- `packages/api/src/services/email-templates.ts` - renderNotificationEmail mapping 6 event types to React Email templates
- `packages/api/src/emails/base-layout.tsx` - Shared email layout with logo, CTA button, preferences/unsubscribe footer
- `packages/api/src/emails/approval-request.tsx` - Approval request email template
- `packages/api/src/emails/approval-decision.tsx` - Approval decision email template
- `packages/api/src/emails/task-assigned.tsx` - Task assigned email template
- `packages/api/src/emails/task-overdue.tsx` - Task overdue email template
- `packages/api/src/emails/contract-expiring.tsx` - Contract expiring email template
- `packages/api/src/emails/invoice-received.tsx` - Invoice received email template
- `apps/web/src/app/api/slack/oauth/route.ts` - OAuth callback with CSRF state verification, token exchange, auto user sync
- `apps/web/src/app/api/slack/interactivity/route.ts` - Slack interactivity webhook with signature verification, approve/reject handling
- `apps/web/src/app/api/cron/reminders/route.ts` - Cron reminder evaluation with dedup and built-in TASK_OVERDUE detection
- `packages/api/package.json` - Added @slack/web-api, @react-email/components, react; subpath exports for services
- `packages/api/tsconfig.json` - Added JSX support and tsx includes
- `.env.example` - Added SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET, SLACK_TOKEN_ENCRYPTION_KEY, CRON_SECRET

## Decisions Made
- Added subpath exports to api package.json for slack-client, approval-engine, and notification-service to allow direct imports from web API routes
- Added JSX support (`jsx: react-jsx`) to api package tsconfig since React Email templates are .tsx files in the api package
- Created ApprovalDecision records in Slack interactivity handler (not just updating ApprovalStep) to maintain audit trail consistency with the web UI approval flow
- Used WorkflowTemplate.name for overdue task notification body since WorkflowRun has no name field

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] API package tsconfig needed JSX support for React Email templates**
- **Found during:** Task 1 (email template creation)
- **Issue:** tsconfig.json only included `src/**/*.ts` with no JSX config; .tsx email templates would not compile
- **Fix:** Added `"jsx": "react-jsx"` to compilerOptions and `"src/**/*.tsx"` to includes
- **Files modified:** packages/api/tsconfig.json
- **Verification:** `npx tsc --noEmit --project packages/api/tsconfig.json` passes
- **Committed in:** c82ac36 (Task 1 commit)

**2. [Rule 3 - Blocking] API package needed subpath exports for service imports from web routes**
- **Found during:** Task 2 (route implementation)
- **Issue:** API package only exported from main entrypoint; web routes could not import individual services
- **Fix:** Added subpath exports in package.json for slack-client, approval-engine, and notification-service
- **Files modified:** packages/api/package.json
- **Verification:** `npx tsc --noEmit --project apps/web/tsconfig.json` passes
- **Committed in:** 59e2af6 (Task 2 commit)

**3. [Rule 1 - Bug] Fixed Prisma field names in cron route**
- **Found during:** Task 2 (cron reminder route)
- **Issue:** Plan used `assignedToUserId`, `dueDate`, `COMPLETED`, `CANCELLED` (InvoiceStatus) but actual Prisma schema has `assigneeUserId`, `dueAt`, `DONE`, `VOID`
- **Fix:** Updated all field references to match actual Prisma schema
- **Files modified:** apps/web/src/app/api/cron/reminders/route.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** 59e2af6 (Task 2 commit)

**4. [Rule 1 - Bug] Fixed ApprovalStep update fields in interactivity route**
- **Found during:** Task 2 (interactivity webhook)
- **Issue:** Plan used `decidedByUserId` and `decidedAt` but ApprovalStep uses `actedAt` and `decision` fields; also needed ApprovalDecision record for audit trail
- **Fix:** Used correct field names and added ApprovalDecision.create for audit consistency
- **Files modified:** apps/web/src/app/api/slack/interactivity/route.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** 59e2af6 (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bugs)
**Impact on plan:** All fixes necessary for compilation and schema correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed schema mismatches.

## User Setup Required
The plan includes user_setup for Slack integration. Environment variables documented in .env.example:
- SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET from Slack API Dashboard
- SLACK_TOKEN_ENCRYPTION_KEY generated via `openssl rand -hex 32`
- CRON_SECRET generated via `openssl rand -hex 32`

## Next Phase Readiness
- Email delivery and Slack integration infrastructure complete
- Plan 03 (notification settings UI) can build on these services
- Plan 04/05 (Slack settings UI, testing) have the API routes and services ready

---
*Phase: 07-notifications-slack*
*Completed: 2026-03-22*
