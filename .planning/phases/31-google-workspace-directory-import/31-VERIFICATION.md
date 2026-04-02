---
phase: 31-google-workspace-directory-import
verified: 2026-04-02T16:15:00Z
status: human_needed
score: 4/4 success criteria verified
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "Admin can connect Google Workspace with Admin SDK Directory API scopes via OAuth and disconnect, revoking stored tokens — provider slug mismatch fixed (all three occurrences in google-workspace-provider-section.tsx now use 'google_workspace' underscore)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Attempt to click the Connect button in the Google Workspace integrations section"
    expected: "OAuth authorization page opens with Admin SDK scopes; after granting access the settings page shows the connection as connected and the import wizard auto-opens"
    why_human: "OAuth flow requires a live browser, Google OAuth app credentials, and a real Google Workspace account"
  - test: "After connecting, click Disconnect"
    expected: "A confirmation dialog appears; on confirm the connection is removed and the section reverts to disconnected state"
    why_human: "Requires live connection and browser interaction"
  - test: "Import wizard — preview step"
    expected: "Directory table loads with real Google Workspace users showing name, email, department, org unit; already-imported users appear greyed out with 'Already exists' badge"
    why_human: "Requires live Google Workspace directory with real users"
  - test: "Import wizard — roles step and confirm step"
    expected: "Groups from selected users appear with role dropdowns; confirm step shows role breakdown; Import button creates invitations and shows success/partial-failure toast"
    why_human: "Requires real directory data and invitation flow to test end-to-end"
  - test: "Periodic sync — trigger manual sync from settings"
    expected: "QStash job is published; after a moment the last-synced timestamp updates; new hires and departures appear as dashboard notifications for admin users"
    why_human: "Requires running QStash, live Google Workspace, and at least one simulated directory change"
---

# Phase 31: Google Workspace Directory Import — Verification Report

**Phase Goal:** Organizations using Google Workspace can import their team directory into the platform with role mapping
**Verified:** 2026-04-02T16:15:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (previous: gaps_found, 3/4)

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Admin can connect Google Workspace with Admin SDK Directory API scopes via OAuth and disconnect, revoking stored tokens | ✓ VERIFIED | Previously-failing slug mismatch is fixed. All three occurrences in `google-workspace-provider-section.tsx` now use `"google_workspace"` (underscore) on lines 25, 35, and 43. Adapter slug `"google_workspace"` on line 75 of adapter. Health check, Connect, disconnect, and post-OAuth redirect all now use matching slug. |
| 2 | User can preview paginated Google Workspace directory with name, email, department, and org unit before importing | ✓ VERIFIED | (No regression.) `directory-import-wizard.tsx` calls `trpc.googleWorkspace.listDirectory`; router returns all required fields; `DirectoryPreviewTable` renders them with search, org-unit filter, and pagination. |
| 3 | Admin can selectively import users as org members with role assignment, including mapping Google Workspace groups to internal RBAC roles | ✓ VERIFIED | (No regression.) `bulkImport` procedure re-fetches group memberships server-side, resolves role via override > group-mapping > defaultRole, calls `auth.api.createInvitation` per user. |
| 4 | System periodically syncs the directory to detect new hires and flag departures without auto-deleting anyone | ✓ VERIFIED | (No regression.) QStash cron `0 2 * * *`, `processDirectorySync` with new-hire/departure detection, `DIRECTORY_NEW_HIRE`/`DIRECTORY_DEPARTURE` notifications, no `createInvitation` in orchestrator. |

**Score:** 4/4 success criteria verified

---

## Gap Closure Verification

### Gap: Provider Slug Mismatch (CLOSED)

**Previous finding:** `google-workspace-provider-section.tsx` used `"google-workspace"` (hyphen) in three places — health query (line 25), searchParams check (line 35), and `ProviderConnectionCard` prop (line 43). This caused adapter lookup failure, broken health check, broken disconnect, and post-OAuth redirect not firing the wizard.

**Fix applied:** All three lines now use `"google_workspace"` (underscore):

- Line 25: `trpc.integration.getHealth.queryOptions({ provider: "google_workspace" })`
- Line 35: `searchParams.get("google_workspace") === "connected"`
- Line 43: `provider="google_workspace"` on `ProviderConnectionCard`

**Regression check:** Adapter slug (`slug = "google_workspace"` line 75), router registration (`googleWorkspace: googleWorkspaceRouter` in `root.ts` line 94), and integrations-tab wiring (`<GoogleWorkspaceProviderSection />` line 207) all remain intact.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/integrations/src/__tests__/google-workspace-adapter.test.ts` | Test stubs for GOOG-01 | ✓ VERIFIED | No regression — stubs for OAuth config, token exchange, refresh |
| `packages/integrations/src/__tests__/google-workspace-directory.test.ts` | Test stubs for GOOG-02, GOOG-04 | ✓ VERIFIED | No regression — stubs for `listAllDirectoryUsers` and `listUserGroups` |
| `packages/api/src/__tests__/google-workspace-sync.test.ts` | Test stubs for GOOG-05 | ✓ VERIFIED | No regression — stubs for `processDirectorySync` and bulk import security |
| `packages/validators/src/__tests__/google-workspace.test.ts` | Test stubs for validators | ✓ VERIFIED | No regression — stubs for `directoryImportInputSchema`, `groupRoleMappingSchema` |
| `packages/integrations/src/adapters/google-workspace-adapter.ts` | OAuth + directory methods | ✓ VERIFIED | No regression — slug `"google_workspace"`, Admin SDK scopes, directory pagination |
| `packages/validators/src/google-workspace.ts` | Zod schemas | ✓ VERIFIED | No regression |
| `packages/api/src/routers/google-workspace.ts` | 5 tRPC procedures | ✓ VERIFIED | No regression — `listDirectory`, `listUserGroups`, `bulkImport`, `triggerSync`, `syncStatus` |
| `packages/api/src/services/google-workspace-sync-orchestrator.ts` | Sync orchestrator | ✓ VERIFIED | No regression — `processDirectorySync` with full detection/notification/snapshot flow |
| `apps/web/src/app/api/google-workspace/_sync/route.ts` | QStash callback endpoint | ✓ VERIFIED | No regression — `verifySignatureAppRouter`, Zod-validated body, delegates to `processDirectorySync` |
| `apps/web/src/components/integrations/google-workspace-provider-section.tsx` | Provider section UI | ✓ VERIFIED | Gap closed — all slug references now use `"google_workspace"` (underscore) |
| `apps/web/src/components/integrations/google-workspace-logo.tsx` | SVG logo component | ✓ VERIFIED | No regression |
| `apps/web/src/components/integrations/google-workspace/directory-import-wizard.tsx` | Multi-step wizard | ✓ VERIFIED | No regression |
| `apps/web/src/components/integrations/google-workspace/directory-preview-table.tsx` | TanStack table | ✓ VERIFIED | No regression |
| `apps/web/src/components/integrations/google-workspace/directory-summary-bar.tsx` | Summary bar | ✓ VERIFIED | No regression |
| `apps/web/src/components/integrations/google-workspace/role-assignment-controls.tsx` | Default role picker | ✓ VERIFIED | No regression |
| `apps/web/src/components/integrations/google-workspace/group-role-mapping-step.tsx` | Group-to-role UI | ✓ VERIFIED | No regression |
| `apps/web/src/components/integrations/google-workspace/import-confirm-step.tsx` | Confirm step | ✓ VERIFIED | No regression |
| `apps/web/src/components/integrations/google-workspace/sync-status-section.tsx` | Sync status | ✓ VERIFIED | No regression |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `integrations-tab.tsx` | `google-workspace-provider-section.tsx` | JSX import + render | ✓ WIRED | Line 17 import, line 207 render `<GoogleWorkspaceProviderSection />` |
| `google-workspace-provider-section.tsx` | `packages/api/src/routers/google-workspace.ts` | `trpc.googleWorkspace.*` via `ProviderConnectionCard provider="google_workspace"` | ✓ WIRED | Gap closed — slug now matches adapter registration and Prisma enum |
| `packages/api/src/root.ts` | `packages/api/src/routers/google-workspace.ts` | `googleWorkspace: googleWorkspaceRouter` | ✓ WIRED | Line 32 import, line 94 registration — no regression |
| `packages/api/src/routers/google-workspace.ts` | `packages/integrations/src/adapters/google-workspace-adapter.ts` | `getAdapter("google_workspace")` | ✓ WIRED | Underscore slug in router matches adapter registration — no regression |
| `packages/integrations/src/adapters/register-all.ts` | `google-workspace-adapter.ts` | `registerAdapter(new GoogleWorkspaceAdapter())` | ✓ WIRED | No regression |
| `apps/web/src/app/api/google-workspace/_sync/route.ts` | `packages/api/src/services/google-workspace-sync-orchestrator.ts` | `processDirectorySync` | ✓ WIRED | Line 6 import, line 56 call — no regression |
| `google-workspace-sync-orchestrator.ts` | `notification-service.ts` | `dispatch()` | ✓ WIRED | No regression |
| `google-workspace-sync-orchestrator.ts` | `google-workspace-adapter.ts` | `listAllDirectoryUsers` | ✓ WIRED | No regression |
| `packages/validators/src/index.ts` | `packages/validators/src/google-workspace.ts` | re-exports | ✓ WIRED | No regression |
| `packages/validators/src/notification.ts` | — | `DIRECTORY_NEW_HIRE`, `DIRECTORY_DEPARTURE` | ✓ WIRED | No regression |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `directory-import-wizard.tsx` | `directoryData.users` | `trpc.googleWorkspace.listDirectory` → `adapter.listAllDirectoryUsers` → Google Admin SDK | Yes — live Admin SDK pagination | ✓ FLOWING |
| `directory-preview-table.tsx` | `users` prop | Passed from wizard step 1 | Flows from live directory query | ✓ FLOWING |
| `sync-status-section.tsx` | `syncStatus` | `trpc.googleWorkspace.syncStatus` → DB query on `IntegrationSyncLog` | Yes — real DB lookup | ✓ FLOWING |
| `google-workspace-provider-section.tsx` | `health.status` | `trpc.integration.getHealth` → `getProviderHealth("google_workspace")` → DB lookup with `"GOOGLE_WORKSPACE"` enum | Yes — slug now produces correct enum value | ✓ FLOWING |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| GOOG-01 | 31-00, 31-01, 31-02 | Admin can connect Google Workspace with Admin SDK Directory API scopes via OAuth | ✓ SATISFIED | Slug mismatch fixed. Adapter, callback, health check, disconnect, and post-connect redirect all now use `"google_workspace"`. Automated code path is correct; live OAuth requires human verification. |
| GOOG-02 | 31-00, 31-01, 31-02 | User can preview Google Workspace users with name, email, department, and org unit before importing | ✓ SATISFIED | `listDirectory` returns all fields; `DirectoryPreviewTable` renders them |
| GOOG-03 | 31-00, 31-01, 31-02 | Admin can selectively import Google Workspace users as org members with role assignment | ✓ SATISFIED | `bulkImport` with server-side role resolution and `auth.api.createInvitation` |
| GOOG-04 | 31-00, 31-01, 31-02 | Admin can map Google Workspace groups to internal RBAC roles during import | ✓ SATISFIED | `groupRoleMappings` in schema, `GroupRoleMappingStep` UI, `resolveUserRole` logic |
| GOOG-05 | 31-00, 31-03 | System periodically syncs Google Workspace directory to detect new hires and flag departures (no auto-delete) | ✓ SATISFIED | QStash cron, `processDirectorySync` with detection/notification/snapshot, no auto-delete |

---

## Anti-Patterns Found

None. The three blocker anti-patterns from the previous verification have been resolved.

---

## Human Verification Required

### 1. OAuth Connect Flow

**Test:** Navigate to Settings → Integrations. Click "Connect" on the Google Workspace card.
**Expected:** Google OAuth consent screen opens with `admin.directory.user.readonly` and `admin.directory.group.readonly` scopes visible. After granting access, the page redirects back, shows Google Workspace as connected, and the import wizard auto-opens.
**Why human:** Requires live browser, configured Google OAuth app credentials, and a Google Workspace admin account.

### 2. Disconnect and Token Revocation

**Test:** After connecting, click "Disconnect" in the connected provider section and confirm.
**Expected:** The section reverts to disconnected state. The stored credentials are cleared from the database.
**Why human:** Requires live connection and browser interaction. Also needs human judgment on whether clearing `credentialsRef` in DB satisfies "revoking stored tokens" or whether calling Google's `https://oauth2.googleapis.com/revoke` endpoint is also expected.

### 3. Import Wizard — Directory Preview

**Test:** After connecting, click "Import users". Observe the wizard's first step.
**Expected:** A paginated table loads showing real directory users with name, email, department, and org unit columns. Already-imported users are greyed out with an "Already exists" badge. Search and org-unit filter function correctly.
**Why human:** Requires live Google Workspace directory with real users.

### 4. Import Wizard — Roles Step and Confirm

**Test:** Select some users in step 1, advance to the roles step, assign group-to-role mappings, then confirm.
**Expected:** Groups from selected users appear with role dropdowns; confirm step shows a role breakdown; Import button creates invitations and shows success/partial-failure toast.
**Why human:** Requires real directory data and invitation flow to test end-to-end.

### 5. Periodic Sync — New Hire and Departure Detection

**Test:** After connecting and running an initial import, add a new user to the Google Workspace directory. Wait for the 2 AM cron or click "Sync now". Check admin notifications.
**Expected:** A "New team member detected" notification appears for the new user. Remove a user from Google Workspace; a "may have left the organization" notification appears. No users are auto-created or auto-deleted.
**Why human:** Requires running QStash, live Google Workspace, and the ability to simulate directory changes.

---

## Summary

The single blocker gap from the initial verification has been closed. `google-workspace-provider-section.tsx` now uses `"google_workspace"` (underscore) in all three places — the health query, the post-OAuth `searchParams` check, and the `ProviderConnectionCard` provider prop. This restores:

1. **Connect button** — `getAdapter("google_workspace")` now resolves the adapter correctly, so OAuth URL generation succeeds.
2. **Health check** — `"google_workspace".toUpperCase()` produces `"GOOGLE_WORKSPACE"`, matching the Prisma enum, so the DB lookup returns the real connection record.
3. **Disconnect** — same enum correction means the DB lookup for disconnect finds the record.
4. **Post-OAuth redirect** — `searchParams.get("google_workspace")` now matches the `?google_workspace=connected` param set by the callback, so the auto-open wizard and success toast fire.

All 4 success criteria are now satisfied at the code level. All 5 GOOG requirements are covered. No automated regressions detected. Human verification is required for the live OAuth flow and integration behavior.

---

_Verified: 2026-04-02T16:15:00Z_
_Verifier: Claude (gsd-verifier)_
