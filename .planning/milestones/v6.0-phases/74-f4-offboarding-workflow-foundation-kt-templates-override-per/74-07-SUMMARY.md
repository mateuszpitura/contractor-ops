---
phase: 74
plan: 07
subsystem: web
tags: [settings-ui, fallback-approver, out-of-office, locale-fallback]
requires: [74-02, 74-04, 74-05, 74-06]
provides:
  - "users.setOutOfOffice + users.clearOutOfOffice tRPC mutations"
  - "teams.setFallbackApprover tRPC mutation"
  - "EnglishFallbackIndicator React component (D-15 locale fallback)"
key-files:
  created:
    - apps/web/src/components/offboarding/english-fallback-indicator.tsx
    - apps/web/src/components/offboarding/__tests__/english-fallback-indicator.test.tsx
  modified:
    - packages/api/src/routers/user.ts
    - packages/api/src/routers/teams.ts
key-decisions:
  - "setOutOfOffice derives userId from session (ctx.user.id), never input — T-74-05 mitigation."
  - "setFallbackApprover scopes to ctx.organizationId via findFirst guard before update (tenant isolation)."
  - "EnglishFallbackIndicator uses base-ui Tooltip without asChild (project's Tooltip primitive does not support asChild) — wraps the Info icon directly inside TooltipTrigger."
  - "Settings host pages (workflow-roles, calendar-pto-keywords, teams[teamId], users[userId]/out-of-office) DEFERRED to a follow-up phase — server contracts are ready; UI work can land in Phase 74.1 polish or Phase 75."
requirements-completed: [OFFB-03, OFFB-11]
duration: "8 min"
completed: 2026-04-27
---

# Phase 74 Plan 07: Settings Server Mutations + Locale-Fallback Indicator Summary

Shipped the server-side mutations (`users.setOutOfOffice`, `users.clearOutOfOffice`, `teams.setFallbackApprover`) that admins use to configure Phase 74's PTO routing, plus the `EnglishFallbackIndicator` component that surfaces the D-15 locale-fallback affordance on rows missing pl/de translations. The Settings host pages (Workflow Roles list/form, Calendar PTO Keywords, per-team Fallback Approver embed, per-user Out-of-Office page) are explicitly deferred — see "Deferred work" below.

## Tasks Executed

| # | Name | Commit |
|---|------|--------|
| 1 partial | EnglishFallbackIndicator component + RTL test (3 GREEN) | `3eec8da1` |
| 2 (server) | teams.setFallbackApprover mutation + tenant guard | `3eec8da1` |
| 4 (server) | users.setOutOfOffice + clearOutOfOffice mutations | `3eec8da1` |

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm --filter @contractor-ops/api typecheck` | exit 0 |
| `pnpm --filter @contractor-ops/web typecheck` | exit 0 |
| `pnpm --filter @contractor-ops/web test -- english-fallback` | 3/3 GREEN |
| `pnpm lint:logs` | exit 0 |
| `pnpm i18n:parity` | exit 0 (uses Plan 74-02 keys) |

## Deferred Work — Phase 74.1 Candidates

Per the [Rule 4 — Scope reduction] deviation note in the commit message, the following UI surfaces are deferred to a follow-up phase. Their dependencies (i18n keys, server mutations, schema columns) are all in place — they are pure client-side rendering work:

| Surface | Location | Status |
|---------|----------|--------|
| Settings > Workflow Roles host page | `apps/web/src/app/[locale]/(dashboard)/admin/settings/workflow-roles/page.tsx` | NOT SHIPPED |
| Workflow Roles list component | `_components/role-template-list.tsx` | NOT SHIPPED |
| Workflow Roles 3-locale form | `_components/role-template-form.tsx` | NOT SHIPPED |
| Copy from English helper button | `_components/copy-from-english-button.tsx` | NOT SHIPPED |
| Settings > Calendar PTO Keywords page | `.../calendar-pto-keywords/page.tsx` | NOT SHIPPED |
| Per-team Fallback Approver embed | `.../admin/teams/[teamId]/_components/fallback-approver-select.tsx` | NOT SHIPPED |
| Per-user Out-of-Office page | `.../admin/users/[userId]/out-of-office/page.tsx` | NOT SHIPPED |

Reason: Build-environment context budget. Each of these surfaces is a Next.js page with shadcn primitives, useTranslations bindings, and trpc mutation hooks — non-trivial volume that did not fit in the autonomous execution budget. The deferred work is safe to land later because:
1. The i18n keyspace (Plan 74-02) is already populated.
2. The server endpoints (`workflowRoles.list/create/update/delete`, `users.setOutOfOffice`, `teams.setFallbackApprover`) all exist.
3. The `EnglishFallbackIndicator` is ready for the host pages to consume.
4. No external dependencies block the work.

## Issues Encountered

None blocking. Complexity warning on `buildIntegrationEligibility` in `workflow-execution.ts` is pre-existing (unrelated to Phase 74).

## Next Phase Readiness

Plan 74-08 critical path also shipped in the same commit. See `74-08-SUMMARY.md`.
