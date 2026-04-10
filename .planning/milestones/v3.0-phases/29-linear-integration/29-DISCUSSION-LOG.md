# Phase 29: Linear Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 29-linear-integration
**Areas discussed:** Status mapping UX, Issue creation defaults, Linked issue chip, Settings placement

---

## Status Mapping UX

| Option | Description | Selected |
|--------|-------------|----------|
| Per-team dialog (like Jira) | Admin opens mapping dialog per Linear team, maps each state to workflow status | ✓ |
| Smart defaults + override | Auto-map common states, admin only edits exceptions | |
| Global mapping only | One mapping for whole workspace, not per-team | |

**User's choice:** Per-team dialog (like Jira)
**Notes:** Follows existing Jira pattern for consistency

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, pre-populate | Dialog opens with best-guess mappings based on state names | ✓ |
| No, start blank | Admin maps each state manually from scratch | |

**User's choice:** Yes, pre-populate smart defaults
**Notes:** Reduces setup to quick confirmation for standard teams

| Option | Description | Selected |
|--------|-------------|----------|
| At connection | After OAuth, admin picks teams and maps statuses immediately | ✓ |
| Deferred until task link | Prompted only when first task tries to create Linear issue | |

**User's choice:** At connection time
**Notes:** Ensures bidirectional sync works from first task

| Option | Description | Selected |
|--------|-------------|----------|
| Ignore silently | Logged but don't update task. Admin can map later | ✓ |
| Flag in webhook log | Warnings in integration health panel | |
| Notify admin | Send notification on unmapped state encounter | |

**User's choice:** Ignore silently
**Notes:** No noise for custom states

---

## Issue Creation Defaults

| Option | Description | Selected |
|--------|-------------|----------|
| Per-workflow template | Admin configures target Linear team during workflow setup | ✓ |
| Per-task override | Default from template but user can override per task | |
| Single default team | One default team at connection level | |

**User's choice:** Per-workflow template
**Notes:** Consistent, predictable team targeting

| Option | Description | Selected |
|--------|-------------|----------|
| Title + description only | Task name as title, task description as body. No labels/priority | ✓ |
| Title + description + priority | Map workflow task priority to Linear priority levels | |
| Full field mapping | Admin configures all fields: labels, priority, project, cycle, estimate | |

**User's choice:** Title + description only
**Notes:** Keep it simple, teams triage in Linear

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, match by email | Look up Linear account by email, assign. Fallback to unassigned | ✓ |
| No, leave unassigned | Always unassigned, team triages in Linear | |
| Configurable per template | Toggle auto-assign on/off per workflow template | |

**User's choice:** Yes, match by email
**Notes:** Automatic with graceful fallback

---

## Linked Issue Chip

| Option | Description | Selected |
|--------|-------------|----------|
| Issue ID + status badge | Shows 'ENG-123' with colored status dot. Compact, scannable | ✓ |
| Issue ID + status + title | Shows 'ENG-123 · Fix login bug' with status. More context, more space | |
| Issue ID + status + assignee | Shows issue ID with status and assignee avatar | |

**User's choice:** Issue ID + status badge
**Notes:** Matches Jira chip pattern — compact and scannable

| Option | Description | Selected |
|--------|-------------|----------|
| Linear purple accent | Subtle Linear purple tint/icon, distinct from Jira blue | ✓ |
| Neutral app style | Same neutral styling, only icon distinguishes | |
| You decide | Let Claude choose | |

**User's choice:** Linear purple accent
**Notes:** Provider-branded approach matching Jira's blue treatment

---

## Settings Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Own section like Jira | Connection card + status mapping button, matching Jira treatment | ✓ |
| Standard provider card | Appears in generic grid, mapping via detail sheet | |
| PM tools group | Group Jira and Linear under 'Project Management' heading | |

**User's choice:** Own section like Jira
**Notes:** Both are bidirectional PM tools with complex config

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, both allowed | Different teams can use different tools. Independent adapters | ✓ |
| Mutually exclusive | Only one PM integration active at a time | |

**User's choice:** Yes, both allowed
**Notes:** Supports orgs with mixed tooling or transitioning between tools

---

## Claude's Discretion

- Linear OAuth scope selection and token refresh implementation
- Webhook signature verification approach
- Smart-default mapping algorithm for status names
- Linear GraphQL API query structure
- Loop prevention timing parameters
- Team/workspace discovery flow
- API rate limit error handling

## Deferred Ideas

None — discussion stayed within phase scope
