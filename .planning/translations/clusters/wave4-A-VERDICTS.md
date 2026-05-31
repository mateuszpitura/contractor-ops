# Wave 4-A — Workflows / Admin verdicts

## Summary
- Total candidates: 38
- DELETE-NOW: 31
- KEEP-PLANNED: 0
- KEEP-INDIRECT: 7
- CONSOLIDATE: 0

Note: cluster contains only `Workflows.*` keys (no `Admin.*` in the dossier).

## Per sub-NS

### Workflows.overrideBlockingTask (7 leaves)
- Verdict: KEEP-INDIRECT (all 7 are live; auditor missed scope-rebind)
- Evidence:
  - `apps/web-vite/src/components/workflows/workflow-run/run-header.tsx:54` rebinds `const t = useTranslations('Workflows.overrideBlockingTask')` and calls `t('warning')`, `t('reasonLabel')`, `t('reasonHelp', {min,max})`, `t('acknowledge')`, `t('confirmCta')` (lines 94, 99, 110, 121, 130).
  - `apps/web-vite/src/components/workflows/hooks/use-workflow-ui.ts:226` rebinds same scope and calls `t('toastSuccess')` (line 233) + `t('toastFailure')` (line 240).
  - Phase 74 plan (`.planning/phases/74-*/74-08-PLAN.md`) ships this dialog.

### Workflows.pagination.selected (1 leaf)
- Verdict: DELETE-NOW
- Evidence: `workflow-runs-table/data-table.tsx:104-108` uses only `pagination.rowsPerPage` and `pagination.page`. No `pagination.selected` reference in `apps/web-vite/src` or planning/phases/72-75.
- DELETE list:
Workflows.pagination.selected

### Workflows.sidePanel.{startedBy,template} (2 leaves)
- Verdict: DELETE-NOW
- Evidence: `workflow-side-panel.tsx:116` rebinds `Workflows.sidePanel` and only uses `progress`, `tasksComplete`, `tasksSummary`, `contractor`, `startedOn`, `openWorkflow`. Linked-Jira/Linear panels do not reference `startedBy` or `template` either. `run-header.tsx:213` uses `Workflows.startedByLabel` (top-level, different key). No phase plan refs.
- DELETE list:
Workflows.sidePanel.startedBy
Workflows.sidePanel.template

### Workflows top-level: empty* / filter* / search* / toast* / editTemplateTitle (16 leaves)
- Verdict: DELETE-NOW
- Evidence:
  - `EmptyStates.{workflows,myTasks,templates}` are the live empty-state keys (see `templates-table.tsx:146`, `my-tasks-list.tsx:75`, `workflows-list-container.tsx:33`). The legacy `Workflows.emptyRuns*/emptyTasks*/emptyTemplates*` are fully superseded.
  - Zero references to `editTemplateTitle`, `filterContractor`, `filterStatus`, `searchTemplates`, `toastTaskRemoved`, `toastTemplateActivated`, `toastTemplateArchived`, `toastWorkflowStarted` anywhere under `apps/`, `packages/`, `.planning/phases/72-75`.
  - Live toast keys are `toastTemplateSaved/Deleted/Duplicated`, `toastWorkflowCancelled`, `toastTaskSkipped/Reassigned/Completed` (see `use-workflow-ui.ts`).
- DELETE list:
Workflows.editTemplateTitle
Workflows.emptyRunsBody
Workflows.emptyRunsCta
Workflows.emptyRunsHeading
Workflows.emptyTasksBody
Workflows.emptyTasksHeading
Workflows.emptyTemplatesBody
Workflows.emptyTemplatesCta
Workflows.emptyTemplatesHeading
Workflows.filterContractor
Workflows.filterStatus
Workflows.searchTemplates
Workflows.toastTaskRemoved
Workflows.toastTemplateActivated
Workflows.toastTemplateArchived
Workflows.toastWorkflowStarted

### Workflows.validation* (12 leaves)
- Verdict: DELETE-NOW
- Evidence: Grep across `apps/` and `packages/` for each leaf returns zero hits. The only live validation* key in workflows is `validationTemplateNameRequired` (`template-form.tsx:184`). No `tDyn*` resolver targets `validation.*`. No phase plan (72-75) references these keys.
- DELETE list:
Workflows.validationAssigneeMode
Workflows.validationCommentBody
Workflows.validationConditionField
Workflows.validationConditionOperator
Workflows.validationConditionValue
Workflows.validationDueOffset
Workflows.validationRole
Workflows.validationSkipReason
Workflows.validationTaskTitleRequired
Workflows.validationTaskType
Workflows.validationTemplateType
Workflows.validationUser

## Notes
- `Workflows.conditionField.*`, `conditionValue.*`, `taskType.*`, `assigneeMode.*`, `operator.*`, `templateType.*`, `templateStatus.*`, `runStatus.*` subtrees are all reached via `tDynLoose(t, '<sub>', enumKey(x))` / `tKey(t, 'conditionField.${field}')` in `condition-builder.tsx`, `task-card.tsx`, `template-form.tsx`, `templates-table.tsx`, `template-picker-dialog.tsx`, `workflow-side-panel.tsx`, `workflow-runs-table/columns.tsx`, `workflow-runs-table/data-table-filters.tsx`, `workflow-run/task-card-run.tsx`, `workflow-run/run-header.tsx` — none of those subtree leaves are in this cluster, so no action needed.
- No `Admin.BoeRate.*` / `Admin.ClassificationEngineFlag.*` / singular `Workflow.*` leaves present in the dossier despite prompt hints — Wave-1D already cleared Admin residuals.
- DELETE-NOW total ready for `scripts/delete-i18n-keys.ts`: 31 keys (1 pagination + 2 sidePanel + 16 top-level + 12 validation).
