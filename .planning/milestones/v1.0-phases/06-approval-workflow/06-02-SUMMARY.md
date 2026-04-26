---
phase: 06-approval-workflow
plan: 02
subsystem: ui
tags: [react, settings, approval-chains, react-hook-form, zod, shadcn, condition-builder]

requires:
  - phase: 06-approval-workflow
    provides: Approval tRPC router with chain CRUD, listChains, createChain, updateChain, deleteChain procedures
  - phase: 01-foundation-auth
    provides: Settings page with Tabs component, user list endpoint
provides:
  - Settings > Approvals tab with chain list (CRUD UI)
  - ChainEditorDialog component for create/edit with level cards and condition builder
  - ConditionBuilder component for amount/contractor type routing conditions
affects: [06-03, 06-04, 06-05]

tech-stack:
  added: []
  patterns: [chain-editor-local-wizard-schema, user-picker-command-popover, condition-builder-dynamic-rows]

key-files:
  created:
    - apps/web/src/components/settings/approval-chains-tab.tsx
    - apps/web/src/components/settings/chain-editor-dialog.tsx
    - apps/web/src/components/settings/condition-builder.tsx
  modified:
    - apps/web/src/app/[locale]/(dashboard)/settings/page.tsx

key-decisions:
  - "Local wizard Zod schema mirroring validators/approval.ts (consistent with Phase 02-02 and 03-04 pattern)"
  - "User picker uses Popover+Command with base-ui render prop pattern for PopoverTrigger (consistent with project conventions)"
  - "ChainData type uses any for conditionsJson/stepsJson to avoid Prisma JsonValue type narrowing complexity"
  - "user.list returns nested member objects; UserPicker maps m.userId + m.user.name/email for flat display"

patterns-established:
  - "ChainEditorDialog: form reset on open with chainData prop for edit mode, null for create mode"
  - "ConditionBuilder: controlled component with value/onChange pattern for dynamic field/operator/value rows"

requirements-completed: [ORG-08]

duration: 6min
completed: 2026-03-21
---

# Phase 06 Plan 02: Approval Chain Settings UI Summary

**Settings > Approvals tab with chain list cards, chain editor dialog (1-3 level cards with user/role approver picker, SLA, required toggle), and condition builder for routing rules**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-21T22:27:58Z
- **Completed:** 2026-03-21T22:34:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Approvals tab added to Settings page between General and Members tabs
- Chain list with Card-based layout showing name, Default badge, active Switch toggle, level count, condition summary, edit/delete actions
- Chain editor dialog (640px, max-h-80vh) with React Hook Form + Zod for create/edit with 1-3 stacked level cards
- ConditionBuilder component with dynamic rows for amount threshold and contractor type routing conditions
- UserPicker with Command search over org members for user-based approver selection

## Task Commits

Each task was committed atomically:

1. **Task 1: Approval chains tab and chain list in Settings** - `a1e8dda` (feat)
2. **Task 2: Chain editor dialog with level cards and condition builder** - `aa5bbea` (feat)

## Files Created/Modified
- `apps/web/src/components/settings/approval-chains-tab.tsx` - Chain list with loading/empty/populated states, active toggle, delete confirmation
- `apps/web/src/components/settings/chain-editor-dialog.tsx` - Chain create/edit dialog with level cards, approver picker, SLA, conditions
- `apps/web/src/components/settings/condition-builder.tsx` - Dynamic condition rows (field, operator, value) with add/remove
- `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx` - Added Approvals tab between General and Members

## Decisions Made
- Local wizard Zod schema mirrors validators/approval.ts (same pattern as Phase 02-02 and 03-04)
- UserPicker maps nested member objects (m.userId + m.user.name/email) since user.list returns Better Auth member structure
- ChainData type uses `any` for JSON fields to avoid Prisma JsonValue narrowing complexity across the component boundary
- Used base-ui render prop pattern for PopoverTrigger (consistent with project conventions per Phase 02-03 decision)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Built API package to update dist types for trpc.approval**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** trpc.approval was not recognized because API package dist was stale
- **Fix:** Ran turbo build --filter=@contractor-ops/api to regenerate dist types
- **Files modified:** None (build output only)
- **Verification:** TypeScript compiles cleanly
- **Committed in:** a1e8dda (Task 1 commit)

**2. [Rule 1 - Bug] Fixed user.list data shape mapping in UserPicker**
- **Found during:** Task 2 (TypeScript verification)
- **Issue:** user.list returns nested member objects {id, userId, role, user: {name, email}} not flat {id, name, email, role}
- **Fix:** Added mapping layer to extract userId, user.name, user.email from member objects
- **Files modified:** apps/web/src/components/settings/chain-editor-dialog.tsx
- **Verification:** TypeScript compiles cleanly
- **Committed in:** aa5bbea (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for type safety and correct data access. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components are fully wired to tRPC procedures from Plan 01.

## Next Phase Readiness
- Chain configuration UI complete, ready for approval queue page (Plan 03) and approval actions (Plan 04)
- ChainEditorDialog and ConditionBuilder can be reused if chain editing is needed elsewhere

## Self-Check: PASSED

All 4 files exist. Both commit hashes (a1e8dda, aa5bbea) verified in git log.

---
*Phase: 06-approval-workflow*
*Completed: 2026-03-21*
