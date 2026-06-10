---
title: Source web-vite ARCHITECTURE
type: meta
tags: [source, raw]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - .planning/brain/.raw/web-vite-ARCHITECTURE.md
  - apps/web-vite/ARCHITECTURE.md
updated: 2026-06-10
---

# Raw source: web-vite ARCHITECTURE.md

## Purpose

Staff SPA layering contract: page → container → hook → presentational component.

**Immutable copy:** `.planning/brain/.raw/web-vite-ARCHITECTURE.md`

## Summary

No tRPC in pages/containers; hooks own data boundary; CI guards enforce layers.

## Wiki synthesis

- [[patterns/web-vite-data-layer]]
- [[patterns/data-tables-workbench]]
- [[structure/web-vite-domains]]

## When to re-ingest

New CI check for web-vite or layer rule change.

## Verify live

```bash
pnpm check:web-vite-data-layer 2>&1 | tail -3
cat apps/web-vite/ARCHITECTURE.md | head -30
```

## Agent mistakes

- `useQuery` in `*-container.tsx`
- Skipping loading/empty/error states in containers
