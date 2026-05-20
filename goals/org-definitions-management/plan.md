# Plan — Organization Definitions Management

## Solution approach

Build a thin vertical slice on top of existing infrastructure. Reuse:
- Prisma schema + multi-region migration runner (`packages/db/scripts/migrate-all-regions.ts`).
- Better-Auth access-control statement (`packages/auth/src/permissions.ts` + `roles.ts`) — add three new resources.
- tRPC tenant procedure + `requirePermission` middleware (`packages/api/src/middleware/rbac.ts`).
- Shared `@contractor-ops/validators` package for input schemas.
- Existing sidebar nav registry (`apps/web/src/lib/navigation.ts`) — add one item.
- Existing `AuditLog` write helper for mutations, Pino logger for sync runs.
- Cron pattern in `render.yaml` (`type: cron` calling `/api/cron/<name>` with `CRON_SECRET`) for nightly sync.
- Existing IntegrationConnection-aware Jira/Linear fetchers from `packages/api/src/routers/core/onboarding-import.ts` — extract their HTTP/GraphQL bits into a service so both onboarding-import and the new sync job can call them.

UI pattern: a shared `/organization` layout providing a tab bar (Teams / Projects / Cost Centers) plus a landing summary card; three sibling pages reuse the existing data-table / side-sheet form patterns already proven on `/contractors` and `/equipment`.

Naming alignment with codebase RBAC convention: facts call the permissions "granular per-entity"; we implement that as three new resources in the access-control statement — `team`, `project`, `costCenter` — each with actions `['read', 'create', 'update', 'archive']`. `read` is granted to every existing role (matches today's contractor-wizard expectations); the mutating actions are granted only to `owner` and `admin` by default.

---

## Ordered steps

### Step 1 — Database schema additions

- **Files**:
  - `packages/db/prisma/schema/organization.prisma` — add `source` (new enum `OrgDefinitionSource { MANUAL JIRA LINEAR }`) and `externalId String?` to `Team` and `Project`; add new model `ProjectExternalLink (id, projectId, source, externalId, syncedAt, @@unique([source, externalId]), @@unique([projectId, source]))`.
  - `packages/db/prisma/schema/contractor.prisma` — no change (FKs unchanged).
- **Migration**:
  - `pnpm --filter @contractor-ops/db db:migrate:dev --name add_org_definition_source` to generate.
  - Defaults: existing `Team` and `Project` rows get `source = MANUAL`, `externalId = NULL`.
  - Add filtered unique index per Postgres syntax in raw SQL appended to the migration: `CREATE UNIQUE INDEX team_org_source_external_uniq ON "Team" ("organizationId", "source", "externalId") WHERE "externalId" IS NOT NULL;` (same for `Project`).
- **Verification**:
  - `pnpm --filter @contractor-ops/db db:generate` succeeds.
  - `pnpm --filter @contractor-ops/db typecheck` clean.
  - `pnpm --filter @contractor-ops/db test` passes (`rls-integration.test.ts` may need a fixture refresh).
  - Apply against staging via `db:migrate:all` dry-run.

### Step 2 — RBAC: new resources + default role grants

- **Files**:
  - `packages/auth/src/permissions.ts` — extend `accessControlStatement` with `team`, `project`, `costCenter` each `['read', 'create', 'update', 'archive']`.
  - `packages/auth/src/roles.ts` — add the three resources to `allPermissions`, the `owner`, and `admin` roles with all actions; add `team: ['read']`, `project: ['read']`, `costCenter: ['read']` to every other role (`finance_admin`, `ops_manager`, `team_manager`, `legal_compliance_viewer`, `it_admin`, `external_accountant`, `readonly`).
  - `packages/auth/src/__tests__/permissions.test.ts` — extend the resource-coverage assertion list.
- **Verification**:
  - `pnpm --filter @contractor-ops/auth test` green.
  - `pnpm --filter @contractor-ops/auth typecheck` green.
  - Manual: log in as `readonly` user → confirm wizard dropdowns still load.

### Step 3 — Validators (input schemas)

- **Files**:
  - `packages/validators/src/organization-definitions.ts` — new file with `teamCreateSchema`, `teamUpdateSchema`, `projectCreateSchema`, `projectUpdateSchema`, `costCenterCreateSchema`, `costCenterUpdateSchema`, `costCenterCsvRowSchema`, `projectMergeResolveSchema`, etc.
  - `packages/validators/src/index.ts` — export the new module.
  - `packages/validators/src/__tests__/organization-definitions.test.ts` — happy + invalid cases for each.
- **Verification**:
  - `pnpm --filter @contractor-ops/validators test` green.
  - `pnpm --filter @contractor-ops/validators typecheck` green.

### Step 4 — Integration-sync service extraction

- **Files**:
  - New `packages/api/src/services/org-definition-sync.ts` — exports `syncJiraProjectsToOrgDefinitions(ctx, connection)` and `syncLinearTeamsToOrgDefinitions(ctx, connection)`; reuses the Jira/Linear HTTP fetchers (factor them out of `packages/api/src/routers/core/onboarding-import.ts` into `packages/integrations/src/services/jira-projects-client.ts` and `.../linear-teams-client.ts`).
  - Refactor `onboarding-import.ts` to call the new clients (no behavior change there).
  - Each sync function: for each remote project, look up `(organizationId, source, externalId)` via `ProjectExternalLink`; if found → no-op (or update `syncedAt`); if not found → check for name collision (case-insensitive trim) against existing `Project` rows in the same org; on collision insert a `PendingProjectMerge` row (see Step 5); on no collision insert a fresh `Project` (source/externalId set) and matching `ProjectExternalLink`.
  - All writes wrapped in a single Prisma `$transaction`; AuditLog entry per write; Pino structured log with `{ inserted, linked, pending, errors }` counts.
- **Verification**:
  - Unit-test the service with the existing MSW-based Jira/Linear mocks in `packages/test-utils`.
  - `pnpm --filter @contractor-ops/api test --run org-definition-sync` green.

### Step 5 — Pending merges model + tRPC routers

- **Files**:
  - `packages/db/prisma/schema/organization.prisma` — add `PendingProjectMerge (id, organizationId, source, externalId, incomingName, candidateProjectIds String[], createdAt)`; second Prisma migration.
  - `packages/api/src/routers/core/team.ts` — new router with `list`, `get`, `create`, `update`, `archive`.
  - `packages/api/src/routers/core/project.ts` — same plus `sync({ connectionId })`, `pendingMerges()`, `resolveMerge({ id, action: 'merge' | 'keep', mergeIntoProjectId? })`.
  - `packages/api/src/routers/core/cost-center.ts` — same plus `importCsv({ rows })`.
  - `packages/api/src/root.ts` — register the three sub-routers under a `organizationDefinitions` group.
  - All procedures: `tenantProcedure.use(requirePermission({ team: ['create'] }))` etc. Reads use the `read` action so every role passes.
  - AuditLog write on every mutation.
- **Verification**:
  - New tests under `packages/api/src/routers/__tests__/{team,project,cost-center}.test.ts` covering happy paths, RBAC deny, archive-then-list-filters, code-uniqueness, CSV transactional rollback.
  - `pnpm --filter @contractor-ops/api test` green.

### Step 6 — Cron + on-connect sync trigger

- **Files**:
  - New `apps/web/src/app/api/cron/org-definition-sync/route.ts` — `CRON_SECRET`-guarded, iterates all `IntegrationConnection.status = CONNECTED` of provider `JIRA` or `LINEAR`, invokes the sync service per org/connection; rate-limited so one org per connection per 24h.
  - `render.yaml` — new cron entry `cron-org-definition-sync`, schedule `0 4 * * *`, same auth pattern as siblings.
  - In `packages/api/src/routers/integrations/jira.ts` (and `linear.ts`) — at the end of the existing "complete connection" mutation, fire-and-forget call to the sync service for the just-connected org (logged + Sentry-captured on error, never blocks).
- **Verification**:
  - Manual `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/org-definition-sync` from local dev — returns `{ runs: N }`.
  - Unit test for the route's auth gate (mirrors the existing cron-route tests in `packages/api/src/middleware/__tests__/cron-trpc.test.ts`).

### Step 7 — Frontend: navigation + organization layout

- **Files**:
  - `apps/web/src/lib/navigation.ts` — add an `organization` `NavItem` in the `system` group (above `notifications`), `href: '/organization'`, icon `Network` or `Building2`, `permission: { resource: 'team', actions: ['read'] }` (any role passes).
  - `apps/web/messages/en.json` — add `Navigation.organization` key plus `Organization.*` namespace tree.
  - `apps/web/src/app/[locale]/(dashboard)/organization/layout.tsx` — shared layout rendering breadcrumb + tab bar (Teams / Projects / Cost Centers).
  - `apps/web/src/app/[locale]/(dashboard)/organization/page.tsx` — summary cards.
- **Verification**:
  - Dev server `pnpm dev`, log in, sidebar shows "Organization" entry; clicking it lands on summary page; tabs work.

### Step 8 — Frontend: Teams page

- **Files**:
  - `apps/web/src/app/[locale]/(dashboard)/organization/teams/page.tsx` — server component using existing data-table pattern (filters, search, sort).
  - `apps/web/src/components/organization/teams/team-table.tsx`, `team-form-sheet.tsx`, `team-source-badge.tsx`.
  - Permission-gate the "New Team" / edit / archive buttons via `usePermissions({ team: ['create'] })` etc.
- **Verification**:
  - Component tests under `apps/web/src/components/organization/teams/__tests__/`.
  - Manual: create, edit, archive a team; confirm archived row hidden from contractor wizard primaryTeamId dropdown.

### Step 9 — Frontend: Projects page

- **Files**:
  - `apps/web/src/app/[locale]/(dashboard)/organization/projects/page.tsx`.
  - `apps/web/src/components/organization/projects/{project-table,project-form-sheet,project-source-badge,pending-merges-inbox}.tsx`.
  - The merge inbox renders a callout banner at the top of the page when `pendingMerges().length > 0`; each row offers Merge (with Team-picker for target) or Keep Separate.
  - A "Sync now" button per connected integration in the page header → calls `project.sync({ connectionId })`.
- **Verification**:
  - Component tests for the merge-inbox flow.
  - Manual end-to-end: connect a Jira sandbox project, see new rows appear; rename a project that collides with a Linear project, run "Sync now", see merge prompt, resolve both ways and verify DB state.

### Step 10 — Frontend: Cost Centers page + CSV import

- **Files**:
  - `apps/web/src/app/[locale]/(dashboard)/organization/cost-centers/page.tsx`.
  - `apps/web/src/components/organization/cost-centers/{cost-center-table,cost-center-form-sheet,cost-center-csv-import-dialog}.tsx`.
  - CSV parsing reuses `packages/api/src/lib/csv.ts`; preview table allows per-row deselect; submit hits `costCenter.importCsv`.
- **Verification**:
  - Component tests covering CSV validation errors (missing name, dup code, lowercase code).
  - Manual: upload CSV, confirm transactional rollback on any error row staying selected.

### Step 11 — Contractor wizard integration

- **Files**:
  - `apps/web/src/components/contractors/contractor-wizard/step-assignment.tsx` — update the three dropdowns to call the new `team.list({ status: 'ACTIVE' })` / `project.list({ status: 'ACTIVE' })` / `costCenter.list({ status: 'ACTIVE' })` endpoints (replace the existing data sources, whatever they are today).
  - Add an "Add new…" footer row in each Combobox dropdown, visible only when `usePermissions` reports the matching `create` action; opens the corresponding side-sheet inline; on save, invalidate the relevant query and auto-select the new id.
- **Verification**:
  - Update `apps/web/src/components/contractors/contractor-wizard/__tests__/step-assignment.test.tsx`.
  - Manual: as `owner`, click "Add new team" inside wizard → side-sheet opens → save → wizard dropdown selects the new team.

### Step 12 — Observability + audit

- **Files**:
  - Each mutation procedure already logs via the existing `AuditLog` helper (added in Step 5); double-check coverage.
  - The cron route emits a single Pino INFO line per org/connection with `{ orgId, connectionId, provider, inserted, linked, pending, durationMs }`.
  - Failed sync writes to `IntegrationConnection.lastSyncError` (already exists per the integrations schema — confirm in `integration.prisma`).
- **Verification**:
  - Run cron locally with a deliberately broken Jira token; confirm error surfaces in IntegrationConnection UI on Projects page.

### Step 13 — i18n + a11y polish

- **Files**:
  - `apps/web/messages/en.json` — finalize `Organization.*` keys.
  - Run `pnpm --filter web check:i18n` (or whatever the project's i18n typed-keys generator is — `apps/web/src/i18n/typed-keys.ts` indicates one exists).
  - axe/playwright pass on each new page (reuse existing pattern in `apps/web/__tests__`).
- **Verification**:
  - `pnpm --filter web typecheck` green (typed-keys catches missing translations).
  - axe smoke test green.

### Step 14 — Final integration + smoke test

- **Verification**:
  - `pnpm run typecheck` (root) green.
  - `pnpm run test` (root) green.
  - `pnpm run lint` green.
  - Dev server walkthrough: full happy-path from connecting a Jira integration → Projects auto-populate → manual create new Team → archive a team → create contractor with wizard → existing reports still show archived team names.

---

## Risks / open questions

- **Filtered unique index on Postgres** — confirmed supported (`WHERE` clause on `CREATE UNIQUE INDEX`); but Prisma's schema DSL doesn't model partial uniques natively. We'll declare the multi-column unique in `schema.prisma` and override with raw SQL inside the migration to add the `WHERE externalId IS NOT NULL` filter (so multiple `NULL` rows remain allowed).
- **Migration sequencing across regions** — two migrations (Step 1 + Step 5). `db:migrate:all` runs sequentially per region; safe.
- **Onboarding-import overlap** — the existing onboarding-import wizard creates workflow templates from Jira projects but not Project rows; once Step 4 ships, every onboarding-import call also persists Project rows. That's a behavior change; confirm with stakeholders before flipping it on, or guard the new behavior behind a feature flag `org.definitions.sync` for a release.
- **Pending merges inbox in low-permission roles** — non-admin members see the Projects page but cannot resolve merges. Need to hide the inbox banner for them (use `usePermissions({ project: ['update'] })`).
- **ProjectExternalLink + legacy `Project.source/externalId` duplication** — we keep the denormalized fields on `Project` only for the *primary* link to keep the read-side simple. Confirm we're OK with this or drop them and read everything through `ProjectExternalLink` (more queries but cleaner).
- **CSV import size limit** — `≤5 MB, ≤1000 rows` is asserted client-side and on the server. If real-world cost-center exports run larger, we'll need streaming / async job.
- **Rate-limiting nightly cron** — implementation must skip orgs already synced in the last 24h, otherwise a restart could double-fire. Use `IntegrationConnection.lastSyncAt`.
- **Workflow templates created from onboarding-import** — these reference Jira project IDs directly today; we shouldn't break that link. Sanity-check Step 4 doesn't disturb workflow-template creation.
- **Contractor wizard inline "Add new…"** — opening a side-sheet from inside a Dialog (the wizard is one) needs Radix Portal nesting checked; verify no focus-trap regressions.
- **No retroactive backfill** means orgs that connected integrations weeks ago see nothing in Organization > Projects until the first sync runs. The sync-on-connect only fires on *new* connections; explicit "Sync now" button (Step 9) is the user-driven escape hatch.
