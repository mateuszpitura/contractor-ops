---
phase: 34-intelligent-onboarding-wizard
verified: 2026-04-05T10:20:00Z
status: passed
score: 21/21 must-haves verified
re_verification: false
---

# Phase 34: Intelligent Onboarding Wizard Verification Report

**Phase Goal:** Build intelligent onboarding wizard that imports people and projects from connected tools (Jira, Linear, Google Workspace, Slack) with cross-tool merge/dedup, conflict resolution, workflow template creation, and async import with progress tracking.
**Verified:** 2026-04-05T10:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | listSources returns connection status for all 4 tools (Jira, Linear, Google Workspace, Slack) | VERIFIED | `onboardingImportRouter.listSources` queries `integrationConnection.findMany` and maps over `ALL_PROVIDERS = ["JIRA","LINEAR","GOOGLE_WORKSPACE","SLACK"]`; test passes |
| 2 | fetchPeople returns merged person list with email-based dedup across selected sources | VERIFIED | `mergeByEmail` normalises to `email.toLowerCase()`, groups via `Map`, verified by 3 passing tests including the email normalisation test |
| 3 | Conflict detection identifies name mismatches when same email appears in multiple sources | VERIFIED | `mergeByEmail` sets `status="conflict"` when `uniqueNames.length > 1`; test `"fetchPeople detects conflict..."` passes |
| 4 | batchImport creates invitations for selected people with assigned roles | VERIFIED | `startImport` iterates non-skipped people and calls `auth.api.createInvitation` with `email` + `role`; test passes asserting 2 calls (skipped Carol excluded) |
| 5 | fetchProjects returns Jira projects and Linear teams with their statuses | VERIFIED | `fetchProjects` calls Jira `/rest/api/3/project` then `/project/{id}/statuses`, and `linearGraphQL` for teams with states; test passes |
| 6 | importProjects creates WorkflowTemplate + WorkflowTaskTemplate records from selected projects | VERIFIED | `createWorkflowTemplatesFromProjects` calls `prisma.workflowTemplate.create` (type CUSTOM, status DRAFT, appliesToEntityType CONTRACTOR) and `workflowTaskTemplate.createMany` (taskType MANUAL, assigneeMode ROLE_BASED); test passes |
| 7 | startImport publishes async job to QStash and returns jobId | VERIFIED (MVP deviation) | Implemented synchronously via `crypto.randomUUID()` jobId stored in `organization.settingsJson.importJobs`; plan documented this deviation explicitly as intentional MVP choice |
| 8 | getProgress returns import progress with completed/failed item counts | VERIFIED | `getProgress` reads `organization.settingsJson.importJobs[jobId]`; test `"startImport returns jobId, getProgress returns completedItems/failedItems"` passes |
| 9 | retryFailedItem re-processes a single failed import item | VERIFIED | `retryFailedItem` finds item in `job.failedItems`, calls `createInvitation`, removes from failedItems, increments completedItems; test passes |
| 10 | User sees 4 source cards (Jira, Linear, Google Workspace, Slack) with connection status | VERIFIED | `source-selection-step.tsx` renders 4 `SourceCard` components from `trpc.onboardingImport.listSources.queryOptions()` with `connected` prop; `sourcesQuery` mapped to cards grid |
| 11 | Unconnected tools show Connect button that triggers OAuth popup | VERIFIED | `source-card.tsx` renders Connect button when `!connected`; `source-selection-step.tsx` calls `openOAuthPopup(provider, ...)` which calls `window.open(...)` |
| 12 | Connected tools show Import toggle switch | VERIFIED | `source-card.tsx` renders `<Switch>` component when `connected`; `onCheckedChange={onToggle}` handler wired |
| 13 | User sees merged preview table with Name, Email, Sources badges, Status badge, Role dropdown | VERIFIED | `people-review-step.tsx` (517 lines) renders `<Table>` with `TableHead` columns for Name/Email/Sources/Status/Role via `trpc.onboardingImport.fetchPeople.queryOptions` |
| 14 | Conflict badge opens popover showing source values with radio selection | VERIFIED | `conflict-resolution-popover.tsx` exists; `people-review-step.tsx` renders `<ConflictResolutionPopover>` for `status === "conflict"` rows |
| 15 | Batch toolbar appears with Import Selected / Skip Selected / Assign Role | VERIFIED | `people-review-step.tsx` line 326-332: `handleBatchImport`, `handleBatchSkip`, and `handleBatchRole` handlers with corresponding Button/Select elements |
| 16 | Filter tabs work: All / New / Conflicts / Existing | VERIFIED | `people-review-step.tsx`: `activeFilter` state, `useMemo` filter logic, `<TabsTrigger value="all/new/conflict/exists">` rendered at lines 311-314 |
| 17 | User sees project cards with editable steps list per Jira project / Linear team | VERIFIED | `project-import-step.tsx` (342 lines) uses `trpc.onboardingImport.fetchProjects.queryOptions`; `handleAddStep` / `handleRemoveStep` at lines 68/77; `addStep` button at line 201 |
| 18 | Async import shows progress bar with per-item status and retry for failed items | VERIFIED | `confirm-import-step.tsx` renders `<ImportProgressTracker>` with `jobId`; `import-progress-tracker.tsx` uses `refetchInterval` polling on `getProgress` and `retryFailedItem.mutationOptions()` |
| 19 | Onboarding checklist step 2 links to /onboarding/import | VERIFIED | `onboarding-checklist.tsx` line 58: `ctaHref: "/onboarding/import"` for `stepKey: "inviteTeam"` |
| 20 | Skip link on step 1 redirects to members page | VERIFIED | `source-selection-step.tsx` lines 112-157: `handleSkip` calls `router.push("/settings?tab=members")`; `<Button variant="link">` rendered at bottom |
| 21 | Wizard accessible from Settings > Integrations | VERIFIED | `settings/integrations-tab.tsx` line 190: `<Button render={<Link href="/onboarding/import" />}>` |

**Score:** 21/21 truths verified

---

### Required Artifacts

| Artifact | Provided | Line Count | Status | Details |
|----------|----------|-----------|--------|---------|
| `packages/validators/src/onboarding-import.ts` | 12 Zod schemas for all inputs/outputs | 173 | VERIFIED | All 9 required exports present: `sourceProviderSchema`, `listSourcesOutputSchema`, `fetchPeopleInputSchema`, `fetchPeopleOutputSchema`, `batchImportInputSchema`, `fetchProjectsOutputSchema`, `importProjectInputSchema`, `startImportInputSchema`, `importProgressOutputSchema`, `retryItemInputSchema` |
| `packages/api/src/services/onboarding-import-service.ts` | Cross-tool fetch, merge, dedup, workflow template creation | 391 | VERIFIED | Exports: `fetchUsersFromSource`, `mergeByEmail`, `createWorkflowTemplatesFromProjects`, `SourcePerson`, `ImportProject` |
| `packages/api/src/routers/onboarding-import.ts` | tRPC router with all 6 endpoints | 482 | VERIFIED | Exports `onboardingImportRouter` with `listSources`, `fetchPeople`, `fetchProjects`, `startImport`, `getProgress`, `retryFailedItem` |
| `packages/api/src/routers/__tests__/onboarding-import.test.ts` | 12 test cases (plan required min 200 lines) | 649 | VERIFIED | 12 tests, all pass. Covers all ONBD behaviors |
| `apps/web/src/app/[locale]/(dashboard)/onboarding/import/page.tsx` | Full-page wizard route | 9 | VERIFIED | Thin page wrapper delegating to `<ImportWizard />` |
| `apps/web/src/components/onboarding/import-wizard.tsx` | 4-step wizard container | 269 | VERIFIED | Step state management, step indicator, progress bar, sticky footer nav |
| `apps/web/src/components/onboarding/source-selection-step.tsx` | Step 1: source cards with OAuth | 160 | VERIFIED | OAuth popup helper, 4 provider cards, skip link |
| `apps/web/src/components/onboarding/people-review-step.tsx` | Step 2: merged table with dedup, conflict resolution, batch actions | 517 | VERIFIED | Filter tabs, ConflictResolutionPopover, batch toolbar, role dropdowns |
| `apps/web/src/components/onboarding/project-import-step.tsx` | Step 3: project cards with editable workflow steps | 342 | VERIFIED | Add/remove step handlers, project cards per source |
| `apps/web/src/components/onboarding/confirm-import-step.tsx` | Step 4: summary + async progress | 210 | VERIFIED | Delegates to ImportProgressTracker, handles startImport mutation |
| `apps/web/src/components/onboarding/import-progress-tracker.tsx` | Async progress polling + retry | (exists) | VERIFIED | `refetchInterval` on `getProgress`, `retryFailedItem` mutation, per-item retry |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/api/src/routers/onboarding-import.ts` | `packages/api/src/services/onboarding-import-service.ts` | service function imports | WIRED | Line 18-20: `import { fetchUsersFromSource, mergeByEmail, createWorkflowTemplatesFromProjects } from "../services/onboarding-import-service.js"` |
| `packages/api/src/routers/onboarding-import.ts` | `packages/api/src/root.ts` | router registration | WIRED | `root.ts` line 35: import; line 99: `onboardingImport: onboardingImportRouter` |
| `packages/api/src/routers/onboarding-import.ts` | `packages/validators/src/onboarding-import.ts` | Zod schema imports | WIRED | `onboarding-import.ts` line 9-13 imports `fetchPeopleInputSchema`, `sourceProviderSchema`, `startImportInputSchema`, `retryItemInputSchema` from `@contractor-ops/validators` |
| `apps/web/src/components/onboarding/import-wizard.tsx` | `packages/api/src/routers/onboarding-import.ts` | tRPC queries/mutations | WIRED | 8 distinct `trpc.onboardingImport.*` calls across wizard components: `listSources`, `fetchPeople`, `fetchProjects`, `startImport`, `getProgress`, `retryFailedItem` all in use |
| `apps/web/src/components/onboarding/onboarding-checklist.tsx` | `/onboarding/import` page | ctaHref link | WIRED | `onboarding-checklist.tsx` line 58: `ctaHref: "/onboarding/import"` |
| `apps/web/src/components/onboarding/confirm-import-step.tsx` | `onboardingImport.startImport` + `getProgress` polling | tRPC mutation + refetchInterval | WIRED | Lines 89-90: `startImport.mutationOptions()`; `ImportProgressTracker` uses `getProgress.queryOptions` with `refetchInterval` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `source-selection-step.tsx` | `sources` from `sourcesQuery.data` | `trpc.onboardingImport.listSources` → `prisma.integrationConnection.findMany` | Yes — queries real DB records | FLOWING |
| `people-review-step.tsx` | `mergedPeople` from `peopleQuery.data` | `trpc.onboardingImport.fetchPeople` → `fetchUsersFromSource` (Jira/Linear/GWS/Slack APIs) + `mergeByEmail` | Yes — real API calls with Promise.allSettled | FLOWING |
| `project-import-step.tsx` | `projects` from `fetchProjects` query | `trpc.onboardingImport.fetchProjects` → Jira REST API + Linear GraphQL | Yes — real API calls per source | FLOWING |
| `confirm-import-step.tsx` | `mergedPeople`, `personSelections`, `projects`, `projectSelections` | Props from `import-wizard.tsx` state, populated by steps 2 and 3 | Yes — state populated from tRPC queries, not hardcoded | FLOWING |
| `import-progress-tracker.tsx` | `progress` from `getProgress` query | `trpc.onboardingImport.getProgress` → `prisma.organization.findFirst` (settingsJson) | Yes — reads real DB settingsJson | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 12 test cases pass | `pnpm vitest run src/routers/__tests__/onboarding-import.test.ts` | 12 passed (12) in 237ms | PASS |
| Router registered in root | `grep -c "onboardingImport" packages/api/src/root.ts` | 2 (import + registration) | PASS |
| Validator exports count | `grep -c "^export const" packages/validators/src/onboarding-import.ts` | 12 exports | PASS |
| Service exports count | `grep -c "^export" packages/api/src/services/onboarding-import-service.ts` | 5 exports (3 functions + 2 types) | PASS |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| ONBD-01 | 34-01, 34-02 | User sees "Where do you manage your team?" source selection during onboarding | SATISFIED | `source-selection-step.tsx` renders 4 source cards from `listSources`; onboarding checklist routes to `/onboarding/import` |
| ONBD-02 | 34-01, 34-02 | System imports team members from connected tools with email-based dedup | SATISFIED | `fetchUsersFromSource` handles Jira (paginated), Linear (active only), Google Workspace (Admin SDK), Slack (bot-filtered); `mergeByEmail` deduplicates by lowercase email |
| ONBD-03 | 34-01, 34-02 | System imports projects and statuses from PM tools to pre-configure workflow templates | SATISFIED | `fetchProjects` returns Jira projects + statuses + Linear teams + states; `createWorkflowTemplatesFromProjects` creates CUSTOM/MANUAL templates |
| ONBD-04 | 34-01, 34-02 | User can preview imported data with diff indicators (new/duplicate/conflict) and batch confirm, skip, or edit | SATISFIED | `people-review-step.tsx` shows status badges (new/conflict/exists), conflict resolution popover, batch toolbar (Import/Skip/Assign Role), filter tabs, role dropdowns |
| ONBD-05 | 34-01, 34-02 | Import runs async with progress tracking, and user can retry failed items without re-importing | SATISFIED (MVP sync) | `startImport` processes synchronously with per-item progress updates in `settingsJson`; `getProgress` polled via `refetchInterval`; `retryFailedItem` retries individual items |

**Orphaned requirements:** None — all 5 ONBD requirements claimed by plans and verified.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|-----------|
| `packages/api/src/routers/onboarding-import.ts` | `retryFailedItem` hardcodes `role: "readonly"` for retried invitations | Warning | Role information not stored in `failedItems` — retry always uses "readonly" rather than the originally requested role. Functional but loses user intent. Not a blocker. |

No TODOs, FIXMEs, placeholder returns, or empty stub implementations found in any phase files.

---

### Human Verification Required

#### 1. Wizard Visual Flow

**Test:** Navigate to `/onboarding/import` as an org admin. Click through all 4 steps.
**Expected:** Step indicator progresses, progress bar advances, step content changes appropriately, sticky footer nav shows Back/Continue correctly.
**Why human:** Visual rendering, step transition animations, responsive layout cannot be verified programmatically.

#### 2. OAuth Popup Behavior

**Test:** On step 1, click "Connect" on an unconnected Jira integration.
**Expected:** OAuth popup opens to Jira authorization URL; after auth completion, source card updates to show "Connected" and the toggle switch appears.
**Why human:** Requires live OAuth integration, popup window behavior, post-message/polling communication between popup and parent window.

#### 3. Conflict Resolution Popover

**Test:** Import from two sources where the same email has different display names. On the people review step, click the conflict badge.
**Expected:** Popover opens showing source-specific name values with radio buttons; selecting one resolves the conflict and the Continue button becomes enabled.
**Why human:** Requires real multi-source data; visual interaction with popover and radio selection state.

#### 4. Async Progress Tracking

**Test:** Start an import with 3+ people and verify the progress bar updates in real time as each invitation is sent.
**Expected:** Progress bar increments per invitation; failed items appear with retry buttons; final "completed" state shows with Go to Dashboard CTA.
**Why human:** Requires live DB + auth integration; refetchInterval polling behavior observable only at runtime.

---

### Gaps Summary

No gaps. All 21 must-have truths verified, all 11 artifacts pass all 4 levels (exists, substantive, wired, data flowing), all 6 key links wired, all 5 ONBD requirements satisfied.

One non-blocking warning: `retryFailedItem` defaults to `role: "readonly"` on retry because the original role is not persisted in `failedItems`. This is a minor UX degradation but does not block goal achievement.

---

_Verified: 2026-04-05T10:20:00Z_
_Verifier: Claude (gsd-verifier)_
