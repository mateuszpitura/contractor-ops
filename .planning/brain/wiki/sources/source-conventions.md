---
title: Source CONVENTIONS
type: meta
tags: [source, raw]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - .planning/brain/.raw/CONVENTIONS.md
  - .planning/codebase/CONVENTIONS.md
updated: 2026-06-10
---

# Raw source: CONVENTIONS.md

## Purpose

Naming, import, test, and API conventions for the monorepo — complements binding standards in `CLAUDE.md`.

**Immutable copy:** `.planning/brain/.raw/CONVENTIONS.md`

## Summary

tRPC procedure patterns, audit logging, env schema rules, web-vite layer naming, test placement.

## Wiki synthesis

- [[patterns/trpc-procedure-stack]]
- [[patterns/web-vite-data-layer]]
- [[patterns/tenant-and-audit]]
- [[patterns/ci-guards]]

## When to re-ingest

New enforced lint script or architecture rule added to CI.

## Verify live

```bash
pnpm lint:architecture --help 2>/dev/null | head -3
cat .planning/codebase/CONVENTIONS.md | head -40
```

## Agent mistakes

- `console.*` in app source (use `@contractor-ops/logger`)
- Page components calling `useTRPC` directly
