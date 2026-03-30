---
phase: 24-jira-auto-issue-creation-wiring
verified: 2026-03-30T17:00:00Z
status: passed
score: 3/3 must-haves verified
re_verification: false
---

# Phase 24: Jira Auto-Issue Creation Wiring Verification Report

**Phase Goal:** When a workflow starts, tasks with `jiraEnabled: true` in their config automatically create Jira issues via the existing `createJiraIssue` service
**Verified:** 2026-03-30T17:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When startRun creates TODO task runs whose template has `jiraEnabled: true` in configJson, `createJiraIssue` is called fire-and-forget for each | VERIFIED | Lines 721-798 of `workflow.ts`: `jiraEligibleTaskRunIds` Set built inside transaction via `jiraTaskConfigSchema.safeParse`; fire-and-forget block at lines 758-799 calls `createJiraIssue` per eligible TODO task |
| 2 | Jira issue creation failure does not block workflow start | VERIFIED | Each `createJiraIssue` call is attached with `.catch()` (line 784); the outer try/catch at line 792-796 catches setup failures; the entire block is `void (async () => { ... })()` — non-blocking |
| 3 | Created Jira issue key is stored on the task run record (externalRefType/externalRefId set by createJiraIssue service) | VERIFIED | `packages/api/src/services/jira-issue-sync.ts` lines 215-216: `externalRefType: "JIRA_ISSUE"` and `externalRefId: created.key` written via `prisma.workflowTaskRun.update` inside `createJiraIssue` — unchanged from Phase 19, confirmed still present |

**Score:** 3/3 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/api/src/routers/workflow.ts` | Fire-and-forget `createJiraIssue` calls in `startRun` after transaction | VERIFIED | Contains `createJiraIssue` at lines 765, 779; `jiraEligibleTaskRunIds` at lines 721, 727, 732, 760; `jiraTaskConfigSchema` import at line 16 and usage at line 723 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `workflow.ts` (startRun, line 765) | `services/jira-issue-sync.ts` (createJiraIssue) | Dynamic import `"../services/jira-issue-sync.js"` + fire-and-forget void async | WIRED | Dynamic import resolved at runtime; `createJiraIssue` destructured and called at line 779 with `(prisma, ctx.organizationId, connection.id, task.id)` matching the function signature exactly |
| `workflow.ts` (startRun, line 721) | `@contractor-ops/validators` (jiraTaskConfigSchema) | Static import at line 16, `safeParse` at line 723 | WIRED | `jiraTaskConfigSchema` exported from `packages/validators/src/jira.ts:49` and re-exported via `packages/validators/src/index.ts:297` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `workflow.ts` startRun (Jira block) | `jiraEligibleTaskRunIds` | `template.tasks` loaded in transaction (existing DB query), parsed with `jiraTaskConfigSchema.safeParse(taskTemplate.configJson)` | Yes — reads real template data from DB, not hardcoded | FLOWING |
| `jira-issue-sync.ts` createJiraIssue | `externalRefType`, `externalRefId` | Jira API call result (`created.key`), written to DB via `prisma.workflowTaskRun.update` | Yes — real Jira API + DB write | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `createJiraIssue` referenced in workflow.ts | `grep -c "createJiraIssue" packages/api/src/routers/workflow.ts` | 2 matches (import + call site) | PASS |
| `jiraEligibleTaskRunIds` Set built and consumed | `grep -c "jiraEligibleTaskRunIds" packages/api/src/routers/workflow.ts` | 5 matches (Set creation, add, return, filter, usage) | PASS |
| `jiraTaskConfigSchema` imported and used | `grep -c "jiraTaskConfigSchema" packages/api/src/routers/workflow.ts` | 2 matches (import + safeParse) | PASS |
| `[workflow/startRun] Jira issue creation` log prefix present | `grep -c "\[workflow/startRun\] Jira issue creation" packages/api/src/routers/workflow.ts` | 2 matches (task-level + setup-level error logs) | PASS |
| Fire-and-forget block is AFTER TASK_ASSIGNED and BEFORE `return plain` | Line order: TASK_ASSIGNED dispatch lines 735-756, Jira block lines 758-799, return plain line 801 | Ordering confirmed | PASS |
| TypeScript compiles with zero errors | `cd packages/api && npx tsc --noEmit` | 0 errors | PASS |
| Commit `e8c1344` exists and touches only `workflow.ts` | `git show e8c1344 --stat` | 1 file changed, 57 insertions (+1 deletion) in `packages/api/src/routers/workflow.ts` | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| JIRA-02 | 24-01-PLAN.md | Workflow steps can auto-create Jira issues with configurable project/type mapping | SATISFIED | `startRun` now calls `createJiraIssue` fire-and-forget for each TODO task run whose template has `jiraEnabled: true`; configurable project/type mapping lives in `jiraTaskConfigSchema` fields (`jiraProjectId`, `jiraIssueTypeId`, etc.) read by the service; REQUIREMENTS.md status table updated to Phase 24 Complete |

No orphaned requirements — JIRA-02 is the only requirement mapped to Phase 24 in REQUIREMENTS.md and it is claimed in the plan frontmatter.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

Scanned for: TODO/FIXME, placeholder comments, empty return values, hardcoded empty arrays/objects, stub handlers in the Jira-related lines of `workflow.ts`. None found.

---

### Human Verification Required

#### 1. End-to-end Jira issue creation in a live environment

**Test:** Start a workflow run where at least one task template has `jiraEnabled: true` configured. Observe that a Jira issue is created in the configured project and that the task run's `externalRefId` is populated in the database after a few seconds.
**Expected:** A Jira issue is created in the correct project with the correct issue type; the task run record shows `externalRefType = "JIRA_ISSUE"` and `externalRefId = "<issue-key>"`.
**Why human:** Requires a live Jira Cloud connection, a real Jira project, and seeded workflow template data. Cannot be verified by static analysis.

#### 2. Failure isolation — one Jira call failing does not block others

**Test:** Simulate one task's Jira creation failing (e.g., misconfigured issue type) while another task in the same workflow run is correctly configured. Verify the second task still gets a Jira issue created.
**Expected:** The failing task logs `[workflow/startRun] Jira issue creation failed for task <id>:` and the passing task receives a Jira issue. The workflow run itself is fully accessible after start.
**Why human:** Requires controlled partial-failure simulation in a live environment.

---

### Gaps Summary

No gaps. All three observable truths are verified:

1. `createJiraIssue` is called fire-and-forget inside `startRun` for each TODO task whose template has `jiraEnabled: true` — the `jiraEligibleTaskRunIds` Set is built from real transaction data and consumed correctly after the transaction.
2. Non-blocking pattern is implemented correctly: individual `.catch()` per task, outer try/catch for setup, and the entire block is `void (async () => {...})()` with no `await` at the call site.
3. The `createJiraIssue` service (unchanged from Phase 19) writes `externalRefType: "JIRA_ISSUE"` and `externalRefId: created.key` to the task run record — downstream `JiraIssueChip` already reads these fields.

JIRA-02 requirement is fully satisfied. The phase goal is achieved.

---

_Verified: 2026-03-30T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
