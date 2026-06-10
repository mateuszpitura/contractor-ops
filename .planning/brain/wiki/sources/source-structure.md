---
title: Source STRUCTURE
type: meta
tags: [source, raw]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - .planning/brain/.raw/STRUCTURE.md
  - .planning/codebase/STRUCTURE.md
updated: 2026-06-10
---

# Raw source: STRUCTURE.md

## Purpose

File-placement compass: where new routers, services, web-vite components, and packages belong.

**Immutable copy:** `.planning/brain/.raw/STRUCTURE.md`

## Summary

Apps/packages layout, router folder taxonomy, web-vite domain folders, cron-worker jobs, prisma splits.

## Wiki synthesis

- [[structure/_index]]
- [[structure/apps]]
- [[structure/web-vite-domains]]
- [[structure/key-services]]

## When to re-ingest

New top-level app/package or domain folder convention change.

## Verify live

```bash
ls apps/ packages/
semble search "where to put" # then Read STRUCTURE.md
```

## Agent mistakes

- Guessing paths without STRUCTURE + semble
- Putting business logic in random app files instead of `packages/api/src/services/`
