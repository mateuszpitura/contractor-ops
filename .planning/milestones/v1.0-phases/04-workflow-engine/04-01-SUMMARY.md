---
phase: 04-workflow-engine
plan: 01
subsystem: api
tags: [trpc, zod, workflow, prisma, state-machine, conditional-logic]

# Dependency graph
requires:
  - phase: 03-contracts-documents
    provides: contract and contractor models, document components, tRPC router patterns
provides:
  - Zod validators for all workflow operations (template CRUD, run lifecycle, task actions, comments)
  - Complete workflow tRPC router with 16 procedures
  - Condition evaluator (AND/OR rule engine) for task auto-skip
  - Assignee resolver (role-based, owner-based) for runtime assignment
  - Task status transition state machine
  - Progress calculator excluding condition-skipped tasks
affects: [04-02, 04-03, 04-04, 04-05, 05-invoice-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [condition-evaluator-pure-function, task-status-state-machine, progress-calculator-excluding-auto-skipped, assignee-resolver-switch, addDays-inline-helper]

key-files:
  created:
    - packages/validators/src/workflow.ts
    - packages/api/src/routers/workflow.ts
  modified:
    - packages/validators/src/index.ts
    - packages/api/src/root.ts

key-decisions:
  - "Inline addDays/addHours helpers instead of date-fns dependency in api package"
  - "configJson uses undefined fallback (Prisma column default NULL) since Prisma namespace is type-only export"
  - "Status variable uses 'as const' assertion for Prisma enum type safety"
  - "Condition-skipped tasks excluded from both progress numerator and denominator"

patterns-established:
  - "evaluateCondition: pure function with dot-notation field access for AND/OR rule evaluation"
  - "resolveAssignee: switch-based resolver for 5 assignee modes"
  - "TASK_TRANSITIONS: Record-based state machine for task status changes"
  - "calculateProgress: excludes condition_not_met skipped tasks from total"

requirements-completed: [WKFL-01, WKFL-02, WKFL-03, WKFL-04, WKFL-05, WKFL-06, WKFL-07, WKFL-08, WKFL-09, WKFL-10, ORG-09]

# Metrics
duration: 7min
completed: 2026-03-20
---

# Phase 4 Plan 1: Workflow Backend Summary

**Complete workflow tRPC router with template CRUD, run lifecycle, task actions, condition evaluator, assignee resolver, and overdue detection**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-20T16:16:46Z
- **Completed:** 2026-03-20T16:23:27Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- All 21 Zod validator schemas for workflow domain with inferred TypeScript types
- 16 tRPC procedures covering template CRUD, run lifecycle, task actions, comments, and overdue count
- Pure-function condition evaluator supporting AND/OR combinators with dot-notation field access
- Role-based assignee resolver with 5 assignee modes (FIXED_USER, ROLE_BASED, CONTRACTOR_OWNER, CONTRACT_OWNER, PROJECT_MANAGER)
- Task status state machine with validated transitions
- Progress calculator that correctly excludes condition-skipped tasks

## Task Commits

Each task was committed atomically:

1. **Task 1: Create workflow Zod validators** - `318a025` (feat)
2. **Task 2: Create workflow tRPC router with all procedures** - `b31686c` (feat)

## Files Created/Modified
- `packages/validators/src/workflow.ts` - All Zod schemas for workflow domain (enums, conditions, templates, runs, tasks, comments)
- `packages/validators/src/index.ts` - Re-exports all workflow schemas and types
- `packages/api/src/routers/workflow.ts` - Complete workflow tRPC router (16 procedures + 5 helper functions)
- `packages/api/src/root.ts` - Registered workflowRouter in appRouter

## Decisions Made
- Used inline addDays/addHours helpers instead of adding date-fns as api package dependency (avoids new dependency for 2 simple functions)
- Used `undefined` fallback for nullable JSON fields since `Prisma` namespace is exported as type-only from db package (Prisma treats undefined as column default NULL)
- Used `as const` assertion for task status variables to satisfy Prisma enum type constraints
- Condition-skipped tasks (resultJson.skipReason === "condition_not_met") excluded from both progress numerator and denominator per plan spec

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Prisma JSON null type incompatibility**
- **Found during:** Task 2 (workflow router)
- **Issue:** `configJson: task.conditions ?? null` failed TypeScript because Prisma requires `Prisma.JsonNull` sentinel for JSON null, but `Prisma` is exported as type-only from db package
- **Fix:** Used `?? undefined` which tells Prisma to use column default (NULL for nullable fields)
- **Files modified:** packages/api/src/routers/workflow.ts
- **Verification:** TypeScript compilation passes cleanly
- **Committed in:** b31686c (Task 2 commit)

**2. [Rule 1 - Bug] Fixed ctx.user possibly null TypeScript error**
- **Found during:** Task 2 (workflow router)
- **Issue:** `ctx.user.id` errored because `ctx.user` type includes null, even though tenantProcedure guarantees it exists
- **Fix:** Used `ctx.user!.id` non-null assertion matching existing document router pattern
- **Files modified:** packages/api/src/routers/workflow.ts
- **Verification:** TypeScript compilation passes cleanly
- **Committed in:** b31686c (Task 2 commit)

**3. [Rule 1 - Bug] Fixed task status string not assignable to WorkflowTaskStatus enum**
- **Found during:** Task 2 (workflow router)
- **Issue:** `let status: string` assigned "SKIPPED"/"BLOCKED"/"TODO" but Prisma expects the exact WorkflowTaskStatus enum type
- **Fix:** Used ternary with `as const` assertions to preserve literal types
- **Files modified:** packages/api/src/routers/workflow.ts
- **Verification:** TypeScript compilation passes cleanly
- **Committed in:** b31686c (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All auto-fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
- Validators package needed to be built (`pnpm build`) before api package could resolve imports -- standard monorepo behavior, resolved by running build before type check.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Workflow backend is complete and type-safe, ready for UI development in Plans 02-05
- All 11 phase requirements have corresponding server-side procedures
- Template CRUD, run lifecycle, and task actions are all transactional with proper tenant isolation and RBAC

---
*Phase: 04-workflow-engine*
*Completed: 2026-03-20*
