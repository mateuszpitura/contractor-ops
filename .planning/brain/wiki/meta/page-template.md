---
title: Wiki page template
type: meta
tags: [meta, template]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - .planning/brain/wiki/meta/agent-discovery.md
updated: 2026-06-10
---

# Wiki page template

> **Do not cite router counts or symbol names from wiki pages alone.** Always verify with `verify_with` paths or `semble search`.
>
> **Living docs:** wiki pages must stay current with code — update the matching page whenever you add or change product behavior (`CLAUDE.md` § Documentation follows code).

## Required frontmatter

```yaml
---
title: Human-readable title
type: domain | pattern | structure | integration | decision | meta
tags: [relevant, tags]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - path/to/canonical/file.ts
  - semble search "<keyword>"
updated: YYYY-MM-DD
---
```

## Required body sections

1. **Purpose** — 2–3 sentences: what this area does in the product.
2. **Flow** — mermaid diagram (max ~15 nodes).
3. **Entry points** — table: stage → router/service/path (pointers only).
4. **UI surface** — web-vite folder + main `*-container.tsx` (if applicable).
5. **Invariants** — tenant, audit, flags, legal boundaries.
6. **Related** — Obsidian wikilinks from `wiki/` root (e.g. `[[patterns/tenant-and-audit]]`). **Never** parent-relative paths — breaks Obsidian graph ([[obsidian-setup]]).
7. **Verify live** — bash commands (`semble`, `intel query`, filtered typecheck).
8. **Agent mistakes** — common breaks from `.planning/INDEX.md` §5.

## Anti-duplication rules

- Wiki = compass + flows + invariants. **Not** a mirror of `packages/api/src/routers/**`.
- Link to `.planning/codebase/*` for brownfield snapshots; use semble for symbols.
- Never edit `.planning/brain/.raw/` — immutable ingest sources.

## Related

- [[agent-discovery]]
- [[refresh-triggers]]
