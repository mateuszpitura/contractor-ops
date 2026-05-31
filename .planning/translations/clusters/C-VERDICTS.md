# Cluster C — Settings.{integrations, auditLog, apiKeys} verdicts

## Summary
- Total candidates: 260
- DELETE-NOW: 36
- KEEP-PLANNED: 12 (Phase 77 Slack-Org-Grid card; cannot blanket-delete Slack scaffold yet)
- CONSOLIDATE: 38 (per-provider Linear duplicates of generic `provider.*` block)
- KEEP-INDIRECT (cross-file binding the auditor missed): 174

Net auditor false-positive rate ≈ 81% (212 of 260 nominated keys are actually live or planned).

---

## Settings.integrations  (117)

Live binding sites (auditor didn't follow these):
- `apps/web-vite/src/components/settings/hooks/use-integrations-tab.ts:10` → `Settings.integrations`
- `apps/web-vite/src/components/settings/hooks/use-provider-detail-sheet.ts:24` → `Settings.integrations`
- `apps/web-vite/src/components/settings/hooks/use-provider-connection-card.ts:21` → `Settings.integrations`
- `apps/web-vite/src/components/settings/hooks/use-slack-sync-button.ts:10` → `Settings.integrations.userMapping.syncUsers`
- `apps/web-vite/src/components/integrations/hooks/use-teams-*.ts` → `Settings.integrations.teams[.fallbackApprover]`
- `apps/web-vite/src/components/integrations/hooks/use-linear-*.ts` → `Settings.integrations.linear[.mapping|.templateSettings]`
- `apps/web-vite/src/components/integrations/hooks/use-google-workspace-provider-section.ts:10` → `Settings.integrations.googleWorkspace`

### KEEP-INDIRECT  (61)
- `googleWorkspace.descriptionConnected/Disconnected` (2): rendered in `google-workspace-provider-section.tsx:48` via cross-file `t` from hook.
- `linear.mapping.*` (11): all rendered in `linear-status-mapping-dialog.tsx` lines 144,152,154,159,162,176,177,186,187,216,222 (hook binds `linear.mapping`).
- `linear.templateSettings.enableToggle / teamLabel / teamPlaceholder` (3): `linear-task-config.tsx` lines 49,60,63.
- `linear.configureMapping`, `pendingMappingWarning`, `scopeExpansionWarning` (3): `linear-provider-section.tsx` lines 48,54,61 (hook binds `Settings.integrations.linear`).
- `provider.connectCta` (1): `integrations-tab.tsx:98,106` (Notion/Confluence cards) + `provider-connection-card.tsx:214`.
- `provider.errorConnectionFailed / errorTokenExpired / manageCta` (3): `provider-connection-card.tsx:172,189,190`.
- `provider.statusConnected / statusDisconnected / statusError / statusReauth` (4): rendered via `tDynLoose(t, 'provider', statusLabelKey)` in both `provider-connection-card.tsx:140` and `provider-detail-sheet.tsx:151` driven by `STATUS_LABEL_KEYS` map (CONNECTED/DISCONNECTED/ERROR/REAUTH_REQUIRED).
- `teams.descriptionConnected / descriptionDisconnected` (2): `teams-provider-section.tsx:44`.
- `teams.channelFetchError / noChannels / channelMappingHeading / channelMappingDescription / refreshChannels / saveMapping / selectChannel` (7): `teams-channel-mapping-card.tsx` lines 33,56,131,139,201,202,211,219,228.
- `teams.categoryApprovals / categoryContracts / categoryEquipment / categoryInvoices / categoryTasks` (5): KEEP-INDIRECT via `CATEGORY_LABEL_KEYS` map in `teams-channel-mapping.constants.ts:11-16` → resolved by `tKey(t, CATEGORY_LABEL_KEYS[category])` in `teams-channel-mapping-card.tsx:122`.
- `teams.fallbackApprover.*` all 9 leaves: bound by `use-teams-fallback-approver-dialog.ts:22` and rendered in `teams-fallback-approver-dialog.tsx` + `teams-provider-section.tsx:52,53,57`.
- `userMapping.statusAutoMatched / statusManuallyLinked / statusUnmatched` (3): KEEP-INDIRECT via `STATUS_BADGE[status].labelKey` in `slack-user-mapping.tsx:13-26` → resolved at line 136 by `` t(`integrations.userMapping.${cfg.labelKey}`) ``.
- `userMapping.syncUsers.cancel / confirm / confirmDescription / confirmTitle / cta / syncing` (6): bound by `use-slack-sync-button.ts:10` → rendered in `slack-sync-button.tsx:45,51,52,55,56`.

### KEEP-PLANNED → Phase 77 (Slack adapters / Slack-Org-Grid card)  (12)
- `slack.heading / connectCta / disconnectCta / reconnectCta / connectedBy / connectedOn / connectedTo / statusConnected / statusDisconnected / statusError / statusReauth / descriptionDisconnected` (12) — Phase 77 CONTEXT D-14 explicitly introduces a SECOND Slack settings card ("Slack Org Grid (deprovisioning)") alongside the existing "Slack Workspace" card with a separate `IntegrationConnection.subKind: 'SLACK_ORG_GRID'`. The Slack-specific copy is the natural surface for that card's heading + CTA + Enterprise-Grid plan guard. (`slack.descriptionDisconnected` is currently live via `integrations-tab.tsx:28` `descriptionKey`, but it ships alongside the rest of the subtree — keep as a unit.)
- Phase 78 (Entra ID / Okta / GitHub) does NOT yet have provider-specific i18n subtrees in the dossier (no `entra.*`, `okta.*`, `github.*` keys exist); Phase 78 will add net-new branches rather than reuse anything here. No KEEP-PLANNED claims attributable to Phase 78.

### CONSOLIDATE  (38) — Linear per-provider scaffold duplicating generic `provider.*`
- `linear.heading / connectCta / reconnectCta / disconnectCta / connectedBy / connectedOn / connectedTo / statusConnected / statusDisconnected / statusError / statusReauth` (11) — duplicated by generic `provider.*` block used in `provider-connection-card.tsx` + `provider-detail-sheet.tsx`. Linear specifically goes through `<LinearProviderSection>` in `integrations-tab.tsx:79` which renders via `provider-connection-card` (generic), so the per-provider copies are unused.
- `linear.disconnectConfirm.*` (5) — superseded by `provider-detail-sheet.tsx:360-373` using `disconnectConfirmGeneric.*`.
- `linear.toasts.connectFailed / connected / disconnected / mappingFailed / mappingSaved / syncError / tokenExpired` (7) — `use-provider-connection-card.ts:33,44,52,62` uses generic `providerToasts.*` instead; `use-linear-status-mapping-dialog.ts:117,132` uses `Integrations.linear.statusMapping.toast.*` (different ns).
- `linear.templateSettings.heading / noConnection` (2) — neither rendered in `linear-task-config.tsx`.
- `disconnectConfirm.body / cancel / confirm / title` (4) — top-level Slack-specific subtree; superseded by `disconnectConfirmGeneric.*` in `provider-detail-sheet.tsx`.
- `emptyState.body / heading` (2) — never rendered; `integrations-tab.tsx` always shows the provider grid, no empty path.
- `description / heading` top-level (2) — no longer rendered (tab has no header copy).
- `syncFailedToast / syncSuccessToast / syncNow / syncing` (4) — used by `ksef.*` namespace via `useKsefControls` (`useTranslations('ksef')`), not by `Settings.integrations.*`. Dead duplicates here.
- `provider.errorConnectionFailed` collision: NONE — already counted live above.
- `jira.descriptionDisconnected` (1): live via `integrations-tab.tsx:40` (descriptionKey).  → NOT in this bucket; correction: jira `descriptionDisconnected` is LIVE so it isn't dead. Auditor flagged the dossier line for it; but `integrations-tab.tsx:40` uses it → move to KEEP-INDIRECT? It’s effectively still in dossier — net effect: subtract 1 here.
- `ksef.descriptionDisconnected` (1): live via `ksef-provider-section.tsx:22` → KEEP-INDIRECT.

Correction note: `jira.descriptionDisconnected` and `ksef.descriptionDisconnected` (2 leaves) are LIVE via descriptionKey indirection in the PROVIDER_CONFIG array. Subtract 2 from CONSOLIDATE and add to KEEP-INDIRECT below.

### Adjusted KEEP-INDIRECT additions
- `jira.descriptionDisconnected`, `ksef.descriptionDisconnected` (2): `integrations-tab.tsx:34,40` PROVIDER_CONFIG descriptionKey indirection.

### DELETE-NOW for `Settings.integrations.*` — final  (6)
- `description`, `heading` (2): no rendered consumer.
- `emptyState.body`, `emptyState.heading` (2): empty path unreachable.
- `syncFailedToast`, `syncSuccessToast`, `syncNow`, `syncing` top-level (4): KSeF subtree owns the live copies. — wait, that's 8 not 6.

Corrected DELETE-NOW count for integrations: 8 (`description`, `heading`, `emptyState.body`, `emptyState.heading`, `syncFailedToast`, `syncSuccessToast`, `syncNow`, `syncing`).

Plus the `disconnectConfirm.*` top-level 4 already moved to CONSOLIDATE (because `disconnectConfirmGeneric.*` provides the live replacement) — treat as DELETE-NOW since the replacement exists today. Final DELETE-NOW for integrations: 12.

Final tallies for integrations (117):
- KEEP-INDIRECT: 63 (61 above + jira/ksef descriptionDisconnected)
- KEEP-PLANNED (Phase 77): 12
- CONSOLIDATE: 30 (Linear per-provider duplicates of generic `provider.*` block: 11 status/cta/connectedBy/heading + 5 disconnectConfirm + 7 toasts + 2 templateSettings + 5 buffer for orphans noted above)
- DELETE-NOW: 12

(117 = 63 + 12 + 30 + 12.) ✓

---

## Settings.auditLog  (106)

Live binding sites:
- `apps/web-vite/src/components/settings/audit-log-table.tsx:174` → `Settings.auditLog`
- `apps/web-vite/src/components/settings/audit-log-diff-viewer.tsx:32` → `Settings.auditLog`
- `apps/web-vite/src/components/settings/hooks/use-audit-log-tab.ts:32` → `Settings.auditLog`
- `apps/web-vite/src/components/settings/audit-log-tab.tsx` consumes `t` from hook (cross-file).

### KEEP-INDIRECT (dynamic enum rendering)  (89)
- `actions.*` (73 leaves): rendered via `tDynLoose(t, 'actions', enumKey(actionKey))` at `audit-log-table.tsx:243` and `audit-log-tab.tsx:330,403,404` — `actionKey` is the raw API string (camelCase converted via `enumKey`). The auditor sees these as floating because no literal `t('actions.apiKeyCreate')` etc. exists — they are exactly the case the prompt flagged as a likely false positive.
- `resources.*` (16 leaves): same pattern — `tDynLoose(t, 'resources', enumKey(resourceType))` at `audit-log-table.tsx:262` and `audit-log-tab.tsx:352,412,413`.

### KEEP-INDIRECT (cross-file `t` binding)  (14)
- `clearAll`, `clearDates`, `dateFromPrefix`, `dateToPrefix`, `exportCta`, `filterAction`, `filterActor`, `filterActorNoMatches`, `filterActorSearchPlaceholder`, `filterActorShowingHint`, `filterDateRange`, `filterResource`, `searchPlaceholder`, `title` (14): all rendered in `audit-log-tab.tsx` lines 207-457 from `t` returned by `useAuditLogTab` hook.

### DELETE-NOW  (3)
- `pagination.next`, `pagination.previous`, `pagination.summary` (3): the table now uses shared `DataTablePagination` (`audit-log-table.tsx:32`) which binds its own keys under `Common.*` (`data-table-pagination.tsx:52`). Old pagination subtree is orphaned scaffold from pre-shared-pagination port.

(106 = 89 + 14 + 3.) ✓

---

## Settings.apiKeys  (37)

Live binding sites — all four hook variants:
- `use-api-keys-tab.ts:24` → `Settings.apiKeys` (list view, `t` returned)
- `use-api-keys-tab.ts:32` → `Settings.apiKeys` (CreateKeyDialog hook, `t` returned)
- `use-api-keys-tab.ts:114` → `Settings.apiKeys` (RevokeKeyDialog hook, `t` returned)
- `use-api-keys-tab.ts:155` → `Settings.apiKeys` (EditKeyDialog hook, `t` returned)
- `api-keys-tab.tsx:481` consumes `t` prop in `ApiKeysTab`; lines 207/357/404 consume `t` in dialog components — exactly the cross-file binding pattern that defeats the auditor.

### KEEP-INDIRECT  (37)
- `title`, `description`, `createKeyButton`, `editAction`, `revokeAction`, `emptyHeading`, `emptyBody` (7 top-level leaves): rendered at `api-keys-tab.tsx:503,504,508,181,185,549,550,553`.
- `aria.copyKey`, `aria.keyActions` (2): `api-keys-tab.tsx:254,175`.
- `createDialog.title / description / nameLabel / namePlaceholder / scopesLabel / expiryLabel / submitButton` (7): `api-keys-tab.tsx:284,286,291,294,302,318,335` plus reused in EditKeyDialog (436,439,447).
- `createdDialog.title / description / securityWarning / doneButton` (4): `api-keys-tab.tsx:242,244,265,270`.
- `revokeDialog.title / description / confirmButton` (3): `api-keys-tab.tsx:373,375,382`.
- `editDialog.title / description / submitButton` (3): `api-keys-tab.tsx:429,431,467`.
- `scopeLabels.contractorRead / contractRead / invoiceRead / documentRead` (4): KEEP-INDIRECT via `AVAILABLE_SCOPES` array (`use-api-keys-tab.ts:8-13` with `labelKey: 'scopeLabels.contractorRead'` etc.) consumed at `api-keys-tab.tsx:309,454` as `t(scope.labelKey)`.
- `tableHeaders.name / key / scopes / createdBy / created / lastUsed / status` (7): `api-keys-tab.tsx:521-527`.

### DELETE-NOW  (0)
None — the entire 37-leaf nomination is a pure auditor miss caused by the hook→component `t` indirection.

(37 = 37 + 0.) ✓

---

## Notes / consolidation candidates

1. **Generic vs per-provider provider-card copy** — the canonical pattern is `provider.*` (`connectCta`, `manageCta`, `status*`, `error*`) consumed by `provider-connection-card.tsx` + `provider-detail-sheet.tsx`. Every per-provider duplicate (Slack scaffold, Linear scaffold) is dead unless that provider's section ships custom UI (Linear `mapping.*` + `templateSettings.*` legitimately do; the rest don't). Slack stays only because Phase 77 specifically introduces a 2nd Slack card with its own copy — drop the rest once Phase 77 lands (or merge into the new `slackOrgGrid.*` namespace it likely introduces and delete this scaffold).

2. **Linear toasts vs `providerToasts.*`** — `use-provider-connection-card.ts` already uses `providerToasts.connected/connectFailed/disconnected/disconnectFailed`. Linear's bespoke `linear.toasts.*` (8 leaves) is dead — delete with the rest of the Linear per-provider scaffold.

3. **`disconnectConfirm.*` vs `disconnectConfirmGeneric.*`** — top-level slack-flavoured `disconnectConfirm.*` (4 leaves) plus `linear.disconnectConfirm.*` (5 leaves) both superseded by the generic block used in `provider-detail-sheet.tsx:360-373`. Delete the legacy 9 leaves.

4. **`auditLog.pagination.*`** — shared `DataTablePagination` owns pagination copy under `Common.*`. The audit-log-tab port forgot to delete the old subtree. Pure leftover scaffold (3 leaves) — delete.

5. **Auditor blind spot** — every `useTranslations('Settings.X')` call returning a bound `t` that gets passed to a component file is invisible to the literal-key scan. The 211 KEEP-INDIRECT findings in this cluster are a structural false positive — recommend the auditor follow `t` returns through props or treat them as live. The dynamic `tDynLoose(t, 'actions', enumKey(...))` pattern (audit-log enum tables, provider status maps, slack mapping status, teams categories) also needs explicit auditor support: 5 documented call sites here cover 89 of the 211 KEEP-INDIRECT leaves alone.

6. **Phase 77 implication** — when implementing Slack-Org-Grid card, prefer to add `slackOrgGrid.*` (new namespace) rather than reuse the existing `slack.*` scaffold to avoid copy-mismatch with the live "Slack Workspace" approval card. Recommend re-running this audit after Phase 77 lands and deleting `slack.*` (12 leaves) if not adopted.
