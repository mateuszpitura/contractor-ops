---
title: contractor-ops overview
type: overview
tags: [contractor-ops, bootstrap]
updated: 2026-06-09
---

# contractor-ops — agent overview

B2B contractor operations (EU / UK / Gulf). Core value: **invoice → match → approval → payment** with full audit trail.

## Canonical sources (link out — do not duplicate)

| Layer | Path | Role |
|-------|------|------|
| Bootstrap index | `.planning/INDEX.md` | Session start (~3 min) |
| Agent protocol | [[meta/agent-discovery]] | semble → intel → wiki |
| Structure compass | [[structure/_index]] | Where files live |
| Router catalog | [[structure/api-routers-catalog]] | tRPC namespaces |
| Patterns | [[patterns/_index]] | CI invariants |
| Domains | [[domains/_index]] | Business flows |
| Wiki hub | [[meta/dashboard]] | Navigation; [[meta/wiki-tables]] for Base tables |
| Code maps | `.planning/codebase/` | Brownfield snapshot |
| Live code truth | `semble search` | Symbols, procedures |
| Intel | `.planning/intel/` | JSON query index |
| Graph | `.planning/graphs/graph.json` | AST call graph |
| Invariants | `.planning/MEMORY.md` | Cross-session facts |

## Stack (verify in tree)

- Staff SPA: `apps/web-vite` — [[patterns/web-vite-data-layer]]
- API: `apps/api` → tRPC `appRouter` + `portalAppRouter`
- Domain logic: `packages/api` routers + services
- Auth: Better Auth; tenant from session only

## Wiki scope

**Domain flows, patterns, structure compass** — not a mirror of `packages/`. For code locations always use semble first.
