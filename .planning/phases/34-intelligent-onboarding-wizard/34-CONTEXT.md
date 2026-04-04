# Phase 34: Intelligent Onboarding Wizard - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Cross-tool import orchestrator — new organizations can bootstrap their account by importing team members, projects, and statuses from connected tools (Jira, Linear, Google Workspace, Slack) in one guided flow. Covers source selection, OAuth connection, cross-tool dedup, preview with conflict resolution, batch confirm, and async import with progress tracking and retry.

</domain>

<decisions>
## Implementation Decisions

### Wizard Entry Point & Flow
- **D-01:** Replace existing onboarding checklist step 2 ("Invite Team") with "Import Team" that opens the cross-tool import wizard
- **D-02:** Full-page wizard at `/onboarding/import` (not a dialog) — large preview tables need full width for 50+ rows across multiple sources
- **D-03:** Wizard also accessible from Settings > Integrations for re-importing after initial onboarding (e.g., when a company connects a new tool months later)
- **D-04:** "Skip — I'll invite people manually" link at bottom of step 1 completes the onboarding step and redirects to the members page with invite dialog

### Source Connection During Wizard
- **D-05:** Inline OAuth connection inside the wizard — step 1 shows all 4 tools as cards. Unconnected tools show "Connect" button triggering OAuth popup. Connected tools show checkmark + "Import" toggle
- **D-06:** Tools displayed: Jira, Linear, Google Workspace, Slack — each as a selectable card with connection status

### Cross-Tool Dedup & Preview UI
- **D-07:** Merged person view — one row per unique email. Each row shows source badges (Jira, Slack, Google, etc.) indicating which tools the person was found in
- **D-08:** Three status indicators per row: New (not in org), Conflict (name/data mismatch across sources), Exists (already an org member)
- **D-09:** Inline conflict resolution — clicking a conflict badge opens dropdown showing values from each source. User picks which value to use or types custom. Unresolved conflicts block confirm
- **D-10:** Batch actions: checkbox column with select-all, toolbar with Import Selected / Skip Selected / Assign Role to Selected. Existing members auto-set to Skip
- **D-11:** Filters on preview table: All / New / Conflicts / Existing

### Project/Status → Workflow Template Mapping
- **D-12:** Auto-generate one workflow template per imported Jira project / Linear team. Statuses from the project become workflow steps
- **D-13:** User can preview and rename/reorder/remove steps before confirming. Each project card shows "Edit steps" and "Skip this project" actions
- **D-14:** Pre-configure bidirectional sync mappings during import — the status mapping for Jira/Linear sync is set up automatically based on imported statuses. No extra setup needed in Settings after import

### Claude's Discretion
- Wizard step progression indicators and navigation UI
- Async import progress tracking UX (progress bars, toast notifications, etc.)
- Retry UX for individual failed items (ONBD-05)
- Loading states and skeleton patterns during data fetching from external APIs
- Email-based dedup algorithm implementation details
- Error handling for OAuth failures mid-wizard

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Onboarding requirements
- `.planning/REQUIREMENTS.md` — ONBD-01 through ONBD-05 define acceptance criteria

### Existing onboarding
- `apps/web/src/components/onboarding/onboarding-checklist.tsx` — Current 5-step onboarding checklist to be modified (step 2 becomes "Import Team")

### Integration adapters
- `packages/integrations/src/adapters/base-adapter.ts` — BaseAdapter abstract class with OAuth/webhook/health stubs
- `packages/integrations/src/adapters/jira-adapter.ts` — Jira OAuth + cloud discovery
- `packages/integrations/src/adapters/linear-adapter.ts` — Linear OAuth + GraphQL workspace discovery
- `packages/integrations/src/adapters/google-workspace-adapter.ts` — Google Workspace OAuth + `listAllDirectoryUsers()` + `listUserGroups()`
- `packages/integrations/src/adapters/slack-adapter.ts` — Slack OAuth with `users:read` + `users:read.email` scopes

### Existing import patterns
- `apps/web/src/components/integrations/google-workspace/directory-import-wizard.tsx` — 3-step directory import wizard (dedup by email, role mapping, bulk import) — reference pattern for member import
- `apps/web/src/components/import/import-wizard-dialog.tsx` — CSV/XLSX import wizard (parse → validate → commit pattern)
- `packages/api/src/services/import-processor.ts` — Import processing logic with auto-mapping and dedup

### Member management
- `packages/api/src/routers/user.ts` — User invite, list, role update, deactivation endpoints
- `apps/web/src/components/settings/invite-dialog.tsx` — Current invite dialog UI

### Integration routers (for project/status data)
- `packages/api/src/routers/google-workspace.ts` — Directory listing, group listing, bulk import endpoints
- `packages/api/src/services/jira-issue-sync.ts` — Jira project/status discovery patterns
- `packages/api/src/services/linear-issue-sync.ts` — Linear team/status discovery, GraphQL helper

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `onboarding-checklist.tsx`: Existing 5-step checklist storing completion in `settings.metadata.onboardingCompletedSteps` — step 2 will be replaced
- `directory-import-wizard.tsx`: 3-step Google Workspace import wizard with email dedup, role mapping, bulk import — closest existing pattern to the cross-tool wizard
- `directory-preview-table.tsx`: User selection table with checkboxes — reusable for merged preview
- `role-assignment-controls.tsx`: Default role picker component — reusable for role assignment
- `import-wizard-dialog.tsx`: 5-step CSV import with parse → validate → commit pattern — async import pattern reference
- All 4 integration adapters have working OAuth flows and token management

### Established Patterns
- Wizard UIs use multi-step state management with React hooks (currentStep, data state)
- Import flows follow parse → validate → commit mutation pattern
- Email-based dedup: lowercase normalization, check against `org.members[].user.email`
- Member creation uses Better Auth `createInvitation()` with 8 available roles
- QStash for async processing (fire-and-forget with retry)
- Jira/Linear status mappings stored per team in integration settings

### Integration Points
- Onboarding checklist step 2 link target changes from `/settings?tab=members` to `/onboarding/import`
- New tRPC router (or extension of existing routers) for cross-tool member fetching and batch import
- Workflow template creation via existing workflow engine (Phase 4)
- Jira/Linear status mapping APIs (existing) for pre-configuring sync

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 34-intelligent-onboarding-wizard*
*Context gathered: 2026-04-05*
