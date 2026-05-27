# Engineering & Product Guidelines

> Binding floor: [`.claude/core-values.yml`](.claude/core-values.yml) + [`.cursor/rules/`](.cursor/rules/). **Read this entire file** at session start and before non-trivial work. Summary below is a floor, not a replacement.

## Enforcement

- **Claude Code:** `SessionStart` injects `core-values.yml` + **full text of this file** on `startup`, `resume`, `/clear`, `compact` — that *is* context loaded; no Read tool needed unless the `PROJECT STANDARDS — CLAUDE.md` block is missing. `UserPromptSubmit` = short motto only.
- **Cursor:** always applied; re-read sections if rules fade mid-thread.
- **Subagents:** `SubagentStart` = floor only → **Read this file** before multi-file implementation.
- **Maintaining floor:** edit `core-values.yml` → `pnpm standards:gen` → `pnpm standards:check`.

## Context authority (this repo only)

- Workspace = **contractor-ops** monorepo only — not other products (e.g. ReachLatent) unless the user opens that repo.
- **Claude user/memory**, prior chats, or injected **“Memory context”** blocks are often **cross-repo or stale** (foreign dev emails, old tRPC counts, test-debt handoffs from another project). **This file + [`.planning/PROJECT.md`](.planning/PROJECT.md) override them** for stack, people, metrics, and process.
- Before stating project-specific facts (router count, test status, LOC, milestone phase, who works here): **verify in this tree** — do not trust session memory alone.
- Examples to **discard unless re-verified here:** `matt@reachlatent.com`, “55 routers”, “phase 70 test debt”, handoff notes from other codebases.

## Stack (canonical)

| Area | In this repo |
|------|----------------|
| Product | B2B contractor ops (EU / UK / Gulf); local-only deploy posture; legal sign-off deferred for jurisdiction text — `.planning/PROJECT.md` |
| Monorepo | pnpm 10 + Turborepo |
| Web (Vite) | React + Vite SPA (`apps/web-vite`) — i18next/react-i18next (en, de, pl, ar RTL), TanStack Query, tRPC v11 client, **container + hooks** architecture; see [`apps/web-vite/ARCHITECTURE.md`](apps/web-vite/ARCHITECTURE.md) |
| CMS | Payload (`apps/cms`, port 3002) — Authors / Categories / Posts |
| Landing | Next.js 16 (`apps/landing`) |
| API server | Fastify + tsx (`apps/api`) — hosts tRPC `/api/trpc/*` for web-vite SPA + portal; uses `@sentry/node` |
| Public API | Hono (`apps/public-api`) — REST surface for external API-key consumers |
| Cron worker | Fastify (`apps/cron-worker`) — background jobs, QStash callbacks, webhooks |
| tRPC | v11 in `packages/api` — staff `appRouter`: **50** namespaces in [`root.ts`](packages/api/src/root.ts); **+up to 7** classification when `module.classification-engine` (or `QA_DEFAULT_ORG_ID`); **portal** separate [`portalAppRouter`](packages/api/src/portal-root.ts) (2) at `/api/trpc/portal` |
| Auth | Better Auth — [`packages/auth`](packages/auth) |
| DB | PostgreSQL 17 + Prisma 7 (`prisma-client`); regional `DATABASE_URL_EU` / `_ME` (Neon multi-region in prod) |
| Flags | Self-hosted Unleash OSS — `@contractor-ops/feature-flags` wrapper only |
| Logger | `@contractor-ops/logger` (Pino) — no `console.*` in app source |
| Typecheck | `pnpm typecheck` (tsc, CI-canonical); `pnpm typecheck:fast` (tsgo, dev) |
| Tests | `pnpm test` (turbo → vitest). **Never cite failure counts from memory or handoffs** — run tests. Historical note only: [`.planning/handoffs/test-cleanup-2026-04-27.md`](.planning/handoffs/test-cleanup-2026-04-27.md) (Apr 2026 snapshot; may be stale). |
| Deploy | Render (+ `render.yaml` in repo); infra recommendations in planning docs — no ad-hoc service changes without user ask |
| Domains | Contractors, engagements, classification, invoices, payments, contracts, equipment, timesheets, approvals, workflows, portal (external) |

## UI plugin (`frontend-design`)

- **Rule:** all UI work → read and follow the **`frontend-design`** skill before implementing in `apps/web-vite`, `apps/landing`, `packages/ui`.
- **Claude Code UI hooks (opt-in):** **`[ui]`** / **`[ui-strict]`** — (1) `Skill` tool `frontend-design` *lub* `Read` na `SKILL.md`, (2) `semble search`, (3) analiza i edycje. Tracker liczy Skill + Semble native tools, nie tylko Bash/Read. Wyłącz: prompt bez prefiksu lub `/ui-workflow-off`.
- **Cursor:** same workflow in [`.cursor/rules/30-ui-a11y.mdc`](.cursor/rules/30-ui-a11y.mdc) (no runtime block — verify tool log).
- **Verify:** turn must show `Read` on `frontend-design/.../SKILL.md` + `semble search` before UI file edits.

## Verify (don’t trust session memory)

```bash
pnpm typecheck --filter=@contractor-ops/api   # API/types
pnpm test                                      # vitest via turbo
# Router keys: packages/api/src/root.ts (appRouter) + portal-root.ts
```

## Binding standards (summary)

- NEVER `git stash` / destructive git without explicit approval; read-only diagnose first (`git status`, `git diff`, `git show`).
- `packages/*` → check `apps/*`; new env → `.env.example` + package `env` schema (`packages/*/src/env.ts`).
- Deps: 7-day release age — no `@latest` / bypass; after changes → `pnpm audit` + `pnpm security:scan`; verify package name (typosquatting).
- **Quality > time** — production-grade, no on-the-knee shortcuts/TODOs; verify before done; narrow scope or ask if needed.
- Comments only when non-obvious; no narration or spam on short code.
- Tenant from session; `writeAuditLog` on sensitive mutations; tRPC Zod inputs; no unsafe `as` on external payloads.
- `semble search` before grep; **MUST Read before Edit/Write** on existing files; Edit > Write; no sed/script bulk replace; minimal diff; parallel independent tools; no guessed paths/URLs.
- Schema-validate boundaries; no `console.*` in app source (`@contractor-ops/logger`); flags via `@contractor-ops/feature-flags` only.
- UI: `frontend-design`; WCAG + loading/empty/error states mandatory.
- Caveman **full** at session start until `stop caveman` / `normal mode`; code/commits/PRs stay normal.

## Git safety

- NEVER `git stash` (any variant), `git checkout --`, `git restore`, `git reset --hard` without explicit user approval for **this** operation.
- Need stash/checkout/reset to test → STOP, ask, explain why. Other agents share the tree — stash destroys in-flight work.
- Unclear tree state → read-only diagnosis only; never “clean up” index/stash without instruction.

## Communication

- Caveman **full** at start (= `/caveman`); injected via hook. Off: `stop caveman` / `normal mode`. Skill: [`.claude/skills/caveman/SKILL.md`](.claude/skills/caveman/SKILL.md).
- Code blocks, commits, PR bodies: normal prose (unless `caveman-commit` / `caveman-review`).

## Agent workflow

**Discovery:** `semble search` / `semble find-related` before grep; fallback `uvx --from "semble[mcp]" semble`. **Docs:** context7 MCP/CLI — not training-data guesses. **Web:** `agent-browser` — `open` → `snapshot -i` → interact by @refs → re-snapshot.

**Read before Edit (required):** MUST `Read` before first `Edit`/`Write` to an **existing** path — runtime rejects unread files (*"You must read file before overwriting it"*). Do **not** retry `Edit` without `Read`. New paths: `Write` OK without prior `Read`.

**Editing:** Edit > Write on existing files. No `sed`/`awk`/ad-hoc Python/TS replace scripts (breaks imports/formatting) — Edit per file; codemods only when appropriate. Scripted replace = last resort + user OK + typecheck/lint after. Minimal diff; no new files/docs unless asked. Parallelize independent reads/edits. Verify paths via Read/Glob/semble — never guess.

**Search order:** semble → read full file if needed → find-related → grep only for exhaustive literals.

## Monorepo & dependencies

- **pnpm + Turborepo** only. `packages/*` changes → check `apps/*`; `pnpm typecheck --filter=...` when shared APIs/types change.
- **Env:** `.env.example` + package env schema; `pnpm check:no-process-env` when touching env access.
- **7-day release age** ([`pnpm-workspace.yaml`](pnpm-workspace.yaml) `minimumReleaseAge: 10080`, [`.npmrc`](.npmrc) `min-release-age=7`) — anti-malware; no `@latest` or age bypass without explicit approval. If blocked → older version or ask. After add/upgrade → `pnpm audit` + `pnpm security:scan`. Typosquat check on new deps. `pnpm.overrides` only for known CVEs — document when committing.

## Multi-tenant & API

- **Tenant** from session (`organizationId`, region) — never from client input alone. **RLS** + DB protections preferred.
- **Audit:** sensitive mutations → `writeAuditLog` in [`packages/api/src/services/audit-writer.ts`](packages/api/src/services/audit-writer.ts); pass `tx` in transactions when possible.
- **tRPC:** Zod on every procedure; webhooks/cron → `safeParse`, no unsafe `as`. **Cron:** `createCronLogger`; no `console.*`.

## Quality & code

- **Quality > time:** no skipping tests, types, Zod, tenant checks, audit, UI states, or typecheck/lint to finish faster. Fix root cause; verify touched packages before done.
- Production-grade, not demo — no placeholders/TODOs left behind. Strong typing; match existing patterns; justified abstractions only.
- **Comments:** self-explanatory → none. Only non-obvious rules, invariants, tricks. No `// increment i`, headers, “removed X”, or comment-dense 10-line functions. Match file’s comment density.
- **Logging:** structured (`@contractor-ops/logger`); no silent failures; debuggable errors.

## Validation & security

- Zod/schema at all boundaries (forms, API, env, webhooks). Never trust client input. No secrets exposed. Least privilege. Mind XSS, CSRF, SSRF, injection, IDOR.

## UI & product

- **`frontend-design`** for all UI — polished, consistent, responsive, accessible (WCAG: keyboard, focus, semantic HTML, contrast).
- No mechanical features — real flows with **loading, empty, error** states. Consider edge cases and production use.

## Feature flags

- **`@contractor-ops/feature-flags`** only (`evaluate`, `useFlag`, `<Feature>`); keys in [`packages/feature-flags/src/registry.ts`](packages/feature-flags/src/registry.ts) — then Unleash UI. No direct Unleash SDK in apps ([`packages/feature-flags/README.md`](packages/feature-flags/README.md)). Domain config stays in Prisma, not flags.

## web-vite UI layers (`apps/web-vite`)

- **Page** → thin composer only (`Suspense`, permissions); **no** `useTRPC` / `useQuery` / `useMutation`.
- **Container** (`*-container.tsx`) → calls domain hooks; section loading/empty/error; **no** direct tRPC.
- **Hook** (`components/{domain}/hooks/use-*.ts`) → **only** tRPC/React Query boundary for that section.
- **Component** → presentational (props in, JSX out).
- Step 10 ports: write hook + container **first**; run `pnpm check:web-vite-data-layer`.
- Full spec: [`apps/web-vite/ARCHITECTURE.md`](apps/web-vite/ARCHITECTURE.md).

## Architecture reference

- Clean boundaries: apps / packages / domain / infra. SOLID where it helps; scalable over hacks; senior-level navigability.
- **Performance:** avoid overfetch, duplicate work, bundle bloat; cache appropriately.
- **API/DB:** clear contracts; reversible migrations; indexing; business logic in domain/DB layer — not random files.
- **DX:** keep `.env.example` current; predictable scripts and package boundaries.
