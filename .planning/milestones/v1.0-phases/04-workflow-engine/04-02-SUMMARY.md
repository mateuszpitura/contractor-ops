---
phase: 04-workflow-engine
plan: 02
subsystem: ui
tags: [react, dnd-kit, sortable, react-hook-form, next-intl, i18n, template-builder, condition-builder]

# Dependency graph
requires:
  - phase: 04-workflow-engine
    provides: workflow tRPC router with template CRUD mutations, Zod validators
provides:
  - Template builder page at /workflows/templates/new and /workflows/templates/[id]
  - Drag-to-reorder sortable task list using @dnd-kit/sortable
  - Collapsible task cards with all fields (title, type, assignee, due offset, dependency, conditions)
  - AND/OR condition rule builder for conditional task logic
  - Form state management with useFieldArray, dirty tracking, beforeunload warning
  - Complete Phase 4 i18n translations (245 keys in EN and PL)
affects: [04-03, 04-04, 04-05]

# Tech tracking
tech-stack:
  added: ["@dnd-kit/core@6.3.1", "@dnd-kit/sortable@10.0.0", "@dnd-kit/utilities@3.2.2"]
  patterns: [sortable-task-list-dnd-kit, collapsible-task-card, condition-builder-and-or, template-form-hook-useFieldArray, flat-i18n-namespace]

key-files:
  created:
    - apps/web/src/components/workflows/template-builder/template-form.tsx
    - apps/web/src/components/workflows/template-builder/sortable-task-list.tsx
    - apps/web/src/components/workflows/template-builder/task-card.tsx
    - apps/web/src/components/workflows/template-builder/condition-builder.tsx
    - apps/web/src/components/workflows/template-builder/use-template-form.ts
    - apps/web/src/app/[locale]/(dashboard)/workflows/templates/new/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/workflows/templates/[id]/page.tsx
  modified:
    - apps/web/package.json
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "Flat i18n key namespace in Workflows (not nested) for template builder keys -- consistent with how dynamic keys like taskType_MANUAL are referenced"
  - "Translations added to existing messages/{locale}.json files (not separate per-namespace files) following established project convention"
  - "@dnd-kit/sortable v10 with drag handle restricted to GripVertical button only (activationConstraint + separate listeners prop)"

patterns-established:
  - "useTemplateForm: custom hook wrapping useForm + useFieldArray with zodResolver, dirty tracking, beforeunload"
  - "SortableTaskList: DndContext + SortableContext with verticalListSortingStrategy, drag handle via separate listeners prop"
  - "ConditionBuilder: AND/OR toggle between rows, enum fields use Select, string fields use Input"
  - "TaskCard: Collapsible with collapsed summary (title + badges) and expanded edit form"

requirements-completed: [WKFL-01, WKFL-02, WKFL-03, WKFL-04, ORG-09]

# Metrics
duration: 12min
completed: 2026-03-20
---

# Phase 4 Plan 2: Template Builder Summary

**Workflow template builder with dnd-kit sortable task list, collapsible task cards, AND/OR condition builder, and 245-key EN/PL i18n translations**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-20T16:26:04Z
- **Completed:** 2026-03-20T16:38:36Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Template builder pages at /workflows/templates/new and /workflows/templates/[id] with breadcrumb navigation
- Drag-to-reorder task list using @dnd-kit/sortable with GripVertical handle, keyboard support, and pointer sensor
- Collapsible task cards showing summary when collapsed (title, type badge, assignee, due offset, required, condition badge) and full edit form when expanded
- AND/OR condition rule builder supporting 8 condition fields, 4 operators, with enum/string value inputs
- useTemplateForm hook with React Hook Form useFieldArray, Zod validation, dirty state tracking, and beforeunload warning
- Template lifecycle actions: save (create/update), activate, archive (with confirmation), duplicate, delete (draft only, with confirmation)
- 245 i18n keys in Workflows namespace for both EN and PL covering all Phase 4 UI

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dnd-kit and create template builder components** - `b6d3cc9` (feat) -- components created as part of 04-03 plan wave
2. **Task 2: Create template builder pages and full i18n translations** - `1e80bac` (docs) -- pages and i18n completed in 04-03 plan execution

_Note: Plan 04-02 work was completed as part of the 04-03 plan execution which ran in the same wave. All acceptance criteria verified._

## Files Created/Modified
- `apps/web/src/components/workflows/template-builder/template-form.tsx` - Template header form with save/activate/archive/duplicate/delete
- `apps/web/src/components/workflows/template-builder/sortable-task-list.tsx` - DndContext + SortableContext with vertical sorting strategy
- `apps/web/src/components/workflows/template-builder/task-card.tsx` - Collapsible task card with all editable fields
- `apps/web/src/components/workflows/template-builder/condition-builder.tsx` - AND/OR rule builder with field/operator/value rows
- `apps/web/src/components/workflows/template-builder/use-template-form.ts` - Form hook with useFieldArray, dirty tracking, beforeunload
- `apps/web/src/app/[locale]/(dashboard)/workflows/templates/new/page.tsx` - New template page with breadcrumb
- `apps/web/src/app/[locale]/(dashboard)/workflows/templates/[id]/page.tsx` - Edit template page with breadcrumb
- `apps/web/package.json` - Added @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- `apps/web/messages/en.json` - 245 Workflows namespace keys (EN)
- `apps/web/messages/pl.json` - 245 Workflows namespace keys (PL)

## Decisions Made
- Used flat i18n key namespace (e.g., `taskType_MANUAL`, `assigneeMode_ROLE_BASED`) rather than nested objects for dynamic key interpolation convenience
- Added translations to existing `messages/{locale}.json` files following established convention (plan specified `src/messages/en/Workflows.json` which doesn't match project structure)
- @dnd-kit/sortable v10 with pointer sensor (8px activation constraint) to prevent accidental drags when clicking to expand

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] i18n file path correction**
- **Found during:** Task 2
- **Issue:** Plan specified `apps/web/src/messages/en/Workflows.json` as separate file, but project uses single `apps/web/messages/{locale}.json` with namespaced keys
- **Fix:** Added Workflows keys to existing en.json and pl.json files
- **Files modified:** apps/web/messages/en.json, apps/web/messages/pl.json
- **Verification:** 245 keys match exactly between EN and PL
- **Committed in:** 1e80bac

---

**Total deviations:** 1 auto-fixed (1 blocking - file path mismatch)
**Impact on plan:** Necessary correction to follow established project convention. No scope creep.

## Issues Encountered
- Plan 04-02 work was already completed as part of the 04-03 plan execution which ran concurrently. All files and translations were already in HEAD. Verified all acceptance criteria pass.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Template builder is complete and type-safe, ready for workflow run detail page (Plan 04-04)
- All Phase 4 i18n translations are in place for remaining plans
- dnd-kit installed and pattern established for any future sortable lists

---
*Phase: 04-workflow-engine*
*Completed: 2026-03-20*
