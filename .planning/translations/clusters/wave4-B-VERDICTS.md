# Wave 4-B — Notifications residue + Teams verdicts

## Summary
- Total candidates: 23
- DELETE-NOW: 23
- KEEP-PLANNED: 0
- KEEP-INDIRECT: 0
- FIX-BUG: 0

Prior Cluster A verdict tagged `Notifications.item.*` / `itemBody.*` as FIX-BUG on
the assumption that the server emits literal English strings matching these
catalog values, requiring i18n-key rewrite. Re-audit shows that hypothesis does
NOT hold for the leaves in this cluster: producers either emit i18n keys of
different shape (`Notifications.equipment.*`, `Api.email.subject.*`) or emit
free-form strings that do not match the catalog values verbatim. Nothing in
the codebase consumes `Notifications.item.*`, `Notifications.itemBody.*`, or
`Teams.cards.*`. Reclassified to DELETE-NOW with FIX-BUG documented as a
**separate, larger follow-up** (rewriting notification producers to emit i18n
keys end-to-end) that is out of scope here and would, when implemented, add
*new* keys under a fresh namespace anyway.

## Per sub-NS

### Notifications.item (7 leaves)
- Verdict: DELETE-NOW
- Evidence:
  - Producers grep (`packages/api/src`, `apps/api/src`): zero references to
    `Notifications.item.approvalRequest|approvalApproved|approvalRejected|taskAssigned|taskOverdue|contractExpiring|invoiceReceived`.
  - `packages/api/src/services/notification-service.ts:339-343` resolves
    `event.title` / `event.body` via `resolveCopy` only when the value matches
    `I18N_KEY_RE`. Live producers in the repo emit either
    `Notifications.equipment.*.title` (equipment-shared.ts:21,25) or free-form
    text — no live producer emits `Notifications.item.*` keys.
  - `email-templates.ts:17-22` (`EMAIL_SUBJECT_KEYS`) routes via
    `Api.email.subject.*` keys (Wave 3a), not `Notifications.item.*`.
  - `apps/web-vite/src/components/notifications/notification-item.tsx:147-152`
    renders `{notification.title}` and `{notification.body}` directly — no
    `useTranslations` / `t()` lookup against these leaves.
  - Only matches outside `messages/*.json` are
    `apps/web-vite/src/generated/i18n/keys.d.ts` (codegen output that will
    regenerate from the trimmed catalog).
- DELETE list:
  - Notifications.item.approvalApproved
  - Notifications.item.approvalRejected
  - Notifications.item.approvalRequest
  - Notifications.item.contractExpiring
  - Notifications.item.invoiceReceived
  - Notifications.item.taskAssigned
  - Notifications.item.taskOverdue

### Notifications.itemBody (7 leaves)
- Verdict: DELETE-NOW
- Evidence:
  - Same null result as `Notifications.item.*`: no producer references in
    `packages/api/src` or `apps/api/src` (grep on all 7 leaves).
  - `notification-item.tsx:151` renders `notification.body` as plain text.
  - No `t('approvalRequest')` / `t('itemBody.*')` shorthand in
    `apps/web-vite/src/components/notifications/**`.
  - Generated keys file is the only outside reference.
- DELETE list:
  - Notifications.itemBody.approvalApproved
  - Notifications.itemBody.approvalRejected
  - Notifications.itemBody.approvalRequest
  - Notifications.itemBody.contractExpiring
  - Notifications.itemBody.invoiceReceived
  - Notifications.itemBody.taskAssigned
  - Notifications.itemBody.taskOverdue

### Teams.cards (9 leaves)
- Verdict: DELETE-NOW
- Evidence:
  - `packages/api/src/services/messaging/teams-messaging-provider.ts` end-to-end
    has no string literal, no i18n import, no `t()` / `resolveMessage` call. It
    delegates to card builders under `packages/api/src/services/teams/cards/`
    and passes through caller-supplied `title` / `details` / `text`.
  - Card builders hardcode every English string the catalog claims:
    - `cards/approval-card.ts:34` text 'Invoice Approval Required'
    - `cards/approval-card.ts:55` action title 'Approve'
    - `cards/approval-card.ts:65` action title 'Reject'
    - `cards/approval-result-card.ts:28` `'Approved' : 'Rejected'`
    - `cards/approval-result-card.ts:73` title 'View in Contractor Ops'
    - `cards/approval-reminder-card.ts:36` text 'Overdue Approval Reminder'
    - `cards/reject-modal-card.ts:21,38` 'Reject Invoice' x2
    - `cards/activity-alert-card.ts:44` 'View in Contractor Ops'
    - `teams-bot-handler.ts:266` 'Reject Invoice'
  - `services/teams/__tests__/cards.test.ts:38,78,92,135,152,188,266,285,288`
    assert these hardcoded strings — locking the no-i18n shape into tests.
  - No `Teams.cards.*` literal anywhere under
    `packages/api/src/services/teams/**` (grep returned zero matches).
  - `.planning/phases/77-*` and `.planning/phases/78-*` (IDP / Slack / Entra /
    Okta / GitHub adapters): no reference to `Teams.cards`, no planned i18n
    pass for Teams adaptive cards. `.planning/backlog` clean too.
  - If Teams card i18n ever lands, it would pass through the same
    `resolveMessage` server path the email/notification flow uses — the keys
    would be re-introduced under whatever namespace that future phase chooses
    (likely `Api.teams.*` to mirror `Api.email.*`), not the current
    `Teams.cards.*` shape which targets the client i18next runtime that never
    touches server-rendered adaptive cards.
- DELETE list:
  - Teams.cards.approvalTitle
  - Teams.cards.approved
  - Teams.cards.overdueLabel
  - Teams.cards.rejectCommentLabel
  - Teams.cards.rejectCommentPlaceholder
  - Teams.cards.rejectModalTitle
  - Teams.cards.rejectSubmit
  - Teams.cards.reminderTitle
  - Teams.cards.viewInApp

## Notes

- `Notifications.equipment.*` and `Api.email.subject.*` remain USED via
  `equipment-shared.ts` + `email-templates.ts` (Wave 3a). Do not touch.
- After deleting the 23 leaves from `apps/web-vite/messages/{en,de,pl,ar}.json`,
  regenerate `apps/web-vite/src/generated/i18n/keys.d.ts` so the union type
  drops these entries; otherwise TypeScript will keep them as legal keys with
  no runtime backing.
- The FIX-BUG hypothesis (server emits raw English matching `Notifications.item.*`
  values verbatim) was not confirmed: producers in this tree either go through
  `resolveMessage` with different keys or pass through formatted strings with
  interpolated identifiers that do not match the catalog templates byte-for-byte.
  Proper localization of notification titles/bodies is a separate scoped phase
  and will introduce its own key namespace.
- Teams adaptive-card i18n is not on the near-term roadmap (verified against
  phases 77 + 78 and backlog); reintroducing keys would be cheap if/when a
  future phase wires it.
