---
title: Memory authority order
type: decision
tags: [agents, anti-hallucination]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - .planning/MEMORY.md
  - CLAUDE.md
updated: 2026-06-09
---

# What agents should trust

Order (highest first):

1. In-tree verification — `root.ts`, `pnpm test`, `pnpm typecheck`
2. `CLAUDE.md` + `.planning/PROJECT.md`
3. `.planning/codebase/*` maps (commit pinned)
4. `.planning/intel/*` + `.planning/graphs/graph.json`
5. This wiki — **domain / why**, not symbol lookup
6. `.planning/milestones/**` — historical only

## Discard without re-verify

- Session memory, cross-repo handoffs
- Stale test counts from handoff docs
- Foreign emails / old router totals
- Root checklists (`contractor-ops-launch-checklist.md`) — WIP noise

## Compounding

New invariant after GSD phase → bullet in `.planning/MEMORY.md` + optional wiki synthesis page.
