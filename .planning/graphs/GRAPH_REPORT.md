# Knowledge Graph Report

**Last AST extract:** 2026-06-10  
**Commit pinned in wiki:** `70f5782d78e33ba98c82e4ccda2cd4b0b4aff216`  
**Mode:** AST-only (`graphify update . --no-cluster --force`)

## Summary

| Metric | Value |
|--------|-------|
| Nodes | ~18 951 |
| Edges | ~46 434 |
| File | `.planning/graphs/graph.json` (**gitignored** — regen locally) |

## Regenerate

```bash
graphify update . --no-cluster --force
cp graphify-out/graph.json .planning/graphs/graph.json
pnpm check:wiki-brain
```

Excludes: `.graphifyignore` (tests, `.md`, `.planning/brain`, generated Prisma).

## Query

```bash
graphify query "invoice approval" --graph .planning/graphs/graph.json
node .claude/get-shit-done/bin/gsd-tools.cjs graphify query <term>
```

## Note

Bootstrap report (12 nodes) superseded by full AST graph. Wiki compass: `.planning/brain/wiki/`. Obsidian graph = wikilinks only — see `wiki/meta/obsidian-setup.md`.
