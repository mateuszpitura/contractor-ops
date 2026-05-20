# Facts — Organization Definitions Management (Teams / Projects / Cost Centers)

## Navigation & Information Architecture

- A new top-level sidebar entry labeled "Organization" appears in the main dashboard navigation, peer to "Contractors", "Invoices", etc.
- The Organization entry routes to `/[locale]/(dashboard)/organization` and contains three sub-routes: `/organization/teams`, `/organization/projects`, `/organization/cost-centers`.
- The Organization landing page (`/organization`) shows three summary cards (counts + recently-updated) linking to each sub-route.
- The sub-routes are sibling tabs in a shared layout (tab bar visible across all three pages).
- Nothing is moved out of `/settings/*` for v1 (members, workflow-roles, etc. stay where they are).
- The sidebar entry uses an icon distinct from "Settings" (e.g. Building or Network icon).

## Teams page

- Lists all Teams scoped to the active organization in a sortable, searchable table.
- Columns: Name, Code, Manager, Fallback Approver, Status (Active/Inactive/Archived), Source (Manual / Jira / Linear / …), Updated.
- Filter chips: Status (default Active), Source.
- A "New Team" button opens a side-sheet form: Name (required), Code (optional), Manager (User picker), Fallback Approver (User picker), initial Status (defaults Active).
- Clicking a row opens an edit side-sheet with the same fields plus an Archive action.
- Archive sets `status = ARCHIVED`; the row stays in the DB and any `Contractor.primaryTeamId` / `Contract.teamId` references are preserved.
- Archived Teams are hidden from the Contractor wizard `primaryTeamId` dropdown and any new pickers; historical records still resolve to the archived name in reports.
- Rows with `source != 'MANUAL'` show a small badge with the provider name and link back to the integration source page.

## Projects page

- Lists all Projects scoped to the active organization in a sortable, searchable table.
- Columns: Name, Code, Team (chip linking to the Team detail), Status, Start/End dates, Budget, Source, Updated.
- Filter chips: Status (default Active), Source, Team.
- A "New Project" button opens a side-sheet form: Name (required), Code (optional), Team (Team picker, optional), Status, Start date, End date, Budget amount + currency.
- Clicking a row opens an edit side-sheet with the same fields plus an Archive action.
- Archive sets `status = ARCHIVED`; preserves all FK references on Contractor, Contract, ContractorAssignment.
- Archived Projects are hidden from new-record pickers; historical records still resolve.
- Source badge behaves identically to the Teams page.

## Cost Centers page

- Lists all Cost Centers scoped to the active organization in a sortable, searchable table.
- Columns: Name, Code, Status, Updated.
- Filter chips: Status (default Active).
- A "New Cost Center" button opens a side-sheet form: Name (required), Code (required, uppercase, unique within organization), initial Status.
- Code uniqueness enforced at DB level (existing `@@unique([organizationId, code])`) and surfaced as a form error before submit.
- Clicking a row opens an edit side-sheet with the same fields plus an Archive action; the Code field is editable but the new value must remain unique per-org.
- An "Import CSV" button opens a dialog accepting a CSV file with columns `name,code` (header row required, UTF-8, ≤5 MB, ≤1000 rows).
- CSV import shows a preview table with per-row validation (missing name, duplicate code, code not uppercase) and lets the user deselect bad rows before commit.
- CSV import is transactional per request: either all selected rows insert or none do.
- Cost Centers have no integration source; the Source column / badges do not exist on this page.

## Database schema additions

- Two nullable columns are added to `Team` and `Project`: `source` (enum: `MANUAL`, `JIRA`, `LINEAR`, future providers) defaulting to `MANUAL`, and `externalId` (string, nullable).
- A composite unique index `@@unique([organizationId, source, externalId])` is added on `Team` and `Project` (partial / filtered to rows with non-null `externalId` if Postgres allows, otherwise a regular unique).
- Existing rows are migrated with `source = 'MANUAL'`, `externalId = NULL`.
- `CostCenter` schema is unchanged; no source/externalId fields.
- A migration is generated through Prisma and run via the existing multi-region migration script.

## RBAC (granular per-entity)

- Three new permission actions are added to the RBAC registry: `org.teams.manage`, `org.projects.manage`, `org.costCenters.manage`.
- The seed/default role assignments grant all three actions to `owner` and `admin` roles.
- No other built-in role gets them by default; custom roles can be granted them via the existing role-editor UI.
- Read access (list + view) for Teams, Projects, Cost Centers is available to all org members so the Contractor wizard dropdowns continue to work for everyone.
- Mutations (create, update, archive, CSV import, sync) require the matching `manage` permission and return a 403-equivalent TRPC error otherwise.

## Integration sync — Jira & Linear

- Jira projects sync into the `Project` table; Linear teams sync into the `Project` table (matching existing onboarding-import semantics where Linear "teams" map to projects).
- Each synced row stores `source = 'JIRA' | 'LINEAR'`, `externalId = <provider's id>`, and the provider's name.
- Local edits (rename, code change, archive) override the synced values; subsequent syncs do not overwrite locally-edited fields.
- A sync run will: insert new rows for unseen `externalId`s, leave existing rows untouched except for fields the user has never edited.
- Sync runs trigger:
  - automatically once when an integration is connected (first time only for that connection),
  - manually via a "Sync now" button per integration on the Organization > Projects page,
  - automatically by a nightly background job (one run per org per connected integration per 24h).
- When a sync would create a Project whose name (case-insensitive, trimmed) collides with an existing Project from a different source in the same org, the user is prompted via a "Pending merges" inbox on the Projects page to either merge (link the new external source to the existing row) or keep separate.
- The merge-prompt inbox shows: incoming candidate (name + source + externalId) and matching existing row(s); actions are Merge or Keep Separate; deferred items remain in the inbox until resolved.
- "Keep Separate" creates the new row as normal; "Merge" attaches the new `(source, externalId)` to the existing Project (a Project may carry multiple source links).
- To support multi-source linking, a new join table `ProjectExternalLink (id, projectId, source, externalId, syncedAt)` is introduced; `Project.source` / `Project.externalId` remain for the primary/first source and are mirrored from the first link for backwards compatibility.
- No retroactive backfill: orgs that ran onboarding-import before this feature shipped see new Project rows only on the next sync trigger.
- Cost Centers have no sync; no buttons or background jobs for them.

## Contractor wizard integration

- The existing `primaryTeamId`, `primaryProjectId`, `defaultCostCenterId` dropdowns in `apps/web/src/components/contractors/contractor-wizard/` filter to `status = ACTIVE` rows only.
- The dropdowns query through tRPC and refresh after a new entity is created in the Organization view (no manual refresh required).
- Each dropdown has an "Add new…" footer action (visible only to users with the relevant `manage` permission) opening the side-sheet form inline; on save the new entity is selected automatically.

## tRPC API surface

- A new `organizationDefinitions` router (or three sibling routers `team`, `project`, `costCenter` under `core/`) exposes:
  - `list({ status?, source?, search?, teamId? })` — paginated.
  - `get({ id })`.
  - `create(input)` — schema-validated.
  - `update({ id, ...input })`.
  - `archive({ id })`.
  - `costCenter.importCsv({ rows: [...] })` — transactional.
  - `project.sync({ connectionId })` — manual trigger.
  - `project.pendingMerges()` and `project.resolveMerge({ candidateId, action: 'merge' | 'keep', mergeIntoProjectId? })`.
- All procedures are `tenantProcedure` and apply the new RBAC checks.
- All input schemas live in `@contractor-ops/validators` and are exported for FE reuse.

## Observability & audit

- Every create / update / archive / sync / CSV import / merge action writes an `AuditLog` entry with actor, entityType, entityId, before/after JSON diff.
- Sync runs (manual + scheduled) log start, finish, counts (`inserted`, `linkedExisting`, `pendingMerges`, `errors`) via Pino.
- Failed sync runs surface in the existing IntegrationConnection error UI; the row in the Projects page shows a "Sync failed" banner with last-error message and timestamp.

## Internationalization & accessibility

- All new UI strings live in `apps/web/messages/en.json` under an `Organization.*` namespace and are referenced via `useTranslations`.
- Translations are added at least for `en`; other locales fall back to `en` until translated.
- All forms, tables, side-sheets, and merge inboxes meet WCAG keyboard-nav, focus-state, and contrast requirements consistent with the rest of the dashboard.

## Out of scope (v1)

- Moving Members, Workflow Roles, Contractor Tags, or any other entity out of Settings.
- Hierarchical or tree-based UI; views are flat tables.
- Webhook-driven real-time sync (covered later if needed).
- Auto-merge by name without user confirmation.
- CSV import for Teams or Projects (only Cost Centers in v1).
- Sub-team / sub-project hierarchies beyond the existing single `Project.teamId` FK.
- Retroactive backfill from existing IntegrationConnection data.
- Bulk archive / bulk edit.
- Cost-center allocation rules, budgets, or accounting workflows.
