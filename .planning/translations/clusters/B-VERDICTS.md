# Cluster B — Api.* verdicts

## Summary
- Total dead candidates: 59
- DELETE-NOW: 0
- KEEP-PLANNED: 0
- FIX-BUG: 59 (all four sub-namespaces — `Api.email`, `Api.errors`, `Api.notifications`, `Api.workflow` — point at real server emit sites that are silently broken)

## Bug confirmation

Three independent server-side i18n holes confirmed, all sharing the same root cause: the server emits **bare key strings** (no `Api.` prefix) into channels that have no translator at the rendering edge.

1. **Email subjects → `"[object Object]"`**
   - `packages/api/src/services/email-templates.ts:14-21` defines `EMAIL_SUBJECT_KEYS` as `'email.subject.approvalRequest'` etc. (missing `Api.` prefix).
   - `SUBJECT_LINES[type]` returns `{ key, params }` (lines 35-61).
   - `packages/api/src/services/notification-service.ts:184` then does `subject: String(subject)` on that object, producing the literal string `"[object Object]"` in Resend emails. Verified.
2. **Email body labels → English hardcode**
   - `packages/api/src/emails/approval-request.tsx:32-37` (and siblings) declare `labels?: ApprovalRequestLabels` but fall back to inline English (`labels?.invoice ?? 'Invoice'`).
   - `renderNotificationEmail` (`email-templates.ts:103-106`) spreads `data` into `createElement(Component, data)` and never injects a `labels` object. No call site builds one. So `Api.email.labels.*` are unreachable.
3. **In-app notifications + workflow tasks → raw key strings rendered to users**
   - `packages/api/src/routers/equipment/equipment-shared.ts:14-19` and `packages/api/src/routers/equipment/equipment-returns.ts:180-181,279-280` and `packages/api/src/routers/portal/portal.ts:1540-1541` write `title: 'notifications.equipment.returnApproved.title'` etc. straight onto the `Notification` row.
   - `apps/web-vite/src/components/notifications/notification-item.tsx:149-151` renders `{notification.title}` / `{notification.body}` as plain text — no `useTranslations` lookup. So users see `"notifications.equipment.returnApproved.title"` literally.
   - Same pattern for workflow task seeds: `packages/api/src/routers/workflow/workflow-shared.ts:22-35` defines `WORKFLOW_TEMPLATE_KEYS` as `'workflow.templates.onboarding.collectNda'` etc.; `workflow-templates.ts:380-494` writes them as `title` on `WorkflowTaskTemplate`; the frontend renders `task.title` raw (`my-tasks-list.tsx:133`, `task-card-run.tsx:383`, `task-checklist.tsx:74`). Literal keys visible.

Aspirational comment that proves intent but no implementation: `packages/api/src/init.ts:117-124` says "The message field is commonly used for i18n keys (`errors.tenant.noActiveOrganization`)" — but no router throws those keys; the actual `TRPCError` messages come from camelCase constants in `packages/api/src/errors.ts` translated under a separate `Errors.*` namespace.

Search confirms zero runtime consumer of any `Api.*` key in `apps/web-vite`, `apps/portal`, or `packages/*` (only translation-apply scripts `scripts/apply-*-translations*.ts` reference them).

## DELETE-NOW

None. Every leaf maps to a real production-visible bug; deleting locale entries would entrench the bug without fixing it.

## KEEP-PLANNED

None. Searched `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/MILESTONES.md`, `.planning/REQUIREMENTS.md`, and all phase docs under `phases/72-*` and `phases/73-*` for "email i18n", "react-email", "Resend localization", "notification template", "EMAIL_SUBJECT_KEYS", "Api.email/errors/workflow/notifications". The only adjacent hit is `.planning/phases/72-*/72-DISCUSSION-LOG.md:216` and `72-CONTEXT.md:159` noting that compliance-digest wording "translatable via i18n keys; Phase 73 i18n parity work covers final copy" — but Phase 73 plans (`73-01-PLAN.md` … `73-08-PLAN.md`) contain no mention of wiring server-side i18n for emails, equipment notifications, or workflow seeds. Phase 73 = portal/compliance admin surface only. No upcoming phase rescues these keys.

`.planning/translations/i18n-unused-findings.md:117-133` already flags the same bug and recommends an either/or fix — this verdict matches and extends that diagnosis.

## FIX-BUG

`Api.email.*` (24 leaves), `Api.errors.*` (17), `Api.notifications.*` (6), `Api.workflow.*` (12)

- **Code change needed:** introduce a tiny server-side i18n resolver in `packages/api` (e.g. `packages/api/src/i18n/server-translate.ts`) that loads the four locale JSONs and exposes `t(key, locale, params)`. Then:
  1. Strip the `Api.` prefix mismatch by either prefixing emit-site constants (preferred — rename `EMAIL_SUBJECT_KEYS`, `NOTIFICATION_KEYS`, `WORKFLOW_TEMPLATE_KEYS` to include `Api.`) **or** dropping the `Api` namespace from locale JSONs. Pick one and apply consistently across all four sub-namespaces.
  2. In `sendNotificationEmail` (`notification-service.ts:156-196`), resolve `recipient.locale` (fall back to org default), call the resolver on `subject.key` + `subject.params`, replace `subject: String(subject)` with the resolved string, and build the `labels` object per template type to pass into `renderNotificationEmail` so React Email templates stop using their English fallback.
  3. In `notification-item.tsx:149-151` (and any toast/Slack/Teams renderer) treat `title`/`body` as i18n keys: if a row's `title` starts with `notifications.` or `workflow.templates.` translate it via `useTranslations('Api')`; otherwise render raw (back-compat for any user-typed strings). Same on Slack/Teams provider rendering paths.
  4. Same translator hop for workflow seed task titles when they're shown (`my-tasks-list.tsx`, `task-card-run.tsx`, `task-checklist.tsx`) — wrap `task.title` in the same heuristic.
  5. Add a unit test asserting that `renderNotificationEmail('APPROVAL_REQUEST', …)` returns `subject` as a plain resolved string (not `[object Object]`), and that a non-EN locale picks up the translated copy.
- **Touchpoints:**
  - `packages/api/src/services/email-templates.ts`
  - `packages/api/src/services/notification-service.ts` (lines 156-196 esp. 184)
  - `packages/api/src/emails/{approval-request,approval-decision,contract-expiring,invoice-received,task-assigned,task-overdue,base-layout}.tsx`
  - `packages/api/src/routers/equipment/{equipment-shared.ts,equipment-returns.ts}`
  - `packages/api/src/routers/portal/portal.ts` (lines 1540-1541)
  - `packages/api/src/routers/workflow/{workflow-shared.ts,workflow-templates.ts}`
  - `apps/web-vite/src/components/notifications/notification-item.tsx`
  - `apps/web-vite/src/components/workflows/{my-tasks-list.tsx,workflow-run/task-card-run.tsx,workflow-run/task-checklist.tsx}`
  - `packages/api/src/init.ts:117-124` — update or remove the now-stale comment claiming `errors.tenant.noActiveOrganization` is a live convention.
  - New: server-side translator module + locale loader (or thin reuse of `apps/web-vite/messages/*.json` via package re-export).

## Recommendation

**(a) Wire email + notification i18n now.** All 59 leaves represent live production bugs that ship `"[object Object]"` to recipients (emails) and raw `"notifications.equipment.returnApproved.title"` to users (in-app + workflow task lists). Locale data is already authored in EN/DE/PL/AR — only the resolver + label plumbing is missing. The fix is a single focused phase: add `packages/api/src/i18n/server-translate.ts`, normalize emit-site prefixes to match (`Api.email.subject.*` etc.), pass `labels` into React Email templates, and translate notification/task titles at the render edge. Deleting (option b) would lock the bug in and discard already-translated copy; deferring (option c) is unsafe because the bugs are user-visible today.

If quality bar is "ship within a small slice," at minimum land **step 2 of FIX-BUG** (`subject: String(subject)` → resolved string + `labels` injection) in one PR — that single change alone eliminates the `[object Object]` subject regression in shipped emails and unlocks the `Api.email.*` leaves.

## Notes

- Locale data sanity-checked: `apps/web-vite/messages/{en,de,pl,ar}.json` all carry the full `Api.*` subtree (verified via `scripts/apply-{ar,de,pl}-translations*.ts` mirrors). No partial-locale risk.
- AR is RTL — when wiring React Email, propagate `dir="rtl"` from recipient locale into `BaseLayout` (out of scope for this verdict, flag for the FIX-BUG phase).
- Slack/Teams paths (`packages/api/src/services/messaging/*`) likely share the same raw-key-rendering bug for notification `title`/`body`; the FIX-BUG phase should sweep them in the same translator hop. Out of scope for cluster B count but adjacent.
- The `Api.` namespace prefix in locale files was probably picked to fence server-emitted keys away from frontend-only namespaces; keeping that prefix and renaming emit-site constants to match is the lower-risk direction (vs. moving 59 leaves across four locales).
