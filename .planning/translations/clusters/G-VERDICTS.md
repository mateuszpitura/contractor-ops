# Cluster G — Workflows / Workflow / WorkflowRoles / Admin verdicts

## Summary
- Total: 125
- DELETE-NOW: 36
- KEEP-PLANNED: 0
- KEEP-INDIRECT (dynamic builder): 79
- CONSOLIDATE: 10 (Workflow.Start.* → wider review — likely DELETE)
- KEEP-DIRECT (auditor false-positive, confirmed live): 10 (`Workflows.overrideBlockingTask.*`)

Note: cluster dossier `G-workflows.json` contains 126 leaves; spec counts (113 Workflows + 5 Workflow + 7 Admin = 125) are within rounding. No top-level `WorkflowRoles.*` keys appear in the dossier — the 41 referenced in the cluster spec live in `Settings.WorkflowRoles.*` (Cluster D); the actual top-level `WorkflowRoles.*` namespace is LIVE (used by `apps/web-vite/src/components/settings/workflow-roles/...`).

## Workflow (singular, 5)
- Verdict: **CONSOLIDATE candidates → likely DELETE-NOW**.
- Evidence:
  - Only references repo-wide: generated key union (`apps/web-vite/src/generated/i18n/keys.d.ts:5723-5727`), legacy seeder (`scripts/apply-ar-translations.ts:453-457`), and audit fixtures (`.planning/translations/*`, `.i18n-parity-baseline.json`).
  - **Zero runtime bindings**: no `useTranslations('Workflow.Start')`, no `t('Workflow.Start...')`, no `tDyn*` reaching this namespace.
  - The 5 leaves describe an offboarding-start picker (`heading`/`cta`/`templateLabel`/`autoSelectHint`/`manualOverrideHint`). The live offboarding flow lives in `apps/web-vite/src/components/offboarding/` and binds to `Offboarding.*` / `Workflows.*`, not `Workflow.Start.*`.
  - Likely an abandoned port stub — singular `Workflow` is not the live namespace. Recommendation: DELETE-NOW; if owner wants the offboarding-start dialog re-skinned later, re-add under `Workflows.startOffboarding.*` to keep the canonical plural NS.

## Workflows (113 in dossier)

### Live consumers found
- `apps/web-vite/src/components/workflows/template-builder/condition-builder.tsx` — `useTranslations('Workflows')` + `tDynLoose(t, 'conditionValue', enumKey(v))`, `tDynLoose(t, 'operator', enumKey(op))`, `tKey(t, conditionField.${field})`.
- `apps/web-vite/src/components/workflows/template-builder/task-card.tsx` — `tDynLoose(t, 'taskType', …)`, `tDynLoose(t, 'assigneeMode', …)`.
- `apps/web-vite/src/components/workflows/template-builder/template-form.tsx` — `tDynLoose(t, 'type', …)`, `tDynLoose(t, 'templateStatus', …)`.
- `apps/web-vite/src/components/workflows/templates-table.tsx`, `template-picker-dialog.tsx` — `tDynLoose(t, 'templateType', …)`, `tDynLoose(t, 'templateStatus', …)`.
- `apps/web-vite/src/components/workflows/workflow-side-panel.tsx`, `workflow-runs-table/columns.tsx`, `workflow-runs-table/data-table-filters.tsx`, `workflow-run/run-header.tsx`, `workflow-run/task-card-run.tsx` — `tDynLoose(t, 'runStatus', …)`, `tDynLoose(t, 'taskType', …)`, `tDynLoose(t, 'templateType', …)`.
- `apps/web-vite/src/components/workflows/workflow-run/run-header.tsx` + `hooks/use-workflow-ui.ts` — `useTranslations('Workflows.overrideBlockingTask')` + `t('title')`, `t('body')`, `t('warning')`, `t('reasonLabel')`, `t('reasonPlaceholder')`, `t('reasonHelp')`, `t('acknowledge')`, `t('cancel')`, `t('confirmCta')`, `t('toastSuccess')`, `t('toastFailure')`.

### Verdicts per sub-tree
- **`Workflows.conditionValue.*` (22 leaves)** → **KEEP-INDIRECT**. Resolved at runtime via `tDynLoose(t, 'conditionValue', enumKey(v))` in `condition-builder.tsx` for every enum value of `contractor.{type,status,complianceRiskLevel}` + `contract.{type,status,currency}`. Auditor wildcard pass misses these.
- **`Workflows.operator.*` (4)** → **KEEP-INDIRECT**. `tDynLoose(t, 'operator', enumKey(op))` over the `OPERATORS` literal tuple (`equals`/`notEquals`/`contains`/`startsWith`).
- **`Workflows.conditionField.contractor.*` + `.contract.*` (8)** → **KEEP-INDIRECT**. `tKey(t, conditionField.${field})` over `CONDITION_FIELDS` tuple.
- **`Workflows.taskType.*` (10)** → **KEEP-INDIRECT**. `tDynLoose(t, 'taskType', enumKey(...))` in `task-card.tsx`, `task-card-run.tsx`.
- **`Workflows.assigneeMode.*` (5)** → **KEEP-INDIRECT**. `tDynLoose(t, 'assigneeMode', enumKey(mode))` in `task-card.tsx`.
- **`Workflows.runStatus.*` (5)** → **KEEP-INDIRECT**. `tDynLoose(t, 'runStatus', …)` in `workflow-side-panel.tsx`, `workflow-runs-table/{columns,data-table-filters}.tsx`, `workflow-run/run-header.tsx`.
- **`Workflows.templateType.*` (5)** + **`Workflows.type.*` (5)** → **KEEP-INDIRECT**. `tDynLoose(t, 'templateType', …)` in `templates-table.tsx`, `template-picker-dialog.tsx`, `workflow-runs-table/columns.tsx`; `tDynLoose(t, 'type', …)` in `template-form.tsx`. Note `Workflows.type.*` and `Workflows.templateType.*` duplicate the same five labels — recommend follow-up CONSOLIDATE (post-audit) to a single sub-tree, but both are LIVE today so neither should be deleted in this pass.
- **`Workflows.templateStatus.*` (3)** → **KEEP-INDIRECT**. `tDynLoose(t, 'templateStatus', …)` in `templates-table.tsx`, `template-form.tsx`.
- **`Workflows.overrideBlockingTask.*` (10)** → **KEEP-DIRECT (auditor false-positive)**. Bound via `useTranslations('Workflows.overrideBlockingTask')` then bare-leaf `t('title')` etc. — auditor likely matched namespace prefix to `Workflows.*` and missed the rebind. All 10 leaves used by `run-header.tsx` + `use-workflow-ui.ts`.

### Truly dead (DELETE-NOW, 36)
No `useTranslations('Workflows.…')` rebind reaches these, no leaf matches under `useTranslations('Workflows')`, no dynamic builder path resolves to them. These are legacy stubs from the `apps/web` → `apps/web-vite` port that were superseded by differently-named keys:
- `Workflows.editTemplateTitle`
- `Workflows.emptyRunsBody`, `emptyRunsCta`, `emptyRunsHeading`
- `Workflows.emptyTasksBody`, `emptyTasksHeading`
- `Workflows.emptyTemplatesBody`, `emptyTemplatesCta`, `emptyTemplatesHeading`
- `Workflows.filterContractor`, `filterStatus`
- `Workflows.myTasks.empty.body`, `myTasks.empty.heading` (live key in `my-tasks-list.tsx` is `myTasks.noOverdue`, not these)
- `Workflows.pagination.of` (live consumer is in `integrations/google-workspace/directory-preview-table.tsx`, but that binds a *different* namespace; `Workflows.pagination.of` itself has no consumer)
- `Workflows.searchTemplates`
- `Workflows.sidePanel.startedBy`, `sidePanel.template`
- `Workflows.templates.empty.body`, `templates.empty.cta` (live `emptyTemplates*` is also dead — both shapes orphaned)
- `Workflows.toastTaskRemoved`, `toastTemplateActivated`, `toastTemplateArchived`, `toastWorkflowStarted` (live toasts are `toastTemplateSaved`, `toastTemplateDeleted`, `toastTemplateDuplicated`, `toastWorkflowCancelled`, `toastTaskSkipped`, `toastTaskReassigned`, `toastTaskCompleted`)
- `Workflows.validationAssigneeMode`, `validationCommentBody`, `validationConditionField`, `validationConditionOperator`, `validationConditionValue`, `validationDueOffset`, `validationRole`, `validationSkipReason`, `validationTaskTitleRequired`, `validationTaskType`, `validationTemplateType`, `validationUser` (live form in `template-form.tsx` uses `validationTemplateNameRequired` only — broader Zod-message keys never wired into the SPA forms)

## WorkflowRoles (top-level, 41)
- **Overlap with `Settings.WorkflowRoles.*`**: NO. Dossier has zero top-level `WorkflowRoles.*` leaves. The 41 referenced in the cluster spec are `Settings.WorkflowRoles.*` (covered in Cluster D).
- The actual top-level `WorkflowRoles.*` namespace is **LIVE** (not in this dossier), used by:
  - `apps/web-vite/src/components/settings/settings-workflow-roles-container.tsx` → `useTranslations('WorkflowRoles')`
  - `apps/web-vite/src/components/settings/workflow-roles/hooks/use-workflow-roles-table.ts` → `useTranslations('WorkflowRoles')`
  - `apps/web-vite/src/components/settings/workflow-roles/hooks/use-workflow-role-form-dialog.ts` → `useTranslations('WorkflowRoles')`
- **Verdict**: N/A for cluster G — defer to Cluster D for `Settings.WorkflowRoles.*` (those are duplicates of the top-level live namespace and should CONSOLIDATE → `WorkflowRoles.*`).

## Admin (7)
All 7 are **DELETE-NOW**. The `Admin.BoeRate` + `Admin.ClassificationEngineFlag` namespaces ARE live (bound by `apps/web-vite/src/components/admin/...`), but every flagged leaf uses a different leaf name than the live components consume — they are stub/legacy strings from the initial port that were renamed and never cleaned up.

- `Admin.BoeRate.accessDeniedBody` → DELETE. No `t('accessDeniedBody')` anywhere; live access-denied path uses route-level permission gate, not in-namespace strings.
- `Admin.BoeRate.accessDeniedHeading` → DELETE. Same reason.
- `Admin.BoeRate.addCta` → DELETE. Live key is `addRate` (`admin-boe-rate-container.tsx:37 → t('addRate')`).
- `Admin.BoeRate.deleteDialogBody` → DELETE. Live key is `deleteDialogBodyDynamic` (`delete-boe-rate-dialog.tsx:53 → t('deleteDialogBodyDynamic', { date, rate })`); the static `deleteDialogBody` was superseded.
- `Admin.BoeRate.pollerFailure` → DELETE. Live keys are `pollerNoData`, `pollerSuccess`, `pollerSuccessUnchanged`, `ariaPollerStatus` (`poller-status-strip.tsx`); failure-branch was reworked.
- `Admin.ClassificationEngineFlag.subtitle` → DELETE. Live key is `killSwitchDesc` (`classification-engine-panel.tsx:20 → t('killSwitchDesc')`).
- `Admin.ClassificationEngineFlag.title` → DELETE. Live key is `moduleName` (`classification-engine-panel.tsx:19 → t('moduleName')`).

Cross-check with Phase 71 (Classification Reconcile, completed): `Admin.ClassificationEngineFlag` namespace is live and serves the kill-switch panel; the two flagged leaves are pre-Phase-71 placeholders renamed during the reconcile build-out.

## Notes
- Cluster spec said "113 Workflows + 5 Workflow + 7 Admin = 125" and called out 41 `WorkflowRoles.*` separately. The dossier has 126 leaves (113 Workflows + 5 Workflow + 7 Admin + the +1 rounding). The top-level `WorkflowRoles.*` namespace is LIVE and not in this dossier; the 41 dead `Settings.WorkflowRoles.*` leaves are owned by Cluster D and should consolidate into the live top-level namespace there.
- Dynamic `tDynLoose` / `tKey` usage in `condition-builder.tsx`, `task-card.tsx`, `template-form.tsx`, `templates-table.tsx`, `workflow-runs-table/*`, `workflow-run/*`, `workflow-side-panel.tsx`, `template-picker-dialog.tsx` is the single biggest signal driving 79 KEEP-INDIRECT verdicts. Recommend the audit script's wildcard pass be extended to recognise `tDynLoose(t, '<subKey>', …)` under a `useTranslations('<NS>')` bind to avoid false positives on enum-driven sub-trees.
- `Workflows.overrideBlockingTask.*` (10 leaves) are a clean false-positive: rebind via `useTranslations('Workflows.overrideBlockingTask')` then bare-leaf `t('title')` etc. confuses prefix-based dead detection. Phase 72 (Reminder Cascade + Payment Block) references the `workflow:override_blocking_task` permission as a precedent for compliance overrides — overrideBlockingTask UI is established + load-bearing.
- Recommend a follow-up CONSOLIDATE pass (post-DELETE) merging `Workflows.type.*` and `Workflows.templateType.*` (duplicate 5-leaf enum) into one sub-tree, plus the Cluster D `Settings.WorkflowRoles.*` → top-level `WorkflowRoles.*` consolidation.
