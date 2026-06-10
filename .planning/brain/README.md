# contractor-ops brain vault (claude-obsidian)

Canonical Obsidian vault for **domain context, patterns, and decisions** — not code symbol lookup.

**Plugin:** claude-obsidian v1.9.2 (`claude-obsidian@agricidaniel-claude-obsidian`, user-scope)

## Open in Obsidian

1. Obsidian → **Open folder as vault**
2. Select: **`.planning/brain/`** (not repo root, not `wiki/` subfolder alone)
3. **Graph view** = wikilinks between `wiki/*.md` notes — see `wiki/meta/obsidian-setup.md`
4. **Code graph** (graphify) = `.planning/graphs/graph.json` — **not** in Obsidian; use `graphify tree` / `graphify query`

If graph is empty: wrong vault path, bad filter (`path:wiki` in `.obsidian/graph.json`), or broken `[[../...]]` links — run `node scripts/normalize-wiki-wikilinks.mjs`.

## Documentation follows code (binding)

Wiki is a **living compass** — must track `apps/` and `packages/`, not lag behind. Every feature, component, hook, package, router, service, integration, cron, schema, or flag change → update matching `wiki/` page in the **same change set**. See `CLAUDE.md` § Documentation follows code. Hook warns on doc drift at Stop.

## Layer protocol (anti-hallucination)

| Question | Source | Never alone |
|----------|--------|-------------|
| Where is symbol / procedure? | `semble search` → Read | wiki |
| File placement / conventions? | `.planning/codebase/STRUCTURE` + `CONVENTIONS` | guessing |
| Why / domain / business flow? | `wiki/hot.md` → `wiki/index.md` | 1400+ milestone files |
| Live numbers (routers, tests) | `root.ts`, `pnpm test` | session memory |

## Agent discovery order

1. `.planning/INDEX.md`
2. `semble search` / intel / graphify (code)
3. `.planning/brain/wiki/hot.md` (domain)
4. `.planning/brain/wiki/index.md` → specific page
5. Structure compass: `wiki/structure/_index.md` + `wiki/meta/agent-discovery.md`

## Wiki scale (2026-06-10)

~103 pages: structure (10), patterns (17), domains (23), integrations (21), decisions (3), sources (12), meta (8). P0–P2: staff-dashboard, slack, audit-log, public-api routes, web-vite map sync, vault-map.canvas. BM25: regen after wiki edits (`.vault-meta/` gitignored).

## Ingest policy

- **`.raw/`** — immutable copies of curated sources (codebase maps, ARCHITECTURE, selected PATTERNS). Do not edit.
- **New synthesis** — `/wiki ingest` or manual pages under `wiki/domains/`, `wiki/patterns/`, `wiki/decisions/`
- **Do not mass-ingest** `.planning/milestones/**` — stale WIP noise

## Graphify (code graph)

AST-only extract from repo root (no semantic LLM on docs/images):

```bash
graphify update . --no-cluster --force
cp graphify-out/graph.json .planning/graphs/graph.json   # local only — graph.json is gitignored (~20MB)
pnpm check:wiki-brain
```

Commit **wiki** + scripts; do **not** commit `graph.json` or `.vault-meta/` — regenerate on checkout.

Excludes: `.graphifyignore` (Prisma generated, tests, `.md`, HTML, images, `.planning/`).

Venv: `.planning/.venv-graphify/`

## Refresh

| Event | Action |
|-------|--------|
| GSD phase with new invariant | `MEMORY.md` + optional wiki synthesis page |
| Large router refactor | `map-codebase` + intel refresh |
| Session end (wiki edited) | Update `wiki/hot.md` |

## Scripts

Vendored from claude-obsidian plugin: `scripts/wiki-lock.sh`, `scripts/wiki-mode.py`, etc.

Hook adapter: `.claude/hooks/wiki-brain-inject.sh` (injects `wiki/hot.md` from this vault).
