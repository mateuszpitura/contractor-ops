# Agent Start Here

Bootstrap index for AI sessions on ~600K LOC contractor-ops. Read this before non-trivial work (~3 min). Do **not** load all `.planning/milestones/` files.

**Updated:** 2026-06-08 | **Milestone:** v7.0 GTM Expansion | **Phase:** 85 (ready to plan)

## 1. Live project state

| Doc | Purpose |
|-----|---------|
| [STATE.md](./STATE.md) | Current phase, blockers, deferred items |
| [PROJECT.md](./PROJECT.md) | Product vision, shipped milestones, requirements |
| [MEMORY.md](./MEMORY.md) | Cross-session invariants (tenant, routers, patterns) |
| [REQUIREMENTS.md](./REQUIREMENTS.md) | Active milestone requirements |

## 2. Codebase maps (brownfield snapshot)

Read selectively by task type — full set in [codebase/](./codebase/):

| Doc | When to read |
|-----|----------------|
| [STACK.md](./codebase/STACK.md) | Deps, runtime, new packages |
| [INTEGRATIONS.md](./codebase/INTEGRATIONS.md) | KSeF, Peppol, OAuth, webhooks, QStash |
| [ARCHITECTURE.md](./codebase/ARCHITECTURE.md) | Layers, tRPC, data flow |
| [STRUCTURE.md](./codebase/STRUCTURE.md) | Where to put new files |
| [CONVENTIONS.md](./codebase/CONVENTIONS.md) | entityId, money, hooks, audit |
| [TESTING.md](./codebase/TESTING.md) | Vitest, CI, MSW |
| [CONCERNS.md](./codebase/CONCERNS.md) | Tech debt, security gaps |

**Commit pinned:** `70f5782d78e33ba98c82e4ccda2cd4b0b4aff216`

## 3. Queryable intel (prefer over full-repo grep)

```bash
node .claude/get-shit-done/bin/gsd-tools.cjs intel query invoice
node .claude/get-shit-done/bin/gsd-tools.cjs intel query tenant
node .claude/get-shit-done/bin/gsd-tools.cjs graphify query approval
```

Files: `.planning/intel/` (JSON) + `.planning/graphs/graph.json` (AST — **gitignored**, regen locally)

## 4. Discovery workflow

1. `semble search "<behavior>"` → `semble find-related <file> <line>`
2. Intel/graphify query (above)
3. `Read` target file
4. `grep` only for exhaustive literals

Binding: [CLAUDE.md](../CLAUDE.md), [apps/web-vite/ARCHITECTURE.md](../apps/web-vite/ARCHITECTURE.md)

## 5. Top rules agents break (CI-enforced)

1. **Tenant** from session — never trust client `organizationId`
2. **`entityIdSchema`** — no inline `z.object({ id: z.string() })` in routers
3. **`formatMoneyAmount`** — no local amount formatters in web-vite
4. **web-vite layers** — no `useTRPC` in pages/containers/components
5. **`writeAuditLog`** on sensitive mutations
6. **Feature flags** — `@contractor-ops/feature-flags` only
7. **No `console.*`** — use `@contractor-ops/logger`
8. **Verify router counts** in `packages/api/src/root.ts` — do not cite stale numbers
9. **Read before Edit** on existing paths
10. **Run filtered typecheck** after `packages/*` API changes

Guards: `pnpm lint:architecture`, `pnpm check:web-vite-data-layer`, `pnpm lint:ci`

## 6. Parallel goals/ (check before duplicating work)

| Goal | Status | Notes |
|------|--------|-------|
| [qa-walk-and-fix](../goals/qa-walk-and-fix/goal.md) | **Active** | Playwright walk matrix; targets legacy `apps/web` paths in goal text — verify against current `apps/web-vite` |
| [production-hardening](../goals/production-hardening/goal.md) | **Active** | CSP, audit hygiene, infra recommendations |
| [post-migration-parity-restoration](../goals/post-migration-parity-restoration/goal.md) | **Open** | Closes audit gaps from parity audit |
| [fe-be-integration-audit](../goals/fe-be-integration-audit/goal.md) | **Open** | FE↔BE contract audit |
| [web-vite-container-pattern](../goals/web-vite-container-pattern/goal.md) | **In progress** | Aligns with ARCHITECTURE.md; run `check:web-vite-data-layer` |
| [migrate-web-off-next-to-vite-react](../goals/migrate-web-off-next-to-vite-react/goal.md) | **Likely complete** | Verify `apps/web-vite` is canonical SPA |
| [demo-readonly-mode](../goals/demo-readonly-mode/goal.md) | **Verify** | May overlap v6 demo work |
| [dry-solid-audit](../goals/dry-solid-audit/goal.md) | **Open** | Code quality audit |
| [i18n-typed-keys](../goals/i18n-typed-keys/goal.md) | **Open** | Typed i18n keys |
| [ui-consistency-sweep](../goals/ui-consistency-sweep/goal.md) | **Open** | UI polish |
| [data-table-unification](../goals/data-table-unification/goal.md) | **Open** | Table patterns |
| [comprehensive-dev-seed](../goals/comprehensive-dev-seed/goal.md) | **Open** | Dev seed coverage |
| [launch-readiness-landing-pricing-analytics](../goals/launch-readiness-landing-pricing-analytics/goal.md) | **Open** | Landing + analytics |
| Others under `goals/` | **See goal.md** | 25 total — treat as secondary to GSD STATE unless explicitly tasked |

**Rule:** If a `goals/*` task conflicts with `STATE.md` phase work, **STATE wins** unless user says otherwise.

## 7. Do not trust without re-verify

- `.planning/handoffs/test-cleanup-2026-04-27.md` — run `pnpm test` for current status
- Archived milestone docs (`_archive/`, old ROADMAP snapshots)
- Session memory citing foreign emails, old router totals, cross-repo facts
- `goals/` done conditions without reading current `goal.md`

## 8. Brain wiki (claude-obsidian)

Canonical vault: [.planning/brain/](./brain/) — domain flows, patterns, decisions.

| Path | Role |
|------|------|
| [brain/wiki/hot.md](./brain/wiki/hot.md) | Hot cache — read for domain context |
| [brain/wiki/index.md](./brain/wiki/index.md) | Wiki catalog |
| [brain/wiki/structure/_index.md](./brain/wiki/structure/_index.md) | **Structure compass** — apps, packages, routers, UI domains |
| [brain/wiki/meta/agent-discovery.md](./brain/wiki/meta/agent-discovery.md) | Agent lookup protocol (semble → intel → wiki) |
| [brain/wiki/meta/graphify.md](./brain/wiki/meta/graphify.md) | Graphify vs semble vs intel decision tree |
| [brain/.raw/](./brain/.raw/) | Immutable curated sources (do not edit) |

**Open in Obsidian:** folder `.planning/brain/`

**Protocol:** code locations → semble; domain/why → wiki. Commands: `/wiki`, ingest, lint (claude-obsidian plugin).

Graph (AST): `.planning/graphs/graph.json` — local only (~20MB, gitignored). Regen: `graphify update . --no-cluster --force` → copy to `.planning/graphs/` (see `brain/README.md`, `graphs/GRAPH_REPORT.md`).

Wiki health: `pnpm check:wiki-brain` (also in `lint:ci`).

**Documentation follows code (binding):** any product change in `apps/`/`packages/` → matching wiki in same change set + graph/intel/BM25 when applicable. See `CLAUDE.md` § Documentation follows code; hook `DOC_DRIFT_WARN` if code without wiki.

## 9. Refresh triggers

| Event | Action |
|-------|--------|
| Large API router refactor | `map-codebase --paths packages/api` + `intel query refresh` |
| New milestone | `map-codebase --fast --focus arch` |
| New invariant discovered | Add bullet to `MEMORY.md` + optional wiki synthesis |
| GSD phase complete | Consider ingest to `brain/wiki/` (not milestones bulk) |
| Graphify | `graphify update . --no-cluster --force` → copy `graphify-out/graph.json` |
| Wiki edit | `pnpm check:wiki-brain` + BM25 rebuild (`brain/wiki/meta/retrieval.md`) |
| Quarterly | Full codebase map refresh |
