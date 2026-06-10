# Persistent Memory (cross-session invariants)

Facts that stay true across GSD phases. Update when architecture or policy changes — not for per-phase task lists (those live in `STATE.md`).

**Last updated:** 2026-06-08

## Authority order

1. In-tree verification (`packages/api/src/root.ts`, `pnpm test`, `pnpm typecheck`)
2. `CLAUDE.md` + `.planning/PROJECT.md`
3. `.planning/codebase/*` maps (commit `70f5782d`)
4. `.planning/intel/*` query index
5. Phase SUMMARYs under `.planning/milestones/` (historical)
6. **Discard** stale session memory, cross-repo handoffs, unverified test counts

## Stack anchors

- **Monorepo:** pnpm 10 + Turborepo; Node 24; TypeScript ESM
- **Staff API:** Fastify `apps/api` → tRPC `appRouter` at `/api/trpc/*`
- **Portal API:** `portalAppRouter` at `/api/trpc/portal` — **not** in `appRouter` (TS inference cost)
- **Router counts:** verify `packages/api/src/root.ts` — **53** always-mounted namespaces + **8** classification when `module.classification-engine` (or `QA_DEFAULT_ORG_ID`)
- **Web UI:** `apps/web-vite` — Page → Container → Hook → Component; tRPC only in `hooks/`
- **Auth:** Better Auth `packages/auth`; tenant from session, never from client `organizationId` alone
- **DB:** Prisma 7, PostgreSQL 17; regional `DATABASE_URL_EU` / `_ME` (+ optional `_US`)
- **Flags:** `@contractor-ops/feature-flags` only — keys in `packages/feature-flags/src/registry.ts`

## Non-negotiable patterns

| Pattern | Where enforced |
|---------|----------------|
| `entityIdSchema` for single-entity inputs | `packages/validators/src/common-inputs.ts`, `lint:architecture` |
| `formatMoneyAmount` in web-vite | `apps/web-vite/src/lib/money.ts`, `lint:architecture` |
| No `@contractor-ops/db` in web-vite | `lint:architecture` |
| `writeAuditLog` on sensitive mutations | `packages/api/src/services/audit-writer.ts`, `lint:audit-log` |
| Zod on every tRPC procedure | `packages/api/src/init.ts` middleware stack |
| `semble search` before grep | `CLAUDE.md`, `.cursor/rules/` |
| Read before Edit on existing files | Cursor runtime guard |

## Product / legal

- **Core value:** Invoice → match → approval → payment with full audit trail
- **Current milestone:** v7.0 GTM Expansion (phases 82–101) — see `STATE.md`
- **Legal copy:** DEFERRED sign-off; locked phrases in `packages/validators/src/legal/` — do not duplicate in UI/CMS
- **Deploy posture:** LOCAL-ONLY until legal gates cleared

## Agent discovery commands

```bash
semble search "<behavior>"
node .claude/get-shit-done/bin/gsd-tools.cjs intel query <term>
node .claude/get-shit-done/bin/gsd-tools.cjs graphify query <term>
pnpm check:web-vite-data-layer
pnpm typecheck --filter=@contractor-ops/api
```

## Graphify bootstrap note

Full `graphify extract` needs an LLM API key for semantic edges. Bootstrap graph lives in `.planning/graphs/graph.json`. Venv: `.planning/.venv-graphify/` (local, not committed).
