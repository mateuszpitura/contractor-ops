# DRY / SOLID Audit — Facts

## Scope

- Audit covers the entire `contractor-ops` monorepo: every directory under `apps/` and `packages/`.
- The four audit categories are: (1) utility functions (date, money, string, validation, formatting, ID/slug, etc.), (2) React components and hooks, (3) tRPC patterns (procedures, middleware, tenant guards, audit-log calls, error wrappers, Zod input shapes), (4) Prisma / DB patterns (query helpers, pagination, soft-delete, RLS-aware queries, transaction wrappers).
- Generated code is excluded: Prisma client output (`@prisma/client`, `prisma-client` package outputs), Payload-generated `payload-types.ts`, i18n parity caches, build artefacts, `.turbo/`, `node_modules/`.
- Migration files are excluded: anything under `prisma/migrations/`, historical SQL, snapshot fixtures pinned to a point-in-time.
- Test fixtures and factory boilerplate are **in scope** — duplication there counts and may be extracted if non-trivial.
- `apps/landing` marketing sections are **in scope** — duplicated section primitives are eligible for extraction.

## Threshold

- Extraction-worthy duplication = the same non-trivial logic (≥ ~5 lines OR domain-critical behaviour such as money math, audit writes, tenant resolution, RLS scoping, error mapping, date/locale formatting) appearing in **two or more places**.
- Trivial repeats (e.g. one-line lambdas, simple destructuring, `if (!x) throw`) are not extraction-worthy unless they encode a domain rule.
- Coincidental similarity (same shape, different intent) is **not** duplication and must not be merged.

## Output

- A markdown audit report is produced at `goals/dry-solid-audit/audit.md` listing every identified duplication cluster, with: source file paths and line ranges, occurrence count, category, proposed extraction target (package + module path), risk rating, and rationale.
- All extractions land in **one single PR** that contains: (a) the audit report, (b) the new shared modules, (c) every call-site migration, (d) any new package wiring (`tsconfig`, `package.json`, exports).
- The PR title and body describe the audit scope, the clusters extracted, and any clusters explicitly skipped with reasons.

## Extraction targets

- Pure framework-agnostic utilities land in `packages/shared` (or a new `packages/utils` if `shared` becomes overloaded — decision recorded in the plan).
- React-only utilities (components, hooks) land in `packages/ui` under the existing `components/`, `hooks/`, or `lib/` folders.
- tRPC-only utilities (procedures, middleware, audit, tenant guards) land in `packages/api/src/lib/` or a new `packages/api/src/shared/` folder — never in `packages/shared`.
- Prisma/DB utilities land in `packages/db` (extending its existing surface) — never in `packages/shared`.
- No new top-level package is created unless an existing one is the wrong home for a cluster; if created, it follows existing package conventions (`tsconfig.json`, `package.json`, `src/index.ts`, vitest config).

## Behaviour preservation

- Extractions are pure refactors: no runtime behaviour change at any call site.
- Public type signatures of exported library functions stay equivalent (same input/output, same throws, same logging side-effects).
- Audit-log writes (`writeAuditLog`) and tenant resolution remain on the same code paths — extraction must not move them out of transactions or change ordering relative to mutations.
- No feature flag is introduced solely to gate the refactor.

## Quality bars

- `pnpm typecheck` passes for the whole monorepo (tsc, CI-canonical) after extraction.
- `pnpm test` passes for every package touched by the PR, scoped per package (never an unscoped full `web-vite` run — per `feedback_test_run_memory`).
- `pnpm lint` and Biome are clean — no new warnings introduced by the PR.
- No `console.*` is added; logging uses `@contractor-ops/logger` per `feedback_logging`.
- No 7-day-release-age bypass; no new third-party dep added solely to support a refactor unless flagged in the report with rationale.

## Non-goals

- Adding tests for previously-untested code paths is not part of this PR (may be flagged for follow-up).
- Renaming domains, restructuring routers, or changing public tRPC route names is out of scope.
- Performance optimisation beyond what naturally follows from deduplication is out of scope.
- UI redesign, component API redesign, or UX changes are out of scope.
- Migrating callers to a different library (e.g. swapping date-fns for Temporal) is out of scope.

## Anti-goals (explicitly forbidden)

- No abstraction that exists only to satisfy DRY without 2+ real call sites consuming it.
- No `sed` / `awk` / ad-hoc script bulk replace for call-site migration — per-file `Edit` only, per CLAUDE.md.
- No `git stash`, `git checkout --`, `git reset --hard` during the work — destructive git is forbidden without explicit approval.
- No deletion of duplicated code without first wiring the replacement and verifying typecheck.
- No premature generalisation (e.g. generic `<T>` wrappers that only ever take one concrete `T` in the codebase).

## Verification

- After every cluster extraction, the relevant package's `pnpm typecheck` is run before moving to the next cluster.
- Final `pnpm typecheck` (monorepo) and `pnpm test` (per touched package) must both be green before the PR is opened.
- Final `pnpm lint` and Biome must be clean.
- The audit report explicitly lists each cluster as either `EXTRACTED`, `SKIPPED (reason)`, or `DEFERRED (reason)`.

## Done condition

- One PR is open against `main` containing: `audit.md`, all extracted shared modules, all migrated call sites, no behaviour change, all quality bars green.
