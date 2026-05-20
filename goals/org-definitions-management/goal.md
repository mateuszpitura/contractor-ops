# Goal — Organization Definitions Management

## Goal

Add a top-level "Organization" view to the dashboard that lets users define and manage the Teams, Projects, and Cost Centers their contractors are assigned to — populated both manually and via Jira / Linear integration sync — so the contractor-wizard dropdowns finally have meaningful data behind them. Keeps the existing Settings page free of additional clutter and wires granular per-entity RBAC granted by default to owner and admin.

## Shared understanding

See [facts.md](./facts.md) for the full, plannotator-approved fact sheet covering navigation, per-page behavior, schema additions, RBAC, integration sync semantics, contractor-wizard integration, tRPC surface, observability, i18n/a11y, and explicit out-of-scope items.

## Execution plan

See [plan.md](./plan.md) for the plannotator-approved step-by-step plan, including file targets, verification commands, and risks.

## Done condition

All of the following are true:

1. The migrations from plan Steps 1 and 5 are applied across every region.
2. The three new RBAC resources (`team`, `project`, `costCenter`) are live and the `owner` + `admin` roles carry the mutating actions; all other roles carry `read` only.
3. `/organization`, `/organization/teams`, `/organization/projects`, and `/organization/cost-centers` are reachable from the sidebar and render the tabbed UI with create / edit / archive flows.
4. The Cost Centers page accepts a CSV import with transactional rollback.
5. Connecting a fresh Jira or Linear integration auto-populates `Project` rows; the nightly cron job (`cron-org-definition-sync`) is registered in `render.yaml`; a manual "Sync now" button works per-integration; name collisions land in a Pending Merges inbox that an admin can resolve.
6. The Contractor wizard dropdowns for `primaryTeamId`, `primaryProjectId`, `defaultCostCenterId` filter to `ACTIVE` rows, refresh after creation, and offer inline "Add new…" entries to permitted users.
7. Archive preserves all FK references on existing contractors / contracts / assignments and hides the entity from new pickers without breaking historical reports.
8. `pnpm run typecheck`, `pnpm run test`, and `pnpm run lint` all pass at the repo root.
9. Manual smoke walkthrough described in plan Step 14 completes without regressions.
