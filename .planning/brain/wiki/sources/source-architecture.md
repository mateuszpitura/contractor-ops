---
title: Source ARCHITECTURE
type: meta
tags: [source, raw]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - .planning/brain/.raw/ARCHITECTURE.md
  - .planning/codebase/ARCHITECTURE.md
updated: 2026-06-10
---

# Raw source: ARCHITECTURE.md

## Purpose

Immutable brownfield snapshot of system architecture — apps, packages, routing, multi-tenant session, core data flows. Agents use **wiki synthesis** for navigation; verify live code via semble.

**Immutable copy:** `.planning/brain/.raw/ARCHITECTURE.md`

## Summary

Monorepo topology, six apps, core packages, HTTP→tRPC routing, staff vs portal routers, multi-tenant session, invoice→payment flow, conditional classification.

## Wiki synthesis

- [[structure/monorepo-topology]]
- [[structure/api-routers-catalog]]
- [[domains/invoice-to-payment]]

## When to re-ingest

Large API refactor or new deployable app → `map-codebase` + copy to `.raw/` + update synthesis pages.

## Verify live

```bash
diff -q .planning/codebase/ARCHITECTURE.md .planning/brain/.raw/ARCHITECTURE.md 2>/dev/null || true
semble search "appRouter"
```

## Agent mistakes

- Citing router counts from this summary without `root.ts`
- Editing `.raw/` instead of wiki synthesis pages
