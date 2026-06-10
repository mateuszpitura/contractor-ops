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

## Wiki Knowledge Base (claude-obsidian)

**VAULT_PATH:** `.planning/brain`

Discovery order for **domain / decisions / why** (not code locations):

1. [`.planning/INDEX.md`](.planning/INDEX.md)
2. [`.planning/brain/wiki/hot.md`](.planning/brain/wiki/hot.md)
3. [`.planning/brain/wiki/index.md`](.planning/brain/wiki/index.md) → specific page

For **code locations**: `semble search` first — **never wiki alone**.

After a GSD phase with a new invariant: append to [`.planning/MEMORY.md`](.planning/MEMORY.md) + optional wiki synthesis page (`/wiki`, `ingest`, `lint the wiki` via claude-obsidian plugin).

## Documentation follows code (mandatory — never skip)

**Principle:** the codebase wiki is a **living compass** — it must **track the code**, not lag behind it. Any product change in `apps/` or `packages/` that adds, removes, or alters behavior is **incomplete** until the matching wiki (and indexes/graph when applicable) is updated **in the same change set**. Stale docs → next agent hallucinates.

**Default rule:** if you changed product code → update wiki before done. Not only routers — **every** new feature, hook, container, component, package, cron job, Prisma model, env var, flag, integration, or flow change.

| Trigger | Required wiki / index updates |
|---------|-------------------------------|
| New or changed **feature** (end-to-end flow) | Relevant `wiki/domains/*` — Purpose, Flow, Entry points, UI surface, Agent mistakes |
| New **UI** hook / container / component / route | Domain page + `wiki/structure/web-vite-domains.md`; pattern page if new convention |
| New/changed **tRPC** procedure or namespace | `wiki/structure/api-routers-catalog.md` + domain page; verify `root.ts` |
| New/moved **`services/`** logic | `wiki/structure/key-services.md` + domain wiki; fix `verify_with` paths |
| New **`packages/*`** module or public export | `wiki/structure/packages.md` + consumer domain/pattern pages |
| New **integration** / webhook / OAuth | `wiki/integrations/<provider>.md` + `integrations/_index` |
| New **cron** / QStash job | `wiki/structure/cron-jobs.md` + domain if business-facing |
| New **Prisma** model / migration with product impact | `wiki/structure/prisma-schema-areas.md` + domain |
| New **feature flag** key | `wiki/patterns/feature-flags.md` + registry comment; Unleash UI separate |
| New **env** var (product-facing) | `.env.example` + pattern/domain note if agents need it |
| **Refactor** / discovery / moved files | Same pages as above for affected surfaces; do not leave old paths in wiki |
| Call-graph / import wiring change | `graphify update . --no-cluster --force` → `.planning/graphs/graph.json` |
| Large multi-package refactor | `map-codebase` + `.planning/intel/` + `.planning/codebase/*` when maps drift |
| New **invariant** (GSD, audit, bug root cause) | `.planning/MEMORY.md` + pattern/domain bullet |
| Any **wiki** page edit | `wiki/log.md`, overwrite `wiki/hot.md`, rebuild BM25, `pnpm check:wiki-brain` |
| **`HEAD` advanced** | bump `source_commit` on touched wiki frontmatter |

**Exempt (wiki not required):** test-only files (`__tests__`, `*.test.ts`), generated code, lockfiles, pure formatting with zero behavior change — when unsure, update wiki.

**Doc drift:** hook emits `DOC_DRIFT_WARN` on Stop if product code changed but no `wiki/` page was updated in the same session.

Hook: SessionStart injects rule; Stop → `KNOWLEDGE_REFRESH_REQUIRED` / `DOC_DRIFT_WARN`. See [`.planning/brain/wiki/meta/refresh-triggers.md`](.planning/brain/wiki/meta/refresh-triggers.md).

```bash
pnpm check:wiki-brain
graphify update . --no-cluster --force && cp graphify-out/graph.json .planning/graphs/graph.json
cd .planning/brain && find wiki -name '*.md' -exec python3 scripts/contextual-prefix.py {} --no-llm \; && python3 scripts/bm25-index.py build
```

Full trigger matrix: [`.planning/brain/wiki/meta/refresh-triggers.md`](.planning/brain/wiki/meta/refresh-triggers.md). Cursor: [`.cursor/rules/25-wiki-brain.mdc`](.cursor/rules/25-wiki-brain.mdc).

| Question | Source | Never |
|----------|--------|-------|
| Symbol / procedure location | semble → Read | wiki alone |
| Where to put new files | `codebase/STRUCTURE` + `CONVENTIONS` | guessing |
| Domain / business flow | `brain/wiki/hot.md` → `index.md` | mass-read milestones |
| Router counts, test status | `root.ts`, `pnpm test` | session memory |

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
- **Documentation follows code:** any product change in apps/packages → matching wiki + indexes/graph in same change set; `pnpm check:wiki-brain` before done (§ Documentation follows code).
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

**Search order:** [`.planning/INDEX.md`](.planning/INDEX.md) → semble → intel/graphify query → [`.planning/brain/wiki/hot.md`](.planning/brain/wiki/hot.md) (domain only) → Read file → grep only for exhaustive literals.

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
- **Comments:** self-explanatory → none. Only non-obvious rules, invariants, tricks. No `// increment i`, headers, “removed X”, or comment-dense 10-line functions. Match file’s comment density. Comments must be **meaningful explanations, never planning/process breadcrumbs**: NEVER put phase numbers, requirement/feature IDs, decision/pitfall/threat IDs, plan/wave tags or audit refs in source comments (`Phase 84`, `FOUND7-03`, `F-SCALE-06`, `(D-02)`, `Pitfall 4`, `T-84-05-01`, `US-FIELD-02`, `NEW-ARCH-01`, `· Plan 73-08`, `SC#3`). Keep the WHY, drop the ID; delete ID-only comments. Traceability → commit messages + `.planning/`, not code. Enforced by `pnpm lint:no-breadcrumbs`. Real domain/standard IDs (1099-NEC, W-8BEN, BG-20, §94 KP, P2002, HMAC-SHA256, RFC 8594) stay — they document behavior.
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
