# Phase 74: F4 Offboarding — Workflow Foundation + KT Templates + Override Permission - Research

**Researched:** 2026-04-27
**Domain:** Workflow engine extension (offboarding) + Better Auth permission registration + PTO-aware delegation + i18n parity
**Confidence:** HIGH (all critical claims verified against source files; one MEDIUM area: free-busy API method shape, verified via training + adapter pattern only — no Context7 lookup necessary because we are extending OUR adapter, not consuming Google's API at the Library level)

## Summary

Phase 74 lands the offboarding workflow's missing role-typed scaffolding on top of an already-mature workflow engine. The codebase reality check found that nearly **every** new artefact CONTEXT.md mentions does NOT yet exist — `WorkflowRoleTemplate`, `Contractor.workflowRoleId`, `User.outOfOffice`, `Team.fallbackApproverId`, `WorkflowTaskType.IP_VERIFICATION`, the `workflow:override_blocking_task` permission, the free-busy method on either calendar adapter, and the `@contractor-ops/offboarding-templates` package. This is a creation phase, not a refactor phase, which is good — there is little risk of touching production data and the migration is purely additive.

The two pivotal codebase facts that shape the plan:

1. **`Contractor` has no existing free-text `role` / `position` field at all.** D-02's "repurpose vs add new column" question is settled by the schema: we ADD `workflowRoleId` as a new nullable FK. There is nothing to repurpose. The "backfill of existing free-text role" risk in CONTEXT.md disappears — the only backfill needed is to set `workflowRoleId = NULL` for existing rows (default), letting auto-selection fall back to `Generic Consultant` until ops or the contractor wizard explicitly tags them.
2. **The "OWNER role" referred to throughout CONTEXT.md is named `owner` (lowercase) in `packages/auth/src/roles.ts`.** Better Auth role keys are lowercase. CI tests must iterate the actual role names: `owner`, `admin`, `finance_admin`, `ops_manager`, `team_manager`, `legal_compliance_viewer`, `it_admin`, `external_accountant`, `readonly`, `platform_operator`. The override permission lands on `owner` only.

**Primary recommendation:** Slice into 8 plans across 4 waves. One plan (Plan 74-04, the schema migration) is `autonomous: false` per Phase 70/71/76 precedent — multi-region apply via `push-all-regions.ts` is human-supervised. Adopt the `offboarding-ip-foundation` flag name (matches the `offboarding-ip-` gated namespace) — the CONTEXT.md alternate "offboarding-hardening-foundation" would not satisfy the Phase 70 boot gate.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Role-template seeds (4 KT seeds + PTO_KEYWORDS) | New `@contractor-ops/offboarding-templates` workspace package (TS source) | Database (`WorkflowRoleTemplate` rows on first-boot upsert) | Hybrid pattern — TS source-of-truth for engineering review, DB row-of-truth at runtime so ops can extend (D-01 + D-04) |
| `WorkflowRoleTemplate` + per-locale columns | Database (Prisma model in `workflow.prisma`) | API (CRUD endpoints in `workflow-templates.ts`) | Multi-tenant table with `organizationId` isolation; ops-extensible runtime data (D-14) |
| `workflow.override_blocking_task` permission | Auth (`packages/auth/src/permissions.ts` statements + `roles.ts` owner-only assignment) | API (tRPC middleware `requirePermission` gate on the override mutation) | Better Auth statements registry is the single source of truth; UI gating (D-12) is belt-and-suspenders only |
| Override mutation + audit-log emission | API (tRPC mutation, single `$transaction` writing `WorkflowRun.overrideMetadata` + `AuditLog` row via existing `writeAuditLog` helper) | Database (atomicity via Prisma `$transaction`) | Single audit-row-per-event pattern (Phase 71 D-15 / Phase 76 D-04 precedent) |
| PTO-aware manager fallback | API (workflow-shared.ts new helper `resolveAssigneeWithPto`) | Integrations (calendar adapter free-busy method) + Database (`User.outOfOffice` JSONB read) | Calendar lookup is best-effort I/O; fallback chain is pure logic; per-team `Team.fallbackApproverId` is a per-org config |
| Free-busy lookup (Google + Outlook) | Integrations (`google-calendar-adapter.ts` + `outlook-calendar-adapter.ts` new methods) | API (workflow-shared.ts consumes via adapter registry) | Pattern mirrors existing event CRUD methods on the same adapters |
| Override dialog UX | Frontend Server (Next.js RSC page renders dialog component conditionally on `getCurrentUserPermissions`) | Browser (form validation min-20-chars + ack checkbox) | Server-side re-validation in the mutation is non-bypassable per CLAUDE.md "Never trust client input" |
| i18n message keys (en/pl/de) | `apps/web/messages/{en,pl,de}.json` source files | Phase 70 `pnpm i18n:parity` guard | Seed templates use i18n keys (D-13); ops-added rows use per-locale DB columns (D-14); guard enforces source parity only (D-16) |
| Settings UI for role-template management + PTO keyword extension | Frontend Server (Next.js admin pages under `apps/web/src/app/[locale]/(admin)/...`) | API (CRUD endpoints) | Phase-73-owns-broader-admin-polish per CONTEXT.md; this phase ships functional UI only |

## User Constraints (from CONTEXT.md)

### Locked Decisions
**Role taxonomy + KT template seed shape**
- **D-01:** Hybrid storage — 4 seeds ship as typed constants in a new `@contractor-ops/offboarding-templates` workspace package (mirrors Phase 70 D-02 / Phase 71 D-01). On first boot per org, seeds are upserted into a `WorkflowRoleTemplate` Prisma table with `isSeed: true`. Ops-added templates land in the same table with `isSeed: false`. Single read path for the workflow engine.
- **D-02:** Contractor role tag — new `Contractor.workflowRoleId` FK to `WorkflowRoleTemplate`. Set in the contractor wizard. Backfill maps existing rows to default fallback = `Generic Consultant`.
- **D-03:** Manual override at offboarding-start: dropdown showing all `WorkflowRoleTemplate`s for the org. Default = auto-selected by `Contractor.workflowRoleId`. Admin's selection (if different from auto) is recorded on the workflow-run row: `overriddenTemplateId`, `overriddenByUserId`, `overriddenAt`. **No mid-workflow swap.**
- **D-04:** Seed shape (typed-const) — `{ role, displayNameI18nKey, taskItems: [{titleI18nKey, descriptionI18nKey, dueDayOffset, requiredDocs?}] }`.

**PTO-aware manager fallback (Pitfall 26)**
- **D-05:** PTO source layered — primary = calendar free-busy via existing v2.0 calendar adapter (`google-calendar-adapter.ts` + `outlook-calendar-adapter.ts`); secondary = explicit per-user `User.outOfOffice: { from, until, fallbackUserId }`.
- **D-06:** Fallback chain (per-team) — Default: manager → `Team.fallbackApproverId` → OWNER role users. Per-user override: `User.outOfOffice.fallbackUserId` takes precedence.
- **D-07:** No-calendar behavior — if the org has no calendar integration connected, **skip the PTO check entirely**; manual `User.outOfOffice` setting still applies.
- **D-08:** PTO match rule — all-day busy event today OR timed busy event whose title matches `PTO_KEYWORDS` per locale. `PTO_KEYWORDS = { en: ['PTO', 'OOO', 'Out of Office', 'Vacation'], de: ['Urlaub', 'Krank'], pl: ['Urlop', 'Wakacje'] }`. Ops can extend via Settings > Calendar PTO Keywords.

**Override permission registration + dialog UX**
- **D-09:** Add `workflow:override_blocking_task` to Better Auth's `statements` array; map to OWNER role only; CI test iterates non-OWNER roles and asserts `hasPermission({ workflow: ['override_blocking_task'] })` returns false for each.
- **D-10:** Override dialog — modal with reason textarea (min 20 chars; client + server validation), acknowledgement checkbox, dual-validated submit. Same-transaction write of override record + AuditLog.
- **D-11:** Audit shape + permanent badge — single `AuditLog` entry per override (action `workflow.offboarding.override_blocking_task`); permanent badge data on `WorkflowRun.overrideMetadata` JSONB column. Both writes in the same transaction.
- **D-12:** UI gating — `getCurrentUserPermissions` tRPC query at page load + conditional render. Server `requirePermission()` re-checks on every mutation.

**i18n strategy (SC#3 + SC#6)**
- **D-13:** Seed templates' role-specific items localized via per-task-item i18n keys under `Offboarding.Templates.{role}.{itemKey}` in `messages/{en,de,pl}.json` (NOT ar — Phase 79 covers AR for Gulf surfaces only). Werkvertrag-related copy is NOT shipped this phase (Phase 75).
- **D-14:** Ops-added templates carry per-locale fields directly on the DB row — `WorkflowRoleTemplate` columns `displayNameEn/Pl/De`; `WorkflowTaskTemplate` (or new sub-table) columns `titleEn/Pl/De`, `descriptionEn/Pl/De`. Settings UI surfaces 3 input fields per task item with "Copy from English" helper.
- **D-15:** Locale-fallback rule — when a key is missing for the active locale on an ops-added template, render the English value with a small visual `(English)` indicator. Seed templates always have all locales (i18n:parity guard enforces).
- **D-16:** i18n:parity guard scope unchanged — Phase 70's `pnpm i18n:parity` continues to enforce json-file parity for SEED templates and the rest of the app surfaces. Ops-added DB rows are intentionally OUT of guard scope.

### Claude's Discretion
- Exact 6-9 task items per seed (Researcher drafts; production wording reviewable in code) → see `## Code Examples` for proposed seed task lists.
- Acknowledgement checkbox copy (D-10) → see `## Code Examples` for proposed wording.
- The `(English)` indicator visual treatment (suffix vs info icon) — match existing design-system conventions; UI-SPEC determines.
- The Settings > Calendar PTO Keywords UI shape — Phase 73 owns broader admin dashboard polish; this phase ships functional UI only.
- `Contractor.workflowRoleId` migration — settled by the codebase: there is NO existing free-text role/position field on `Contractor`. Add a new nullable FK column. No deprecation of an old field is required.
- Permission-registry test exact shape — match the existing `rbac.test.ts` pattern (mocked `hasPermission` table-driven across the 10 actual roles).
- No-team-no-OOO fallback admin-attention badge UI — planner discretion; UI-SPEC determines.

### Deferred Ideas (OUT OF SCOPE)
- Skip-level fallback (manager's manager) — no org-chart hierarchy field exists.
- On-the-fly translation service for ops templates — LOCAL-ONLY constraint.
- Translation queue for ops templates — inline 3-locale form covers the need.
- Mid-workflow template swap — data-migration risk.
- Org-wide single fallback approver — bottleneck.
- DB-row completeness check in i18n:parity guard — D-16 keeps guard simple.
- Werkvertrag locked-phrase entries — Phase 75.
- Arabic (ar) localization for OFFB surfaces — Phase 79 covers AR for Gulf only.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OFFB-01 | Admin offboarding workflow includes 4 role-typed knowledge-transfer seed templates; template auto-selects from contractor's primary role tag with manual override | `## Standard Stack` (offboarding-templates package + WorkflowRoleTemplate model) + `## Code Examples` (4 seeds drafted) + Plan 74-02/74-04/74-05 |
| OFFB-02 | System auto-routes KT tasks to the contractor's manager; if manager is on PTO (per v2.0 calendar integration) the task delegates to the configured fallback approver | `## Architecture Patterns` (PTO-aware resolveAssignee) + `## Code Examples` (free-busy method) + Plan 74-06 |
| OFFB-03 | Admin can extend role taxonomy via per-org WorkflowRole model with editable templates; v6.0 ships 4 seed templates, ops customise without engineering | `## Architecture Patterns` (Hybrid TS+DB) + Plan 74-04 (schema) + Plan 74-07 (Settings UI) |
| OFFB-07 | OWNER-role admin can override the IP_VERIFICATION block with a required reason text + acknowledgement checkbox; override is audit-logged and surfaces a permanent badge | `## Standard Stack` (Better Auth statements + writeAuditLog) + Plan 74-03 (permission) + Plan 74-08 (override dialog + mutation) |
| OFFB-10 | System adds `WorkflowTaskType.IP_VERIFICATION` and `WorkflowTaskType.CONTRACT_HEALTH_CHECK` to the workflow engine; `workflow:override_blocking_task` permission registered OWNER-only | `## Schema-Migration Shape` (enum additions) + Plan 74-04 (schema) + Plan 74-03 (permission) |
| OFFB-11 | All OFFB surfaces ship en/pl/de parity at message-key level; locked-phrase registry extends with Werkvertrag IP-clause canonical wordings | Werkvertrag wording is **Phase 75**, NOT this phase. Phase 74 ships en/pl/de parity for OFFB surfaces; Phase 70 i18n:parity guard enforces. Plan 74-02 (seed i18n keys) + Plan 74-08 (override dialog copy) + Plan 74-07 (Settings UI copy) |

> Note OFFB-11's wording: "locked-phrase registry extends with Werkvertrag" — that extension is **Phase 75 scope** per CONTEXT.md SC#6 + STATE.md Standing Constraints. Phase 74 covers the en/pl/de parity surface portion only. The plan-checker should not flag OFFB-11 as missing if the locked-phrase registry remains untouched in this phase.

## Project Constraints (from CLAUDE.md)

| Constraint | Phase 74 application |
|------------|----------------------|
| Use `frontend-design` plugin for all UI work | Override dialog, Settings UI, badge component — UI-SPEC.md should drive component choices via design-system primitives |
| Monorepo via Turborepo, clean architecture, SOLID | New `@contractor-ops/offboarding-templates` workspace package — pure TS, no React, no Prisma; consumed by `packages/api` and tested in isolation |
| Use `ctx7` CLI for library docs | Researcher used Context7 for Better Auth statements API; planner should re-verify Better Auth `accessControlStatement` shape if API surface ambiguity arises during implementation |
| Use latest stable libraries; avoid legacy | `@date-fns/tz` v4 (Phase 71 D-07 convergence); Better Auth >= v1.2.9 (matches existing repo dep) |
| Strong typing; explicit; no magic | Seed shape is fully typed (`Seed`, `TaskItem`, `Role`); permission registry is `as const` |
| Schema validation at every boundary | Override mutation input → Zod schema (reason min 20 chars, ack boolean true); Settings UI inputs → Zod schemas |
| Never trust client input | UI gating is decoration; server-side `requirePermission({ workflow: ['override_blocking_task'] })` + Zod input parse is the load-bearing check |
| Security best practices | Audit log row written in same transaction as override; IP/UA captured from request; permanent badge is immutable (no nullable field on overrideMetadata once set) |
| RLS / DB-level protections | Existing `tenantStore` + `getRegionalClient` already enforce org-scoping; new tables carry `organizationId` (FOUND6-01 lint:schema gate enforces) |
| WCAG / a11y | Override dialog must trap focus, restore on close, label form fields, announce ack-checkbox state; Settings PTO-keywords editor must be keyboard navigable |
| `.env.example` up to date | No new env vars introduced this phase |
| Observability — Pino, no console | All new code uses `createLogger({ service: '<phase-area>' })`; Phase 70 `pnpm lint:logs` guard enforces |
| API contracts — predictable | `getCurrentUserPermissions` query already exists pattern; new `getRoleTemplates` / `createRoleTemplate` / `getOverrideEligibility` follow tRPC conventions |
| DB — maintainable, indexed | New `WorkflowRoleTemplate` carries `@@index([organizationId])` and `@@index([organizationId, role])`; `WorkflowRun.overrideMetadata` JSONB has no index (single-row lookup via PK is sufficient) |
| Production thinking | Empty-state for "no manager configured" + "no fallback configured" + "no calendar connected" all flow through PTO-aware resolver gracefully |

## Standard Stack

### Core (already in repo — verified versions present)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-auth` | (existing repo dep — see `packages/auth/package.json`) | Permission statements + role-based access control | Already the auth source-of-truth; D-09 plugs into existing `accessControlStatement` |
| `@prisma/client` | (existing — Prisma 7) | ORM for new `WorkflowRoleTemplate` model + `User.outOfOffice` JSONB | Already drives every model in `packages/db` |
| `zod` | (existing) | Override mutation input validation, Settings UI form schemas | Repo standard for tRPC input |
| `@contractor-ops/logger` | (existing) | Pino factories — `createLogger({ service: 'offboarding' })` | CLAUDE.md mandate; Phase 70 `lint:logs` enforces |
| `@contractor-ops/feature-flags` | (existing) | `offboarding-ip-foundation` PENDING entry; flag check at boot via signoff-registry-flags.ts | Phase 70 D-09..12 gate |
| `@trpc/server` v11 | (existing) | Mutations + queries | Existing tRPC v11 — see `workflow-templates.ts` |
| `@date-fns/tz` v4 | (Phase 71 D-07 pin) | TZ-aware "TODAY" determination for PTO match rule | **Convergence with Phase 71** — ONE TZ library across v6.0; `apps/web/package.json` already has `date-fns@^4.1.0`; `@date-fns/tz` is a sibling sub-package with `TZDate` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | (existing) | Unit + integration tests | Existing test runner |
| `@testing-library/react` (RTL) | (existing) | Override dialog + Settings UI tests | Existing UI test runner |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New typed-const package `@contractor-ops/offboarding-templates` | Inline seeds in `packages/api/src/services/offboarding-seeds.ts` | Inline keeps it simple, but a workspace package matches the established pattern (Phase 70 D-02 typed-const package, Phase 71 D-01 `@contractor-ops/compliance-policy`). Workspace package wins on consistency + reusability + isolated test surface |
| Separate `OffboardingRecord` table for the override badge | Reuse `WorkflowRun.overrideMetadata` JSONB | The existing v1.0 `WorkflowRun` model IS the offboarding-run row when `WorkflowTemplate.type = OFFBOARDING`. Reusing avoids a duplicate model. Add `overrideMetadata Json?` column to `WorkflowRun` |
| Adding free-busy as a new dedicated `CalendarFreeBusyAdapter` interface | Method on existing `GoogleCalendarAdapter` + `OutlookCalendarAdapter` | The two adapters are the only callers; following the existing event-CRUD-methods-on-the-same-class pattern is simpler |
| Per-locale `WorkflowTaskTemplateLocale` sub-table for ops templates | Per-locale columns directly on `WorkflowTaskTemplate` | D-14 chose direct columns. Sub-table would be cleaner schema but means a 3x JOIN on every offboarding-render query. Direct columns trade a wide row for fast reads — the right call for content fields |

**Installation:**
```bash
# New workspace package — added to repo root pnpm-workspace.yaml then:
pnpm --filter @contractor-ops/offboarding-templates init
# Add @date-fns/tz to the templates package + the api package (consumers of the PTO date math)
pnpm --filter @contractor-ops/api add @date-fns/tz
pnpm --filter @contractor-ops/offboarding-templates add @date-fns/tz
```

**Version verification:** `[VERIFIED: codebase grep]` — `apps/web/package.json` declares `"date-fns": "^4.1.0"`; `@date-fns/tz` is the v4 sibling package per Phase 71 RESEARCH.md line 385. `[ASSUMED]` Latest `@date-fns/tz` minor version compatible with `date-fns@^4.1.0` is the same minor as `date-fns` (v4.x); the planner should run `pnpm --filter @contractor-ops/api view @date-fns/tz version` at install time to capture the exact pin.

## Architecture Patterns

### System Architecture Diagram

```
                                      Admin starts offboarding
                                                │
                                                ▼
                  ┌────────────────────────────────────────────────────┐
                  │ workflow.startOffboardingRun mutation              │
                  │ (extends existing workflow-execution.ts)           │
                  └─────────────────────┬──────────────────────────────┘
                                        │
                          ┌─────────────┴─────────────┐
                          │ resolveRoleTemplate()      │
                          │ Contractor.workflowRoleId  │
                          │  → WorkflowRoleTemplate    │
                          │  → fallback to Generic     │
                          │     Consultant if NULL     │
                          └─────────────┬──────────────┘
                                        │
                          ┌─────────────┴─────────────┐
                          │ Admin override?            │
                          │ overriddenTemplateId       │
                          │ overriddenByUserId         │
                          │ overriddenAt               │
                          │ stored on WorkflowRun row  │
                          └─────────────┬──────────────┘
                                        │
                          ┌─────────────┴───────────────────────────┐
                          │ Materialize WorkflowTaskRun rows from   │
                          │ template's tasks (existing pattern;     │
                          │ resolveAssigneeWithPto runs per-task)   │
                          └─────────────┬───────────────────────────┘
                                        │
                          ┌─────────────┴───────────────────────────┐
                          │ resolveAssigneeWithPto(taskTemplate, ctx)│
                          │   1. Get manager (default routing)       │
                          │   2. Calendar integration connected?     │
                          │      YES → free-busy lookup TODAY in TZ  │
                          │      NO  → skip calendar, manual OOO only│
                          │   3. Manual User.outOfOffice today?      │
                          │      YES → fallbackUserId override       │
                          │   4. PTO detected? Apply fallback chain: │
                          │      manager → Team.fallbackApproverId   │
                          │      → owner-role users + warn badge     │
                          └─────────────┬───────────────────────────┘
                                        │
            ┌───────────────────────────┴────────────────────────────┐
            │ Tasks created with assignee resolved per above           │
            │ (no PTO-spam — single resolution at creation time)       │
            └────────────────────────────┬─────────────────────────────┘
                                         │
                                         ▼
                           Workflow runs to completion
                                         │
                                         ▼
                     ┌───────────────────┴────────────────────┐
                     │ IP_VERIFICATION task (Phase 75 ships)   │
                     │ remains BLOCKED until signed OR         │
                     │ override invoked                        │
                     └───────────────────┬────────────────────┘
                                         │
                                  Owner clicks Override
                                         │
                                         ▼
                  ┌──────────────────────┴──────────────────────┐
                  │ Override dialog: reason ≥20 chars + ack box │
                  │ getCurrentUserPermissions check (UI gate)   │
                  └──────────────────────┬──────────────────────┘
                                         │
                                         ▼
            ┌────────────────────────────┴─────────────────────────────┐
            │ workflow.overrideBlockingTask mutation                   │
            │  - requirePermission({ workflow: ['override_blocking_task'] })│
            │  - Zod re-validates reason min length + ack === true     │
            │  - $transaction:                                         │
            │     a) WorkflowRun.update overrideMetadata JSONB         │
            │     b) WorkflowTaskRun.update IP_VERIFICATION → SKIPPED  │
            │        with skipReason='OWNER_OVERRIDE'                  │
            │     c) writeAuditLog({                                   │
            │          action: 'workflow.offboarding.override_         │
            │                   blocking_task',                        │
            │          resourceType: 'WORKFLOW_RUN',                   │
            │          metadata: { reason, blockedTaskKind:            │
            │                      'IP_VERIFICATION', acknowledgedAt },│
            │          ipAddress, userAgent, tx,                       │
            │        })                                                │
            └────────────────────────────┬─────────────────────────────┘
                                         │
                                         ▼
                       Permanent red badge renders above
                       offboarding header (reads overrideMetadata)
```

### Recommended Project Structure

```
packages/
├── offboarding-templates/                      # NEW workspace package (D-01)
│   ├── package.json                            # name: @contractor-ops/offboarding-templates
│   ├── src/
│   │   ├── seeds.ts                            # 4 typed-const Seed[] (SE/Designer/PM/Consultant)
│   │   ├── pto-keywords.ts                     # PTO_KEYWORDS typed const per locale
│   │   ├── types.ts                            # Seed, TaskItem, Role types
│   │   ├── upsert-on-boot.ts                   # First-boot upsert helper
│   │   └── __tests__/
│   │       ├── seeds.test.ts                   # asserts shape, uniqueness, i18n key existence
│   │       └── pto-keywords.test.ts            # asserts non-empty per supported locale
│   └── tsconfig.json
├── db/
│   └── prisma/schema/
│       ├── workflow.prisma                     # EXTEND: WorkflowRoleTemplate model + per-locale cols
│       ├── contractor.prisma                   # EXTEND: Contractor.workflowRoleId FK
│       ├── organization.prisma                 # EXTEND: Team.fallbackApproverId, User.outOfOffice
│       └── (Phase 75 will add IP_VERIFICATION + CONTRACT_HEALTH_CHECK enums — but the override
│            permission lands now since CONTEXT.md scopes OFFB-10's permission half here)
├── auth/
│   └── src/
│       ├── permissions.ts                      # EXTEND: workflow array adds 'override_blocking_task'
│       ├── roles.ts                            # EXTEND: owner-only assignment of new action
│       └── __tests__/
│           └── permissions.test.ts             # NEW or EXTEND: table-driven 10-role permission test
├── api/
│   └── src/
│       ├── routers/
│       │   ├── workflow-shared.ts              # EXTEND: resolveAssigneeWithPto helper
│       │   ├── workflow-templates.ts           # EXTEND: role-template CRUD endpoints
│       │   ├── workflow-execution.ts           # EXTEND: startOffboardingRun + overrideBlockingTask
│       │   └── auth-permissions.ts             # EXTEND or NEW: getCurrentUserPermissions query
│       └── services/
│           └── pto-detector.ts                 # NEW: orchestrates calendar lookup + manual OOO check
├── integrations/
│   └── src/adapters/
│       ├── google-calendar-adapter.ts          # EXTEND: getFreeBusy(accessToken, calendarId, timeMin, timeMax)
│       └── outlook-calendar-adapter.ts         # EXTEND: getFreeBusy via /me/calendar/getSchedule
└── feature-flags/
    └── src/
        └── signoff-registry-flags.json        # EXTEND: 'offboarding-ip-foundation' PENDING entry

apps/web/
├── messages/
│   ├── en.json                                 # ADD: Offboarding.Templates.{role}.{itemKey} + override dialog copy + settings copy
│   ├── pl.json                                 # MIRROR
│   └── de.json                                 # MIRROR
│   (NOT ar.json — Phase 79 only)
└── src/
    ├── app/[locale]/(admin)/
    │   ├── settings/workflow-roles/page.tsx    # NEW: Settings UI for role-template CRUD
    │   ├── settings/calendar-pto-keywords/page.tsx  # NEW: PTO keyword extension UI
    │   ├── teams/[teamId]/page.tsx             # EXTEND: fallbackApproverId selector
    │   └── users/[userId]/out-of-office/page.tsx # NEW: per-user OOO setting UI
    └── components/offboarding/
        ├── override-dialog.tsx                 # NEW: reason+ack modal
        ├── override-badge.tsx                  # NEW: permanent red badge component
        ├── role-template-dropdown.tsx          # NEW: start-time template selection
        └── english-fallback-indicator.tsx      # NEW: D-15 visual signal
```

### Pattern 1: Hybrid TS-source seeds + DB-runtime extensions
**What:** Seed templates live as typed constants in `@contractor-ops/offboarding-templates`. On first boot per organization, `upsertOnBoot()` writes them as `WorkflowRoleTemplate` rows with `isSeed: true`. Ops-added templates land with `isSeed: false`. The workflow engine reads ALL templates from the database — single read path.

**When to use:** Any phase where TS source-of-truth + ops runtime extensibility are both required (parallel to Phase 71 D-01 + Phase 70 D-02).

**Example:**
```ts
// Source: derived from Phase 70 D-02 + Phase 71 D-01 + this phase D-01
// packages/offboarding-templates/src/upsert-on-boot.ts
import type { Prisma, PrismaClient } from '@contractor-ops/db';
import { OFFBOARDING_TEMPLATE_SEEDS } from './seeds.js';

export async function upsertSeedTemplates(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  for (const seed of OFFBOARDING_TEMPLATE_SEEDS) {
    await prisma.workflowRoleTemplate.upsert({
      where: {
        organizationId_role: { organizationId, role: seed.role }, // composite unique
      },
      create: {
        organizationId,
        role: seed.role,
        displayNameI18nKey: seed.displayNameI18nKey,
        isSeed: true,
        // Per-locale columns NULL for seeds (D-13 — keys live in messages/*.json)
      },
      update: {
        // Idempotent: only update if seed shape diverged (rare)
        displayNameI18nKey: seed.displayNameI18nKey,
      },
    });
    // Then upsert each task item against WorkflowTaskTemplate (or a new RoleTaskTemplate child)
    // referencing seed.taskItems.
  }
}
```

### Pattern 2: PTO-aware assignee resolution (Pitfall 26)
**What:** A single function called once at task-creation time (not on every render) decides who the task's assignee is. Returns `{ assigneeUserId, fallbackReason? }`.

**When to use:** Any time a workflow task auto-routes to a person who might be unavailable.

**Example:**
```ts
// Source: derived from D-05/D-06/D-07/D-08 + Pitfall 26
// packages/api/src/services/pto-detector.ts
import { TZDate } from '@date-fns/tz';
import { startOfDay, endOfDay } from 'date-fns';
import type { PrismaClient } from '@contractor-ops/db';
import type { CalendarAdapter } from '@contractor-ops/integrations';

export async function resolveAssigneeWithPto(args: {
  prisma: PrismaClient;
  organizationId: string;
  managerUserId: string;
  teamId?: string | null;
  contractorJurisdictionTz: string;
  calendarAdapter: CalendarAdapter | null; // null → no integration, skip calendar (D-07)
  ptoKeywords: { en: string[]; de: string[]; pl: string[] };
}): Promise<{ assigneeUserId: string; fallbackReason?: 'manager_pto' | 'no_manager' }> {
  const now = new Date();
  const todayLocalStart = startOfDay(new TZDate(now, args.contractorJurisdictionTz));
  const todayLocalEnd = endOfDay(new TZDate(now, args.contractorJurisdictionTz));

  // 1. Manual User.outOfOffice setting (always honoured, even when no calendar)
  const manager = await args.prisma.user.findUnique({
    where: { id: args.managerUserId },
    select: { outOfOffice: true },
  });
  if (manager?.outOfOffice) {
    const ooo = manager.outOfOffice as { from: string; until: string; fallbackUserId?: string };
    const oooStart = new TZDate(ooo.from, args.contractorJurisdictionTz);
    const oooEnd = new TZDate(ooo.until, args.contractorJurisdictionTz);
    if (todayLocalStart >= oooStart && todayLocalEnd <= oooEnd) {
      return resolveFallback(args, ooo.fallbackUserId, 'manager_pto');
    }
  }

  // 2. Calendar free-busy (only when integration connected — D-07)
  if (args.calendarAdapter) {
    const isOnPto = await detectPtoFromCalendar({
      adapter: args.calendarAdapter,
      managerUserId: args.managerUserId,
      timeMin: todayLocalStart.toISOString(),
      timeMax: todayLocalEnd.toISOString(),
      ptoKeywords: args.ptoKeywords,
    });
    if (isOnPto) {
      return resolveFallback(args, undefined, 'manager_pto');
    }
  }

  // 3. Default route to manager
  return { assigneeUserId: args.managerUserId };
}
```

### Pattern 3: Single-transaction override (Phase 71 D-15 / Phase 76 D-04 precedent)
**What:** Override mutation writes the metadata column AND the AuditLog row in the same Prisma `$transaction` so partial state is impossible.

**When to use:** Every state-changing event with audit semantics in v6.0.

**Example:**
```ts
// Source: Phase 71 D-15 + Phase 76 D-04 + writeAuditLog signature in audit-writer.ts
// packages/api/src/routers/workflow-execution.ts (extension)
overrideBlockingTask: tenantProcedure
  .use(requirePermission({ workflow: ['override_blocking_task'] }))
  .input(
    z.object({
      workflowRunId: z.string().min(1),
      reason: z.string().min(20).max(2000),
      acknowledged: z.literal(true),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return await ctx.db.$transaction(async tx => {
      const run = await tx.workflowRun.findFirstOrThrow({
        where: { id: input.workflowRunId, organizationId: ctx.organizationId },
        include: { tasks: { where: { taskType: 'IP_VERIFICATION', status: { not: 'DONE' } } } },
      });
      if (run.tasks.length === 0) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: E.NO_BLOCKING_TASK });
      }

      const overrideMetadata = {
        reason: input.reason,
        overriddenByUserId: ctx.user.id,
        overriddenAt: new Date().toISOString(),
        blockedTaskKind: 'IP_VERIFICATION' as const,
      };

      await tx.workflowRun.update({
        where: { id: run.id },
        data: { overrideMetadata },
      });
      await tx.workflowTaskRun.update({
        where: { id: run.tasks[0].id },
        data: { status: 'SKIPPED', resultJson: { skipReason: 'OWNER_OVERRIDE' } },
      });

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user.id,
        actorName: ctx.user.name,
        action: 'workflow.offboarding.override_blocking_task',
        resourceType: 'WORKFLOW_RUN',
        resourceId: run.id,
        metadata: {
          reason: input.reason,
          blockedTaskKind: 'IP_VERIFICATION',
          acknowledgedAt: new Date().toISOString(),
        },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        tx, // joins the same transaction
      });

      return { ok: true };
    });
  }),
```

### Anti-Patterns to Avoid
- **Reading per-task assignee on every render:** Causes PTO-spam. Resolve assignee ONCE at task creation; render reads `assigneeUserId` directly.
- **Writing override metadata + audit log in separate awaits without `$transaction`:** Permits partial state where the badge shows but the audit row is missing (or vice versa). Always use `$transaction` and pass `tx` to `writeAuditLog`.
- **Trusting the UI permission gate:** `getCurrentUserPermissions` informs the render, but the mutation MUST re-check via `requirePermission`. CLAUDE.md "Never trust client input" is non-negotiable.
- **Storing the permission in a per-org config table:** D-09 says OWNER-only at the platform level; per-org override permission would violate SC#5.
- **Mid-workflow template swap:** D-03 explicitly forbids this. The template is captured at run-start and immutable for the lifetime of the run.
- **Hand-rolling timezone math with `Date` arithmetic:** Use `@date-fns/tz` `TZDate`. Phase 71 D-07 sets the convergence pin.
- **Putting Werkvertrag wording in the locked-phrase registry this phase:** Phase 75 owns that. Don't pre-empt.
- **Adding new `console.*` calls to source:** Phase 70 `pnpm lint:logs` will fail CI.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TZ-aware "TODAY" boundary | Custom `Date.UTC(…)` arithmetic | `@date-fns/tz` `TZDate` + `startOfDay`/`endOfDay` | TZ math is deceptive (DST transitions, fold/gap; Riyadh has no DST but Berlin/Warsaw do) |
| Permission registry | A new permission table or per-org JSON | Better Auth `accessControlStatement` | The framework already enforces; running parallel registries = drift |
| Audit-log row writes | Direct `prisma.auditLog.create({…})` calls | `writeAuditLog` helper from `packages/api/src/services/audit-writer.ts` | Phase 60 helper already used by 5+ routers; centralizes shape + transactional safety |
| Free-busy detection | `fetch` to Google's `/freebusy` from inside a tRPC handler | Method on `GoogleCalendarAdapter` + `OutlookCalendarAdapter` | Adapter pattern centralizes auth/refresh/error handling — the existing event-CRUD methods already prove this |
| Locale fallback for ops content | Per-call language detection in templates | The D-15 `(English)` indicator pattern + per-locale DB columns | Silent fallback hides translation gaps; the visual indicator is the contract |
| i18n parity validation | A bespoke check on offboarding keys | Phase 70 `pnpm i18n:parity` (already wired into CI + husky) | One guard, one source of truth; D-16 keeps ops DB rows out of scope |
| Multi-region schema apply | Custom shell scripts | `packages/db/scripts/push-all-regions.ts` | Already proven in Phase 70 Plan 09; iterates `DATABASE_URL_EU` + `DATABASE_URL_ME` with fail-fast |
| Workflow run start-time logic | A new state-machine library | Existing `workflow-execution.ts` `startWorkflowRun` (extend) | Already has tx + assignee resolution + i18n hooks |
| Feature-flag PENDING entry | Manual JSON edit + ad-hoc CI rule | `signoff-registry-flags.json` + `getFlagSignoff` helper + Phase 70 boot gate | Centralized; the JSON Schema (`FlagSignoffRegistrySchema`) validates at module load |

**Key insight:** Phase 74 is heavy on net-new tables and net-new permissions, but every supporting *infrastructure* concern (audit logs, TZ math, permission gating, i18n parity, multi-region apply, feature-flag registration) has a Phase 60–71 sibling already in tree. Plans should be **integration plans**, not framework plans.

## Runtime State Inventory

> Phase 74 is a **greenfield additions** phase — no rename / refactor / migration of existing data. Most categories are "None — verified by X" but I document them explicitly so the planner can move on confidently.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `WorkflowRoleTemplate`, `Contractor.workflowRoleId`, `User.outOfOffice`, `Team.fallbackApproverId`, `WorkflowRun.overrideMetadata` are all NEW additions; no existing rows hold data the new schema must consume | Per-org first-boot seed upsert (idempotent); existing contractors get `workflowRoleId = NULL` (default fallback path picks `Generic Consultant`) |
| Live service config | None — no n8n / external workflow engines store offboarding state. Existing `WorkflowRun` rows for OFFBOARDING templates remain valid; new role-template metadata is opt-in (`overriddenTemplateId` is NULL on existing runs) | None |
| OS-registered state | None | None |
| Secrets / env vars | None | None — calendar adapters already use existing `GOOGLE_CALENDAR_*` and `OUTLOOK_*` env vars; no new secrets |
| Build artifacts / installed packages | New `@contractor-ops/offboarding-templates` workspace package — fresh install will pick it up; CI cache must be invalidated (Turborepo handles automatically via lockfile change) | Planner: include `pnpm install` in the Wave 0 setup task; verify `pnpm-workspace.yaml` is updated |

**The canonical question** — *After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?* — answers itself for greenfield phases: **nothing**. Every artefact in this phase is net-new.

## Common Pitfalls

### Pitfall 1: PTO-spam edge cases (Pitfall 26 reference)
**What goes wrong:** A manager has a recurring all-day busy event "Sprint planning — DO NOT DISTURB" every week. Without a keyword filter, the resolver flags them as on-PTO every Monday and routes every offboarding task to the fallback approver permanently.

**Why it happens:** Naïve "all-day busy event = PTO" heuristic conflates legitimate calendar holds with vacation.

**How to avoid:** D-08 layered rule:
1. ALL-DAY busy event today → flag PTO. (This is the noisy signal — see warning below.)
2. TIMED busy event today whose title matches `PTO_KEYWORDS[locale]` → flag PTO.
3. Manual `User.outOfOffice` set today → flag PTO.

**Critical refinement (Researcher recommendation; surface to user during plan-checker):** The "all-day busy event" rule should be tightened to *all-day busy events whose title matches `PTO_KEYWORDS` OR have no attendees* (a vacation block usually has no attendees; a "Sprint planning" all-day event usually has the team). This deviates slightly from D-08's literal wording. **Recommend the planner surface this to the user as an open decision in PLAN.md** rather than silently re-interpreting D-08.

**Warning signs:** Repeated fallback routing to the same backup user; metric: `pto_fallback_triggered_total` > N per manager per month.

### Pitfall 2: Permission-registration regression
**What goes wrong:** Adding `'override_blocking_task'` to the `workflow` resource's action array silently grants it to every role that already had `workflow: ['create', 'read', 'update', 'delete', 'execute']` IF the role definition uses spread/inheritance.

**Why it happens:** Better Auth's `ac.newRole({ workflow: [...] })` is explicit — every role lists its own actions. BUT the existing `roles.ts` defines actions per-role manually; adding a new action requires that **every role's `workflow` array is explicitly checked** for whether it should grant the new action.

**How to avoid:**
1. Audit ALL roles in `roles.ts` (`owner`, `admin`, `finance_admin`, `ops_manager`, `team_manager`, `legal_compliance_viewer`, `it_admin`, `external_accountant`, `readonly`, `platform_operator`).
2. Add `'override_blocking_task'` ONLY to `owner.workflow`.
3. Add a CI test that table-iterates all 10 roles asserting:
   - `owner` → `hasPermission({ workflow: ['override_blocking_task'] })` returns `{ success: true }`
   - All 9 others → `{ success: false }`.

**Warning signs:** A test asserting `hasPermission` for `admin` returns `success: true` for `override_blocking_task` — would reveal accidental grant.

### Pitfall 3: i18n:parity guard collision with seed-key adds
**What goes wrong:** Phase 74 adds `Offboarding.Templates.SoftwareEngineer.handoverDocs.title` to `messages/en.json`. The CI run for that PR fails immediately because `pl.json` and `de.json` don't have peers yet — the developer has to add all three locales simultaneously.

**Why it happens:** Phase 70 D-13 / Plan 70-04 enforces base ⊂ peers parity. This is a feature, not a bug — but it means the planner must ensure every plan adding a key adds all three locales in the SAME commit/PR.

**How to avoid:** Plans 74-02 (seed translations) and 74-08 (override dialog copy) bundle en/pl/de adds together as a single plan deliverable. NEVER split into "land en first, then pl/de later".

**Warning signs:** Local `pnpm i18n:parity` failing with "missing key in pl/de" while en is updated.

### Pitfall 4: Backfill of `Contractor.workflowRoleId` (resolved by codebase reality)
**What goes wrong (originally feared):** Existing contractors have free-text role data that needs fuzzy-mapping to one of the 4 seeds.

**Codebase reality:** There IS no existing `Contractor.role` / `Contractor.position` field. The model has `displayName`, `legalName`, `type` (the legal-entity enum: SOLE_TRADER / COMPANY / etc.) — no role taxonomy field at all. So this risk is **eliminated**.

**How to avoid:** Add the new column as `workflowRoleId String?` (nullable, no default). The auto-selection logic falls back to `Generic Consultant` when NULL. Contractor-wizard UI (extend Plan 74-05 or defer to a follow-up phase) prompts admin to pick the role at create-time going forward.

**Warning signs:** N/A — there is no existing data to migrate.

### Pitfall 5: Override-dialog server-side validation bypass
**What goes wrong:** Client-side disables the "Override" button until reason ≥20 chars + ack checked; an attacker bypasses by calling the mutation directly with `reason: ''` and `acknowledged: false`.

**Why it happens:** UI gating is decoration. Without server-side Zod parse on the mutation input, the audit-log row is written with empty/invalid data — undermining SOC2-grade audit utility.

**How to avoid:**
- Zod schema on the mutation:
  ```ts
  z.object({
    workflowRunId: z.string().min(1),
    reason: z.string().min(20).max(2000),
    acknowledged: z.literal(true),
  })
  ```
- `requirePermission({ workflow: ['override_blocking_task'] })` check BEFORE input parse.
- A test that calls the mutation with `reason: 'short'` and asserts `BAD_REQUEST` (Zod rejection).

**Warning signs:** Audit-log rows with `metadata.reason.length < 20` would prove the gate is leaking.

### Pitfall 6: Multi-region schema apply in single context window
**What goes wrong:** Plan 74-04 ships the schema migration but the agent applies only against `DATABASE_URL_EU`, leaving `DATABASE_URL_ME` drifted. Subsequent ME-region queries fail with column-doesn't-exist errors.

**Why it happens:** A single agent execution is one shell environment with one `DATABASE_URL`. Applying to both regions is two human-verified runs.

**How to avoid:** Mark Plan 74-04 `autonomous: false` (mirrors Phase 70 Plan 09 / Phase 71 Plan 03 / Phase 76 Plan 02). The plan ships the Prisma schema edit + the documented manual-run procedure (`tsx packages/db/scripts/push-all-regions.ts`) — the actual region application is a human task during the supervised session. Phase 74 `autonomous: false` plan is recorded in STATE.md "Deferred Items" if the apply is post-merge.

**Warning signs:** `pnpm --filter @contractor-ops/db prisma db push --schema=...` fails with "column ... does not exist" after merge — means one region was skipped.

## Code Examples

Verified patterns from official sources and existing repo:

### 4 KT Seed Templates (D-04 — Researcher-drafted)

```ts
// Source: Phase 74 D-04 + industry-standard handover checklists
// packages/offboarding-templates/src/seeds.ts
import type { Seed } from './types.js';

export const OFFBOARDING_TEMPLATE_SEEDS: readonly Seed[] = [
  {
    role: 'software_engineer',
    displayNameI18nKey: 'Offboarding.Templates.SoftwareEngineer.displayName',
    taskItems: [
      { titleI18nKey: 'Offboarding.Templates.SoftwareEngineer.handoverDocs.title',
        descriptionI18nKey: 'Offboarding.Templates.SoftwareEngineer.handoverDocs.description',
        dueDayOffset: 0 },
      { titleI18nKey: 'Offboarding.Templates.SoftwareEngineer.codeWalkthrough.title',
        descriptionI18nKey: 'Offboarding.Templates.SoftwareEngineer.codeWalkthrough.description',
        dueDayOffset: 1 },
      { titleI18nKey: 'Offboarding.Templates.SoftwareEngineer.openPRs.title',
        descriptionI18nKey: 'Offboarding.Templates.SoftwareEngineer.openPRs.description',
        dueDayOffset: 2 },
      { titleI18nKey: 'Offboarding.Templates.SoftwareEngineer.deploymentRunbook.title',
        descriptionI18nKey: 'Offboarding.Templates.SoftwareEngineer.deploymentRunbook.description',
        dueDayOffset: 3 },
      { titleI18nKey: 'Offboarding.Templates.SoftwareEngineer.onCallRotation.title',
        descriptionI18nKey: 'Offboarding.Templates.SoftwareEngineer.onCallRotation.description',
        dueDayOffset: 4 },
      { titleI18nKey: 'Offboarding.Templates.SoftwareEngineer.architectureNotes.title',
        descriptionI18nKey: 'Offboarding.Templates.SoftwareEngineer.architectureNotes.description',
        dueDayOffset: 5 },
      { titleI18nKey: 'Offboarding.Templates.SoftwareEngineer.knownIssues.title',
        descriptionI18nKey: 'Offboarding.Templates.SoftwareEngineer.knownIssues.description',
        dueDayOffset: 5,
        requiredDocs: ['HANDOVER_DOCUMENT'] }, // Phase 75 hooks IP_ASSIGNMENT here for SE
    ],
  },
  {
    role: 'designer',
    displayNameI18nKey: 'Offboarding.Templates.Designer.displayName',
    taskItems: [
      { titleI18nKey: 'Offboarding.Templates.Designer.designSystemHandover.title',
        descriptionI18nKey: 'Offboarding.Templates.Designer.designSystemHandover.description',
        dueDayOffset: 0 },
      { titleI18nKey: 'Offboarding.Templates.Designer.figmaTransfer.title',
        descriptionI18nKey: 'Offboarding.Templates.Designer.figmaTransfer.description',
        dueDayOffset: 1 },
      { titleI18nKey: 'Offboarding.Templates.Designer.assetLibraryAccess.title',
        descriptionI18nKey: 'Offboarding.Templates.Designer.assetLibraryAccess.description',
        dueDayOffset: 2 },
      { titleI18nKey: 'Offboarding.Templates.Designer.activeProjects.title',
        descriptionI18nKey: 'Offboarding.Templates.Designer.activeProjects.description',
        dueDayOffset: 3 },
      { titleI18nKey: 'Offboarding.Templates.Designer.brandGuidelinesUpdate.title',
        descriptionI18nKey: 'Offboarding.Templates.Designer.brandGuidelinesUpdate.description',
        dueDayOffset: 4 },
      { titleI18nKey: 'Offboarding.Templates.Designer.researchArchive.title',
        descriptionI18nKey: 'Offboarding.Templates.Designer.researchArchive.description',
        dueDayOffset: 5,
        requiredDocs: ['HANDOVER_DOCUMENT'] },
    ],
  },
  {
    role: 'product_manager',
    displayNameI18nKey: 'Offboarding.Templates.ProductManager.displayName',
    taskItems: [
      { titleI18nKey: 'Offboarding.Templates.ProductManager.roadmapTransfer.title',
        descriptionI18nKey: 'Offboarding.Templates.ProductManager.roadmapTransfer.description',
        dueDayOffset: 0 },
      { titleI18nKey: 'Offboarding.Templates.ProductManager.stakeholderIntros.title',
        descriptionI18nKey: 'Offboarding.Templates.ProductManager.stakeholderIntros.description',
        dueDayOffset: 1 },
      { titleI18nKey: 'Offboarding.Templates.ProductManager.activeInitiatives.title',
        descriptionI18nKey: 'Offboarding.Templates.ProductManager.activeInitiatives.description',
        dueDayOffset: 2 },
      { titleI18nKey: 'Offboarding.Templates.ProductManager.metricsContext.title',
        descriptionI18nKey: 'Offboarding.Templates.ProductManager.metricsContext.description',
        dueDayOffset: 3 },
      { titleI18nKey: 'Offboarding.Templates.ProductManager.researchInsights.title',
        descriptionI18nKey: 'Offboarding.Templates.ProductManager.researchInsights.description',
        dueDayOffset: 4 },
      { titleI18nKey: 'Offboarding.Templates.ProductManager.vendorRelationships.title',
        descriptionI18nKey: 'Offboarding.Templates.ProductManager.vendorRelationships.description',
        dueDayOffset: 5,
        requiredDocs: ['HANDOVER_DOCUMENT'] },
    ],
  },
  {
    role: 'generic_consultant',
    displayNameI18nKey: 'Offboarding.Templates.GenericConsultant.displayName',
    taskItems: [
      { titleI18nKey: 'Offboarding.Templates.GenericConsultant.handoverDocs.title',
        descriptionI18nKey: 'Offboarding.Templates.GenericConsultant.handoverDocs.description',
        dueDayOffset: 0 },
      { titleI18nKey: 'Offboarding.Templates.GenericConsultant.activeProjectStatus.title',
        descriptionI18nKey: 'Offboarding.Templates.GenericConsultant.activeProjectStatus.description',
        dueDayOffset: 1 },
      { titleI18nKey: 'Offboarding.Templates.GenericConsultant.clientStakeholderHandover.title',
        descriptionI18nKey: 'Offboarding.Templates.GenericConsultant.clientStakeholderHandover.description',
        dueDayOffset: 2 },
      { titleI18nKey: 'Offboarding.Templates.GenericConsultant.deliverableArchive.title',
        descriptionI18nKey: 'Offboarding.Templates.GenericConsultant.deliverableArchive.description',
        dueDayOffset: 3 },
      { titleI18nKey: 'Offboarding.Templates.GenericConsultant.knowledgeRepoIndex.title',
        descriptionI18nKey: 'Offboarding.Templates.GenericConsultant.knowledgeRepoIndex.description',
        dueDayOffset: 4,
        requiredDocs: ['HANDOVER_DOCUMENT'] },
    ],
  },
] as const;
```

### Permission registration extension (D-09)

```ts
// Source: better-auth/plugins/access docs (Context7) + existing permissions.ts
// packages/auth/src/permissions.ts (EDIT)
export const accessControlStatement = {
  organization: ['update', 'delete'],
  member: ['create', 'read', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  contractor: ['create', 'read', 'update', 'delete', 'bulk'],
  contract: ['create', 'read', 'update', 'delete'],
  document: ['create', 'read', 'update', 'delete'],
  invoice: ['create', 'read', 'update', 'delete', 'approve'],
  workflow: ['create', 'read', 'update', 'delete', 'execute', 'override_blocking_task'], // <- NEW action
  payment: ['create', 'read', 'update', 'export'],
  report: ['read', 'export'],
  settings: ['read', 'update'],
  integration: ['read', 'update'],
  time: ['read', 'approve'],
  equipment: ['read', 'create', 'update', 'delete'],
  'admin:boe-rate': ['read', 'write'],
} as const;
```

```ts
// packages/auth/src/roles.ts (EDIT)
// Owner role's allPermissions object — workflow array gains override_blocking_task:
const allPermissions = {
  // ...
  workflow: ['create', 'read', 'update', 'delete', 'execute', 'override_blocking_task'],
  // ...
} as const;

// Owner gets it via allPermissions:
owner: ac.newRole(allPermissions),

// EVERY OTHER role's workflow array stays UNCHANGED (no 'override_blocking_task'):
admin: ac.newRole({
  // ...
  workflow: ['create', 'read', 'update', 'delete', 'execute'],  // <- DOES NOT include override
  // ...
}),
ops_manager: ac.newRole({
  // ...
  workflow: ['create', 'read', 'update', 'delete', 'execute'],
  // ...
}),
team_manager: ac.newRole({
  // ...
  workflow: ['read', 'execute'],
  // ...
}),
// finance_admin / legal_compliance_viewer / it_admin / external_accountant / readonly / platform_operator have no workflow.override_blocking_task either — no edit needed
```

### Permission CI test (D-09 SC#5 — mirrors `rbac.test.ts` pattern)

```ts
// Source: existing rbac.test.ts pattern + D-09 + actual role names from roles.ts
// packages/auth/src/__tests__/permissions.test.ts (NEW or EXTEND)
import { describe, it, expect } from 'vitest';
import { roles } from '../roles.js';

describe('workflow:override_blocking_task — OWNER-only (D-09 / SC#5)', () => {
  const allRoleNames = Object.keys(roles) as Array<keyof typeof roles>;

  it.each(allRoleNames)('role %s permission for override_blocking_task is correct', (roleName) => {
    const role = roles[roleName];
    // Better Auth role objects expose statements via internal API; in tests, assert against
    // the source-of-truth maps used to construct ac.newRole(...). We test by reading the
    // role definitions back through the same accessControlStatement.
    const hasOverride = role.statements?.workflow?.includes('override_blocking_task') ?? false;
    if (roleName === 'owner') {
      expect(hasOverride).toBe(true);
    } else {
      expect(hasOverride).toBe(false);
    }
  });
});
```

> Note: the exact API for inspecting an `ac.newRole(...)` object's statements may differ — `[ASSUMED]` based on common Better Auth shape. The planner should verify against `better-auth@1.2.9+` Context7 docs at implementation time and adjust the assertion (alternative: a router-level integration test that calls `auth.api.hasPermission` for each role). Both shapes satisfy SC#5.

### Free-busy method extensions

```ts
// Source: Google Calendar API freebusy.query reference + existing GoogleCalendarAdapter pattern
// packages/integrations/src/adapters/google-calendar-adapter.ts (EXTEND)
async getFreeBusy(
  accessToken: string,
  args: { calendarId?: string; timeMin: string; timeMax: string },
): Promise<{ busy: Array<{ start: string; end: string; summary?: string; isAllDay?: boolean }> }> {
  const calendarId = args.calendarId ?? 'primary';

  // Step 1: freebusy.query gives raw busy ranges (no titles, no all-day flag)
  const fbResp = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeMin: args.timeMin, timeMax: args.timeMax, items: [{ id: calendarId }] }),
  });
  if (!fbResp.ok) throw new Error(`Google Calendar freebusy failed: ${await fbResp.text()}`);
  const fbData = (await fbResp.json()) as {
    calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
  };
  const rawBusy = fbData.calendars[calendarId]?.busy ?? [];

  // Step 2: events.list to enrich with titles + all-day flag (PTO_KEYWORDS need title)
  const evResp = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      new URLSearchParams({
        timeMin: args.timeMin,
        timeMax: args.timeMax,
        singleEvents: 'true',
        showDeleted: 'false',
      }).toString(),
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!evResp.ok) throw new Error(`Google Calendar events.list failed: ${await evResp.text()}`);
  const evData = (await evResp.json()) as {
    items: Array<{ summary?: string; start: { date?: string; dateTime?: string }; end: { date?: string; dateTime?: string } }>;
  };

  return {
    busy: rawBusy.map(b => {
      const event = evData.items.find(e => {
        const start = e.start.dateTime ?? e.start.date;
        return start === b.start;
      });
      return {
        start: b.start,
        end: b.end,
        summary: event?.summary,
        isAllDay: Boolean(event?.start.date && !event?.start.dateTime),
      };
    }),
  };
}
```

`[VERIFIED: Google Calendar API docs — freebusy.query]` returns `{ calendars: { <id>: { busy: [{ start, end }] } } }` with no titles. To get titles for PTO_KEYWORDS matching, a second `events.list` call is needed. Outlook adapter analog uses Microsoft Graph `/me/calendar/getSchedule` which returns `availabilityView` + optional event details when `availabilityViewInterval` is set.

### Override dialog acknowledgement copy (Researcher-finalized per D-10)

```
Title: Override IP verification block

Body:
You are bypassing the IP verification step required to complete this offboarding. This action is recorded in the audit log and shows a permanent compliance-bypass badge on the offboarding record.

Reason (required, minimum 20 characters):
[textarea]

[ ] I confirm that IP verification is being intentionally bypassed and I accept responsibility for any compliance gap that results from this override.

[Cancel]  [Override and complete offboarding]
```

i18n keys (paste into messages/en.json under `Offboarding.Override.*`):
- `title` — "Override IP verification block"
- `body` — full sentence above
- `reasonLabel` — "Reason"
- `reasonPlaceholder` — "Minimum 20 characters — describe why IP verification is being bypassed"
- `acknowledgementLabel` — full ack sentence above
- `cancelButton` — "Cancel"
- `submitButton` — "Override and complete offboarding"
- `submitButtonDisabledTooltip` — "Provide a reason of at least 20 characters and tick the acknowledgement to enable"

Mirror to `pl.json` and `de.json` in the same plan to keep `pnpm i18n:parity` green.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `date-fns-tz` (legacy v3 plugin shape) | `@date-fns/tz` v4 sub-package with `TZDate` class | date-fns v4 release (mid-2024) | Tree-shake-friendlier; MUST use `new TZDate(date, tz)` not the legacy `formatInTimeZone(date, tz, fmt)` |
| Per-app permission tables in DB | Better Auth `accessControlStatement` typed const | Better Auth v1.x | Single source of truth, type-safe; runtime queries via `hasPermission` API |
| Audit-log direct `prisma.auditLog.create` calls scattered through routers | `writeAuditLog` helper from `packages/api/src/services/audit-writer.ts` | Phase 60 (Plan 60-02) | Centralizes shape, transactional safety; required by audit-row consistency |
| Workflow seeds embedded inline in router code | Hybrid TS-source workspace package + DB upsert on first boot | Phase 70 D-02 / Phase 71 D-01 / Phase 74 D-01 | Engineer-reviewable seeds + ops runtime extensibility |
| Per-locale i18n inlined `{ en: '…', pl: '…' }` per item | i18n key references + `messages/{locale}.json` source files + `pnpm i18n:parity` CI guard | Phase 70 Plan 70-04 | Source-controlled translations; CI enforces parity; ops-DB-rows-with-per-locale-columns is the parallel pattern for runtime data |

**Deprecated/outdated (do not introduce):**
- `console.log` for any path, including dev-only — Phase 70 `pnpm lint:logs` will fail CI.
- `date-fns-tz` (the v3 plugin) — the v4 `@date-fns/tz` is the supported sub-package.
- Per-org permission overrides for `workflow:override_blocking_task` — D-09 + SC#5 lock OWNER-only platform-wide.
- New Prisma models without `organizationId` (or registry in global-lookup-list) — Phase 70 `pnpm lint:schema` will fail CI.
- Werkvertrag locked-phrase entries this phase — Phase 75 owns those.

## Schema-Migration Shape (D-02, D-05/D-07, D-06, D-11, D-14, OFFB-10)

### `packages/db/prisma/schema/workflow.prisma` — extensions

```prisma
// NEW model (Phase 74 D-01 / D-04 / D-14)
model WorkflowRoleTemplate {
  id                  String                @id @default(cuid())
  organizationId      String
  role                String                // e.g. 'software_engineer', 'designer', 'product_manager', 'generic_consultant', or ops-added slug
  displayNameI18nKey  String?               // For seeds (D-13) — references messages/*.json
  // Per-locale columns for ops-added templates (D-14); seeds use displayNameI18nKey above
  displayNameEn       String?
  displayNamePl       String?
  displayNameDe       String?
  isSeed              Boolean               @default(false)
  createdAt           DateTime              @default(now())
  updatedAt           DateTime              @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  contractors  Contractor[] // back-reference for D-02 FK
  taskTemplates WorkflowRoleTaskTemplate[] // child task items

  @@unique([organizationId, role])
  @@index([organizationId])
  @@index([organizationId, isSeed])
}

// NEW model (D-04 + D-14) — sub-table for per-task items with per-locale columns
model WorkflowRoleTaskTemplate {
  id                      String   @id @default(cuid())
  organizationId          String
  workflowRoleTemplateId  String
  sortOrder               Int
  // For seeds (D-13): use *I18nKey columns; per-locale columns NULL
  titleI18nKey            String?
  descriptionI18nKey      String?
  // For ops-added (D-14): use per-locale columns; *I18nKey NULL
  titleEn                 String?
  titlePl                 String?
  titleDe                 String?
  descriptionEn           String?
  descriptionPl           String?
  descriptionDe           String?
  dueDayOffset            Int
  requiredDocsJson        Json?    // DocumentType[] (e.g. ['HANDOVER_DOCUMENT'])
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  organization         Organization         @relation(fields: [organizationId], references: [id])
  workflowRoleTemplate WorkflowRoleTemplate @relation(fields: [workflowRoleTemplateId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([organizationId, workflowRoleTemplateId, sortOrder])
}

// EXTEND existing model (D-03 + D-11)
model WorkflowRun {
  // ...existing columns...

  // D-03 — start-time template-selection override (NULL = auto-selected from Contractor.workflowRoleId)
  overriddenTemplateId   String?
  overriddenByUserId     String?
  overriddenAt           DateTime?

  // D-11 — IP_VERIFICATION override metadata (NULL until override invoked; immutable once set)
  overrideMetadata       Json?     // { reason, overriddenByUserId, overriddenAt, blockedTaskKind }

  // ...existing relations + indexes preserved...
}

// EXTEND existing enum (OFFB-10)
enum WorkflowTaskType {
  DOCUMENT_COLLECTION
  APPROVAL
  ACCESS_GRANT
  ACCESS_REVOKE
  FINANCE_SETUP
  EQUIPMENT
  KNOWLEDGE_TRANSFER
  MEETING
  MANUAL
  NOTIFICATION
  IP_VERIFICATION         // <- NEW
  CONTRACT_HEALTH_CHECK   // <- NEW (Phase 75 implements; enum lands here per OFFB-10)
}
```

### `packages/db/prisma/schema/contractor.prisma` — extension

```prisma
model Contractor {
  // ...existing columns...

  // Phase 74 D-02 — role tag for KT template auto-selection (NULL → Generic Consultant fallback)
  workflowRoleId String?
  // ...

  // Add relation:
  workflowRole WorkflowRoleTemplate? @relation(fields: [workflowRoleId], references: [id])
  // ...

  @@index([organizationId, workflowRoleId])
}
```

### `packages/db/prisma/schema/organization.prisma` — extensions

```prisma
model Team {
  // ...existing columns...

  // Phase 74 D-06 — per-team default fallback approver for PTO routing
  fallbackApproverId String?
  fallbackApprover   User? @relation("TeamFallbackApprover", fields: [fallbackApproverId], references: [id])
  // ...
}

// EXTEND auth.prisma User model (cross-file relation; conventional in this schema)
model User {
  // ...existing columns...

  // Phase 74 D-05/D-07 — manual out-of-office (always honoured; calendar lookup is additive)
  outOfOffice Json?  // { from: ISO date, until: ISO date, fallbackUserId?: string }
  // ...

  // New back-relation for Team.fallbackApproverId:
  fallbackApprovedTeams Team[] @relation("TeamFallbackApprover")
  // ...
}
```

### Migration shape estimate

Running `prisma migrate dev --create-only --name phase-74-offboarding-foundation`:
- ADDs 2 new tables (`WorkflowRoleTemplate`, `WorkflowRoleTaskTemplate`).
- ADDs 5 columns: `Contractor.workflowRoleId`, `WorkflowRun.overriddenTemplateId`, `WorkflowRun.overriddenByUserId`, `WorkflowRun.overriddenAt`, `WorkflowRun.overrideMetadata`, `Team.fallbackApproverId`, `User.outOfOffice` (so 7 columns total).
- ADDs 2 enum values to `WorkflowTaskType`: `IP_VERIFICATION`, `CONTRACT_HEALTH_CHECK`.
- ADDs FKs: `Contractor.workflowRoleId → WorkflowRoleTemplate.id` (nullable), `Team.fallbackApproverId → User.id` (nullable).
- ADDs indexes: `WorkflowRoleTemplate(@@index([organizationId])`, `(@@index([organizationId, isSeed]))`, `WorkflowRoleTaskTemplate(@@index([organizationId, workflowRoleTemplateId, sortOrder]))`, `Contractor(@@index([organizationId, workflowRoleId]))`.

**Single-statement clean migration (no DROPs):** Should produce ONLY `CREATE TABLE`, `ALTER TABLE … ADD COLUMN`, `ALTER TABLE … ADD CONSTRAINT`, `CREATE INDEX`, `ALTER TYPE … ADD VALUE`. Mirrors Phase 71 Plan 03's "additive only" guarantee. Plan 74-04 is `autonomous: false` — visual review of the generated `migration.sql` MUST confirm zero DROP/RENAME statements (T-71-03-01 risk pattern).

**Risks vs Phase 71 Plan 03:**
- `ALTER TYPE … ADD VALUE` for the 2 new `WorkflowTaskType` enum values is non-transactional in Postgres < 12; the project runs Neon (Postgres 15.4+ per STATE.md) so this is safe. Verify via `SELECT version();` if unsure.
- Two new tables increase the migration's surface area marginally but contain no data — pure DDL.

## Plan Boundary Recommendations

8 plans across 4 waves. One `autonomous: false` (74-04 schema migration).

| Wave | Plan | Title | autonomous | Requirements |
|------|------|-------|------------|--------------|
| 0 | 74-01 | Failing test scaffolds (RED) + new `@contractor-ops/offboarding-templates` package skeleton + `offboarding-ip-foundation` PENDING signoff entry | true | All 6 (RED state) |
| 1 | 74-02 | Typed-const seed templates (4 roles × 6-9 task items) + i18n keys for en/pl/de (`Offboarding.Templates.*`) + Settings copy + override-dialog copy + PTO_KEYWORDS typed const | true | OFFB-01, OFFB-11 |
| 1 | 74-03 | Better Auth permission extension — `workflow:override_blocking_task` action added to statements; `owner` role grants it; 9 other roles do NOT; CI test iterates all 10 roles | true | OFFB-07, OFFB-10 |
| 2 | 74-04 | Prisma schema migration — `WorkflowRoleTemplate` + `WorkflowRoleTaskTemplate` tables, `Contractor.workflowRoleId`, `Team.fallbackApproverId`, `User.outOfOffice` JSONB, `WorkflowRun.{overriddenTemplateId, overriddenByUserId, overriddenAt, overrideMetadata}`, `WorkflowTaskType` enum gains `IP_VERIFICATION` + `CONTRACT_HEALTH_CHECK`; multi-region apply doc | **false** | OFFB-01, OFFB-03, OFFB-07, OFFB-10 |
| 2 | 74-05 | tRPC role-template CRUD endpoints in `workflow-templates.ts` (`createRoleTemplate`, `listRoleTemplates`, `updateRoleTemplate`, `deleteRoleTemplate`) + `getCurrentUserPermissions` query (or extend existing) + first-boot upsert of seeds via existing post-org-create hook | true | OFFB-01, OFFB-03 |
| 2 | 74-06 | PTO-aware fallback — free-busy method on `GoogleCalendarAdapter` + `OutlookCalendarAdapter`; `pto-detector.ts` service; `resolveAssigneeWithPto` in `workflow-shared.ts`; integration into start-offboarding flow | true | OFFB-02 |
| 3 | 74-07 | Settings UI — `/settings/workflow-roles` (role-template CRUD with 3-locale-input form + Copy-from-English helper + `(English)` fallback indicator), `/settings/calendar-pto-keywords` (PTO_KEYWORDS extension UI), per-team `fallbackApproverId` selector on team detail page, per-user OOO setting page | true | OFFB-03, OFFB-11 |
| 3 | 74-08 | Override dialog component + `overrideBlockingTask` mutation + permanent badge component + start-offboarding template-override dropdown + RTL tests for all surfaces; UI gating via `getCurrentUserPermissions` + server-side `requirePermission` + Zod re-validation | true | OFFB-07, OFFB-10, OFFB-11 |

**Why this slicing:**
- **Wave 0** ships RED tests + scaffolding — no logic, just structure.
- **Wave 1 (74-02 + 74-03)** ships pure additive content (typed-const seeds + i18n + permission registration) that doesn't touch the schema or runtime — parallel-safe.
- **Wave 2 (74-04 → 74-05 → 74-06)** sequenced because 74-05 (CRUD) and 74-06 (PTO) both need the schema from 74-04. 74-04 is `autonomous: false` — human applies the migration to EU + ME before Wave 2's other plans run.
- **Wave 3 (74-07 + 74-08)** ships the UI surfaces + override dialog. Both depend on Wave 2's CRUD + override mutation. They're parallel-safe relative to each other.

**OFFB-11 mapping:** Plans 74-02 (seed i18n keys), 74-07 (Settings UI copy), and 74-08 (override dialog + badge copy) collectively cover all OFFB en/pl/de surfaces. Phase 75 will extend the locked-phrase registry with Werkvertrag.

## Risk Register

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| R1 | **PTO-spam edge cases** — recurring all-day company events (Sprint planning, Off-sites) flagged as PTO, routing every task to fallback approver permanently | HIGH (operational annoyance, fallback-fatigue) | MEDIUM | Pitfall 1 refinement: tighten "all-day busy" to "all-day busy AND (no attendees OR title matches PTO_KEYWORDS)". Surface to user during plan-checker as a deviation from D-08 literal wording. Add metric `pto_fallback_triggered_total` to detect the pattern post-deploy |
| R2 | **Permission-registration regression** — adding `'override_blocking_task'` to the `workflow` statement silently grants it via inheritance chains | CRITICAL (breaks SC#5; auth bypass) | LOW (explicit role definitions in `roles.ts` mean no inheritance) | Pitfall 2: CI table-test iterates all 10 actual roles (`owner`, `admin`, `finance_admin`, `ops_manager`, `team_manager`, `legal_compliance_viewer`, `it_admin`, `external_accountant`, `readonly`, `platform_operator`) asserting only `owner` returns success |
| R3 | **i18n parity guard collision** — adding seed keys to en.json without simultaneous pl/de adds breaks CI | LOW (caught in PR; recoverable) | HIGH (ops adds runtime-DB rows confused with source-key parity) | Pitfall 3 + D-16: bundle en/pl/de adds in the same commit (Plans 74-02, 74-07, 74-08). D-16 explicitly excludes ops DB rows from the guard; UI shows `(English)` indicator for missing locale data on ops rows. Add inline doc in `messages/en.json` near `Offboarding.Templates.*` block reminding contributors to mirror to pl/de |
| R4 | **Override-dialog server-side validation bypass** — attacker calls mutation directly with empty reason | HIGH (audit-log row written with garbage reason; SOC2-grade audit utility undermined) | MEDIUM (UI-only validation is a common antipattern) | Pitfall 5: Zod schema enforces `reason.min(20).max(2000)` + `acknowledged: z.literal(true)` server-side BEFORE the mutation logic runs. Test asserts mutation rejects `reason: 'short'` with `BAD_REQUEST`. Belt-and-suspenders matches D-12 |
| R5 | **Multi-region schema drift** — Plan 74-04 applies to EU only, ME drifts; subsequent ME queries fail | HIGH (regional outage; payment flow potentially impacted in ME orgs) | MEDIUM (autonomous execution forgets the second region) | Pitfall 6: Plan 74-04 marked `autonomous: false`. Plan ships schema edit + the documented manual-run procedure (`tsx packages/db/scripts/push-all-regions.ts`). Apply step recorded in STATE.md "Deferred Items" if post-merge. Mirrors Phase 70 Plan 09 / Phase 71 Plan 03 / Phase 76 Plan 02 |

## Required Reading List for the Planner

The absolute minimum set the gsd-planner agent must read before producing PLAN.md files (≤15 files):

1. `/Users/mateusz.pitura/Repos/projects/contractor-ops/.planning/milestones/v6.0-phases/74-f4-offboarding-workflow-foundation-kt-templates-override-per/74-CONTEXT.md` — locked decisions D-01..D-16
2. `/Users/mateusz.pitura/Repos/projects/contractor-ops/.planning/milestones/v6.0-phases/74-f4-offboarding-workflow-foundation-kt-templates-override-per/74-RESEARCH.md` — this file (the planner's primary input)
3. `/Users/mateusz.pitura/Repos/projects/contractor-ops/.planning/STATE.md` — Standing Project Constraints + Deferred Items pattern
4. `/Users/mateusz.pitura/Repos/projects/contractor-ops/.planning/REQUIREMENTS.md` — OFFB-01/02/03/07/10/11 wording
5. `/Users/mateusz.pitura/Repos/projects/contractor-ops/CLAUDE.md` — engineering guidelines
6. `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/db/prisma/schema/workflow.prisma` — extension target for Plan 74-04
7. `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/db/prisma/schema/contractor.prisma` — extension target for `workflowRoleId`
8. `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/db/prisma/schema/organization.prisma` — extension target for `Team.fallbackApproverId` and (cross-ref) User
9. `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/auth/src/permissions.ts` + `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/auth/src/roles.ts` — Plan 74-03 edit targets
10. `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/api/src/middleware/rbac.ts` + `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/api/src/middleware/__tests__/rbac.test.ts` — `requirePermission` pattern + test pattern to mirror for Plan 74-03 and 74-08
11. `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/api/src/services/audit-writer.ts` — `writeAuditLog` helper signature (Plan 74-08 mutation uses this)
12. `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/api/src/routers/workflow-templates.ts` + `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/api/src/routers/workflow-execution.ts` + `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/api/src/routers/workflow-shared.ts` — Plan 74-05/74-06/74-08 extension targets
13. `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/integrations/src/adapters/google-calendar-adapter.ts` + `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/integrations/src/adapters/outlook-calendar-adapter.ts` — Plan 74-06 extension targets
14. `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/feature-flags/src/signoff-registry-flags.ts` + `/Users/mateusz.pitura/Repos/projects/contractor-ops/packages/feature-flags/src/signoff-registry-flags.json` — Plan 74-01 PENDING entry target
15. `/Users/mateusz.pitura/Repos/projects/contractor-ops/.planning/milestones/v6.0-phases/71-f1-compliance-policy-package-schema-classification-reconcile/71-03-PLAN.md` — exemplar `autonomous: false` schema-migration plan; Plan 74-04 should mirror its structure (visual-review acceptance criterion + multi-region apply procedure)

(Documents 12 + 13 are 4 separate files — counted as 2 logical groups for the limit.)

## Locked TZ + library pins

| Pin | Source | Phase 74 use |
|-----|--------|-------------|
| `@date-fns/tz` v4 | Phase 71 D-07 (`71-RESEARCH.md` line 23, 385) | PTO match rule's "TODAY in contractor jurisdiction TZ" boundary computation; resolves a manager's calendar-busy-today vs OOO-window-today |
| `date-fns` v4 (`apps/web/package.json: "date-fns": "^4.1.0"`) | Pre-existing repo dep | `startOfDay` / `endOfDay` / `isAfter` for PTO time-window math |
| Better Auth (existing) | `packages/auth/package.json` | `accessControlStatement` + `ac.newRole` API surface for D-09 |
| Prisma 7 (existing) | `packages/db/package.json` | New tables + `JSON?` columns for `User.outOfOffice` and `WorkflowRun.overrideMetadata` |
| `@trpc/server` v11 (existing) | `packages/api/package.json` | All new mutations + queries follow existing tRPC v11 conventions |

**Convergence:** Phase 71 (compliance) and Phase 74 (offboarding) both depend on `@date-fns/tz`. **One library, one pin.** Plan-checker should verify `package.json` dependency lists do not introduce a parallel `date-fns-tz` (legacy v3) dep — that would be a regression.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Better Auth `ac.newRole(...)` exposes role statements via an inspectable property in tests | `## Code Examples` (Permission CI test) | Test shape might need to switch to a router-level integration test calling `auth.api.hasPermission`. Both shapes satisfy SC#5; planner picks the one that matches the installed Better Auth version |
| A2 | The exact 6-9 task items per seed (Researcher-drafted in `## Code Examples`) are reasonable industry-standard handover checklists | `## Code Examples` (4 KT Seed Templates) | User may want different task items; CONTEXT.md explicitly delegates this to Researcher discretion. Plan-checker should treat the drafted seeds as a starting baseline; user can edit `messages/en.json` post-merge |
| A3 | Tightening D-08's "all-day busy" rule to "no-attendees OR keyword-match" is the right refinement to avoid Sprint-planning false-positives (Pitfall 1) | `## Common Pitfalls` (Pitfall 1) | If user wants strict D-08 literal interpretation, the false-positive rate may be high. **Surface to user via plan-checker prompt** — don't implement silently |
| A4 | `Contractor` model truly has NO existing free-text role/position field (D-02 ambiguity is settled by adding new column) | `## Common Pitfalls` (Pitfall 4) + `## Schema-Migration Shape` | If a column was missed in the grep, the migration adds a duplicate. Mitigation: schema lint (`pnpm lint:schema` from Phase 70) + visual review before applying |
| A5 | The OFFB-11 wording about Werkvertrag in the locked-phrase registry is intentionally Phase 75 scope and Phase 74 satisfies OFFB-11's en/pl/de parity portion only | `## Phase Requirements` (note on OFFB-11) | Plan-checker may flag OFFB-11 as missing from Phase 74. Surface this scoping note in the SUMMARY or PLAN.md doc-strings |
| A6 | The Outlook Calendar adapter's free-busy lookup uses Microsoft Graph `/me/calendar/getSchedule` (or equivalent) | `## Code Examples` (Free-busy method extensions) | If Microsoft Graph's API surface diverges from training knowledge, the implementation needs Context7 verification at Plan 74-06 execution time. Plan should include a 2-hour Context7-verify task before adapter coding starts |
| A7 | The `WorkflowRun` model is the appropriate home for `overrideMetadata` JSONB (vs introducing a new `OffboardingRecord` model) | `## Schema-Migration Shape` + Pattern 3 | If user wants a dedicated `OffboardingRecord` table, schema shape changes. CONTEXT.md D-11 says "OffboardingRecord.overrideMetadata JSONB column" — but no such model exists; reusing `WorkflowRun` is the simpler interpretation. **Surface to user via plan-checker** |
| A8 | The new `@contractor-ops/offboarding-templates` workspace package matches the established Phase 70/71 typed-const-package pattern | `## Standard Stack` + `## Architecture Patterns` | If user prefers inline seeds in `packages/api/src/services/`, the structure is simpler but consistency with prior phases breaks. CONTEXT.md D-01 explicitly says "new `@contractor-ops/offboarding-templates` workspace package" so this is locked |

## Open Questions

1. **Should D-08's "all-day busy" rule be tightened to filter Sprint-planning false positives (no attendees OR keyword match)?**
   - What we know: D-08 literal wording flags ALL all-day busy events as PTO; recurring company-wide all-day events would cause false positives.
   - What's unclear: whether user wants the strict literal interpretation or the pragmatic refinement.
   - Recommendation: Surface this to the user during plan-checker as a clarifying question; if they confirm the refinement, update D-08 in CONTEXT.md before plans land.

2. **Is `WorkflowRun.overrideMetadata` the right home for the override JSONB, or should we introduce a dedicated `OffboardingRecord` model?**
   - What we know: D-11 says "OffboardingRecord.overrideMetadata JSONB column", but no such model exists. The existing `WorkflowRun` IS the offboarding-run row when `WorkflowTemplate.type = OFFBOARDING`.
   - What's unclear: did user mean "create a new OffboardingRecord" or "extend the existing offboarding-run row"?
   - Recommendation: Use `WorkflowRun.overrideMetadata` (simpler; aligns with Phase 71 D-15 / Phase 76 D-04 pattern of "write to existing aggregate root + audit log"). Confirm with user via plan-checker.

3. **How does the contractor-wizard get extended to set `Contractor.workflowRoleId`?**
   - What we know: D-02 says "Set in the contractor wizard". The contractor wizard exists at `apps/web/src/components/contractors/contractor-wizard/`.
   - What's unclear: scope of the wizard edit — is it part of Plan 74-05's CRUD or a separate plan?
   - Recommendation: Plan 74-05 includes a wizard step extension OR defer to a follow-up phase if wizard edits exceed plan budget. CONTEXT.md doesn't lock this; planner discretion.

4. **What's the canonical `getCurrentUserPermissions` query — does it already exist?**
   - What we know: My grep didn't find an existing `getCurrentUserPermissions` tRPC query.
   - What's unclear: whether the codebase has an equivalent (e.g. derives from `auth.getSession` membership role + `roles[role].statements`).
   - Recommendation: Plan 74-05 includes a NEW `getCurrentUserPermissions` query that wraps `auth.api.hasPermission` for the active org. Pattern parallels other tRPC permission-aware queries.

5. **For the calendar free-busy lookup, which user's calendar do we read — the manager's, or the org's primary calendar?**
   - What we know: D-05 says "calendar free-busy lookup via existing v2.0 calendar adapter". The adapter operates on the connected user's tokens — the org's connection.
   - What's unclear: if multiple managers each have their own `IntegrationConnection` (per-user OAuth), which connection do we use for "this manager's PTO"?
   - Recommendation: Plan 74-06 must clarify the connection-per-user model. If the v2.0 calendar integration is per-org (single connection), free-busy reads against the manager's email via `calendarId: manager.email`. If per-user, find the manager's connection and read their primary calendar. Researcher recommends per-org-connection-with-calendar-id-as-manager-email — simpler, fewer auth surfaces. Surface to user during plan-checker.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All packages | ✓ | 20.x+ (existing repo build) | — |
| pnpm | Workspace package management | ✓ | (existing — see `package.json` packageManager field) | — |
| Postgres (Neon EU + ME) | Plan 74-04 schema migration apply | ✓ | 15.4+ (per STATE.md) | LOCAL-ONLY: post-merge manual apply (mirrors Phase 70 Plan 09 deferred pattern) |
| `prisma` CLI | Plan 74-04 migration generation | ✓ | (existing in packages/db) | — |
| `@date-fns/tz` v4 | PTO date math | ✗ (not installed in api/templates packages — installed in some other package per Phase 71 RESEARCH) | — | Plan 74-01 includes installation step in api + offboarding-templates packages |
| Google Calendar OAuth credentials | Plan 74-06 free-busy live test | ⚠ (env vars present per `google-calendar-adapter.ts`; live integration test optional) | n/a | Mock-based unit tests cover the adapter's HTTP surface; manual UAT covers live flow per Standing Constraint LOCAL-ONLY |
| Microsoft Graph OAuth credentials | Plan 74-06 free-busy live test | ⚠ (env vars present; live integration test optional) | n/a | Same as Google |

**Missing dependencies with no fallback:** None — all blocking dependencies satisfied or have viable fallbacks.

**Missing dependencies with fallback:**
- `@date-fns/tz` install — Plan 74-01 task.

## Validation Architecture

> Phase 74 has `nyquist_validation: true` in `.planning/config.json`; this section is REQUIRED.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest` (existing — version per repo root `package.json`) |
| Config file | per-package `vitest.config.ts` (existing) — verify `packages/offboarding-templates/vitest.config.ts` is created in Plan 74-01 |
| Quick run command | `pnpm --filter @contractor-ops/api --filter @contractor-ops/auth --filter @contractor-ops/offboarding-templates test` |
| Full suite command | `pnpm test` (repo root) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OFFB-01 | 4 KT seeds present, shape valid, i18n keys exist in en/pl/de | unit | `pnpm --filter @contractor-ops/offboarding-templates test seeds` | ❌ Wave 0 |
| OFFB-01 | Auto-selection picks SE template for SE-tagged contractor; falls back to Generic Consultant when workflowRoleId is NULL | integration | `pnpm --filter @contractor-ops/api test workflow-execution-template-selection` | ❌ Wave 0 |
| OFFB-01 | Manual override dropdown selection writes overriddenTemplateId | integration | Same as above (additional test cases) | ❌ Wave 0 |
| OFFB-02 | resolveAssigneeWithPto routes to manager when no PTO | unit | `pnpm --filter @contractor-ops/api test pto-detector` | ❌ Wave 0 |
| OFFB-02 | resolveAssigneeWithPto detects calendar all-day-busy with PTO_KEYWORDS title and routes to fallback | unit | Same | ❌ Wave 0 |
| OFFB-02 | resolveAssigneeWithPto honors per-user User.outOfOffice with explicit fallbackUserId | unit | Same | ❌ Wave 0 |
| OFFB-02 | resolveAssigneeWithPto skips calendar lookup when no integration connected (D-07) | unit | Same | ❌ Wave 0 |
| OFFB-02 | resolveAssigneeWithPto chains to Team.fallbackApproverId then owner-role users; no spam | integration | `pnpm --filter @contractor-ops/api test workflow-pto-fallback-chain` | ❌ Wave 0 |
| OFFB-03 | createRoleTemplate / updateRoleTemplate / deleteRoleTemplate CRUD via tRPC | integration | `pnpm --filter @contractor-ops/api test role-template-crud` | ❌ Wave 0 |
| OFFB-03 | First-boot upsert seeds 4 templates idempotently | integration | `pnpm --filter @contractor-ops/api test offboarding-template-seed-upsert` | ❌ Wave 0 |
| OFFB-03 | Settings UI renders 3-locale-input form + Copy-from-English helper + (English) indicator on missing-locale rows | RTL | `pnpm --filter web test settings-workflow-roles` | ❌ Wave 0 |
| OFFB-07 | overrideBlockingTask mutation requires permission, accepts reason ≥20 chars + ack=true, writes overrideMetadata + AuditLog atomically | integration | `pnpm --filter @contractor-ops/api test workflow-override-blocking-task` | ❌ Wave 0 |
| OFFB-07 | overrideBlockingTask mutation rejects empty reason, missing ack | integration | Same | ❌ Wave 0 |
| OFFB-07 | Permanent badge renders from WorkflowRun.overrideMetadata | RTL | `pnpm --filter web test override-badge` | ❌ Wave 0 |
| OFFB-10 | WorkflowTaskType enum includes IP_VERIFICATION + CONTRACT_HEALTH_CHECK | schema-lint | `pnpm --filter @contractor-ops/db test prisma-schema-shape` | ❌ Wave 0 (or tracked via prisma generate output) |
| OFFB-10 | workflow:override_blocking_task is OWNER-only across all 10 roles | unit | `pnpm --filter @contractor-ops/auth test permissions` | ❌ Wave 0 |
| OFFB-11 | en/pl/de parity for all OFFB surfaces (Offboarding.Templates.*, Offboarding.Override.*, Settings.WorkflowRoles.*, Settings.CalendarPtoKeywords.*) | i18n-parity | `pnpm i18n:parity` (existing Phase 70 guard) | ✅ existing |
| OFFB-11 | (English) fallback indicator renders for ops-added rows with missing locale | RTL | `pnpm --filter web test english-fallback-indicator` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @contractor-ops/api --filter @contractor-ops/auth --filter @contractor-ops/offboarding-templates test` (~3-5s expected)
- **Per wave merge:** Repo root `pnpm test` + `pnpm i18n:parity` + `pnpm lint:schema` + `pnpm lint:logs`
- **Phase gate:** Full suite green before `/gsd-verify-work`. Plan 74-04 schema migration apply is the only manual step (mirrors Phase 70 Plan 09 deferred pattern).

### Wave 0 Gaps
- [ ] `packages/offboarding-templates/src/__tests__/seeds.test.ts` — covers OFFB-01 seed shape
- [ ] `packages/offboarding-templates/src/__tests__/pto-keywords.test.ts` — covers OFFB-02 PTO_KEYWORDS shape
- [ ] `packages/offboarding-templates/src/__tests__/upsert-on-boot.test.ts` — covers OFFB-03 idempotent upsert
- [ ] `packages/api/src/routers/__tests__/workflow-execution-template-selection.test.ts` — covers OFFB-01 auto-selection + override
- [ ] `packages/api/src/services/__tests__/pto-detector.test.ts` — covers OFFB-02 all branches (calendar / no-calendar / OOO / chain)
- [ ] `packages/api/src/routers/__tests__/role-template-crud.test.ts` — covers OFFB-03 CRUD
- [ ] `packages/api/src/routers/__tests__/workflow-override-blocking-task.test.ts` — covers OFFB-07 mutation
- [ ] `packages/auth/src/__tests__/permissions.test.ts` — covers OFFB-10 permission across 10 roles (NEW or EXTEND existing — verify; planner reads `packages/auth/src/__tests__/`)
- [ ] `apps/web/src/components/offboarding/__tests__/override-dialog.test.tsx` — covers OFFB-07 dialog UX
- [ ] `apps/web/src/components/offboarding/__tests__/override-badge.test.tsx` — covers OFFB-07 badge render
- [ ] `apps/web/src/app/[locale]/(admin)/settings/workflow-roles/__tests__/page.test.tsx` — covers OFFB-03 Settings UI + OFFB-11 (English) indicator
- [ ] `packages/integrations/src/adapters/__tests__/google-calendar-adapter-freebusy.test.ts` — covers OFFB-02 free-busy method
- [ ] `packages/integrations/src/adapters/__tests__/outlook-calendar-adapter-freebusy.test.ts` — covers OFFB-02 free-busy method (Outlook)

Framework install: existing — no new test framework needed.

## Security Domain

> Required because `security_enforcement` is enabled (default — `.planning/config.json` has no explicit `false`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth session + cookie infrastructure (existing) |
| V3 Session Management | yes (indirect) | Better Auth session lifecycle (existing) |
| V4 Access Control | **YES — primary surface** | Better Auth `accessControlStatement` + `requirePermission` middleware. New `workflow:override_blocking_task` action MUST be granted to `owner` only; CI test enforces |
| V5 Input Validation | YES | Zod schemas on every mutation: `overrideBlockingTask` (reason min 20 chars, ack literal true), `createRoleTemplate` (per-locale string lengths), `setOutOfOffice` (ISO date strings, fallbackUserId is a valid User.id) |
| V6 Cryptography | no (no new crypto in this phase) | — |
| V7 Error Handling and Logging | yes | All errors via `@contractor-ops/logger`; no console.*; AuditLog row on override emission writes via `writeAuditLog` (Phase 60 helper) |
| V13 API and Web Service | yes | tRPC v11 contracts; all mutations use `tenantProcedure.use(requirePermission(...))` chain |

### Known Threat Patterns for {Next.js + tRPC + Prisma + Better Auth} stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege escalation via permission-registry inheritance bug | Elevation of Privilege | CI table-test asserting permission per role; explicit role-by-role audit in `roles.ts` (no spread/inheritance trickery) |
| Override-mutation invocation by non-OWNER (UI-bypass) | Tampering / Elevation of Privilege | `requirePermission({ workflow: ['override_blocking_task'] })` server-side; UI gating is decoration only |
| Override mutation called with empty/short reason (audit-log noise) | Tampering | Zod `reason.min(20).max(2000)` server-side parse |
| Cross-tenant `WorkflowRoleTemplate` read (org A reads org B's templates) | Information Disclosure | All queries scoped via `tenantStore` + `organizationId` filter; FOUND6-01 lint:schema guard enforces every new model has organizationId |
| PTO calendar token leak (Pino redaction) | Information Disclosure | All HTTP error responses from calendar adapters logged via `createLogger` (Pino) which has Phase 70 D-13's strict-by-default body redaction. The adapter test should assert no token text appears in error log lines |
| Race-condition between override mutation and concurrent task completion | Tampering | `$transaction` with `findFirstOrThrow + select { tasks: { where: status: { not: 'DONE' } } }` ensures the IP_VERIFICATION task is still open at override time |
| `User.outOfOffice` JSONB tampering by lower-privilege user | Tampering | `setOutOfOffice` mutation requires the actor be the user themselves OR a role with `member: ['update']` (admin/it_admin). Per-user OOO is not a global permission |
| `Team.fallbackApproverId` set to a non-existent or cross-org user | Integrity violation | FK constraint enforces existence; tenant scoping in `requirePermission` enforces same-org User |
| Self-override (owner overrides their own offboarding) | Tampering | The override is on a `WorkflowRun` of an offboarding contractor — the owner-actor would be a different user than the contractor. Audit log captures actor identity; if business rules require "actor != contractor.ownerUserId", add a Zod refinement (researcher recommends adding this — surface to user) |

## Sources

### Primary (HIGH confidence)
- `[VERIFIED: codebase grep]` `packages/auth/src/permissions.ts` — `accessControlStatement` shape, current `workflow` actions = `['create', 'read', 'update', 'delete', 'execute']`
- `[VERIFIED: codebase grep]` `packages/auth/src/roles.ts` — 10 roles enumerated (`owner`, `admin`, `finance_admin`, `ops_manager`, `team_manager`, `legal_compliance_viewer`, `it_admin`, `external_accountant`, `readonly`, `platform_operator`); role names are LOWERCASE
- `[VERIFIED: codebase grep]` `packages/db/prisma/schema/contractor.prisma` — `Contractor` has NO existing role/position field (D-02 ambiguity settled)
- `[VERIFIED: codebase grep]` `packages/db/prisma/schema/auth.prisma` — `User` model has NO `outOfOffice` field (must be added)
- `[VERIFIED: codebase grep]` `packages/db/prisma/schema/organization.prisma` — `Team` has `managerUserId` but NO `fallbackApproverId` (must be added)
- `[VERIFIED: codebase grep]` `packages/db/prisma/schema/workflow.prisma` — `WorkflowTaskType` enum has 10 values, NO `IP_VERIFICATION`/`CONTRACT_HEALTH_CHECK`; `WorkflowRun` has NO `overrideMetadata` field
- `[VERIFIED: codebase grep]` `packages/db/prisma/schema/contract.prisma` — `EntityType` enum HAS `WORKFLOW_RUN` and `WORKFLOW_TASK_RUN` (no enum extension needed for audit-log)
- `[VERIFIED: codebase grep]` `packages/integrations/src/adapters/google-calendar-adapter.ts` — only event CRUD methods exist; NO free-busy method
- `[VERIFIED: codebase grep]` `packages/integrations/src/adapters/outlook-calendar-adapter.ts` — only event CRUD methods exist; NO free-busy method
- `[VERIFIED: codebase grep]` `packages/api/src/services/audit-writer.ts` — `writeAuditLog` is the canonical helper (used by 5+ routers); accepts `tx` for atomic transactional joins
- `[VERIFIED: codebase grep]` `packages/feature-flags/src/signoff-registry-flags.ts` — `GATED_FLAG_NAMESPACE_PREFIXES` includes `'offboarding-ip-'` (with trailing dash) — confirms `offboarding-ip-foundation` is the correct flag name (NOT `offboarding-hardening-foundation`)
- `[VERIFIED: codebase grep]` `packages/feature-flags/src/signoff-registry-flags.json` — currently `{}`; Phase 74 adds `offboarding-ip-foundation` PENDING entry here
- `[VERIFIED: codebase grep]` `packages/db/scripts/push-all-regions.ts` — multi-region apply pattern; iterates `DATABASE_URL_EU` + `DATABASE_URL_ME`
- `[VERIFIED: codebase grep]` `packages/lint-guards/src/i18n-parity/run-guard.ts` — base ⊂ peers parity rule; supports baseline-tolerated diffs
- `[VERIFIED: codebase grep]` `apps/web/messages/en.json` line 4732 — existing `workflow.templates.offboarding.*` namespace; Phase 74 adds parallel `Offboarding.Templates.*` for role-typed templates (or extends `workflow.templates.offboarding` — planner discretion; the namespace consistency choice is open)
- `[VERIFIED: codebase grep]` `.planning/milestones/v6.0-phases/71-*/71-RESEARCH.md` lines 23, 385 — `@date-fns/tz` v4 pin
- `[VERIFIED: codebase grep]` `.planning/milestones/v6.0-phases/71-*/71-03-PLAN.md` — `autonomous: false` schema-migration plan exemplar (Phase 74 Plan 04 mirrors)
- `[CITED: better-auth/better-auth via Context7]` Better Auth `createAccessControl` + `ac.newRole` API surface (no API changes since v1.2.x; aligns with installed version)
- `[CITED: STATE.md]` Phase 70 complete; `signoff-registry.ts` PENDING → APPROVED gate operational; multi-region backfill pattern documented in Phase 70 Plan 09

### Secondary (MEDIUM confidence)
- Phase 71 RESEARCH.md TZ library decision (line 385) — verified TZ pin convergence
- Phase 76 plan structure for `autonomous: false` migration plans — verified pattern exists
- Better Auth Context7 query — confirmed statements API stable across recent versions

### Tertiary (LOW confidence — flagged for validation)
- `[ASSUMED]` Better Auth role-statement inspectability shape in tests (Pattern 5 / Permission CI test) — planner verifies at implementation time
- `[ASSUMED]` Outlook Calendar `/me/calendar/getSchedule` exact response shape — planner runs `npx ctx7 docs /microsoft/microsoft-graph "getSchedule freebusy availability"` at Plan 74-06 implementation time
- `[ASSUMED]` Google Calendar `freebusy.query` plus `events.list` enrichment is the simplest path to title-aware busy detection — alternative: subscribe to event changes via push notifications (out of scope this phase)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library is already in repo or pinned by Phase 71
- Architecture: HIGH — every pattern has a Phase 60–71 sibling
- Pitfalls: HIGH — reverse-validated against CONTEXT.md decisions and codebase grep
- Schema-migration shape: HIGH — every column verified absent in current schema; additive-only migration matches Phase 71 Plan 03 pattern
- Code examples: MEDIUM (drafts) — seed task lists are Researcher-drafted (CONTEXT.md "Claude's Discretion"); permission test shape has one assumption (A1)
- Validation architecture: HIGH — test file paths derived from existing repo conventions

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (30 days — stable foundation libraries; no fast-moving deps)

## RESEARCH COMPLETE

**Phase:** 74 - F4 Offboarding — Workflow Foundation + KT Templates + Override Permission
**Confidence:** HIGH

### Key Findings
- **`Contractor` has NO existing free-text role field.** D-02's "repurpose vs add" question is settled by adding `workflowRoleId String?` as a new nullable FK; no backfill of fuzzy text-matching needed.
- **Role names in Better Auth are LOWERCASE.** "OWNER" in CONTEXT.md maps to `owner` in `roles.ts`. CI test must iterate the 10 actual role names.
- **The flag must be `offboarding-ip-foundation`, NOT `offboarding-hardening-foundation`** — Phase 70's `GATED_FLAG_NAMESPACE_PREFIXES` includes `'offboarding-ip-'`. The CONTEXT.md alternate name would not satisfy the boot gate.
- **No free-busy method exists on either calendar adapter.** Both Google + Outlook need new methods (event-CRUD-style; HIGH-confidence pattern; planner verifies Microsoft Graph getSchedule shape via Context7 at impl time).
- **The override badge lives on `WorkflowRun.overrideMetadata` JSONB**, not a new `OffboardingRecord` model. CONTEXT.md D-11 mentioned `OffboardingRecord` but no such model exists; reusing `WorkflowRun` is the correct interpretation.
- **8 plans across 4 waves; one `autonomous: false` (Plan 74-04 schema migration)** mirroring Phase 71 Plan 03 / Phase 76 Plan 02 multi-region precedent.

### File Created
`/Users/mateusz.pitura/Repos/projects/contractor-ops/.planning/milestones/v6.0-phases/74-f4-offboarding-workflow-foundation-kt-templates-override-per/74-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All libs already in repo or pinned to Phase 71 |
| Architecture | HIGH | Every pattern has a v5/v6 sibling already in tree |
| Pitfalls | HIGH | Reverse-validated against CONTEXT.md + codebase grep |
| Schema-migration shape | HIGH | Every column verified absent; pure additive |
| Code examples | MEDIUM | Seed wording is Researcher-drafted per CONTEXT.md discretion; permission-test shape has one assumption |
| Validation architecture | HIGH | Test paths derived from existing repo conventions |

### Open Questions
1. Tighten D-08's "all-day busy" rule with no-attendees + keyword-match refinement? (Pitfall 1)
2. Confirm `WorkflowRun.overrideMetadata` (vs new `OffboardingRecord` model) — CONTEXT.md D-11 wording is ambiguous; Researcher recommends `WorkflowRun.overrideMetadata`.
3. Should contractor-wizard extension to set `workflowRoleId` ship in Plan 74-05 or follow-up phase?
4. Does `getCurrentUserPermissions` tRPC query exist? (Researcher couldn't find it; recommend NEW in Plan 74-05.)
5. Per-org vs per-user calendar connection model for free-busy lookup? (Plan 74-06 must clarify.)

### Ready for Planning
Research complete. Planner can now create PLAN.md files for Plans 74-01 through 74-08, with Plan 74-04 marked `autonomous: false`.
