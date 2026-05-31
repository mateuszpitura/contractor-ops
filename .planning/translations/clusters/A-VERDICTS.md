# Cluster A — Notifications + Teams verdicts

## Summary
- Total dead candidates: 168
- DELETE-NOW: 137 (8 dead sub-namespaces — every "settings/reminder/slack/preferences" key was migrated to `Settings.*` and never re-bound; popover/destructive/emptyPage/center/reminders are duplicates of live keys)
- KEEP-PLANNED: 0
- CONSOLIDATE: 12 (`Notifications.popover.*` + `Notifications.center.*` + `Notifications.emptyPage.*` collapse into live `Notifications.{title,empty,viewAll,markAllRead,unreadOnly,filters.*}` + `EmptyStates.notifications.*`)
- KEEP-INDIRECT: 5 (`Notifications.filters.*` resolved via `tDyn(t, 'filters', key)`)
- FIX-BUG: 26 (`Notifications.item.*` + `.itemBody.*` + `Teams.cards.*` — keys scaffolded for server-side i18n that never got wired; server emits hard-coded EN strings instead)

## Bug confirmation (item/itemBody + Teams.cards)

Two independent server-side i18n holes confirmed:

1. **In-app `Notification.title` / `Notification.body` → hard-coded EN strings.**
   - `packages/api/src/routers/core/approval.ts:157,1318` build `title: \`Approval requested for ${invoice.invoiceNumber}\`` — exact text of `Notifications.item.approvalRequest` value.
   - `packages/api/src/routers/workflow/workflow-execution.ts:582-583,1032-1033` build `title: \`Task assigned: ${task.title}\`` + `body: \`Workflow: ${...} for ${...}\`` — exact text of `Notifications.item.taskAssigned` + `Notifications.itemBody.taskAssigned`.
   - `packages/api/src/routers/finance/invoice.ts:472`, `apps/cron-worker/src/jobs/handlers/reminders/index.ts:214,311` — same pattern for `invoiceReceived`, `contractExpiring`, `taskOverdue`.
   - `apps/web-vite/src/components/notifications/notification-item.tsx` renders `{notification.title}` / `{notification.body}` raw — no `useTranslations`. So users see English in DE/PL/AR locales.
   - This is the same root cause as Cluster B's equipment/workflow notification bug (see `B-VERDICTS.md`).

2. **Teams adaptive cards → hard-coded EN strings.**
   - `packages/api/src/services/teams/cards/approval-card.ts:34` emits `text: 'Invoice Approval Required'` — exact text of `Teams.cards.approvalTitle`.
   - `approval-card.ts:55,65` emits `title: 'Approve'` / `title: 'Reject'` — exact text of `Teams.cards.approve` / `Teams.cards.reject`.
   - `approval-reminder-card.ts:36,43` emits `'Overdue Approval Reminder'` + `'${days} days overdue'` — exact text of `Teams.cards.reminderTitle` + `Teams.cards.overdueLabel`.
   - `approval-result-card.ts:28-50,73` emits `'Approved'`, `'Rejected'`, `'Approved by'`, `'Rejected by'`, `'View in Contractor Ops'` — exact texts of `Teams.cards.approved`, `.rejected`, `.viewInApp`.
   - `reject-modal-card.ts:21,29,32,38` emits `'Reject Invoice'`, `'Reason for rejection (required)'`, etc. — exact texts of `Teams.cards.rejectModalTitle`, `.rejectCommentLabel`, `.rejectCommentPlaceholder`, `.rejectSubmit`.
   - No card builder accepts an `i18n` / `labels` / `t` parameter; all strings are hard-coded.

Both bug families: keys exist + translated (`scripts/apply-de-translations.part6.ts:215-222` ships DE), but the production emit path never reads them.

## CONSOLIDATE — duplicate sub-namespaces (live equivalents exist)

`Notifications.center.*` (10) → live equivalents:
- `Notifications.center.pageTitle` ↔ `Notifications.title` (both "Notifications")
- `Notifications.center.markAllRead` ↔ `Notifications.markAllRead` ("Mark all read")
- `Notifications.center.unreadOnly` ↔ `Notifications.unreadOnly` ("Unread only")
- `Notifications.center.filterAll/Approvals/Tasks/Contracts/Invoices` ↔ `Notifications.filters.{all,approvals,tasks,contracts,invoices}` (same EN values)
- `Notifications.center.emptyHeading/emptyBody` ↔ `EmptyStates.notifications.{heading,body}` (consumed via `te('notifications.heading')` in `notification-center-container.tsx:91-92`)

`Notifications.popover.*` (4) → live equivalents:
- `Notifications.popover.title` ↔ `Notifications.title` (both "Notifications", popover code uses `t('title')`)
- `Notifications.popover.markAllRead` ↔ `Notifications.markAllRead`
- `Notifications.popover.viewAll` ↔ `Notifications.viewAll` ("View all notifications", popover code uses `t('viewAll')`)
- `Notifications.popover.empty` ↔ `Notifications.empty` ("No notifications", popover code uses `t('empty')`)

`Notifications.emptyPage.*` (2) → live equivalents:
- `Notifications.emptyPage.heading` ↔ `EmptyStates.notifications.heading`
- `Notifications.emptyPage.body` ↔ `EmptyStates.notifications.body`

(All 16 above belong in DELETE-NOW; they are listed here to document the canonical key the migration should have collapsed into.)

## KEEP-INDIRECT

`Notifications.filters.*` (5)
- Found in: `apps/web-vite/src/components/notifications/notification-center-container.tsx:66` via `tDyn(t, 'filters', key)` over `NOTIFICATION_FILTER_KEYS = ['all','approvals','tasks','contracts','invoices']` (`hooks/use-notification-center.ts:28-34`).
- Static grep misses them; semantic dossier flagged false-positive. Already present in live JSON tree under `Notifications.filters` — do not remove.

## DELETE-NOW

`Notifications.reminderEditor` (33 leaves)
- Reason: Reminder-rule editor UI was rebuilt under `Settings.reminderRules.editor.*` NS. `apps/web-vite/src/components/settings/hooks/use-reminder-rule-editor.ts:141,193` binds `useTranslations('Settings')` and `reminder-rule-editor.tsx:166-291` calls `t('reminderRules.editor.*')`. Zero refs to `Notifications.reminderEditor.*`.
- Sample keys: `createTitle`, `nameLabel`, `triggerBeforeContractEnd`, `recipientFinanceTeam`, `saveCta`

`Notifications.preferences` (15 leaves)
- Reason: Preference table moved to `Settings.notifications.*`. `apps/web-vite/src/components/settings/notification-preferences.tsx:195-295` calls `t('notifications.{heading,description,columnEvent,inAppTooltip,saveCta,…}')` after `useTranslations('Settings')` (in hook). Live Settings tree even adds a 4th `columnTeams` column the dead block lacks.
- Sample keys: `heading`, `columnEvent`, `eventApprovalRequest`, `inAppTooltip`, `saveCta`

`Notifications.integrations` (15 leaves)
- Reason: Slack/Teams integrations panel rebuilt under `Settings.integrations.*` (`apps/web-vite/src/components/settings/integrations-tab.tsx`, `provider-detail-sheet.tsx:89` binds `Settings.integrations`). Zero refs to `Notifications.integrations.*`.
- Sample keys: `slackHeading`, `connectCta`, `statusConnected`, `reauthCta`, `tabLabel`

`Notifications.userMapping` (14 leaves)
- Reason: Slack user-mapping table rebuilt under `Settings.integrations.userMapping.*` (`apps/web-vite/src/components/settings/slack-user-mapping.tsx:91-188` calls `t('integrations.userMapping.{columnUser,heading,mappingStats,…}')`). Live tree has richer schema (`syncUsers` sub-block) the dead duplicate lacks.
- Sample keys: `columnUser`, `linkAction`, `statusUnmatched`, `mappingStats`, `slackPickerPlaceholder`

`Notifications.reminders` (9 leaves)
- Reason: Reminder-rules section rebuilt under `Settings.reminderRules.*` (`apps/web-vite/src/components/settings/reminder-rules-section.tsx:99-245` calls `t('reminderRules.{heading,description,createRule,deleteConfirm.*}')` via `useTranslations('Settings')`). Section list keys live there.
- Sample keys: `heading`, `createCta`, `emptyHeading`, `activeLabel`, `editAction`

`Notifications.toasts` (9 leaves)
- Reason: Toasts for the dead reminder/slack/preferences features. Live toasts are `Notifications.markedAllRead` (top-level, in `use-notification-center.ts:93`), `Notifications.markedRead` (top-level, in `use-notification-popover.ts:41`), and `Settings.integrations.toasts.userLinked` (in `use-slack-user-mapping.ts:36`). The dead `Notifications.toasts.userLinked` was migrated to `Settings.integrations.toasts.userLinked`; the rest belong to features that never shipped under this NS.
- Sample keys: `markedRead`, `prefsSaved`, `ruleCreated`, `slackConnected`, `userLinked`

`Notifications.validation` (10 leaves)
- Reason: Form validation for the dead reminder editor. No live refs anywhere — Settings reminder-rule editor uses its own Zod messages, not these strings.
- Sample keys: `nameRequired`, `triggerRequired`, `offsetDaysRange`, `channelRequired`, `roleRequired`

`Notifications.errors` (10 leaves; 1 live, 9 dead)
- Reason: Only `Notifications.errors.failedToMarkRead` is live (`use-notification-center.ts:99`, `use-notification-popover.ts:59`). The other 9 (loadFailed, markReadFailed, savePrefsFailed, saveRuleFailed, deleteRuleFailed, connectSlackFailed, disconnectSlackFailed, slackCancelled, linkUserFailed, retryCta) are scaffolded for the dead settings UI flows. **NOTE:** dossier includes `failedToMarkRead`? — verified, dossier lists `connectSlackFailed`, `deleteRuleFailed`, `disconnectSlackFailed`, `linkUserFailed`, `loadFailed`, `markReadFailed`, `retryCta`, `savePrefsFailed`, `saveRuleFailed`, `slackCancelled` (10), correctly excludes `failedToMarkRead`. Delete all 10.
- Sample keys: `loadFailed`, `savePrefsFailed`, `slackCancelled`, `retryCta`, `connectSlackFailed`

`Notifications.destructive` (6 leaves)
- Reason: Confirm-dialog copy for delete-reminder-rule + disconnect-slack — both flows live under `Settings.*` namespace today. `reminder-rules-section.tsx:235-245` uses `Settings.reminderRules.deleteConfirm.*` instead.
- Sample keys: `deleteRuleTitle`, `deleteRuleBody`, `disconnectTitle`, `disconnectCta`

`Notifications.center` (10 leaves) — see CONSOLIDATE above for canonical targets.

`Notifications.popover` (4 leaves) — see CONSOLIDATE above.

`Notifications.emptyPage` (2 leaves) — see CONSOLIDATE above.

## FIX-BUG

`Notifications.item` + `Notifications.itemBody` (14 leaves)
- Issue: Server emits hard-coded English `title` / `body` strings (`approval.ts:157,1318`, `workflow-execution.ts:582-583,1032-1033`, `invoice.ts:472`, `cron-worker/jobs/handlers/reminders/index.ts:214,311`) whose text is byte-identical to these locale values. `notification-item.tsx` renders them raw with no `useTranslations`. Non-EN users see English. Either wire server emit through i18n (preferred — emit `{ key, params }`, let client render via `tDyn(t, 'item', key)` + `tDyn(t, 'itemBody', key)` with interpolation) **or** delete these keys + drop the localization promise. Same fix family as Cluster B.
- File: `packages/api/src/routers/core/approval.ts:104-157,1318`; `packages/api/src/routers/workflow/workflow-execution.ts:582-583,1032-1033`; `apps/web-vite/src/components/notifications/notification-item.tsx:1-200`

`Teams.cards` (12 leaves)
- Issue: All Teams adaptive-card builders (`packages/api/src/services/teams/cards/{approval-card,approval-reminder-card,approval-result-card,reject-modal-card}.ts`) hard-code English strings whose text is byte-identical to these locale values. No builder accepts a `t` / `labels` / `i18n` parameter. Microsoft Teams card recipients in DE/PL/AR locales see English. Either wire builders through `Translator` (preferred — accept `labels: TeamsCardLabels` and pre-resolve on the server via `getRequestLocale()` or per-recipient locale) **or** delete these keys + drop the localization promise. Same fix family as Cluster B and `Notifications.item.*`.
- File: `packages/api/src/services/teams/cards/approval-card.ts:34,55,65`; `approval-reminder-card.ts:36,43`; `approval-result-card.ts:28-50,73`; `reject-modal-card.ts:21,29,32,38`

## Notes / open questions

- The CONSOLIDATE/DELETE-NOW split: I treat duplicates with explicit canonical targets (center / popover / emptyPage = 16 leaves) as DELETE-NOW because the live key already covers the use case; the CONSOLIDATE section documents the target so the cleanup commit can collapse without losing locale work. If translators have richer translations in the dead block, they should be merged into the live key before deletion.
- All 137 DELETE-NOW keys appear in `apps/web-vite/src/generated/i18n/keys.d.ts` — that file regenerates from `messages/en.json`, so deletion auto-propagates.
- Phase 73 (i18n parity) and Phases 76-78 (IDP Slack/Teams adapters) reviewed — none plan to revive `Notifications.reminderEditor/userMapping/preferences/integrations` (already migrated to `Settings.*`) or to wire server-side i18n for `item.*` / `itemBody.*` / `Teams.cards.*`. Phase 77 Slack adapter work is deprovisioning-only (SCIM PATCH), not notification UX.
- Prior audit `.planning/translations/i18n-unused-findings.md:135-144` independently identified the same DELETE list — this verdict confirms and extends it.
- Keep `Notifications.filters.*` regardless of dossier flag — `tDyn` indirection makes it KEEP-INDIRECT.
- Recommend resolving FIX-BUG via consolidated server-i18n track that also covers Cluster B's equipment/workflow notifications; the three buckets share root cause and fix shape.
