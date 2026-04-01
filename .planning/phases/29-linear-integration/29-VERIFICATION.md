---
phase: 29-linear-integration
verified: 2026-04-01T23:50:12Z
status: passed
score: 19/19 must-haves verified
re_verification: false
---

# Phase 29: Linear Integration Verification Report

**Phase Goal:** Teams using Linear get the same bidirectional workflow-to-issue sync that Jira users already have
**Verified:** 2026-04-01T23:50:12Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All truths drawn from `must_haves` across Plans 01, 02, and 03.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can initiate Linear OAuth connection from integrations settings page and receive tokens | VERIFIED | `LinearAdapter.exchangeCodeForTokens` uses URL-encoded POST to `https://api.linear.app/oauth/token`; OAuth callback route updated for `linear` provider |
| 2 | LINEAR exists in IntegrationProvider Prisma enum | VERIFIED | `integration.prisma` line 120: `LINEAR` |
| 3 | PENDING_MAPPING exists in IntegrationStatus Prisma enum | VERIFIED | `integration.prisma` line 128: `PENDING_MAPPING` |
| 4 | LinearAdapter is registered and discoverable via getAdapter('linear') | VERIFIED | `register-all.ts` imports and calls `registerAdapter(new LinearAdapter())` |
| 5 | OAuth callback sets Linear connections to PENDING_MAPPING (not CONNECTED) | VERIFIED | `callback/route.ts` line 87: `provider === "linear" ? "PENDING_MAPPING" : "CONNECTED"` |
| 6 | Admin can save per-team status mapping; PENDING_MAPPING transitions to CONNECTED | VERIFIED | `linear-status-mapping.ts`: `saveStatusMapping` checks `connection.status === "PENDING_MAPPING"` and sets `status: "CONNECTED"` |
| 7 | Starting a workflow task with Linear enabled auto-creates a Linear issue | VERIFIED | `workflow.ts` line 737-861: `linearTaskConfigSchema` parse + `createLinearIssue(...)` fire-and-forget |
| 8 | A status change in Linear updates linked workflow task status via webhook | VERIFIED | `processLinearWebhook` in `linear-webhook-handler.ts` validates payload, resolves internal status, updates `taskRun` via prisma |
| 9 | A status change on a workflow task updates the linked Linear issue state | VERIFIED | `workflow.ts` lines 1303, 1425: `syncTaskStatusToLinear` called on `completeTask`/`skipTask` |
| 10 | Loop prevention suppresses re-sync within 30s window | VERIFIED | `linear-issue-sync.ts`: `LOOP_PREVENTION_WINDOW_MS = 30_000`; both inbound and outbound check `lastSyncOrigin` + `lastSyncAt` |
| 11 | Admin sees Linear section in integrations settings tab | VERIFIED | `integrations-tab.tsx`: `<LinearProviderSection />` mounted after `<JiraProviderSection />` |
| 12 | After OAuth, admin is guided into mapping dialog before sync activates (D-03) | VERIFIED | `linear-provider-section.tsx`: `useEffect` opens `LinearStatusMappingDialog` when `isPendingMapping` |
| 13 | Status mapping dialog shows per-team mapping with smart defaults | VERIFIED | `linear-status-mapping-dialog.tsx`: 6 internal statuses, smart default algorithm with keyword matching (`includes("block")` etc.) and state type fallback |
| 14 | Admin can configure linearEnabled + Linear team on workflow template editor (D-05) | VERIFIED | `linear-task-config.tsx` mounted in `task-card.tsx` line 496; uses `trpc.linear.saveTaskConfig` |
| 15 | Linear issue chip displays with purple tint, status dot, opens Linear in new tab | VERIFIED | `linear-issue-chip.tsx`: `oklch(0.58_0.14_290/8%)` background, status dots per 6 Linear state types, `aria-label` |
| 16 | Linear issue chip mounted alongside Jira chip on workflow task views (LIN-06) | VERIFIED | `workflow-side-panel.tsx` and `workflows-tab.tsx` both import and render `LinearIssueChip`; data from `trpc.linear.linkedIssues` |
| 17 | All UI text is internationalized in en.json and pl.json | VERIFIED | Both files have `"linear"` section under `Settings.integrations` with 22+ keys each, including `pendingMappingWarning`, `templateSettings`, `mapping` subsections |
| 18 | Jira and Linear coexist in integrations tab without visual conflict (D-11) | VERIFIED | `integrations-tab.tsx`: both `<JiraProviderSection />` and `<LinearProviderSection />` rendered in same grid |
| 19 | Webhook signature verification uses HMAC-SHA256 with linear-signature header | VERIFIED | `linear-adapter.ts`: imports `createHmac, timingSafeEqual` from `node:crypto`; reads `linear-signature` header |

**Score:** 19/19 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/prisma/schema/integration.prisma` | LINEAR enum + PENDING_MAPPING status | VERIFIED | Lines 120, 128 confirmed |
| `packages/integrations/src/adapters/linear-adapter.ts` | LinearAdapter extending BaseAdapter | VERIFIED | Exports `LinearAdapter`; OAuth, refresh, HMAC-SHA256 webhook sig, `discoverWorkspace` all present |
| `packages/validators/src/linear.ts` | Zod schemas for all Linear structures | VERIFIED | All 7 schemas exported: `linearWebhookPayloadSchema`, `linearTaskConfigSchema`, `linearStatusMappingEntrySchema`, `linearStatusMappingSchema`, `linearIssueMetadataSchema`, `saveLinearStatusMappingInputSchema`, `saveLinearTaskConfigInputSchema` |
| `packages/api/src/routers/linear.ts` | tRPC router with 8 procedures | VERIFIED | `teams`, `getStatusMapping`, `saveStatusMapping`, `saveTaskConfig`, `getLinkedIssue`, `getLinkedIssues`, `connectionStatus`, `linkedIssues` all present |
| `packages/api/src/services/linear-status-mapping.ts` | Status mapping CRUD + D-03 transition | VERIFIED | `getStatusMapping`, `saveStatusMapping` (with PENDING_MAPPING->CONNECTED), `resolveLinearStateId`, `resolveInternalStatus` all exported |
| `packages/api/src/services/linear-issue-sync.ts` | Issue creation + outbound sync + loop prevention | VERIFIED | `createLinearIssue`, `syncTaskStatusToLinear`, `linearGraphQL`; `LOOP_PREVENTION_WINDOW_MS=30_000`, `DEDUP_WINDOW_MS=5_000`; `issueCreate` + `issueUpdate` GraphQL mutations; `users(filter` for email lookup |
| `packages/api/src/services/linear-webhook-handler.ts` | Inbound webhook processing + webhook CRUD | VERIFIED | `processLinearWebhook`, `registerLinearWebhook`, `deregisterLinearWebhook`; `webhookCreate` + `webhookDelete` mutations |
| `apps/web/src/components/integrations/linear-logo.tsx` | Linear SVG logo component | VERIFIED | Re-exports `LinearBrandIcon` (from `SiLinear` in `brand-icons.tsx`) as `LinearLogo` |
| `apps/web/src/components/integrations/linear-provider-section.tsx` | Provider section with D-03 flow | VERIFIED | `ProviderConnectionCard`, `provider="linear"`, `LinearStatusMappingDialog`, D-03 `useEffect`, `PENDING_MAPPING` check |
| `apps/web/src/components/integrations/linear-status-mapping-dialog.tsx` | Per-team mapping dialog | VERIFIED | All 6 internal statuses; smart defaults with keyword + type fallback; `trpc.linear.teams`, `trpc.linear.saveStatusMapping`, `trpc.linear.getStatusMapping`; `sm:max-w-2xl` |
| `apps/web/src/components/integrations/linear-issue-chip.tsx` | Purple-branded issue chip | VERIFIED | `oklch(0.58_0.14_290/8%)`, `oklch(0.58_0.14_290/20%)`, `oklch(0.58_0.14_290/14%)`; 6-type status dots; accessible `aria-label` |
| `apps/web/src/components/integrations/linear-task-config.tsx` | Workflow template Linear settings | VERIFIED | `linearEnabled` toggle, team selector, `trpc.linear.saveTaskConfig` mutation |
| Test stubs (4 files) | Wave 0 test infrastructure | VERIFIED | `linear-adapter.test.ts`, `linear.test.ts`, `linear-status-mapping.test.ts`, `linear-issue-sync.test.ts` all exist with `it.todo()` stubs |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `register-all.ts` | `linear-adapter.ts` | `registerAdapter(new LinearAdapter())` | WIRED | Line 41 confirmed |
| `root.ts` | `routers/linear.ts` | `linear: linearRouter` | WIRED | Line 85 confirmed |
| `oauth/callback/route.ts` | `integration.prisma` | `PENDING_MAPPING` for linear provider | WIRED | Line 87: conditional status |
| `linear-webhook-handler.ts` | `linear-status-mapping.ts` | `resolveInternalStatus(...)` | WIRED | Imported at line 5, called at line 191 |
| `linear-issue-sync.ts` | `linear-status-mapping.ts` | `resolveLinearStateId(...)` | WIRED | Used in `syncTaskStatusToLinear` |
| `routers/workflow.ts` | `linear-issue-sync.ts` | `createLinearIssue` on task start | WIRED | Import line 18, called at line 861 |
| `routers/workflow.ts` | `linear-issue-sync.ts` | `syncTaskStatusToLinear` on status change | WIRED | Called at lines 1303, 1425 |
| `linear-status-mapping.ts` | `integration.prisma` | PENDING_MAPPING -> CONNECTED transition | WIRED | Lines 111-113 confirmed |
| `integrations-tab.tsx` | `linear-provider-section.tsx` | `<LinearProviderSection />` in grid | WIRED | Line 203 confirmed |
| `linear-provider-section.tsx` | `trpc.linear.teams` (via `trpc.integration.getHealth`) | tRPC query for connection health | WIRED | Line 23: `trpc.integration.getHealth.queryOptions({ provider: "linear" })` |
| `linear-status-mapping-dialog.tsx` | `trpc.linear.saveStatusMapping` | tRPC mutation on save | WIRED | Line 218 confirmed |
| `workflow-side-panel.tsx` | `linear-issue-chip.tsx` | `<LinearIssueChip />` mounted next to Jira chip | WIRED | Line 180 confirmed |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `workflow-side-panel.tsx` (LinearIssueChip) | `issues` from `issuesQuery.data` | `trpc.linear.linkedIssues` -> `prisma.externalLink.findMany` (filter `externalType: "LINEAR_ISSUE"`) | Yes — DB query with WHERE clause | FLOWING |
| `linear-status-mapping-dialog.tsx` (team list) | `teamsQuery.data` | `trpc.linear.teams` -> Linear GraphQL `https://api.linear.app/graphql` with Bearer token | Yes — live API call | FLOWING |
| `linear-status-mapping-dialog.tsx` (existing mapping) | `mappingQuery.data` | `trpc.linear.getStatusMapping` -> `prisma.integrationConnection.findUniqueOrThrow` -> `configJson.statusMappings[teamId]` | Yes — DB query | FLOWING |
| `workflows-tab.tsx` (RunLinearChips) | `issues` from `trpc.linear.linkedIssues` | Same pattern as workflow-side-panel — `prisma.externalLink.findMany` | Yes — DB query | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| Validators dist exports all 4 schema types | `node -e "require('.../validators/dist/index.js')"` | All 4 schemas are `object` (Zod schema instances) | PASS |
| `register-all.ts` wires LinearAdapter into registry | grep pattern confirmed | `registerAdapter(new LinearAdapter())` present | PASS |
| Workflow router calls `syncTaskStatusToLinear` on task completion | grep for usage | Lines 1303, 1425 confirmed | PASS |
| `linkedIssues` router endpoint queries DB not hardcoded data | Source inspection | `prisma.externalLink.findMany` with `externalType: "LINEAR_ISSUE"` | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LIN-01 | Plan 01 | User can connect Linear workspace via OAuth 2.0 with refresh token support | SATISFIED | `LinearAdapter.exchangeCodeForTokens` + `refreshToken` + `register-all.ts` registration; OAuth callback sets `PENDING_MAPPING` |
| LIN-02 | Plans 02 + 03 | Admin can map Linear workflow states to internal task statuses per team | SATISFIED | `linear-status-mapping.ts` services + `LinearStatusMappingDialog` with smart defaults + `trpc.linear.saveStatusMapping` |
| LIN-03 | Plans 02 + 03 | Workflow task with Linear enabled auto-creates Linear issue with team, title, description, and assignee | SATISFIED | `createLinearIssue` in `linear-issue-sync.ts` with email-based assignee lookup (D-07); wired in `workflow.ts` on `startRun` |
| LIN-04 | Plan 02 | Status changes in Linear sync to linked workflow task via webhooks (with loop prevention) | SATISFIED | `processLinearWebhook` validates payload, checks 30s loop prevention window, resolves internal status, updates `taskRun` |
| LIN-05 | Plan 02 | Status changes on workflow task sync to Linear issue via GraphQL mutation | SATISFIED | `syncTaskStatusToLinear` calls `issueUpdate` mutation; wired in `workflow.ts` on `completeTask` and `skipTask` |
| LIN-06 | Plan 03 | Linked Linear issue displays as clickable chip with status badge on workflow task view | SATISFIED | `LinearIssueChip` mounted in `workflow-side-panel.tsx` and `workflows-tab.tsx` with `trpc.linear.linkedIssues` data |

All 6 requirements are SATISFIED. No orphaned requirements found for Phase 29.

---

### Anti-Patterns Found

No blockers or significant warnings found. Notes:

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `linear-status-mapping-dialog.tsx` | String `"TODO"` appears as a workflow status value | Info | Domain enum value, not a code smell — correctly used as a workflow status identifier |

All service files are free of placeholder implementations, empty returns, or hardcoded stub data. Test files use `it.todo()` stubs intentionally for Wave 0 infrastructure (expected at this phase).

---

### Human Verification Required

#### 1. OAuth Round-Trip Flow

**Test:** Connect a test Linear workspace through Settings > Integrations — click "Connect Linear", complete OAuth in Linear, confirm redirect back.
**Expected:** Connection appears with `PENDING_MAPPING` status; mapping dialog auto-opens immediately.
**Why human:** OAuth flow requires live Linear OAuth application credentials and browser interaction.

#### 2. Mandatory Mapping Gate (D-03)

**Test:** After OAuth, confirm the "Configure Status Mapping" dialog is open and un-dismissable until at least one team mapping is saved.
**Expected:** After saving first mapping, connection status transitions to CONNECTED and sync badge turns green.
**Why human:** State machine transition (PENDING_MAPPING -> CONNECTED) requires live connection + mutation.

#### 3. Bidirectional Sync End-to-End

**Test:** Start a workflow task with `linearEnabled=true`. Confirm a Linear issue is created. Change the task status — confirm Linear issue state updates. Change Linear issue state — confirm task status updates within seconds.
**Expected:** Both directions sync; no infinite loop; 30s loop prevention window respected.
**Why human:** Requires live Linear workspace, webhook delivery, and real-time observation.

#### 4. Issue Chip Visual Appearance

**Test:** View a workflow task run with a linked Linear issue.
**Expected:** Purple-tinted chip with identifier (e.g. "ENG-123"), status text, status dot, and accessible tooltip on hover. Click opens Linear URL in new tab.
**Why human:** Visual rendering and interactive behaviour cannot be verified programmatically.

---

## Gaps Summary

No gaps. All automated checks passed across all three plans.

All 19 observable truths are VERIFIED. All required artifacts exist and are substantive (not stubs). All 12 key links are WIRED. Data flows from DB queries through tRPC into UI components without disconnection. No blocker anti-patterns found. All 6 requirements (LIN-01 through LIN-06) are SATISFIED.

The 4 human verification items are normal UX/integration tests that require a live Linear workspace — they are not gaps, they are confidence checks for the last mile.

---

_Verified: 2026-04-01T23:50:12Z_
_Verifier: Claude (gsd-verifier)_
