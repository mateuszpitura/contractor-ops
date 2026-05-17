# 1. pnpm + Turborepo monorepo

Date: 2026-05-17
Status: Accepted

## Context

`contractor-ops` ships four runtime apps (`web`, `public-api`, `landing`,
`cms`) plus ~15 internal packages (`api`, `auth`, `db`, `validators`,
`logger`, `feature-flags`, `einvoice`, `gov-api`, `integrations`,
`secrets`, …). These share a Prisma schema, a Pino logger configuration,
a Zod env contract, and a tRPC AppRouter — keeping them in separate
repos would force version-coupled releases, copy-paste of types across
package boundaries, and slow CI on cross-cutting refactors.

We needed a workspace tool that:
- Hoists with strict isolation (no phantom dependencies — every import
  must be declared in the consuming package's `package.json`).
- Plays well with Render's Docker builds (deterministic, lockfile-driven).
- Provides incremental, cache-aware task orchestration so a 4-app build
  completes in minutes, not tens of minutes.

## Decision

We use **pnpm 10.33.x** as the workspace package manager and
**Turborepo** as the task runner. Workspaces are declared in
`pnpm-workspace.yaml`. Internal packages publish ESM only, link via the
`workspace:*` protocol, and consume each other's `dist/` output (built
via `tsc` in `prepare`/`build` scripts).

Render's `Dockerfile`s rely on `pnpm install --frozen-lockfile` against
the committed `pnpm-lock.yaml`. CI uses `turbo run typecheck lint test
build` with the remote cache enabled per branch.

## Consequences

**Good**
- Single source of truth for shared schemas (Prisma, Zod, tRPC types).
- One refactor PR can touch every consuming app atomically.
- Turbo cache makes incremental CI fast (~3 min on warm cache).
- pnpm's strict isolation catches accidental cross-package imports.

**Bad**
- Onboarding requires `corepack enable && corepack prepare pnpm@10.33.2`
  — npm/yarn habits do not work.
- A lockfile mismatch fails the Docker build hard
  (`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`) — `pnpm install` must be run and
  committed whenever workspace packages change.
- Turbo cache invalidation can mask bugs when task `inputs` are
  under-specified — every new task needs explicit input globs.
