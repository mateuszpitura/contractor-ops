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
| [[business-logic-shield]] | Domain composition gate (S1–S7, T1–T7); `[shield]` hooks before logic edits |
| [[ui-skills-routing]] | frontend-design → semble → impeccable / design-taste stack |
| [[money-rounding]] | Integer minor units; HALF-UP default, skonto FLOOR, interest HALF-UP |

## Worker-model abstraction (reusable in Phases 90–97)

| Idiom | Rule |
|-------|------|
| `withWorkerTypeDefault` extension | A central Prisma `$allOperations` link injects a discriminator default (`workerType='CONTRACTOR'`) on reads **unless the caller sets it** — explicit-where-wins; chained outermost over soft-delete + tenant-scope. Raw `FROM "Contractor"` SQL is its blind spot — guarded by `check:contractor-rawsql-workertype` (in `lint:ci`) + a `// contractor-only-raw-sql:` annotation. Detail: [[domains/worker-foundation]] |
| Per-type RBAC + BFLA fence | A new sibling resource (`employee`) gates a type's HR-only fields independently of `contractor`; per-type roles never carry a cross-type mutation. Added to `accessControlStatement` only — NOT the `owner` `allPermissions` duplicate. Detail: [[rbac-permissions]] |
| Three-layer flag-off | `root.ts` conditional-spread (`METHOD_NOT_FOUND`) → per-request `assert*Enabled` (`FORBIDDEN`) → web-vite `useFlag` render-removal. The reusable flag-dark idiom shared with classification / us-expansion. Detail: [[feature-flags]] |
| Two-step additive migration | Add nullable column + table (A) → idempotent reversible backfill → `NOT NULL` + FK (B, **last**). B never in the migration that added the column. Detail: [[domains/worker-foundation]] |
| Parallel-not-fork country-fields registry | A per-type `*CountryFieldsSchemaMap` (PL/DE/GB/US/AE/SA, each `.strict()`) + a `validate*CountryFields` dispatch mirrors the contractor map as a **sibling** — the contractor exports stay byte-identical (no fork). `.strict()` is load-bearing: it rejects any national-ID key so PII can never round-trip into the wholesale JSON. Detail: [[domains/employee-registry]] |
| National-ID PII-encryption boundary | National IDs live only in dedicated `*Encrypted`/`*Last4` columns (AES-256-GCM), never in `countryFields` JSON; the write path `omit`s every `*Encrypted` on return; the plaintext reveal is a distinct `*Pii:read` RBAC resource + a `<field>.revealed` audit row, staff-router-only. A per-data-class key (`EMPLOYEE_PII_ENCRYPTION_KEY`) gives non-SSN IDs an independent blast radius; SSN reuses `SSN_ENCRYPTION_KEY`. Tax/social IDs (Steuer-IdNr/SV-Nummer/NI/PAYE) stay plaintext-but-RBAC-gated. Detail: [[domains/employee-registry]] |
| Seeded reference lists (no live gov) | Government code lists (ZUS/NFZ/urzędy/Krankenkassen) + ELStAM are versioned + source-cited + adviser-verify LOCAL-ONLY seed tables (`reference-data/*`) + a no-network stub seam (`elstam-stub.ts`) — never a live government API call. Detail: [[domains/employee-registry]] |

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
