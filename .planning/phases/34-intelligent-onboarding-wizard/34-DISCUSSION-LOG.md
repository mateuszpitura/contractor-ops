# Phase 34: Intelligent Onboarding Wizard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 34-intelligent-onboarding-wizard
**Areas discussed:** Wizard entry point & flow, Source connection during wizard, Cross-tool dedup & preview UI, Project/status → workflow template mapping

---

## Wizard Entry Point & Flow

### Where should the import wizard live?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace "Invite Team" step | Onboarding checklist step 2 becomes "Import Team" — opens cross-tool wizard. Falls back to manual invite if no tools connected. | ✓ |
| New step after "Connect Integrations" | Add 6th step "Import from Tools" that only appears after connecting a tool. Keeps existing invite flow. | |
| Standalone page at /onboarding/import | Separate full-page wizard accessible from checklist and Settings. Not a dialog. | |

**User's choice:** Replace "Invite Team" step
**Notes:** None

### Dialog or full page?

| Option | Description | Selected |
|--------|-------------|----------|
| Full-page wizard | Dedicated page at /onboarding/import with full-width tables. Better for large preview tables. | ✓ |
| Dialog wizard | Reuse dialog pattern from Google Workspace import. Lightweight but may feel cramped with 4 sources. | |

**User's choice:** Full-page wizard
**Notes:** None

### Accessible after onboarding?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, also from Settings | Import wizard reusable — accessible from onboarding checklist AND Settings > Integrations. | ✓ |
| Onboarding only | Wizard only during initial onboarding. Later imports use per-tool buttons. | |

**User's choice:** Yes, also from Settings
**Notes:** None

---

## Source Connection During Wizard

### How should users connect tools?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline OAuth in wizard | Step 1 shows all 4 tools as cards. Unconnected = "Connect" button (OAuth popup). Connected = checkmark + "Import" toggle. | ✓ |
| Pre-connected only | Only shows already-connected tools. Shows "Connect in Settings first" if none. | |
| Hybrid | All 4 tools shown. Connected get toggle. Unconnected get "Connect in Settings" link (no inline OAuth). | |

**User's choice:** Inline OAuth in wizard
**Notes:** None

### Zero sources selected?

| Option | Description | Selected |
|--------|-------------|----------|
| "Skip import" link + manual invite | Bottom of step 1: "Skip — I'll invite people manually" → completes onboarding step, redirects to members page. | ✓ |
| At least one source required | Wizard requires selecting at least one source. Manual invite is separate path. | |

**User's choice:** "Skip import" link + manual invite
**Notes:** None

---

## Cross-Tool Dedup & Preview UI

### How to present cross-source results?

| Option | Description | Selected |
|--------|-------------|----------|
| Merged person view | One row per unique email. Source badges per row. Conflicts highlighted with tooltip. Batch actions. | ✓ |
| Per-source tabs | Separate tab per source. Cross-source duplicates flagged with badge to other tab. | |
| Source-grouped single table | One table, rows grouped by source. Duplicate rows connected by visual link. | |

**User's choice:** Merged person view
**Notes:** None

### How to handle conflicts?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline edit with source picker | Conflict rows highlighted. Click badge → dropdown with values from each source. Pick or type custom. Unresolved block confirm. | ✓ |
| Auto-resolve with priority | System auto-picks based on source priority (Google > Jira > Linear > Slack). Silent resolution. | |
| Resolve all at end | Preview as-is. Separate "Resolve conflicts" step before confirming. | |

**User's choice:** Inline edit with source picker
**Notes:** None

### Batch actions?

| Option | Description | Selected |
|--------|-------------|----------|
| Select all + Import / Skip / Assign role | Checkbox column, select-all. Toolbar: Import Selected, Skip Selected, Assign Role. Existing auto-Skip. Filters: All/New/Conflicts/Existing. | ✓ |
| Simple import all / skip all | Two bulk buttons. No per-row selection. Conflicts resolved individually. | |

**User's choice:** Select all + Import / Skip / Assign role
**Notes:** None

---

## Project/Status → Workflow Template Mapping

### How should projects map to workflows?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-generate template per project | Each Jira project / Linear team → workflow template. Statuses → steps. User can preview/rename/reorder/remove before confirming. | ✓ |
| Import as raw data | Projects/statuses imported as reference. User manually builds templates using template builder. | |
| Single merged template | System finds common status patterns across projects, suggests one unified template. | |

**User's choice:** Auto-generate template per project
**Notes:** None

### Pre-configure sync mappings?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, pre-configure sync mappings | During template preview, show status mapping for bidirectional sync. If confirmed, workflow is pre-wired for Jira/Linear sync. | ✓ |
| Templates only, sync later | Wizard creates templates but no sync mappings. User configures in Settings afterward. | |
| Claude decides | Flexibility based on implementation complexity. | |

**User's choice:** Yes, pre-configure sync mappings
**Notes:** None

---

## Claude's Discretion

- Wizard step progression indicators and navigation UI
- Async import progress tracking UX (progress bars, toasts, etc.)
- Retry UX for failed items
- Loading states during external API calls
- Email dedup algorithm details
- OAuth failure error handling

## Deferred Ideas

None — discussion stayed within phase scope
