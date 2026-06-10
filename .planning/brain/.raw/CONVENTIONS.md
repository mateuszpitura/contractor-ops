---
last_mapped_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
last_mapped_at: 2026-06-08
---

# Codebase Conventions

Canonical engineering patterns for contractor-ops. Binding floor: [`CLAUDE.md`](../../CLAUDE.md), [`.claude/core-values.yml`](../../.claude/core-values.yml), [`.cursor/rules/`](../../.cursor/rules/). Verify facts in-tree — do not trust session memory.

## Monorepo layout

| Layer | Location | Role |
|-------|----------|------|
| Apps | `apps/*` | Deployable surfaces (api, web-vite, cron-worker, public-api, cms, landing) |
| Packages | `packages/*` | Shared domain, API, auth, db, validators, UI, feature-flags |
| Tooling | `scripts/*` | CI gates, codemods, architecture lint |
| Planning | `.planning/*` | Product/architecture docs (not shipped) |

**pnpm 10 + Turborepo.** Package changes in `packages/*` → check downstream `apps/*` imports; run filtered typecheck when shared APIs change.

## Agent & editor workflow

### Semble before grep

Discovery order: `semble search` → read full file → `semble find-related` → grep only for exhaustive literals. Fallback if semble not on PATH: `uvx --from "semble[mcp]" semble`.

### Read before Edit

**Required:** `Read` (or equivalent) before first `Edit`/`Write` to an **existing** path — runtime rejects unread overwrites. New paths: `Write` OK without prior `Read`. Prefer `Edit` over `Write` on existing files; no `sed`/awk/ad-hoc replace scripts.

### Minimal diff

No new files/docs unless asked. Parallelize independent reads/edits. Verify paths via Read/Glob/semble — never guess.

## Entity IDs (`entityIdSchema`)

Single-entity tRPC inputs use the shared Zod schema from `@contractor-ops/validators`:

```ts
// packages/validators/src/common-inputs.ts
export const entityIdSchema = z.object({ id: z.string().min(1) });
```

**Do not** inline `.input(z.object({ id: z.string() }))` in routers. CI enforces via `pnpm lint:architecture` (`inline-entity-id` rule in `packages/lint-guards/src/architecture-guard/run-guard.ts`).

Related helpers in the same module: `entityIdsSchema` (bulk), `paginationSchema`, `entityWithDataSchema(dataSchema)` for PATCH-style `{ id, data }` inputs.

Bulk migration: `scripts/migrate-entity-id-schema.mjs` replaces inline patterns and adds imports.

## Money formatting (`formatMoneyAmount`)

Staff SPA currency display goes through one facade:

```ts
// apps/web-vite/src/lib/money.ts
formatMoneyAmount(minor, currency, locale?)  // Intl symbol + amount
```

Delegates to `@contractor-ops/shared` for ISO 4217 minor-unit correctness. **Do not** add local `function formatAmount(` helpers in components — `lint:architecture` flags `local-format-amount`. Legacy `formatAmount` / `formatMinorUnits` remain in `money.ts` only.

## web-vite data layer

Four-layer UI architecture — full spec: [`apps/web-vite/ARCHITECTURE.md`](../../apps/web-vite/ARCHITECTURE.md).

| Layer | Path | tRPC / React Query |
|-------|------|-------------------|
| Page | `src/pages/**` | **Forbidden** — Suspense + compose `*Container` only |
| Container | `src/components/{domain}/*-container.tsx` | **Forbidden** — calls domain hooks; owns loading/empty/error branches |
| Hook | `src/components/{domain}/hooks/use-*.ts` | **Required boundary** — only place for `useTRPC`, `useQuery`, `useMutation` |
| Component | presentational siblings | **Forbidden** — props in, JSX out |

Allowed exceptions: `src/providers/**`, `src/hooks/**` (cross-cutting), `src/hooks/use-entity-detail-query.ts`.

**CI gates** (all in `pnpm lint:ci`):

| Script | Enforces |
|--------|----------|
| `check:web-vite-data-layer` | No `useTRPC`/`useQuery`/`useMutation` outside hooks/providers |
| `check:web-vite-page-shells` | Pages import containers only; no route logic |
| `check:web-vite-presentational` | Components stay presentational |
| `check:web-vite-table-pattern` | Table kit conventions |
| `check:web-vite-dialog-pattern` | Dialog ownership patterns |

Also: no `@contractor-ops/db` imports in web-vite (`web-vite-db-import` in `lint:architecture`) — use DTOs from `@contractor-ops/validators`.

## tRPC & Zod

- Every procedure has a Zod `.input()` schema; no unsafe `as` on external/webhook payloads — use `safeParse`.
- Tenant scope from session/context (`organizationId`, region) — **never** trust client-supplied tenant ids alone.
- Staff router: `packages/api/src/root.ts` (~50 namespaces). Portal: `packages/api/src/portal-root.ts` at `/api/trpc/portal`.
- Shared inputs live in `packages/validators` (`common-inputs.ts`, domain modules, `public-api/`).

## Audit trail (`writeAuditLog`)

Sensitive mutations emit append-only audit rows via [`packages/api/src/services/audit-writer.ts`](../../packages/api/src/services/audit-writer.ts):

```ts
await writeAuditLog({
  organizationId,  // caller MUST supply — no implicit lookup
  actorType: 'USER',
  actorId: userId,
  action: 'contract.updated',
  resourceType: 'CONTRACT',
  resourceId,
  oldValues, newValues,
  tx,  // pass Prisma tx so audit commits with mutation
});
```

- `writeAuditLogMany` for batch inserts in one transaction.
- `auditedMutation()` wrapper in `packages/api/src/lib/audited-mutation.ts` for mutation + audit in one call.
- `lint:audit-log` in CI catches drift from the shared writer.
- No `console.*` — uses `@contractor-ops/logger`.

## Feature flags

**Only** `@contractor-ops/feature-flags` in apps — no direct Unleash SDK.

1. Declare key in `packages/feature-flags/src/registry.ts` (`key`, `default`, `jurisdiction`, `owner`, …).
2. Consume: `evaluate()`, `useFlag()`, `<Feature flag="…">`, `requireFeatureFlag()`.
3. Create toggle in both regional Unleash instances (EU + ME) unless jurisdiction-scoped.
4. Ship-dark: missing Unleash toggle → code `default` (usually `false`).

**Not for flags:** domain config (Prisma columns), per-user prefs, RBAC (`requirePermission` instead).

## i18n (web-vite)

- **Locales:** `en`, `pl`, `de`, `ar` (RTL), `en-US` — bundles in `apps/web-vite/messages/{locale}.json`.
- **Bootstrap:** `apps/web-vite/src/i18n/index.ts` — i18next + ICU (`i18next-icu`), lazy locale loading.
- **Detection:** URL `:locale` segment (primary) → cookie → `navigator.language`.
- **Typed keys:** turbo task `i18n:types` generates `src/generated/i18n/**` from `en.json`.
- **Hooks:** `useTranslations`, `useFormatter`, `useTranslatedError`, `use-common-toasts`.
- **CI:** `i18n:parity`, `i18n:code-coverage` (strict), `i18n:quality` (advisory), `lint:i18n-casts`.

UI work: read `frontend-design` skill; ship loading/empty/error states; WCAG (keyboard, focus, contrast).

## Logging & env

- Structured logging via `@contractor-ops/logger` (Pino). No `console.*` in app source.
- New env vars → `.env.example` + package `env` schema (`packages/*/src/env.ts`). Run `pnpm check:no-process-env` when touching env access.

## Dependencies & security

- **7-day release age** (`pnpm-workspace.yaml`, `.npmrc`) — no `@latest` bypass without approval.
- After dep changes: `pnpm audit` + `pnpm security:scan`; verify package names (typosquatting).
- Schema-validate all boundaries: forms, API, env, webhooks.

## Architecture lint (`lint:architecture`)

`scripts/lint-architecture.mjs` runs `runArchitectureGuard()` from `packages/lint-guards`:

| Rule | Scope | Fix |
|------|-------|-----|
| `inline-entity-id` | `packages/api/src/routers/**` | Use `entityIdSchema` |
| `local-format-amount` | `apps/web-vite/src/**` (excl. `lib/money.ts`, tests) | Use `formatMoneyAmount` |
| `web-vite-db-import` | `apps/web-vite/src/**` | Import from `@contractor-ops/validators` |

Run locally: `pnpm lint:architecture`. Included in `pnpm lint:ci`.

## Git safety

Never `git stash`, `git checkout --`, `git restore`, or `git reset --hard` without explicit user approval. Diagnose with read-only `git status` / `git diff` / `git show` first.

## Quick verification

```bash
pnpm typecheck --filter=@contractor-ops/api   # shared API/types
pnpm check:web-vite-data-layer                # data-layer gate
pnpm lint:architecture                        # entityId / money / db-import
pnpm lint:ci                                  # full lint pipeline
```
