---
title: Patterns index
type: pattern
tags: [patterns, index]
updated: 2026-06-09
---

# Patterns — engineering invariants

> CI-enforced conventions. Verify with `pnpm lint:ci` and paths below — do not cite from memory. Hub: [[meta/dashboard]] · Tables: [[meta/wiki-tables]].

## Core (always read for new code)

| Page | Rule |
|------|------|
| [[web-vite-data-layer]] | Page → Container → Hook → Component |
| [[tenant-and-audit]] | Session tenant + writeAuditLog |
| [[audit-log]] | When to write AuditLog + lint:audit-log |
| [[entity-id-and-money]] | entityIdSchema + formatMoneyAmount |
| [[trpc-procedure-stack]] | public → authed → tenant → rbac |
| [[validators-boundaries]] | Zod everywhere; no bare `as` on external payloads |
| [[agent-delegation]] | Subagent-first; cavecrew default; no ad-hoc bulk shell edits |
| [[ui-skills-routing]] | frontend-design → semble → impeccable / design-taste stack |
| [[money-rounding]] | Integer minor units; HALF-UP default, skonto FLOOR, interest HALF-UP |

## Auth & access

| Page | Rule |
|------|------|
| [[better-auth-staff]] | Better Auth session → activeOrganizationId |
| [[portal-auth]] | portalProcedure + portal_session cookie |
| [[rbac-permissions]] | authPermissions + workflowRoles |
| [[feature-flags]] | @contractor-ops/feature-flags registry only |

## Infrastructure

| Page | Rule |
|------|------|
| [[multi-region-db]] | EU/ME regional DATABASE_URL |
| [[logging-and-errors]] | @contractor-ops/logger; no console.* |
| [[testing-and-msw]] | Vitest + MSW fixtures |
| [[data-tables-workbench]] | packages/ui DataTable |
| [[ci-guards]] | pnpm lint:ci guard catalog |
| [[i18n-and-locales]] | en/de/pl/ar RTL + i18n:types |

## Related

- [[structure/_index]]
- `.planning/codebase/CONVENTIONS.md`
- `.planning/MEMORY.md`
